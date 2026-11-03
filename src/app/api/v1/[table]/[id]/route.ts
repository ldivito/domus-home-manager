import { handleDeleteRecord, handleGetRecord, handlePatchRecord } from '@/lib/api/handlers'

type Params = { params: Promise<{ table: string; id: string }> }

/** GET /api/v1/{table}/{id} */
export async function GET(request: Request, { params }: Params) {
  const { table, id } = await params
  return handleGetRecord(request, table, id)
}

/** PATCH /api/v1/{table}/{id} — partial update merged onto the latest version. */
export async function PATCH(request: Request, { params }: Params) {
  const { table, id } = await params
  return handlePatchRecord(request, table, id)
}

/** DELETE /api/v1/{table}/{id} — writes a delete tombstone (like a client deletion). */
export async function DELETE(request: Request, { params }: Params) {
  const { table, id } = await params
  return handleDeleteRecord(request, table, id)
}
