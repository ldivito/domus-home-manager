import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import type { SyncRecord } from '@/lib/sync'
import { validateSyncPayload } from '../table-schemas'
import { logger } from '@/lib/logger'

// Batch size for D1 operations (stays within D1 limits)
const BATCH_SIZE = 50

// Maximum accepted record id length
const MAX_RECORD_ID_LENGTH = 200

// Whitelist of tables accepted through the sync channel.
// Keep in sync with SYNC_TABLES in src/lib/sync.ts.
const ALLOWED_SYNC_TABLES = new Set([
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
  // Personal Finance module
  'personalWallets',
  'personalCategories',
  'personalTransactions',
  'creditCardStatements',
  'creditCardPayments',
  'personalScheduledPayments',
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
  // Activity tracking
  'activityLogs'
])

export async function POST(request: Request) {
  try {
    // Get Cloudflare bindings (or use in-memory fallback)
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    // Check authentication
    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { changes, chunkIndex, totalChunks } = body as {
      changes: SyncRecord[]
      chunkIndex?: number
      totalChunks?: number
    }

    if (!Array.isArray(changes)) {
      return NextResponse.json(
        { error: 'Invalid request: changes must be an array' },
        { status: 400 }
      )
    }

    // Filter and validate changes
    const validChanges = changes.filter(change => {
      // Only accept whitelisted syncable tables (prevents injecting records
      // for arbitrary tables that other members would merge on pull)
      if (typeof change.table !== 'string' || !ALLOWED_SYNC_TABLES.has(change.table)) {
        logger.debug('Skipping change for non-syncable table:', change.table)
        return false
      }

      // Record id must be a non-empty, bounded string
      if (typeof change.id !== 'string' || change.id.length === 0 || change.id.length > MAX_RECORD_ID_LENGTH) {
        logger.debug('Skipping change with invalid record id')
        return false
      }

      // Payload must be a plain object; when it carries an id it must match
      // the change id (prevents spoofing another record's payload)
      const data = change.data as Record<string, unknown> | null | undefined
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        logger.debug('Skipping change with invalid data payload:', change.id)
        return false
      }
      if (data.id !== undefined && data.id !== change.id) {
        logger.debug('Skipping change with mismatched data id:', change.id)
        return false
      }

      // Validate user data before pushing - skip incomplete records
      if (change.table === 'users' && !change.deletedAt && !data.name) {
        logger.debug('Skipping incomplete user record:', change.id)
        return false
      }

      // Per-table field-type validation (blocks type-poisoned payloads that
      // would corrupt aggregates on every other device after pull)
      if (!change.deletedAt) {
        const payloadCheck = validateSyncPayload(change.table, data)
        if (payloadCheck.ok === false) {
          logger.debug(`Skipping invalid ${change.table} payload ${change.id}: ${payloadCheck.error}`)
          return false
        }
      }

      return true
    })

    if (validChanges.length === 0) {
      return NextResponse.json({
        success: true,
        pushed: 0,
        chunkIndex,
        totalChunks,
        timestamp: new Date().toISOString()
      })
    }

    // Prepare all statements for batch execution
    const now = new Date().toISOString()
    const scopeId = session.householdId || session.userId
    const statements = validChanges.map(change => {
      // Deterministic row id: one sync_metadata row per record, so repeated
      // pushes replace the previous row instead of growing the table forever
      const rowId = `sync_${scopeId}_${change.table}_${change.id}`
      const operation = change.deletedAt ? 'delete' : 'upsert'

      // Preserve the client's real edit timestamp (last-writer-wins);
      // fall back to the push time when missing or invalid
      const clientUpdatedAt = new Date(change.updatedAt as unknown as string)
      const updatedAt = isNaN(clientUpdatedAt.getTime()) ? now : clientUpdatedAt.toISOString()

      // Conflict resolution on the server:
      // - updatedAt holds the client edit time; an incoming row only replaces
      //   the stored one when it was edited later (stale re-uploads from
      //   lagging devices can't overwrite newer edits or resurrect deletions,
      //   because a delete tombstone keeps its newer updatedAt)
      // - createdAt holds the server receive time and acts as the pull
      //   watermark, so replaced rows are re-delivered to other devices
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
          rowId,
          session.userId,
          session.householdId || '',
          change.table,
          change.id,
          operation,
          JSON.stringify(change.data),
          now,
          updatedAt
        )
    })

    // Execute statements in batches using D1's batch API
    let pushed = 0
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE)
      const results = await db.batch(batch)

      // Count successful inserts
      pushed += results.filter(r => r.success !== false).length
    }

    logger.debug(`Push sync: ${pushed}/${validChanges.length} records (chunk ${chunkIndex ?? 0}/${totalChunks ?? 1})`)

    return NextResponse.json({
      success: true,
      pushed,
      chunkIndex,
      totalChunks,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Push sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
