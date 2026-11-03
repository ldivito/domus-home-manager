/**
 * Record preparation and write operations for the agent data API.
 *
 * Writes go into sync_metadata through the same LWW statement as
 * /api/sync/push (src/lib/sync-store.ts), so every device picks them up on its
 * next pull. Each record is normalized (ids, ISO dates, defaults, household)
 * and validated against the table metadata plus validateSyncPayload, the
 * same per-table validation push applies.
 */
import { validateSyncPayload } from '@/app/api/sync/table-schemas'
import { generateId } from '@/lib/utils'
import { isValidRecordId, type SyncTableName } from '@/lib/sync-tables'
import {
  executeSyncWrites,
  fetchLatestVersions,
  listAllRecords,
  prepareSyncWrite,
  type StoredRecord,
  type SyncDB,
  type SyncScope
} from '@/lib/sync-store'
import { allFields, KEY_OWNER, NOW, TABLE_METADATA, type FieldSpec } from './table-metadata'

export const MAX_BULK_RECORDS = 500
/** Per-record serialized size cap (D1 rows are limited to ~2 MB). */
export const MAX_RECORD_BYTES = 1_000_000
/** Client-supplied updatedAt may not be further in the future than this. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000

export interface WriteContext {
  userId: string
  householdId: string | null
  scope: SyncScope
}

export type BulkMode = 'replace' | 'merge'

export type RecordResult =
  | { index: number; id: string; status: 'created' | 'updated'; warnings?: string[] }
  | { index: number; id: string; status: 'skipped'; reason: string; warnings?: string[] }
  | { index: number; id?: string; status: 'error'; error: string }

type Data = Record<string, unknown>

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function isPlainObject(value: unknown): value is Data {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

/**
 * Normalize a date input to a full ISO-8601 UTC string (the only format the
 * client's pull revives into Date objects). Date-only strings become noon
 * UTC so the calendar day is the same in every timezone between UTC-11 and
 * UTC+11. Returns null for unparseable values.
 */
export function normalizeDate(value: unknown): string | null {
  let date: Date
  if (value instanceof Date) date = value
  else if (typeof value === 'number' && Number.isFinite(value)) date = new Date(value)
  else if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    date = new Date(DATE_ONLY.test(trimmed) ? `${trimmed}T12:00:00.000Z` : trimmed)
  } else return null
  return isNaN(date.getTime()) ? null : date.toISOString()
}

function checkType(name: string, spec: FieldSpec, value: unknown): string | null {
  if (spec.enum && !spec.enum.includes(value as string | number)) {
    return `${name}: must be one of ${spec.enum.map(v => JSON.stringify(v)).join(', ')}`
  }
  switch (spec.type) {
    case 'string':
      return typeof value === 'string' ? null : `${name}: expected string`
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : `${name}: expected finite number`
    case 'integer':
      return Number.isInteger(value) ? null : `${name}: expected integer`
    case 'boolean':
      return typeof value === 'boolean' ? null : `${name}: expected boolean`
    case 'array':
      return Array.isArray(value) ? null : `${name}: expected array`
    case 'object':
      return isPlainObject(value) ? null : `${name}: expected object`
    case 'date':
      return null // normalized separately
  }
}

interface FinalizeOptions {
  isCreate: boolean
  ctx: WriteContext
  nowIso: string
}

/**
 * Apply defaults (on create), normalize dates, force householdId and check
 * types/enums/required fields. Mutates and returns `record`.
 */
function finalizeRecord(
  table: SyncTableName,
  record: Data,
  { isCreate, ctx, nowIso }: FinalizeOptions
): { errors: string[]; warnings: string[] } {
  const fields = allFields(table)
  const errors: string[] = []
  const warnings: string[] = []

  // null means "unset" (Dexie stores optional fields as undefined)
  for (const key of Object.keys(record)) {
    if (record[key] === null) delete record[key]
  }

  if (isCreate) {
    for (const [name, spec] of Object.entries(fields)) {
      if (record[name] !== undefined || spec.default === undefined) continue
      if (spec.default === KEY_OWNER) record[name] = ctx.userId
      else if (spec.default === NOW) record[name] = nowIso
      else record[name] = structuredClone(spec.default)
    }
    if (record.createdAt === undefined) record.createdAt = nowIso
  }

  // Records always belong to the key's household (never another one)
  if (ctx.householdId) record.householdId = ctx.householdId
  else delete record.householdId

  for (const [name, value] of Object.entries(record)) {
    const spec = fields[name]
    if (!spec) {
      warnings.push(`unknown field "${name}" stored as-is`)
      continue
    }
    if (spec.type === 'date') {
      const iso = normalizeDate(value)
      if (iso === null) errors.push(`${name}: invalid date (use ISO 8601, e.g. 2026-11-03 or 2026-11-03T15:00:00Z)`)
      else record[name] = iso
      continue
    }
    const typeError = checkType(name, spec, value)
    if (typeError) errors.push(typeError)
  }

  if (isCreate) {
    for (const [name, spec] of Object.entries(fields)) {
      if (spec.required && (record[name] === undefined || record[name] === '')) {
        errors.push(`${name}: required`)
      }
    }
  }

  if (errors.length === 0) {
    const check = validateSyncPayload(table, record)
    if (check.ok === false) errors.push(check.error)
  }

  if (errors.length === 0 && JSON.stringify(record).length > MAX_RECORD_BYTES) {
    errors.push(`record exceeds ${MAX_RECORD_BYTES} bytes`)
  }

  return { errors, warnings }
}

