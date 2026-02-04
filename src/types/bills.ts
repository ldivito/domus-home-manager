export interface Bill {
  id: string
  householdId: string
  name: string
  description?: string
  amount: number
  currency: string
  category: string
  dueDate: string // ISO date string
  isRecurring: boolean
  recurringPeriod: 'monthly' | 'weekly' | 'yearly'
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  createdBy: string
  createdAt: string
  updatedAt: string
  createdByName?: string
  paidAmount?: number
}

export interface Payment {
  id: string
  billId: string
  householdId: string
  paidBy: string
  amount: number
  currency: string
  paidAt: string
  paymentMethod?: string
  notes?: string
  createdAt: string
  updatedAt: string
  paidByName?: string
  billName?: string
}

export interface Expense {
  id: string
  householdId: string
  description: string
  amount: number
  currency: string
  category: string
  paidBy: string
  splitBetween: string[] // Array of user IDs
  splitType: 'equal' | 'percentage' | 'amount'
  splitData?: Record<string, number> // User-specific split data
  date: string // ISO date string
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  paidByName?: string
  createdByName?: string
}

export interface Debt {
  fromUser: string
  fromUserName: string
  toUser: string
  toUserName: string
  amount: number
  currency: string
}

export interface DebtSettlement {
  id: string
  householdId: string
  fromUser: string
  toUser: string
  amount: number
  currency: string
  settledAt: string
  notes?: string
  createdAt: string
  fromUserName?: string
  toUserName?: string
}

export interface UserBalance {
  balance: number
  name: string
}

export interface BillCategory {
  id: string
  name: string
  icon?: string
  color?: string
}

export interface ExpenseCategory {
  id: string
  name: string
  icon?: string
  color?: string
}

// Common categories
export const BILL_CATEGORIES: BillCategory[] = [
  { id: 'utilities', name: 'Servicios', icon: '⚡', color: '#fbbf24' },
  { id: 'rent', name: 'Alquiler', icon: '🏠', color: '#8b5cf6' },
  { id: 'internet', name: 'Internet', icon: '🌐', color: '#06b6d4' },
  { id: 'phone', name: 'Teléfono', icon: '📱', color: '#10b981' },
  { id: 'insurance', name: 'Seguro', icon: '🛡️', color: '#f59e0b' },
  { id: 'subscription', name: 'Suscripciones', icon: '📺', color: '#ec4899' },
  { id: 'other', name: 'Otros', icon: '📄', color: '#6b7280' }
]

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'groceries', name: 'Compras', icon: '🛒', color: '#10b981' },
  { id: 'dining', name: 'Comida', icon: '🍽️', color: '#f59e0b' },
  { id: 'transport', name: 'Transporte', icon: '🚗', color: '#06b6d4' },
  { id: 'entertainment', name: 'Entretenimiento', icon: '🎬', color: '#8b5cf6' },
  { id: 'household', name: 'Casa', icon: '🏠', color: '#fbbf24' },
  { id: 'health', name: 'Salud', icon: '🏥', color: '#ef4444' },
  { id: 'other', name: 'Otros', icon: '💰', color: '#6b7280' }
]