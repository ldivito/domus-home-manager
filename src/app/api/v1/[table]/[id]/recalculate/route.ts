import { handleRecalculateWallet } from '@/lib/api/handlers'

type Params = { params: Promise<{ table: string; id: string }> }

/**
 * POST /api/v1/personalWallets/{id}/recalculate?dryRun= — recompute and store
 * the wallet balance from its transactions (write scope). Other tables: 404.
 */
export async function POST(request: Request, { params }: Params) {
  const { table, id } = await params
  return handleRecalculateWallet(request, table, id)
}
