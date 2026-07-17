import { NextResponse } from 'next/server'
import { getUserFromRequest, revokeUserSessions } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { userId: memberIdToRemove } = body

    if (!memberIdToRemove) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

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

    // Check if requesting user has permission to manage members
    const requestingMember = await db
      .prepare('SELECT role, canManageMembers FROM household_members WHERE householdId = ? AND userId = ?')
      .bind(session.householdId, session.userId)
      .first<{ role: string; canManageMembers: number }>()

    if (!requestingMember || (requestingMember.role !== 'owner' && requestingMember.canManageMembers !== 1)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Check if member to remove exists and get their role
    const memberToRemove = await db
      .prepare('SELECT role FROM household_members WHERE householdId = ? AND userId = ?')
      .bind(session.householdId, memberIdToRemove)
      .first<{ role: string }>()

    if (!memberToRemove) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Cannot remove the owner
    if (memberToRemove.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove the household owner' },
        { status: 403 }
      )
    }

    // Only owner can remove admins
    if (memberToRemove.role === 'admin' && requestingMember.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the owner can remove administrators' },
        { status: 403 }
      )
    }

    // Remove member from household
    await db
      .prepare('DELETE FROM household_members WHERE householdId = ? AND userId = ?')
      .bind(session.householdId, memberIdToRemove)
      .run()

    // Detach the household from the user record so a fresh login doesn't
    // reattach them to a household they no longer belong to
    await db
      .prepare('UPDATE users SET householdId = NULL, updatedAt = ? WHERE id = ?')
      .bind(new Date().toISOString(), memberIdToRemove)
      .run()

    // Invalidate the removed member's existing sessions: their tokens still
    // carry the old householdId claim and would keep syncing household data
    try {
      await revokeUserSessions(memberIdToRemove, env)
    } catch (error) {
      logger.error('Failed to revoke sessions for removed member:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    })
  } catch (error) {
    logger.error('Remove member error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
