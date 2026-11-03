/**
 * Request handlers for the agent data API (/api/v1). Route files are thin
 * wrappers around these so the logic can be unit-tested directly.
 */
import { getDB } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { isSyncTable, isValidRecordId, SYNC_TABLE_NAMES, type SyncTableName } from '@/lib/sync-tables'
import { fetchRecord, listFilteredRecords, listRecords, type StoredRecord } from '@/lib/sync-store'
import { authenticateApiKey, type ApiKeyContext } from './auth'
import { recalculateWallets, walletsTouched, type OpeningBalanceInput } from './balances'
import { apiError, apiJson, readJson } from './http'
import { deleteImportBatch, summarizeImportBatch } from './import-batches'
import type { ApiScope } from './keys'
import { bulkUpsert, deleteRecord, MAX_BULK_RECORDS, normalizeDate, patchRecord, type BulkMode } from './records'
import { allFields, describeTable, TABLE_METADATA } from './table-metadata'
import type { NextResponse } from 'next/server'

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 500
/** Bulk request body cap (500 records of typical size fit comfortably). */
const MAX_BULK_BODY_BYTES = 10 * 1024 * 1024

type Handler = (ctx: ApiKeyContext) => Promise<NextResponse>

/** Authenticate, run the handler, and turn unexpected errors into a 500. */
async function guarded(request: Request, scope: ApiScope | null, handler: Handler): Promise<NextResponse> {
  try {
    const auth = await authenticateApiKey(request, scope)
    if (auth.ok === false) return auth.response
    return await handler(auth.ctx)
  } catch (error) {
    logger.error('Data API error:', error)
    return apiError('internal_error', 'Internal server error')
  }
}

function parseTable(table: string): SyncTableName | null {
  return isSyncTable(table) ? table : null
}

function unknownTable(table: string): NextResponse {
  return apiError('not_found', `Unknown table "${table.slice(0, 100)}". GET /api/v1/tables lists the available tables.`)
}

function encodeCursor(receivedAt: string, recordId: string): string {
  return btoa(JSON.stringify([receivedAt, recordId])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeCursor(cursor: string): { receivedAt: string; recordId: string } | null {
  try {
    const padded = cursor.replace(/-/g, '+').replace(/_/g, '/')
    const value = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)))
    if (Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'string') {
      return { receivedAt: value[0], recordId: value[1] }
    }
  } catch {
    // fall through
  }
  return null
}

/** Parse a boolean query flag: absent/false/0 -> false, true/1 -> true, anything else -> error. */
function parseFlag(searchParams: URLSearchParams, name: string): boolean | NextResponse {
  const value = searchParams.get(name)
  if (value === null || value === '' || value === 'false' || value === '0') return false
  if (value === 'true' || value === '1') return true
  return apiError('invalid_request', `${name} must be "true" or "false"`)
}

const dryRunFlag = (dryRun: boolean) => (dryRun ? { dryRun: true } : {})

// ---------------------------------------------------------------- GET /api/v1/me

export function handleMe(request: Request): Promise<NextResponse> {
  return guarded(request, null, async ctx => {
    const row = await getDB(ctx.env)
      .prepare('SELECT id, name, keyPrefix, createdAt, lastUsedAt FROM api_keys WHERE id = ?')
      .bind(ctx.keyId)
      .first<{ id: string; name: string; keyPrefix: string; createdAt: string | null; lastUsedAt: string | null }>()
    if (!row) return apiError('unauthorized', 'Invalid API key.')
    return apiJson({
      keyId: row.id,
      name: row.name,
      prefix: row.keyPrefix,
      scopes: ctx.scopes,
      userId: ctx.userId,
      householdId: ctx.householdId,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt
    })
  })
}

// ---------------------------------------------------------------- GET /api/v1/tables

export function handleListTables(request: Request): Promise<NextResponse> {
  return guarded(request, 'read', async () =>
    apiJson({ tables: SYNC_TABLE_NAMES.map(describeTable) })
  )
}

// ---------------------------------------------------------------- GET /api/v1/{table}

/** Query parameters of the list endpoint that are not field filters. */
const LIST_PARAMS = new Set(['limit', 'cursor', 'updatedSince', 'dateFrom', 'dateTo'])

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function toBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === 'true') return true
  if (value === false || value === 0 || value === 'false') return false
  return undefined
}

const toTime = (value: unknown): number | null => {
  const iso = normalizeDate(value)
  return iso === null ? null : new Date(iso).getTime()
}

/**
 * Build the in-memory predicate for `?field=value` equality filters (repeat a
 * parameter to match any of several values) and dateFrom/dateTo on the
 * table's main date field. Returns null when no filter is set.
 */
