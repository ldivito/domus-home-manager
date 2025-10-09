import { NextResponse } from 'next/server'
import { verifyPassword, createToken, createSessionCookie } from '@/lib/auth'

// Import in-memory storage (replace with D1 in production)
// This will be shared across routes
const users = new Map<string, {
  id: string
  email: string
  password: string
  name: string
  householdId?: string
  createdAt: Date
}>()

// Function to get user store (to avoid circular dependencies)
function getUserStore() {
  return users
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const userStore = getUserStore()
    const user = Array.from(userStore.values()).find(u => u.email === email)

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

    // Create session token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      householdId: user.householdId
    })

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        householdId: user.householdId
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

export { users }
