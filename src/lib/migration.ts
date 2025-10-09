import { generateId } from './utils'

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
    console.error('Error checking migration status:', error)
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
        console.log(`Legacy database ${oldName} deleted successfully`)
        resolve()
      }

      deleteRequest.onerror = () => {
        reject(new Error(`Failed to delete legacy database ${oldName}`))
      }

      deleteRequest.onblocked = () => {
        console.warn(`Delete blocked for ${oldName}. Waiting for connections to close...`)
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
      console.log('No migration needed')
      return { ...result, success: true }
    }

    console.log('Starting database migration from version', status.currentVersion)

    // Export data from legacy database
    const legacyData = await exportLegacyData(LEGACY_DB_NAME)
    console.log('Exported legacy data:', Object.keys(legacyData))

    // Transform data with new IDs
    const transformedData: Record<string, unknown[]> = {}
    for (const [tableName, records] of Object.entries(legacyData)) {
      transformedData[tableName] = transformLegacyRecords(tableName, records)
      result.tablesProcessed.push(tableName)
      result.recordsMigrated += records.length
    }

    console.log('Transformed data:', result)

    // Store transformed data temporarily in localStorage for import
    // (We'll import it after the new database is created)
    if (typeof window !== 'undefined') {
      localStorage.setItem('domus_migration_data', JSON.stringify(transformedData))
    }

    // Delete legacy database
    await deleteLegacyDatabase(LEGACY_DB_NAME)

    console.log('Migration prepared successfully')
    result.success = true

    return result
  } catch (error) {
    console.error('Migration failed:', error)
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
  }
}): Promise<void> {
  if (typeof window === 'undefined') return

  const migratedDataStr = localStorage.getItem('domus_migration_data')
  if (!migratedDataStr) {
    console.log('No migrated data to import')
    return
  }

  try {
    const migratedData = JSON.parse(migratedDataStr) as Record<string, unknown[]>
    console.log('Importing migrated data into new database...')

    for (const [tableName, records] of Object.entries(migratedData)) {
      const table = db[tableName]
      if (!table || records.length === 0) continue

      try {
        if (table.bulkAdd) {
          await table.bulkAdd(records)
        } else if (table.add) {
          for (const record of records) {
            await table.add(record)
          }
        }
        console.log(`Imported ${records.length} records into ${tableName}`)
      } catch (error) {
        console.error(`Error importing ${tableName}:`, error)
      }
    }

    // Clear migrated data and mark migration as complete
    localStorage.removeItem('domus_migration_data')
    setMigrationCompleted()

    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Error importing migrated data:', error)
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
