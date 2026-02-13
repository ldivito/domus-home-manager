import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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

const mockUsePathname = vi.fn(() => '/en/personal-finance')

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
    personalWallets: { where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalCategories: { where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalTransactions: { orderBy: vi.fn().mockReturnThis(), reverse: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), where: vi.fn().mockReturnThis(), between: vi.fn().mockReturnThis() },
  },
  getDatabase: vi.fn(),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => undefined),
}))

vi.mock('@/lib/utils/finance', () => ({
  formatCurrency: vi.fn((amount: number, currency: string) => `${currency} ${amount.toLocaleString()}`),
  calculateTotalBalance: vi.fn(() => ({ ARS: 100000, USD: 500 })),
}))

// Mock CreditCardNotifications
vi.mock('../components/CreditCardNotifications', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'credit-card-notifications' }, 'Notifications')),
}))

import PersonalFinancePage from '../page'
import { useLiveQuery } from 'dexie-react-hooks'
import { createMockWallet, createMockCreditCard } from '@/test/factories/wallet.factory'
import { createMockCategory } from '@/test/factories/category.factory'
import { createMockTransaction, createMockIncome } from '@/test/factories/transaction.factory'

const mockUseLiveQuery = useLiveQuery as ReturnType<typeof vi.fn>

describe('PersonalFinancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: all queries return undefined (loading)
    mockUseLiveQuery.mockReturnValue(undefined)
  })

  it('shows loading state when useLiveQuery returns undefined', () => {
    const { container } = render(<PersonalFinancePage />)

    // Loading state shows animate-pulse skeletons
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('shows dashboard with balance cards when data loaded', () => {
    const wallets = [
      createMockWallet({ balance: 50000, currency: 'ARS' }),
      createMockCreditCard({ balance: -10000, currency: 'ARS' }),
    ]
    const categories = [createMockCategory()]
    const recentTxns = [createMockTransaction(), createMockIncome()]
    const monthTxns = [createMockTransaction({ amount: 5000, type: 'expense' }), createMockIncome({ amount: 100000 })]

    mockUseLiveQuery
      .mockReturnValueOnce(wallets)
      .mockReturnValueOnce(categories)
      .mockReturnValueOnce(recentTxns)
      .mockReturnValueOnce(monthTxns)

    render(<PersonalFinancePage />)

    // Balance cards should be rendered
    expect(screen.getByText('Total ARS')).toBeInTheDocument()
    expect(screen.getByText('Total USD')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.wallets.activeWallets')).toBeInTheDocument()
  })

  it('shows empty wallet state when no wallets', () => {
    const wallets: ReturnType<typeof createMockWallet>[] = []
    const categories = [createMockCategory()]
    const recentTxns: ReturnType<typeof createMockTransaction>[] = []
    const monthTxns: ReturnType<typeof createMockTransaction>[] = []

    mockUseLiveQuery
      .mockReturnValueOnce(wallets)
      .mockReturnValueOnce(categories)
      .mockReturnValueOnce(recentTxns)
      .mockReturnValueOnce(monthTxns)

    render(<PersonalFinancePage />)

    expect(screen.getByText('personalFinance.wallets.noWallets')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.wallets.noWalletsHint')).toBeInTheDocument()
  })

  it('shows quick action buttons', () => {
    const wallets = [createMockWallet()]
    const categories = [createMockCategory()]
    const recentTxns: ReturnType<typeof createMockTransaction>[] = []
    const monthTxns: ReturnType<typeof createMockTransaction>[] = []

    mockUseLiveQuery
      .mockReturnValueOnce(wallets)
      .mockReturnValueOnce(categories)
      .mockReturnValueOnce(recentTxns)
      .mockReturnValueOnce(monthTxns)

    render(<PersonalFinancePage />)

    expect(screen.getByText('personalFinance.dashboard.quickActions')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.addExpense')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.addIncome')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.transfer')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.newWallet')).toBeInTheDocument()
  })

  it('shows recent transactions section', () => {
    const wallets = [createMockWallet({ id: 'w1', name: 'Main Wallet' })]
    const categories = [createMockCategory({ id: 'c1', name: 'Food' })]
    const recentTxns = [
      createMockTransaction({
        description: 'Grocery Shopping',
        walletId: 'w1',
        categoryId: 'c1',
        amount: 3500,
        type: 'expense',
      }),
    ]
    const monthTxns = [...recentTxns]

    mockUseLiveQuery
      .mockReturnValueOnce(wallets)
      .mockReturnValueOnce(categories)
      .mockReturnValueOnce(recentTxns)
      .mockReturnValueOnce(monthTxns)

    render(<PersonalFinancePage />)

    expect(screen.getByText('personalFinance.transactions.title')).toBeInTheDocument()
    expect(screen.getByText('Grocery Shopping')).toBeInTheDocument()
  })

  it('renders CreditCardNotifications component', () => {
    const wallets = [createMockWallet()]
    const categories = [createMockCategory()]
    const recentTxns: ReturnType<typeof createMockTransaction>[] = []
    const monthTxns: ReturnType<typeof createMockTransaction>[] = []

    mockUseLiveQuery
      .mockReturnValueOnce(wallets)
      .mockReturnValueOnce(categories)
      .mockReturnValueOnce(recentTxns)
      .mockReturnValueOnce(monthTxns)

    render(<PersonalFinancePage />)

    expect(screen.getByTestId('credit-card-notifications')).toBeInTheDocument()
  })

  it('shows financial health section with monthly stats', () => {
    const wallets = [createMockWallet()]
    const categories = [createMockCategory()]
    const recentTxns: ReturnType<typeof createMockTransaction>[] = []
    const monthTxns = [
      createMockTransaction({ amount: 5000, type: 'expense' }),
      createMockIncome({ amount: 100000 }),
    ]

    mockUseLiveQuery
      .mockReturnValueOnce(wallets)
      .mockReturnValueOnce(categories)
      .mockReturnValueOnce(recentTxns)
      .mockReturnValueOnce(monthTxns)

    render(<PersonalFinancePage />)

    expect(screen.getByText('personalFinance.dashboard.financialHealth')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.monthlyIncome')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.monthlyExpenses')).toBeInTheDocument()
  })

  it('shows insights and reports section', () => {
    const wallets = [createMockWallet()]
    const categories = [createMockCategory()]
    const recentTxns: ReturnType<typeof createMockTransaction>[] = []
    const monthTxns: ReturnType<typeof createMockTransaction>[] = []

    mockUseLiveQuery
      .mockReturnValueOnce(wallets)
      .mockReturnValueOnce(categories)
      .mockReturnValueOnce(recentTxns)
      .mockReturnValueOnce(monthTxns)

    render(<PersonalFinancePage />)

    expect(screen.getByText('personalFinance.dashboard.insightsReports')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.viewAnalytics')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.expenseBreakdown')).toBeInTheDocument()
  })
})
