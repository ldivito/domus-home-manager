import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import type { SyncRecord } from '@/lib/sync'

// In-memory storage (same as push route)
const syncedData = new Map<string, Map<string, SyncRecord>>()

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getUserFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')
    const since = sinceParam ? new Date(sinceParam) : null

    // Collect changes from all tables
    const changes: SyncRecord[] = []

    for (const tableData of syncedData.values()) {
      for (const record of tableData.values()) {
        // Filter by timestamp if provided
        if (since && record.updatedAt <= since) {
          continue
        }

        // Filter by user (only return user's data)
        const recordData = record.data as { userId?: string }
        if (recordData.userId && recordData.userId !== session.userId) {
          continue
        }

        changes.push(record)
      }
    }

    return NextResponse.json({
      success: true,
      changes,
      count: changes.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Pull sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export { syncedData }
