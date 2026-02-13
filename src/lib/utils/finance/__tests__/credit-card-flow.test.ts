/**
 * Credit Card Flow Integration Tests
 *
 * Tests the full credit card lifecycle:
 * Statement creation -> Transaction addition -> Statement closing -> Payment -> Status changes
 *
 * These are integration-style tests that exercise multiple modules together
 * but still use the mock database for isolation.
 */

vi.mock('@/lib/db', async () => {
  const { setupDexieMock } = await import('../../../../test/mocks/dexie')
  return setupDexieMock()
})

import { mockDb, resetMockDb } from '@/test/mocks/dexie'
import { createMockCreditCard, createMockBankAccount } from '@/test/factories/wallet.factory'
import { createMockTransaction } from '@/test/factories/transaction.factory'
import type { CreditCardStatement, PersonalWallet, PersonalTransaction } from '@/types/personal-finance'

import {
  calculateStatementPeriod,
  createNewStatement,
  getCurrentStatement,
  closeStatement,
  updateStatementTotals,
  addTransactionToStatement,
} from '../credit-card-statements'

import {
  validatePaymentAmount,
  getSuggestedPayments,
} from '../credit-card-payments'

function createMockStatement(overrides: Partial<CreditCardStatement> = {}): CreditCardStatement {
  return {
    id: 'ccs_stmt-1',
    userId: 'test-user-1',
    walletId: 'pw_cc-1',
    periodStart: new Date('2025-05-16'),
    periodEnd: new Date('2025-06-15'),
    dueDate: new Date('2025-06-25'),
    totalCharges: 0,
    totalPayments: 0,
    currentBalance: 0,
    minimumPayment: 0,
    currency: 'ARS',
    paidAmount: 0,
    status: 'open',
    createdAt: new Date('2025-05-16'),
    updatedAt: new Date('2025-05-16'),
    ...overrides,
  }
}

