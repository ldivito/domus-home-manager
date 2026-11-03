/**
 * Duplicate cleanup for synced data.
 *
 * Before default categories were seeded with deterministic ids, every fresh
 * install (new device, new browser, cleared storage) seeded its own copy of
 * every default category and pushed it on its first sync, so households
 * accumulated many identical categories. Concurrent "save this item for
 * later" actions on two devices did the same for saved grocery items and
 * saved meals.
 *
 * This module merges those duplicates locally and records tombstones for the
 * removed copies so the cleanup propagates to the server and to every other
 * device on the next sync.
 *
 * The canonical record of each group is chosen deterministically (stable id
 * first, then oldest, then smallest id), so every device that runs the
 * cleanup on the same data keeps the same record and never deletes the copy
 * another device kept.
 */
import type { Table } from 'dexie'
import type { DomusDatabase } from './db'
import { generateId } from './utils'
import { dbLogger } from './logger'

export interface DedupeResult {
  /** Removed duplicate records per table */
  removed: Record<string, number>
  /** Records whose references were repointed to the canonical record */
  remapped: number
}

type AnyRecord = {
  id?: string
  name?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  householdId?: string
  [key: string]: unknown
}

const norm = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLocaleLowerCase() : ''

const time = (value: unknown): number => {
  if (!value) return Number.POSITIVE_INFINITY
  const t = new Date(value as string | Date).getTime()
  return isNaN(t) ? Number.POSITIVE_INFINITY : t
}

const isStableDefaultId = (id: string | undefined): boolean =>
  typeof id === 'string' && id.includes('_default_')

/** Deterministic "keep the original" ordering: stable id, oldest, smallest id */
export function compareCanonical(a: AnyRecord, b: AnyRecord): number {
  const stableDiff = Number(isStableDefaultId(b.id)) - Number(isStableDefaultId(a.id))
  if (stableDiff !== 0) return stableDiff
  const timeDiff = time(a.createdAt) - time(b.createdAt)
  if (timeDiff !== 0) return timeDiff
  return (a.id ?? '').localeCompare(b.id ?? '')
}

/**
 * Group records by key and return, for every group with more than one record,
 * the canonical record and the ids of the duplicates to remove.
 */
export function findDuplicateGroups<T extends AnyRecord>(
  records: T[],
  keyOf: (record: T) => string | null,
  compare: (a: T, b: T) => number = compareCanonical
): Array<{ keep: T; remove: T[] }> {
  const groups = new Map<string, T[]>()
  for (const record of records) {
    if (!record.id) continue
    const key = keyOf(record)
    if (key === null) continue
    const group = groups.get(key)
    if (group) group.push(record)
    else groups.set(key, [record])
  }

  const result: Array<{ keep: T; remove: T[] }> = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort(compare)
    result.push({ keep: sorted[0], remove: sorted.slice(1) })
  }
  return result
}

async function logDeletions(
  database: DomusDatabase,
  tableName: string,
  records: AnyRecord[]
): Promise<void> {
  const now = new Date()
  await database.deletionLog.bulkAdd(records.map(record => ({
    id: generateId('del'),
    tableName,
    recordId: record.id!,
    householdId: record.householdId,
    deletedAt: now
  })))
}

const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt'])
const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)

/**
 * Fields the kept record lacks but a removed copy has (e.g. an address only
 * entered on one device). Copied over so merging never loses information.
 */
export function fillMissingFields<T extends AnyRecord>(keep: T, remove: T[]): Partial<T> {
  const patch: Record<string, unknown> = {}
  for (const dup of remove) {
    for (const [key, value] of Object.entries(dup)) {
      if (SYSTEM_KEYS.has(key) || isEmpty(value)) continue
      if (isEmpty(keep[key]) && !(key in patch)) patch[key] = value
    }
  }
  return patch as Partial<T>
}

export const DEDUPE_BACKUP_KEY = 'domus_dedupe_backup'
const DEDUPE_BACKUP_LIMIT = 5000

