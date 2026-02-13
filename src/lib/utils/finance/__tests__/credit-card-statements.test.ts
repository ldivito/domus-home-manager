vi.mock('@/lib/db', async () => {
  const { setupDexieMock } = await import('../../../../test/mocks/dexie')
  return setupDexieMock()
})

import { mockDb, resetMockDb } from '@/test/mocks/dexie'
import { createMockCreditCard } from '@/test/factories/wallet.factory'
import { createMockTransaction } from '@/test/factories/transaction.factory'
import {
  calculateStatementPeriod,
  createNewStatement,
  getCurrentStatement,
  closeStatement,
  updateStatementTotals,
  addTransactionToStatement,
  getStatementSummary,
  getUpcomingDueDates,
} from '../credit-card-statements'
import type { CreditCardStatement, PersonalWallet } from '@/types/personal-finance'

function createMockStatement(overrides: Partial<CreditCardStatement> = {}): CreditCardStatement {
  return {
    id: 'ccs_stmt-1',
    userId: 'test-user-1',
    walletId: 'pw_cc-1',
    periodStart: new Date('2025-05-16'),
    periodEnd: new Date('2025-06-15'),
    dueDate: new Date('2025-06-25'),
    totalCharges: 25000,
    totalPayments: 0,
    currentBalance: 25000,
    minimumPayment: 1250,
    currency: 'ARS',
    paidAmount: 0,
    status: 'open',
    createdAt: new Date('2025-05-16'),
    updatedAt: new Date('2025-05-16'),
    ...overrides,
  }
}

