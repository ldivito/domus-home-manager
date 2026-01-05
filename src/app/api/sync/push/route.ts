import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import type { SyncRecord } from '@/lib/sync'
import { logger } from '@/lib/logger'

// Batch size for D1 operations (stays within D1 limits)
const BATCH_SIZE = 50

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
      // Validate user data before pushing - skip incomplete records
      if (change.table === 'users' && !change.deletedAt) {
        const userData = change.data as Record<string, unknown>
        if (!userData.name) {
          logger.debug('Skipping incomplete user record:', change.id)
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
    const statements = validChanges.map(change => {
      const recordId = `sync_${crypto.randomUUID()}`
      const operation = change.deletedAt ? 'delete' : 'upsert'

      return db
        .prepare(`
          INSERT OR REPLACE INTO sync_metadata
          (id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          recordId,
          session.userId,
          session.householdId || '',
          change.table,
          change.id,
          operation,
          JSON.stringify(change.data),
          now,
          now
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
