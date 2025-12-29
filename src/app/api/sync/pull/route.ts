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

    // Build query based on whether we have a timestamp filter
    let query = `
      SELECT tableName, recordId, operation, data, updatedAt
      FROM sync_metadata
      WHERE userId = ? AND deletedAt IS NULL
    `
    const params = [session.userId]

    if (sinceParam) {
      query += ' AND updatedAt > ?'
      params.push(sinceParam)
    }

    query += ' ORDER BY updatedAt ASC'

    // Fetch changes from D1
    const result = await db.prepare(query).bind(...params).all<{
      tableName: string
      recordId: string
      operation: string
      data: string
      updatedAt: string
    }>()

    // Transform results into SyncRecord format
    const changes: SyncRecord[] = (result.results || []).map(row => ({
      id: row.recordId,
      table: row.tableName,
      operation: row.operation as 'insert' | 'update' | 'delete',
      data: JSON.parse(row.data),
      updatedAt: new Date(row.updatedAt)
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