describe('credit-card-statements', () => {
  beforeEach(() => {
    resetMockDb()
  })

  describe('calculateStatementPeriod (pure function)', () => {
    it('should calculate period when current date is before closing day', () => {
      // Date is June 10, closing day is 15
      const currentDate = new Date(2025, 5, 10) // June 10, 2025
      const result = calculateStatementPeriod(15, 10, currentDate)

      // Period end should be June 15
      expect(result.periodEnd.getDate()).toBe(15)
      expect(result.periodEnd.getMonth()).toBe(5) // June

      // Period start should be May 16 (previous closing + 1)
      expect(result.periodStart.getDate()).toBe(16)
      expect(result.periodStart.getMonth()).toBe(4) // May

      // Due date should be June 25 (closing + 10 days)
      expect(result.dueDate.getDate()).toBe(25)
      expect(result.dueDate.getMonth()).toBe(5) // June
    })

    it('should use next month when current date is past closing day', () => {
      // Date is June 20, closing day is 15 -> already past closing
      const currentDate = new Date(2025, 5, 20) // June 20, 2025
      const result = calculateStatementPeriod(15, 10, currentDate)

      // Period end should move to July 15
      expect(result.periodEnd.getDate()).toBe(15)
      expect(result.periodEnd.getMonth()).toBe(6) // July

      // Period start should be June 16
      expect(result.periodStart.getDate()).toBe(16)
      expect(result.periodStart.getMonth()).toBe(5) // June
    })

    it('should handle year boundary (December closing)', () => {
      const currentDate = new Date(2025, 11, 20) // December 20
      const result = calculateStatementPeriod(15, 10, currentDate)

      // Past closing day 15 -> next month = January 2026
      expect(result.periodEnd.getMonth()).toBe(0) // January
      expect(result.periodEnd.getFullYear()).toBe(2026)
    })

    it('should calculate due date correctly with large dueDay values', () => {
      const currentDate = new Date(2025, 5, 10) // June 10
      const result = calculateStatementPeriod(15, 20, currentDate)

      // Due date = closing (June 15) + 20 days = July 5
      expect(result.dueDate.getMonth()).toBe(6) // July
      expect(result.dueDate.getDate()).toBe(5)
    })
  })

  describe('createNewStatement', () => {
    it('should create a new statement with correct period dates', async () => {
      const cc = createMockCreditCard({
        id: 'pw_cc-1',
        userId: 'test-user-1',
        closingDay: 15,
        dueDay: 10,
        currency: 'ARS',
      })

      const currentDate = new Date(2025, 5, 10) // June 10
      const statement = await createNewStatement(cc, currentDate)

      expect(statement.walletId).toBe('pw_cc-1')
      expect(statement.userId).toBe('test-user-1')
      expect(statement.status).toBe('open')
      expect(statement.totalCharges).toBe(0)
      expect(statement.totalPayments).toBe(0)
      expect(statement.currentBalance).toBe(0)
      expect(statement.currency).toBe('ARS')
      expect(mockDb.creditCardStatements.add).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open', walletId: 'pw_cc-1' })
      )
    })

    it('should throw if credit card missing closing/due day config', async () => {
      const cc = createMockCreditCard({
        closingDay: undefined,
        dueDay: undefined,
      })

      await expect(createNewStatement(cc)).rejects.toThrow(
        'Credit card missing closing/due day configuration'
      )
    })
  })

  describe('getCurrentStatement', () => {
    it('should return existing open statement', async () => {
      const cc = createMockCreditCard({ id: 'pw_cc-1', closingDay: 15, dueDay: 10 })
      const existingStatement = createMockStatement({ status: 'open' })

      mockDb.personalWallets.get.mockResolvedValue(cc)
      mockDb.creditCardStatements.first.mockResolvedValue(existingStatement)

      const result = await getCurrentStatement('pw_cc-1')

      expect(result).toEqual(existingStatement)
    })

    it('should create new statement if no open statement found', async () => {
      const cc = createMockCreditCard({
        id: 'pw_cc-1',
        closingDay: 15,
        dueDay: 10,
        currency: 'ARS',
      })

      mockDb.personalWallets.get.mockResolvedValue(cc)
      mockDb.creditCardStatements.first.mockResolvedValue(undefined)

      const result = await getCurrentStatement('pw_cc-1')

      expect(result.status).toBe('open')
      expect(result.walletId).toBe('pw_cc-1')
      expect(mockDb.creditCardStatements.add).toHaveBeenCalled()
    })

    it('should throw for non-credit-card wallet', async () => {
      const wallet = { id: 'pw_bank-1', type: 'bank' } as PersonalWallet
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      await expect(getCurrentStatement('pw_bank-1')).rejects.toThrow(
        'Invalid credit card wallet'
      )
    })

    it('should throw for nonexistent wallet', async () => {
      mockDb.personalWallets.get.mockResolvedValue(undefined)

      await expect(getCurrentStatement('nonexistent')).rejects.toThrow(
        'Invalid credit card wallet'
      )
    })
  })

  describe('updateStatementTotals', () => {
    it('should calculate totals from statement transactions', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const transactions = [
        createMockTransaction({ type: 'expense', amount: 10000 }),
        createMockTransaction({ type: 'expense', amount: 5000 }),
        createMockTransaction({ type: 'income', amount: 3000 }),
      ]
      mockDb.personalTransactions.toArray.mockResolvedValue(transactions)

      await updateStatementTotals('ccs_stmt-1')

      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          totalCharges: 15000,      // 10000 + 5000
          totalPayments: 3000,      // 3000 income
          currentBalance: 12000,    // 15000 - 3000
          minimumPayment: expect.any(Number),
        })
      )
    })

    it('should calculate minimum payment as max(5% of balance, 20)', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const transactions = [
        createMockTransaction({ type: 'expense', amount: 100 }),
      ]
      mockDb.personalTransactions.toArray.mockResolvedValue(transactions)

      await updateStatementTotals('ccs_stmt-1')

      // Balance = 100, 5% = 5, but min is $20
      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          minimumPayment: 20, // Math.max(5, 20) = 20
        })
      )
    })

    it('should use 5% when balance is large enough', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const transactions = [
        createMockTransaction({ type: 'expense', amount: 100000 }),
      ]
      mockDb.personalTransactions.toArray.mockResolvedValue(transactions)

      await updateStatementTotals('ccs_stmt-1')

      // Balance = 100000, 5% = 5000 > 20
      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({
          minimumPayment: 5000,
        })
      )
    })

    it('should do nothing if statement not found', async () => {
      mockDb.creditCardStatements.get.mockResolvedValue(undefined)

      await updateStatementTotals('nonexistent')

      expect(mockDb.creditCardStatements.update).not.toHaveBeenCalled()
    })
  })

  describe('closeStatement', () => {
    it('should close the statement and create a new one', async () => {
      const statement = createMockStatement({
        id: 'ccs_stmt-1',
        walletId: 'pw_cc-1',
        periodEnd: new Date('2025-06-15'),
      })
      const cc = createMockCreditCard({
        id: 'pw_cc-1',
        closingDay: 15,
        dueDay: 10,
      })

      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      mockDb.personalWallets.get.mockResolvedValue(cc)

      const nextStatement = await closeStatement('ccs_stmt-1')

      // Should close the current statement
      expect(mockDb.creditCardStatements.update).toHaveBeenCalledWith(
        'ccs_stmt-1',
        expect.objectContaining({ status: 'closed' })
      )

      // Should create a new statement
      expect(nextStatement.status).toBe('open')
      expect(mockDb.creditCardStatements.add).toHaveBeenCalled()
    })

    it('should throw if statement not found', async () => {
      mockDb.creditCardStatements.get.mockResolvedValue(undefined)

      await expect(closeStatement('nonexistent')).rejects.toThrow('Statement not found')
    })

    it('should throw if wallet not found', async () => {
      const statement = createMockStatement({ id: 'ccs_stmt-1' })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      mockDb.personalWallets.get.mockResolvedValue(undefined)

      await expect(closeStatement('ccs_stmt-1')).rejects.toThrow('Wallet not found')
    })
  })

  describe('addTransactionToStatement', () => {
    it('should skip non-credit-card transactions', async () => {
      const tx = createMockTransaction({ isFromCreditCard: false })

      await addTransactionToStatement(tx)

      expect(mockDb.personalWallets.get).not.toHaveBeenCalled()
    })

    it('should link transaction to current statement when within period', async () => {
      const cc = createMockCreditCard({ id: 'pw_cc-1', closingDay: 15, dueDay: 10 })
      const statement = createMockStatement({
        id: 'ccs_stmt-1',
        periodStart: new Date('2025-05-16'),
        periodEnd: new Date('2025-06-15'),
      })

      mockDb.personalWallets.get.mockResolvedValue(cc)
      mockDb.creditCardStatements.first.mockResolvedValue(statement)
      // updateStatementTotals needs:
      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      mockDb.personalTransactions.toArray.mockResolvedValue([])

      const tx = createMockTransaction({
        id: 'pt_tx-1',
        walletId: 'pw_cc-1',
        isFromCreditCard: true,
        date: new Date('2025-06-01'), // Within period
      })

      await addTransactionToStatement(tx)

      expect(mockDb.personalTransactions.update).toHaveBeenCalledWith('pt_tx-1', {
        creditCardStatementId: 'ccs_stmt-1',
      })
    })
  })
})
