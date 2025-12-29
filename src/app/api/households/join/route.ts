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
    const { inviteCode } = body

    if (!inviteCode || inviteCode.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    // Find household by invite code
    const household = await db
      .prepare('SELECT id, name, description FROM households WHERE inviteCode = ?')
      .bind(inviteCode.toUpperCase().trim())
      .first<{ id: string; name: string; description: string | null }>()

    if (!household) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const memberId = `hm_${crypto.randomUUID()}`

    // Create household member record
    await db
      .prepare(`
        INSERT INTO household_members (
          id, householdId, userId, role, joinedAt,
          canManageMembers, canManageSettings, canDeleteItems
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        memberId,
        household.id,
        session.userId,
        'member',
        now,
        0, // canManageMembers
        0, // canManageSettings
        1  // canDeleteItems
      )
      .run()

    // Update user's householdId
    await db
      .prepare('UPDATE users SET householdId = ?, updatedAt = ? WHERE id = ?')
      .bind(household.id, now, session.userId)
      .run()

    // Create new session token with householdId
    const newToken = await createToken({
      userId: session.userId,
      email: session.email,
      householdId: household.id
    })

    // Store updated session in KV
    await storeSession(newToken, {
      userId: session.userId,
      email: session.email,
      householdId: household.id
    }, env)

    // Return response with updated session cookie
    const response = NextResponse.json({
      success: true,
      household: {
        id: household.id,
        name: household.name,
        description: household.description
      }
    })

    // Set new session cookie
    response.headers.set('Set-Cookie', createSessionCookie(newToken))

    return response
  } catch (error) {
    logger.error('Error joining household:', error)
    return NextResponse.json(
      { error: 'Failed to join household' },
      { status: 500 }
    )
  }
}
