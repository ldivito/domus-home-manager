import { NextResponse } from 'next/server'
import { hashPassword, createToken, createSessionCookie, storeSession } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { generateInviteCode } from '@/lib/utils'

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
    let householdId: string
    let role: 'owner' | 'member' = 'owner'

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
    } else {
      // Create new household
      householdId = `hh_${crypto.randomUUID()}`
      const newInviteCode = generateInviteCode()
      const householdName = `${name}'s Household`

      await db
        .prepare(`
          INSERT INTO households (id, name, ownerId, inviteCode, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(householdId, householdName, userId, newInviteCode, now, now)
        .run()
    }

    // Insert user into database
    await db
      .prepare(`
        INSERT INTO users (id, email, password, name, householdId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(userId, email, hashedPassword, name, householdId, now, now)
      .run()

    // Add user to household_members table
    const memberId = `hm_${crypto.randomUUID()}`
    const permissions = role === 'owner'
      ? { canManageMembers: 1, canManageSettings: 1, canDeleteItems: 1 }
      : { canManageMembers: 0, canManageSettings: 0, canDeleteItems: 1 }

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
        permissions.canManageMembers,
        permissions.canManageSettings,
        permissions.canDeleteItems
      )
      .run()

    // Create session token
    const token = await createToken({ userId, email, householdId })

    // Store session in KV
    await storeSession(token, { userId, email, householdId }, env)

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
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
