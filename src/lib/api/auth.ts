/**
 * Bearer API-key authentication for the agent data API (/api/v1/*).
 *
 * Security notes:
 * - keys are looked up by their non-secret prefix and verified by comparing
 *   SHA-256 hashes in constant time; the plaintext key is never stored or logged
 * - household keys stop working as soon as the owner leaves the household
 * - failed attempts and overall traffic are rate limited per IP, successful
 *   traffic per key (in-memory: KV allows ~1 write/s per key, too slow for a
 *   per-request counter; KV is only used for the failed-auth limiter)
 */
import { getDB, getKV, type CloudflareEnv } from '@/lib/cloudflare'
import { isRateLimited, isRateLimitedKV, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import type { SyncScope } from '@/lib/sync-store'
import { apiError, getRequestEnv } from './http'
import {
  apiKeyPrefix,
  isWellFormedApiKey,
  parseBearerToken,
  parseScopes,
  verifyApiKey,
  type ApiScope
} from './keys'
import type { NextResponse } from 'next/server'

export const RATE_LIMITS = {
  /** Requests per IP per minute (any outcome). */
  perIp: { limit: 600, windowMs: 60_000 },
  /** Failed authentications per IP per 15 minutes. */
  authFailures: { limit: 20, windowMs: 15 * 60_000 },
  /** Requests per key per minute. */
  perKey: { limit: 120, windowMs: 60_000 }
} as const

/** Only refresh lastUsedAt when the stored value is older than this. */
const LAST_USED_RESOLUTION_MS = 60_000

export interface ApiKeyContext {
  keyId: string
  userId: string
  householdId: string | null
  scopes: ApiScope[]
  scope: SyncScope
  env: CloudflareEnv | undefined
}

interface ApiKeyRow {
  id: string
  userId: string
  householdId: string | null
  keyHash: string
  scopes: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export type AuthResult =
  | { ok: true; ctx: ApiKeyContext }
  | { ok: false; response: NextResponse }

async function authFailure(request: Request, env: CloudflareEnv | undefined, message: string): Promise<AuthResult> {
  const key = `apiv1-authfail:${getClientIp(request)}`
  const { limit, windowMs } = RATE_LIMITS.authFailures
  const limited =
    isRateLimited(key, limit, windowMs) ||
    (await isRateLimitedKV(getKV(env), key, limit, windowMs))
  if (limited) {
    return {
      ok: false,
      response: apiError('rate_limited', 'Too many failed authentication attempts. Try again later.', {
        headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) }
      })
    }
  }
  return { ok: false, response: apiError('unauthorized', message) }
}

/**
 * Authenticate the request's bearer key and require `requiredScope` (null:
 * any valid key, used by GET /api/v1/me).
 * Returns the key context (owner, household scope) or a ready error response.
 */
export async function authenticateApiKey(request: Request, requiredScope: ApiScope | null): Promise<AuthResult> {
  const env = getRequestEnv(request)

  const ip = getClientIp(request)
  if (isRateLimited(`apiv1-ip:${ip}`, RATE_LIMITS.perIp.limit, RATE_LIMITS.perIp.windowMs)) {
    return { ok: false, response: apiError('rate_limited', 'Too many requests.', { headers: { 'Retry-After': '60' } }) }
  }

  const token = parseBearerToken(request.headers.get('authorization'))
  if (!token) {
    return { ok: false, response: apiError('unauthorized', 'Missing API key. Send "Authorization: Bearer domus_sk_...".') }
  }
  if (!isWellFormedApiKey(token)) {
    return authFailure(request, env, 'Invalid API key.')
  }

  const db = getDB(env)
  const candidates = await db
    .prepare('SELECT id, userId, householdId, keyHash, scopes, lastUsedAt, revokedAt FROM api_keys WHERE keyPrefix = ?')
    .bind(apiKeyPrefix(token))
    .all<ApiKeyRow>()

  let match: ApiKeyRow | null = null
  for (const row of candidates.results || []) {
    // Compare every candidate (no early exit) to keep timing uniform
    if (await verifyApiKey(token, row.keyHash)) match = row
  }
  if (!match) {
    return authFailure(request, env, 'Invalid API key.')
  }
  if (match.revokedAt) {
    return authFailure(request, env, 'API key has been revoked.')
  }

  const householdId = match.householdId || null
  if (householdId) {
    // Membership is re-checked on every request: removing a member from the
    // household immediately cuts off their keys
    const member = await db
      .prepare('SELECT userId FROM household_members WHERE householdId = ? AND userId = ?')
      .bind(householdId, match.userId)
      .first<{ userId: string }>()
    if (!member) {
      return { ok: false, response: apiError('forbidden', 'The key owner is no longer a member of this household.') }
    }
  } else {
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(match.userId).first<{ id: string }>()
    if (!user) {
      return { ok: false, response: apiError('forbidden', 'The key owner no longer exists.') }
    }
  }

  const scopes = parseScopes(match.scopes)
  if (requiredScope && !scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: apiError('insufficient_scope', `This API key lacks the "${requiredScope}" scope.`)
    }
  }

  if (isRateLimited(`apiv1-key:${match.id}`, RATE_LIMITS.perKey.limit, RATE_LIMITS.perKey.windowMs)) {
    return {
      ok: false,
      response: apiError('rate_limited', `Rate limit exceeded (${RATE_LIMITS.perKey.limit} requests/minute per key).`, {
        headers: { 'Retry-After': '60' }
      })
    }
  }

  const nowMs = Date.now()
  const lastUsed = match.lastUsedAt ? new Date(match.lastUsedAt).getTime() : 0
  if (!lastUsed || isNaN(lastUsed) || nowMs - lastUsed > LAST_USED_RESOLUTION_MS) {
    try {
      await db.prepare('UPDATE api_keys SET lastUsedAt = ? WHERE id = ?').bind(new Date(nowMs).toISOString(), match.id).run()
    } catch (error) {
      logger.warn('Failed to update API key lastUsedAt:', error)
    }
  }

  return {
    ok: true,
    ctx: {
      keyId: match.id,
      userId: match.userId,
      householdId,
      scopes,
      scope: { userId: match.userId, householdId },
      env
    }
  }
}
