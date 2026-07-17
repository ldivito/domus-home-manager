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

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockUsePathname = vi.fn(() => '/en/personal-finance/transactions/new')

vi.mock('@/i18n/navigation', () => ({
  Link: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
    function MockLink({ href, children, ...props }, ref) {
      return React.createElement('a', { href, ref, ...props }, children)
    }
  ),
  useRouter: vi.fn(() => ({ push: mockPush, replace: vi.fn(), back: mockBack })),
  usePathname: () => mockUsePathname(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/db', () => ({
  db: {
    personalWallets: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }), toArray: vi.fn().mockResolvedValue([]) },
    personalCategories: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }), toArray: vi.fn().mockResolvedValue([]) },
    personalTransactions: { get: vi.fn(), put: vi.fn(), add: vi.fn().mockResolvedValue(undefined), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
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
  formatTransactionAmount: vi.fn((amount: number, type: string, currency: string) => ({
    formatted: `${type === 'income' ? '+' : '-'}${currency} ${amount}`,
    colorClass: type === 'income' ? 'text-green-600' : 'text-red-600',
    prefix: type === 'income' ? '+' : '-',
  })),
  generateTransactionId: vi.fn(() => 'pt_mock_1'),
  validateTransaction: vi.fn(() => ({ isValid: true, errors: {} })),
  processTransactionBalanceUpdate: vi.fn(),
  validateSufficientFunds: vi.fn().mockResolvedValue({ isValid: true, error: '' }),
  parseAmount: vi.fn((s: string) => parseFloat(s) || null),
}))

import { TransactionForm } from '../TransactionForm'

describe('TransactionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with type selector', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.transactionType')).toBeInTheDocument()
  })

  it('renders the card title with default expense type', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.newTitle:{"type":"Expense"}')).toBeInTheDocument()
  })

  it('renders amount input', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.amount')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
  })

  it('renders description input', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.description')).toBeInTheDocument()
  })

  it('renders wallet selector', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.wallet')).toBeInTheDocument()
  })

  it('renders date input', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.date')).toBeInTheDocument()
  })

  it('renders cancel and submit buttons', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.cancel')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.transactionForm.saveType:{"type":"expense"}')).toBeInTheDocument()
  })

  it('shows category selector for default expense type', () => {
    render(<TransactionForm />)

    expect(screen.getByText('personalFinance.transactionForm.category')).toBeInTheDocument()
  })
})
