import { handleBulkUpsert } from '@/lib/api/handlers'

type Params = { params: Promise<{ table: string }> }

/** POST /api/v1/{table}/bulk — upsert up to 500 records with per-record results. */
export async function POST(request: Request, { params }: Params) {
  const { table } = await params
  return handleBulkUpsert(request, table)
}
