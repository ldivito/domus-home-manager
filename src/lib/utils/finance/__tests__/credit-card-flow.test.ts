// Credit Card Flow Tests - Complete flow testing for Phase 4 functionality

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { db } from '@/lib/db'
import { 
  PersonalWallet, 
  PersonalCategory, 
  PersonalTransaction,
  CreditCardStatement
} from '@/types/personal-finance'

// Import functions to test
import {
  getCurrentStatement,
  createNewStatement,
  calculateStatementPeriod,
  addTransactionToStatement,
  updateStatementTotals,
  closeStatement
} from '../credit-card-statements'

import {
  processCreditCardPayment,
  makeMinimumPayment,
  payFullBalance,
  getSuggestedPayments,
  validatePaymentAmount,
  getCreditCardPaymentStats
} from '../credit-card-payments'

import {
  generateDueNotifications,
  generateCreditUsageNotifications,
  getAllCreditCardNotifications,
  getNotificationSummary
} from '../credit-card-notifications'

// Test data
const testUserId = 'test-user-123'
const testCreditCardWallet: PersonalWallet = {
  id: 'cc-wallet-1',
  userId: testUserId,
  name: 'Test Visa Card',
  type: 'credit_card',
  currency: 'ARS',
  balance: -50000, // $50k debt
  creditLimit: 100000,
  closingDay: 15,
  dueDay: 20,
  color: '#ef4444',
  icon: 'CreditCard',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const testBankWallet: PersonalWallet = {
  id: 'bank-wallet-1',
  userId: testUserId,
  name: 'Test Bank Account',
  type: 'bank',
  currency: 'ARS',
  balance: 150000, // $150k available
  color: '#3b82f6',
  icon: 'Building',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const testCategory: PersonalCategory = {
  id: 'cat-expense-1',
  userId: testUserId,
  name: 'Shopping',
  type: 'expense',
  color: '#ec4899',
  icon: 'ShoppingBag',
  isActive: true,
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('Credit Card Flow - Phase 4', () => {
  beforeEach(async () => {
    // Clear test data
    await db.creditCardStatements.clear()
    await db.creditCardPayments.clear()
    await db.personalTransactions.clear()
    await db.personalWallets.clear()
    await db.personalCategories.clear()

    // Add test data
    await db.personalWallets.add(testCreditCardWallet)
    await db.personalWallets.add(testBankWallet)
    await db.personalCategories.add(testCategory)
  })

  afterEach(async () => {
    // Clean up
    await db.creditCardStatements.clear()
    await db.creditCardPayments.clear()
    await db.personalTransactions.clear()
    await db.personalWallets.clear()
    await db.personalCategories.clear()
  })

  describe('Statement Period Calculation', () => {
    it('should calculate correct statement period dates', () => {
      const testDate = new Date('2024-02-10') // Before closing day
      const result = calculateStatementPeriod(15, 20, testDate)

      expect(result.periodEnd.getDate()).toBe(15)
      expect(result.periodEnd.getMonth()).toBe(1) // February (0-indexed)
      
      expect(result.periodStart.getDate()).toBe(16)
      expect(result.periodStart.getMonth()).toBe(0) // January (0-indexed)
      
      expect(result.dueDate.getDate()).toBe(4) // 15 + 20 days = March 4th
      expect(result.dueDate.getMonth()).toBe(2) // March (0-indexed)
    })

    it('should handle month transitions correctly', () => {
      const testDate = new Date('2024-02-20') // After closing day
      const result = calculateStatementPeriod(15, 20, testDate)

      expect(result.periodEnd.getDate()).toBe(15)
      expect(result.periodEnd.getMonth()).toBe(2) // March (next month)
    })
  })

  describe('Statement Creation and Management', () => {
    it('should create a new credit card statement', async () => {
      const statement = await createNewStatement(testCreditCardWallet)

      expect(statement.id).toBeDefined()
      expect(statement.userId).toBe(testUserId)
      expect(statement.walletId).toBe(testCreditCardWallet.id)
      expect(statement.status).toBe('open')
      expect(statement.totalCharges).toBe(0)
      expect(statement.currentBalance).toBe(0)
    })

    it('should get or create current statement', async () => {
      // First call creates new statement
      const statement1 = await getCurrentStatement(testCreditCardWallet.id!)
      expect(statement1.status).toBe('open')

      // Second call returns same statement
      const statement2 = await getCurrentStatement(testCreditCardWallet.id!)
      expect(statement2.id).toBe(statement1.id)
    })
  })

  describe('Transaction Processing', () => {
    it('should add transactions to statement and update totals', async () => {
      // Create statement
      const statement = await getCurrentStatement(testCreditCardWallet.id!)

      // Create transaction
      const transaction: PersonalTransaction = {
        id: 'tx-1',
        userId: testUserId,
        type: 'expense',
        amount: 10000,
        currency: 'ARS',
        walletId: testCreditCardWallet.id!,
        categoryId: testCategory.id!,
        description: 'Test purchase',
        date: new Date(),
        isFromCreditCard: true,
        sharedWithHousehold: false,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await db.personalTransactions.add(transaction)
      await addTransactionToStatement(transaction)

      // Check if statement was updated
      const updatedStatement = await db.creditCardStatements.get(statement.id!)
      expect(updatedStatement?.totalCharges).toBe(10000)
      expect(updatedStatement?.currentBalance).toBe(10000)
      expect(updatedStatement?.minimumPayment).toBeGreaterThan(0)
    })
  })

  describe('Credit Card Payments', () => {
    let statement: CreditCardStatement

    beforeEach(async () => {
      statement = await getCurrentStatement(testCreditCardWallet.id!)
      
      // Add a test expense to the statement
      const transaction: PersonalTransaction = {
        id: 'tx-expense-1',
        userId: testUserId,
        type: 'expense',
        amount: 25000,
        currency: 'ARS',
        walletId: testCreditCardWallet.id!,
        categoryId: testCategory.id!,
        description: 'Test expense for payment',
        date: new Date(),
        isFromCreditCard: true,
        sharedWithHousehold: false,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await db.personalTransactions.add(transaction)
      await addTransactionToStatement(transaction)
      await updateStatementTotals(statement.id!)
    })

    it('should process credit card payment successfully', async () => {
      const paymentAmount = 15000
      
      const result = await processCreditCardPayment(
        statement.id!,
        testBankWallet.id!,
        paymentAmount,
        new Date(),
        'Test payment'
      )

      expect(result.payment.amount).toBe(paymentAmount)
      expect(result.payment.fromWalletId).toBe(testBankWallet.id!)
      expect(result.updatedStatement.paidAmount).toBe(paymentAmount)
      
      // Check that source wallet balance decreased
      const updatedBankWallet = await db.personalWallets.get(testBankWallet.id!)
      expect(updatedBankWallet?.balance).toBe(150000 - paymentAmount)
      
      // Check that credit card balance improved
      const updatedCreditWallet = await db.personalWallets.get(testCreditCardWallet.id!)
      expect(updatedCreditWallet?.balance).toBe(-50000 + paymentAmount)
    })

    it('should make minimum payment correctly', async () => {
      const result = await makeMinimumPayment(
        statement.id!,
        testBankWallet.id!
      )

      const updatedStatement = await db.creditCardStatements.get(statement.id!)
      expect(result.payment.amount).toBe(updatedStatement!.minimumPayment)
    })

    it('should pay full balance correctly', async () => {
      const currentStatement = await db.creditCardStatements.get(statement.id!)
      const fullBalance = currentStatement!.currentBalance

      const result = await payFullBalance(
        statement!.id!,
        testBankWallet.id!
      )

      expect(result.updatedStatement.status).toBe('paid')
      expect(result.payment.amount).toBe(fullBalance)
    })

    it('should validate payment amounts correctly', async () => {
      const currentStatement = await db.creditCardStatements.get(statement.id!)
      
      // Valid payment
      const validResult = await validatePaymentAmount(statement!.id!, 10000)
      expect(validResult.isValid).toBe(true)
      
      // Invalid payment (exceeds balance)
      const invalidResult = await validatePaymentAmount(statement!.id!, 50000)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.error).toContain('exceeds remaining balance')
      
      // Below minimum payment
      const belowMinResult = await validatePaymentAmount(statement!.id!, 100)
      expect(belowMinResult.isValid).toBe(true) // Still valid, but with warnings
      expect(belowMinResult.warnings.length).toBeGreaterThan(0)
    })

    it('should suggest appropriate payment amounts', async () => {
      const suggestions = await getSuggestedPayments(statement.id!)
      
      expect(suggestions.minimum).toBeGreaterThan(0)
      expect(suggestions.full).toBeGreaterThan(suggestions.minimum)
      expect(suggestions.suggested).toBeGreaterThanOrEqual(suggestions.minimum)
      expect(suggestions.suggested).toBeLessThanOrEqual(suggestions.full)
      expect(suggestions.custom).toBe(true)
    })
  })

  describe('Statement Closing', () => {
    it('should close statement and create next one', async () => {
      const currentStatement = await getCurrentStatement(testCreditCardWallet.id!)
      const nextStatement = await closeStatement(currentStatement.id!)

      // Check current statement is closed
      const closedStatement = await db.creditCardStatements.get(currentStatement.id!)
      expect(closedStatement?.status).toBe('closed')

      // Check next statement is created
      expect(nextStatement.status).toBe('open')
      expect(nextStatement.periodStart).toEqual(
        new Date(currentStatement.periodEnd.getTime() + 24 * 60 * 60 * 1000) // Next day
      )
    })
  })

  describe('Due Date Notifications', () => {
    it('should generate due date notifications', async () => {
      // Create a statement with due date in 2 days
      const statement = await getCurrentStatement(testCreditCardWallet.id!)
      const nearDueDate = new Date()
      nearDueDate.setDate(nearDueDate.getDate() + 2)
      
      await db.creditCardStatements.update(statement.id!, {
        dueDate: nearDueDate,
        currentBalance: 20000
      })

      const notifications = await generateDueNotifications(testUserId, 7)
      
      expect(notifications.length).toBeGreaterThan(0)
      expect(notifications[0].type).toBe('due_soon')
      expect(notifications[0].walletName).toBe(testCreditCardWallet.name)
    })

    it('should detect overdue notifications', async () => {
      const statement = await getCurrentStatement(testCreditCardWallet.id!)
      const overdueDate = new Date()
      overdueDate.setDate(overdueDate.getDate() - 2) // 2 days ago
      
      await db.creditCardStatements.update(statement.id!, {
        dueDate: overdueDate,
        currentBalance: 20000,
        status: 'closed'
      })

      const notifications = await generateDueNotifications(testUserId, 7)
      
      expect(notifications.length).toBeGreaterThan(0)
      expect(notifications[0].type).toBe('overdue')
      expect(notifications[0].priority).toBe('critical')
    })

    it('should generate credit usage notifications', async () => {
      // Update wallet to high credit usage (95%)
      await db.personalWallets.update(testCreditCardWallet.id!, {
        balance: -95000 // 95% of 100k limit
      })

      const notifications = await generateCreditUsageNotifications(testUserId, 70, 90)
      
      expect(notifications.length).toBeGreaterThan(0)
      expect(notifications[0].type).toBe('minimum_payment_alert')
      expect(notifications[0].priority).toBe('critical')
    })

    it('should get comprehensive notification summary', async () => {
      // Setup scenario with multiple notification types
      const statement = await getCurrentStatement(testCreditCardWallet.id!)
      const nearDueDate = new Date()
      nearDueDate.setDate(nearDueDate.getDate() + 1)
      
      await db.creditCardStatements.update(statement.id!, {
        dueDate: nearDueDate,
        currentBalance: 30000
      })

      await db.personalWallets.update(testCreditCardWallet.id!, {
        balance: -85000 // 85% usage
      })

      const summary = await getNotificationSummary(testUserId)
      
      expect(summary.total).toBeGreaterThan(0)
      expect(summary.dueSoon).toBeGreaterThan(0)
      expect(summary.usageAlerts).toBeGreaterThan(0)
    })
  })

  describe('Complete Credit Card Flow', () => {
    it('should handle complete credit card lifecycle', async () => {
      // 1. Create statement
      const statement = await getCurrentStatement(testCreditCardWallet.id!)
      expect(statement.status).toBe('open')

      // 2. Add expenses to statement
      const expense1: PersonalTransaction = {
        id: 'tx-flow-1',
        userId: testUserId,
        type: 'expense',
        amount: 15000,
        currency: 'ARS',
        walletId: testCreditCardWallet.id!,
        categoryId: testCategory.id!,
        description: 'Flow test expense 1',
        date: new Date(),
        isFromCreditCard: true,
        sharedWithHousehold: false,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const expense2: PersonalTransaction = {
        id: 'tx-flow-2',
        userId: testUserId,
        type: 'expense',
        amount: 8000,
        currency: 'ARS',
        walletId: testCreditCardWallet.id!,
        categoryId: testCategory.id!,
        description: 'Flow test expense 2',
        date: new Date(),
        isFromCreditCard: true,
        sharedWithHousehold: false,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await db.personalTransactions.bulkAdd([expense1, expense2])
      await addTransactionToStatement(expense1)
      await addTransactionToStatement(expense2)

      // 3. Update statement totals
      await updateStatementTotals(statement.id!)
      const updatedStatement = await db.creditCardStatements.get(statement.id!)
      expect(updatedStatement?.totalCharges).toBe(23000)
      expect(updatedStatement?.currentBalance).toBe(23000)

      // 4. Generate notifications
      const notifications = await getAllCreditCardNotifications(testUserId)
      expect(notifications.length).toBeGreaterThan(0)

      // 5. Make partial payment
      const partialPaymentResult = await processCreditCardPayment(
        statement.id!,
        testBankWallet.id!,
        10000
      )
      expect(partialPaymentResult.payment.amount).toBe(10000)

      // 6. Check remaining balance
      const afterPartialPayment = await db.creditCardStatements.get(statement.id!)
      expect(afterPartialPayment?.paidAmount).toBe(10000)
      expect(afterPartialPayment?.status).toBe('open') // Still open, not fully paid

      // 7. Pay remaining balance
      const remainingBalance = afterPartialPayment!.currentBalance - afterPartialPayment!.paidAmount
      await processCreditCardPayment(
        statement.id!,
        testBankWallet.id!,
        remainingBalance
      )

      // 8. Verify statement is marked as paid
      const finalStatement = await db.creditCardStatements.get(statement.id!)
      expect(finalStatement?.status).toBe('paid')
      expect(finalStatement?.paidAmount).toBe(23000)

      // 9. Get payment statistics
      const stats = await getCreditCardPaymentStats(testCreditCardWallet.id!, 1)
      expect(stats.paymentCount).toBe(2) // Two payments made
      expect(stats.totalAmountPaid).toBe(23000)
      expect(stats.onTimePayments).toBe(2) // Both on time

      // 10. Close statement and create next one
      const nextStatement = await closeStatement(statement.id!)
      expect(nextStatement.status).toBe('open')
      expect(nextStatement.id).not.toBe(statement.id)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid wallet types for statements', async () => {
      await expect(
        getCurrentStatement(testBankWallet.id!) // Bank wallet, not credit card
      ).rejects.toThrow('Invalid credit card wallet')
    })

    it('should handle insufficient funds for payments', async () => {
      const statement = await getCurrentStatement(testCreditCardWallet.id!)
      
      // Update statement with high balance
      await db.creditCardStatements.update(statement.id!, {
        currentBalance: 200000 // More than bank account has
      })

      // Try to pay more than available
      await expect(
        processCreditCardPayment(statement.id!, testBankWallet.id!, 200000)
      ).rejects.toThrow('Insufficient')
    })

    it('should handle payment amount exceeding statement balance', async () => {
      const statement = await getCurrentStatement(testCreditCardWallet.id!)
      
      await db.creditCardStatements.update(statement.id!, {
        currentBalance: 10000
      })

      // Try to pay more than statement balance
      await expect(
        processCreditCardPayment(statement.id!, testBankWallet.id!, 15000)
      ).rejects.toThrow('Payment amount cannot exceed statement balance')
    })
  })
})