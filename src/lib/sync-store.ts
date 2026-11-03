/**
 * Server-side access to sync_metadata, shared by the sync push route and the
 * agent data API so both write with identical semantics:
 *
 * - one row per (scope, table, record): deterministic id
 *   `sync_${scopeId}_${table}_${recordId}`
 * - last-writer-wins on `updatedAt` (client edit time): an incoming row only
 *   replaces the stored one when it was edited later
 * - `createdAt` holds the server receive time and is the incremental pull
 *   watermark, so replaced rows are re-delivered to every device
 *
 * Reads mirror /api/sync/pull: the latest row per recordId (MAX(updatedAt))
 * wins, and a 'delete' tombstone hides the record.
 */
import type { getDB } from '@/lib/cloudflare'

export type SyncDB = ReturnType<typeof getDB>
type PreparedStatement = ReturnType<SyncDB['prepare']>

/** Data visibility scope: the household when present, otherwise the user. */
export interface SyncScope {
  userId: string
  householdId?: string | null
}

export function scopeId(scope: SyncScope): string {
  return scope.householdId || scope.userId
}

/** WHERE fragment + bind value selecting the rows visible to a scope (same as pull). */
function scopeCondition(scope: SyncScope, alias = ''): { sql: string; value: string } {
  const prefix = alias ? `${alias}.` : ''
  return scope.householdId
    ? { sql: `${prefix}householdId = ?`, value: scope.householdId }
    : { sql: `${prefix}userId = ?`, value: scope.userId }
}

export function syncRowId(scope: SyncScope, table: string, recordId: string): string {
  return `sync_${scopeId(scope)}_${table}_${recordId}`
}

export interface SyncWrite {
  table: string
  recordId: string
  operation: 'upsert' | 'delete'
  data: unknown
  /** Client edit time (ISO string) used for last-writer-wins. */
  updatedAt: string
  /** Server receive time (ISO string), the pull watermark. */
  receivedAt: string
}

/** Build the LWW upsert statement for one record (identical to push). */
export function prepareSyncWrite(db: SyncDB, scope: SyncScope, write: SyncWrite): PreparedStatement {
  return db
    .prepare(`
      INSERT INTO sync_metadata
      (id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        userId = excluded.userId,
        operation = excluded.operation,
        data = excluded.data,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt
      WHERE excluded.updatedAt > sync_metadata.updatedAt
    `)
    .bind(
      syncRowId(scope, write.table, write.recordId),
      scope.userId,
      scope.householdId || '',
      write.table,
      write.recordId,
      write.operation,
      JSON.stringify(write.data),
      write.receivedAt,
      write.updatedAt
    )
}

/** D1 limits bound parameters per query to 100; keep batches well below. */
const D1_BATCH_SIZE = 50

export async function executeSyncWrites(db: SyncDB, statements: PreparedStatement[]): Promise<number> {
  let written = 0
  for (let i = 0; i < statements.length; i += D1_BATCH_SIZE) {
    const results = await db.batch(statements.slice(i, i + D1_BATCH_SIZE))
    written += results.filter(r => r.success !== false).length
  }
  return written
}

export interface StoredRecord {
  recordId: string
  operation: string
  data: Record<string, unknown>
  /** Client edit time of the winning row. */
  updatedAt: string
  /** Server receive time of the winning row. */
  receivedAt: string
}

interface StoredRow {
  recordId: string
  operation: string
  data: string | null
  createdAt: string
  updatedAt: string
}

function parseRow(row: StoredRow): StoredRecord {
  let data: Record<string, unknown> = {}
  try {
    const parsed = row.data ? JSON.parse(row.data) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed
  } catch {
    // Corrupt payloads are surfaced as empty objects rather than failing the page
  }
  return {
    recordId: row.recordId,
    operation: row.operation,
    data: { ...data, id: row.recordId },
    updatedAt: row.updatedAt,
    receivedAt: row.createdAt
  }
}

/**
 * Latest stored version (including delete tombstones) of the given records.
 * Returns a map keyed by recordId; records never seen are absent.
 */
