import { NextResponse } from 'next/server'
import { hashPassword, createToken, createSessionCookie } from '@/lib/auth'

// In-memory user storage (replace with Cloudflare D1 in production)
// This is just for development/testing
const users = new Map<string, {
  id: string
  email: string
  password: string
  name: string
  householdId?: string
  createdAt: Date
}>()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

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
    const existingUser = Array.from(users.values()).find(u => u.email === email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    // Create new user
    const userId = `usr_${crypto.randomUUID()}`
    const hashedPassword = await hashPassword(password)

    users.set(userId, {
      id: userId,
      email,
      password: hashedPassword,
      name,
      createdAt: new Date()
    })

    // Create session token
    const token = await createToken({ userId, email })

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        name
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

// Export users map for other routes to access
export { users }
