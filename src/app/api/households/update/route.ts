import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { name, description } = body

    // Get Cloudflare bindings (or use in-memory fallback)
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    // Verify user session
    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to manage settings
    const member = await db
      .prepare('SELECT role, canManageSettings FROM household_members WHERE householdId = ? AND userId = ?')
      .bind(session.householdId, session.userId)
      .first<{ role: string; canManageSettings: number }>()

    if (!member || (member.role !== 'owner' && member.canManageSettings !== 1)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    // Update household
    await db
      .prepare('UPDATE households SET name = ?, description = ?, updatedAt = ? WHERE id = ?')
      .bind(name || null, description || null, now, session.householdId)
      .run()

    return NextResponse.json({
      success: true,
      message: 'Household updated successfully'
    })
  } catch (error) {
    console.error('Update household error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
