import { db, getDatabase, DeletionLog } from './db'
import { checkMigrationNeeded, performMigration } from './migration'
import { logger } from '@/lib/logger'

// Sync configuration constants
const PUSH_CHUNK_SIZE = 100       // Records per push request
const PULL_PAGE_SIZE = 500        // Records per pull request
const REQUEST_TIMEOUT_MS = 60000  // 60 second timeout
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000
const RETRY_MAX_DELAY_MS = 30000
const CHECKPOINT_KEY = 'domus_sync_checkpoint'

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
  step: 'migration' | 'collecting' | 'pushing' | 'pulling' | 'applying' | 'complete' | 'error'
  message: string
  current?: number    // Current item count
  total?: number      // Total items to process
  percent?: number    // 0-100 progress percentage
  pushProgress?: {
    chunksCompleted: number
    totalChunks: number
    recordsPushed: number
  }
  pullProgress?: {
    pagesFetched: number
    recordsPulled: number
  }
}

interface ChunkedPushResult {
  success: boolean
  totalPushed: number
  failedChunks: number[]
  error?: string
}

interface PullResponse {
  success: boolean
  changes: SyncRecord[]
  hasMore: boolean
  nextCursor: string | null
  error?: string
}

interface SyncCheckpoint {
  syncId: string
  startedAt: string
  phase: 'push' | 'pull'
  push?: {
    totalChunks: number
    completedChunks: number[]
    failedChunks: number[]
  }
  pull?: {
    cursor: string | null
    pagesFetched: number
    totalApplied: number
  }
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
  clearSyncCheckpoint()
}

// ============ Helper Functions ============

/**
 * Split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1) // +/- 20%
  return Math.min(baseDelay + jitter, RETRY_MAX_DELAY_MS)
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Don't retry on client errors (except rate limiting)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response
      }

      // Retry on server errors and rate limiting
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt)
          logger.warn(`Request failed with ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
          await sleep(delay)
          continue
        }
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error as Error

      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn(`Request timeout (attempt ${attempt + 1}/${maxRetries + 1})`)
      } else {
        logger.warn(`Request error: ${(error as Error).message} (attempt ${attempt + 1}/${maxRetries + 1})`)
      }

      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt)
        await sleep(delay)
      }
    }
  }

  throw lastError || new Error('Request failed after retries')
}

// ============ Checkpoint Persistence ============

/**
 * Load sync checkpoint from localStorage
 */
function loadSyncCheckpoint(): SyncCheckpoint | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(CHECKPOINT_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

/**
 * Save sync checkpoint to localStorage
 */
function saveSyncCheckpoint(checkpoint: Partial<SyncCheckpoint>): void {
  if (typeof window === 'undefined') return
  try {
    const existing = loadSyncCheckpoint() || {
      syncId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      phase: 'push' as const
    }
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
      ...existing,
      ...checkpoint
    }))
  } catch (error) {
    logger.error('Failed to save sync checkpoint:', error)
  }
}

/**
 * Clear sync checkpoint from localStorage
 */
function clearSyncCheckpoint(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CHECKPOINT_KEY)
  } catch {
    // Ignore errors
  }
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

        if (isRemoteDataMoreComplete(existingRecord as unknown as Record<string, unknown> | null, remoteData, change.table)) {
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
 * Push a single chunk of changes to the server
 */
async function pushChunk(
  chunk: SyncRecord[],
  chunkIndex: number,
  totalChunks: number
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetchWithRetry('/api/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changes: chunk,
        chunkIndex,
        totalChunks
      }),
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, count: 0, error }
    }

    const result = await response.json()
    return { success: true, count: result.pushed || chunk.length }
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Push local changes to the server with chunking
 */
async function pushChangesChunked(
  changes: SyncRecord[],
  onProgress?: (chunksCompleted: number, totalChunks: number, recordsPushed: number) => void
): Promise<ChunkedPushResult> {
  if (changes.length === 0) {
    return { success: true, totalPushed: 0, failedChunks: [] }
  }

  const chunks = chunkArray(changes, PUSH_CHUNK_SIZE)
  const failedChunks: number[] = []
  let totalPushed = 0

  // Load checkpoint to resume from last successful chunk
  const checkpoint = loadSyncCheckpoint()
  const completedChunks = checkpoint?.push?.completedChunks || []
  const startChunk = completedChunks.length

  logger.debug(`Pushing ${changes.length} changes in ${chunks.length} chunks (starting from chunk ${startChunk})`)

  for (let i = startChunk; i < chunks.length; i++) {
    const chunk = chunks[i]

    const result = await pushChunk(chunk, i, chunks.length)

    if (!result.success) {
      failedChunks.push(i)
      logger.error(`Push chunk ${i + 1}/${chunks.length} failed: ${result.error}`)
    } else {
      totalPushed += result.count
      completedChunks.push(i)

      // Save checkpoint after each successful chunk
      saveSyncCheckpoint({
        phase: 'push',
        push: {
          totalChunks: chunks.length,
          completedChunks: [...completedChunks],
          failedChunks
        }
      })
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, chunks.length, totalPushed)
    }
  }

  // Retry failed chunks once
  if (failedChunks.length > 0) {
    logger.debug(`Retrying ${failedChunks.length} failed chunks`)
    const stillFailed: number[] = []

    for (const chunkIndex of failedChunks) {
      const chunk = chunks[chunkIndex]
      const result = await pushChunk(chunk, chunkIndex, chunks.length)

      if (result.success) {
        totalPushed += result.count
      } else {
        stillFailed.push(chunkIndex)
      }
    }

    if (stillFailed.length > 0) {
      return {
        success: false,
        totalPushed,
        failedChunks: stillFailed,
        error: `${stillFailed.length} chunks failed after retry`
      }
    }
  }

  return { success: true, totalPushed, failedChunks: [] }
}

