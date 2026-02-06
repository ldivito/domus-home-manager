// Basic tests for finance helpers

import { 
  calculateNextDueDate,
  calculateAvailableCredit,
  calculateTotalBalance,
  getWalletDisplayName,
  getWalletTypeIndicator,
  updateWalletBalance,
  calculateMonthlyTotals,
  getCreditCardStatus,
  generateWalletColor,
  sortWallets
} from '../../lib/utils/finance/helpers.js'
import { PersonalWallet, PersonalTransaction } from '../../types/personal-finance.js'
import { runTest, assertEquals, assertObjectEquals } from './formatters.test.js'

// Helper to create mock wallet
function createMockWallet(overrides: Partial<PersonalWallet> = {}): PersonalWallet {
  return {
    id: 'pw_123',
    userId: 'user_456',
    name: 'Test Wallet',
    type: 'physical',
    currency: 'ARS',
    balance: 100000,
    color: '#22c55e',
    icon: 'Wallet',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// Helper to create mock transaction
function createMockTransaction(overrides: Partial<PersonalTransaction> = {}): PersonalTransaction {
  return {
    id: 'pt_123',
    userId: 'user_456',
    type: 'expense',
    amount: 1000,
    currency: 'ARS',
    walletId: 'pw_123',
    categoryId: 'pc_456',
    description: 'Test transaction',
    date: new Date(),
    isFromCreditCard: false,
    sharedWithHousehold: false,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// Date calculation tests
runTest('calculateNextDueDate - before closing day', () => {
  const referenceDate = new Date(2024, 0, 10) // January 10th
  const result = calculateNextDueDate(15, 20, referenceDate) // Closes 15th, due 20 days later
  
  const expected = new Date(2024, 0, 15 + 20) // January 35th = February 4th
  assertEquals(result.toDateString(), expected.toDateString())
})

runTest('calculateNextDueDate - after closing day', () => {
  const referenceDate = new Date(2024, 0, 20) // January 20th
  const result = calculateNextDueDate(15, 20, referenceDate) // Already past January 15th closing
  
  // Should use February 15th + 20 days
  const expected = new Date(2024, 1, 15 + 20) // February 35th = March 6th
  assertEquals(result.toDateString(), expected.toDateString())
})

// Credit calculations
runTest('calculateAvailableCredit - normal usage', () => {
  const result = calculateAvailableCredit(100000, -30000) // Used $30,000 of $100,000 limit
  assertEquals(result, 70000)
})

runTest('calculateAvailableCredit - maxed out', () => {
  const result = calculateAvailableCredit(100000, -100000) // Fully used
  assertEquals(result, 0)
})

runTest('calculateAvailableCredit - over limit', () => {
  const result = calculateAvailableCredit(100000, -120000) // Over limit
  assertEquals(result, 0) // Should not go negative
})

runTest('calculateAvailableCredit - positive balance (payments)', () => {
  const result = calculateAvailableCredit(100000, 20000) // Credit balance
  assertEquals(result, 120000) // Available credit + positive balance
})

// Balance calculations
runTest('calculateTotalBalance - multiple wallets', () => {
  const wallets = [
    createMockWallet({ currency: 'ARS', balance: 150000 }),
    createMockWallet({ currency: 'ARS', balance: -50000 }),
    createMockWallet({ currency: 'USD', balance: 800 }),
    createMockWallet({ currency: 'USD', balance: -200 }),
    createMockWallet({ isActive: false, currency: 'ARS', balance: 999999 }) // Should be ignored
  ]
  
  const result = calculateTotalBalance(wallets)
  assertObjectEquals(result, { ARS: 100000, USD: 600 })
})

runTest('calculateTotalBalance - filter by currency', () => {
  const wallets = [
    createMockWallet({ currency: 'ARS', balance: 150000 }),
    createMockWallet({ currency: 'USD', balance: 800 })
  ]
  
  const result = calculateTotalBalance(wallets, 'ARS')
  assertObjectEquals(result, { ARS: 150000, USD: 0 })
})

// Display name tests
runTest('getWalletDisplayName - physical', () => {
  const wallet = createMockWallet({ type: 'physical', name: 'Cash Wallet' })
  const result = getWalletDisplayName(wallet)
  assertEquals(result, '💰 Cash Wallet')
})

runTest('getWalletDisplayName - bank', () => {
  const wallet = createMockWallet({ type: 'bank', name: 'Santander' })
  const result = getWalletDisplayName(wallet)
  assertEquals(result, '🏦 Santander')
})

runTest('getWalletDisplayName - credit card', () => {
  const wallet = createMockWallet({ type: 'credit_card', name: 'Visa' })
  const result = getWalletDisplayName(wallet)
  assertEquals(result, '💳 Visa')
})

// Type indicator tests
runTest('getWalletTypeIndicator - all types', () => {
  assertEquals(getWalletTypeIndicator('physical'), '💰')
  assertEquals(getWalletTypeIndicator('bank'), '🏦')
  assertEquals(getWalletTypeIndicator('credit_card'), '💳')
})

// Balance update tests
runTest('updateWalletBalance - income', () => {
  const transaction = createMockTransaction({ type: 'income', amount: 50000 })
  const result = updateWalletBalance(100000, transaction)
  assertEquals(result, 150000)
})

runTest('updateWalletBalance - expense', () => {
  const transaction = createMockTransaction({ type: 'expense', amount: 25000 })
  const result = updateWalletBalance(100000, transaction)
  assertEquals(result, 75000)
})

runTest('updateWalletBalance - transfer source', () => {
  const transaction = createMockTransaction({ type: 'transfer', amount: 30000 })
  const result = updateWalletBalance(100000, transaction, true) // Source wallet
  assertEquals(result, 70000)
})

runTest('updateWalletBalance - transfer target', () => {
  const transaction = createMockTransaction({ type: 'transfer', amount: 30000 })
  const result = updateWalletBalance(50000, transaction, false) // Target wallet
  assertEquals(result, 80000)
})

// Monthly totals calculation
runTest('calculateMonthlyTotals - mixed transactions', () => {
  const transactions = [
    createMockTransaction({ type: 'income', amount: 350000, categoryId: 'salary' }),
    createMockTransaction({ type: 'income', amount: 50000, categoryId: 'freelance' }),
    createMockTransaction({ type: 'expense', amount: 125000, categoryId: 'food' }),
    createMockTransaction({ type: 'expense', amount: 75000, categoryId: 'transport' }),
    createMockTransaction({ type: 'transfer', amount: 20000, categoryId: 'transfer' }) // Should be ignored
  ]
  
  const result = calculateMonthlyTotals(transactions)
  
  assertObjectEquals(result, {
    totalIncome: 400000,
    totalExpenses: 200000,
    netIncome: 200000,
    categoryTotals: {
      salary: 350000,
      freelance: 50000,
      food: 125000,
      transport: 75000
    }
  })
})

// Credit card status tests
runTest('getCreditCardStatus - healthy usage', () => {
  const wallet = createMockWallet({ 
    type: 'credit_card', 
    balance: -25000, // 25% usage
    creditLimit: 100000 
  })
  
  const result = getCreditCardStatus(wallet)
  assertObjectEquals(result, {
    status: 'healthy',
    message: 'Good credit usage'
  })
})

runTest('getCreditCardStatus - warning usage', () => {
  const wallet = createMockWallet({ 
    type: 'credit_card', 
    balance: -75000, // 75% usage
    creditLimit: 100000 
  })
  
  const result = getCreditCardStatus(wallet)
  assertObjectEquals(result, {
    status: 'warning',
    message: 'High credit usage'
  })
})

runTest('getCreditCardStatus - critical usage', () => {
  const wallet = createMockWallet({ 
    type: 'credit_card', 
    balance: -95000, // 95% usage
    creditLimit: 100000 
  })
  
  const result = getCreditCardStatus(wallet)
  assertObjectEquals(result, {
    status: 'critical',
    message: 'Near credit limit'
  })
})

runTest('getCreditCardStatus - non-credit card', () => {
  const wallet = createMockWallet({ type: 'physical' })
  const result = getCreditCardStatus(wallet)
  assertObjectEquals(result, {
    status: 'healthy',
    message: 'N/A'
  })
})

// Color generation tests
runTest('generateWalletColor - physical wallet', () => {
  const result = generateWalletColor('physical', 0)
  assertEquals(result, '#10b981')
})

runTest('generateWalletColor - bank wallet', () => {
  const result = generateWalletColor('bank', 1)
  assertEquals(result, '#2563eb')
})

runTest('generateWalletColor - credit card', () => {
  const result = generateWalletColor('credit_card', 2)
  assertEquals(result, '#b91c1c')
})

runTest('generateWalletColor - index overflow', () => {
  const result = generateWalletColor('physical', 5) // Should wrap around
  assertEquals(result, '#059669') // Index 5 % 3 = 2, but arrays are 0-indexed so it's index 2
})

// Sorting tests
runTest('sortWallets - by type and name', () => {
  const wallets = [
    createMockWallet({ type: 'credit_card', name: 'Visa' }),
    createMockWallet({ type: 'physical', name: 'Cash' }),
    createMockWallet({ type: 'bank', name: 'Santander' }),
    createMockWallet({ type: 'bank', name: 'BBVA' }),
    createMockWallet({ type: 'credit_card', name: 'American Express' })
  ]
  
  const result = sortWallets(wallets)
  
  // Should be: banks first (BBVA, Santander), then physical (Cash), then credit cards (American Express, Visa)
  const expectedOrder = ['BBVA', 'Santander', 'Cash', 'American Express', 'Visa']
  const actualOrder = result.map(w => w.name)
  
  assertObjectEquals(actualOrder, expectedOrder)
})

console.log('\\n=== Finance Helpers Tests Complete ===')

export { createMockWallet, createMockTransaction }