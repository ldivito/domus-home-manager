import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import type { SyncRecord } from '@/lib/sync'
import { validateSyncPayload } from '../table-schemas'
import { logger } from '@/lib/logger'
import { ALLOWED_SYNC_TABLES, isValidRecordId } from '@/lib/sync-tables'
import { prepareSyncWrite, executeSyncWrites } from '@/lib/sync-store'

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
      if (!isValidRecordId(change.id)) {
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
    const scope = { userId: session.userId, householdId: session.householdId }
    const statements = validChanges.map(change => {
      // Preserve the client's real edit timestamp (last-writer-wins);
      // fall back to the push time when missing or invalid
      const clientUpdatedAt = new Date(change.updatedAt as unknown as string)
      const updatedAt = isNaN(clientUpdatedAt.getTime()) ? now : clientUpdatedAt.toISOString()

      // Deterministic row id + LWW upsert (see src/lib/sync-store.ts):
      // stale re-uploads from lagging devices can't overwrite newer edits or
      // resurrect deletions; createdAt (server receive time) is the pull
      // watermark, so replaced rows are re-delivered to other devices
      return prepareSyncWrite(db, scope, {
        table: change.table,
        recordId: change.id,
        operation: change.deletedAt ? 'delete' : 'upsert',
        data: change.data,
        updatedAt,
        receivedAt: now
      })
    })

    // Execute statements in batches using D1's batch API
    const pushed = await executeSyncWrites(db, statements)

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
