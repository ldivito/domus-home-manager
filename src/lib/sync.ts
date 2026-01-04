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

export interface SyncProgress {
  step: 'migration' | 'collecting' | 'pushing' | 'pulling' | 'applying' | 'complete'
  message: string
  current?: number    // Current item count
  total?: number      // Total items to process
  percent?: number    // 0-100 progress percentage
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
  'ketoWeightEntries',
  'ketoBodyMeasurements',
  'ketoWaterEntries',
  'ketoSymptomEntries',
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
  'savingsContributions'
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
 * Check if remote data is more complete than local data
 * Returns true if remote should replace local
 */
function isRemoteDataMoreComplete(
  local: Record<string, unknown> | null,
  remote: Record<string, unknown>,
  tableName: string
): boolean {
  // If no local data, remote is more complete
  if (!local) return true

  // For users table, check if remote has essential fields
  if (tableName === 'users') {
    const remoteHasName = 'name' in remote && remote.name
    const localHasName = 'name' in local && local.name

    // Don't overwrite complete local data with incomplete remote data
    if (localHasName && !remoteHasName) {
      return false
    }
  }

  // Default: remote is newer, use it
  return true
}

/**
 * Apply remote changes to local database with progress callback
 */
async function applyRemoteChangesWithProgress(
  changes: SyncRecord[],
  onProgress: (current: number, total: number) => void
): Promise<number> {
  let applied = 0
  const total = changes.length

  for (const change of changes) {
    const table = db[change.table as SyncTable]
    if (!table) continue

    try {
      if (change.deletedAt) {
        // Handle deletion
        await table.delete(change.id)
      } else {
        // Check if we should apply this change
        const existingRecord = await table.get(change.id)
        const remoteData = change.data as Record<string, unknown>

        if (isRemoteDataMoreComplete(existingRecord as Record<string, unknown> | null, remoteData, change.table)) {
          // Handle upsert - merge with existing data if available
          const mergedData = existingRecord
            ? { ...existingRecord, ...remoteData }
            : remoteData
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await table.put(mergedData as any)
        } else {
          logger.debug(`Skipping incomplete remote data for ${change.table}:${change.id}`)
        }
      }
      applied++

      // Report progress every 10 items or at the end
      if (applied % 10 === 0 || applied === total) {
        onProgress(applied, total)
      }
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
 * @param onProgress - Optional callback for progress updates
 */
export async function performSync(
  forceFullSync: boolean = false,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const lastSync = forceFullSync ? null : getLastSyncTime()
  const result: SyncResult = {
    success: false,
    pushed: 0,
    pulled: 0,
    conflicts: 0
  }

  const reportProgress = (progress: SyncProgress) => {
    if (onProgress) {
      onProgress(progress)
    }
  }

  try {
    // 0. Check if migration is needed before syncing
    reportProgress({
      step: 'migration',
      message: 'Checking database...',
      percent: 5
    })

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
    reportProgress({
      step: 'collecting',
      message: 'Collecting local changes...',
      percent: 15
    })

    const localChanges = await collectLocalChanges(lastSync)

    reportProgress({
      step: 'collecting',
      message: 'Collecting local changes...',
      current: localChanges.length,
      total: localChanges.length,
      percent: 30
    })

    // 2. Push local changes to server
    const syncStartTime = new Date()
    if (localChanges.length > 0) {
      reportProgress({
        step: 'pushing',
        message: 'Uploading changes...',
        current: 0,
        total: localChanges.length,
        percent: 35
      })

      const pushResult = await pushChanges(localChanges)
      if (!pushResult.success) {
        result.error = `Push failed: ${pushResult.error}`
        return result
      }
      result.pushed = pushResult.count

      reportProgress({
        step: 'pushing',
        message: 'Uploading changes...',
        current: localChanges.length,
        total: localChanges.length,
        percent: 50
      })

      // Clear deletion log for successfully pushed deletions
      await clearDeletionLog(syncStartTime)
    } else {
      reportProgress({
        step: 'pushing',
        message: 'No local changes to upload',
        current: 0,
        total: 0,
        percent: 50
      })
    }

    // 3. Pull remote changes from server
    reportProgress({
      step: 'pulling',
      message: 'Downloading updates...',
      percent: 55
    })

    const pullResult = await pullChanges(lastSync)
    if (!pullResult.success) {
      result.error = `Pull failed: ${pullResult.error}`
      return result
    }

    reportProgress({
      step: 'pulling',
      message: 'Downloading updates...',
      current: pullResult.changes.length,
      total: pullResult.changes.length,
      percent: 70
    })

    // 4. Apply remote changes to local database
    if (pullResult.changes.length > 0) {
      reportProgress({
        step: 'applying',
        message: 'Applying changes...',
        current: 0,
        total: pullResult.changes.length,
        percent: 75
      })

      result.pulled = await applyRemoteChangesWithProgress(
        pullResult.changes,
        (current, total) => {
          reportProgress({
            step: 'applying',
            message: 'Applying changes...',
            current,
            total,
            percent: 75 + Math.round((current / total) * 25)
          })
        }
      )
    } else {
      reportProgress({
        step: 'applying',
        message: 'No updates to apply',
        current: 0,
        total: 0,
        percent: 95
      })
    }

    // 5. Update last sync timestamp
    setLastSyncTime(new Date())
    result.success = true

    reportProgress({
      step: 'complete',
      message: 'Sync complete!',
      percent: 100
    })

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
