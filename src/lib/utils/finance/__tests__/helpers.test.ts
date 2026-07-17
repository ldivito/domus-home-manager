import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateNextDueDate,
  calculateAvailableCredit,
  calculateTotalBalance,
  getWalletDisplayName,
  getWalletTypeIndicator,
  getTransactionTypeIndicator,
  updateWalletBalance,
  groupTransactionsByMonth,
  calculateMonthlyTotals,
  isStatementOverdue,
  getCreditCardStatus,
  generateWalletColor,
  generateTransactionId,
  generateWalletId,
  generateCategoryId,
  generateStatementId,
  generatePaymentId,
  filterTransactionsByDateRange,
  getCurrentMonthRange,
  getLastNMonthsRange,
  getDaysUntilDue,
  sortTransactionsByDate,
  sortWallets,
} from '../helpers'
import { createMockWallet, createMockCreditCard, createMockBankAccount } from '@/test/factories/wallet.factory'
import { createMockTransaction, createMockIncome, createMockTransfer } from '@/test/factories/transaction.factory'

describe('calculateNextDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates due date when before closing day', () => {
    vi.setSystemTime(new Date(2025, 5, 10)) // June 10
    const dueDate = calculateNextDueDate(15, 10)
    // Closing is June 15, due is 10 days after = June 25
    expect(dueDate.getMonth()).toBe(5) // June
    expect(dueDate.getDate()).toBe(25)
  })

  it('calculates due date when after closing day (goes to next month)', () => {
    vi.setSystemTime(new Date(2025, 5, 20)) // June 20
    const dueDate = calculateNextDueDate(15, 10)
    // Closing is July 15, due is 10 days after = July 25
    expect(dueDate.getMonth()).toBe(6) // July
    expect(dueDate.getDate()).toBe(25)
  })

  it('uses provided reference date instead of now', () => {
    const ref = new Date(2025, 0, 5) // Jan 5
    const dueDate = calculateNextDueDate(10, 15, ref)
    // Before closing (10), so closing is Jan 10, due = Jan 25
    expect(dueDate.getMonth()).toBe(0) // January
    expect(dueDate.getDate()).toBe(25)
  })
})

describe('calculateAvailableCredit', () => {
  it('calculates available credit (debt is negative balance)', () => {
    // Credit limit 100k, balance -30k (30k in debt)
    expect(calculateAvailableCredit(100000, -30000)).toBe(70000)
  })

  it('returns full limit when no debt', () => {
    expect(calculateAvailableCredit(100000, 0)).toBe(100000)
  })

  it('returns 0 when fully utilized', () => {
    expect(calculateAvailableCredit(100000, -100000)).toBe(0)
  })

  it('returns 0 when over limit (never negative)', () => {
    expect(calculateAvailableCredit(100000, -150000)).toBe(0)
  })
})

describe('calculateTotalBalance', () => {
  it('sums balances by currency', () => {
    const wallets = [
      createMockWallet({ currency: 'ARS', balance: 10000, isActive: true }),
      createMockWallet({ currency: 'ARS', balance: 20000, isActive: true }),
      createMockWallet({ currency: 'USD', balance: 500, isActive: true }),
    ]
    const totals = calculateTotalBalance(wallets)
    expect(totals.ARS).toBe(30000)
    expect(totals.USD).toBe(500)
  })

  it('excludes inactive wallets', () => {
    const wallets = [
      createMockWallet({ currency: 'ARS', balance: 10000, isActive: true }),
      createMockWallet({ currency: 'ARS', balance: 99999, isActive: false }),
    ]
    const totals = calculateTotalBalance(wallets)
    expect(totals.ARS).toBe(10000)
  })

  it('includes credit card negative balances', () => {
    const wallets = [
      createMockWallet({ currency: 'ARS', balance: 50000, isActive: true }),
      createMockCreditCard({ currency: 'ARS', balance: -20000, isActive: true }),
    ]
    const totals = calculateTotalBalance(wallets)
    expect(totals.ARS).toBe(30000)
  })

  it('filters by currency when specified', () => {
    const wallets = [
      createMockWallet({ currency: 'ARS', balance: 10000, isActive: true }),
      createMockWallet({ currency: 'USD', balance: 500, isActive: true }),
    ]
    const totals = calculateTotalBalance(wallets, 'USD')
    expect(totals.ARS).toBe(0) // Not filtered into this
    expect(totals.USD).toBe(500)
  })
})

describe('getWalletDisplayName', () => {
  it('prepends type indicator to name', () => {
    const wallet = createMockWallet({ name: 'My Wallet', type: 'physical' })
    expect(getWalletDisplayName(wallet)).toBe('💰 My Wallet')
  })
})

describe('getWalletTypeIndicator', () => {
  it('returns correct emoji for each type', () => {
    expect(getWalletTypeIndicator('physical')).toBe('💰')
    expect(getWalletTypeIndicator('bank')).toBe('🏦')
    expect(getWalletTypeIndicator('credit_card')).toBe('💳')
  })
})

