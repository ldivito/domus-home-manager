import { describe, it, expect } from 'vitest'
import {
  validateWallet,
  validateTransaction,
  validateCategory,
  validateAmountInput,
  validateClosingDay,
  validateDueDay,
  validateHexColor,
  sanitizeDescription,
  validateWalletTypeFields,
} from '../validators'

describe('validateWallet', () => {
  const validPhysical = {
    name: 'My Wallet',
    type: 'physical' as const,
    currency: 'ARS' as const,
    balance: 10000,
    color: '#10b981',
    icon: 'Wallet',
  }

  it('passes for valid physical wallet', () => {
    const result = validateWallet(validPhysical)
    expect(result.isValid).toBe(true)
    expect(Object.keys(result.errors)).toHaveLength(0)
  })

  it('fails when name is missing', () => {
    const result = validateWallet({ ...validPhysical, name: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.name).toBeDefined()
  })

  it('fails when name is too short', () => {
    const result = validateWallet({ ...validPhysical, name: 'A' })
    expect(result.isValid).toBe(false)
    expect(result.errors.name[0]).toContain('at least 2')
  })

  it('fails when name is too long', () => {
    const result = validateWallet({ ...validPhysical, name: 'A'.repeat(51) })
    expect(result.isValid).toBe(false)
    expect(result.errors.name[0]).toContain('less than 50')
  })

  it('fails when type is missing', () => {
    const result = validateWallet({ ...validPhysical, type: undefined })
    expect(result.isValid).toBe(false)
    expect(result.errors.type).toBeDefined()
  })

  it('fails when type is invalid', () => {
    const result = validateWallet({ ...validPhysical, type: 'invalid' as never })
    expect(result.isValid).toBe(false)
    expect(result.errors.type[0]).toContain('Invalid')
  })

  it('fails when currency is missing', () => {
    const result = validateWallet({ ...validPhysical, currency: undefined })
    expect(result.isValid).toBe(false)
    expect(result.errors.currency).toBeDefined()
  })

  it('fails when currency is invalid', () => {
    const result = validateWallet({ ...validPhysical, currency: 'EUR' as never })
    expect(result.isValid).toBe(false)
    expect(result.errors.currency[0]).toContain('Invalid')
  })

  it('requires balance for non-credit-card types', () => {
    const result = validateWallet({ ...validPhysical, balance: undefined })
    expect(result.isValid).toBe(false)
    expect(result.errors.balance).toBeDefined()
  })

  it('validates credit card requires creditLimit', () => {
    const result = validateWallet({
      ...validPhysical,
      type: 'credit_card',
      creditLimit: 0,
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.creditLimit).toBeDefined()
  })

  it('validates credit card closingDay range', () => {
    const result = validateWallet({
      ...validPhysical,
      type: 'credit_card',
      creditLimit: 100000,
      closingDay: 32,
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.closingDay).toBeDefined()
  })

  it('validates credit card dueDay range', () => {
    const result = validateWallet({
      ...validPhysical,
      type: 'credit_card',
      creditLimit: 100000,
      dueDay: 0,
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.dueDay).toBeDefined()
  })

  it('passes for valid credit card', () => {
    const result = validateWallet({
      ...validPhysical,
      type: 'credit_card',
      creditLimit: 100000,
      closingDay: 15,
      dueDay: 10,
    })
    expect(result.isValid).toBe(true)
  })

  it('requires bankName for bank accounts', () => {
    const result = validateWallet({
      ...validPhysical,
      type: 'bank',
      bankName: '',
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.bankName).toBeDefined()
  })

  it('fails when color is invalid hex', () => {
    const result = validateWallet({ ...validPhysical, color: 'red' })
    expect(result.isValid).toBe(false)
    expect(result.errors.color[0]).toContain('hex')
  })

  it('fails when icon is missing', () => {
    const result = validateWallet({ ...validPhysical, icon: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.icon).toBeDefined()
  })
})

describe('validateTransaction', () => {
  const validExpense = {
    type: 'expense' as const,
    amount: 1500,
    currency: 'ARS' as const,
    walletId: 'pw_1',
    categoryId: 'pc_1',
    description: 'Groceries',
    date: new Date('2025-01-15'),
  }

  it('passes for valid expense', () => {
    const result = validateTransaction(validExpense)
    expect(result.isValid).toBe(true)
  })

  it('passes for valid income', () => {
    const result = validateTransaction({ ...validExpense, type: 'income' })
    expect(result.isValid).toBe(true)
  })

  it('fails when type is missing', () => {
    const result = validateTransaction({ ...validExpense, type: undefined })
    expect(result.isValid).toBe(false)
    expect(result.errors.type).toBeDefined()
  })

  it('fails when amount is zero', () => {
    const result = validateTransaction({ ...validExpense, amount: 0 })
    expect(result.isValid).toBe(false)
    expect(result.errors.amount).toBeDefined()
  })

  it('fails when amount is negative', () => {
    const result = validateTransaction({ ...validExpense, amount: -100 })
    expect(result.isValid).toBe(false)
    expect(result.errors.amount).toBeDefined()
  })

  it('fails when amount exceeds maximum', () => {
    const result = validateTransaction({ ...validExpense, amount: 1000000000 })
    expect(result.isValid).toBe(false)
    expect(result.errors.amount[0]).toContain('too large')
  })

  it('fails when walletId is missing', () => {
    const result = validateTransaction({ ...validExpense, walletId: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.walletId).toBeDefined()
  })

  it('requires targetWalletId for transfers', () => {
    const result = validateTransaction({
      ...validExpense,
      type: 'transfer',
      targetWalletId: undefined,
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.targetWalletId).toBeDefined()
  })

  it('fails when targetWalletId equals walletId for transfers', () => {
    const result = validateTransaction({
      ...validExpense,
      type: 'transfer',
      targetWalletId: 'pw_1',
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.targetWalletId[0]).toContain('different')
  })

  it('passes for valid transfer', () => {
    const result = validateTransaction({
      ...validExpense,
      type: 'transfer',
      targetWalletId: 'pw_2',
    })
    expect(result.isValid).toBe(true)
  })

  it('requires categoryId', () => {
    const result = validateTransaction({ ...validExpense, categoryId: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.categoryId).toBeDefined()
  })

  it('requires description', () => {
    const result = validateTransaction({ ...validExpense, description: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.description).toBeDefined()
  })

  it('fails when description is too short', () => {
    const result = validateTransaction({ ...validExpense, description: 'A' })
    expect(result.isValid).toBe(false)
    expect(result.errors.description[0]).toContain('at least 2')
  })

  it('fails when description is too long', () => {
    const result = validateTransaction({ ...validExpense, description: 'A'.repeat(201) })
    expect(result.isValid).toBe(false)
    expect(result.errors.description[0]).toContain('less than 200')
  })

  it('requires date', () => {
    const result = validateTransaction({ ...validExpense, date: undefined })
    expect(result.isValid).toBe(false)
    expect(result.errors.date).toBeDefined()
  })

  it('fails when date is in the future', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const result = validateTransaction({ ...validExpense, date: futureDate })
    expect(result.isValid).toBe(false)
    expect(result.errors.date[0]).toContain('future')
  })

  it('validates householdContribution cannot exceed amount', () => {
    const result = validateTransaction({
      ...validExpense,
      sharedWithHousehold: true,
      householdContribution: 2000,
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.householdContribution[0]).toContain('exceed')
  })

  it('validates householdContribution cannot be negative', () => {
    const result = validateTransaction({
      ...validExpense,
      sharedWithHousehold: true,
      householdContribution: -100,
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.householdContribution[0]).toContain('negative')
  })
})

describe('validateCategory', () => {
  const validCategory = {
    name: 'Food & Dining',
    type: 'expense' as const,
    color: '#ef4444',
    icon: 'UtensilsCrossed',
  }

  it('passes for valid category', () => {
    const result = validateCategory(validCategory)
    expect(result.isValid).toBe(true)
  })

  it('fails when name is missing', () => {
    const result = validateCategory({ ...validCategory, name: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.name).toBeDefined()
  })

  it('fails when name is too short', () => {
    const result = validateCategory({ ...validCategory, name: 'A' })
    expect(result.isValid).toBe(false)
    expect(result.errors.name[0]).toContain('at least 2')
  })

  it('fails when name exceeds 30 chars', () => {
    const result = validateCategory({ ...validCategory, name: 'A'.repeat(31) })
    expect(result.isValid).toBe(false)
    expect(result.errors.name[0]).toContain('less than 30')
  })

  it('fails when type is invalid', () => {
    const result = validateCategory({ ...validCategory, type: 'invalid' as never })
    expect(result.isValid).toBe(false)
    expect(result.errors.type[0]).toContain('Invalid')
  })

  it('validates valid hex color', () => {
    const result = validateCategory({ ...validCategory, color: 'red' })
    expect(result.isValid).toBe(false)
    expect(result.errors.color[0]).toContain('hex')
  })

  it('requires icon', () => {
    const result = validateCategory({ ...validCategory, icon: '' })
    expect(result.isValid).toBe(false)
    expect(result.errors.icon).toBeDefined()
  })
})

describe('validateAmountInput', () => {
  it('returns parsed amount for valid input', () => {
    const result = validateAmountInput('1500')
    expect(result.isValid).toBe(true)
    expect(result.parsed).toBe(1500)
  })

  it('fails for empty input', () => {
    const result = validateAmountInput('')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('required')
  })

  it('fails for whitespace-only input', () => {
    const result = validateAmountInput('   ')
    expect(result.isValid).toBe(false)
  })

  it('fails for non-numeric input', () => {
    const result = validateAmountInput('abc')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('fails for zero', () => {
    const result = validateAmountInput('0')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('positive')
  })

  it('fails for amounts exceeding maximum', () => {
    const result = validateAmountInput('9999999999')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('too large')
  })

  it('strips currency symbols', () => {
    const result = validateAmountInput('$1500')
    expect(result.isValid).toBe(true)
    expect(result.parsed).toBe(1500)
  })
})

describe('validateClosingDay', () => {
  it('accepts valid days (1-31)', () => {
    expect(validateClosingDay(1)).toBe(true)
    expect(validateClosingDay(15)).toBe(true)
    expect(validateClosingDay(31)).toBe(true)
  })

  it('rejects out of range', () => {
    expect(validateClosingDay(0)).toBe(false)
    expect(validateClosingDay(32)).toBe(false)
  })

  it('rejects non-integers', () => {
    expect(validateClosingDay(15.5)).toBe(false)
  })
})

describe('validateDueDay', () => {
  it('accepts valid days (1-31)', () => {
    expect(validateDueDay(1)).toBe(true)
    expect(validateDueDay(10)).toBe(true)
    expect(validateDueDay(31)).toBe(true)
  })

  it('rejects out of range', () => {
    expect(validateDueDay(0)).toBe(false)
    expect(validateDueDay(32)).toBe(false)
  })
})

describe('validateHexColor', () => {
  it('accepts valid hex colors', () => {
    expect(validateHexColor('#FF0000')).toBe(true)
    expect(validateHexColor('#10b981')).toBe(true)
    expect(validateHexColor('#000000')).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(validateHexColor('red')).toBe(false)
    expect(validateHexColor('#FFF')).toBe(false) // 3 chars not supported
    expect(validateHexColor('10b981')).toBe(false) // Missing #
    expect(validateHexColor('#GGGGGG')).toBe(false)
  })
})

describe('sanitizeDescription', () => {
  it('trims whitespace', () => {
    expect(sanitizeDescription('  hello  ')).toBe('hello')
  })

  it('collapses multiple spaces', () => {
    expect(sanitizeDescription('hello   world')).toBe('hello world')
  })

  it('truncates to 200 characters', () => {
    const long = 'A'.repeat(250)
    expect(sanitizeDescription(long)).toHaveLength(200)
  })
})

describe('validateWalletTypeFields', () => {
  it('requires creditLimit for credit_card type', () => {
    const result = validateWalletTypeFields('credit_card', {})
    expect(result.isValid).toBe(false)
    expect(result.errors.creditLimit).toBeDefined()
  })

  it('requires bankName for bank type', () => {
    const result = validateWalletTypeFields('bank', { balance: 0 })
    expect(result.isValid).toBe(false)
    expect(result.errors.bankName).toBeDefined()
  })

  it('requires balance for bank type', () => {
    const result = validateWalletTypeFields('bank', { bankName: 'Test Bank' })
    expect(result.isValid).toBe(false)
    expect(result.errors.balance).toBeDefined()
  })

  it('requires balance for physical type', () => {
    const result = validateWalletTypeFields('physical', {})
    expect(result.isValid).toBe(false)
    expect(result.errors.balance).toBeDefined()
  })

  it('passes for valid physical wallet', () => {
    const result = validateWalletTypeFields('physical', { balance: 1000 })
    expect(result.isValid).toBe(true)
  })
})
