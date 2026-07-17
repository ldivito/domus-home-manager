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

// Mock TransactionList component to isolate page tests
vi.mock('../components/TransactionList', () => ({
  TransactionList: vi.fn(() => React.createElement('div', { 'data-testid': 'transaction-list' }, 'TransactionList')),
}))

import TransactionsPage from '../page'

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', () => {
    render(<TransactionsPage />)

    expect(screen.getByText('personalFinance.transactions.title')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.transactions.subtitle')).toBeInTheDocument()
  })

  it('renders quick action buttons (income, expense, transfer, new)', () => {
    render(<TransactionsPage />)

    expect(screen.getByText('personalFinance.transactions.addIncome')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.transactions.addExpense')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.transactions.transfer')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.transactions.newTransaction')).toBeInTheDocument()
  })

  it('quick action links have correct hrefs', () => {
    render(<TransactionsPage />)

    const incomeLink = screen.getByText('personalFinance.transactions.addIncome').closest('a')
    expect(incomeLink).toHaveAttribute('href', '/personal-finance/transactions/new?type=income')

    const expenseLink = screen.getByText('personalFinance.transactions.addExpense').closest('a')
    expect(expenseLink).toHaveAttribute('href', '/personal-finance/transactions/new?type=expense')

    const transferLink = screen.getByText('personalFinance.transactions.transfer').closest('a')
    expect(transferLink).toHaveAttribute('href', '/personal-finance/transactions/new?type=transfer')

    const newLink = screen.getByText('personalFinance.transactions.newTransaction').closest('a')
    expect(newLink).toHaveAttribute('href', '/personal-finance/transactions/new')
  })

  it('renders TransactionList component', () => {
    render(<TransactionsPage />)

    expect(screen.getByTestId('transaction-list')).toBeInTheDocument()
  })
})
