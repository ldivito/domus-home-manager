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
    personalWallets: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), update: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
    personalCategories: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalTransactions: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
  },
  getDatabase: vi.fn(),
  deleteWithSync: vi.fn().mockResolvedValue(undefined),
}))

const mockUseLiveQuery = vi.fn(() => undefined)
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (...args: any[]) => (mockUseLiveQuery as any)(...args),
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
  calculateTotalBalance: vi.fn(() => ({ ARS: 100000, USD: 500 })),
}))

// Mock child components
vi.mock('../components/WalletCard', () => ({
  WalletCard: vi.fn(({ wallet }: { wallet: { name: string } }) =>
    React.createElement('div', { 'data-testid': `wallet-card-${wallet.name}` }, wallet.name)
  ),
}))
vi.mock('../components/CreateWalletDialog', () => ({
  CreateWalletDialog: vi.fn(({ trigger }: { trigger: React.ReactNode }) => trigger || null),
}))
vi.mock('../components/EditWalletDialog', () => ({
  EditWalletDialog: vi.fn(() => null),
}))

import WalletsPage from '../page'
import { createMockWallet, createMockBankAccount } from '@/test/factories/wallet.factory'

describe('WalletsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLiveQuery.mockReset()
  })

  it('shows loading state when useLiveQuery returns undefined', () => {
    mockUseLiveQuery.mockReturnValue(undefined)

    render(<WalletsPage />)

    // Loading state shows the title and a disabled button
    expect(screen.getByText('personalFinance.wallets.title')).toBeInTheDocument()

    // Should have skeleton cards with animate-pulse
    const cards = document.querySelectorAll('.animate-pulse')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('renders wallet cards when wallets are loaded', () => {
    const wallets = [
      createMockWallet({ name: 'Cash' }),
      createMockBankAccount({ name: 'Savings' }),
    ]
    mockUseLiveQuery.mockReturnValue(wallets)

    render(<WalletsPage />)

    expect(screen.getByTestId('wallet-card-Cash')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-card-Savings')).toBeInTheDocument()
  })

  it('shows empty state when no wallets exist', () => {
    mockUseLiveQuery.mockReturnValue([])

    render(<WalletsPage />)

    expect(screen.getByText('personalFinance.wallets.noWallets')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.wallets.noWalletsHint')).toBeInTheDocument()
  })

  it('renders balance overview cards when wallets are loaded', () => {
    const wallets = [createMockWallet({ name: 'Main' })]
    mockUseLiveQuery.mockReturnValue(wallets)

    render(<WalletsPage />)

    expect(screen.getByText('personalFinance.wallets.totalARS')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.wallets.totalUSD')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.wallets.activeWallets')).toBeInTheDocument()
  })

  it('renders search input when wallets exist', () => {
    const wallets = [createMockWallet({ name: 'Main' })]
    mockUseLiveQuery.mockReturnValue(wallets)

    render(<WalletsPage />)

    const searchInput = screen.getByPlaceholderText('personalFinance.wallets.searchPlaceholder')
    expect(searchInput).toBeInTheDocument()
  })
})
