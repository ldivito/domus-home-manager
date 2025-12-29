import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
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

    // Check if user has a household
    if (!session.householdId) {
      return NextResponse.json(
        { error: 'No household', code: 'NO_HOUSEHOLD' },
        { status: 404 }
      )
    }

    // Get household info
    const household = await db
      .prepare('SELECT id, name, description, ownerId, inviteCode, createdAt FROM households WHERE id = ?')
      .bind(session.householdId)
      .first<{
        id: string
        name: string
        description: string | null
        ownerId: string
        inviteCode: string
        createdAt: string
      }>()

    if (!household) {
      return NextResponse.json(
        { error: 'Household not found' },
        { status: 404 }
      )
    }

    // Get household members
    const members = await db
      .prepare(`
        SELECT
          hm.id, hm.userId, hm.role, hm.joinedAt,
          hm.canManageMembers, hm.canManageSettings, hm.canDeleteItems,
          u.name, u.email
        FROM household_members hm
        JOIN users u ON hm.userId = u.id
        WHERE hm.householdId = ?
        ORDER BY
          CASE hm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'member' THEN 3
          END,
          hm.joinedAt ASC
      `)
      .bind(session.householdId)
      .all<{
        id: string
        userId: string
        role: string
        joinedAt: string
        canManageMembers: number
        canManageSettings: number
        canDeleteItems: number
        name: string
        email: string
      }>()

    return NextResponse.json({
      success: true,
      household: {
        id: household.id,
        name: household.name,
        description: household.description,
        ownerId: household.ownerId,
        inviteCode: household.inviteCode,
        createdAt: household.createdAt,
        isOwner: household.ownerId === session.userId
      },
      members: members.results?.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: m.role,
        joinedAt: m.joinedAt,
        permissions: {
          canManageMembers: m.canManageMembers === 1,
          canManageSettings: m.canManageSettings === 1,
          canDeleteItems: m.canDeleteItems === 1
        }
      })) || []
    })
  } catch (error) {
    logger.error('Get household info error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
