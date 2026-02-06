// Helper functions for Personal Finance operations

import { 
  PersonalWallet, 
  PersonalTransaction, 
  CreditCardStatement,
  CurrencyType,
  WalletType,
  TransactionType 
} from '@/types/personal-finance'

/**
 * Calculate next due date for credit card
 */
export function calculateNextDueDate(
  closingDay: number, 
  dueDay: number, 
  referenceDate: Date = new Date()
): Date {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  
  // Calculate closing date for current month
  const currentClosing = new Date(year, month, closingDay)
  
  // If we're past this month's closing, use next month
  const closingDate = referenceDate > currentClosing 
    ? new Date(year, month + 1, closingDay)
    : currentClosing
  
  // Due date is dueDay days after closing
  const dueDate = new Date(closingDate)
  dueDate.setDate(dueDate.getDate() + dueDay)
  
  return dueDate
}

/**
 * Calculate available credit for credit card
 */
export function calculateAvailableCredit(
  creditLimit: number,
  currentBalance: number
): number {
  return Math.max(0, creditLimit + currentBalance) // currentBalance is negative for debt
}

/**
 * Calculate total balance for a user across all wallets
 */
export function calculateTotalBalance(
  wallets: PersonalWallet[],
  currency?: CurrencyType
): Record<CurrencyType, number> {
  const totals: Record<CurrencyType, number> = { ARS: 0, USD: 0 }
  
  wallets
    .filter(wallet => wallet.isActive)
    .filter(wallet => !currency || wallet.currency === currency)
    .forEach(wallet => {
      // For credit cards, balance is negative (debt), so we add it as is
      totals[wallet.currency] += wallet.balance
    })
  
  return totals
}

/**
 * Get wallet display name with type indicator
 */
export function getWalletDisplayName(wallet: PersonalWallet): string {
  const typeIndicator = getWalletTypeIndicator(wallet.type)
  return `${typeIndicator} ${wallet.name}`
}

/**
 * Get wallet type indicator
 */
export function getWalletTypeIndicator(type: WalletType): string {
  switch (type) {
    case 'physical': return '💰'
    case 'bank': return '🏦'
    case 'credit_card': return '💳'
    default: return '💼'
  }
}

/**
 * Get transaction type indicator
 */
export function getTransactionTypeIndicator(type: TransactionType): string {
  switch (type) {
    case 'income': return '📈'
    case 'expense': return '📉'
    case 'transfer': return '🔄'
    default: return '💰'
  }
}

/**
 * Update wallet balance after transaction
 */
export function updateWalletBalance(
  currentBalance: number,
  transaction: Pick<PersonalTransaction, 'type' | 'amount'>,
  isSourceWallet: boolean = true
): number {
  const { type, amount } = transaction
  
  switch (type) {
    case 'income':
      return currentBalance + amount
    
    case 'expense':
      return currentBalance - amount
    
    case 'transfer':
      // If this is source wallet, subtract; if target wallet, add
      return isSourceWallet 
        ? currentBalance - amount 
        : currentBalance + amount
    
    default:
      return currentBalance
  }
}

/**
 * Group transactions by month for reporting
 */
export function groupTransactionsByMonth(
  transactions: PersonalTransaction[]
): Record<string, PersonalTransaction[]> {
  return transactions.reduce((groups, transaction) => {
    const monthKey = `${transaction.date.getFullYear()}-${transaction.date.getMonth() + 1}`
    if (!groups[monthKey]) {
      groups[monthKey] = []
    }
    groups[monthKey].push(transaction)
    return groups
  }, {} as Record<string, PersonalTransaction[]>)
}

/**
 * Calculate monthly totals by category
 */
export function calculateMonthlyTotals(
  transactions: PersonalTransaction[]
): {
  totalIncome: number
  totalExpenses: number
  netIncome: number
  categoryTotals: Record<string, number>
} {
  let totalIncome = 0
  let totalExpenses = 0
  const categoryTotals: Record<string, number> = {}
  
  transactions.forEach(transaction => {
    const { type, amount, categoryId } = transaction
    
    if (type === 'income') {
      totalIncome += amount
    } else if (type === 'expense') {
      totalExpenses += amount
    }
    
    // Skip transfers for category totals
    if (type !== 'transfer') {
      if (!categoryTotals[categoryId]) {
        categoryTotals[categoryId] = 0
      }
      categoryTotals[categoryId] += amount
    }
  })
  
  return {
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    categoryTotals
  }
}

/**
 * Check if credit card statement is overdue
 */
export function isStatementOverdue(statement: CreditCardStatement): boolean {
  const now = new Date()
  return statement.status !== 'paid' && statement.dueDate < now
}

/**
 * Get credit card status based on balance and limits
 */
