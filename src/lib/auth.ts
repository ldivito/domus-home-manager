import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export interface UserPayload {
  userId: string
  email: string
  householdId?: string
}

export interface SessionData extends UserPayload {
  exp: number
  iat: number
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Create a JWT token for a user
 */
export async function createToken(payload: UserPayload): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 days
    .sign(JWT_SECRET)

  return token
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as SessionData
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

/**
 * Get user session from request cookies
 */
export async function getUserFromRequest(request: Request): Promise<SessionData | null> {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...v] = c.trim().split('=')
      return [key, v.join('=')]
    })
  )

  const token = cookies['session']
  if (!token) return null

  return verifyToken(token)
}

/**
 * Create a session cookie header
 */
export function createSessionCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 7 // 7 days in seconds
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

/**
 * Create a cookie to clear the session
 */
export function clearSessionCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}
