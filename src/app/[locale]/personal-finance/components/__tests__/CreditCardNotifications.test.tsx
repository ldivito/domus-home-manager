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

const mockGetAllCreditCardNotifications = vi.fn()
const mockGetNotificationSummary = vi.fn()

vi.mock('@/lib/utils/finance', () => ({
  formatCurrency: vi.fn((amount: number, currency: string) => `${currency} ${amount.toLocaleString()}`),
  getAllCreditCardNotifications: (...args: any[]) => mockGetAllCreditCardNotifications(...args),
  getNotificationSummary: (...args: any[]) => mockGetNotificationSummary(...args),
  formatNotificationForDisplay: vi.fn(() => ({ icon: 'icon-test', color: 'blue', urgencyText: 'Urgent', actionSuggestion: 'Pay now' })),
}))

import CreditCardNotifications from '../CreditCardNotifications'

const createNotification = (overrides = {}) => ({
  id: 'notif-1',
  walletId: 'w1',
  walletName: 'Visa Gold',
  type: 'due_soon' as const,
  title: 'Payment Due Soon',
  message: 'Your payment is due in 3 days',
  priority: 'high' as const,
  amount: 25000,
  currency: 'ARS' as const,
  daysUntilDue: 3,
  createdAt: new Date('2025-01-15'),
  ...overrides,
})

const defaultSummary = {
  total: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  overdue: 0,
  dueSoon: 0,
  closingSoon: 0,
  usageAlerts: 0,
}

describe('CreditCardNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAllCreditCardNotifications.mockResolvedValue([])
    mockGetNotificationSummary.mockResolvedValue(defaultSummary)
  })

  it('shows loading state initially (skeleton)', () => {
    // Make the promise never resolve so we stay in loading state
    mockGetAllCreditCardNotifications.mockReturnValue(new Promise(() => {}))
    mockGetNotificationSummary.mockReturnValue(new Promise(() => {}))

    const { container } = render(
      <CreditCardNotifications userId="user-1" />
    )

    // Loading state shows animate-pulse skeletons
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
    expect(screen.getByText('personalFinance.creditCard.alertsTitle')).toBeInTheDocument()
  })

  it('shows empty state when no notifications', async () => {
    mockGetAllCreditCardNotifications.mockResolvedValue([])
    mockGetNotificationSummary.mockResolvedValue(defaultSummary)

    render(<CreditCardNotifications userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.creditCard.allUpToDate')).toBeInTheDocument()
    })
    expect(screen.getByText('personalFinance.creditCard.statusTitle')).toBeInTheDocument()
  })

  it('renders notification cards with title, message, wallet name', async () => {
    const notifications = [
      createNotification({
        id: 'n1',
        title: 'Payment Due Soon',
        message: 'Your payment is due in 3 days',
        walletName: 'Visa Gold',
      }),
    ]
    mockGetAllCreditCardNotifications.mockResolvedValue(notifications)
    mockGetNotificationSummary.mockResolvedValue({ ...defaultSummary, total: 1, high: 1 })

    render(<CreditCardNotifications userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Payment Due Soon')).toBeInTheDocument()
    })
    expect(screen.getByText('Your payment is due in 3 days')).toBeInTheDocument()
    expect(screen.getByText('Visa Gold')).toBeInTheDocument()
  })

  it('shows priority badge with urgency text', async () => {
    const notifications = [
      createNotification({ id: 'n1', priority: 'high' }),
    ]
    mockGetAllCreditCardNotifications.mockResolvedValue(notifications)
    mockGetNotificationSummary.mockResolvedValue({ ...defaultSummary, total: 1, high: 1 })

    render(<CreditCardNotifications userId="user-1" />)

    await waitFor(() => {
      // formatNotificationForDisplay returns urgencyText: 'Urgent'
      expect(screen.getByText('Urgent')).toBeInTheDocument()
    })
  })

  it('shows summary stats grid', async () => {
    const notifications = [
      createNotification({ id: 'n1' }),
    ]
    mockGetAllCreditCardNotifications.mockResolvedValue(notifications)
    mockGetNotificationSummary.mockResolvedValue({
      total: 4,
      critical: 0,
      high: 1,
      medium: 1,
      low: 2,
      overdue: 1,
      dueSoon: 1,
      closingSoon: 1,
      usageAlerts: 1,
    })

    render(<CreditCardNotifications userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.creditCard.overdue')).toBeInTheDocument()
    })
    expect(screen.getByText('personalFinance.creditCard.dueSoon')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.creditCard.closingSoon')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.creditCard.usageAlerts')).toBeInTheDocument()
  })

  it('shows expand/collapse button when more than 5 notifications', async () => {
    const notifications = Array.from({ length: 7 }, (_, i) =>
      createNotification({ id: `n-${i}`, title: `Notification ${i}` })
    )
    mockGetAllCreditCardNotifications.mockResolvedValue(notifications)
    mockGetNotificationSummary.mockResolvedValue({ ...defaultSummary, total: 7, high: 7 })

    render(<CreditCardNotifications userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.creditCard.showAll:{"count":7}')).toBeInTheDocument()
    })
  })
})
