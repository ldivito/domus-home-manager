// Currency and financial formatting utilities

import { CurrencyType } from '@/types/personal-finance'

/**
 * Format currency amount based on type
 */
export function formatCurrency(
  amount: number, 
  currency: CurrencyType, 
  options?: {
    showSymbol?: boolean
    showCode?: boolean
    decimals?: number
    compact?: boolean
  }
): string {
  const {
    showSymbol = true,
    showCode = false,
    decimals = currency === 'USD' ? 2 : 0,
    compact = false
  } = options || {}

  // Handle compact formatting for large numbers
  if (compact && Math.abs(amount) >= 1000) {
    const formatter = new Intl.NumberFormat('es-AR', {
      notation: 'compact',
      maximumFractionDigits: 1
    })
    const compactAmount = formatter.format(amount)
    
    if (currency === 'USD') {
      return showSymbol ? `USD $${compactAmount}` : compactAmount
    } else {
      return showSymbol ? `$${compactAmount}` : compactAmount
    }
  }

  // Standard formatting
  const formatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })

  const formattedAmount = formatter.format(Math.abs(amount))
  const sign = amount < 0 ? '-' : ''

  if (currency === 'USD') {
    const prefix = showCode ? 'USD ' : ''
    const symbol = showSymbol ? '$' : ''
    return `${sign}${prefix}${symbol}${formattedAmount}`
  } else {
    // ARS
    const prefix = showCode ? 'ARS ' : ''
    const symbol = showSymbol ? '$' : ''
    return `${sign}${prefix}${symbol}${formattedAmount}`
  }
}

/**
 * Format balance with color coding
 */
export function formatBalance(
  amount: number,
  currency: CurrencyType,
  options?: {
    showSign?: boolean
    compact?: boolean
  }
): {
  formatted: string
  colorClass: string
  isNegative: boolean
} {
  const { showSign = true, compact = false } = options || {}
  
  const isNegative = amount < 0
  const sign = isNegative ? '-' : (showSign && amount > 0 ? '+' : '')
  
  const formatted = `${sign}${formatCurrency(amount, currency, { compact })}`
  
  const colorClass = isNegative 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-green-600 dark:text-green-400'

  return {
    formatted,
    colorClass,
    isNegative
  }
}

/**
 * Format transaction amount with direction indicators
 */
export function formatTransactionAmount(
  amount: number,
  type: 'income' | 'expense' | 'transfer',
  currency: CurrencyType
): {
  formatted: string
  colorClass: string
  prefix: string
} {
  const absAmount = Math.abs(amount)
  
  let prefix = ''
  let colorClass = ''
  
  switch (type) {
    case 'income':
      prefix = '+'
      colorClass = 'text-green-600 dark:text-green-400'
      break
    case 'expense':
      prefix = '-'
      colorClass = 'text-red-600 dark:text-red-400'
      break
    case 'transfer':
      prefix = '↔'
      colorClass = 'text-blue-600 dark:text-blue-400'
      break
  }

  const formatted = `${prefix}${formatCurrency(absAmount, currency)}`
  
  return {
    formatted,
    colorClass,
    prefix
  }
}

/**
 * Parse user input to amount number
 */
export function parseAmount(input: string): number | null {
  // Remove currency symbols and spaces
  const cleaned = input
    .replace(/[,$\s]/g, '')
    .replace(/[.]/g, '') // Remove thousands separators
    .replace(/,/g, '.') // Convert comma decimals to dots

  const parsed = parseFloat(cleaned)
  
  return isNaN(parsed) ? null : parsed
}

/**
 * Format credit card number (masked)
 */
export function formatCardNumber(cardNumber: string): string {
  if (!cardNumber) return ''
  
  // Only show last 4 digits
  const lastFour = cardNumber.slice(-4)
  return `****${lastFour}`
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100
}

/**
 * Format exchange rate
 */
export function formatExchangeRate(rate: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rate)
}

/**
 * Convert between currencies using exchange rate
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyType,
  toCurrency: CurrencyType,
  exchangeRate: number
): number {
  if (fromCurrency === toCurrency) return amount
  
  if (fromCurrency === 'USD' && toCurrency === 'ARS') {
    return amount * exchangeRate
  } else if (fromCurrency === 'ARS' && toCurrency === 'USD') {
    return amount / exchangeRate
  }
  
  return amount
}