/**
 * Record preparation and write operations for the agent data API.
 *
 * Writes go into sync_metadata through the same LWW statement as
 * /api/sync/push (src/lib/sync-store.ts), so every device picks them up on its
 * next pull. Each record is normalized (ids, ISO dates, defaults, household)
 * and validated against the table metadata plus validateSyncPayload, the
 * same per-table validation push applies.
 *
 * Every write accepts `dryRun`: the full pipeline runs (validation, name
 * resolution, LWW decision, exchange-rate fill) and returns the same results,
 * but nothing is written.
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

export interface WriteOptions {
  /** Run everything but write nothing. */
  dryRun?: boolean
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

const isBlank = (value: unknown) => value === undefined || value === ''

/** Rules that depend on other fields (mirror the app's forms). */
const CONDITIONAL_RULES: Partial<Record<SyncTableName, { fields: string[]; check: (record: Data) => string[] }>> = {
  personalTransactions: {
    fields: ['type', 'categoryId', 'targetWalletId'],
    check: record => {
      if (record.type === 'transfer') {
        if (record.categoryId === undefined) record.categoryId = '' // the app stores transfers without category
        return isBlank(record.targetWalletId) ? ['targetWalletId: required for transfers'] : []
      }
      return isBlank(record.categoryId) ? ['categoryId: required'] : []
    }
  },
  personalScheduledPayments: {
    fields: ['paymentType', 'fixedAmount'],
    check: record =>
      record.paymentType === 'fixed' && record.fixedAmount === undefined
        ? ["fixedAmount: required when paymentType is 'fixed'"]
        : []
  }
}

/**
 * Lenient normalization of a stored value the request did not touch: known
 * legacy shapes (0/1 booleans, numeric strings, non-ISO dates) are converted,
 * anything else is kept as it is.
 */
function coerceStoredValue(spec: FieldSpec, value: unknown): unknown {
  switch (spec.type) {
    case 'boolean':
      return value === 0 || value === 1 ? value === 1 : value
    case 'number':
    case 'integer': {
      if (typeof value !== 'string' || !value.trim()) return value
      const num = Number(value)
      if (!Number.isFinite(num) || (spec.type === 'integer' && !Number.isInteger(num))) return value
      return num
    }
    case 'date':
      return normalizeDate(value) ?? value
    default:
      return value
  }
}

interface FinalizeOptions {
  isCreate: boolean
  ctx: WriteContext
  nowIso: string
  /**
   * Fields sent by the client when updating an existing record (merge mode,
   * PATCH). Only these are validated strictly; stored fields get lenient
   * legacy coercion. Omit for full validation (create / replace).
   */
  incoming?: Set<string>
}

/**
 * Apply defaults (on create), normalize dates, force householdId and check
 * types/enums/required fields. Mutates `record`.
 */