describe('Credit Card Full Lifecycle Flow', () => {
  let creditCard: PersonalWallet
  let bankAccount: PersonalWallet

  beforeEach(() => {
    resetMockDb()

    creditCard = createMockCreditCard({
      id: 'pw_cc-1',
      userId: 'test-user-1',
      name: 'Visa Gold',
      closingDay: 15,
      dueDay: 10,
      creditLimit: 200000,
      balance: 0,
      currency: 'ARS',
    })

    bankAccount = createMockBankAccount({
      id: 'pw_bank-1',
      userId: 'test-user-1',
      balance: 500000,
    })
  })

  describe('Phase 1: Statement Creation', () => {
    it('should create a statement with correct period based on closing day', async () => {
      const currentDate = new Date(2025, 5, 10) // June 10
      const statement = await createNewStatement(creditCard, currentDate)

      expect(statement.status).toBe('open')
      expect(statement.walletId).toBe('pw_cc-1')
      expect(statement.totalCharges).toBe(0)
      expect(statement.totalPayments).toBe(0)
      expect(statement.currentBalance).toBe(0)
      expect(statement.periodEnd.getMonth()).toBe(5) // June
      expect(statement.periodEnd.getDate()).toBe(15)
    })

    it('should get existing open statement instead of creating a new one', async () => {
      const existingStatement = createMockStatement({ status: 'open' })
      mockDb.personalWallets.get.mockResolvedValue(creditCard)
      mockDb.creditCardStatements.first.mockResolvedValue(existingStatement)

      const result = await getCurrentStatement('pw_cc-1')

      expect(result.id).toBe(existingStatement.id)
      expect(mockDb.creditCardStatements.add).not.toHaveBeenCalled()
    })

    it('should create new statement when no open statement exists', async () => {
      mockDb.personalWallets.get.mockResolvedValue(creditCard)
      mockDb.creditCardStatements.first.mockResolvedValue(undefined)

      const result = await getCurrentStatement('pw_cc-1')

      expect(result.status).toBe('open')
      expect(mockDb.creditCardStatements.add).toHaveBeenCalled()
    })
  })

  describe('Phase 2: Adding Transactions to Statement', () => {
    it('should link credit card transaction to current open statement', async () => {
      const statement = createMockStatement({
        id: 'ccs_stmt-1',
        periodStart: new Date('2025-05-16'),
        periodEnd: new Date('2025-06-15'),
      })

      mockDb.personalWallets.get.mockResolvedValue(creditCard)
      mockDb.creditCardStatements.first.mockResolvedValue(statement)
      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      mockDb.personalTransactions.toArray.mockResolvedValue([])

      const tx = createMockTransaction({
        id: 'pt_expense-1',
        walletId: 'pw_cc-1',
        type: 'expense',
        amount: 15000,
        isFromCreditCard: true,
        date: new Date('2025-06-01'),
      })

      await addTransactionToStatement(tx)

      expect(mockDb.personalTransactions.update).toHaveBeenCalledWith('pt_expense-1', {
        creditCardStatementId: 'ccs_stmt-1',
      })
    })

    it('should skip non-credit-card transactions', async () => {
      const tx = createMockTransaction({
        isFromCreditCard: false,
      })

      await addTransactionToStatement(tx)

      expect(mockDb.personalWallets.get).not.toHaveBeenCalled()
    })

    it('should not link transaction outside statement period', async () => {
      const statement = createMockStatement({
        periodStart: new Date('2025-05-16'),
        periodEnd: new Date('2025-06-15'),
      })

      mockDb.personalWallets.get.mockResolvedValue(creditCard)
      mockDb.creditCardStatements.first.mockResolvedValue(statement)

      const tx = createMockTransaction({
        id: 'pt_old-expense',
        walletId: 'pw_cc-1',
        isFromCreditCard: true,
        date: new Date('2025-04-01'), // Before period start
      })

      await addTransactionToStatement(tx)

      expect(mockDb.personalTransactions.update).not.toHaveBeenCalled()
    })
  })

  describe('Phase 3: Statement Totals Calculation', () => {
    it('should calculate totals with multiple expense transactions', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const transactions = [
        createMockTransaction({ type: 'expense', amount: 10000 }),
        createMockTransaction({ type: 'expense', amount: 25000 }),
        createMockTransaction({ type: 'expense', amount: 8000 }),
      ]
      mockDb.personalTransactions.toArray.mockResolvedValue(transactions)

      await updateStatementTotals('ccs_stmt-1')

      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          totalCharges: 43000,
          totalPayments: 0,
          currentBalance: 43000,
          minimumPayment: 2150, // 5% of 43000 = 2150 > 20
        })
      )
    })

    it('should account for payments reducing the balance', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const transactions = [
        createMockTransaction({ type: 'expense', amount: 50000 }),
        createMockTransaction({ type: 'income', amount: 20000 }), // payment
      ]
      mockDb.personalTransactions.toArray.mockResolvedValue(transactions)

      await updateStatementTotals('ccs_stmt-1')

      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          totalCharges: 50000,
          totalPayments: 20000,
          currentBalance: 30000,
        })
      )
    })

    it('should use $20 minimum when 5% is too small', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const transactions = [
        createMockTransaction({ type: 'expense', amount: 200 }),
      ]
      mockDb.personalTransactions.toArray.mockResolvedValue(transactions)

      await updateStatementTotals('ccs_stmt-1')

      // 5% of 200 = 10, but minimum is $20
      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          minimumPayment: 20,
        })
      )
    })
  })

  describe('Phase 4: Statement Closing', () => {
    it('should close statement and create next period', async () => {
      const statement = createMockStatement({
        id: 'ccs_stmt-1',
        walletId: 'pw_cc-1',
        periodEnd: new Date('2025-06-15'),
      })

      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      mockDb.personalWallets.get.mockResolvedValue(creditCard)

      const nextStatement = await closeStatement('ccs_stmt-1')

      // Old statement should be closed
      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({ status: 'closed' })
      )

      // New statement should be open with next period
      expect(nextStatement.status).toBe('open')
      expect(nextStatement.walletId).toBe('pw_cc-1')
    })

    it('should not allow closing a nonexistent statement', async () => {
      mockDb.creditCardStatements.get.mockResolvedValue(undefined)

      await expect(closeStatement('bad-id')).rejects.toThrow('Statement not found')
    })
  })

  describe('Phase 5: Payment Validation', () => {
    it('should validate a payment within statement balance', async () => {
      const statement = createMockStatement({
        currentBalance: 43000,
        paidAmount: 0,
        minimumPayment: 2150,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await validatePaymentAmount('ccs_stmt-1', 10000)

      expect(result.isValid).toBe(true)
    })

    it('should reject overpayment', async () => {
      const statement = createMockStatement({
        currentBalance: 43000,
        paidAmount: 40000,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      // Remaining = 3000, paying 5000
      const result = await validatePaymentAmount('ccs_stmt-1', 5000)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('exceeds remaining balance')
    })

    it('should provide suggested payment amounts', async () => {
      const statement = createMockStatement({
        currentBalance: 43000,
        paidAmount: 0,
        minimumPayment: 2150,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const suggestions = await getSuggestedPayments('ccs_stmt-1')

      expect(suggestions.minimum).toBe(2150)
      expect(suggestions.full).toBe(43000)
      expect(suggestions.suggested).toBeGreaterThanOrEqual(suggestions.minimum)
      expect(suggestions.suggested).toBeLessThanOrEqual(suggestions.full)
    })

    it('should warn for below-minimum payments', async () => {
      const statement = createMockStatement({
        currentBalance: 43000,
        paidAmount: 0,
        minimumPayment: 2150,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await validatePaymentAmount('ccs_stmt-1', 1000)
      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('below minimum'))).toBe(true)
    })
  })

  describe('Phase 6: Statement Period Calculations', () => {
    it('should calculate consecutive statement periods correctly', () => {
      // First statement period (June 10 - before closing)
      const period1 = calculateStatementPeriod(15, 10, new Date(2025, 5, 10))
      expect(period1.periodEnd.getMonth()).toBe(5) // June 15
      expect(period1.periodEnd.getDate()).toBe(15)

      // Next period starts the day after first period ends
      const nextDate = new Date(period1.periodEnd)
      nextDate.setDate(nextDate.getDate() + 1) // June 16
      const period2 = calculateStatementPeriod(15, 10, nextDate)

      // Second period should be July 15
      expect(period2.periodEnd.getMonth()).toBe(6) // July 15
      expect(period2.periodEnd.getDate()).toBe(15)

      // Periods should not overlap
      expect(period2.periodStart.getTime()).toBeGreaterThan(period1.periodEnd.getTime())
    })

    it('should handle end-of-year transition', () => {
      const decPeriod = calculateStatementPeriod(15, 10, new Date(2025, 11, 20))
      expect(decPeriod.periodEnd.getFullYear()).toBe(2026)
      expect(decPeriod.periodEnd.getMonth()).toBe(0) // January
    })

    it('should calculate due date that accounts for weekends (conceptually)', () => {
      const period = calculateStatementPeriod(15, 10, new Date(2025, 5, 10))
      // Due date should be 10 days after closing
      const daysDiff = Math.round(
        (period.dueDate.getTime() - period.periodEnd.getTime()) / (1000 * 60 * 60 * 24)
      )
      expect(daysDiff).toBe(10)
    })
  })

  describe('Phase 7: Edge Cases', () => {
    it('should handle credit card with closing day 31 in short months', () => {
      // February only has 28/29 days
      const period = calculateStatementPeriod(31, 10, new Date(2025, 1, 15)) // Feb 15
      // JavaScript Date handles day 31 in Feb by rolling to Mar 3 (or similar)
      // The important thing is it doesn't crash
      expect(period.periodEnd).toBeDefined()
      expect(period.dueDate).toBeDefined()
    })

    it('should handle closing day 1 (first of month)', () => {
      const period = calculateStatementPeriod(1, 15, new Date(2025, 5, 15)) // June 15
      // Past closing day 1, so period end should be July 1
      expect(period.periodEnd.getDate()).toBe(1)
      expect(period.periodEnd.getMonth()).toBe(6) // July
    })

    it('should handle statement with zero balance', async () => {
      const statement = createMockStatement({
        currentBalance: 0,
        paidAmount: 0,
        minimumPayment: 0,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await validatePaymentAmount('ccs_stmt-1', 0)
      expect(result.isValid).toBe(false) // 0 amount is always invalid
      expect(result.error).toContain('positive')
    })

    it('should handle fully paid statement', async () => {
      const statement = createMockStatement({
        currentBalance: 50000,
        paidAmount: 50000,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      // Remaining = 0, any positive amount exceeds it
      const result = await validatePaymentAmount('ccs_stmt-1', 1)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('exceeds remaining balance')
    })

    it('should handle suggested payments for nearly-paid statement', async () => {
      const statement = createMockStatement({
        currentBalance: 1000,
        paidAmount: 990,
        minimumPayment: 50,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const suggestions = await getSuggestedPayments('ccs_stmt-1')

      // Remaining = 10
      expect(suggestions.full).toBe(10)
      expect(suggestions.minimum).toBeLessThanOrEqual(10)
      expect(suggestions.suggested).toBeLessThanOrEqual(10)
    })

    it('should handle multiple statements lifecycle for same card', async () => {
      // Create first statement
      const stmt1 = await createNewStatement(creditCard, new Date(2025, 5, 10))
      expect(stmt1.status).toBe('open')

      // Close it
      mockDb.creditCardStatements.get.mockResolvedValue(stmt1)
      mockDb.personalWallets.get.mockResolvedValue(creditCard)
      const stmt2 = await closeStatement(stmt1.id!)

      // stmt1 is closed, stmt2 is created and open
      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        stmt1.id,
        expect.objectContaining({ status: 'closed' })
      )
      expect(stmt2.status).toBe('open')
    })
  })

  describe('Phase 8: Multiple Transactions Accumulation', () => {
    it('should correctly accumulate charges from many transactions', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      // Simulate 10 expense transactions
      const expenses = Array.from({ length: 10 }, (_, i) =>
        createMockTransaction({
          type: 'expense',
          amount: 1000 * (i + 1), // 1000, 2000, ..., 10000
        })
      )
      mockDb.personalTransactions.toArray.mockResolvedValue(expenses)

      await updateStatementTotals('ccs_stmt-1')

      // Sum: 1000 + 2000 + ... + 10000 = 55000
      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          totalCharges: 55000,
          currentBalance: 55000,
          minimumPayment: 2750, // 5% of 55000
        })
      )
    })

    it('should handle mixed expenses and payments in same period', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const transactions = [
        createMockTransaction({ type: 'expense', amount: 30000 }),
        createMockTransaction({ type: 'expense', amount: 15000 }),
        createMockTransaction({ type: 'income', amount: 10000 }), // partial payment
        createMockTransaction({ type: 'expense', amount: 5000 }),
        createMockTransaction({ type: 'income', amount: 5000 }),  // another payment
      ]
      mockDb.personalTransactions.toArray.mockResolvedValue(transactions)

      await updateStatementTotals('ccs_stmt-1')

      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          totalCharges: 50000,    // 30000 + 15000 + 5000
          totalPayments: 15000,   // 10000 + 5000
          currentBalance: 35000,  // 50000 - 15000
        })
      )
    })
  })
})
