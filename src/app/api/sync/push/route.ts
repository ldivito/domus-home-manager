import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import type { SyncRecord } from '@/lib/sync'

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
    const { changes } = body as { changes: SyncRecord[] }

    if (!Array.isArray(changes)) {
      return NextResponse.json(
        { error: 'Invalid request: changes must be an array' },
        { status: 400 }
      )
    }

    // Store changes in D1
    let pushed = 0
    for (const change of changes) {
      const recordId = `sync_${crypto.randomUUID()}`
      const now = new Date().toISOString()

      await db
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
          change.operation || 'update',
          JSON.stringify(change.data),
          now,
          now
        )
        .run()

      pushed++
    }

    return NextResponse.json({
      success: true,
      pushed,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Push sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
