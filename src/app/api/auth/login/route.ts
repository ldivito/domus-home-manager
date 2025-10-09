import { NextResponse } from 'next/server'
import { verifyPassword, createToken, createSessionCookie, storeSession } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Get Cloudflare bindings (or use in-memory fallback)
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db
      .prepare('SELECT id, email, password, name, householdId FROM users WHERE email = ?')
      .bind(email)
      .first<{
        id: string
        email: string
        password: string
        name: string
        householdId: string
      }>()

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Get household member info
    const member = await db
      .prepare('SELECT role FROM household_members WHERE householdId = ? AND userId = ?')
      .bind(user.householdId, user.id)
      .first<{ role: string }>()

    // Get household info
    const household = await db
      .prepare('SELECT name, inviteCode FROM households WHERE id = ?')
      .bind(user.householdId)
      .first<{ name: string; inviteCode: string }>()

    // Create session token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      householdId: user.householdId
    })

    // Store session in KV
    await storeSession(
      token,
      { userId: user.id, email: user.email, householdId: user.householdId },
      env
    )

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        householdId: user.householdId,
        role: member?.role || 'member',
        household: household ? {
          name: household.name,
          inviteCode: household.inviteCode
        } : undefined
      }
    })

    response.headers.set('Set-Cookie', createSessionCookie(token))

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
