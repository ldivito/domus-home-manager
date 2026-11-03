import { handleListTables } from '@/lib/api/handlers'

/** GET /api/v1/tables — tables, id prefixes and fields (read scope). */
export function GET(request: Request) {
  return handleListTables(request)
}
