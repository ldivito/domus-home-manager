// Pure wallet balance math (no database access) shared by the app and the
// server-side data API, so both compute exactly the same balance.

type TxType = 'income' | 'expense' | 'transfer' | 'refund'

export interface BalanceTransaction {
  type: TxType | string
  amount: number
  walletId: string
  targetWalletId?: string
  exchangeRate?: number
  status?: string
  date?: Date | string
}

export interface BalanceWallet {
  id?: string
  currency?: string
  openingBalance?: number
  openingBalanceDate?: Date | string
}

/** Signed effect of one transaction on `walletId`'s balance. */
export function transactionEffect(
  tx: BalanceTransaction,
  walletId: string,
  currencyOf: (walletId: string) => string | undefined = () => undefined
): number {
  const amount = Number(tx.amount) || 0
  if (tx.walletId === walletId) {
    switch (tx.type) {
      case 'income':
      case 'refund':
        return amount
      case 'expense':
      case 'transfer':
        return -amount
      default:
        return 0
    }
  }
  if (tx.type === 'transfer' && tx.targetWalletId === walletId) {
    const crossCurrency = currencyOf(tx.walletId) !== undefined &&
      currencyOf(tx.walletId) !== currencyOf(walletId)
    return tx.exchangeRate && crossCurrency ? amount * tx.exchangeRate : amount
  }
  return 0
}

const toTime = (value: Date | string | undefined): number | null => {
  if (value === undefined || value === null) return null
  const t = new Date(value).getTime()
  return isNaN(t) ? null : t
}

/**
 * Balance of a wallet = openingBalance + every completed transaction dated on
 * or after openingBalanceDate (all of them when there is no opening date).
 * Cancelled and pending transactions don't count.
 */
export function computeWalletBalance(
  wallet: BalanceWallet & { id: string },
  transactions: BalanceTransaction[],
  currencyOf: (walletId: string) => string | undefined = () => undefined
): number {
  const from = toTime(wallet.openingBalanceDate)
  let balance = Number(wallet.openingBalance) || 0
  for (const tx of transactions) {
    if ((tx.status ?? 'completed') !== 'completed') continue
    if (from !== null) {
      const at = toTime(tx.date)
      if (at !== null && at < from) continue
    }
    balance += transactionEffect(tx, wallet.id, currencyOf)
  }
  // Avoid float noise like 0.30000000000000004
  return Math.round(balance * 100) / 100
}

/**
 * Deterministic statement id: one statement per card and closing month, so
 * independent devices (and the API) never create parallel copies.
 * e.g. ('pw_visa', 2026-10-29) -> 'ccs_pw_visa_2026-10'
 */
export function statementIdFor(walletId: string, periodEnd: Date | string): string {
  const d = new Date(periodEnd)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `ccs_${walletId}_${d.getFullYear()}-${month}`
}
