// Installment ("cuotas") helpers. Pure: safe for app and server.

export interface InstallmentFields {
  amount: number
  installmentNumber?: number
  installmentCount?: number
  originalTotalAmount?: number
}

export interface InstallmentInfo {
  number: number
  count: number
  /** Installments still to be billed after this one */
  remainingCount: number
  /** Amount still to be billed after this one */
  remainingAmount: number
  /** Full purchase amount (stored, or amount x count) */
  totalAmount: number
}

/** Null when the transaction is not an installment (or the fields are inconsistent). */
export function getInstallmentInfo(tx: InstallmentFields): InstallmentInfo | null {
  const number = Number(tx.installmentNumber)
  const count = Number(tx.installmentCount)
  if (!Number.isInteger(number) || !Number.isInteger(count) || count < 2 || number < 1 || number > count) {
    return null
  }
  const amount = Number(tx.amount) || 0
  const remainingCount = count - number
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    number,
    count,
    remainingCount,
    remainingAmount: round(amount * remainingCount),
    totalAmount: round(Number(tx.originalTotalAmount) || amount * count)
  }
}
