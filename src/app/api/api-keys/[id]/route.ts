import { getUserFromRequest } from '@/lib/auth'
import { getDB } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { apiError, apiJson, getRequestEnv } from '@/lib/api/http'

type Params = { params: Promise<{ id: string }> }

/** DELETE /api/api-keys/{id} — revoke one of the caller's keys (idempotent). */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const env = getRequestEnv(request)
    const session = await getUserFromRequest(request, env)
    if (!session) return apiError('unauthorized', 'Unauthorized')

    const { id } = await params
    if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
      return apiError('invalid_request', 'Invalid key id')
    }

    const db = getDB(env)
    const key = await db
      .prepare('SELECT id, revokedAt FROM api_keys WHERE id = ? AND userId = ?')
      .bind(id, session.userId)
      .first<{ id: string; revokedAt: string | null }>()
    if (!key) return apiError('not_found', 'API key not found')

    const revokedAt = key.revokedAt ?? new Date().toISOString()
    if (!key.revokedAt) {
      await db
        .prepare('UPDATE api_keys SET revokedAt = ? WHERE id = ? AND userId = ? AND revokedAt IS NULL')
        .bind(revokedAt, id, session.userId)
        .run()
    }
    return apiJson({ id, revokedAt })
  } catch (error) {
    logger.error('Revoke API key error:', error)
    return apiError('internal_error', 'Internal server error')
  }
}
