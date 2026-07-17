// Basic tests for finance validators

import { 
  validateWallet, 
  validateTransaction, 
  validateCategory,
  validateAmountInput,
  validateHexColor
} from '../../lib/utils/finance/validators.js'
import { runTest, assertEquals } from './formatters.test.js'

function assertValidationResult(
  result: { isValid: boolean; errors: Record<string, string[]> },
  expectedValid: boolean,
  expectedErrorKeys?: string[]
) {
  assertEquals(result.isValid, expectedValid, `Expected isValid to be ${expectedValid}`)
  
  if (expectedErrorKeys) {
    const actualErrorKeys = Object.keys(result.errors)
    assertEquals(actualErrorKeys.length, expectedErrorKeys.length, 
      `Expected ${expectedErrorKeys.length} errors, got ${actualErrorKeys.length}`)
    
    expectedErrorKeys.forEach(key => {
      if (!actualErrorKeys.includes(key)) {
        throw new Error(`Expected error key '${key}' not found`)
      }
    })
  }
}

// Wallet validation tests
runTest('validateWallet - valid physical wallet', () => {
  const result = validateWallet({
    name: 'Billetera Personal',
    type: 'physical',
    currency: 'ARS',
    balance: 15000,
    color: '#22c55e',
    icon: 'Wallet'
  })
  assertValidationResult(result, true)
})

runTest('validateWallet - valid credit card', () => {
  const result = validateWallet({
    name: 'Visa Platino',
    type: 'credit_card',
    currency: 'ARS',
    creditLimit: 500000,
    closingDay: 15,
    dueDay: 10,
    color: '#ef4444',
    icon: 'CreditCard'
  })
  assertValidationResult(result, true)
})

runTest('validateWallet - missing required fields', () => {
  const result = validateWallet({})
  assertValidationResult(result, false, ['name', 'type', 'currency', 'color', 'icon'])
})

runTest('validateWallet - invalid type', () => {
  const result = validateWallet({
    name: 'Test Wallet',
    type: 'invalid_type' as any,
    currency: 'ARS',
    color: '#22c55e',
    icon: 'Wallet'
  })
  assertValidationResult(result, false, ['type'])
})

runTest('validateWallet - invalid currency', () => {
  const result = validateWallet({
    name: 'Test Wallet',
    type: 'physical',
    currency: 'EUR' as any,
    color: '#22c55e',
    icon: 'Wallet'
  })
  assertValidationResult(result, false, ['currency'])
})

runTest('validateWallet - credit card without limit', () => {
  const result = validateWallet({
    name: 'Visa',
    type: 'credit_card',
    currency: 'ARS',
    color: '#ef4444',
    icon: 'CreditCard'
  })
  assertValidationResult(result, false, ['creditLimit'])
})

runTest('validateWallet - bank without name', () => {
  const result = validateWallet({
    name: 'Bank Account',
    type: 'bank',
    currency: 'ARS',
    balance: 100000,
    color: '#3b82f6',
    icon: 'Building'
  })
  assertValidationResult(result, false, ['bankName'])
})

runTest('validateWallet - invalid hex color', () => {
  const result = validateWallet({
    name: 'Test Wallet',
    type: 'physical',
    currency: 'ARS',
    balance: 0,
    color: 'red',
    icon: 'Wallet'
  })
  assertValidationResult(result, false, ['color'])
})

// Transaction validation tests
runTest('validateTransaction - valid income', () => {
  const result = validateTransaction({
    type: 'income',
    amount: 350000,
    currency: 'ARS',
    walletId: 'pw_123',
    categoryId: 'pc_456',
    description: 'Salary January',
    date: new Date(),
    sharedWithHousehold: false
  })
  assertValidationResult(result, true)
})

runTest('validateTransaction - valid transfer', () => {
  const result = validateTransaction({
    type: 'transfer',
    amount: 50000,
    currency: 'ARS',
    walletId: 'pw_123',
    targetWalletId: 'pw_456',
    categoryId: 'pc_789',
    description: 'Transfer to savings',
    date: new Date(),
    sharedWithHousehold: false
  })
  assertValidationResult(result, true)
})

runTest('validateTransaction - missing required fields', () => {
  const result = validateTransaction({})
  assertValidationResult(result, false, ['type', 'amount', 'currency', 'walletId', 'categoryId', 'description', 'date'])
})

runTest('validateTransaction - negative amount', () => {
  const result = validateTransaction({
    type: 'expense',
    amount: -1000,
    currency: 'ARS',
    walletId: 'pw_123',
    categoryId: 'pc_456',
    description: 'Invalid negative',
    date: new Date(),
    sharedWithHousehold: false
  })
  assertValidationResult(result, false, ['amount'])
})

runTest('validateTransaction - transfer without target wallet', () => {
  const result = validateTransaction({
    type: 'transfer',
    amount: 10000,
    currency: 'ARS',
    walletId: 'pw_123',
    categoryId: 'pc_456',
    description: 'Transfer without target',
    date: new Date(),
    sharedWithHousehold: false
  })
  assertValidationResult(result, false, ['targetWalletId'])
})

