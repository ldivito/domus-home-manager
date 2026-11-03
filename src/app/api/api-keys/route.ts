import { getUserFromRequest } from '@/lib/auth'
import { getDB } from '@/lib/cloudflare'
import { isRateLimited } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { apiError, apiJson, getRequestEnv, readJson } from '@/lib/api/http'
import { API_SCOPES, generateApiKey, parseScopes, type ApiScope } from '@/lib/api/keys'

const MAX_ACTIVE_KEYS_PER_USER = 20
const MAX_NAME_LENGTH = 100

interface ApiKeyListRow {
  id: string
  name: string
  keyPrefix: string
  scopes: string
  householdId: string | null
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

function toPublicKey(row: ApiKeyListRow) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    scopes: parseScopes(row.scopes),
    householdId: row.householdId || null,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt
  }
}

/** GET /api/api-keys — the current user's keys (never the secret or hash). */
export async function GET(request: Request) {
  try {
    const env = getRequestEnv(request)
    const session = await getUserFromRequest(request, env)
    if (!session) return apiError('unauthorized', 'Unauthorized')

    const rows = await getDB(env)
      .prepare(`
        SELECT id, name, keyPrefix, scopes, householdId, createdAt, lastUsedAt, revokedAt
        FROM api_keys WHERE userId = ? ORDER BY createdAt DESC
      `)
      .bind(session.userId)
      .all<ApiKeyListRow>()

    return apiJson({ keys: (rows.results || []).map(toPublicKey) })
  } catch (error) {
    logger.error('List API keys error:', error)
    return apiError('internal_error', 'Internal server error')
  }
}

/**
 * POST /api/api-keys { name, scopes? } — create a key bound to the caller's
 * current household (or personal data when not in a household). The
 * plaintext key is returned once and never again.
 */
export async function POST(request: Request) {
  try {
    const env = getRequestEnv(request)
    const session = await getUserFromRequest(request, env)
    if (!session) return apiError('unauthorized', 'Unauthorized')

    if (isRateLimited(`apikey-create:${session.userId}`, 10, 60 * 60 * 1000)) {
      return apiError('rate_limited', 'Too many keys created recently. Try again later.')
    }

    const body = await readJson(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return apiError('invalid_request', 'Body must be a JSON object')
    }
    const { name, scopes } = body as { name?: unknown; scopes?: unknown }

    if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
      return apiError('invalid_request', `name is required (1-${MAX_NAME_LENGTH} characters)`)
    }

    let keyScopes: ApiScope[] = ['read', 'write']
    if (scopes !== undefined) {
      if (
        !Array.isArray(scopes) ||
        scopes.length === 0 ||
        !scopes.every(s => typeof s === 'string' && (API_SCOPES as readonly string[]).includes(s))
      ) {
        return apiError('invalid_request', `scopes must be a non-empty array of: ${API_SCOPES.join(', ')}`)
      }
      keyScopes = Array.from(new Set(scopes as ApiScope[]))
    }

    const db = getDB(env)
    const active = await db
      .prepare('SELECT COUNT(*) AS count FROM api_keys WHERE userId = ? AND revokedAt IS NULL')
      .bind(session.userId)
      .first<{ count: number }>()
    if ((active?.count ?? 0) >= MAX_ACTIVE_KEYS_PER_USER) {
      return apiError('invalid_request', `At most ${MAX_ACTIVE_KEYS_PER_USER} active keys per user; revoke one first`)
    }

    const { key, prefix, hash } = await generateApiKey()
    const row: ApiKeyListRow = {
      id: `apk_${crypto.randomUUID()}`,
      name: name.trim(),
      keyPrefix: prefix,
      scopes: keyScopes.join(','),
      householdId: session.householdId || null,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null
    }

    await db
      .prepare(`
        INSERT INTO api_keys (id, userId, householdId, name, keyPrefix, keyHash, scopes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(row.id, session.userId, row.householdId, row.name, row.keyPrefix, hash, row.scopes, row.createdAt)
      .run()

    return apiJson({ key: toPublicKey(row), secret: key }, 201)
  } catch (error) {
    logger.error('Create API key error:', error)
    return apiError('internal_error', 'Internal server error')
  }
}