function finalizeRecord(
  table: SyncTableName,
  record: Data,
  { isCreate, ctx, nowIso, incoming }: FinalizeOptions
): { errors: string[]; warnings: string[] } {
  const fields = allFields(table)
  const errors: string[] = []
  const warnings: string[] = []
  // Server-managed fields are always checked
  const isStrict = (name: string) =>
    !incoming || incoming.has(name) || name === 'id' || name === 'updatedAt' || name === 'householdId'

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
    if (!isStrict(name)) {
      if (spec) record[name] = coerceStoredValue(spec, value)
      continue
    }
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
    if (spec.type === 'boolean' && (value === 0 || value === 1)) {
      record[name] = value === 1
      warnings.push(`${name}: converted ${value} to ${value === 1}; send a JSON boolean`)
      continue
    }
    const typeError = checkType(name, spec, value)
    if (typeError) errors.push(typeError)
  }

  const rule = CONDITIONAL_RULES[table]
  if (isCreate) {
    for (const [name, spec] of Object.entries(fields)) {
      if (spec.required && isBlank(record[name])) errors.push(`${name}: required`)
    }
    if (rule) errors.push(...rule.check(record))
  } else {
    // Updates: a sent field may not clear a required one
    for (const [name, spec] of Object.entries(fields)) {
      if (spec.required && (!incoming || incoming.has(name)) && isBlank(record[name])) {
        errors.push(`${name}: required, cannot be cleared`)
      }
    }
    // Cross-field rules are re-checked when the update touches their fields
    if (rule && (!incoming || rule.fields.some(f => incoming.has(f)))) errors.push(...rule.check(record))
  }

  if (errors.length === 0) {
    // Device-sync payload validation over the fields this request is responsible for
    const subject = incoming
      ? Object.fromEntries(Object.entries(record).filter(([name]) => isStrict(name)))
      : record
    const check = validateSyncPayload(table, subject)
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

export type LookupCache = Map<SyncTableName, StoredRecord[]>

async function loadLookup(db: SyncDB, scope: SyncScope, table: SyncTableName, cache: LookupCache) {
  let records = cache.get(table)
  if (!records) {
    records = await listAllRecords(db, scope, table)
    cache.set(table, records)
  }
  return records
}

/**
 * Replace `categoryName`/`walletName`-style fields with resolved ids. An id
 * sent explicitly in `input` wins over the name; a stored id (merge/PATCH)
 * does not.
 */
async function resolveNames(
  db: SyncDB,
  table: SyncTableName,
  record: Data,
  input: Data,
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
    if (input[idField] !== undefined) continue // explicit id wins
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
    // Categories: prefer the one matching the transaction type (refunds use expense categories)
    if (lookupTable === 'personalCategories' && matches.length > 1 && typeof record.type === 'string') {
      const wantedType = record.type === 'refund' ? 'expense' : record.type
      const sameType = matches.filter(r => r.data.type === wantedType)
      if (sameType.length > 0) matches = sameType
    }

    if (matches.length === 0) errors.push(`${nameField}: no ${lookupTable} record named "${wanted}"`)
    else if (matches.length > 1) errors.push(`${nameField}: "${wanted}" is ambiguous (${matches.length} matches); pass ${idField}`)
    else record[idField] = matches[0].recordId
  }
  return errors
}

/** Fields an update request is responsible for (sent fields + ids resolved from names). */
function incomingFields(table: SyncTableName, input: Data): Set<string> {
  const fields = new Set(Object.keys(input))
  for (const [nameField, { idField }] of Object.entries(NAME_FIELDS[table] ?? {})) {
    if (fields.delete(nameField)) fields.add(idField)
  }
  return fields
}

// ------------------------------------------------------------------ Exchange rate

/**
 * personalTransactions in USD without exchangeRate: fill it from
 * monthlyExchangeRates for the transaction's month (UTC). Returns a warning
 * describing what happened, or null when nothing applied.
 */
async function fillExchangeRate(
  db: SyncDB,
  table: SyncTableName,
  record: Data,
  ctx: WriteContext,
  cache: LookupCache
): Promise<string | null> {
  if (table !== 'personalTransactions' || record.currency !== 'USD' || record.exchangeRate !== undefined) return null
  const date = typeof record.date === 'string' ? new Date(record.date) : null
  if (!date || isNaN(date.getTime())) return null
  const month = date.getUTCMonth() + 1
  const year = date.getUTCFullYear()
  const label = `${year}-${String(month).padStart(2, '0')}`

  const rates = (await loadLookup(db, ctx.scope, 'monthlyExchangeRates', cache))
    .filter(r => Number(r.data.month) === month && Number(r.data.year) === year)
    .filter(r => typeof r.data.rate === 'number' && Number.isFinite(r.data.rate) && r.data.rate > 0)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  if (rates.length === 0) {
    return `exchangeRate: no monthlyExchangeRates record for ${label}; left empty`
  }
  const chosen = rates[0]
  record.exchangeRate = chosen.data.rate
  const extra = rates.length > 1 ? ` (most recent of ${rates.length} for that month)` : ''
  return `exchangeRate: filled ${chosen.data.rate} from monthlyExchangeRates ${chosen.recordId} (${label})${extra}`
}

// ------------------------------------------------------------------ Bulk upsert

export interface BulkWrite {
  id: string
  data: Data
  /** Live version before this write, when the record existed. */
  previous?: Data
}

export interface BulkOptions extends WriteOptions {
  mode?: BulkMode
  /** Stamped on every record as importBatchId. */
  importBatchId?: string
}

