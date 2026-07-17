import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { getKV, type CloudflareEnv } from './cloudflare'
import { logger } from '@/lib/logger'

let cachedJwtSecret: Uint8Array | null = null

/**
 * Resolve the JWT signing secret lazily so builds don't require the env var.
 * Production without JWT_SECRET fails fast; development falls back to an
 * ephemeral random secret (sessions reset on every server restart).
 */
function getJwtSecret(): Uint8Array {
  if (cachedJwtSecret) return cachedJwtSecret

  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable must be set in production')
    }
    logger.warn(
      'JWT_SECRET is not set — using an ephemeral development secret; all sessions are invalidated on restart'
    )
    cachedJwtSecret = crypto.getRandomValues(new Uint8Array(32))
    return cachedJwtSecret
  }

  cachedJwtSecret = new TextEncoder().encode(secret)
  return cachedJwtSecret
}

export interface UserPayload {
  userId: string
  email: string
  householdId?: string
  [key: string]: unknown
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
    .sign(getJwtSecret())

  return token
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as SessionData
  } catch (error) {
    logger.error('Token verification failed:', error)
    return null
  }
}

/**
 * Get user session from request cookies
 * Verifies JWT token and optionally checks KV storage
 */
export async function getUserFromRequest(
  request: Request,
  env?: CloudflareEnv
): Promise<SessionData | null> {
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

  // First verify JWT signature
  const jwtData = await verifyToken(token)
  if (!jwtData) return null

  // If KV is available, also check if session exists
  // This handles logout scenarios where session is deleted from KV
  if (env) {
    try {
      const kvSession = await getSession(token, env)
      if (!kvSession) return null

      // Reject tokens issued before the user's sessions were revoked
      // (e.g. after being removed from a household)
      const revokedAt = await getKV(env).get(`revoked:${jwtData.userId}`)
      if (revokedAt && jwtData.iat * 1000 <= Number(revokedAt)) return null
    } catch (error) {
      // In development, fall back to JWT-only auth if KV fails (e.g., API timeout)
      if (process.env.NODE_ENV === 'development') {
        logger.warn('KV session check failed, using JWT only:', error)
        return jwtData
      }
      // In production, rethrow the error
      throw error
    }
  }

  return jwtData
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

/**
 * Store session in KV
 */
export async function storeSession(
  token: string,
  session: UserPayload,
  env?: CloudflareEnv
): Promise<void> {
  const kv = getKV(env)
  const sessionKey = `session:${token}`
  const ttl = 60 * 60 * 24 * 7 // 7 days

  await kv.put(sessionKey, JSON.stringify(session), { expirationTtl: ttl })
}

/**
 * Get session from KV
 */
export async function getSession(
  token: string,
  env?: CloudflareEnv
): Promise<UserPayload | null> {
  const kv = getKV(env)
  const sessionKey = `session:${token}`

  const data = await kv.get(sessionKey)
  if (!data) return null

  try {
    return JSON.parse(data) as UserPayload
  } catch {
    return null
  }
}

/**
 * Revoke every session of a user from now on: getUserFromRequest rejects
 * tokens issued before the revocation timestamp. TTL matches token lifetime.
 */
export async function revokeUserSessions(
  userId: string,
  env?: CloudflareEnv
): Promise<void> {
  const kv = getKV(env)
  await kv.put(`revoked:${userId}`, String(Date.now()), {
    expirationTtl: 60 * 60 * 24 * 7
  })
}

/**
 * Delete session from KV
 */
export async function deleteSession(
  token: string,
  env?: CloudflareEnv
): Promise<void> {
  const kv = getKV(env)
  const sessionKey = `session:${token}`
  await kv.delete(sessionKey)
}