function buildListFilter(
  table: SyncTableName,
  searchParams: URLSearchParams
): { predicate: ((record: StoredRecord) => boolean) | null } | { error: string } {
  const fields = allFields(table)
  const tests: Array<(data: Record<string, unknown>) => boolean> = []

  for (const name of new Set(searchParams.keys())) {
    if (LIST_PARAMS.has(name)) continue
    const spec = fields[name]
    if (!spec) {
      return { error: `Unknown filter field "${name.slice(0, 100)}" for ${table}. GET /api/v1/tables lists the fields.` }
    }
    const raw = searchParams.getAll(name)
    switch (spec.type) {
      case 'string': {
        if (spec.enum) {
          const bad = raw.find(v => !spec.enum!.includes(v))
          if (bad !== undefined) return { error: `${name}: must be one of ${spec.enum.map(v => JSON.stringify(v)).join(', ')}` }
        }
        const wanted = new Set(raw)
        // An empty value matches records where the field is empty or missing
        tests.push(data => {
          const value = data[name]
          if (value === undefined || value === null || value === '') return wanted.has('')
          return typeof value === 'string' && wanted.has(value)
        })
        break
      }
      case 'number':
      case 'integer': {
        const nums = raw.map(Number)
        if (raw.some(v => !v.trim()) || nums.some(v => !Number.isFinite(v))) return { error: `${name}: expected a number` }
        if (spec.enum && nums.some(v => !spec.enum!.includes(v))) {
          return { error: `${name}: must be one of ${spec.enum.join(', ')}` }
        }
        tests.push(data => {
          const value = data[name]
          if (value === undefined || value === null || value === '') return false
          return nums.includes(Number(value))
        })
        break
      }
      case 'boolean': {
        const bools = raw.map(v => (v === '1' ? true : v === '0' ? false : toBoolean(v)))
        if (bools.some(v => v === undefined)) return { error: `${name}: expected true or false` }
        // Stored legacy 0/1 values compare as booleans; a missing field matches false
        tests.push(data => bools.includes(toBoolean(data[name]) ?? false))
        break
      }
      case 'date': {
        const times = raw.map(toTime)
        if (times.some(t => t === null)) return { error: `${name}: invalid date` }
        tests.push(data => times.includes(toTime(data[name])))
        break
      }
      default:
        return { error: `${name}: ${spec.type} fields cannot be filtered` }
    }
  }

  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  if (dateFrom || dateTo) {
    const dateField = TABLE_METADATA[table].dateField
    if (!dateField) return { error: `${table} has no main date field; dateFrom/dateTo are not supported (filter by updatedSince instead)` }
    // Date-only values cover the whole UTC day
    const bound = (value: string, endOfDay: boolean) =>
      DATE_ONLY.test(value.trim())
        ? new Date(`${value.trim()}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`).getTime()
        : toTime(value)
    const from = dateFrom ? bound(dateFrom, false) : null
    const to = dateTo ? bound(dateTo, true) : null
    if ((dateFrom && from === null) || (dateTo && to === null)) {
      return { error: 'dateFrom/dateTo must be ISO 8601 dates (e.g. 2026-11-01)' }
    }
    tests.push(data => {
      const at = toTime(data[dateField])
      if (at === null) return false
      return (from === null || at >= from) && (to === null || at <= to)
    })
  }

  if (tests.length === 0) return { predicate: null }
  return { predicate: record => tests.every(test => test(record.data)) }
}