runTest('validateTransaction - transfer to same wallet', () => {
  const result = validateTransaction({
    type: 'transfer',
    amount: 10000,
    currency: 'ARS',
    walletId: 'pw_123',
    targetWalletId: 'pw_123',
    categoryId: 'pc_456',
    description: 'Transfer to same wallet',
    date: new Date(),
    sharedWithHousehold: false
  })
  assertValidationResult(result, false, ['targetWalletId'])
})

runTest('validateTransaction - future date', () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 1)
  
  const result = validateTransaction({
    type: 'expense',
    amount: 1000,
    currency: 'ARS',
    walletId: 'pw_123',
    categoryId: 'pc_456',
    description: 'Future transaction',
    date: futureDate,
    sharedWithHousehold: false
  })
  assertValidationResult(result, false, ['date'])
})

runTest('validateTransaction - household contribution exceeds amount', () => {
  const result = validateTransaction({
    type: 'income',
    amount: 100000,
    currency: 'ARS',
    walletId: 'pw_123',
    categoryId: 'pc_456',
    description: 'Income with invalid contribution',
    date: new Date(),
    sharedWithHousehold: true,
    householdContribution: 150000
  })
  assertValidationResult(result, false, ['householdContribution'])
})

// Category validation tests
runTest('validateCategory - valid income category', () => {
  const result = validateCategory({
    name: 'Freelance',
    type: 'income',
    color: '#3b82f6',
    icon: 'Laptop'
  })
  assertValidationResult(result, true)
})

runTest('validateCategory - valid expense category', () => {
  const result = validateCategory({
    name: 'Transportation',
    type: 'expense',
    color: '#ef4444',
    icon: 'Car'
  })
  assertValidationResult(result, true)
})

runTest('validateCategory - missing fields', () => {
  const result = validateCategory({})
  assertValidationResult(result, false, ['name', 'type', 'color', 'icon'])
})

runTest('validateCategory - name too short', () => {
  const result = validateCategory({
    name: 'A',
    type: 'expense',
    color: '#ef4444',
    icon: 'Car'
  })
  assertValidationResult(result, false, ['name'])
})

runTest('validateCategory - name too long', () => {
  const result = validateCategory({
    name: 'This is a very long category name that exceeds the maximum allowed length',
    type: 'expense',
    color: '#ef4444',
    icon: 'Car'
  })
  assertValidationResult(result, false, ['name'])
})

runTest('validateCategory - invalid type', () => {
  const result = validateCategory({
    name: 'Invalid Category',
    type: 'transfer' as any,
    color: '#ef4444',
    icon: 'Car'
  })
  assertValidationResult(result, false, ['type'])
})

// Amount input validation tests
runTest('validateAmountInput - valid number', () => {
  const result = validateAmountInput('123,456.78')
  assertEquals(result.isValid, true)
  assertEquals(result.parsed, 123456.78)
})

runTest('validateAmountInput - valid with currency symbol', () => {
  const result = validateAmountInput('$1,500')
  assertEquals(result.isValid, true)
  assertEquals(result.parsed, 1500)
})

runTest('validateAmountInput - empty string', () => {
  const result = validateAmountInput('')
  assertEquals(result.isValid, false)
  assertEquals(result.error, 'Amount is required')
})

runTest('validateAmountInput - invalid format', () => {
  const result = validateAmountInput('abc')
  assertEquals(result.isValid, false)
  assertEquals(result.error, 'Invalid amount format')
})

runTest('validateAmountInput - negative amount', () => {
  const result = validateAmountInput('-100')
  assertEquals(result.isValid, false)
  assertEquals(result.error, 'Amount must be positive')
})

runTest('validateAmountInput - zero amount', () => {
  const result = validateAmountInput('0')
  assertEquals(result.isValid, false)
  assertEquals(result.error, 'Amount must be positive')
})

runTest('validateAmountInput - amount too large', () => {
  const result = validateAmountInput('9999999999')
  assertEquals(result.isValid, false)
  assertEquals(result.error, 'Amount is too large')
})

// Hex color validation tests
runTest('validateHexColor - valid color', () => {
  const result = validateHexColor('#FF5733')
  assertEquals(result, true)
})

runTest('validateHexColor - valid lowercase', () => {
  const result = validateHexColor('#ff5733')
  assertEquals(result, true)
})

runTest('validateHexColor - invalid without hash', () => {
  const result = validateHexColor('FF5733')
  assertEquals(result, false)
})

runTest('validateHexColor - invalid length', () => {
  const result = validateHexColor('#FF573')
  assertEquals(result, false)
})

runTest('validateHexColor - invalid characters', () => {
  const result = validateHexColor('#GG5733')
  assertEquals(result, false)
})

console.log('\\n=== Finance Validators Tests Complete ===')

export { assertValidationResult }