// Per-month value resolution for recurring expenses (household finance module).
// Pure functions — no React, no Dexie. The monthly value of a service lives in
// the ExpensePayment record for that (expense, month, year).

import type { ExpensePayment, RecurringExpense } from '@/lib/db'

export interface MonthlyValueSeed {
  amount: number
  currency: 'ARS' | 'USD'
}

/**
 * Most recent payment strictly before (month, year) for a given expense.
 * Handles skipped months and year boundaries. Returns null when no prior record exists.
 */
export function getPreviousValue(
  expenseId: string,
  month: number,
  year: number,
  payments: ExpensePayment[]
): MonthlyValueSeed | null {
  const prior = payments
    .filter(p => p.recurringExpenseId === expenseId)
    .filter(p => p.year < year || (p.year === year && p.month < month))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))

  const latest = prior[0]
  if (!latest) return null
  return { amount: latest.amount, currency: latest.currency ?? 'ARS' }
}

/**
 * Default amount + currency for a month's record: the previous month's value if
 * any, otherwise the expense's seed amount/currency.
 */
export function resolveDefaultForMonth(
  expense: RecurringExpense,
  month: number,
  year: number,
  payments: ExpensePayment[]
): MonthlyValueSeed {
  const previous = getPreviousValue(expense.id!, month, year, payments)
  if (previous) return previous
  return { amount: expense.amount, currency: expense.currency ?? 'ARS' }
}

/**
 * Stored monthly amount converted to ARS using the month's exchange rate and the
 * stored currency. Never reads the live expense amount.
 */
export function getMonthlyAmountARS(
  payment: Pick<ExpensePayment, 'amount' | 'currency'>,
  rate: number
): number {
  const currency = payment.currency ?? 'ARS'
  return currency === 'USD' ? payment.amount * rate : payment.amount
}
