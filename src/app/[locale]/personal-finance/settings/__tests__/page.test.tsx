import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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

const mockUsePathname = vi.fn(() => '/en/personal-finance/settings')

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

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

import PersonalFinanceSettingsPage from '../page'

describe('PersonalFinanceSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage
    localStorage.clear()
  })

  it('shows loading state then renders content', async () => {
    render(<PersonalFinanceSettingsPage />)

    // After useEffect runs, loading becomes false and content renders
    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.title')).toBeInTheDocument()
    })
  })

  it('renders all 5 tab triggers', async () => {
    render(<PersonalFinanceSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.title')).toBeInTheDocument()
    })

    expect(screen.getByText('personalFinance.settings.tabs.general')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.tabs.household')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.tabs.appearance')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.tabs.notifications')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.tabs.privacy')).toBeInTheDocument()
  })

  it('renders settings title and save button', async () => {
    render(<PersonalFinanceSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.title')).toBeInTheDocument()
    })

    expect(screen.getByText('personalFinance.settings.subtitle')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.saveChanges')).toBeInTheDocument()
  })

  it('general tab shows currency, date format, start of week selectors', async () => {
    render(<PersonalFinanceSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.title')).toBeInTheDocument()
    })

    // General tab is default, so its content should be visible
    expect(screen.getByText('personalFinance.settings.general.title')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.general.defaultCurrency')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.general.dateFormat')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.settings.general.startOfWeek')).toBeInTheDocument()
  })

  it('renders save button that calls localStorage', async () => {
    render(<PersonalFinanceSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.saveChanges')).toBeInTheDocument()
    })

    const saveButton = screen.getByText('personalFinance.settings.saveChanges')
    fireEvent.click(saveButton)

    // After save, toast should be called
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'personalFinance.settings.messages.savedTitle',
        description: 'personalFinance.settings.messages.savedMessage',
      })
    )

    // And localStorage should have been written
    const stored = localStorage.getItem('personalFinancePreferences')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.defaultCurrency).toBe('ARS')
  })

  it('save button writes preferences to localStorage', async () => {
    render(<PersonalFinanceSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.saveChanges')).toBeInTheDocument()
    })

    // Click save to write defaults to localStorage
    fireEvent.click(screen.getByText('personalFinance.settings.saveChanges'))

    // Verify localStorage was written
    const stored = localStorage.getItem('personalFinancePreferences')
    expect(stored).not.toBeNull()

    // Verify the saved data includes defaults
    const parsed = JSON.parse(stored!)
    expect(parsed.startOfWeek).toBe('monday')
    expect(parsed.dateFormat).toBe('dd/mm/yyyy')
  })

  it('shows general description text', async () => {
    render(<PersonalFinanceSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.general.description')).toBeInTheDocument()
    })
  })

  it('renders the settings page heading with icon', async () => {
    const { container } = render(<PersonalFinanceSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('personalFinance.settings.title')).toBeInTheDocument()
    })

    // Settings icon (SVG) should be present within the heading
    const heading = screen.getByText('personalFinance.settings.title').closest('h1')
    expect(heading).toBeInTheDocument()
    const svg = heading?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
