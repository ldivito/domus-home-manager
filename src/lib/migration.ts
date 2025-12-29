import { generateId } from './utils'
import { logger } from '@/lib/logger'

export interface MigrationStatus {
  needsMigration: boolean
  currentVersion?: number
  legacyDatabaseName?: string
  error?: string
}

export interface MigrationResult {
  success: boolean
  recordsMigrated: number
  tablesProcessed: string[]
  error?: string
}

const MIGRATION_FLAG_KEY = 'domus_migration_v14_completed'
const LEGACY_DB_NAME = 'DomusDatabase'

/**
 * Check if migration has already been completed
 */
export function isMigrationCompleted(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true'
}

/**
 * Mark migration as completed
 */
export function setMigrationCompleted(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
}

/**
 * Check if legacy database exists and needs migration
 */
export async function checkMigrationNeeded(): Promise<MigrationStatus> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return { needsMigration: false }
  }

  // If migration already completed, no need to check
  if (isMigrationCompleted()) {
    return { needsMigration: false }
  }

  try {
    // Check if legacy database exists
    const databases = await window.indexedDB.databases()
    const legacyDb = databases.find(db => db.name === LEGACY_DB_NAME)

    if (!legacyDb || !legacyDb.version) {
      return { needsMigration: false }
    }

    // If version is 10 or lower, needs migration
    // Version 10 used ++id (auto-increment), versions 11+ use id (string)
    if (legacyDb.version <= 10) {
      return {
        needsMigration: true,
        currentVersion: legacyDb.version,
        legacyDatabaseName: LEGACY_DB_NAME
      }
    }

    return { needsMigration: false }
  } catch (error) {
    logger.error('Error checking migration status:', error)
    return {
      needsMigration: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Export all data from legacy database
 */
async function exportLegacyData(dbName: string): Promise<Record<string, unknown[]>> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName)

    request.onerror = () => reject(new Error('Failed to open legacy database'))

    request.onsuccess = async (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const data: Record<string, unknown[]> = {}

      try {
        const storeNames = Array.from(db.objectStoreNames)

        for (const storeName of storeNames) {
          const transaction = db.transaction(storeName, 'readonly')
          const store = transaction.objectStore(storeName)
          const getAllRequest = store.getAll()

          const records = await new Promise<unknown[]>((resolveStore, rejectStore) => {
            getAllRequest.onsuccess = () => resolveStore(getAllRequest.result)
            getAllRequest.onerror = () => rejectStore(new Error(`Failed to export ${storeName}`))
          })

          data[storeName] = records
        }

        db.close()
        resolve(data)
      } catch (error) {
        db.close()
        reject(error)
      }
    }
  })
}

/**
 * Transform legacy records with new UUID primary keys
 */
function transformLegacyRecords(
  tableName: string,
  records: unknown[]
): unknown[] {
  // Tables that need ID transformation
  const tablesNeedingIdTransform = [
    'homeSettings',
    'users',
    'chores',
    'groceryItems',
    'groceryCategories',
    'savedGroceryItems',
    'tasks',
    'homeImprovements',
    'meals',
    'mealCategories',
    'savedMeals',
    'reminders',
    'calendarEvents'
  ]

  if (!tablesNeedingIdTransform.includes(tableName)) {
    return records
  }

  // Generate prefix for IDs based on table name
  const prefixes: Record<string, string> = {
    homeSettings: 'home',
    users: 'usr',
    chores: 'chr',
    groceryItems: 'gri',
    groceryCategories: 'gcat',
    savedGroceryItems: 'sgi',
    tasks: 'tsk',
    homeImprovements: 'hip',
    meals: 'meal',
    mealCategories: 'mcat',
    savedMeals: 'smeal',
    reminders: 'rem',
    calendarEvents: 'cal'
  }

  const prefix = prefixes[tableName] || 'rec'
  const idMap = new Map<string | number, string>()

  return records.map(record => {
    const typedRecord = record as { id?: string | number; [key: string]: unknown }
    const oldId = typedRecord.id

    // Generate new UUID-based ID
    let newId: string
    if (oldId && idMap.has(oldId)) {
      newId = idMap.get(oldId)!
    } else {
      newId = generateId(prefix)
      if (oldId) {
        idMap.set(oldId, newId)
      }
    }

    // Replace id and any foreign key references if needed
    return {
      ...typedRecord,
      id: newId
    }
  })
}

/**
 * Delete legacy database
 */
