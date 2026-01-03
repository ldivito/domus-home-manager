import { NextResponse } from 'next/server'
import { getUserFromRequest, createToken, createSessionCookie, storeSession } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

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

    // Check if user already has a household
    const user = await db
      .prepare('SELECT householdId FROM users WHERE id = ?')
      .bind(session.userId)
      .first<{ householdId: string | null }>()

    if (user?.householdId) {
      return NextResponse.json(
        { error: 'User already belongs to a household' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Household name is required' },
        { status: 400 }
      )
    }

    // Generate a unique invite code (8 characters, alphanumeric)
    const inviteCode = generateInviteCode()
    const householdId = `household_${crypto.randomUUID()}`
    const memberId = `member_${crypto.randomUUID()}`
    const now = new Date().toISOString()

    // Create household record
    const householdResult = await db
      .prepare(`
        INSERT INTO households (id, name, description, ownerId, inviteCode, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(householdId, name.trim(), description?.trim() || null, session.userId, inviteCode, now, now)
      .run()

    if (!householdResult.success) {
      logger.error('Failed to create household:', householdResult.error)
      return NextResponse.json(
        { error: 'Failed to create household - database error' },
        { status: 500 }
      )
    }

    // Create household member record for owner
    const memberResult = await db
      .prepare(`
        INSERT INTO household_members (
          id, householdId, userId, role, joinedAt,
          canManageMembers, canManageSettings, canDeleteItems
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        memberId,
        householdId,
        session.userId,
        'owner',
        now,
        1, // canManageMembers
        1, // canManageSettings
        1  // canDeleteItems
      )
      .run()

    if (!memberResult.success) {
      logger.error('Failed to create household member:', memberResult.error)
      // Rollback household creation
      await db.prepare('DELETE FROM households WHERE id = ?').bind(householdId).run()
      return NextResponse.json(
        { error: 'Failed to create household - database error' },
        { status: 500 }
      )
    }

    // Update user's householdId
    const userResult = await db
      .prepare('UPDATE users SET householdId = ? WHERE id = ?')
      .bind(householdId, session.userId)
      .run()

    if (!userResult.success) {
      logger.error('Failed to update user householdId:', userResult.error)
      // Rollback member and household creation
      await db.prepare('DELETE FROM household_members WHERE id = ?').bind(memberId).run()
      await db.prepare('DELETE FROM households WHERE id = ?').bind(householdId).run()
      return NextResponse.json(
        { error: 'Failed to create household - database error' },
        { status: 500 }
      )
    }

    // Create new session token with householdId
    const newToken = await createToken({
      userId: session.userId,
      email: session.email,
      householdId
    })

    // Store updated session in KV
    await storeSession(newToken, {
      userId: session.userId,
      email: session.email,
      householdId
    }, env)

    // Return response with updated session cookie
    const response = NextResponse.json({
      success: true,
      household: {
        id: householdId,
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: session.userId,
        inviteCode,
        createdAt: now
      }
    })

    // Set new session cookie
    response.headers.set('Set-Cookie', createSessionCookie(newToken))

    return response
  } catch (error) {
    logger.error('Error creating household:', error)
    return NextResponse.json(
      { error: 'Failed to create household' },
      { status: 500 }
    )
  }
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous characters
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
