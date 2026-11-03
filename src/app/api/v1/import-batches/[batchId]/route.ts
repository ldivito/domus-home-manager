import { handleDeleteImportBatch, handleGetImportBatch } from '@/lib/api/handlers'

type Params = { params: Promise<{ batchId: string }> }

/** GET /api/v1/import-batches/{batchId} — live record counts per table (read scope). */
export async function GET(request: Request, { params }: Params) {
  const { batchId } = await params
  return handleGetImportBatch(request, batchId)
}

/** DELETE /api/v1/import-batches/{batchId}?dryRun=&recalculateBalances= — tombstone the whole load (write scope). */
export async function DELETE(request: Request, { params }: Params) {
  const { batchId } = await params
  return handleDeleteImportBatch(request, batchId)
}