export function getCreditCardStatus(wallet: PersonalWallet): {
  status: 'healthy' | 'warning' | 'critical'
  message: string
} {
  if (wallet.type !== 'credit_card' || !wallet.creditLimit) {
    return { status: 'healthy', message: 'N/A' }
  }
  
  const usedCredit = Math.abs(wallet.balance)
  const usagePercentage = (usedCredit / wallet.creditLimit) * 100
  
  if (usagePercentage >= 90) {
    return { status: 'critical', message: 'Near credit limit' }
  } else if (usagePercentage >= 70) {
    return { status: 'warning', message: 'High credit usage' }
  } else {
    return { status: 'healthy', message: 'Good credit usage' }
  }
}

/**
 * Generate wallet color if not provided
 */
export function generateWalletColor(type: WalletType, index: number = 0): string {
  const colors = {
    physical: ['#10b981', '#059669', '#047857'],
    bank: ['#3b82f6', '#2563eb', '#1d4ed8'],
    credit_card: ['#ef4444', '#dc2626', '#b91c1c']
  }
  
  const typeColors = colors[type]
  return typeColors[index % typeColors.length]
}

/**
 * Generate transaction ID
 */
export function generateTransactionId(): string {
  return `pt_${crypto.randomUUID()}`
}

/**
 * Generate wallet ID
 */
export function generateWalletId(): string {
  return `pw_${crypto.randomUUID()}`
}

/**
 * Generate category ID
 */
export function generateCategoryId(): string {
  return `pc_${crypto.randomUUID()}`
}

/**
 * Generate credit card statement ID
 */
export function generateStatementId(): string {
  return `ccs_${crypto.randomUUID()}`
}

/**
 * Generate credit card payment ID
 */
export function generatePaymentId(): string {
  return `ccp_${crypto.randomUUID()}`
}

/**
 * Filter transactions by date range
 */
export function filterTransactionsByDateRange(
  transactions: PersonalTransaction[],
  startDate: Date,
  endDate: Date
): PersonalTransaction[] {
  return transactions.filter(transaction => 
    transaction.date >= startDate && transaction.date <= endDate
  )
}

/**
 * Get current month start and end dates
 */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  
  return { start, end }
}

/**
 * Get last N months date range
 */
export function getLastNMonthsRange(months: number): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  
  return { start, end }
}

/**
 * Calculate days until due date
 */
export function getDaysUntilDue(dueDate: Date): number {
  const now = new Date()
  const diffTime = dueDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Sort transactions by date (newest first)
 */
export function sortTransactionsByDate(
  transactions: PersonalTransaction[]
): PersonalTransaction[] {
  return [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime())
}

/**
 * Sort wallets by type and name
 */
export function sortWallets(wallets: PersonalWallet[]): PersonalWallet[] {
  const typeOrder: Record<WalletType, number> = {
    bank: 0,
    physical: 1,
    credit_card: 2
  }
  
  return [...wallets].sort((a, b) => {
    // First sort by type
    const typeComparison = typeOrder[a.type] - typeOrder[b.type]
    if (typeComparison !== 0) return typeComparison
    
    // Then sort by name
    return a.name.localeCompare(b.name)
  })
}

/**
 * Validate if wallet has sufficient funds for a transaction
 */
export async function validateSufficientFunds(
  walletId: string,
  amount: number,
  _currency?: CurrencyType
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const { db } = await import('@/lib/db')
    
    const wallet = await db.personalWallets.get(walletId)
    if (!wallet) {
      return { isValid: false, error: 'Wallet not found' }
    }

    // For credit cards, check against credit limit
    if (wallet.type === 'credit_card') {
      const currentBalance = wallet.balance || 0
      const creditLimit = wallet.creditLimit || 0
      const availableCredit = creditLimit + currentBalance // balance is negative for credit cards
      
      if (availableCredit < amount) {
        return { isValid: false, error: 'Insufficient credit limit' }
      }
    } else {
      // For physical and bank accounts, check against current balance
      if ((wallet.balance || 0) < amount) {
        return { isValid: false, error: 'Insufficient funds' }
      }
    }

    return { isValid: true }
  } catch (_error) {
    return { isValid: false, error: 'Error checking funds' }
  }
}

/**
 * Update wallet balance in database (async wrapper for updateWalletBalance)
 */
export async function updateWalletBalanceInDb(
  walletId: string,
  amount: number,
  type: TransactionType,
  _currency: CurrencyType
): Promise<PersonalWallet | null> {
  try {
    const { db } = await import('@/lib/db')
    
    const wallet = await db.personalWallets.get(walletId)
    if (!wallet) return null

    const newBalance = updateWalletBalance(wallet.balance || 0, { type, amount }, true)
    const updatedWallet = { ...wallet, balance: newBalance, updatedAt: new Date() }
    await db.personalWallets.put(updatedWallet)
    
    return updatedWallet
  } catch (error) {
    console.error('Error updating wallet balance:', error)
    return null
  }
}