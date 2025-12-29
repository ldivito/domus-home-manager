import { NextResponse } from 'next/server'
import { hashPassword, createToken, createSessionCookie, storeSession } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, inviteCode } = body

    // Get Cloudflare bindings (or use in-memory fallback)
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first()

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    const userId = `usr_${crypto.randomUUID()}`
    const hashedPassword = await hashPassword(password)
    const now = new Date().toISOString()
    let householdId: string | null = null
    let role: 'owner' | 'member' = 'member'

    // If invite code provided, join existing household
    if (inviteCode) {
      const household = await db
        .prepare('SELECT id, name FROM households WHERE inviteCode = ?')
        .bind(inviteCode.toUpperCase())
        .first<{ id: string; name: string }>()

      if (!household) {
        return NextResponse.json(
          { error: 'Invalid invite code' },
          { status: 400 }
        )
      }

      householdId = household.id
      role = 'member'

      // Add user to household_members table
      const memberId = `hm_${crypto.randomUUID()}`
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
          householdId,
          userId,
          role,
          now,
          0, // canManageMembers
          0, // canManageSettings
          1  // canDeleteItems
        )
        .run()
    }

    // Insert user into database (without household if no invite code)
    await db
      .prepare(`
        INSERT INTO users (id, email, password, name, householdId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(userId, email, hashedPassword, name, householdId, now, now)
      .run()

    // Create session token (householdId can be null)
    const token = await createToken({
      userId,
      email,
      ...(householdId && { householdId })
    })

    // Store session in KV
    const sessionData: { userId: string; email: string; householdId?: string } = {
      userId,
      email
    }
    if (householdId) {
      sessionData.householdId = householdId
    }
    await storeSession(token, sessionData, env)

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        name,
        householdId,
        role
      }
    })

    response.headers.set('Set-Cookie', createSessionCookie(token))

    return response
  } catch (error) {
    logger.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