// ------------------------------------------------------------------ Name lookups

const NAME_FIELDS: Partial<Record<SyncTableName, Record<string, { idField: string; table: SyncTableName }>>> = {
  personalTransactions: {
    categoryName: { idField: 'categoryId', table: 'personalCategories' },
    walletName: { idField: 'walletId', table: 'personalWallets' },
    targetWalletName: { idField: 'targetWalletId', table: 'personalWallets' }
  }
}

type LookupCache = Map<SyncTableName, StoredRecord[]>

async function loadLookup(db: SyncDB, scope: SyncScope, table: SyncTableName, cache: LookupCache) {
  let records = cache.get(table)
  if (!records) {
    records = await listAllRecords(db, scope, table)
    cache.set(table, records)
  }
  return records
}

/** Replace `categoryName`/`walletName`-style fields with resolved ids. */
async function resolveNames(
  db: SyncDB,
  table: SyncTableName,
  record: Data,
  ctx: WriteContext,
  cache: LookupCache
): Promise<string[]> {
  const mapping = NAME_FIELDS[table]
  if (!mapping) return []
  const errors: string[] = []

  for (const [nameField, { idField, table: lookupTable }] of Object.entries(mapping)) {
    if (!(nameField in record)) continue
    const wanted = record[nameField]
    delete record[nameField]
    if (record[idField] !== undefined) continue // explicit id wins
    if (typeof wanted !== 'string' || !wanted.trim()) {
      errors.push(`${nameField}: expected non-empty string`)
      continue
    }

    const owner = (record.userId as string | undefined) ?? ctx.userId
    const needle = wanted.trim().toLowerCase()
    let matches = (await loadLookup(db, ctx.scope, lookupTable, cache)).filter(r =>
      typeof r.data.name === 'string' &&
      r.data.name.trim().toLowerCase() === needle &&
      (r.data.userId === undefined || r.data.userId === owner)
    )
    // Categories: prefer the one matching the transaction type
    if (lookupTable === 'personalCategories' && matches.length > 1 && typeof record.type === 'string') {
      const sameType = matches.filter(r => r.data.type === record.type)
      if (sameType.length > 0) matches = sameType
    }

    if (matches.length === 0) errors.push(`${nameField}: no ${lookupTable} record named "${wanted}"`)
    else if (matches.length > 1) errors.push(`${nameField}: "${wanted}" is ambiguous (${matches.length} matches); pass ${idField}`)
    else record[idField] = matches[0].recordId
  }
  return errors
}

// ------------------------------------------------------------------ Bulk upsert

