import { PersonalCategory } from '@/types/personal-finance'

let counter = 0

export function createMockCategory(overrides: Partial<PersonalCategory> = {}): PersonalCategory {
  counter++
  return {
    id: `pc_test-cat-${counter}`,
    userId: 'test-user-1',
    name: `Test Category ${counter}`,
    type: 'expense',
    color: '#ef4444',
    icon: 'ShoppingBag',
    isActive: true,
    isDefault: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

export function createMockIncomeCategory(overrides: Partial<PersonalCategory> = {}): PersonalCategory {
  return createMockCategory({
    type: 'income',
    name: `Test Income Category ${++counter}`,
    color: '#22c55e',
    icon: 'Briefcase',
    ...overrides,
  })
}
