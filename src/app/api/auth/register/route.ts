import { NextResponse } from 'next/server'
import { hashPassword, createToken, createSessionCookie, storeSession } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

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

    // Create new user
    const userId = `usr_${crypto.randomUUID()}`
    const householdId = `hh_${crypto.randomUUID()}`
    const hashedPassword = await hashPassword(password)
    const now = new Date().toISOString()

    // Insert user into database
    await db
      .prepare(`
        INSERT INTO users (id, email, password, name, householdId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(userId, email, hashedPassword, name, householdId, now, now)
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
        householdId
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
