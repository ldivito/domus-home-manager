/**
 * Basic tests for Personal Finance Phase 2 components
 * These tests verify that the core functionality works
 */

import { validateWallet, validateCategory, formatBalance } from '@/lib/utils/finance'
import { WalletFormData, CategoryFormData } from '@/types/personal-finance'

console.log('🧪 Running Personal Finance Phase 2 Tests...\n')

// Test wallet validation
console.log('1. Testing wallet validation...')
const validWalletData: WalletFormData = {
  name: 'Test Wallet',
  type: 'bank',
  currency: 'ARS',
  balance: 1000,
  bankName: 'Test Bank',
  color: '#3b82f6',
  icon: 'Building'
}

const walletValidation = validateWallet(validWalletData)
console.log('✅ Valid wallet data:', walletValidation.isValid ? 'PASSED' : 'FAILED')

const invalidWalletData: WalletFormData = {
  name: '', // Invalid: empty name
  type: 'bank',
  currency: 'ARS',
  color: 'invalid-color', // Invalid color
  icon: 'Building'
}

const invalidWalletValidation = validateWallet(invalidWalletData)
console.log('✅ Invalid wallet data rejection:', !invalidWalletValidation.isValid ? 'PASSED' : 'FAILED')

// Test category validation
console.log('\n2. Testing category validation...')
const validCategoryData: CategoryFormData = {
  name: 'Test Category',
  type: 'expense',
  color: '#ef4444',
  icon: 'Tag'
}

const categoryValidation = validateCategory(validCategoryData)
console.log('✅ Valid category data:', categoryValidation.isValid ? 'PASSED' : 'FAILED')

// Test currency formatting
console.log('\n3. Testing currency formatting...')
const arsBalance = formatBalance(123456.78, 'ARS')
console.log('✅ ARS formatting:', arsBalance.formatted === '$123.457' ? 'PASSED' : `FAILED (got: ${arsBalance.formatted})`)

const usdBalance = formatBalance(1234.56, 'USD')
console.log('✅ USD formatting:', usdBalance.formatted.includes('1.235') ? 'PASSED' : `FAILED (got: ${usdBalance.formatted})`)

const negativeBalance = formatBalance(-500, 'ARS')
console.log('✅ Negative balance color:', negativeBalance.colorClass.includes('red') ? 'PASSED' : 'FAILED')

// Test wallet types
console.log('\n4. Testing wallet type validations...')
const creditCardWallet: WalletFormData = {
  name: 'Credit Card',
  type: 'credit_card',
  currency: 'ARS',
  creditLimit: 50000,
  closingDay: 15,
  dueDay: 5,
  color: '#3b82f6',
  icon: 'CreditCard'
}

const ccValidation = validateWallet(creditCardWallet)
console.log('✅ Credit card wallet:', ccValidation.isValid ? 'PASSED' : 'FAILED')

// Test edge cases
console.log('\n5. Testing edge cases...')
const longNameWallet: WalletFormData = {
  name: 'A'.repeat(100), // Very long name
  type: 'physical',
  currency: 'ARS',
  color: '#3b82f6',
  icon: 'Wallet'
}

const longNameValidation = validateWallet(longNameWallet)
console.log('✅ Long name rejection:', !longNameValidation.isValid ? 'PASSED' : 'FAILED')

const zeroBalanceWallet: WalletFormData = {
  name: 'Zero Balance',
  type: 'bank',
  currency: 'USD',
  balance: 0,
  color: '#3b82f6',
  icon: 'Building'
}

const zeroValidation = validateWallet(zeroBalanceWallet)
console.log('✅ Zero balance acceptance:', zeroValidation.isValid ? 'PASSED' : 'FAILED')

console.log('\n🎉 Personal Finance Phase 2 Tests Complete!')
console.log('\nNext steps:')
console.log('- Run the development server: npm run dev')
console.log('- Navigate to /personal-finance/wallets to test the UI')
console.log('- Try creating wallets and categories')
console.log('- Check browser console for any errors')