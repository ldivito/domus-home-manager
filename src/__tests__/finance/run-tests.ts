#!/usr/bin/env node

// Simple test runner for Personal Finance module tests
// Run with: npx ts-node src/__tests__/finance/run-tests.ts

console.log('🧪 Running Personal Finance Module Tests\\n')
console.log('==========================================\\n')

// Import test files - this will execute the tests
import './formatters.test.js'
import './validators.test.js'
import './helpers.test.js'

console.log('\\n==========================================')
console.log('✅ All Personal Finance tests completed!')
console.log('\\n💡 To run individual test files:')
console.log('   npx ts-node src/__tests__/finance/formatters.test.ts')
console.log('   npx ts-node src/__tests__/finance/validators.test.ts')
console.log('   npx ts-node src/__tests__/finance/helpers.test.ts')
console.log('\\n📝 Note: These are basic tests. Consider adding Jest or Vitest for more robust testing.')