vi.mock('@/lib/db', async () => {
  const { setupDexieMock } = await import('../../../../test/mocks/dexie')
  return setupDexieMock()
})

// Also mock the helpers module since credit-card-payments imports from ./helpers
// which has its own validateSufficientFunds and updateWalletBalanceInDb
vi.mock('@/lib/utils/finance/helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/utils/finance/helpers')>()
  return {
    ...original,
    validateSufficientFunds: vi.fn().mockResolvedValue({ isValid: true }),
    updateWalletBalanceInDb: vi.fn().mockResolvedValue(null),
    generatePaymentId: vi.fn().mockReturnValue('ccp_mock-payment-id'),
    generateTransactionId: vi.fn().mockReturnValue('pt_mock-tx-id'),
  }
})

vi.mock('@/lib/utils/finance/credit-card-statements', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/utils/finance/credit-card-statements')>()
  return {
    ...original,
    updateStatementTotals: vi.fn().mockResolvedValue(undefined),
  }
})

import { mockDb, resetMockDb } from '@/test/mocks/dexie'
import { createMockWallet, createMockCreditCard, createMockBankAccount } from '@/test/factories/wallet.factory'
import type { CreditCardStatement, CreditCardPayment } from '@/types/personal-finance'
import {
  validatePaymentAmount,
  getSuggestedPayments,
  processCreditCardPayment,
  makeMinimumPayment,
  payFullBalance,
  getCreditCardPaymentHistory,
  getCreditCardPaymentStats,
} from '../credit-card-payments'
import { validateSufficientFunds } from '../helpers'

function createMockStatement(overrides: Partial<CreditCardStatement> = {}): CreditCardStatement {
  return {
    id: 'ccs_stmt-1',
    userId: 'test-user-1',
    walletId: 'pw_cc-1',
    periodStart: new Date('2025-05-16'),
    periodEnd: new Date('2025-06-15'),
    dueDate: new Date('2025-06-25'),
    totalCharges: 50000,
    totalPayments: 0,
    currentBalance: 50000,
    minimumPayment: 2500,
    currency: 'ARS',
    paidAmount: 0,
    status: 'closed',
    createdAt: new Date('2025-05-16'),
    updatedAt: new Date('2025-05-16'),
    ...overrides,
  }
}

