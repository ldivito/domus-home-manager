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

const mockUsePathname = vi.fn(() => '/en/personal-finance/categories')

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
    personalWallets: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
    personalCategories: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), update: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) },
    personalTransactions: { get: vi.fn(), put: vi.fn(), add: vi.fn(), delete: vi.fn(), where: vi.fn().mockReturnThis(), equals: vi.fn().mockReturnThis(), count: vi.fn().mockResolvedValue(0), toArray: vi.fn().mockResolvedValue([]), sortBy: vi.fn().mockResolvedValue([]) },
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

// Mock child components
vi.mock('../components/CategoryList', () => ({
  CategoryList: vi.fn(({ categories }: { categories: unknown[] }) =>
    React.createElement('div', { 'data-testid': 'category-list' }, `${categories.length} categories`)
  ),
}))
vi.mock('../components/CreateCategoryDialog', () => ({
  CreateCategoryDialog: vi.fn(({ trigger }: { trigger: React.ReactNode }) => trigger || null),
}))

import CategoriesPage from '../page'
import { createMockCategory, createMockIncomeCategory } from '@/test/factories/category.factory'

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLiveQuery.mockReset()
  })

  it('shows loading state when useLiveQuery returns undefined', () => {
    mockUseLiveQuery.mockReturnValue(undefined)

    render(<CategoriesPage />)

    expect(screen.getByText('personalFinance.categories.title')).toBeInTheDocument()
    // Should show skeleton loading placeholders
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders category tabs (income/expense)', () => {
    const categories = [
      createMockCategory({ type: 'expense', name: 'Food' }),
      createMockIncomeCategory({ name: 'Salary' }),
    ]
    mockUseLiveQuery.mockReturnValue(categories)

    render(<CategoriesPage />)

    // The tabs show expense and income counts
    expect(screen.getByText('personalFinance.categories.expensesCount:{"count":1}')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.categories.incomeCount:{"count":1}')).toBeInTheDocument()
  })

  it('shows stats cards (income count, expense count, total)', () => {
    const categories = [
      createMockCategory({ type: 'expense', name: 'Food' }),
      createMockCategory({ type: 'expense', name: 'Transport' }),
      createMockIncomeCategory({ name: 'Salary' }),
    ]
    mockUseLiveQuery.mockReturnValue(categories)

    render(<CategoriesPage />)

    expect(screen.getByText('personalFinance.categories.incomeCategories')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.categories.expenseCategories')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.categories.totalCategories')).toBeInTheDocument()
    // Total count
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows search input', () => {
    const categories = [createMockCategory({ name: 'Food' })]
    mockUseLiveQuery.mockReturnValue(categories)

    render(<CategoriesPage />)

    const searchInput = screen.getByPlaceholderText('personalFinance.categories.searchPlaceholder')
    expect(searchInput).toBeInTheDocument()
  })
})
