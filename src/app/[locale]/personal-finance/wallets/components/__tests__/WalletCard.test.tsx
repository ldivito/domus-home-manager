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
  formatBalance: vi.fn((balance: number, currency: string) => ({
    formatted: `${currency} ${Math.abs(balance).toLocaleString()}`,
    colorClass: balance >= 0 ? 'text-green-600' : 'text-red-600',
    isNegative: balance < 0,
  })),
  calculateAvailableCredit: vi.fn((limit: number, balance: number) => Math.max(0, limit - balance)),
}))

import { WalletCard } from '../WalletCard'
import { createMockWallet, createMockCreditCard, createMockBankAccount } from '@/test/factories/wallet.factory'

describe('WalletCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders wallet name and type display name', () => {
    const wallet = createMockWallet({ name: 'My Cash Wallet' })
    render(<WalletCard wallet={wallet} />)

    expect(screen.getByText('My Cash Wallet')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletCard.physicalWallet')).toBeInTheDocument()
  })

  it('renders correct icon for physical wallet type', () => {
    const wallet = createMockWallet({ type: 'physical' })
    const { container } = render(<WalletCard wallet={wallet} />)

    // Lucide icons render as SVGs; the Wallet icon should be present
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('renders correct type display for credit_card type', () => {
    const wallet = createMockCreditCard({ name: 'Visa Gold' })
    render(<WalletCard wallet={wallet} />)

    expect(screen.getByText('Visa Gold')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletCard.creditCard')).toBeInTheDocument()
  })

  it('renders correct type display for bank type', () => {
    const wallet = createMockBankAccount({ name: 'Savings Account' })
    render(<WalletCard wallet={wallet} />)

    expect(screen.getByText('Savings Account')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletCard.bankAccount')).toBeInTheDocument()
  })

  it('shows balance with correct color class for positive balance', () => {
    const wallet = createMockWallet({ balance: 50000, currency: 'ARS' })
    const { container } = render(<WalletCard wallet={wallet} />)

    // formatBalance returns text-green-600 for positive balances
    const balanceEl = container.querySelector('.text-green-600')
    expect(balanceEl).toBeInTheDocument()
  })

  it('shows balance with correct color class for negative balance', () => {
    const wallet = createMockCreditCard({ balance: -15000, currency: 'ARS' })
    const { container } = render(<WalletCard wallet={wallet} />)

    const balanceEl = container.querySelector('.text-red-600')
    expect(balanceEl).toBeInTheDocument()
  })

  it('hides balance when showBalance prop is false and shows masked text', () => {
    const wallet = createMockWallet({ balance: 50000, currency: 'ARS' })
    render(<WalletCard wallet={wallet} showBalance={false} />)

    // When showBalance is false, the balance should be masked
    expect(screen.getAllByText(/••••••/).length).toBeGreaterThan(0)
  })

  it('shows credit card details for credit_card type', () => {
    const wallet = createMockCreditCard({
      creditLimit: 100000,
      dueDay: 10,
      currency: 'ARS',
    })
    render(<WalletCard wallet={wallet} />)

    expect(screen.getByText('personalFinance.walletCard.creditLimit')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletCard.availableCredit')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletCard.paymentDue')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.walletCard.dayOfMonth:{"day":10}')).toBeInTheDocument()
  })

  it('shows bank name for bank type', () => {
    const wallet = createMockBankAccount({ bankName: 'Banco Santander' })
    render(<WalletCard wallet={wallet} />)

    expect(screen.getByText('personalFinance.walletCard.bankLabel')).toBeInTheDocument()
    expect(screen.getByText('Banco Santander')).toBeInTheDocument()
  })

  it('shows type badge for each wallet type', () => {
    const physical = createMockWallet()
    const { unmount: u1 } = render(<WalletCard wallet={physical} />)
    expect(screen.getByText('personalFinance.walletCard.cashBadge')).toBeInTheDocument()
    u1()

    const creditCard = createMockCreditCard()
    const { unmount: u2 } = render(<WalletCard wallet={creditCard} />)
    expect(screen.getByText('personalFinance.walletCard.creditBadge')).toBeInTheDocument()
    u2()

    const bank = createMockBankAccount()
    render(<WalletCard wallet={bank} />)
    expect(screen.getByText('personalFinance.walletCard.bankBadge')).toBeInTheDocument()
  })

  it('calls onEdit when edit menu item is clicked', async () => {
    const onEdit = vi.fn()
    const wallet = createMockWallet({ id: 'w1' })
    const { container } = render(<WalletCard wallet={wallet} onEdit={onEdit} />)

    // Radix DropdownMenu uses pointerdown event to open
    const menuTrigger = container.querySelector('button[data-slot="dropdown-menu-trigger"], button.h-8') as HTMLElement
    expect(menuTrigger).toBeTruthy()
    fireEvent.pointerDown(menuTrigger, { button: 0, pointerType: 'mouse' })

    const editItem = await screen.findByText('personalFinance.walletCard.editWallet')
    fireEvent.click(editItem)

    expect(onEdit).toHaveBeenCalledWith(wallet)
  })

  it('calls onDelete when delete menu item is clicked', async () => {
    const onDelete = vi.fn()
    const wallet = createMockWallet({ id: 'w1' })
    const { container } = render(<WalletCard wallet={wallet} onDelete={onDelete} />)

    const menuTrigger = container.querySelector('button[data-slot="dropdown-menu-trigger"], button.h-8') as HTMLElement
    expect(menuTrigger).toBeTruthy()
    fireEvent.pointerDown(menuTrigger, { button: 0, pointerType: 'mouse' })

    const deleteItem = await screen.findByText('personalFinance.walletCard.deleteWallet')
    fireEvent.click(deleteItem)

    expect(onDelete).toHaveBeenCalledWith('w1')
  })

  it('renders view details and new transaction links with correct hrefs', () => {
    const wallet = createMockWallet({ id: 'wallet-123' })
    render(<WalletCard wallet={wallet} />)

    const viewDetailsLink = screen.getByText('personalFinance.walletCard.viewDetails').closest('a')
    expect(viewDetailsLink).toHaveAttribute('href', '/personal-finance/wallets/wallet-123')

    const newTxnLink = screen.getByText('personalFinance.walletCard.newTransaction').closest('a')
    expect(newTxnLink).toHaveAttribute('href', '/personal-finance/transactions/new?walletId=wallet-123')
  })
})
