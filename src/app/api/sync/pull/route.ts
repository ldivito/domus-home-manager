import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import type { SyncRecord } from '@/lib/sync'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')

    // Build query based on whether user has a household
    // If user has a household, pull all household data (shared between members)
    // If user has no household, pull only their own data
    // IMPORTANT: Only return the LATEST entry per recordId to ensure deletions work correctly
    let query: string
    let params: string[]

    if (session.householdId) {
      // User has a household - pull all data from household members
      // Only get the latest entry per recordId using a subquery
      const sinceFilter = sinceParam ? 'AND sm.updatedAt > ?' : ''
      query = `
        SELECT sm.tableName, sm.recordId, sm.operation, sm.data, sm.updatedAt
        FROM sync_metadata sm
        INNER JOIN (
          SELECT recordId, MAX(updatedAt) as maxUpdated
          FROM sync_metadata
          WHERE householdId = ? AND deletedAt IS NULL
          GROUP BY recordId
        ) latest ON sm.recordId = latest.recordId AND sm.updatedAt = latest.maxUpdated
        WHERE sm.householdId = ? AND sm.deletedAt IS NULL ${sinceFilter}
        ORDER BY sm.updatedAt ASC
      `
      params = sinceParam
        ? [session.householdId, session.householdId, sinceParam]
        : [session.householdId, session.householdId]
    } else {
      // User has no household - pull only their own data
      const sinceFilter = sinceParam ? 'AND sm.updatedAt > ?' : ''
      query = `
        SELECT sm.tableName, sm.recordId, sm.operation, sm.data, sm.updatedAt
        FROM sync_metadata sm
        INNER JOIN (
          SELECT recordId, MAX(updatedAt) as maxUpdated
          FROM sync_metadata
          WHERE userId = ? AND deletedAt IS NULL
          GROUP BY recordId
        ) latest ON sm.recordId = latest.recordId AND sm.updatedAt = latest.maxUpdated
        WHERE sm.userId = ? AND sm.deletedAt IS NULL ${sinceFilter}
        ORDER BY sm.updatedAt ASC
      `
      params = sinceParam
        ? [session.userId, session.userId, sinceParam]
        : [session.userId, session.userId]
    }

    // Fetch changes from D1
    const result = await db.prepare(query).bind(...params).all<{
      tableName: string
      recordId: string
      operation: string
      data: string
      updatedAt: string
    }>()

    // Transform results into SyncRecord format
    // IMPORTANT: Set deletedAt when operation is 'delete' so sync.ts can handle deletions
    const changes: SyncRecord[] = (result.results || []).map(row => ({
      id: row.recordId,
      table: row.tableName,
      data: JSON.parse(row.data),
      updatedAt: new Date(row.updatedAt),
      deletedAt: row.operation === 'delete' ? new Date(row.updatedAt) : null
    }))

    return NextResponse.json({
      success: true,
      changes,
      count: changes.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Pull sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
