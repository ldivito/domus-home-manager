// Credit Card Statement Management - Automatic statement generation and management

import { db } from '@/lib/db'
import { 
  CreditCardStatement, 
  PersonalTransaction, 
  PersonalWallet
} from '@/types/personal-finance'
import { generateStatementId } from './helpers'

/**
 * Get or create current statement for a credit card
 */
export async function getCurrentStatement(walletId: string): Promise<CreditCardStatement> {
  const wallet = await db.personalWallets.get(walletId)
  if (!wallet || wallet.type !== 'credit_card') {
    throw new Error('Invalid credit card wallet')
  }

  const now = new Date()
  
  // Try to find existing open statement
  let statement = await db.creditCardStatements
    .where('walletId')
    .equals(walletId)
    .and(s => s.status === 'open')
    .first()

  if (!statement) {
    // Create new statement
    statement = await createNewStatement(wallet, now)
  }

  return statement
}

/**
 * Create new credit card statement
 */
export async function createNewStatement(
  wallet: PersonalWallet,
  currentDate: Date = new Date()
): Promise<CreditCardStatement> {
  if (!wallet.closingDay || !wallet.dueDay) {
    throw new Error('Credit card missing closing/due day configuration')
  }

  const { periodStart, periodEnd, dueDate } = calculateStatementPeriod(
    wallet.closingDay,
    wallet.dueDay,
    currentDate
  )

  const statementId = generateStatementId()

  const statement: CreditCardStatement = {
    id: statementId,
    userId: wallet.userId,
    walletId: wallet.id!,
    periodStart,
    periodEnd,
    dueDate,
    totalCharges: 0,
    totalPayments: 0,
    currentBalance: 0,
    minimumPayment: 0,
    currency: wallet.currency,
    paidAmount: 0,
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  await db.creditCardStatements.add(statement)
  return statement
}

/**
 * Calculate statement period dates
 */
export function calculateStatementPeriod(
  closingDay: number,
  dueDay: number,
  currentDate: Date = new Date()
): {
  periodStart: Date
  periodEnd: Date
  dueDate: Date
} {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Calculate period end (closing date)
  let periodEnd = new Date(year, month, closingDay, 23, 59, 59)
  
  // If today is past closing day, use next month
  if (currentDate.getDate() > closingDay) {
    periodEnd = new Date(year, month + 1, closingDay, 23, 59, 59)
  }

  // Period start is previous month's closing + 1 day
  const periodStart = new Date(periodEnd)
  periodStart.setMonth(periodStart.getMonth() - 1)
  periodStart.setDate(periodStart.getDate() + 1)
  periodStart.setHours(0, 0, 0, 0)

  // Due date is dueDay days after closing
  const dueDate = new Date(periodEnd)
  dueDate.setDate(dueDate.getDate() + dueDay)

  return { periodStart, periodEnd, dueDate }
}

/**
 * Add transaction to credit card statement
 */
export async function addTransactionToStatement(
  transaction: PersonalTransaction
): Promise<void> {
  if (!transaction.isFromCreditCard) return

  const statement = await getCurrentStatement(transaction.walletId)
  
  // Check if transaction falls within current statement period
  if (transaction.date >= statement.periodStart && 
      transaction.date <= statement.periodEnd) {
    
    // Add to current statement
    transaction.creditCardStatementId = statement.id
    await db.personalTransactions.update(transaction.id!, {
      creditCardStatementId: statement.id
    })

    // Update statement totals
    await updateStatementTotals(statement.id!)
  }
}

/**
 * Update statement totals from transactions
 */
export async function updateStatementTotals(statementId: string): Promise<void> {
  const statement = await db.creditCardStatements.get(statementId)
  if (!statement) return

  // Get all transactions for this statement
  const transactions = await db.personalTransactions
    .where('creditCardStatementId')
    .equals(statementId)
    .toArray()

  const totalCharges = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalPayments = transactions
    .filter(t => t.type === 'income') // Credit card payments show as income
    .reduce((sum, t) => sum + t.amount, 0)

  const currentBalance = totalCharges - totalPayments

  // Calculate minimum payment (typically 5% of balance or minimum $20)
  const minimumPayment = Math.max(currentBalance * 0.05, 20)

  await db.creditCardStatements.update(statementId, {
    totalCharges,
    totalPayments,
    currentBalance,
    minimumPayment,
    updatedAt: new Date()
  })
}

/**
 * Close current statement and create next one
 */
export async function closeStatement(statementId: string): Promise<CreditCardStatement> {
  const statement = await db.creditCardStatements.get(statementId)
  if (!statement) {
    throw new Error('Statement not found')
  }

  const wallet = await db.personalWallets.get(statement.walletId)
  if (!wallet) {
    throw new Error('Wallet not found')
  }

  // Close current statement
  await db.creditCardStatements.update(statementId, {
    status: 'closed',
    updatedAt: new Date()
  })

  // Create next statement
  const nextStatementDate = new Date(statement.periodEnd)
  nextStatementDate.setDate(nextStatementDate.getDate() + 1)
  
  return await createNewStatement(wallet, nextStatementDate)
}

/**
 * Process automatic statement closings (to be called daily via cron/heartbeat)
 */
export async function processAutomaticStatementClosings(): Promise<{
  closedCount: number
  createdCount: number
  errors: string[]
}> {
  const now = new Date()
  const errors: string[] = []
  let closedCount = 0
  let createdCount = 0

  try {
    // Find all open statements past their closing date
    const overdueStatements = await db.creditCardStatements
      .where('status')
      .equals('open')
      .and(s => s.periodEnd < now)
      .toArray()

    for (const statement of overdueStatements) {
      try {
        // Update totals one final time
        await updateStatementTotals(statement.id!)
        
        // Close the statement
        await closeStatement(statement.id!)
        closedCount++

        // Create next statement
        const wallet = await db.personalWallets.get(statement.walletId)
        if (wallet && wallet.isActive) {
          await createNewStatement(wallet, now)
          createdCount++
        }
      } catch (error) {
        errors.push(`Failed to close statement ${statement.id}: ${error}`)
        console.error('Error closing statement:', error)
      }
    }

    return { closedCount, createdCount, errors }
  } catch (error) {
    errors.push(`General error processing statements: ${error}`)
    return { closedCount: 0, createdCount: 0, errors }
  }
}

/**
 * Get statement summary for wallet
 */
export async function getStatementSummary(walletId: string): Promise<{
  current: CreditCardStatement | null
  upcoming: {
    nextClosingDate: Date
    nextDueDate: Date
    daysUntilClosing: number
    daysUntilDue: number
  }
  recent: CreditCardStatement[]
}> {
  const wallet = await db.personalWallets.get(walletId)
  if (!wallet || wallet.type !== 'credit_card') {
    throw new Error('Invalid credit card wallet')
  }

  // Get current statement
  const current = await getCurrentStatement(walletId)

  // Calculate upcoming dates
  const now = new Date()
  const daysUntilClosing = Math.ceil(
    (current.periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )
  const daysUntilDue = Math.ceil(
    (current.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Get recent statements (last 3)
  const recent = await db.creditCardStatements
    .where('walletId')
    .equals(walletId)
    .and(s => s.status !== 'open')
    .reverse()
    .sortBy('periodEnd')
    .then(statements => statements.slice(0, 3))

  return {
    current,
    upcoming: {
      nextClosingDate: current.periodEnd,
      nextDueDate: current.dueDate,
      daysUntilClosing: Math.max(0, daysUntilClosing),
      daysUntilDue: Math.max(0, daysUntilDue)
    },
    recent
  }
}

/**
 * Get all credit cards with upcoming due dates
 */
export async function getUpcomingDueDates(
  userId: string,
  daysAhead: number = 7
): Promise<Array<{
  wallet: PersonalWallet
  statement: CreditCardStatement
  daysUntilDue: number
  isOverdue: boolean
}>> {
  const now = new Date()
  const futureDate = new Date(now)
  futureDate.setDate(futureDate.getDate() + daysAhead)

  // Get all active credit cards for user
  const creditCards = await db.personalWallets
    .where('userId')
    .equals(userId)
    .and(w => w.type === 'credit_card' && w.isActive)
    .toArray()

  const upcomingDues = []

  for (const wallet of creditCards) {
    try {
      const statement = await getCurrentStatement(wallet.id!)
      
      const daysUntilDue = Math.ceil(
        (statement.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Include if due within the specified days or already overdue
      if (daysUntilDue <= daysAhead || statement.dueDate < now) {
        upcomingDues.push({
          wallet,
          statement,
          daysUntilDue,
          isOverdue: statement.dueDate < now && statement.status !== 'paid'
        })
      }
    } catch (error) {
      console.error(`Error checking due date for wallet ${wallet.id}:`, error)
    }
  }

  // Sort by due date (most urgent first)
  return upcomingDues.sort((a, b) => a.statement.dueDate.getTime() - b.statement.dueDate.getTime())
}