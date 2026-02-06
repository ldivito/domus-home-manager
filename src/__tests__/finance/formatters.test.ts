// Basic tests for finance formatters
// These tests can be adapted to your preferred testing framework (Jest, Vitest, etc.)

import { 
  formatCurrency, 
  formatBalance, 
  formatTransactionAmount,
  parseAmount,
  formatCardNumber,
  calculatePercentageChange 
} from '../../lib/utils/finance/formatters.js'

// Simple test runner
function runTest(name: string, testFn: () => void) {
  try {
    testFn()
    console.log(`✅ ${name}`)
  } catch (error) {
    console.error(`❌ ${name}:`, error)
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}

function assertObjectEquals(actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr !== expectedStr) {
    throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`)
  }
}

// Currency formatting tests
runTest('formatCurrency - ARS basic', () => {
  const result = formatCurrency(123456, 'ARS')
  assertEquals(result, '$123.456')
})

runTest('formatCurrency - USD basic', () => {
  const result = formatCurrency(1234.56, 'USD')
  assertEquals(result, 'USD $1.234,56')
})

runTest('formatCurrency - ARS with options', () => {
  const result = formatCurrency(123456, 'ARS', { showCode: true, decimals: 2 })
  assertEquals(result, 'ARS $123.456,00')
})

runTest('formatCurrency - USD without symbol', () => {
  const result = formatCurrency(1234.56, 'USD', { showSymbol: false })
  assertEquals(result, '1.234,56')
})

runTest('formatCurrency - compact format', () => {
  const result = formatCurrency(123456789, 'ARS', { compact: true })
  assertEquals(result, '$123,5 M')
})

// Balance formatting tests
runTest('formatBalance - positive amount', () => {
  const result = formatBalance(150000, 'ARS')
  assertObjectEquals(result, {
    formatted: '$150.000',
    colorClass: 'text-green-600 dark:text-green-400',
    isNegative: false
  })
})

runTest('formatBalance - negative amount', () => {
  const result = formatBalance(-50000, 'ARS')
  assertObjectEquals(result, {
    formatted: '-$50.000',
    colorClass: 'text-red-600 dark:text-red-400',
    isNegative: true
  })
})

runTest('formatBalance - with sign for positive', () => {
  const result = formatBalance(150000, 'ARS', { showSign: true })
  assertEquals(result.formatted, '+$150.000')
})

// Transaction amount formatting tests
runTest('formatTransactionAmount - income', () => {
  const result = formatTransactionAmount(50000, 'income', 'ARS')
  assertObjectEquals(result, {
    formatted: '+$50.000',
    colorClass: 'text-green-600 dark:text-green-400',
    prefix: '+'
  })
})

runTest('formatTransactionAmount - expense', () => {
  const result = formatTransactionAmount(25000, 'expense', 'ARS')
  assertObjectEquals(result, {
    formatted: '-$25.000',
    colorClass: 'text-red-600 dark:text-red-400',
    prefix: '-'
  })
})

runTest('formatTransactionAmount - transfer', () => {
  const result = formatTransactionAmount(10000, 'transfer', 'ARS')
  assertObjectEquals(result, {
    formatted: '↔$10.000',
    colorClass: 'text-blue-600 dark:text-blue-400',
    prefix: '↔'
  })
})

// Parse amount tests
runTest('parseAmount - valid number', () => {
  const result = parseAmount('123,456.78')
  assertEquals(result, 123456.78)
})

runTest('parseAmount - with currency symbols', () => {
  const result = parseAmount('$123,456')
  assertEquals(result, 123456)
})

runTest('parseAmount - invalid input', () => {
  const result = parseAmount('abc')
  assertEquals(result, null)
})

runTest('parseAmount - empty string', () => {
  const result = parseAmount('')
  assertEquals(result, null)
})

// Card number formatting tests
runTest('formatCardNumber - basic', () => {
  const result = formatCardNumber('1234567812345678')
  assertEquals(result, '****5678')
})

runTest('formatCardNumber - short number', () => {
  const result = formatCardNumber('1234')
  assertEquals(result, '****1234')
})

runTest('formatCardNumber - empty', () => {
  const result = formatCardNumber('')
  assertEquals(result, '')
})

// Percentage change tests
runTest('calculatePercentageChange - increase', () => {
  const result = calculatePercentageChange(100, 150)
  assertEquals(result, 50)
})

runTest('calculatePercentageChange - decrease', () => {
  const result = calculatePercentageChange(150, 100)
  assertEquals(Math.round(result * 10) / 10, -33.3) // Round to 1 decimal
})

runTest('calculatePercentageChange - from zero', () => {
  const result = calculatePercentageChange(0, 100)
  assertEquals(result, 100)
})

runTest('calculatePercentageChange - to zero', () => {
  const result = calculatePercentageChange(100, 0)
  assertEquals(result, -100)
})

console.log('\\n=== Finance Formatters Tests Complete ===')

// Export for use in other test runners
export {
  runTest,
  assertEquals,
  assertObjectEquals
}