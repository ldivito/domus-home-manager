// Validation utilities for Personal Finance module

import { 
  WalletFormData, 
  TransactionFormData, 
  CategoryFormData,
  WalletType
} from '@/types/personal-finance'

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string[]>
}

/**
 * Validate wallet form data
 */
export function validateWallet(data: Partial<WalletFormData>): ValidationResult {
  const errors: Record<string, string[]> = {}

  // Name validation
  if (!data.name?.trim()) {
    errors.name = ['Wallet name is required']
  } else if (data.name.trim().length < 2) {
    errors.name = ['Wallet name must be at least 2 characters']
  } else if (data.name.trim().length > 50) {
    errors.name = ['Wallet name must be less than 50 characters']
  }

  // Type validation
  if (!data.type) {
    errors.type = ['Wallet type is required']
  } else if (!['physical', 'bank', 'credit_card'].includes(data.type)) {
    errors.type = ['Invalid wallet type']
  }

  // Currency validation
  if (!data.currency) {
    errors.currency = ['Currency is required']
  } else if (!['ARS', 'USD'].includes(data.currency)) {
    errors.currency = ['Invalid currency']
  }

  // Balance validation (for non-credit cards)
  if (data.type !== 'credit_card') {
    if (data.balance === undefined || data.balance === null) {
      errors.balance = ['Initial balance is required']
    } else if (isNaN(data.balance)) {
      errors.balance = ['Balance must be a valid number']
    }
  }

  // Credit card specific validations
  if (data.type === 'credit_card') {
    if (!data.creditLimit || data.creditLimit <= 0) {
      errors.creditLimit = ['Credit limit is required and must be positive']
    }
    
    if (data.closingDay !== undefined) {
      if (data.closingDay < 1 || data.closingDay > 31) {
        errors.closingDay = ['Closing day must be between 1 and 31']
      }
    }
    
    if (data.dueDay !== undefined) {
      if (data.dueDay < 1 || data.dueDay > 31) {
        errors.dueDay = ['Due day must be between 1 and 31']
      }
    }
  }

  // Bank specific validations
  if (data.type === 'bank') {
    if (!data.bankName?.trim()) {
      errors.bankName = ['Bank name is required for bank accounts']
    }
  }

  // Color validation
  if (!data.color?.trim()) {
    errors.color = ['Color is required']
  } else if (!/^#[0-9A-F]{6}$/i.test(data.color)) {
    errors.color = ['Color must be a valid hex color']
  }

  // Icon validation
  if (!data.icon?.trim()) {
    errors.icon = ['Icon is required']
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validate transaction form data
 */
export function validateTransaction(data: Partial<TransactionFormData>): ValidationResult {
  const errors: Record<string, string[]> = {}

  // Type validation
  if (!data.type) {
    errors.type = ['Transaction type is required']
  } else if (!['income', 'expense', 'transfer'].includes(data.type)) {
    errors.type = ['Invalid transaction type']
  }

  // Amount validation
  if (data.amount === undefined || data.amount === null) {
    errors.amount = ['Amount is required']
  } else if (isNaN(data.amount) || data.amount <= 0) {
    errors.amount = ['Amount must be a positive number']
  } else if (data.amount > 999999999) {
    errors.amount = ['Amount is too large']
  }

  // Currency validation
  if (!data.currency) {
    errors.currency = ['Currency is required']
  } else if (!['ARS', 'USD'].includes(data.currency)) {
    errors.currency = ['Invalid currency']
  }

  // Wallet validation
  if (!data.walletId?.trim()) {
    errors.walletId = ['Source wallet is required']
  }

  // Transfer specific validation
  if (data.type === 'transfer') {
    if (!data.targetWalletId?.trim()) {
      errors.targetWalletId = ['Target wallet is required for transfers']
    } else if (data.walletId === data.targetWalletId) {
      errors.targetWalletId = ['Target wallet must be different from source wallet']
    }
  }

  // Category validation
  if (!data.categoryId?.trim()) {
    errors.categoryId = ['Category is required']
  }

  // Description validation
  if (!data.description?.trim()) {
    errors.description = ['Description is required']
  } else if (data.description.trim().length < 2) {
    errors.description = ['Description must be at least 2 characters']
  } else if (data.description.trim().length > 200) {
    errors.description = ['Description must be less than 200 characters']
  }

  // Date validation
  if (!data.date) {
    errors.date = ['Transaction date is required']
  } else if (data.date > new Date()) {
    errors.date = ['Transaction date cannot be in the future']
  }

  // Household contribution validation
  if (data.sharedWithHousehold && data.householdContribution !== undefined) {
    if (data.householdContribution < 0) {
      errors.householdContribution = ['Household contribution cannot be negative']
    } else if (data.householdContribution > data.amount!) {
      errors.householdContribution = ['Household contribution cannot exceed total amount']
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validate category form data
 */
export function validateCategory(data: Partial<CategoryFormData>): ValidationResult {
  const errors: Record<string, string[]> = {}

  // Name validation
  if (!data.name?.trim()) {
    errors.name = ['Category name is required']
  } else if (data.name.trim().length < 2) {
    errors.name = ['Category name must be at least 2 characters']
  } else if (data.name.trim().length > 30) {
    errors.name = ['Category name must be less than 30 characters']
  }

  // Type validation
  if (!data.type) {
    errors.type = ['Category type is required']
  } else if (!['income', 'expense'].includes(data.type)) {
    errors.type = ['Invalid category type']
  }

  // Color validation
  if (!data.color?.trim()) {
    errors.color = ['Color is required']
  } else if (!/^#[0-9A-F]{6}$/i.test(data.color)) {
    errors.color = ['Color must be a valid hex color']
  }

  // Icon validation
  if (!data.icon?.trim()) {
    errors.icon = ['Icon is required']
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validate amount input string
 */
export function validateAmountInput(input: string): {
  isValid: boolean
  parsed?: number
  error?: string
} {
  if (!input.trim()) {
    return { isValid: false, error: 'Amount is required' }
  }

  // Remove currency symbols and spaces for parsing
  const cleaned = input
    .replace(/[,$\s]/g, '')
    .replace(/[.]/g, '') // Remove thousands separators
    .replace(/,/g, '.') // Convert comma decimals to dots

  const parsed = parseFloat(cleaned)

  if (isNaN(parsed)) {
    return { isValid: false, error: 'Invalid amount format' }
  }

  if (parsed <= 0) {
    return { isValid: false, error: 'Amount must be positive' }
  }

  if (parsed > 999999999) {
    return { isValid: false, error: 'Amount is too large' }
  }

  return { isValid: true, parsed }
}

/**
 * Validate credit card closing day
 */
export function validateClosingDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31
}

/**
 * Validate due day offset
 */
export function validateDueDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31
}

/**
 * Validate hex color
 */
export function validateHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color)
}

/**
 * Sanitize and validate description
 */
export function sanitizeDescription(description: string): string {
  return description
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .slice(0, 200) // Limit to 200 characters
}

/**
 * Validate wallet type specific fields
 */
export function validateWalletTypeFields(
  type: WalletType,
  data: Partial<WalletFormData>
): ValidationResult {
  const errors: Record<string, string[]> = {}

  switch (type) {
    case 'credit_card':
      if (!data.creditLimit || data.creditLimit <= 0) {
        errors.creditLimit = ['Credit limit is required and must be positive']
      }
      break
    
    case 'bank':
      if (!data.bankName?.trim()) {
        errors.bankName = ['Bank name is required']
      }
      if (data.balance === undefined) {
        errors.balance = ['Initial balance is required']
      }
      break
    
    case 'physical':
      if (data.balance === undefined) {
        errors.balance = ['Initial balance is required']
      }
      break
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}