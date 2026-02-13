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

const mockUsePathname = vi.fn(() => '/en/personal-finance/wallets')

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
    personalWallets: { get: vi.fn(), put: vi.fn(), add: vi.fn().mockResolvedValue(undefined), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
    personalCategories: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalTransactions: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
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
  validateWallet: vi.fn(() => ({ isValid: true, errors: {} })),
  generateWalletId: vi.fn(() => 'pw_mock_1'),
  generateWalletColor: vi.fn(() => '#10b981'),
}))

import { CreateWalletDialog } from '../CreateWalletDialog'

describe('CreateWalletDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the trigger element', () => {
    render(
      <CreateWalletDialog
        trigger={<button data-testid="trigger-btn">Add Wallet</button>}
      />
    )

    expect(screen.getByTestId('trigger-btn')).toBeInTheDocument()
    expect(screen.getByText('Add Wallet')).toBeInTheDocument()
  })

  it('renders dialog content when open prop is true', () => {
    render(
      <CreateWalletDialog open={true} onOpenChange={vi.fn()} />
    )

    expect(screen.getByText('personalFinance.walletForm.createTitle')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletForm.createDescription')).toBeInTheDocument()
  })

  it('shows wallet name input field', () => {
    render(
      <CreateWalletDialog open={true} onOpenChange={vi.fn()} />
    )

    expect(screen.getByText('personalFinance.walletForm.walletName')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('personalFinance.walletForm.walletNamePlaceholder')).toBeInTheDocument()
  })

  it('shows type selector with physical, bank, credit_card options', () => {
    render(
      <CreateWalletDialog open={true} onOpenChange={vi.fn()} />
    )

    expect(screen.getByText('personalFinance.walletForm.type')).toBeInTheDocument()
    // The select options may appear in both the trigger and the hidden select, use getAllByText
    expect(screen.getAllByText('personalFinance.walletForm.typePhysical').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('personalFinance.walletForm.typeBank').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('personalFinance.walletForm.typeCreditCard').length).toBeGreaterThanOrEqual(1)
  })

  it('shows currency selector', () => {
    render(
      <CreateWalletDialog open={true} onOpenChange={vi.fn()} />
    )

    expect(screen.getByText('personalFinance.walletForm.currency')).toBeInTheDocument()
    // Currency options may be duplicated across trigger display and hidden options
    expect(screen.getAllByText('personalFinance.walletForm.currencyARS').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('personalFinance.walletForm.currencyUSD').length).toBeGreaterThanOrEqual(1)
  })

  it('renders submit and cancel buttons', () => {
    render(
      <CreateWalletDialog open={true} onOpenChange={vi.fn()} />
    )

    expect(screen.getByText('personalFinance.walletForm.createWallet')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletForm.cancel')).toBeInTheDocument()
  })

  it('shows appearance section with color options', () => {
    render(
      <CreateWalletDialog open={true} onOpenChange={vi.fn()} />
    )

    expect(screen.getByText('personalFinance.walletForm.appearance')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletForm.color')).toBeInTheDocument()
  })

  it('shows preview section', () => {
    render(
      <CreateWalletDialog open={true} onOpenChange={vi.fn()} />
    )

    expect(screen.getByText('personalFinance.walletForm.preview')).toBeInTheDocument()
  })
})
