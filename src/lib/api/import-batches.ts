/**
 * Import batches: every record written with the same importBatchId (bulk
 * ?importBatchId=...) can be summarized or undone as one load.
 */
import { isSyncTable } from '@/lib/sync-tables'
import { executeSyncWrites, listRecordsByImportBatch, type SyncDB } from '@/lib/sync-store'
import { walletsTouched } from './balances'
import { prepareTombstone, type WriteContext, type WriteOptions } from './records'

export interface BatchSummary {
  batchId: string
  tables: Record<string, number>
  total: number
}

async function liveBatchRecords(db: SyncDB, ctx: WriteContext, batchId: string) {
  return (await listRecordsByImportBatch(db, ctx.scope, batchId)).filter(r => isSyncTable(r.table))
}

function countByTable(records: Array<{ table: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const { table } of records) counts[table] = (counts[table] ?? 0) + 1
  return counts
}

/** Live (non-deleted) records per table carrying this importBatchId. */
export async function summarizeImportBatch(db: SyncDB, ctx: WriteContext, batchId: string): Promise<BatchSummary> {
  const records = await liveBatchRecords(db, ctx, batchId)
  return { batchId, tables: countByTable(records), total: records.length }
}

/** Tombstone every live record of the batch, across all tables. */
export async function deleteImportBatch(
  db: SyncDB,
  ctx: WriteContext,
  batchId: string,
  { dryRun = false }: WriteOptions = {}
): Promise<BatchSummary & { transactionWallets: string[]; transactionIds: string[] }> {
  const records = await liveBatchRecords(db, ctx, batchId)
  if (!dryRun) {
    const now = Date.now()
    await executeSyncWrites(db, records.map(r => prepareTombstone(db, ctx, r.table, r, now)))
  }
  // Wallets whose stored balance may now be stale
  const transactions = records.filter(r => r.table === 'personalTransactions')
  return {
    batchId,
    tables: countByTable(records),
    total: records.length,
    transactionWallets: walletsTouched(transactions),
    transactionIds: transactions.map(r => r.recordId)
  }
}