async function deleteLegacyDatabase(oldName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // First export the data
    const openRequest = indexedDB.open(oldName)

    openRequest.onsuccess = async (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Close the database before deleting
      db.close()

      // Delete the old database
      const deleteRequest = indexedDB.deleteDatabase(oldName)

      deleteRequest.onsuccess = () => {
        logger.debug(`Legacy database ${oldName} deleted successfully`)
        resolve()
      }

      deleteRequest.onerror = () => {
        reject(new Error(`Failed to delete legacy database ${oldName}`))
      }

      deleteRequest.onblocked = () => {
        logger.warn(`Delete blocked for ${oldName}. Waiting for connections to close...`)
      }
    }

    openRequest.onerror = () => {
      reject(new Error(`Failed to open ${oldName} for deletion`))
    }
  })
}

/**
 * Perform the complete migration
 */
export async function performMigration(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    recordsMigrated: 0,
    tablesProcessed: []
  }

  try {
    // Check if migration is needed
    const status = await checkMigrationNeeded()
    if (!status.needsMigration) {
      logger.debug('No migration needed')
      return { ...result, success: true }
    }

    logger.debug('Starting database migration from version', status.currentVersion)

    // Export data from legacy database
    const legacyData = await exportLegacyData(LEGACY_DB_NAME)
    logger.debug('Exported legacy data:', Object.keys(legacyData))

    // Transform data with new IDs
    const transformedData: Record<string, unknown[]> = {}
    for (const [tableName, records] of Object.entries(legacyData)) {
      transformedData[tableName] = transformLegacyRecords(tableName, records)
      result.tablesProcessed.push(tableName)
      result.recordsMigrated += records.length
    }

    logger.debug('Transformed data:', result)

    // Store transformed data temporarily in localStorage for import
    // (We'll import it after the new database is created)
    if (typeof window !== 'undefined') {
      localStorage.setItem('domus_migration_data', JSON.stringify(transformedData))
    }

    // Delete legacy database
    await deleteLegacyDatabase(LEGACY_DB_NAME)

    logger.debug('Migration prepared successfully')
    result.success = true

    return result
  } catch (error) {
    logger.error('Migration failed:', error)
    result.error = error instanceof Error ? error.message : 'Unknown migration error'
    return result
  }
}

/**
 * Import migrated data into new database
 */
export async function importMigratedData(db: {
  [key: string]: {
    bulkAdd?: (records: unknown[]) => Promise<unknown>
    add?: (record: unknown) => Promise<unknown>
    count?: () => Promise<number>
  }
}): Promise<void> {
  if (typeof window === 'undefined') return

  const migratedDataStr = localStorage.getItem('domus_migration_data')
  if (!migratedDataStr) {
    logger.debug('No migrated data to import')
    return
  }

  try {
    const migratedData = JSON.parse(migratedDataStr) as Record<string, unknown[]>

    // Validate that this is actually migration data
    if (!migratedData || typeof migratedData !== 'object' || Object.keys(migratedData).length === 0) {
      logger.debug('Invalid or empty migration data, clearing...')
      localStorage.removeItem('domus_migration_data')
      setMigrationCompleted()
      return
    }

    logger.debug('Importing migrated data into new database...')

    let successCount = 0
    let errorCount = 0

    for (const [tableName, records] of Object.entries(migratedData)) {
      const table = db[tableName]
      if (!table || !Array.isArray(records) || records.length === 0) continue

      try {
        // Check if table already has data (avoid duplicate imports)
        if (table.count) {
          const existingCount = await table.count()
          if (existingCount > 0) {
            logger.debug(`Table ${tableName} already has ${existingCount} records, skipping import`)
            continue
          }
        }

        if (table.bulkAdd) {
          await table.bulkAdd(records)
        } else if (table.add) {
          for (const record of records) {
            await table.add(record)
          }
        }
        logger.debug(`Imported ${records.length} records into ${tableName}`)
        successCount++
      } catch (error) {
        logger.error(`Error importing ${tableName}:`, error)
        errorCount++
        // Continue with other tables even if one fails
      }
    }

    // Clear migrated data and mark migration as complete regardless of errors
    // This prevents infinite retry loops
    localStorage.removeItem('domus_migration_data')
    setMigrationCompleted()

    logger.debug(`Migration completed: ${successCount} tables imported, ${errorCount} errors`)
  } catch (error) {
    logger.error('Error importing migrated data:', error)
    // Clear corrupted migration data to prevent infinite loops
    localStorage.removeItem('domus_migration_data')
    setMigrationCompleted()
    throw error
  }
}

/**
 * Reset migration flag (for testing purposes)
 */
export function resetMigrationFlag(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(MIGRATION_FLAG_KEY)
  localStorage.removeItem('domus_migration_data')
}

/**
 * Clear all migration-related localStorage items
 * Call this from browser console if app is stuck: clearMigrationState()
 */
export function clearMigrationState(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(MIGRATION_FLAG_KEY)
  localStorage.removeItem('domus_migration_data')
  localStorage.removeItem('lastSyncAt')
  logger.debug('Migration state cleared. Please refresh the page.')
}

// Make clearMigrationState available in browser console for debugging
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).clearMigrationState = clearMigrationState
}
