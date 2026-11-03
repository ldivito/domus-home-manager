// Pure wallet balance math (no database access) shared by the app and the
// server-side data API, so both compute exactly the same balance.

type TxType = 'income' | 'expense' | 'transfer' | 'refund'

export interface BalanceTransaction {
  type: TxType | string
  amount: number
  currency?: string
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

/**
 * Signed effect of one transaction on `walletId`'s balance, in the wallet's
 * currency. Returns null when it can't be expressed in that currency (a USD
 * charge on an ARS card without exchangeRate): such amounts belong to the
 * statement's USD fields, not to the wallet balance.
 */
export function transactionEffect(
  tx: BalanceTransaction,
  walletId: string,
  currencyOf: (walletId: string) => string | undefined = () => undefined
): number | null {
  let amount = Number(tx.amount) || 0
  if (tx.walletId === walletId) {
    const walletCurrency = currencyOf(walletId)
    if (tx.currency && walletCurrency && tx.currency !== walletCurrency) {
      if (!tx.exchangeRate) return null
      amount = amount * tx.exchangeRate
    }
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

export interface WalletBalanceBreakdown {
  balance: number
  /** Transactions that changed the balance */
  counted: number
  /** Foreign-currency transactions without exchangeRate (left out) */
  skippedCurrency: number
}

/**
 * Balance of a wallet = openingBalance + every completed transaction dated on
 * or after openingBalanceDate (all of them when there is no opening date).
 * Cancelled and pending transactions don't count. Transactions in another
 * currency are converted with their exchangeRate, or left out without one.
 */
export function computeWalletBalanceDetailed(
  wallet: BalanceWallet & { id: string },
  transactions: BalanceTransaction[],
  currencyOf: (walletId: string) => string | undefined = () => undefined
): WalletBalanceBreakdown {
  const from = toTime(wallet.openingBalanceDate)
  const lookup = (id: string) => (id === wallet.id && wallet.currency ? wallet.currency : currencyOf(id))
  let balance = Number(wallet.openingBalance) || 0
  let counted = 0
  let skippedCurrency = 0
  for (const tx of transactions) {
    if ((tx.status ?? 'completed') !== 'completed') continue
    if (from !== null) {
      const at = toTime(tx.date)
      if (at !== null && at < from) continue
    }
    const effect = transactionEffect(tx, wallet.id, lookup)
    if (effect === null) {
      skippedCurrency++
      continue
    }
    if (tx.walletId === wallet.id || tx.targetWalletId === wallet.id) counted++
    balance += effect
  }
  // Avoid float noise like 0.30000000000000004
  return { balance: Math.round(balance * 100) / 100, counted, skippedCurrency }
}

export function computeWalletBalance(
  wallet: BalanceWallet & { id: string },
  transactions: BalanceTransaction[],
  currencyOf: (walletId: string) => string | undefined = () => undefined
): number {
  return computeWalletBalanceDetailed(wallet, transactions, currencyOf).balance
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
