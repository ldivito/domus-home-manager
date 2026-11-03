/**
 * Request handlers for the agent data API (/api/v1). Route files are thin
 * wrappers around these so the logic can be unit-tested directly.
 */
import { getDB } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { isSyncTable, isValidRecordId, SYNC_TABLE_NAMES, type SyncTableName } from '@/lib/sync-tables'
import { fetchRecord, listRecords } from '@/lib/sync-store'
import { authenticateApiKey, type ApiKeyContext } from './auth'
import { apiError, apiJson, readJson } from './http'
import type { ApiScope } from './keys'
import { bulkUpsert, deleteRecord, MAX_BULK_RECORDS, patchRecord, type BulkMode } from './records'
import { describeTable } from './table-metadata'
import type { NextResponse } from 'next/server'

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 500
/** Bulk request body cap (500 records of typical size fit comfortably). */
const MAX_BULK_BODY_BYTES = 10 * 1024 * 1024

type Handler = (ctx: ApiKeyContext) => Promise<NextResponse>

/** Authenticate, run the handler, and turn unexpected errors into a 500. */
async function guarded(request: Request, scope: ApiScope, handler: Handler): Promise<NextResponse> {
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

// ---------------------------------------------------------------- GET /api/v1/tables

export function handleListTables(request: Request): Promise<NextResponse> {
  return guarded(request, 'read', async () =>
    apiJson({ tables: SYNC_TABLE_NAMES.map(describeTable) })
  )
}

// ---------------------------------------------------------------- GET /api/v1/{table}

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

    // Captured before the query so nothing written meanwhile is skipped
    const serverTime = new Date().toISOString()
    const { records, hasMore } = await listRecords(getDB(ctx.env), ctx.scope, table, { since, cursor, limit })
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

    const modeParam = new URL(request.url).searchParams.get('mode') ?? 'replace'
    if (modeParam !== 'replace' && modeParam !== 'merge') {
      return apiError('invalid_request', 'mode must be "replace" or "merge"')
    }

    const results = await bulkUpsert(getDB(ctx.env), ctx, table, records, modeParam as BulkMode)
    const summary = { created: 0, updated: 0, skipped: 0, error: 0 }
    for (const r of results) summary[r.status]++

    logger.debug(`Data API bulk ${table}: ${JSON.stringify(summary)}`)
    // 207-style semantics with a plain 200: inspect per-record results
    return apiJson({ table, summary, results })
  })
}

// ---------------------------------------------------------------- PATCH /api/v1/{table}/{id}

export function handlePatchRecord(request: Request, tableParam: string, id: string): Promise<NextResponse> {
  return guarded(request, 'write', async ctx => {
    const table = parseTable(tableParam)
    if (!table) return unknownTable(tableParam)
    if (!isValidRecordId(id)) return apiError('invalid_request', 'Invalid record id')

    const body = await readJson(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return apiError('invalid_request', 'Body must be a JSON object with the fields to change')
    }
    const patch = body as Record<string, unknown>
    if (patch.id !== undefined && patch.id !== id) {
      return apiError('invalid_request', 'Body id does not match the URL id')
    }

    const outcome = await patchRecord(getDB(ctx.env), ctx, table, id, patch)
    if (outcome.ok === false) {
      return outcome.status === 404
        ? apiError('not_found', 'Record not found')
        : apiError('validation_failed', outcome.error)
    }
    return apiJson({ table, data: outcome.record, ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}) })
  })
}

// ---------------------------------------------------------------- DELETE /api/v1/{table}/{id}

export function handleDeleteRecord(request: Request, tableParam: string, id: string): Promise<NextResponse> {
  return guarded(request, 'write', async ctx => {
    const table = parseTable(tableParam)
    if (!table) return unknownTable(tableParam)
    if (!isValidRecordId(id)) return apiError('invalid_request', 'Invalid record id')

    const deleted = await deleteRecord(getDB(ctx.env), ctx, table, id)
    if (!deleted) return apiError('not_found', 'Record not found')
    return apiJson({ table, id, deleted: true })
  })
}