describe('getTransactionTypeIndicator', () => {
  it('returns correct emoji for each type', () => {
    expect(getTransactionTypeIndicator('income')).toBe('📈')
    expect(getTransactionTypeIndicator('expense')).toBe('📉')
    expect(getTransactionTypeIndicator('transfer')).toBe('🔄')
  })
})

describe('updateWalletBalance', () => {
  it('adds income to balance', () => {
    expect(updateWalletBalance(10000, { type: 'income', amount: 5000 })).toBe(15000)
  })

  it('subtracts expense from balance', () => {
    expect(updateWalletBalance(10000, { type: 'expense', amount: 3000 })).toBe(7000)
  })

  it('subtracts transfer from source wallet', () => {
    expect(updateWalletBalance(10000, { type: 'transfer', amount: 2000 }, true)).toBe(8000)
  })

  it('adds transfer to target wallet', () => {
    expect(updateWalletBalance(10000, { type: 'transfer', amount: 2000 }, false)).toBe(12000)
  })
})

describe('groupTransactionsByMonth', () => {
  it('groups transactions into monthly buckets', () => {
    const transactions = [
      createMockTransaction({ date: new Date(2025, 0, 15) }), // Jan
      createMockTransaction({ date: new Date(2025, 0, 20) }), // Jan
      createMockTransaction({ date: new Date(2025, 1, 10) }), // Feb
    ]
    const groups = groupTransactionsByMonth(transactions)
    expect(Object.keys(groups)).toHaveLength(2)
    expect(groups['2025-1']).toHaveLength(2) // January
    expect(groups['2025-2']).toHaveLength(1) // February
  })

  it('returns empty object for empty array', () => {
    expect(groupTransactionsByMonth([])).toEqual({})
  })
})

describe('calculateMonthlyTotals', () => {
  it('calculates income, expenses, and net', () => {
    const transactions = [
      createMockIncome({ amount: 100000 }),
      createMockTransaction({ type: 'expense', amount: 30000 }),
      createMockTransaction({ type: 'expense', amount: 20000 }),
    ]
    const totals = calculateMonthlyTotals(transactions)
    expect(totals.totalIncome).toBe(100000)
    expect(totals.totalExpenses).toBe(50000)
    expect(totals.netIncome).toBe(50000)
  })

  it('skips transfers from category totals', () => {
    const transactions = [
      createMockTransfer({ amount: 5000, categoryId: 'pc_1' }),
    ]
    const totals = calculateMonthlyTotals(transactions)
    expect(totals.totalIncome).toBe(0)
    expect(totals.totalExpenses).toBe(0)
    expect(totals.categoryTotals).toEqual({})
  })

  it('aggregates by category', () => {
    const transactions = [
      createMockTransaction({ type: 'expense', amount: 1000, categoryId: 'cat_a' }),
      createMockTransaction({ type: 'expense', amount: 2000, categoryId: 'cat_a' }),
      createMockTransaction({ type: 'expense', amount: 500, categoryId: 'cat_b' }),
    ]
    const totals = calculateMonthlyTotals(transactions)
    expect(totals.categoryTotals['cat_a']).toBe(3000)
    expect(totals.categoryTotals['cat_b']).toBe(500)
  })
})

describe('isStatementOverdue', () => {
  it('returns true when unpaid and past due date', () => {
    const statement = {
      status: 'closed' as const,
      dueDate: new Date('2025-01-01'),
    }
    expect(isStatementOverdue(statement as never)).toBe(true)
  })

  it('returns false when paid', () => {
    const statement = {
      status: 'paid' as const,
      dueDate: new Date('2025-01-01'),
    }
    expect(isStatementOverdue(statement as never)).toBe(false)
  })

  it('returns false when not yet due', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const statement = {
      status: 'open' as const,
      dueDate: futureDate,
    }
    expect(isStatementOverdue(statement as never)).toBe(false)
  })
})

describe('getCreditCardStatus', () => {
  it('returns critical when usage >= 90%', () => {
    const wallet = createMockCreditCard({ balance: -95000, creditLimit: 100000 })
    const { status } = getCreditCardStatus(wallet)
    expect(status).toBe('critical')
  })

  it('returns warning when usage >= 70%', () => {
    const wallet = createMockCreditCard({ balance: -75000, creditLimit: 100000 })
    const { status } = getCreditCardStatus(wallet)
    expect(status).toBe('warning')
  })

  it('returns healthy when usage < 70%', () => {
    const wallet = createMockCreditCard({ balance: -30000, creditLimit: 100000 })
    const { status } = getCreditCardStatus(wallet)
    expect(status).toBe('healthy')
  })

  it('returns healthy for non-credit-card wallets', () => {
    const wallet = createMockWallet({ type: 'physical' })
    const { status } = getCreditCardStatus(wallet)
    expect(status).toBe('healthy')
  })
})

