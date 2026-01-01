import { db, getDatabase, DeletionLog } from './db'
import { checkMigrationNeeded, performMigration } from './migration'
import { logger } from '@/lib/logger'

export interface SyncStatus {
  lastSyncAt: Date | null
  isSyncing: boolean
  error: string | null
  pendingChanges: number
  needsMigration?: boolean
}

export interface SyncRecord {
  table: string
  id: string
  data: unknown
  updatedAt: Date
  deletedAt?: Date | null
}

export interface SyncResult {
  success: boolean
  pushed: number
  pulled: number
  conflicts: number
  error?: string
}

const SYNC_TABLES = [
  // Core tables
  'users',
  'households',
  'householdMembers',
  'chores',
  'groceryItems',
  'groceryCategories',
  'savedGroceryItems',
  'tasks',
  'taskCategories',
  'homeImprovements',
  'meals',
  'mealCategories',
  'savedMeals',
  'reminders',
  'calendarEvents',
  'homeSettings',
  // Keto module
  'ketoSettings',
  'ketoDays',
  // Finance module
  'monthlyIncomes',
  'monthlyExchangeRates',
  'recurringExpenses',
  'expenseCategories',
  'expensePayments',
  'settlementPayments',
  // Document Vault module
  'documents',
  'documentFolders',
  'documentTags',
  // Maintenance Scheduler module
  'maintenanceItems',
  'maintenanceTasks',
  'maintenanceLogs',
  // Subscription Manager module
  'subscriptions',
  'subscriptionPayments',
  // Pet Management module
  'pets',
  'petFeedingSchedules',
  'petFeedingLogs',
  'petMedications',
  'petMedicationLogs',
  'petVetVisits',
  'petVaccinations',
  // Savings module
  'savingsCampaigns',
  'savingsMilestones',
  'savingsParticipants',
  'savingsContributions',
  // Meal Prep Planner module
  'mealPrepPlans',
  'mealPrepItems',
  'mealPrepIngredients',
  'mealPrepRecipes',
  'mealPrepSessions',
  'mealPrepSteps',
  'mealPrepContainers',
  'mealPrepSchedules',
  // Component-based meal prep (protein + carb + vegetable)
  'mealPrepComponents',
  'mealPrepCombinations'
] as const

type SyncTable = typeof SYNC_TABLES[number]

/**
 * Get the last sync timestamp from localStorage
 */
export function getLastSyncTime(): Date | null {
  if (typeof window === 'undefined') return null
  const timestamp = localStorage.getItem('lastSyncAt')
  return timestamp ? new Date(timestamp) : null
}

/**
 * Set the last sync timestamp in localStorage
 */
export function setLastSyncTime(date: Date): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('lastSyncAt', date.toISOString())
}

/**
 * Reset sync state to force a full sync on next sync operation
 */
export function resetSyncState(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('lastSyncAt')
}

/**
 * Get sync status from localStorage
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const migrationStatus = await checkMigrationNeeded()

  return {
    lastSyncAt: getLastSyncTime(),
    isSyncing: false,
    error: migrationStatus.needsMigration
      ? 'Database migration required. Please sync to migrate your data.'
      : null,
    pendingChanges: 0,
    needsMigration: migrationStatus.needsMigration
  }
}

/**
 * Collect local changes since last sync
 */
async function collectLocalChanges(since: Date | null): Promise<SyncRecord[]> {
  const changes: SyncRecord[] = []

  for (const tableName of SYNC_TABLES) {
    const table = db[tableName]
    if (!table) continue

    try {
      const allRecords = await table.toArray()

      // Filter records modified since last sync
      const records = since
        ? allRecords.filter(record => {
            const updatedAt = (record as {updatedAt?: Date; createdAt?: Date}).updatedAt
              || (record as {updatedAt?: Date; createdAt?: Date}).createdAt
            if (!updatedAt) return false
            return new Date(updatedAt) > since
          })
        : allRecords

      // Add to changes array
      for (const record of records) {
        const updatedAt = (record as {updatedAt?: Date; createdAt?: Date}).updatedAt
          || (record as {updatedAt?: Date; createdAt?: Date}).createdAt

        changes.push({
          table: tableName,
          id: (record as {id?: string}).id || '',
          data: record,
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
          deletedAt: null
        })
      }
    } catch (error) {
      logger.error(`Error collecting changes from ${tableName}:`, error)
    }
  }

  // Collect deletions from deletion log
  try {
    const deletions: DeletionLog[] = since
      ? await db.deletionLog.where('deletedAt').above(since).toArray()
      : await db.deletionLog.toArray()

    for (const deletion of deletions) {
      changes.push({
        table: deletion.tableName,
        id: deletion.recordId,
        data: { id: deletion.recordId, householdId: deletion.householdId },
        updatedAt: new Date(deletion.deletedAt),
        deletedAt: new Date(deletion.deletedAt)
      })
    }
  } catch (error) {
    logger.error('Error collecting deletions:', error)
  }

  return changes
}

