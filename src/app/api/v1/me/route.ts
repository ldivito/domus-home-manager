import { handleMe } from '@/lib/api/handlers'

/** GET /api/v1/me — the calling key: name, prefix, scopes, owner, household (any valid key). */
export function GET(request: Request) {
  return handleMe(request)
}