/**
 * Keep a local copy of every record the cleanup removes, so nothing is
 * unrecoverable even though the tombstone replaces it on the server.
 */
function backupRemovedRecords(tableName: string, records: AnyRecord[]): void {
  if (typeof window === 'undefined' || records.length === 0) return
  try {
    const existing = JSON.parse(localStorage.getItem(DEDUPE_BACKUP_KEY) || '[]') as unknown[]
    const removedAt = new Date().toISOString()
    const next = [...existing, ...records.map(record => ({ tableName, removedAt, record }))]
    localStorage.setItem(DEDUPE_BACKUP_KEY, JSON.stringify(next.slice(-DEDUPE_BACKUP_LIMIT)))
  } catch (error) {
    dbLogger.warn('Could not back up deduplicated records:', error)
  }
}

/**
 * Merge duplicates of one table. `remap` receives old-id -> canonical-id and
 * must repoint every reference; it returns the number of records it changed.
 */
async function dedupeTable<T extends AnyRecord>(
  database: DomusDatabase,
  tableName: string,
  keyOf: (record: T) => string | null,
  remap?: (idMap: Map<string, string>) => Promise<number>,
  merge?: (keep: T, remove: T[]) => Partial<T> | null,
  compare?: (a: T, b: T) => number
): Promise<{ removed: number; remapped: number }> {
  const table = (database as unknown as Record<string, Table<T, string>>)[tableName]
  const groups = findDuplicateGroups(await table.toArray(), keyOf, compare)
  if (groups.length === 0) return { removed: 0, remapped: 0 }

  const idMap = new Map<string, string>()
  const toRemove: T[] = []
  for (const { keep, remove } of groups) {
    for (const dup of remove) {
      idMap.set(dup.id!, keep.id!)
      toRemove.push(dup)
    }
    const patch = { ...fillMissingFields(keep, remove), ...(merge?.(keep, remove) ?? {}) }
    if (Object.keys(patch).length > 0) {
      await table.update(keep.id!, { ...patch, updatedAt: new Date() } as never)
    }
  }

  // Repoint references before deleting so nothing ever dangles
  const remapped = remap ? await remap(idMap) : 0

  backupRemovedRecords(tableName, toRemove)
  await table.bulkDelete(toRemove.map(r => r.id!))
  await logDeletions(database, tableName, toRemove)

  return { removed: toRemove.length, remapped }
}

/** Repoint `field` of every record in `tableName` that references a removed id */
async function remapField(
  database: DomusDatabase,
  tableName: string,
  field: string,
  idMap: Map<string, string>
): Promise<number> {
  const table = (database as unknown as Record<string, Table<AnyRecord, string>>)[tableName]
  const affected = (await table.toArray()).filter(r => idMap.has(r[field] as string))
  for (const record of affected) {
    await table.update(record.id!, { [field]: idMap.get(record[field] as string), updatedAt: new Date() })
  }
  return affected.length
}

/** Repoint ingredients[].savedGroceryItemId in meals and saved meals */
async function remapIngredients(
  database: DomusDatabase,
  idMap: Map<string, string>
): Promise<number> {
  let changed = 0
  for (const tableName of ['meals', 'savedMeals']) {
    const table = (database as unknown as Record<string, Table<AnyRecord, string>>)[tableName]
    for (const record of await table.toArray()) {
      const ingredients = record.ingredients as Array<{ savedGroceryItemId?: string }> | undefined
      if (!Array.isArray(ingredients) || !ingredients.some(i => i && idMap.has(i.savedGroceryItemId ?? ''))) continue
      await table.update(record.id!, {
        ingredients: ingredients.map(i =>
          i && idMap.has(i.savedGroceryItemId ?? '') ? { ...i, savedGroceryItemId: idMap.get(i.savedGroceryItemId!) } : i
        ),
        updatedAt: new Date()
      })
      changed++
    }
  }
  return changed
}

