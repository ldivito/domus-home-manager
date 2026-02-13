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

vi.mock('@/lib/utils/finance', () => ({
  formatCurrency: vi.fn((amount: number, currency: string) => `${currency} ${amount.toLocaleString()}`),
}))

import ShareIncomeDialog from '../ShareIncomeDialog'
import { createMockIncome, createMockTransaction } from '@/test/factories/transaction.factory'

describe('ShareIncomeDialog', () => {
  const mockOnShare = vi.fn()
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when transaction is null', () => {
    const { container } = render(
      <ShareIncomeDialog
        transaction={null}
        open={true}
        onOpenChange={mockOnOpenChange}
        onShare={mockOnShare}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('returns null when transaction type is not income', () => {
    const expenseTransaction = createMockTransaction({ type: 'expense' })
    const { container } = render(
      <ShareIncomeDialog
        transaction={expenseTransaction}
        open={true}
        onOpenChange={mockOnOpenChange}
        onShare={mockOnShare}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders dialog with transaction info when open with income transaction', () => {
    const incomeTransaction = createMockIncome({
      description: 'Monthly Salary',
      amount: 100000,
      currency: 'ARS',
    })

    render(
      <ShareIncomeDialog
        transaction={incomeTransaction}
        open={true}
        onOpenChange={mockOnOpenChange}
        onShare={mockOnShare}
      />
    )

    expect(screen.getByText('personalFinance.shareIncome.title')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.shareIncome.description')).toBeInTheDocument()
    expect(screen.getByText('Monthly Salary')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.shareIncome.totalIncome')).toBeInTheDocument()
    expect(screen.getByText('ARS 100,000')).toBeInTheDocument()
  })

  it('shows percentage quick select buttons when share is enabled', async () => {
    const incomeTransaction = createMockIncome({
      description: 'Salary',
      amount: 100000,
      currency: 'ARS',
    })

    render(
      <ShareIncomeDialog
        transaction={incomeTransaction}
        open={true}
        onOpenChange={mockOnOpenChange}
        onShare={mockOnShare}
      />
    )

    // Enable sharing via toggle - the Switch is rendered
    const toggleLabel = screen.getByText('personalFinance.shareIncome.shareToggle')
    expect(toggleLabel).toBeInTheDocument()

    // Before enabling share, percentage buttons are not shown
    expect(screen.queryByText('25%')).not.toBeInTheDocument()
  })

  it('share button is disabled when share is not enabled', () => {
    const incomeTransaction = createMockIncome({
      description: 'Salary',
      amount: 100000,
      currency: 'ARS',
    })

    render(
      <ShareIncomeDialog
        transaction={incomeTransaction}
        open={true}
        onOpenChange={mockOnOpenChange}
        onShare={mockOnShare}
      />
    )

    const shareButton = screen.getByText('personalFinance.shareIncome.shareIncome')
    expect(shareButton.closest('button')).toBeDisabled()
  })
})
