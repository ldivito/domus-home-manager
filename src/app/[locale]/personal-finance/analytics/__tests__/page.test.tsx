import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

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

const mockUsePathname = vi.fn(() => '/en/personal-finance/analytics')

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
    personalWallets: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalCategories: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalTransactions: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnValue({ between: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }), toArray: vi.fn().mockResolvedValue([]) },
  },
  getDatabase: vi.fn(),
  deleteWithSync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => undefined),
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
}))

// Mock all analytics sub-components
vi.mock('../components/ExpenseChart', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'expense-chart' }, 'ExpenseChart')),
}))
vi.mock('../components/IncomeChart', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'income-chart' }, 'IncomeChart')),
}))
vi.mock('../components/MonthlyOverview', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'monthly-overview' }, 'MonthlyOverview')),
}))
vi.mock('../components/CategoryBreakdown', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'category-breakdown' }, 'CategoryBreakdown')),
}))
vi.mock('../components/FinancialTrends', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'financial-trends' }, 'FinancialTrends')),
}))
vi.mock('../components/DataExportDialog', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'data-export-dialog' }, 'DataExportDialog')),
}))

import AnalyticsPage from '../page'

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    render(<AnalyticsPage />)

    // Loading state shows skeleton cards with animate-pulse
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders chart components when data is loaded', async () => {
    render(<AnalyticsPage />)

    // Wait for async data loading to complete (useEffect + loadAnalyticsData)
    await waitFor(() => {
      expect(screen.getByTestId('financial-trends')).toBeInTheDocument()
    })

    expect(screen.getByTestId('expense-chart')).toBeInTheDocument()
    expect(screen.getByTestId('income-chart')).toBeInTheDocument()
    expect(screen.getByTestId('monthly-overview')).toBeInTheDocument()
    expect(screen.getByTestId('category-breakdown')).toBeInTheDocument()
    expect(screen.getByTestId('data-export-dialog')).toBeInTheDocument()
  })

  it('renders time range selector after loading', async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('financial-trends')).toBeInTheDocument()
    })

    // The time range options are rendered as select items
    expect(screen.getByText('personalFinance.analytics.timeRanges.last30days')).toBeInTheDocument()
  })

  it('renders currency filter and export button after loading', async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('financial-trends')).toBeInTheDocument()
    })

    // Currency filter shows "ALL" by default
    expect(screen.getByText('personalFinance.analytics.allCurrencies')).toBeInTheDocument()
    // Export button
    expect(screen.getByText('personalFinance.analytics.exportData')).toBeInTheDocument()
  })
})
