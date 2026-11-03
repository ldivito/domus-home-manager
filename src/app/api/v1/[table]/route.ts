import { handleListRecords } from '@/lib/api/handlers'

type Params = { params: Promise<{ table: string }> }

/** GET /api/v1/{table}?updatedSince=&limit=&cursor= — latest non-deleted records. */
export async function GET(request: Request, { params }: Params) {
  const { table } = await params
  return handleListRecords(request, table)
}
