/**
 * Server-side wallet balance recalculation for the agent data API. The math
 * is the app's own pure computeWalletBalance (balance-math.ts), run over the
 * wallet's stored transactions (as source wallet and as transfer target).
 */
import { computeWalletBalanceDetailed, type BalanceTransaction } from '@/lib/utils/finance/balance-math'
import { listAllRecords, type SyncDB } from '@/lib/sync-store'
import { patchRecord, type WriteContext, type WriteOptions } from './records'

type Data = Record<string, unknown>

/** Upper bound of transactions/wallets read for one recalculation. */
const MAX_SCAN = 100_000

export interface OpeningBalanceInput {
  /** Number, or null to clear. Undefined leaves the stored value. */
  openingBalance?: number | null
  /** ISO date, or null to clear. Undefined leaves the stored value. */
  openingBalanceDate?: string | null
}

export type BalanceResult =
  | {
      walletId: string
      previousBalance: number
      balance: number
      transactionsCounted: number
      /** Transactions left out: different currency than the wallet and no exchangeRate. */
      skippedCurrency: number
      openingBalance?: number
      openingBalanceDate?: string
    }
  | { walletId: string; error: string }

export interface RecalculateOptions extends WriteOptions {
  /**
   * Transaction versions to use instead of the stored ones (id -> data, or
   * null for deleted). Lets a dry-run batch report the balances it would
   * produce.
   */
  overlay?: Map<string, Data | null>
  /** Opening balance changes stored on the wallet before computing (single wallet). */
  opening?: OpeningBalanceInput
}

/**
 * Recalculate and store the balance of each wallet. Each wallet's result is
 * independent: an unknown wallet gets an error entry, the rest still apply.
 */
export async function recalculateWallets(
  db: SyncDB,
  ctx: WriteContext,
  walletIds: string[],
  { dryRun = false, overlay, opening }: RecalculateOptions = {}
): Promise<BalanceResult[]> {
  const ids = Array.from(new Set(walletIds)).sort()
  if (ids.length === 0) return []

  const wallets = new Map((await listAllRecords(db, ctx.scope, 'personalWallets', MAX_SCAN)).map(r => [r.recordId, r.data]))
  const transactions = new Map(
    (await listAllRecords(db, ctx.scope, 'personalTransactions', MAX_SCAN)).map(r => [r.recordId, r.data])
  )
  for (const [id, data] of overlay ?? []) {
    if (data) transactions.set(id, data)
    else transactions.delete(id)
  }
  const currencyOf = (walletId: string) => {
    const currency = wallets.get(walletId)?.currency
    return typeof currency === 'string' ? currency : undefined
  }

  const results: BalanceResult[] = []
  for (const walletId of ids) {
    const stored = wallets.get(walletId)
    if (!stored) {
      results.push({ walletId, error: 'wallet not found' })
      continue
    }
    const wallet: Data = { ...stored }
    const changes: Data = {}
    if (opening?.openingBalance !== undefined) {
      changes.openingBalance = opening.openingBalance
      if (opening.openingBalance === null) delete wallet.openingBalance
      else wallet.openingBalance = opening.openingBalance
    }
    if (opening?.openingBalanceDate !== undefined) {
      changes.openingBalanceDate = opening.openingBalanceDate
      if (opening.openingBalanceDate === null) delete wallet.openingBalanceDate
      else wallet.openingBalanceDate = opening.openingBalanceDate
    }

    const related = Array.from(transactions.values()).filter(
      tx => tx.walletId === walletId || tx.targetWalletId === walletId
    ) as unknown as BalanceTransaction[]
    const openingDate = typeof wallet.openingBalanceDate === 'string' ? wallet.openingBalanceDate : undefined
    const openingBalance = Number(wallet.openingBalance)
    const { balance, counted, skippedCurrency } = computeWalletBalanceDetailed(
      {
        id: walletId,
        currency: currencyOf(walletId),
        openingBalance: Number.isFinite(openingBalance) ? openingBalance : undefined,
        openingBalanceDate: openingDate
      },
      related,
      currencyOf
    )

    const outcome = await patchRecord(db, ctx, 'personalWallets', walletId, { ...changes, balance }, { dryRun })
    if (outcome.ok === false) {
      results.push({ walletId, error: outcome.error })
      continue
    }
    const previous = Number(stored.balance)
    const saved = outcome.record
    results.push({
      walletId,
      previousBalance: Number.isFinite(previous) ? previous : 0,
      balance,
      transactionsCounted: counted,
      skippedCurrency,
      ...(typeof saved.openingBalance === 'number' ? { openingBalance: saved.openingBalance } : {}),
      ...(typeof saved.openingBalanceDate === 'string' ? { openingBalanceDate: saved.openingBalanceDate } : {})
    })
  }
  return results
}

/** Wallet ids a set of transaction writes touches (new and previous versions). */
export function walletsTouched(writes: Array<{ data: Data; previous?: Data }>): string[] {
  const ids = new Set<string>()
  for (const { data, previous } of writes) {
    for (const version of [data, previous]) {
      if (!version) continue
      for (const field of ['walletId', 'targetWalletId']) {
        const value = version[field]
        if (typeof value === 'string' && value) ids.add(value)
      }
    }
  }
  return Array.from(ids).sort()
}