export async function bulkUpsert(
  db: SyncDB,
  ctx: WriteContext,
  table: SyncTableName,
  items: unknown[],
  mode: BulkMode = 'replace'
): Promise<RecordResult[]> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const prefix = TABLE_METADATA[table].idPrefix
  const results: RecordResult[] = new Array(items.length)
  const cache: LookupCache = new Map()
  const seenIds = new Set<string>()

  // Pass 1: shape checks and id assignment
  const candidates: Array<{ index: number; id: string; data: Data }> = []
  items.forEach((item, index) => {
    if (!isPlainObject(item)) {
      results[index] = { index, status: 'error', error: 'record must be a JSON object' }
      return
    }
    const data: Data = { ...item }
    if (data.id === undefined || data.id === null || data.id === '') data.id = generateId(prefix)
    if (!isValidRecordId(data.id)) {
      results[index] = { index, status: 'error', error: 'id: must be a non-empty string of at most 200 characters' }
      return
    }
    const id = data.id
    if (seenIds.has(id)) {
      results[index] = { index, id, status: 'error', error: 'id: duplicated within this request' }
      return
    }
    seenIds.add(id)
    candidates.push({ index, id, data })
  })

  const existing = await fetchLatestVersions(db, ctx.scope, table, candidates.map(c => c.id))

  // Pass 2: normalize, validate, decide
  const writes: Array<{ index: number; id: string; status: 'created' | 'updated'; warnings: string[]; data: Data; updatedAt: string }> = []
  for (const { index, id, data: input } of candidates) {
    const stored = existing.get(id)
    const live = stored && stored.operation !== 'delete' ? stored : undefined

    const record: Data = mode === 'merge' && live ? { ...live.data, ...input } : input
    record.id = id

    const nameErrors = await resolveNames(db, table, record, ctx, cache)

    let updatedAt = nowIso
    if (input.updatedAt !== undefined && input.updatedAt !== null) {
      const iso = normalizeDate(input.updatedAt)
      if (iso === null) {
        results[index] = { index, id, status: 'error', error: 'updatedAt: invalid date' }
        continue
      }
      if (new Date(iso).getTime() > now + MAX_CLOCK_SKEW_MS) {
        results[index] = { index, id, status: 'error', error: 'updatedAt: is in the future' }
        continue
      }
      updatedAt = iso
    }
    record.updatedAt = updatedAt
    // Keep the original creation time when replacing an existing record
    if (live && record.createdAt === undefined && live.data.createdAt !== undefined) {
      record.createdAt = live.data.createdAt
    }

    const { errors, warnings } = finalizeRecord(table, record, { isCreate: !live || mode === 'replace', ctx, nowIso })
    errors.unshift(...nameErrors)
    if (errors.length > 0) {
      results[index] = { index, id, status: 'error', error: errors.join('; ') }
      continue
    }

    // Last-writer-wins: never overwrite (or resurrect over) a newer version
    if (stored && stored.updatedAt >= updatedAt) {
      results[index] = {
        index,
        id,
        status: 'skipped',
        reason: stored.operation === 'delete'
          ? `record was deleted at ${stored.updatedAt} (after this version's updatedAt)`
          : `stored version is newer or equal (updatedAt ${stored.updatedAt})`,
        ...(warnings.length ? { warnings } : {})
      }
      continue
    }

    writes.push({ index, id, status: live ? 'updated' : 'created', warnings, data: record, updatedAt })
  }

  await executeSyncWrites(
    db,
    writes.map(w =>
      prepareSyncWrite(db, ctx.scope, {
        table,
        recordId: w.id,
        operation: 'upsert',
        data: w.data,
        updatedAt: w.updatedAt,
        receivedAt: nowIso
      })
    )
  )
  for (const w of writes) {
    results[w.index] = { index: w.index, id: w.id, status: w.status, ...(w.warnings.length ? { warnings: w.warnings } : {}) }
  }
  return results
}

// ------------------------------------------------------------------ Patch / delete

/** Edit time for an explicit single-record write: now, but always after the stored version. */
function nextUpdatedAt(stored: StoredRecord, now: number): string {
  const storedMs = new Date(stored.updatedAt).getTime()
  return new Date(Number.isFinite(storedMs) && storedMs >= now ? storedMs + 1 : now).toISOString()
}

export type PatchOutcome =
  | { ok: true; record: Data; warnings: string[] }
  | { ok: false; status: 404 | 422; error: string }

export async function patchRecord(
  db: SyncDB,
  ctx: WriteContext,
  table: SyncTableName,
  id: string,
  patch: Data
): Promise<PatchOutcome> {
  const stored = (await fetchLatestVersions(db, ctx.scope, table, [id])).get(id)
  if (!stored || stored.operation === 'delete') return { ok: false, status: 404, error: 'record not found' }

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const updatedAt = nextUpdatedAt(stored, now)

  const changes: Data = { ...patch }
  delete changes.id
  delete changes.updatedAt
  const record: Data = { ...stored.data, ...changes, id, updatedAt }

  const nameErrors = await resolveNames(db, table, record, ctx, new Map())
  const { errors, warnings } = finalizeRecord(table, record, { isCreate: false, ctx, nowIso })
  errors.unshift(...nameErrors)
  // Clearing (null) a required field is not allowed
  for (const [name, spec] of Object.entries(allFields(table))) {
    if (spec.required && patch[name] === null) errors.push(`${name}: required, cannot be cleared`)
  }
  if (errors.length > 0) return { ok: false, status: 422, error: errors.join('; ') }

  await executeSyncWrites(db, [
    prepareSyncWrite(db, ctx.scope, { table, recordId: id, operation: 'upsert', data: record, updatedAt, receivedAt: nowIso })
  ])
  return { ok: true, record, warnings }
}

/** Write a delete tombstone exactly like a client deletion does. */
export async function deleteRecord(
  db: SyncDB,
  ctx: WriteContext,
  table: SyncTableName,
  id: string
): Promise<boolean> {
  const stored = (await fetchLatestVersions(db, ctx.scope, table, [id])).get(id)
  if (!stored || stored.operation === 'delete') return false

  const now = Date.now()
  const updatedAt = nextUpdatedAt(stored, now)
  // Same payload shape as the client's deletion log entries
  const data: Data = { id, householdId: ctx.householdId ?? undefined }
  await executeSyncWrites(db, [
    prepareSyncWrite(db, ctx.scope, {
      table,
      recordId: id,
      operation: 'delete',
      data,
      updatedAt,
      receivedAt: new Date(now).toISOString()
    })
  ])
  return true
}
