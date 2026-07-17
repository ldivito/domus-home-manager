import { PersonalWallet } from '@/types/personal-finance'

let counter = 0

export function createMockWallet(overrides: Partial<PersonalWallet> = {}): PersonalWallet {
  counter++
  return {
    id: `pw_test-wallet-${counter}`,
    userId: 'test-user-1',
    name: `Test Wallet ${counter}`,
    type: 'physical',
    currency: 'ARS',
    balance: 50000,
    color: '#10b981',
    icon: 'Wallet',
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

export function createMockCreditCard(overrides: Partial<PersonalWallet> = {}): PersonalWallet {
  counter++
  return createMockWallet({
    id: `pw_test-cc-${counter}`,
    name: `Test Credit Card ${counter}`,
    type: 'credit_card',
    balance: -15000,
    creditLimit: 100000,
    closingDay: 15,
    dueDay: 10,
    icon: 'CreditCard',
    color: '#ef4444',
    ...overrides,
  })
}

export function createMockBankAccount(overrides: Partial<PersonalWallet> = {}): PersonalWallet {
  counter++
  return createMockWallet({
    id: `pw_test-bank-${counter}`,
    name: `Test Bank Account ${counter}`,
    type: 'bank',
    balance: 250000,
    bankName: 'Banco Santander',
    accountNumber: '****1234',
    icon: 'Building',
    color: '#3b82f6',
    ...overrides,
  })
}
