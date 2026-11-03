import { describe, it, expect } from 'vitest'
import { getInstallmentInfo } from '../installments'
import { computeWalletBalance, statementIdFor } from '../balance-math'

describe('getInstallmentInfo', () => {
  it('computes what is left after this installment', () => {
    expect(getInstallmentInfo({ amount: 1000, installmentNumber: 3, installmentCount: 12 })).toEqual({
      number: 3, count: 12, remainingCount: 9, remainingAmount: 9000, totalAmount: 12000
    })
  })

  it('prefers the stored original total', () => {
    expect(getInstallmentInfo({ amount: 333.33, installmentNumber: 1, installmentCount: 3, originalTotalAmount: 1000 })?.totalAmount).toBe(1000)
  })

  it('returns null for non-installments and inconsistent data', () => {
    expect(getInstallmentInfo({ amount: 100 })).toBeNull()
    expect(getInstallmentInfo({ amount: 100, installmentNumber: 1, installmentCount: 1 })).toBeNull()
    expect(getInstallmentInfo({ amount: 100, installmentNumber: 4, installmentCount: 3 })).toBeNull()
  })
})

describe('computeWalletBalance', () => {
  const currencies: Record<string, string> = { ars: 'ARS', usd: 'USD', ars2: 'ARS' }
  const currencyOf = (id: string) => currencies[id]

  it('applies opening balance, refunds, transfers and skips cancelled or older transactions', () => {
    const balance = computeWalletBalance(
      { id: 'ars', openingBalance: 1000, openingBalanceDate: '2026-10-01T00:00:00Z' },
      [
        { type: 'income', amount: 500, walletId: 'ars', status: 'completed', date: '2026-09-30T12:00:00Z' }, // before opening
        { type: 'expense', amount: 200, walletId: 'ars', status: 'completed', date: '2026-10-02T12:00:00Z' },
        { type: 'refund', amount: 50, walletId: 'ars', status: 'completed', date: '2026-10-03T12:00:00Z' },
        { type: 'expense', amount: 999, walletId: 'ars', status: 'cancelled', date: '2026-10-03T12:00:00Z' },
        { type: 'transfer', amount: 10, walletId: 'usd', targetWalletId: 'ars', exchangeRate: 1200, status: 'completed', date: '2026-10-04T12:00:00Z' },
        { type: 'transfer', amount: 100, walletId: 'ars2', targetWalletId: 'ars', exchangeRate: 1200, status: 'completed', date: '2026-10-04T12:00:00Z' },
        { type: 'transfer', amount: 30, walletId: 'ars', targetWalletId: 'ars2', status: 'completed', date: '2026-10-05T12:00:00Z' }
      ],
      currencyOf
    )
    // 1000 - 200 + 50 + 10*1200 (cross-currency) + 100 (same currency: no rate) - 30
    expect(balance).toBe(12920)
  })
})

describe('statementIdFor', () => {
  it('is stable per card and closing month', () => {
    expect(statementIdFor('pw_visa', new Date(2026, 9, 29))).toBe('ccs_pw_visa_2026-10')
    expect(statementIdFor('pw_visa', new Date(2026, 9, 1))).toBe(statementIdFor('pw_visa', new Date(2026, 9, 29)))
  })
})
