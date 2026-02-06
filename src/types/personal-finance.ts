// Personal Finance Module Types
// These types are extracted from db.ts for better organization and reusability

export type WalletType = 'physical' | 'bank' | 'credit_card'
export type CurrencyType = 'ARS' | 'USD'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'pending' | 'completed' | 'cancelled'
export type CategoryType = 'income' | 'expense'
export type StatementStatus = 'open' | 'closed' | 'paid' | 'overdue'

export interface PersonalWallet {
  id?: string
  userId: string               // Owner
  name: string                 // "Billetera Personal", "Santander Cuenta Corriente"
  type: WalletType
  currency: CurrencyType
  
  // Balance tracking
  balance: number              // Current balance (not for credit cards)
  
  // Credit Card Specific
  creditLimit?: number         // Total credit limit
  closingDay?: number         // Day of month (1-31) 
  dueDay?: number            // Days after closing (typically 15-20)
  
  // Bank Specific
  accountNumber?: string      // Masked: "****1234"
  bankName?: string          // "Banco Santander", "BBVA", etc
  
  // UI/UX
  color: string             // Hex color for identification
  icon: string              // Icon identifier
  
  // Status & Metadata
  isActive: boolean         // Active/Inactive
  notes?: string          // User notes about this wallet
  
  // Audit
  createdAt: Date
  updatedAt: Date
}

export interface PersonalCategory {
  id?: string
  userId: string            
  name: string              // "Comida", "Transporte", "Salud"
  type: CategoryType
  
  // UI/UX
  color: string
  icon: string
  
  // Status
  isActive: boolean
  isDefault: boolean       // System default category
  
  // Audit
  createdAt: Date
  updatedAt: Date
}

export interface PersonalTransaction {
  id?: string
  userId: string
  
  // Core transaction data
  type: TransactionType
  amount: number            // Always positive, use type for direction
  currency: CurrencyType
  
  // Account relationships
  walletId: string          // Source/destination wallet
  targetWalletId?: string   // For transfers
  categoryId: string
  
  // Transaction details
  description: string
  
  // Exchange rate (for currency conversions)
  exchangeRate?: number
  
  // Timing
  date: Date               // Transaction date
  
  // Credit Card Integration
  creditCardStatementId?: string
  isFromCreditCard: boolean
  
  // Household Integration
  sharedWithHousehold: boolean
  householdContribution?: number
  
  // Status and workflow
  status: TransactionStatus
  
  // Metadata
  notes?: string
  
  // Audit
  createdAt: Date
  updatedAt: Date
}

export interface CreditCardStatement {
  id?: string
  userId: string
  walletId: string          // Credit card wallet
  
  // Period definition
  periodStart: Date
  periodEnd: Date           // Closing date
  dueDate: Date            // Payment due date
  
  // Financial summary
  totalCharges: number     // New charges this period
  totalPayments: number    // Payments received
  currentBalance: number   // Total amount due
  minimumPayment: number   // Minimum payment required
  currency: CurrencyType   // Statement currency
  
  // Payment tracking
  paidAmount: number
  paidDate?: Date
  
  // Status workflow
  status: StatementStatus
  
  createdAt: Date
  updatedAt: Date
}

export interface CreditCardPayment {
  id?: string
  userId: string            // Owner of the payment
  statementId: string       // Reference to CreditCardStatement
  fromWalletId: string      // Wallet used to make the payment
  
  amount: number            // Payment amount
  currency: CurrencyType   // Payment currency
  paymentDate: Date         // When the payment was made
  
  notes?: string           // Optional payment notes
  
  createdAt: Date
  updatedAt: Date
}

// Default categories for Personal Finance
export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'Briefcase', color: '#22c55e' },
  { name: 'Freelance', icon: 'Laptop', color: '#3b82f6' },
  { name: 'Investment', icon: 'TrendingUp', color: '#8b5cf6' },
  { name: 'Bonus', icon: 'Gift', color: '#f59e0b' },
  { name: 'Other Income', icon: 'Plus', color: '#6b7280' }
] as const

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'UtensilsCrossed', color: '#ef4444' },
  { name: 'Transportation', icon: 'Car', color: '#3b82f6' },
  { name: 'Shopping', icon: 'ShoppingBag', color: '#ec4899' },
  { name: 'Entertainment', icon: 'Film', color: '#8b5cf6' },
  { name: 'Health & Medical', icon: 'Heart', color: '#10b981' },
  { name: 'Bills & Utilities', icon: 'Receipt', color: '#f59e0b' },
  { name: 'Education', icon: 'GraduationCap', color: '#06b6d4' },
  { name: 'Personal Care', icon: 'Scissors', color: '#ec4899' },
  { name: 'Travel', icon: 'Plane', color: '#84cc16' },
  { name: 'Other Expenses', icon: 'MoreHorizontal', color: '#6b7280' }
] as const

// Validation interfaces
export interface WalletFormData {
  name: string
  type: WalletType
  currency: CurrencyType
  balance?: number
  creditLimit?: number
  closingDay?: number
  dueDay?: number
  accountNumber?: string
  bankName?: string
  color: string
  icon: string
  notes?: string
}

export interface TransactionFormData {
  type: TransactionType
  amount: number
  currency: CurrencyType
  walletId: string
  targetWalletId?: string
  categoryId: string
  description: string
  date: Date
  sharedWithHousehold: boolean
  householdContribution?: number
  notes?: string
}

export interface CategoryFormData {
  name: string
  type: CategoryType
  color: string
  icon: string
}

// Helper types for UI components
export interface WalletBalance {
  walletId: string
  balance: number
  currency: CurrencyType
}

export interface MonthlyExpensesSummary {
  month: number
  year: number
  totalExpenses: number
  currency: CurrencyType
  categoryBreakdown: Array<{
    categoryId: string
    categoryName: string
    amount: number
  }>
}

export interface CreditCardSummary {
  walletId: string
  walletName: string
  currentStatement: CreditCardStatement | null
  nextDueDate: Date | null
  totalBalance: number
  minimumPayment: number
  availableCredit: number
}