describe('credit-card-payments', () => {
  beforeEach(() => {
    resetMockDb()
    vi.mocked(validateSufficientFunds).mockResolvedValue({ isValid: true })
  })

  describe('validatePaymentAmount', () => {
    it('should accept a valid payment amount', async () => {
      const statement = createMockStatement({
        currentBalance: 50000,
        paidAmount: 0,
        minimumPayment: 2500,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await validatePaymentAmount('ccs_stmt-1', 10000)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toBeDefined()
    })

    it('should reject zero or negative amounts', async () => {
      const statement = createMockStatement()
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await validatePaymentAmount('ccs_stmt-1', 0)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('positive')

      const negResult = await validatePaymentAmount('ccs_stmt-1', -100)
      expect(negResult.isValid).toBe(false)
    })

    it('should reject amounts exceeding remaining balance', async () => {
      const statement = createMockStatement({
        currentBalance: 50000,
        paidAmount: 40000,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      // Remaining = 50000 - 40000 = 10000
      const result = await validatePaymentAmount('ccs_stmt-1', 15000)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('exceeds remaining balance')
    })

    it('should warn when payment is below minimum', async () => {
      const statement = createMockStatement({
        currentBalance: 50000,
        paidAmount: 0,
        minimumPayment: 2500,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await validatePaymentAmount('ccs_stmt-1', 1000)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('below minimum'))).toBe(true)
    })

    it('should warn when paying only minimum', async () => {
      const statement = createMockStatement({
        currentBalance: 50000,
        paidAmount: 0,
        minimumPayment: 2500,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await validatePaymentAmount('ccs_stmt-1', 2500)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('interest charges'))).toBe(true)
    })

    it('should warn when payment is less than 10% of remaining', async () => {
      const statement = createMockStatement({
        currentBalance: 100000,
        paidAmount: 0,
        minimumPayment: 5000,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      // 5001 < 100000 * 0.1 = 10000, so triggers the warning
      // But 5001 >= minimumPayment, so won't trigger "below minimum"
      const result = await validatePaymentAmount('ccs_stmt-1', 5001)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('Consider paying more'))).toBe(true)
    })

    it('should return error when statement not found', async () => {
      mockDb.creditCardStatements.get.mockResolvedValue(undefined)

      const result = await validatePaymentAmount('nonexistent', 100)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Statement not found')
    })
  })

  describe('getSuggestedPayments', () => {
    it('should return minimum, full, and suggested amounts', async () => {
      const statement = createMockStatement({
        currentBalance: 50000,
        paidAmount: 0,
        minimumPayment: 2500,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await getSuggestedPayments('ccs_stmt-1')

      expect(result.minimum).toBe(2500) // min(minimumPayment, remaining)
      expect(result.full).toBe(50000)   // remaining balance
      expect(result.custom).toBe(true)

      // Suggested: max(50% of balance, minimum + 50) capped at remaining
      // 50% = 25000, min+50 = 2550 -> max(25000, 2550) = 25000
      // then max(25000, 2500) = 25000
      expect(result.suggested).toBe(25000)
    })

    it('should cap minimum at remaining balance', async () => {
      const statement = createMockStatement({
        currentBalance: 50000,
        paidAmount: 48000,
        minimumPayment: 2500,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await getSuggestedPayments('ccs_stmt-1')

      // Remaining = 2000, so minimum is capped at 2000
      expect(result.minimum).toBe(2000)
      expect(result.full).toBe(2000)
    })

    it('should cap suggested at remaining balance', async () => {
      const statement = createMockStatement({
        currentBalance: 100,
        paidAmount: 0,
        minimumPayment: 20,
      })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)

      const result = await getSuggestedPayments('ccs_stmt-1')

      // Suggested = min(max(50, 70), 100) = min(70, 100) = 70
      // then max(70, 20) = 70
      expect(result.suggested).toBeLessThanOrEqual(result.full)
    })

    it('should throw for nonexistent statement', async () => {
      mockDb.creditCardStatements.get.mockResolvedValue(undefined)

      await expect(getSuggestedPayments('nonexistent')).rejects.toThrow('Statement not found')
    })
  })

  describe('processCreditCardPayment', () => {
    it('should process payment, create records, and update balances', async () => {
      const statement = createMockStatement({
        id: 'ccs_stmt-1',
        userId: 'test-user-1',
        walletId: 'pw_cc-1',
        currentBalance: 50000,
        paidAmount: 0,
      })
      const sourceWallet = createMockBankAccount({ id: 'pw_bank-1', balance: 200000, isActive: true })
      const creditCard = createMockCreditCard({ id: 'pw_cc-1' })

      mockDb.creditCardStatements.get
        .mockResolvedValueOnce(statement) // initial get
        .mockResolvedValue({ ...statement, paidAmount: 10000, status: 'closed' }) // get after update

      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet) // fromWallet check
        .mockResolvedValueOnce(creditCard)   // credit card wallet

      // Mock category lookup (first call returns undefined to trigger creation)
      mockDb.personalCategories.first
        .mockResolvedValueOnce(undefined) // 'Credit Card Payment' not found
        .mockResolvedValueOnce(undefined) // 'Payment Received' not found

      const result = await processCreditCardPayment(
        'ccs_stmt-1',
        'pw_bank-1',
        10000,
        new Date('2025-06-20')
      )

      expect(result.payment.amount).toBe(10000)
      expect(result.payment.statementId).toBe('ccs_stmt-1')
      expect(mockDb.creditCardPayments.add).toHaveBeenCalled()
      expect(mockDb.personalTransactions.add).toHaveBeenCalledTimes(2) // source tx + credit tx
    })

    it('should reject zero amount', async () => {
      const statement = createMockStatement()
      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      const sourceWallet = createMockBankAccount({ id: 'pw_bank-1', isActive: true })
      const creditCard = createMockCreditCard({ id: 'pw_cc-1' })
      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet)
        .mockResolvedValueOnce(creditCard)

      await expect(
        processCreditCardPayment('ccs_stmt-1', 'pw_bank-1', 0)
      ).rejects.toThrow('Payment amount must be positive')
    })

    it('should reject payment exceeding statement balance', async () => {
      const statement = createMockStatement({ currentBalance: 10000 })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      const sourceWallet = createMockBankAccount({ id: 'pw_bank-1', isActive: true })
      const creditCard = createMockCreditCard({ id: 'pw_cc-1' })
      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet)
        .mockResolvedValueOnce(creditCard)

      await expect(
        processCreditCardPayment('ccs_stmt-1', 'pw_bank-1', 20000)
      ).rejects.toThrow('Payment amount cannot exceed statement balance')
    })

    it('should reject if source wallet has insufficient funds', async () => {
      const statement = createMockStatement({ currentBalance: 50000 })
      mockDb.creditCardStatements.get.mockResolvedValue(statement)
      const sourceWallet = createMockBankAccount({ id: 'pw_bank-1', isActive: true, balance: 100 })
      const creditCard = createMockCreditCard({ id: 'pw_cc-1' })
      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet)
        .mockResolvedValueOnce(creditCard)

      vi.mocked(validateSufficientFunds).mockResolvedValue({
        isValid: false,
        error: 'Insufficient funds',
      })

      await expect(
        processCreditCardPayment('ccs_stmt-1', 'pw_bank-1', 10000)
      ).rejects.toThrow('Insufficient funds')
    })
  })

  describe('makeMinimumPayment', () => {
    it('should call processCreditCardPayment with minimum amount', async () => {
      const statement = createMockStatement({
        id: 'ccs_stmt-1',
        minimumPayment: 2500,
        currentBalance: 50000,
        paidAmount: 0,
      })
      const sourceWallet = createMockBankAccount({ id: 'pw_bank-1', isActive: true })
      const creditCard = createMockCreditCard({ id: 'pw_cc-1' })

      mockDb.creditCardStatements.get
        .mockResolvedValueOnce(statement)  // makeMinimumPayment's get
        .mockResolvedValueOnce(statement)  // processCreditCardPayment's get
        .mockResolvedValue({ ...statement, paidAmount: 2500 }) // after update

      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet)
        .mockResolvedValueOnce(creditCard)

      mockDb.personalCategories.first
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)

      const result = await makeMinimumPayment('ccs_stmt-1', 'pw_bank-1')

      expect(result.payment.amount).toBe(2500)
    })
  })
})