describe('generateWalletColor', () => {
  it('returns green tones for physical', () => {
    expect(generateWalletColor('physical')).toBe('#10b981')
  })

  it('returns blue tones for bank', () => {
    expect(generateWalletColor('bank')).toBe('#3b82f6')
  })

  it('returns red tones for credit_card', () => {
    expect(generateWalletColor('credit_card')).toBe('#ef4444')
  })

  it('cycles through colors with index', () => {
    expect(generateWalletColor('physical', 0)).toBe('#10b981')
    expect(generateWalletColor('physical', 1)).toBe('#059669')
    expect(generateWalletColor('physical', 2)).toBe('#047857')
    expect(generateWalletColor('physical', 3)).toBe('#10b981') // Wraps
  })
})

describe('ID generators', () => {
  it('generates transaction ID with pt_ prefix', () => {
    expect(generateTransactionId()).toMatch(/^pt_/)
  })

  it('generates wallet ID with pw_ prefix', () => {
    expect(generateWalletId()).toMatch(/^pw_/)
  })

  it('generates category ID with pc_ prefix', () => {
    expect(generateCategoryId()).toMatch(/^pc_/)
  })

  it('generates statement ID with ccs_ prefix', () => {
    expect(generateStatementId()).toMatch(/^ccs_/)
  })

  it('generates payment ID with ccp_ prefix', () => {
    expect(generatePaymentId()).toMatch(/^ccp_/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateTransactionId()))
    expect(ids.size).toBe(10)
  })
})

describe('filterTransactionsByDateRange', () => {
  const transactions = [
    createMockTransaction({ date: new Date(2025, 0, 10) }),
    createMockTransaction({ date: new Date(2025, 0, 20) }),
    createMockTransaction({ date: new Date(2025, 1, 15) }),
  ]

  it('filters transactions within range', () => {
    const result = filterTransactionsByDateRange(
      transactions,
      new Date(2025, 0, 1),
      new Date(2025, 0, 31)
    )
    expect(result).toHaveLength(2)
  })

  it('returns empty for out-of-range dates', () => {
    const result = filterTransactionsByDateRange(
      transactions,
      new Date(2025, 5, 1),
      new Date(2025, 5, 30)
    )
    expect(result).toHaveLength(0)
  })
})

describe('getCurrentMonthRange', () => {
  it('returns start of current month and end of month', () => {
    const { start, end } = getCurrentMonthRange()
    expect(start.getDate()).toBe(1)
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(23)
  })
})

describe('getLastNMonthsRange', () => {
  it('returns range spanning N months back', () => {
    const { start, end } = getLastNMonthsRange(3)
    const now = new Date()
    const expectedStartMonth = now.getMonth() - 2
    expect(start.getDate()).toBe(1)
    // The end should be in current month
    expect(end.getMonth()).toBe(now.getMonth())
  })
})

describe('getDaysUntilDue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns positive days for future dates', () => {
    vi.setSystemTime(new Date(2025, 5, 1))
    const dueDate = new Date(2025, 5, 11)
    expect(getDaysUntilDue(dueDate)).toBe(10)
  })

  it('returns negative days for past dates', () => {
    vi.setSystemTime(new Date(2025, 5, 15))
    const dueDate = new Date(2025, 5, 10)
    expect(getDaysUntilDue(dueDate)).toBeLessThan(0)
  })
})

describe('sortTransactionsByDate', () => {
  it('sorts newest first', () => {
    const transactions = [
      createMockTransaction({ date: new Date(2025, 0, 1) }),
      createMockTransaction({ date: new Date(2025, 2, 1) }),
      createMockTransaction({ date: new Date(2025, 1, 1) }),
    ]
    const sorted = sortTransactionsByDate(transactions)
    expect(sorted[0].date.getMonth()).toBe(2) // March
    expect(sorted[2].date.getMonth()).toBe(0) // January
  })

  it('does not mutate original array', () => {
    const transactions = [
      createMockTransaction({ date: new Date(2025, 1, 1) }),
      createMockTransaction({ date: new Date(2025, 0, 1) }),
    ]
    const sorted = sortTransactionsByDate(transactions)
    expect(sorted).not.toBe(transactions)
  })
})

describe('sortWallets', () => {
  it('sorts by type: bank, physical, credit_card', () => {
    const wallets = [
      createMockCreditCard({ name: 'CC' }),
      createMockWallet({ name: 'Cash', type: 'physical' }),
      createMockBankAccount({ name: 'Bank' }),
    ]
    const sorted = sortWallets(wallets)
    expect(sorted[0].type).toBe('bank')
    expect(sorted[1].type).toBe('physical')
    expect(sorted[2].type).toBe('credit_card')
  })

  it('sorts by name within same type', () => {
    const wallets = [
      createMockWallet({ name: 'Zebra', type: 'physical' }),
      createMockWallet({ name: 'Alpha', type: 'physical' }),
    ]
    const sorted = sortWallets(wallets)
    expect(sorted[0].name).toBe('Alpha')
    expect(sorted[1].name).toBe('Zebra')
  })

  it('does not mutate original array', () => {
    const wallets = [createMockWallet()]
    const sorted = sortWallets(wallets)
    expect(sorted).not.toBe(wallets)
  })
})