/**
 * Pull remote changes from the server with pagination
 */
async function pullChangesPaginated(
  since: Date | null,
  onProgress?: (pagesFetched: number, totalRecords: number) => void
): Promise<{ success: boolean; changes: SyncRecord[]; error?: string }> {
  const allChanges: SyncRecord[] = []
  let cursor: string | null = null
  let pagesFetched = 0

  // Load checkpoint to resume from last cursor
  const checkpoint = loadSyncCheckpoint()
  if (checkpoint?.phase === 'pull' && checkpoint.pull?.cursor) {
    cursor = checkpoint.pull.cursor
    pagesFetched = checkpoint.pull.pagesFetched || 0
    logger.debug(`Resuming pull from cursor: ${cursor}`)
  }

  try {
    do {
      const url = new URL('/api/sync/pull', window.location.origin)
      if (since) url.searchParams.set('since', since.toISOString())
      if (cursor) url.searchParams.set('cursor', cursor)
      url.searchParams.set('limit', String(PULL_PAGE_SIZE))

      const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, changes: allChanges, error }
      }

      const result: PullResponse = await response.json()

      // Convert date strings back to Date objects
      const changes = (result.changes || []).map(change => ({
        ...change,
        updatedAt: new Date(change.updatedAt),
        deletedAt: change.deletedAt ? new Date(change.deletedAt) : null
      }))

      allChanges.push(...changes)
      cursor = result.nextCursor
      pagesFetched++

      logger.debug(`Pulled page ${pagesFetched}: ${changes.length} records (hasMore: ${result.hasMore})`)

      // Report progress
      if (onProgress) {
        onProgress(pagesFetched, allChanges.length)
      }

      // Save checkpoint after each page
      saveSyncCheckpoint({
        phase: 'pull',
        pull: {
          cursor,
          pagesFetched,
          totalApplied: 0
        }
      })

    } while (cursor)

    return { success: true, changes: allChanges }
  } catch (error) {
    return {
      success: false,
      changes: allChanges,
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

    // 2. Push local changes to server with chunking
    const syncStartTime = new Date()
    if (localChanges.length > 0) {
      const totalChunks = Math.ceil(localChanges.length / PUSH_CHUNK_SIZE)
      reportProgress({
        step: 'pushing',
        message: `Uploading changes (0/${totalChunks} chunks)...`,
        current: 0,
        total: localChanges.length,
        percent: 35,
        pushProgress: {
          chunksCompleted: 0,
          totalChunks,
          recordsPushed: 0
        }
      })

      const pushResult = await pushChangesChunked(
        localChanges,
        (chunksCompleted, totalChunks, recordsPushed) => {
          const percent = 35 + Math.round((chunksCompleted / totalChunks) * 15)
          reportProgress({
            step: 'pushing',
            message: `Uploading changes (${chunksCompleted}/${totalChunks} chunks)...`,
            current: recordsPushed,
            total: localChanges.length,
            percent,
            pushProgress: {
              chunksCompleted,
              totalChunks,
              recordsPushed
            }
          })
        }
      )

      if (!pushResult.success) {
        result.error = `Push failed: ${pushResult.error}`
        reportProgress({
          step: 'error',
          message: pushResult.error || 'Push failed',
          percent: 50
        })
        return result
      }
      result.pushed = pushResult.totalPushed

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

    // 3. Pull remote changes from server with pagination
    reportProgress({
      step: 'pulling',
      message: 'Downloading updates...',
      percent: 55
    })

    const pullResult = await pullChangesPaginated(
      lastSync,
      (pagesFetched, totalRecords) => {
        reportProgress({
          step: 'pulling',
          message: `Downloaded ${totalRecords} records (page ${pagesFetched})...`,
          percent: 55 + Math.min(pagesFetched * 3, 15),
          pullProgress: {
            pagesFetched,
            recordsPulled: totalRecords
          }
        })
      }
    )

    if (!pullResult.success) {
      result.error = `Pull failed: ${pullResult.error}`
      return result
    }

    reportProgress({
      step: 'pulling',
      message: `Downloaded ${pullResult.changes.length} updates`,
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

    // 5. Update last sync timestamp and clear checkpoint
    setLastSyncTime(new Date())
    clearSyncCheckpoint()
    result.success = true

    reportProgress({
      step: 'complete',
      message: 'Sync complete!',
      percent: 100
    })

    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown sync error'
    reportProgress({
      step: 'error',
      message: result.error,
      percent: 0
    })
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
