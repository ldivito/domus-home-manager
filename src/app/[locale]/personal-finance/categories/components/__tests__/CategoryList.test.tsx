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

// Mock CreateCategoryDialog to prevent heavy dependency imports
vi.mock('../CreateCategoryDialog', () => ({
  CreateCategoryDialog: vi.fn(({ open }: { open: boolean }) =>
    open ? React.createElement('div', { 'data-testid': 'edit-dialog' }, 'Edit Dialog') : null
  ),
}))

import { CategoryList } from '../CategoryList'
import { createMockCategory, createMockIncomeCategory } from '@/test/factories/category.factory'

describe('CategoryList', () => {
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when categories array is empty', () => {
    render(
      <CategoryList
        categories={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('personalFinance.categoryList.noCategories')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.categoryList.noCategoriesHint')).toBeInTheDocument()
  })

  it('renders category names and color indicators', () => {
    const categories = [
      createMockCategory({ name: 'Food & Dining', color: '#ef4444' }),
      createMockCategory({ name: 'Transport', color: '#3b82f6' }),
    ]
    const { container } = render(
      <CategoryList
        categories={categories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('Food & Dining')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()

    // Color indicators are rendered as div elements with background color
    const colorDots = container.querySelectorAll('[style*="background-color"]')
    expect(colorDots.length).toBeGreaterThanOrEqual(2)
  })

  it('shows crown icon for default categories', () => {
    const categories = [
      createMockCategory({ name: 'Default Category', isDefault: true }),
      createMockCategory({ name: 'Custom Category', isDefault: false }),
    ]
    render(
      <CategoryList
        categories={categories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    // The default category shows the systemDefault badge
    expect(screen.getByText('personalFinance.categoryList.systemDefault')).toBeInTheDocument()
  })

  it('shows type badge (income/expense)', () => {
    const categories = [
      createMockCategory({ name: 'Groceries', type: 'expense' }),
      createMockIncomeCategory({ name: 'Salary' }),
    ]
    render(
      <CategoryList
        categories={categories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('personalFinance.categoryList.expenseBadge')).toBeInTheDocument()
    expect(screen.getByText('personalFinance.categoryList.incomeBadge')).toBeInTheDocument()
  })

  it('does not show delete menu item for default categories', async () => {
    const categories = [
      createMockCategory({ id: 'cat-default', name: 'System Category', isDefault: true }),
    ]
    const { container } = render(
      <CategoryList
        categories={categories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    // Open the dropdown menu - Radix uses pointerdown
    const menuTrigger = container.querySelector('button[data-slot="dropdown-menu-trigger"], button.h-8') as HTMLElement
    expect(menuTrigger).toBeTruthy()
    fireEvent.pointerDown(menuTrigger, { button: 0, pointerType: 'mouse' })

    // Edit should be present
    expect(await screen.findByText('personalFinance.categoryList.editCategory')).toBeInTheDocument()

    // Delete should NOT be present for default categories
    expect(screen.queryByText('personalFinance.categoryList.deleteCategory')).not.toBeInTheDocument()
  })
})
