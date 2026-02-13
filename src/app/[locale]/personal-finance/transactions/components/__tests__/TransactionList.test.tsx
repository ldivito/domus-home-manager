import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn((ns: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params) return `${ns}.${key}:${JSON.stringify(params)}`
      return `${ns}.${key}`
    }
    t.rich = (key: string) => `${ns}.${key}`
    t.raw = (key: string) => `${ns}.${key}`
    t.has = () => true
    return t
  }),
  useLocale: vi.fn(() => 'en'),
}))

const mockUsePathname = vi.fn(() => '/en/personal-finance/transactions')

vi.mock('@/i18n/navigation', () => ({
  Link: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
    function MockLink({ href, children, ...props }, ref) {
      return React.createElement('a', { href, ref, ...props }, children)
    }
  ),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  usePathname: () => mockUsePathname(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/db', () => ({
  db: {
    personalWallets: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
    personalCategories: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalTransactions: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
  },
  getDatabase: vi.fn(),
  deleteWithSync: vi.fn().mockResolvedValue(undefined),
}))

// Track useLiveQuery calls by the callback content to distinguish which table is being queried
let liveQueryResults: { transactions: unknown[] | undefined; wallets: unknown[] | undefined; categories: unknown[] | undefined } = {
  transactions: undefined,
  wallets: undefined,
  categories: undefined,
}

const mockUseLiveQuery = vi.fn()
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (...args: any[]) => mockUseLiveQuery(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

vi.mock('@/lib/utils/finance', () => ({
  formatCurrency: vi.fn((amount: number, currency: string) => `${currency} ${amount.toLocaleString()}`),
  formatBalance: vi.fn((balance: number, currency: string) => ({
    formatted: `${currency} ${Math.abs(balance).toLocaleString()}`,
    colorClass: balance >= 0 ? 'text-green-600' : 'text-red-600',
    isNegative: balance < 0,
  })),
  formatTransactionAmount: vi.fn((amount: number, type: string, currency: string) => ({
    formatted: `${type === 'income' ? '+' : '-'}${currency} ${amount}`,
    colorClass: type === 'income' ? 'text-green-600' : 'text-red-600',
    prefix: type === 'income' ? '+' : '-',
  })),
  calculateAvailableCredit: vi.fn((limit: number, balance: number) => Math.max(0, limit - balance)),
  calculateTotalBalance: vi.fn(() => ({ ARS: 100000, USD: 500 })),
  sortTransactionsByDate: vi.fn((txns: unknown[]) => txns),
  filterTransactionsByDateRange: vi.fn((txns: unknown[]) => txns),
  getCurrentMonthRange: vi.fn(() => ({ start: new Date(2025, 0, 1), end: new Date(2025, 0, 31) })),
  getLastNMonthsRange: vi.fn(() => ({ start: new Date(2024, 10, 1), end: new Date(2025, 0, 31) })),
  reverseTransactionBalanceUpdate: vi.fn(),
  validateTransaction: vi.fn(() => ({ isValid: true, errors: {} })),
}))

import { TransactionList } from '../TransactionList'
import { createMockTransaction, createMockIncome } from '@/test/factories/transaction.factory'
import { createMockWallet } from '@/test/factories/wallet.factory'
import { createMockCategory, createMockIncomeCategory } from '@/test/factories/category.factory'

describe('TransactionList', () => {
  const mockWallets = [
    createMockWallet({ id: 'pw_1', name: 'Cash', color: '#10b981' }),
    createMockWallet({ id: 'pw_2', name: 'Bank', color: '#3b82f6', type: 'bank' }),
  ]

  const mockCategories = [
    createMockCategory({ id: 'pc_1', name: 'Food', color: '#ef4444' }),
    createMockIncomeCategory({ id: 'pc_2', name: 'Salary', color: '#22c55e' }),
  ]

  const mockTransactions = [
    createMockTransaction({
      id: 'pt_1',
      description: 'Grocery shopping',
      amount: 5000,
      currency: 'ARS',
      type: 'expense',
      walletId: 'pw_1',
      categoryId: 'pc_1',
      date: new Date('2025-01-15'),
    }),
    createMockIncome({
      id: 'pt_2',
      description: 'Monthly salary',
      amount: 100000,
      currency: 'ARS',
      type: 'income',
      walletId: 'pw_2',
      categoryId: 'pc_2',
      date: new Date('2025-01-01'),
    }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLiveQuery.mockReset()
    liveQueryResults = {
      transactions: undefined,
      wallets: undefined,
      categories: undefined,
    }
  })

  /**
   * The TransactionList component calls useLiveQuery 3 times in order:
   * 1. rawTransactions (db.personalTransactions.toArray)
   * 2. wallets (db.personalWallets.where...)
   * 3. categories (db.personalCategories.where...)
   *
   * We use call counting that resets every 3 calls to handle re-renders.
   */
  function setupLiveQuery(
    transactions: unknown[] | undefined,
    wallets: unknown[] | undefined,
    categories: unknown[] | undefined
  ) {
    let callIndex = 0
    mockUseLiveQuery.mockImplementation(() => {
      const index = callIndex % 3
      callIndex++
      if (index === 0) return transactions
      if (index === 1) return wallets
      return categories
    })
  }

  it('shows loading state when data is not loaded', () => {
    setupLiveQuery(undefined, undefined, undefined)

    render(<TransactionList />)

    // Loading state renders skeleton cards with animate-pulse
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows loading state when only transactions are loaded', () => {
    setupLiveQuery(mockTransactions, undefined, undefined)

    render(<TransactionList />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders transactions with description when all data is loaded', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText('Grocery shopping')).toBeInTheDocument()
    expect(screen.getByText('Monthly salary')).toBeInTheDocument()
  })

  it('renders transaction amounts', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText('-ARS 5000')).toBeInTheDocument()
    expect(screen.getByText('+ARS 100000')).toBeInTheDocument()
  })

  it('renders filter header with title', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText('personalFinance.transactionList.filters')).toBeInTheDocument()
  })

  it('shows empty state when no transactions match', () => {
    setupLiveQuery([], mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText('personalFinance.transactions.noTransactions')).toBeInTheDocument()
  })

  it('shows show/hide filters button', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText('personalFinance.transactionList.showFilters')).toBeInTheDocument()
  })

  it('toggles filter panel visibility', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    const toggleBtn = screen.getByText('personalFinance.transactionList.showFilters')
    fireEvent.click(toggleBtn)

    // After toggle, the search input should be visible
    expect(screen.getByPlaceholderText('personalFinance.transactionList.searchPlaceholder')).toBeInTheDocument()
  })

  it('shows type filter in expanded filters', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    // Open filters
    fireEvent.click(screen.getByText('personalFinance.transactionList.showFilters'))

    expect(screen.getByText('personalFinance.transactionList.type')).toBeInTheDocument()
  })

  it('shows transaction count in summary', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText('personalFinance.transactions.showingCount:{"count":2}')).toBeInTheDocument()
  })

  it('shows income and expense labels in summary', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText(/personalFinance\.transactions\.incomeLabel/)).toBeInTheDocument()
    expect(screen.getByText(/personalFinance\.transactions\.expensesLabel/)).toBeInTheDocument()
  })

  it('renders transaction type badges', () => {
    setupLiveQuery(mockTransactions, mockWallets, mockCategories)

    render(<TransactionList />)

    expect(screen.getByText('expense')).toBeInTheDocument()
    expect(screen.getByText('income')).toBeInTheDocument()
  })
})
