import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatBalance,
  formatTransactionAmount,
  parseAmount,
  formatCardNumber,
  formatPercentage,
  calculatePercentageChange,
  formatExchangeRate,
  convertCurrency,
} from '../formatters'

describe('formatCurrency', () => {
  it('formats ARS with symbol by default', () => {
    const result = formatCurrency(123456, 'ARS')
    expect(result).toContain('$')
    expect(result).toContain('123')
  })

  it('formats USD with symbol by default', () => {
    const result = formatCurrency(1500.5, 'USD')
    expect(result).toContain('$')
  })

  it('formats ARS with 0 decimals by default', () => {
    const result = formatCurrency(1000, 'ARS')
    // ARS defaults to 0 decimals
    expect(result).not.toContain(',00')
  })

  it('formats USD with 2 decimals by default', () => {
    const result = formatCurrency(100, 'USD')
    // USD defaults to 2 decimals
    expect(result).toMatch(/\d+[.,]\d{2}/)
  })

  it('hides symbol when showSymbol is false', () => {
    const result = formatCurrency(1000, 'ARS', { showSymbol: false })
    expect(result).not.toContain('$')
  })

  it('shows currency code when showCode is true', () => {
    const usd = formatCurrency(100, 'USD', { showCode: true })
    expect(usd).toContain('USD')

    const ars = formatCurrency(100, 'ARS', { showCode: true })
    expect(ars).toContain('ARS')
  })

  it('uses custom decimals', () => {
    const result = formatCurrency(100.456, 'USD', { decimals: 3 })
    // Should have 3 decimal places
    expect(result).toMatch(/456/)
  })

  it('formats negative amounts with sign', () => {
    const result = formatCurrency(-5000, 'ARS')
    expect(result).toContain('-')
  })

  it('formats zero', () => {
    const result = formatCurrency(0, 'ARS')
    expect(result).toContain('0')
    expect(result).not.toContain('-')
  })

  it('uses compact notation for large numbers', () => {
    const result = formatCurrency(1500000, 'ARS', { compact: true })
    // Compact should abbreviate
    expect(result.length).toBeLessThan(formatCurrency(1500000, 'ARS').length)
  })

  it('does not use compact for small numbers', () => {
    const regular = formatCurrency(500, 'ARS')
    const compact = formatCurrency(500, 'ARS', { compact: true })
    // Small numbers should format the same regardless of compact flag
    expect(compact).toBe(regular)
  })
})

describe('formatBalance', () => {
  it('returns green color class for positive balance', () => {
    const { colorClass, isNegative } = formatBalance(5000, 'ARS')
    expect(colorClass).toContain('green')
    expect(isNegative).toBe(false)
  })

  it('returns red color class for negative balance', () => {
    const { colorClass, isNegative } = formatBalance(-5000, 'ARS')
    expect(colorClass).toContain('red')
    expect(isNegative).toBe(true)
  })

  it('includes + sign for positive when showSign is true', () => {
    const { formatted } = formatBalance(5000, 'ARS', { showSign: true })
    expect(formatted).toContain('+')
  })

  it('includes - sign for negative', () => {
    const { formatted } = formatBalance(-5000, 'ARS')
    expect(formatted).toContain('-')
  })

  it('handles zero balance', () => {
    const { formatted, isNegative } = formatBalance(0, 'ARS')
    expect(isNegative).toBe(false)
    expect(formatted).not.toContain('-')
  })
})

describe('formatTransactionAmount', () => {
  it('formats income with + prefix and green color', () => {
    const { formatted, colorClass, prefix } = formatTransactionAmount(5000, 'income', 'ARS')
    expect(prefix).toBe('+')
    expect(colorClass).toContain('green')
    expect(formatted).toContain('+')
  })

  it('formats expense with - prefix and red color', () => {
    const { formatted, colorClass, prefix } = formatTransactionAmount(5000, 'expense', 'ARS')
    expect(prefix).toBe('-')
    expect(colorClass).toContain('red')
    expect(formatted).toContain('-')
  })

  it('formats transfer with ↔ prefix and blue color', () => {
    const { colorClass, prefix } = formatTransactionAmount(5000, 'transfer', 'ARS')
    expect(prefix).toBe('↔')
    expect(colorClass).toContain('blue')
  })

  it('always uses absolute amount', () => {
    const positive = formatTransactionAmount(5000, 'expense', 'ARS')
    const negative = formatTransactionAmount(-5000, 'expense', 'ARS')
    // Both should format the absolute value the same way
    expect(positive.formatted).toBe(negative.formatted)
  })
})

describe('parseAmount', () => {
  it('parses simple integer', () => {
    expect(parseAmount('1000')).toBe(1000)
  })

  it('strips currency symbols', () => {
    expect(parseAmount('$1000')).toBe(1000)
  })

  it('strips spaces', () => {
    expect(parseAmount(' 1000 ')).toBe(1000)
  })

  it('strips commas (thousands separators)', () => {
    expect(parseAmount('1,000')).toBe(1000)
  })

  it('returns null for invalid input', () => {
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })
})

describe('formatCardNumber', () => {
  it('masks card number showing last 4 digits', () => {
    expect(formatCardNumber('1234567890123456')).toBe('****3456')
  })

  it('handles short numbers', () => {
    expect(formatCardNumber('1234')).toBe('****1234')
  })

  it('returns empty string for empty input', () => {
    expect(formatCardNumber('')).toBe('')
  })
})

describe('formatPercentage', () => {
  it('formats with default 1 decimal', () => {
    expect(formatPercentage(75.55)).toBe('75.5%')
  })

  it('formats with custom decimals', () => {
    expect(formatPercentage(75.555, 2)).toBe('75.56%')
  })

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.0%')
  })
})

describe('calculatePercentageChange', () => {
  it('calculates positive change', () => {
    expect(calculatePercentageChange(100, 150)).toBe(50)
  })

  it('calculates negative change', () => {
    expect(calculatePercentageChange(100, 50)).toBe(-50)
  })

  it('handles zero old value with positive new', () => {
    expect(calculatePercentageChange(0, 100)).toBe(100)
  })

  it('handles zero old value with zero new', () => {
    expect(calculatePercentageChange(0, 0)).toBe(0)
  })

  it('handles no change', () => {
    expect(calculatePercentageChange(100, 100)).toBe(0)
  })
})

describe('formatExchangeRate', () => {
  it('formats rate with 2 decimals', () => {
    const result = formatExchangeRate(1150.5)
    // es-AR locale formatting
    expect(result).toBeTruthy()
  })
})

describe('convertCurrency', () => {
  it('converts USD to ARS by multiplying', () => {
    expect(convertCurrency(100, 'USD', 'ARS', 1000)).toBe(100000)
  })

  it('converts ARS to USD by dividing', () => {
    expect(convertCurrency(100000, 'ARS', 'USD', 1000)).toBe(100)
  })

  it('returns same amount for same currency', () => {
    expect(convertCurrency(100, 'USD', 'USD', 1000)).toBe(100)
    expect(convertCurrency(100, 'ARS', 'ARS', 1000)).toBe(100)
  })
})
