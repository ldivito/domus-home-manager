// Credit Card Payment Management - Handle credit card payments and statement updates

import { db } from '@/lib/db'
import { 
  CreditCardPayment, 
  CreditCardStatement, 
  PersonalWallet,
  PersonalTransaction
} from '@/types/personal-finance'
import { 
  generatePaymentId, 
  generateTransactionId,
  validateSufficientFunds,
  updateWalletBalanceInDb
} from './helpers'
import { updateStatementTotals } from './credit-card-statements'

/**
 * Process credit card payment
 */
export async function processCreditCardPayment(
  statementId: string,
  fromWalletId: string,
  amount: number,
  paymentDate: Date = new Date(),
  notes?: string
): Promise<{
  payment: CreditCardPayment
  transaction: PersonalTransaction
  updatedStatement: CreditCardStatement
}> {
  // Validate inputs
  const statement = await db.creditCardStatements.get(statementId)
  if (!statement) {
    throw new Error('Credit card statement not found')
  }

  const fromWallet = await db.personalWallets.get(fromWalletId)
  if (!fromWallet || !fromWallet.isActive) {
    throw new Error('Source wallet not found or inactive')
  }

  const creditCardWallet = await db.personalWallets.get(statement.walletId)
  if (!creditCardWallet) {
    throw new Error('Credit card wallet not found')
  }

  // Validate payment amount
  if (amount <= 0) {
    throw new Error('Payment amount must be positive')
  }

  if (amount > statement.currentBalance) {
    throw new Error('Payment amount cannot exceed statement balance')
  }

  // Check sufficient funds (for non-credit card source wallets)
  const fundsCheck = await validateSufficientFunds(fromWalletId, amount)
  if (!fundsCheck.isValid) {
    throw new Error(fundsCheck.error || 'Insufficient funds')
  }

  try {
    // Create payment record
    const paymentId = generatePaymentId()
    const payment: CreditCardPayment = {
      id: paymentId,
      userId: statement.userId,
      statementId,
      fromWalletId,
      amount,
      currency: fromWallet.currency,
      paymentDate,
      notes,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await db.creditCardPayments.add(payment)

    // Create transaction for the payment source (debit from source wallet)
    const sourceTransactionId = generateTransactionId()
    
    // Find or create a "Credit Card Payment" category
    let paymentCategory = await db.personalCategories
      .where('userId')
      .equals(statement.userId)
      .and(c => c.name === 'Credit Card Payment' && c.type === 'expense')
      .first()

    if (!paymentCategory) {
      const categoryId = `pc_${crypto.randomUUID()}`
      paymentCategory = {
        id: categoryId,
        userId: statement.userId,
        name: 'Credit Card Payment',
        type: 'expense',
        color: '#ef4444',
        icon: 'CreditCard',
        isActive: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      await db.personalCategories.add(paymentCategory)
    }

    const sourceTransaction: PersonalTransaction = {
      id: sourceTransactionId,
      userId: statement.userId,
      type: 'expense',
      amount,
      currency: fromWallet.currency,
      walletId: fromWalletId,
      categoryId: paymentCategory.id!,
      description: `Credit card payment - ${creditCardWallet.name}`,
      date: paymentDate,
      isFromCreditCard: false,
      sharedWithHousehold: false,
      status: 'completed',
      notes: `Payment for statement ${statementId}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await db.personalTransactions.add(sourceTransaction)

    // Update source wallet balance (subtract payment)
    await updateWalletBalanceInDb(fromWalletId, amount, 'expense', 'ARS')

    // Create corresponding credit transaction for credit card (reduces debt)
    const creditTransactionId = generateTransactionId()
    let creditReceivedCategory = await db.personalCategories
      .where('userId')
      .equals(statement.userId)
      .and(c => c.name === 'Payment Received' && c.type === 'income')
      .first()

    if (!creditReceivedCategory) {
      const categoryId = `pc_${crypto.randomUUID()}`
      creditReceivedCategory = {
        id: categoryId,
        userId: statement.userId,
        name: 'Payment Received',
        type: 'income',
        color: '#10b981',
        icon: 'TrendingUp',
        isActive: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      await db.personalCategories.add(creditReceivedCategory)
    }

    const creditTransaction: PersonalTransaction = {
      id: creditTransactionId,
      userId: statement.userId,
      type: 'income', // Payment reduces debt, so it's "income" for the credit card
      amount,
      currency: creditCardWallet.currency,
      walletId: statement.walletId,
      categoryId: creditReceivedCategory.id!,
      description: `Payment received from ${fromWallet.name}`,
      date: paymentDate,
      creditCardStatementId: statementId,
      isFromCreditCard: true,
      sharedWithHousehold: false,
      status: 'completed',
      notes: `Payment for statement ${statementId}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await db.personalTransactions.add(creditTransaction)

    // Update credit card balance (payment reduces debt - balance becomes less negative)
    await updateWalletBalanceInDb(statement.walletId, amount, 'income', 'ARS')

    // Update statement with payment
    const updatedPaidAmount = statement.paidAmount + amount
    const newStatus = updatedPaidAmount >= statement.currentBalance ? 'paid' : statement.status

    await db.creditCardStatements.update(statementId, {
      paidAmount: updatedPaidAmount,
      paidDate: updatedPaidAmount >= statement.currentBalance ? paymentDate : statement.paidDate,
      status: newStatus,
      updatedAt: new Date()
    })

    // Update statement totals (this will recalculate with the new payment)
    await updateStatementTotals(statementId)

    // Get updated statement
    const updatedStatement = await db.creditCardStatements.get(statementId)
    if (!updatedStatement) {
      throw new Error('Failed to retrieve updated statement')
    }

    return {
      payment,
      transaction: sourceTransaction,
      updatedStatement
    }

  } catch (error) {
    console.error('Error processing credit card payment:', error)
    throw error
  }
}

/**
 * Make minimum payment on credit card statement
 */
export async function makeMinimumPayment(
  statementId: string,
  fromWalletId: string,
  paymentDate: Date = new Date(),
  notes?: string
): Promise<{
  payment: CreditCardPayment
  transaction: PersonalTransaction
  updatedStatement: CreditCardStatement
}> {
  const statement = await db.creditCardStatements.get(statementId)
  if (!statement) {
    throw new Error('Statement not found')
  }

  return await processCreditCardPayment(
    statementId,
    fromWalletId,
    statement.minimumPayment,
    paymentDate,
    notes || 'Minimum payment'
  )
}

/**
 * Pay full statement balance
 */
export async function payFullBalance(
  statementId: string,
  fromWalletId: string,
  paymentDate: Date = new Date(),
  notes?: string
): Promise<{
  payment: CreditCardPayment
  transaction: PersonalTransaction
  updatedStatement: CreditCardStatement
}> {
  const statement = await db.creditCardStatements.get(statementId)
  if (!statement) {
    throw new Error('Statement not found')
  }

  const remainingBalance = statement.currentBalance - statement.paidAmount

  return await processCreditCardPayment(
    statementId,
    fromWalletId,
    remainingBalance,
    paymentDate,
    notes || 'Full balance payment'
  )
}

/**
 * Get payment history for a credit card
 */
export async function getCreditCardPaymentHistory(
  walletId: string,
  limit: number = 10
): Promise<Array<{
  payment: CreditCardPayment
  statement: CreditCardStatement
  sourceWallet: PersonalWallet
}>> {
  // Get statements for this wallet
  const statements = await db.creditCardStatements
    .where('walletId')
    .equals(walletId)
    .reverse()
    .sortBy('createdAt')

  const payments = []

  for (const statement of statements.slice(0, limit)) {
    const statementPayments = await db.creditCardPayments
      .where('statementId')
      .equals(statement.id!)
      .toArray()

    for (const payment of statementPayments) {
      const sourceWallet = await db.personalWallets.get(payment.fromWalletId)
      if (sourceWallet) {
        payments.push({
          payment,
          statement,
          sourceWallet
        })
      }
    }
  }

  // Sort by payment date (most recent first)
  return payments.sort((a, b) => 
    b.payment.paymentDate.getTime() - a.payment.paymentDate.getTime()
  ).slice(0, limit)
}

/**
 * Get suggested payment amounts for a statement
 */
export async function getSuggestedPayments(
  statementId: string
): Promise<{
  minimum: number
  full: number
  suggested: number // 50% of balance or minimum payment + $50, whichever is higher
  custom: boolean
}> {
  const statement = await db.creditCardStatements.get(statementId)
  if (!statement) {
    throw new Error('Statement not found')
  }

  const remainingBalance = statement.currentBalance - statement.paidAmount
  const minimum = Math.min(statement.minimumPayment, remainingBalance)
  const full = remainingBalance
  
  // Suggested: Pay 50% of balance, or minimum + $50, whichever is higher
  const halfBalance = remainingBalance * 0.5
  const minimumPlus50 = minimum + 50
  const suggested = Math.min(Math.max(halfBalance, minimumPlus50), remainingBalance)

  return {
    minimum,
    full,
    suggested: Math.max(suggested, minimum),
    custom: true
  }
}

/**
 * Validate payment amount for a statement
 */
export async function validatePaymentAmount(
  statementId: string,
  amount: number
): Promise<{
  isValid: boolean
  error?: string
  warnings: string[]
}> {
  const statement = await db.creditCardStatements.get(statementId)
  if (!statement) {
    return { isValid: false, error: 'Statement not found', warnings: [] }
  }

  const warnings: string[] = []
  const remainingBalance = statement.currentBalance - statement.paidAmount

  if (amount <= 0) {
    return { isValid: false, error: 'Payment amount must be positive', warnings }
  }

  if (amount > remainingBalance) {
    return { 
      isValid: false, 
      error: `Payment amount (${amount.toLocaleString()}) exceeds remaining balance (${remainingBalance.toLocaleString()})`,
      warnings 
    }
  }

  // Add warnings for payment strategies
  if (amount < statement.minimumPayment) {
    warnings.push(`Payment is below minimum required payment of ${statement.minimumPayment.toLocaleString()}`)
  }

  if (amount === statement.minimumPayment && remainingBalance > statement.minimumPayment) {
    warnings.push('Paying only the minimum will result in interest charges')
  }

  if (amount < remainingBalance * 0.1) {
    warnings.push('Consider paying more to reduce interest charges')
  }

  return { isValid: true, warnings }
}

/**
 * Get payment statistics for a credit card
 */
export async function getCreditCardPaymentStats(
  walletId: string,
  months: number = 6
): Promise<{
  totalPayments: number
  averagePayment: number
  totalAmountPaid: number
  onTimePayments: number
  latePayments: number
  fullBalancePayments: number
  minimumPayments: number
  paymentCount: number
}> {
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - months)

  // Get statements from the last N months
  const statements = await db.creditCardStatements
    .where('walletId')
    .equals(walletId)
    .and(s => s.createdAt >= cutoffDate)
    .toArray()

  let totalAmountPaid = 0
  let onTimePayments = 0
  let latePayments = 0
  let fullBalancePayments = 0
  let minimumPayments = 0
  let paymentCount = 0

  for (const statement of statements) {
    const payments = await db.creditCardPayments
      .where('statementId')
      .equals(statement.id!)
      .toArray()

    for (const payment of payments) {
      paymentCount++
      totalAmountPaid += payment.amount
      
      // Check if payment was on time
      if (payment.paymentDate <= statement.dueDate) {
        onTimePayments++
      } else {
        latePayments++
      }

      // Check payment type
      if (payment.amount >= statement.currentBalance) {
        fullBalancePayments++
      } else if (Math.abs(payment.amount - statement.minimumPayment) < 1) {
        minimumPayments++
      }
    }
  }

  const averagePayment = paymentCount > 0 ? totalAmountPaid / paymentCount : 0

  return {
    totalPayments: paymentCount,
    averagePayment,
    totalAmountPaid,
    onTimePayments,
    latePayments,
    fullBalancePayments,
    minimumPayments,
    paymentCount
  }
}

/**
 * Schedule automatic payment (placeholder for future implementation)
 */
export async function scheduleAutomaticPayment(
  walletId: string,
  sourceWalletId: string,
  paymentType: 'minimum' | 'full' | 'fixed',
  fixedAmount?: number,
  daysBefore: number = 3
): Promise<{ scheduled: boolean; nextPaymentDate: Date }> {
  // This would integrate with a job scheduler in a real implementation
  // For now, we'll just return a placeholder
  
  const nextPaymentDate = new Date()
  nextPaymentDate.setDate(nextPaymentDate.getDate() + 30 - daysBefore)

  // TODO: Implement with cron jobs or database-based scheduling
  console.log(`Automatic payment scheduled for wallet ${walletId}`, {
    sourceWalletId,
    paymentType,
    fixedAmount,
    daysBefore,
    nextPaymentDate
  })

  return {
    scheduled: true,
    nextPaymentDate
  }
}