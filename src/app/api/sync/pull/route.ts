import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import type { SyncRecord } from '@/lib/sync'
import { logger } from '@/lib/logger'

// Pagination constants
const DEFAULT_PAGE_SIZE = 500
const MAX_PAGE_SIZE = 1000

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
    const cursorParam = searchParams.get('cursor') // Format: "timestamp_recordId"
    const limitParam = searchParams.get('limit')

    // Parse limit with bounds
    const limit = Math.min(
      Math.max(1, parseInt(limitParam || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    )

    // Parse cursor if provided (format: "2024-01-15T10:30:00.000Z_recordId")
    let cursorTimestamp: string | null = null
    let cursorRecordId: string | null = null
    if (cursorParam) {
      const separatorIndex = cursorParam.indexOf('_')
      if (separatorIndex > 0) {
        cursorTimestamp = cursorParam.substring(0, separatorIndex)
        cursorRecordId = cursorParam.substring(separatorIndex + 1)
      }
    }

    // Build query based on whether user has a household
    // If user has a household, pull all household data (shared between members)
    // If user has no household, pull only their own data
    // IMPORTANT: Only return the LATEST entry per recordId to ensure deletions work correctly
    const params: (string | number)[] = []

    const baseId = session.householdId || session.userId
    const baseCondition = session.householdId ? 'householdId = ?' : 'userId = ?'

    // Build WHERE conditions
    let whereConditions = `${baseCondition} AND sm.deletedAt IS NULL`
    params.push(baseId) // For subquery
    params.push(baseId) // For main WHERE

    if (sinceParam) {
      whereConditions += ' AND sm.updatedAt > ?'
      params.push(sinceParam)
    }

    if (cursorTimestamp && cursorRecordId) {
      // Cursor-based pagination: get records after the cursor
      // Use composite ordering: (updatedAt, recordId) for deterministic pagination
      whereConditions += ' AND (sm.updatedAt > ? OR (sm.updatedAt = ? AND sm.recordId > ?))'
      params.push(cursorTimestamp, cursorTimestamp, cursorRecordId)
    }

    // Fetch one extra record to determine if there are more pages
    params.push(limit + 1)

    const query = `
      SELECT sm.tableName, sm.recordId, sm.operation, sm.data, sm.updatedAt
      FROM sync_metadata sm
      INNER JOIN (
        SELECT recordId, MAX(updatedAt) as maxUpdated
        FROM sync_metadata
        WHERE ${baseCondition} AND deletedAt IS NULL
        GROUP BY recordId
      ) latest ON sm.recordId = latest.recordId AND sm.updatedAt = latest.maxUpdated
      WHERE sm.${whereConditions}
      ORDER BY sm.updatedAt ASC, sm.recordId ASC
      LIMIT ?
    `

    // Fetch changes from D1
    const result = await db.prepare(query).bind(...params).all<{
      tableName: string
      recordId: string
      operation: string
      data: string
      updatedAt: string
    }>()

    const rows = result.results || []
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows

    // Build next cursor from last row
    const lastRow = pageRows[pageRows.length - 1]
    const nextCursor = hasMore && lastRow
      ? `${lastRow.updatedAt}_${lastRow.recordId}`
      : null

    // Transform results into SyncRecord format
    // IMPORTANT: Set deletedAt when operation is 'delete' so sync.ts can handle deletions
    const changes: SyncRecord[] = pageRows.map(row => ({
      id: row.recordId,
      table: row.tableName,
      data: JSON.parse(row.data),
      updatedAt: new Date(row.updatedAt),
      deletedAt: row.operation === 'delete' ? new Date(row.updatedAt) : null
    }))

    logger.debug(`Pull sync: ${changes.length} records, hasMore: ${hasMore}, cursor: ${nextCursor}`)

    return NextResponse.json({
      success: true,
      changes,
      count: changes.length,
      hasMore,
      nextCursor,
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