export async function bulkUpsert(
  db: SyncDB,
  ctx: WriteContext,
  table: SyncTableName,
  items: unknown[],
  { mode = 'replace', dryRun = false, importBatchId }: BulkOptions = {}
): Promise<{ results: RecordResult[]; writes: BulkWrite[] }> {
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
    if (importBatchId !== undefined) data.importBatchId = importBatchId
    candidates.push({ index, id, data })
  })

  const existing = await fetchLatestVersions(db, ctx.scope, table, candidates.map(c => c.id))

  // Pass 2: normalize, validate, decide
  const writes: Array<{ index: number; id: string; status: 'created' | 'updated'; warnings: string[]; data: Data; updatedAt: string; previous?: Data }> = []
  for (const { index, id, data: input } of candidates) {
    const stored = existing.get(id)
    const live = stored && stored.operation !== 'delete' ? stored : undefined
    const isMerge = mode === 'merge' && !!live

    const record: Data = isMerge ? { ...live.data, ...input } : { ...input }
    record.id = id

    const nameErrors = await resolveNames(db, table, record, input, ctx, cache)

    // Server-stamped writes (no updatedAt supplied) are "now" and always land
    // after the stored version, even within the same millisecond
    let updatedAt = stored ? nextUpdatedAt(stored, now) : nowIso
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

    const { errors, warnings } = finalizeRecord(table, record, {
      isCreate: !isMerge,
      ctx,
      nowIso,
      incoming: isMerge ? incomingFields(table, input) : undefined
    })
    errors.unshift(...nameErrors)
    if (errors.length > 0) {
      results[index] = { index, id, status: 'error', error: errors.join('; ') }
      continue
    }
    const fx = await fillExchangeRate(db, table, record, ctx, cache)
    if (fx) warnings.push(fx)

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

    writes.push({ index, id, status: live ? 'updated' : 'created', warnings, data: record, updatedAt, previous: live?.data })
  }

  if (!dryRun) {
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
  }
  for (const w of writes) {
    results[w.index] = { index: w.index, id: w.id, status: w.status, ...(w.warnings.length ? { warnings: w.warnings } : {}) }
  }
  return { results, writes: writes.map(w => ({ id: w.id, data: w.data, previous: w.previous })) }
}

// ------------------------------------------------------------------ Patch / delete

/** Edit time for an explicit single-record write: now, but always after the stored version. */
export function nextUpdatedAt(stored: StoredRecord, now: number): string {
  const storedMs = new Date(stored.updatedAt).getTime()
  return new Date(Number.isFinite(storedMs) && storedMs >= now ? storedMs + 1 : now).toISOString()
}

export type PatchOutcome =
  | { ok: true; record: Data; previous: Data; warnings: string[] }
  | { ok: false; status: 404 | 422; error: string }

export async function patchRecord(
  db: SyncDB,
  ctx: WriteContext,
  table: SyncTableName,
  id: string,
  patch: Data,
  { dryRun = false }: WriteOptions = {}
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

  const cache: LookupCache = new Map()
  const nameErrors = await resolveNames(db, table, record, changes, ctx, cache)
  const { errors, warnings } = finalizeRecord(table, record, {
    isCreate: false,
    ctx,
    nowIso,
    incoming: incomingFields(table, changes)
  })
  errors.unshift(...nameErrors)
  if (errors.length > 0) return { ok: false, status: 422, error: errors.join('; ') }
  const fx = await fillExchangeRate(db, table, record, ctx, cache)
  if (fx) warnings.push(fx)

  if (!dryRun) {
    await executeSyncWrites(db, [
      prepareSyncWrite(db, ctx.scope, { table, recordId: id, operation: 'upsert', data: record, updatedAt, receivedAt: nowIso })
    ])
  }
  return { ok: true, record, previous: stored.data, warnings }
}

/** Tombstone statement exactly like a client deletion writes. */
export function prepareTombstone(
  db: SyncDB,
  ctx: WriteContext,
  table: string,
  stored: StoredRecord,
  now: number
) {
  // Same payload shape as the client's deletion log entries
  const data: Data = { id: stored.recordId, householdId: ctx.householdId ?? undefined }
  return prepareSyncWrite(db, ctx.scope, {
    table,
    recordId: stored.recordId,
    operation: 'delete',
    data,
    updatedAt: nextUpdatedAt(stored, now),
    receivedAt: new Date(now).toISOString()
  })
}

/** Write a delete tombstone exactly like a client deletion does. */
export async function deleteRecord(
  db: SyncDB,
  ctx: WriteContext,
  table: SyncTableName,
  id: string,
  { dryRun = false }: WriteOptions = {}
): Promise<boolean> {
  const stored = (await fetchLatestVersions(db, ctx.scope, table, [id])).get(id)
  if (!stored || stored.operation === 'delete') return false
  if (!dryRun) await executeSyncWrites(db, [prepareTombstone(db, ctx, table, stored, Date.now())])
  return true
}