export function handleListRecords(request: Request, tableParam: string): Promise<NextResponse> {
  return guarded(request, 'read', async ctx => {
    const table = parseTable(tableParam)
    if (!table) return unknownTable(tableParam)

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(1, parseInt(limitParam || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)

    let since: string | null = null
    const sinceParam = searchParams.get('updatedSince')
    if (sinceParam) {
      const date = new Date(sinceParam)
      if (isNaN(date.getTime())) return apiError('invalid_request', 'updatedSince must be an ISO 8601 timestamp')
      since = date.toISOString()
    }

    let cursor = null
    const cursorParam = searchParams.get('cursor')
    if (cursorParam) {
      cursor = decodeCursor(cursorParam)
      if (!cursor) return apiError('invalid_request', 'Invalid cursor')
    }

    const filter = buildListFilter(table, searchParams)
    if ('error' in filter) return apiError('invalid_request', filter.error)

    // Captured before the query so nothing written meanwhile is skipped
    const serverTime = new Date().toISOString()
    const db = getDB(ctx.env)
    const { records, hasMore } = filter.predicate
      ? await listFilteredRecords(db, ctx.scope, table, { since, cursor, limit, predicate: filter.predicate })
      : await listRecords(db, ctx.scope, table, { since, cursor, limit })
    const last = records[records.length - 1]
    return apiJson({
      table,
      data: records.map(r => r.data),
      count: records.length,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor(last.receivedAt, last.recordId) : null,
      // Pass as updatedSince on the next incremental fetch (after paging to the end)
      serverTime
    })
  })
}

// ---------------------------------------------------------------- GET /api/v1/{table}/{id}

export function handleGetRecord(request: Request, tableParam: string, id: string): Promise<NextResponse> {
  return guarded(request, 'read', async ctx => {
    const table = parseTable(tableParam)
    if (!table) return unknownTable(tableParam)
    if (!isValidRecordId(id)) return apiError('invalid_request', 'Invalid record id')

    const record = await fetchRecord(getDB(ctx.env), ctx.scope, table, id)
    if (!record) return apiError('not_found', 'Record not found')
    return apiJson({ table, data: record.data })
  })
}

// ---------------------------------------------------------------- POST /api/v1/{table}/bulk

export function handleBulkUpsert(request: Request, tableParam: string): Promise<NextResponse> {
  return guarded(request, 'write', async ctx => {
    const table = parseTable(tableParam)
    if (!table) return unknownTable(tableParam)

    const length = Number(request.headers.get('content-length') || 0)
    if (length > MAX_BULK_BODY_BYTES) {
      return apiError('payload_too_large', `Request body exceeds ${MAX_BULK_BODY_BYTES} bytes`)
    }

    const { searchParams } = new URL(request.url)
    const modeParam = searchParams.get('mode') ?? 'replace'
    if (modeParam !== 'replace' && modeParam !== 'merge') {
      return apiError('invalid_request', 'mode must be "replace" or "merge"')
    }
    const dryRun = parseFlag(searchParams, 'dryRun')
    if (typeof dryRun !== 'boolean') return dryRun
    const recalculate = parseFlag(searchParams, 'recalculateBalances')
    if (typeof recalculate !== 'boolean') return recalculate
    if (recalculate && table !== 'personalTransactions') {
      return apiError('invalid_request', 'recalculateBalances is only supported on personalTransactions')
    }
    const importBatchId = searchParams.get('importBatchId') ?? undefined
    if (importBatchId !== undefined && !isValidRecordId(importBatchId)) {
      return apiError('invalid_request', 'importBatchId must be a non-empty string of at most 200 characters')
    }

    const body = await readJson(request)
    const records = Array.isArray(body)
      ? body
      : body && typeof body === 'object' ? (body as { records?: unknown }).records : undefined
    if (!Array.isArray(records)) {
      return apiError('invalid_request', 'Body must be { "records": [ ... ] } (or a JSON array of records)')
    }
    if (records.length === 0) return apiError('invalid_request', 'records must not be empty')
    if (records.length > MAX_BULK_RECORDS) {
      return apiError('payload_too_large', `At most ${MAX_BULK_RECORDS} records per request (got ${records.length})`)
    }

    const db = getDB(ctx.env)
    const { results, writes } = await bulkUpsert(db, ctx, table, records, { mode: modeParam as BulkMode, dryRun, importBatchId })
    const summary = { created: 0, updated: 0, skipped: 0, error: 0 }
    for (const r of results) summary[r.status]++

    let balances
    if (recalculate) {
      // A dry run reports the balances the batch would produce
      const overlay = dryRun ? new Map(writes.map(w => [w.id, w.data])) : undefined
      balances = await recalculateWallets(db, ctx, walletsTouched(writes), { dryRun, overlay })
    }

    logger.debug(`Data API bulk ${table}${dryRun ? ' (dry run)' : ''}: ${JSON.stringify(summary)}`)
    // 207-style semantics with a plain 200: inspect per-record results
    return apiJson({
      table,
      ...dryRunFlag(dryRun),
      ...(importBatchId !== undefined ? { importBatchId } : {}),
      summary,
      results,
      ...(balances ? { balances } : {})
    })
  })
}

// ---------------------------------------------------------------- PATCH /api/v1/{table}/{id}

export function handlePatchRecord(request: Request, tableParam: string, id: string): Promise<NextResponse> {
  return guarded(request, 'write', async ctx => {
    const table = parseTable(tableParam)
    if (!table) return unknownTable(tableParam)
    if (!isValidRecordId(id)) return apiError('invalid_request', 'Invalid record id')
    const dryRun = parseFlag(new URL(request.url).searchParams, 'dryRun')
    if (typeof dryRun !== 'boolean') return dryRun

    const body = await readJson(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return apiError('invalid_request', 'Body must be a JSON object with the fields to change')
    }
    const patch = body as Record<string, unknown>
    if (patch.id !== undefined && patch.id !== id) {
      return apiError('invalid_request', 'Body id does not match the URL id')
    }

    const outcome = await patchRecord(getDB(ctx.env), ctx, table, id, patch, { dryRun })
    if (outcome.ok === false) {
      return outcome.status === 404
        ? apiError('not_found', 'Record not found')
        : apiError('validation_failed', outcome.error)
    }
    return apiJson({
      table,
      ...dryRunFlag(dryRun),
      data: outcome.record,
      ...(outcome.warnings.length ? { warnings: outcome.warnings } : {})
    })
  })
}

// ---------------------------------------------------------------- DELETE /api/v1/{table}/{id}

export function handleDeleteRecord(request: Request, tableParam: string, id: string): Promise<NextResponse> {
  return guarded(request, 'write', async ctx => {
    const table = parseTable(tableParam)
    if (!table) return unknownTable(tableParam)
    if (!isValidRecordId(id)) return apiError('invalid_request', 'Invalid record id')
    const dryRun = parseFlag(new URL(request.url).searchParams, 'dryRun')
    if (typeof dryRun !== 'boolean') return dryRun

    const deleted = await deleteRecord(getDB(ctx.env), ctx, table, id, { dryRun })
    if (!deleted) return apiError('not_found', 'Record not found')
    return apiJson({ table, id, ...dryRunFlag(dryRun), deleted: true })
  })
}

// ---------------------------------------------------------------- POST /api/v1/personalWallets/{id}/recalculate

/** Read an optional JSON object body: empty -> {}, invalid -> null. */
async function readOptionalObject(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text()
  if (!text.trim()) return {}
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

export function handleRecalculateWallet(request: Request, tableParam: string, id: string): Promise<NextResponse> {
  return guarded(request, 'write', async ctx => {
    if (tableParam !== 'personalWallets') {
      return apiError('not_found', 'recalculate is only available on personalWallets: POST /api/v1/personalWallets/{id}/recalculate')
    }
    if (!isValidRecordId(id)) return apiError('invalid_request', 'Invalid record id')
    const dryRun = parseFlag(new URL(request.url).searchParams, 'dryRun')
    if (typeof dryRun !== 'boolean') return dryRun

    const body = await readOptionalObject(request)
    if (!body) return apiError('invalid_request', 'Body must be empty or a JSON object { openingBalance?, openingBalanceDate? }')

    const opening: OpeningBalanceInput = {}
    if ('openingBalance' in body) {
      const value = body.openingBalance
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
        return apiError('validation_failed', 'openingBalance: expected finite number (or null to clear)')
      }
      opening.openingBalance = value as number | null
    }
    if ('openingBalanceDate' in body) {
      const value = body.openingBalanceDate
      if (value === null) opening.openingBalanceDate = null
      else {
        const iso = normalizeDate(value)
        if (iso === null) return apiError('validation_failed', 'openingBalanceDate: invalid date (use ISO 8601, e.g. 2026-10-01)')
        opening.openingBalanceDate = iso
      }
    }

    const [result] = await recalculateWallets(getDB(ctx.env), ctx, [id], { dryRun, opening })
    if ('error' in result) {
      return result.error === 'wallet not found'
        ? apiError('not_found', 'Record not found')
        : apiError('validation_failed', result.error)
    }
    return apiJson({ ...dryRunFlag(dryRun), ...result })
  })
}

// ---------------------------------------------------------------- /api/v1/import-batches/{batchId}

export function handleGetImportBatch(request: Request, batchId: string): Promise<NextResponse> {
  return guarded(request, 'read', async ctx => {
    if (!isValidRecordId(batchId)) return apiError('invalid_request', 'Invalid batch id')
    const summary = await summarizeImportBatch(getDB(ctx.env), ctx, batchId)
    if (summary.total === 0) return apiError('not_found', `No live records with importBatchId "${batchId.slice(0, 100)}"`)
    return apiJson(summary)
  })
}

export function handleDeleteImportBatch(request: Request, batchId: string): Promise<NextResponse> {
  return guarded(request, 'write', async ctx => {
    if (!isValidRecordId(batchId)) return apiError('invalid_request', 'Invalid batch id')
    const { searchParams } = new URL(request.url)
    const dryRun = parseFlag(searchParams, 'dryRun')
    if (typeof dryRun !== 'boolean') return dryRun
    const recalculate = parseFlag(searchParams, 'recalculateBalances')
    if (typeof recalculate !== 'boolean') return recalculate

    const db = getDB(ctx.env)
    const { transactionWallets, transactionIds, ...summary } = await deleteImportBatch(db, ctx, batchId, { dryRun })
    if (summary.total === 0) return apiError('not_found', `No live records with importBatchId "${batchId.slice(0, 100)}"`)

    let balances
    if (recalculate) {
      // A dry run pretends the batch's transactions are already gone
      const overlay = dryRun ? new Map(transactionIds.map(id => [id, null])) : undefined
      balances = await recalculateWallets(db, ctx, transactionWallets, { dryRun, overlay })
    }
    return apiJson({
      ...dryRunFlag(dryRun),
      batchId,
      deleted: summary.tables,
      total: summary.total,
      ...(balances ? { balances } : {})
    })
  })
}