function ingredientSignature(record: AnyRecord): string {
  const ingredients = record.ingredients as Array<{ savedGroceryItemId?: string; amount?: string }> | undefined
  if (!Array.isArray(ingredients)) return ''
  return ingredients
    .map(i => `${i?.savedGroceryItemId ?? ''}:${norm(i?.amount)}`)
    .sort()
    .join(',')
}

/** Keep the highest usage counters when merging saved items / saved meals */
function mergeUsage<T extends AnyRecord>(keep: T, remove: T[]): Partial<T> | null {
  const all = [keep, ...remove]
  const timesUsed = Math.max(...all.map(r => Number(r.timesUsed) || 0))
  const lastUsedTimes = all.map(r => (r.lastUsed ? new Date(r.lastUsed as string).getTime() : NaN)).filter(t => !isNaN(t))
  const patch: Record<string, unknown> = {}
  if (timesUsed !== (Number(keep.timesUsed) || 0)) patch.timesUsed = timesUsed
  if (lastUsedTimes.length > 0) {
    const latest = Math.max(...lastUsedTimes)
    const keepTime = keep.lastUsed ? new Date(keep.lastUsed as string).getTime() : NaN
    if (latest !== keepTime) patch.lastUsed = new Date(latest)
  }
  return Object.keys(patch).length > 0 ? (patch as Partial<T>) : null
}

/**
 * Merge duplicated categories, saved items, saved meals and home settings.
 * Safe to run repeatedly: a database without duplicates is left untouched.
 */
export async function dedupeSyncedData(database: DomusDatabase): Promise<DedupeResult> {
  const result: DedupeResult = { removed: {}, remapped: 0 }

  const run = async (tableName: string, outcome: Promise<{ removed: number; remapped: number }>) => {
    const { removed, remapped } = await outcome
    if (removed > 0) result.removed[tableName] = removed
    result.remapped += remapped
  }

  const byName = (r: AnyRecord) => norm(r.name) || null

  // Grocery items, saved items and meals reference these by NAME: no remap
  await run('groceryCategories', dedupeTable(database, 'groceryCategories', byName))
  await run('mealCategories', dedupeTable(database, 'mealCategories', byName))

  // Referenced by ID
  await run('taskCategories', dedupeTable(database, 'taskCategories', byName,
    idMap => remapField(database, 'tasks', 'category', idMap)))
  await run('expenseCategories', dedupeTable(database, 'expenseCategories', byName,
    idMap => remapField(database, 'recurringExpenses', 'category', idMap)))
  await run('personalCategories', dedupeTable(database, 'personalCategories',
    r => (r.userId && norm(r.name) ? `${r.userId}|${r.type}|${norm(r.name)}` : null),
    idMap => remapField(database, 'personalTransactions', 'categoryId', idMap)))

  await run('savedGroceryItems', dedupeTable(database, 'savedGroceryItems',
    r => (norm(r.name) ? `${norm(r.name)}|${norm(r.category)}` : null),
    idMap => remapIngredients(database, idMap),
    mergeUsage))
  // Saved meals only merge when their ingredients are identical too: two
  // recipes sharing a name but not ingredients are different recipes
  await run('savedMeals', dedupeTable(database, 'savedMeals',
    r => (norm(r.name) ? `${norm(r.name)}|${norm(r.category)}|${ingredientSignature(r)}` : null),
    undefined,
    mergeUsage))

  // Singleton: keep the most recently edited home settings
  await run('homeSettings', dedupeTable(database, 'homeSettings',
    () => 'singleton',
    undefined,
    undefined,
    (a, b) => {
      // Newest edit first; records without a timestamp count as oldest
      const editTime = (r: AnyRecord) => {
        const t = time(r.lastUpdated ?? r.updatedAt ?? r.createdAt)
        return isFinite(t) ? t : 0
      }
      const diff = editTime(b) - editTime(a)
      return diff !== 0 ? diff : (a.id ?? '').localeCompare(b.id ?? '')
    }))

  const total = Object.values(result.removed).reduce((sum, n) => sum + n, 0)
  if (total > 0) {
    dbLogger.info(`Duplicate cleanup removed ${total} records`, result.removed)
  }
  return result
}
