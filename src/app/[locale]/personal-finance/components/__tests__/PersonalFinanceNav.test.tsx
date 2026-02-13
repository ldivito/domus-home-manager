import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next-intl — inline because require('@/...') doesn't resolve in vi.mock factory
vi.mock('next-intl', () => ({
  useTranslations: vi.fn((ns: string) => {
    const t = (key: string) => `${ns}.${key}`
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

import PersonalFinanceNav from '../PersonalFinanceNav'

describe('PersonalFinanceNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue('/en/personal-finance')
  })

  it('renders all navigation links', () => {
    render(<PersonalFinanceNav />)

    expect(screen.getByText('personalFinance.navigation.dashboard')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.navigation.wallets')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.navigation.transactions')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.navigation.categories')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.navigation.analytics')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.title')).toBeInTheDocument()
  })

  it('renders correct hrefs for nav links', () => {
    render(<PersonalFinanceNav />)

    expect(screen.getByText('personalFinance.navigation.dashboard').closest('a'))
      .toHaveAttribute('href', '/personal-finance')
    expect(screen.getByText('personalFinance.navigation.wallets').closest('a'))
      .toHaveAttribute('href', '/personal-finance/wallets')
    expect(screen.getByText('personalFinance.navigation.transactions').closest('a'))
      .toHaveAttribute('href', '/personal-finance/transactions')
    expect(screen.getByText('personalFinance.navigation.categories').closest('a'))
      .toHaveAttribute('href', '/personal-finance/categories')
    expect(screen.getByText('personalFinance.navigation.analytics').closest('a'))
      .toHaveAttribute('href', '/personal-finance/analytics')
    expect(screen.getByText('personalFinance.settings.title').closest('a'))
      .toHaveAttribute('href', '/personal-finance/settings')
  })

  it('renders quick action buttons', () => {
    render(<PersonalFinanceNav />)

    expect(screen.getByText('personalFinance.dashboard.addExpense')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.addIncome')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.dashboard.newWallet')).toBeInTheDocument()
  })

  it('renders correct hrefs for quick actions', () => {
    render(<PersonalFinanceNav />)

    expect(screen.getByText('personalFinance.dashboard.addExpense').closest('a'))
      .toHaveAttribute('href', '/personal-finance/transactions/new?type=expense')
    expect(screen.getByText('personalFinance.dashboard.addIncome').closest('a'))
      .toHaveAttribute('href', '/personal-finance/transactions/new?type=income')
    expect(screen.getByText('personalFinance.dashboard.newWallet').closest('a'))
      .toHaveAttribute('href', '/personal-finance/wallets/new')
  })
})
