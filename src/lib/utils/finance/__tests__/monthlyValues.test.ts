import type { ExpensePayment, RecurringExpense } from '@/lib/db'
import {
  getPreviousValue,
  resolveDefaultForMonth,
  getMonthlyAmountARS,
} from '../monthlyValues'

function pay(o: Partial<ExpensePayment>): ExpensePayment {
  return {
    id: o.id ?? 'p',
    recurringExpenseId: o.recurringExpenseId ?? 'e1',
    amount: o.amount ?? 0,
    currency: o.currency ?? 'ARS',
    month: o.month ?? 1,
    year: o.year ?? 2026,
    dueDate: o.dueDate ?? new Date(2026, 0, 1),
    status: o.status ?? 'pending',
    createdAt: o.createdAt ?? new Date(),
  } as ExpensePayment
}

function expense(o: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: o.id ?? 'e1',
    name: o.name ?? 'Luz',
    amount: o.amount ?? 1000,
    currency: o.currency ?? 'ARS',
    category: o.category ?? 'c1',
    frequency: o.frequency ?? 'monthly',
    dueDay: o.dueDay ?? 10,
    isActive: o.isActive ?? true,
    createdAt: o.createdAt ?? new Date(),
  } as RecurringExpense
}

describe('getPreviousValue', () => {
  it('returns the immediately previous month value', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 2, year: 2026, amount: 1500 }),
    ]
    expect(getPreviousValue('e1', 3, 2026, payments)).toEqual({ amount: 1500, currency: 'ARS' })
  })

  it('skips gaps and returns the most recent prior record', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 1, year: 2026, amount: 1000 }),
      pay({ id: 'b', recurringExpenseId: 'e1', month: 4, year: 2026, amount: 2000 }),
    ]
    expect(getPreviousValue('e1', 7, 2026, payments)).toEqual({ amount: 2000, currency: 'ARS' })
  })

  it('crosses year boundaries', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 12, year: 2025, amount: 900 }),
    ]
    expect(getPreviousValue('e1', 1, 2026, payments)).toEqual({ amount: 900, currency: 'ARS' })
  })

  it('ignores other expenses and same/future months', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e2', month: 2, year: 2026, amount: 5000 }),
      pay({ id: 'b', recurringExpenseId: 'e1', month: 3, year: 2026, amount: 5000 }),
    ]
    expect(getPreviousValue('e1', 3, 2026, payments)).toBeNull()
  })

  it('returns null when there is no history', () => {
    expect(getPreviousValue('e1', 3, 2026, [])).toBeNull()
  })

  it('preserves the stored currency', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 2, year: 2026, amount: 50, currency: 'USD' }),
    ]
    expect(getPreviousValue('e1', 3, 2026, payments)).toEqual({ amount: 50, currency: 'USD' })
  })
})

describe('resolveDefaultForMonth', () => {
  it('uses the previous month value when it exists', () => {
    const payments = [pay({ recurringExpenseId: 'e1', month: 2, year: 2026, amount: 1500 })]
    expect(resolveDefaultForMonth(expense({ id: 'e1', amount: 1000 }), 3, 2026, payments))
      .toEqual({ amount: 1500, currency: 'ARS' })
  })

  it('falls back to the expense seed when there is no history', () => {
    expect(resolveDefaultForMonth(expense({ id: 'e1', amount: 1000, currency: 'ARS' }), 3, 2026, []))
      .toEqual({ amount: 1000, currency: 'ARS' })
  })

  it('uses the expense currency in the seed fallback', () => {
    expect(resolveDefaultForMonth(expense({ id: 'e1', amount: 80, currency: 'USD' }), 3, 2026, []))
      .toEqual({ amount: 80, currency: 'USD' })
  })
})

describe('getMonthlyAmountARS', () => {
  it('returns the amount as-is for ARS', () => {
    expect(getMonthlyAmountARS({ amount: 1500, currency: 'ARS' }, 1000)).toBe(1500)
  })

  it('converts USD using the rate', () => {
    expect(getMonthlyAmountARS({ amount: 50, currency: 'USD' }, 1000)).toBe(50000)
  })
})