/**
 * Clear deletion log after successful sync
 */
async function clearDeletionLog(before: Date): Promise<void> {
  try {
    await db.deletionLog.where('deletedAt').belowOrEqual(before).delete()
  } catch (error) {
    logger.error('Error clearing deletion log:', error)
  }
}

/**
 * Apply remote changes to local database
 */
async function applyRemoteChanges(changes: SyncRecord[]): Promise<number> {
  let applied = 0

  for (const change of changes) {
    const table = db[change.table as SyncTable]
    if (!table) continue

    try {
      if (change.deletedAt) {
        // Handle deletion
        await table.delete(change.id)
      } else {
        // Handle upsert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await table.put(change.data as any)
      }
      applied++
    } catch (error) {
      logger.error(`Error applying change to ${change.table}:`, error)
    }
  }

  return applied
}

/**
 * Push local changes to the server
 */
async function pushChanges(changes: SyncRecord[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ changes }),
      credentials: 'include' // Include cookies for auth
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, count: 0, error }
    }

    const result = await response.json()
    return { success: true, count: result.pushed || changes.length }
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Pull remote changes from the server
 */
async function pullChanges(since: Date | null): Promise<{ success: boolean; changes: SyncRecord[]; error?: string }> {
  try {
    const url = since
      ? `/api/sync/pull?since=${since.toISOString()}`
      : '/api/sync/pull'

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include' // Include cookies for auth
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, changes: [], error }
    }

    const result = await response.json()
    return { success: true, changes: result.changes || [] }
  } catch (error) {
    return {
      success: false,
      changes: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Perform a full bi-directional sync
 * @param forceFullSync - If true, ignores last sync time and syncs all data
 */
export async function performSync(forceFullSync: boolean = false): Promise<SyncResult> {
  const lastSync = forceFullSync ? null : getLastSyncTime()
  const result: SyncResult = {
    success: false,
    pushed: 0,
    pulled: 0,
    conflicts: 0
  }

  try {
    // 0. Check if migration is needed before syncing
    const migrationStatus = await checkMigrationNeeded()
    if (migrationStatus.needsMigration) {
      logger.debug('Migration needed before sync, performing migration...')
      const migrationResult = await performMigration()
      if (!migrationResult.success) {
        result.error = `Migration failed: ${migrationResult.error}. Please refresh the page.`
        return result
      }
      // Wait for database to reinitialize
      await getDatabase()
    }

    // 1. Collect local changes
    const localChanges = await collectLocalChanges(lastSync)

    // 2. Push local changes to server
    const syncStartTime = new Date()
    if (localChanges.length > 0) {
      const pushResult = await pushChanges(localChanges)
      if (!pushResult.success) {
        result.error = `Push failed: ${pushResult.error}`
        return result
      }
      result.pushed = pushResult.count

      // Clear deletion log for successfully pushed deletions
      await clearDeletionLog(syncStartTime)
    }

    // 3. Pull remote changes from server
    const pullResult = await pullChanges(lastSync)
    if (!pullResult.success) {
      result.error = `Pull failed: ${pullResult.error}`
      return result
    }

    // 4. Apply remote changes to local database
    if (pullResult.changes.length > 0) {
      result.pulled = await applyRemoteChanges(pullResult.changes)
    }

    // 5. Update last sync timestamp
    setLastSyncTime(new Date())
    result.success = true

    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown sync error'
    return result
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    })
    return response.ok
  } catch {
    return false
  }
}
