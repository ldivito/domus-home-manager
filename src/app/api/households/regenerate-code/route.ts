import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { generateInviteCode } from '@/lib/utils'

export async function POST(request: Request) {
  try {
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

    // Check if user is owner or has permission to manage settings
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

    // Generate new invite code
    let newInviteCode = generateInviteCode()
    let isUnique = false
    let attempts = 0
    const maxAttempts = 10

    // Ensure uniqueness
    while (!isUnique && attempts < maxAttempts) {
      const existing = await db
        .prepare('SELECT id FROM households WHERE inviteCode = ?')
        .bind(newInviteCode)
        .first()

      if (!existing) {
        isUnique = true
      } else {
        newInviteCode = generateInviteCode()
        attempts++
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { error: 'Failed to generate unique invite code' },
        { status: 500 }
      )
    }

    const now = new Date().toISOString()

    // Update household with new invite code
    await db
      .prepare('UPDATE households SET inviteCode = ?, updatedAt = ? WHERE id = ?')
      .bind(newInviteCode, now, session.householdId)
      .run()

    return NextResponse.json({
      success: true,
      inviteCode: newInviteCode
    })
  } catch (error) {
    console.error('Regenerate invite code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