export async function fetchLatestVersions(
  db: SyncDB,
  scope: SyncScope,
  table: string,
  recordIds: string[]
): Promise<Map<string, StoredRecord>> {
  const result = new Map<string, StoredRecord>()
  const unique = Array.from(new Set(recordIds))
  const cond = scopeCondition(scope)
  // 2 fixed params + ids; stay under D1's 100 bound-parameter limit
  const CHUNK = 90

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const placeholders = chunk.map(() => '?').join(', ')
    const rows = await db
      .prepare(`
        SELECT recordId, operation, data, createdAt, updatedAt
        FROM sync_metadata
        WHERE ${cond.sql} AND tableName = ? AND deletedAt IS NULL AND recordId IN (${placeholders})
      `)
      .bind(cond.value, table, ...chunk)
      .all<StoredRow>()

    for (const row of rows.results || []) {
      const current = result.get(row.recordId)
      if (!current || row.updatedAt > current.updatedAt) {
        result.set(row.recordId, parseRow(row))
      }
    }
  }
  return result
}

/** Latest non-deleted version of one record, or null. */
export async function fetchRecord(
  db: SyncDB,
  scope: SyncScope,
  table: string,
  recordId: string
): Promise<StoredRecord | null> {
  const latest = (await fetchLatestVersions(db, scope, table, [recordId])).get(recordId)
  return latest && latest.operation !== 'delete' ? latest : null
}

export interface ListOptions {
  /** Only records received by the server after this ISO timestamp. */
  since?: string | null
  /** Resume after this (receivedAt, recordId) position. */
  cursor?: { receivedAt: string; recordId: string } | null
  limit: number
}

/**
 * Page through the latest non-deleted records of a table, ordered by server
 * receive time then recordId (stable for cursor pagination).
 */
export async function listRecords(
  db: SyncDB,
  scope: SyncScope,
  table: string,
  options: ListOptions
): Promise<{ records: StoredRecord[]; hasMore: boolean }> {
  const inner = scopeCondition(scope)
  const outer = scopeCondition(scope, 'sm')
  const params: (string | number)[] = [inner.value, table, outer.value, table]

  let where = `${outer.sql} AND sm.tableName = ? AND sm.deletedAt IS NULL AND sm.operation != 'delete'`
  if (options.since) {
    where += ' AND sm.createdAt > ?'
    params.push(options.since)
  }
  if (options.cursor) {
    where += ' AND (sm.createdAt > ? OR (sm.createdAt = ? AND sm.recordId > ?))'
    params.push(options.cursor.receivedAt, options.cursor.receivedAt, options.cursor.recordId)
  }
  params.push(options.limit + 1)

  const rows = await db
    .prepare(`
      SELECT sm.recordId, sm.operation, sm.data, sm.createdAt, sm.updatedAt
      FROM sync_metadata sm
      INNER JOIN (
        SELECT recordId, MAX(updatedAt) AS maxUpdated
        FROM sync_metadata
        WHERE ${inner.sql} AND tableName = ? AND deletedAt IS NULL
        GROUP BY recordId
      ) latest ON sm.recordId = latest.recordId AND sm.updatedAt = latest.maxUpdated
      WHERE ${where}
      ORDER BY sm.createdAt ASC, sm.recordId ASC
      LIMIT ?
    `)
    .bind(...params)
    .all<StoredRow>()

  const all = rows.results || []
  const hasMore = all.length > options.limit
  const page = hasMore ? all.slice(0, options.limit) : all

  // Legacy duplicate rows with identical updatedAt could repeat a record
  const seen = new Set<string>()
  const records: StoredRecord[] = []
  for (const row of page) {
    if (seen.has(row.recordId)) continue
    seen.add(row.recordId)
    records.push(parseRow(row))
  }
  return { records, hasMore }
}

/** All latest non-deleted records of a table (bounded), for name lookups. */
export async function listAllRecords(
  db: SyncDB,
  scope: SyncScope,
  table: string,
  max = 5000
): Promise<StoredRecord[]> {
  const out: StoredRecord[] = []
  let cursor: ListOptions['cursor'] = null
  while (out.length < max) {
    const { records, hasMore } = await listRecords(db, scope, table, { cursor, limit: 1000 })
    out.push(...records)
    if (!hasMore || records.length === 0) break
    const last = records[records.length - 1]
    cursor = { receivedAt: last.receivedAt, recordId: last.recordId }
  }
  return out
}
