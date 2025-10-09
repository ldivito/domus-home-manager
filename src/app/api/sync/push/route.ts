import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import type { SyncRecord } from '@/lib/sync'

// In-memory storage for synced data (replace with Cloudflare D1 in production)
const syncedData = new Map<string, Map<string, SyncRecord>>()

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getUserFromRequest(request)
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

    // Store changes in memory (simulate D1)
    let pushed = 0
    for (const change of changes) {
      // Get or create table storage
      if (!syncedData.has(change.table)) {
        syncedData.set(change.table, new Map())
      }
      const tableData = syncedData.get(change.table)!

      // Store the change
      tableData.set(change.id, {
        ...change,
        // Add userId for authorization
        data: { ...change.data, userId: session.userId }
      })

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

// Export for access by pull route
export { syncedData }
