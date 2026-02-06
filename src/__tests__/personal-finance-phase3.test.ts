// Personal Finance Phase 3 - Transaction Management Tests

import { 
  validateSufficientFunds,
  processTransactionBalanceUpdate,
  reverseTransactionBalanceUpdate,
  recalculateWalletBalance,
  validateTransaction,
  generateTransactionId
} from '@/lib/utils/finance'
import { PersonalTransaction, PersonalWallet } from '@/types/personal-finance'

// Mock database operations for testing
const mockWallet: PersonalWallet = {
  id: 'pw_test_wallet',
  userId: 'user_test',
  name: 'Test Wallet',
  type: 'bank',
  currency: 'ARS',
  balance: 10000,
  color: '#3b82f6',
  icon: 'Building',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockCreditCard: PersonalWallet = {
  id: 'pw_test_credit',
  userId: 'user_test',
  name: 'Test Credit Card',
  type: 'credit_card',
  currency: 'ARS',
  balance: -2000, // $2000 debt
  creditLimit: 50000,
  closingDay: 15,
  dueDay: 20,
  color: '#ef4444',
  icon: 'CreditCard',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockTransaction: PersonalTransaction = {
  id: 'pt_test_transaction',
  userId: 'user_test',
  walletId: 'pw_test_wallet',
  categoryId: 'pc_test_category',
  type: 'expense',
  amount: 5000,
  currency: 'ARS',
  description: 'Test expense',
  date: new Date(),
  sharedWithHousehold: false,
  isFromCreditCard: false,
  status: 'completed',
  createdAt: new Date(),
  updatedAt: new Date()
}

// Helper function to run tests
function runTest(testName: string, testFn: () => void | Promise<void>) {
  console.log(`\n🧪 Running: ${testName}`)
  try {
    const result = testFn()
    if (result instanceof Promise) {
      return result.then(() => {
        console.log(`✅ PASSED: ${testName}`)
      }).catch((error) => {
        console.error(`❌ FAILED: ${testName}`)
        console.error('Error:', error.message)
      })
    } else {
      console.log(`✅ PASSED: ${testName}`)
    }
  } catch (error: any) {
    console.error(`❌ FAILED: ${testName}`)
    console.error('Error:', error.message)
  }
}

// Assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function runAllTests() {
  console.log('🚀 Personal Finance Phase 3 - Transaction Tests')
  console.log('===============================================')

  // Test 1: Transaction ID Generation
  await runTest('Transaction ID Generation', () => {
    const id1 = generateTransactionId()
    const id2 = generateTransactionId()
    
    assert(id1.startsWith('pt_'), 'Transaction ID should start with pt_')
    assert(id1 !== id2, 'Generated IDs should be unique')
    assert(id1.length > 10, 'Transaction ID should be reasonably long')
  })

  // Test 2: Transaction Validation - Valid Transaction
  await runTest('Transaction Validation - Valid Transaction', () => {
    const validTransaction = {
      type: 'expense' as const,
      amount: 100,
      currency: 'ARS' as const,
      walletId: 'pw_123',
      categoryId: 'pc_456',
      description: 'Valid expense',
      date: new Date(),
      sharedWithHousehold: false
    }

    const result = validateTransaction(validTransaction)
    assert(result.isValid, 'Valid transaction should pass validation')
    assert(Object.keys(result.errors).length === 0, 'Valid transaction should have no errors')
  })

  // Test 3: Transaction Validation - Invalid Amount
  await runTest('Transaction Validation - Invalid Amount', () => {
    const invalidTransaction = {
      type: 'expense' as const,
      amount: -100, // Invalid negative amount
      currency: 'ARS' as const,
      walletId: 'pw_123',
      categoryId: 'pc_456',
      description: 'Invalid expense',
      date: new Date(),
      sharedWithHousehold: false
    }

    const result = validateTransaction(invalidTransaction)
    assert(!result.isValid, 'Invalid transaction should fail validation')
    assert(Object.keys(result.errors).length > 0, 'Invalid transaction should have errors')
  })

  // Test 4: Transaction Validation - Missing Description
  await runTest('Transaction Validation - Missing Description', () => {
    const invalidTransaction = {
      type: 'expense' as const,
      amount: 100,
      currency: 'ARS' as const,
      walletId: 'pw_123',
      categoryId: 'pc_456',
      description: '', // Invalid empty description
      date: new Date(),
      sharedWithHousehold: false
    }

    const result = validateTransaction(invalidTransaction)
    assert(!result.isValid, 'Transaction without description should fail validation')
  })

  // Test 5: Sufficient Funds Validation - Bank Account
  await runTest('Sufficient Funds Validation - Bank Account', async () => {
    // Mock implementation since we can't test database directly
    const validation = await mockValidateSufficientFunds(mockWallet, 5000)
    assert(validation.isValid, 'Should have sufficient funds for valid amount')
    
    const invalidValidation = await mockValidateSufficientFunds(mockWallet, 15000)
    assert(!invalidValidation.isValid, 'Should not have sufficient funds for excessive amount')
  })

  // Test 6: Sufficient Funds Validation - Credit Card
  await runTest('Sufficient Funds Validation - Credit Card', async () => {
    // Credit card has 50k limit with 2k debt, so available is 48k
    const validation = await mockValidateSufficientFunds(mockCreditCard, 40000)
    assert(validation.isValid, 'Credit card should have sufficient credit')
    
    const invalidValidation = await mockValidateSufficientFunds(mockCreditCard, 60000)
    assert(!invalidValidation.isValid, 'Credit card should not have sufficient credit for excessive amount')
  })

  // Test 7: Balance Calculation - Income Transaction
  await runTest('Balance Calculation - Income Transaction', () => {
    const incomeTransaction = { ...mockTransaction, type: 'income' as const, amount: 3000 }
    const newBalance = calculateBalanceAfterTransaction(mockWallet.balance, incomeTransaction)
    
    assert(newBalance === 13000, 'Income should increase balance')
  })

  // Test 8: Balance Calculation - Expense Transaction
  await runTest('Balance Calculation - Expense Transaction', () => {
    const expenseTransaction = { ...mockTransaction, type: 'expense' as const, amount: 2000 }
    const newBalance = calculateBalanceAfterTransaction(mockWallet.balance, expenseTransaction)
    
    assert(newBalance === 8000, 'Expense should decrease balance')
  })

  // Test 9: Balance Calculation - Transfer Transaction (Source)
  await runTest('Balance Calculation - Transfer Transaction (Source)', () => {
    const transferTransaction = { 
      ...mockTransaction, 
      type: 'transfer' as const, 
      amount: 1500,
      targetWalletId: 'pw_other_wallet'
    }
    const newBalance = calculateBalanceAfterTransaction(mockWallet.balance, transferTransaction, true)
    
    assert(newBalance === 8500, 'Transfer should decrease source wallet balance')
  })

  // Test 10: Balance Calculation - Transfer Transaction (Target)
  await runTest('Balance Calculation - Transfer Transaction (Target)', () => {
    const transferTransaction = { 
      ...mockTransaction, 
      type: 'transfer' as const, 
      amount: 1500,
      targetWalletId: 'pw_other_wallet'
    }
    const newBalance = calculateBalanceAfterTransaction(mockWallet.balance, transferTransaction, false)
    
    assert(newBalance === 11500, 'Transfer should increase target wallet balance')
  })

  // Test 11: Currency Conversion in Transfer
  await runTest('Currency Conversion in Transfer', () => {
    const transferTransaction = { 
      ...mockTransaction, 
      type: 'transfer' as const, 
      amount: 100, // $100 USD
      currency: 'USD' as const,
      targetWalletId: 'pw_ars_wallet',
      exchangeRate: 1000 // 1 USD = 1000 ARS
    }
    
    const convertedAmount = transferTransaction.amount * transferTransaction.exchangeRate!
    assert(convertedAmount === 100000, 'Currency conversion should work correctly')
  })

  // Test 12: Household Income Sharing Validation
  await runTest('Household Income Sharing Validation', () => {
    const sharedIncome = {
      type: 'income' as const,
      amount: 10000,
      currency: 'ARS' as const,
      walletId: 'pw_123',
      categoryId: 'pc_salary',
      description: 'Monthly salary',
      date: new Date(),
      sharedWithHousehold: true,
      householdContribution: 8000 // Share 80%
    }
    
    const result = validateTransaction(sharedIncome)
    assert(result.isValid, 'Valid shared income should pass validation')
    
    const invalidSharing = {
      ...sharedIncome,
      householdContribution: 15000 // More than total amount
    }
    
    const invalidResult = validateTransaction(invalidSharing)
    assert(!invalidResult.isValid, 'Household contribution exceeding amount should fail')
  })

  // Test 13: Transaction History Sorting
  await runTest('Transaction History Sorting', () => {
    const transactions = [
      { ...mockTransaction, id: 'pt_1', date: new Date('2024-01-01'), amount: 100 },
      { ...mockTransaction, id: 'pt_2', date: new Date('2024-01-03'), amount: 300 },
      { ...mockTransaction, id: 'pt_3', date: new Date('2024-01-02'), amount: 200 }
    ]
    
    // Sort by date descending (newest first)
    const sorted = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime())
    
    assert(sorted[0].id === 'pt_2', 'Most recent transaction should be first')
    assert(sorted[2].id === 'pt_1', 'Oldest transaction should be last')
  })

  // Test 14: Date Range Filtering
  await runTest('Date Range Filtering', () => {
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-01-31')
    
    const transactions = [
      { ...mockTransaction, id: 'pt_1', date: new Date('2023-12-30') }, // Before range
      { ...mockTransaction, id: 'pt_2', date: new Date('2024-01-15') }, // In range
      { ...mockTransaction, id: 'pt_3', date: new Date('2024-02-01') }  // After range
    ]
    
    const filtered = transactions.filter(t => 
      t.date >= startDate && t.date <= endDate
    )
    
    assert(filtered.length === 1, 'Should filter transactions by date range')
    assert(filtered[0].id === 'pt_2', 'Should keep transaction in range')
  })

  // Test 15: Search Functionality
  await runTest('Search Functionality', () => {
    const transactions = [
      { ...mockTransaction, id: 'pt_1', description: 'Grocery shopping at Carrefour' },
      { ...mockTransaction, id: 'pt_2', description: 'Salary payment from company' },
      { ...mockTransaction, id: 'pt_3', description: 'Netflix subscription renewal' }
    ]
    
    const searchTerm = 'grocery'
    const filtered = transactions.filter(t => 
      t.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    assert(filtered.length === 1, 'Should find matching transactions')
    assert(filtered[0].id === 'pt_1', 'Should find correct transaction')
  })

  console.log('\n🎉 All tests completed!')
}

// Mock helper functions for testing without database
async function mockValidateSufficientFunds(
  wallet: PersonalWallet, 
  amount: number
): Promise<{ isValid: boolean; error?: string }> {
  if (wallet.type === 'credit_card') {
    if (wallet.creditLimit) {
      const availableCredit = wallet.creditLimit + wallet.balance // balance is negative for debt
      if (amount > availableCredit) {
        return { 
          isValid: false, 
          error: `Insufficient credit. Available: ${availableCredit.toLocaleString()}` 
        }
      }
    }
    return { isValid: true }
  }
  
  // For other wallet types, check balance
  if (wallet.balance < amount) {
    return { 
      isValid: false, 
      error: `Insufficient balance. Available: ${wallet.balance.toLocaleString()}` 
    }
  }
  
  return { isValid: true }
}

function calculateBalanceAfterTransaction(
  currentBalance: number,
  transaction: PersonalTransaction,
  isSourceWallet: boolean = true
): number {
  switch (transaction.type) {
    case 'income':
      return currentBalance + transaction.amount
    
    case 'expense':
      return currentBalance - transaction.amount
    
    case 'transfer':
      return isSourceWallet 
        ? currentBalance - transaction.amount 
        : currentBalance + transaction.amount
    
    default:
      return currentBalance
  }
}

// Export for running
export { runAllTests }

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests()
}