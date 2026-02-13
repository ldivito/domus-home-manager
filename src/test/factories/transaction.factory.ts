import { PersonalTransaction } from '@/types/personal-finance'

let counter = 0

export function createMockTransaction(overrides: Partial<PersonalTransaction> = {}): PersonalTransaction {
  counter++
  return {
    id: `pt_test-trx-${counter}`,
    userId: 'test-user-1',
    type: 'expense',
    amount: 1500,
    currency: 'ARS',
    walletId: 'pw_test-wallet-1',
    categoryId: 'pc_test-cat-1',
    description: `Test transaction ${counter}`,
    date: new Date('2025-06-15'),
    isFromCreditCard: false,
    sharedWithHousehold: false,
    status: 'completed',
    createdAt: new Date('2025-06-15'),
    updatedAt: new Date('2025-06-15'),
    ...overrides,
  }
}

export function createMockIncome(overrides: Partial<PersonalTransaction> = {}): PersonalTransaction {
  return createMockTransaction({
    type: 'income',
    amount: 100000,
    description: 'Salary',
    categoryId: 'pc_test-income-cat-1',
    ...overrides,
  })
}

export function createMockTransfer(overrides: Partial<PersonalTransaction> = {}): PersonalTransaction {
  return createMockTransaction({
    type: 'transfer',
    amount: 5000,
    description: 'Transfer to savings',
    targetWalletId: 'pw_test-wallet-2',
    categoryId: 'pc_test-transfer-cat',
    ...overrides,
  })
}
