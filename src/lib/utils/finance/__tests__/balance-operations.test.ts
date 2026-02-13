vi.mock('@/lib/db', async () => {
  const { setupDexieMock } = await import('../../../../test/mocks/dexie')
  return setupDexieMock()
})

import { mockDb, resetMockDb } from '@/test/mocks/dexie'
import { createMockWallet, createMockCreditCard, createMockBankAccount } from '@/test/factories/wallet.factory'
import { createMockTransaction, createMockIncome, createMockTransfer } from '@/test/factories/transaction.factory'
import {
  updateWalletBalanceInDb,
  processTransactionBalanceUpdate,
  reverseTransactionBalanceUpdate,
  validateSufficientFunds,
  getWalletBalanceSummary,
  recalculateWalletBalance,
  fixWalletBalance,
} from '../balance-operations'

describe('balance-operations', () => {
  beforeEach(() => {
    resetMockDb()
  })

  describe('updateWalletBalanceInDb', () => {
    it('should add amount to wallet balance and update db', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 10000 })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      await updateWalletBalanceInDb('w1', 5000)

      expect(mockDb.personalWallets.get).toHaveBeenCalledWith('w1')
      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w1', {
        balance: 15000,
        updatedAt: expect.any(Date),
      })
    })

    it('should subtract when amount is negative', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 10000 })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      await updateWalletBalanceInDb('w1', -3000)

      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w1', {
        balance: 7000,
        updatedAt: expect.any(Date),
      })
    })

    it('should throw if wallet not found', async () => {
      mockDb.personalWallets.get.mockResolvedValue(undefined)

      await expect(updateWalletBalanceInDb('nonexistent', 100)).rejects.toThrow(
        'Wallet nonexistent not found'
      )
    })
  })

  describe('processTransactionBalanceUpdate', () => {
    it('should add amount for income transactions', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 10000 })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      const tx = createMockIncome({ walletId: 'w1', amount: 50000 })
      await processTransactionBalanceUpdate(tx)

      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w1', {
        balance: 60000,
        updatedAt: expect.any(Date),
      })
    })

    it('should subtract amount for expense transactions', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 10000 })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      const tx = createMockTransaction({ walletId: 'w1', type: 'expense', amount: 3000 })
      await processTransactionBalanceUpdate(tx)

      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w1', {
        balance: 7000,
        updatedAt: expect.any(Date),
      })
    })

    it('should move funds between wallets for transfer transactions', async () => {
      const sourceWallet = createMockWallet({ id: 'w-src', balance: 20000, currency: 'ARS' })
      const targetWallet = createMockWallet({ id: 'w-tgt', balance: 5000, currency: 'ARS' })

      // First call for subtract from source, then two get calls for source/target, then add to target
      // updateWalletBalanceInDb('w-src', -5000) → get('w-src') returns source (balance after first update)
      // then db.personalWallets.get('w-src') for source check
      // then db.personalWallets.get('w-tgt') for target check
      // updateWalletBalanceInDb('w-tgt', 5000) → get('w-tgt')
      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet)         // updateWalletBalanceInDb source (subtract)
        .mockResolvedValueOnce({ ...sourceWallet, balance: 15000 })  // get source for currency check
        .mockResolvedValueOnce(targetWallet)          // get target for currency check
        .mockResolvedValueOnce(targetWallet)          // updateWalletBalanceInDb target (add)

      const tx = createMockTransfer({
        walletId: 'w-src',
        targetWalletId: 'w-tgt',
        amount: 5000,
      })
      await processTransactionBalanceUpdate(tx)

      // Source wallet should have subtracted
      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w-src', {
        balance: 15000,
        updatedAt: expect.any(Date),
      })
      // Target wallet should have added
      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w-tgt', {
        balance: 10000,
        updatedAt: expect.any(Date),
      })
    })

    it('should apply exchange rate for cross-currency transfers', async () => {
      const sourceWallet = createMockWallet({ id: 'w-ars', balance: 1000000, currency: 'ARS' })
      const targetWallet = createMockWallet({ id: 'w-usd', balance: 500, currency: 'USD' })

      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet)          // update source balance
        .mockResolvedValueOnce({ ...sourceWallet, balance: 0 })  // get source for currency check
        .mockResolvedValueOnce(targetWallet)           // get target for currency check
        .mockResolvedValueOnce(targetWallet)           // update target balance

      const tx = createMockTransfer({
        walletId: 'w-ars',
        targetWalletId: 'w-usd',
        amount: 1000000,
        exchangeRate: 0.001, // 1 ARS = 0.001 USD
        currency: 'ARS',
      })
      await processTransactionBalanceUpdate(tx)

      // Target gets amount * exchangeRate = 1000000 * 0.001 = 1000
      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w-usd', {
        balance: 1500,
        updatedAt: expect.any(Date),
      })
    })

    it('should throw if transfer is missing targetWalletId', async () => {
      const tx = createMockTransfer({ targetWalletId: undefined })
      await expect(processTransactionBalanceUpdate(tx)).rejects.toThrow(
        'Transfer transaction missing target wallet'
      )
    })
  })

  describe('reverseTransactionBalanceUpdate', () => {
    it('should subtract income amount when reversing', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 60000 })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      const tx = createMockIncome({ walletId: 'w1', amount: 50000 })
      await reverseTransactionBalanceUpdate(tx)

      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w1', {
        balance: 10000,
        updatedAt: expect.any(Date),
      })
    })

    it('should add back expense amount when reversing', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 7000 })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      const tx = createMockTransaction({ walletId: 'w1', type: 'expense', amount: 3000 })
      await reverseTransactionBalanceUpdate(tx)

      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w1', {
        balance: 10000,
        updatedAt: expect.any(Date),
      })
    })

    it('should reverse transfer: add back to source, subtract from target', async () => {
      const sourceWallet = createMockWallet({ id: 'w-src', balance: 15000, currency: 'ARS' })
      const targetWallet = createMockWallet({ id: 'w-tgt', balance: 10000, currency: 'ARS' })

      mockDb.personalWallets.get
        .mockResolvedValueOnce(sourceWallet)           // update source (add back)
        .mockResolvedValueOnce({ ...sourceWallet, balance: 20000 })  // get source for currency check
        .mockResolvedValueOnce(targetWallet)            // get target for currency check
        .mockResolvedValueOnce(targetWallet)            // update target (subtract)

      const tx = createMockTransfer({
        walletId: 'w-src',
        targetWalletId: 'w-tgt',
        amount: 5000,
      })
      await reverseTransactionBalanceUpdate(tx)

      // Source wallet should have added back
      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w-src', {
        balance: 20000,
        updatedAt: expect.any(Date),
      })
      // Target wallet should have subtracted
      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w-tgt', {
        balance: 5000,
        updatedAt: expect.any(Date),
      })
    })
  })

  describe('validateSufficientFunds', () => {
    it('should return valid for physical wallet with enough balance', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 50000, type: 'physical' })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      const result = await validateSufficientFunds('w1', 30000)
      expect(result).toEqual({ isValid: true })
    })

    it('should return invalid for physical wallet with insufficient balance', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 10000, type: 'physical' })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      const result = await validateSufficientFunds('w1', 20000)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Insufficient')
    })

    it('should check credit limit for credit cards', async () => {
      const cc = createMockCreditCard({
        id: 'cc1',
        balance: -50000,
        creditLimit: 100000,
      })
      mockDb.personalWallets.get.mockResolvedValue(cc)

      // Available credit = 100000 + (-50000) = 50000
      const result = await validateSufficientFunds('cc1', 40000)
      expect(result).toEqual({ isValid: true })
    })

    it('should reject credit card when exceeding available credit', async () => {
      const cc = createMockCreditCard({
        id: 'cc1',
        balance: -90000,
        creditLimit: 100000,
      })
      mockDb.personalWallets.get.mockResolvedValue(cc)

      // Available credit = 100000 + (-90000) = 10000
      const result = await validateSufficientFunds('cc1', 20000)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Insufficient credit')
    })

    it('should return valid for credit card without credit limit set', async () => {
      const cc = createMockCreditCard({
        id: 'cc1',
        balance: -50000,
        creditLimit: undefined,
      })
      mockDb.personalWallets.get.mockResolvedValue(cc)

      const result = await validateSufficientFunds('cc1', 999999)
      expect(result).toEqual({ isValid: true })
    })

    it('should return invalid when wallet not found', async () => {
      mockDb.personalWallets.get.mockResolvedValue(undefined)

      const result = await validateSufficientFunds('nonexistent', 100)
      expect(result).toEqual({ isValid: false, error: 'Wallet not found' })
    })
  })

  describe('getWalletBalanceSummary', () => {
    it('should aggregate balances by wallet and currency', async () => {
      const wallets = [
        createMockWallet({ id: 'w1', name: 'Cash ARS', balance: 50000, currency: 'ARS', isActive: true }),
        createMockWallet({ id: 'w2', name: 'Cash USD', balance: 200, currency: 'USD', isActive: true }),
        createMockWallet({ id: 'w3', name: 'Bank ARS', balance: 100000, currency: 'ARS', isActive: true }),
      ]

      // The chain: .where('userId').equals(userId).and(fn).toArray()
      mockDb.personalWallets.and.mockImplementation((filterFn: (w: typeof wallets[0]) => boolean) => {
        const filtered = wallets.filter(filterFn)
        return { toArray: vi.fn().mockResolvedValue(filtered) }
      })

      const result = await getWalletBalanceSummary('test-user-1')

      expect(result.totalWallets).toBe(3)
      expect(result.activeWallets).toBe(3)
      expect(result.totalByWallet).toHaveLength(3)
      expect(result.totalByCurrency).toEqual(
        expect.arrayContaining([
          { currency: 'ARS', total: 150000 },
          { currency: 'USD', total: 200 },
        ])
      )
    })

    it('should exclude inactive wallets', async () => {
      const wallets = [
        createMockWallet({ id: 'w1', balance: 50000, isActive: true }),
        createMockWallet({ id: 'w2', balance: 30000, isActive: false }),
      ]

      mockDb.personalWallets.and.mockImplementation((filterFn: (w: typeof wallets[0]) => boolean) => {
        const filtered = wallets.filter(filterFn)
        return { toArray: vi.fn().mockResolvedValue(filtered) }
      })

      const result = await getWalletBalanceSummary('test-user-1')

      expect(result.totalWallets).toBe(1)
      expect(result.totalByWallet).toHaveLength(1)
    })
  })

  describe('recalculateWalletBalance', () => {
    it('should sum income, subtract expenses, and handle transfers', async () => {
      const transactions = [
        createMockIncome({ walletId: 'w1', amount: 100000, status: 'completed' }),
        createMockTransaction({ walletId: 'w1', type: 'expense', amount: 30000, status: 'completed' }),
        createMockTransaction({ walletId: 'w1', type: 'expense', amount: 5000, status: 'completed' }),
      ]

      // Chain: .where('walletId').equals(walletId).or('targetWalletId').equals(walletId).and(fn).toArray()
      mockDb.personalTransactions.and.mockImplementation((filterFn: (t: typeof transactions[0]) => boolean) => {
        const filtered = transactions.filter(filterFn)
        return { toArray: vi.fn().mockResolvedValue(filtered) }
      })

      const balance = await recalculateWalletBalance('w1')

      // 100000 (income) - 30000 (expense) - 5000 (expense) = 65000
      expect(balance).toBe(65000)
    })

    it('should include incoming transfers with exchange rate', async () => {
      const transactions = [
        createMockTransfer({
          walletId: 'w-other',
          targetWalletId: 'w1',
          amount: 1000,
          exchangeRate: 1200,
          status: 'completed',
        }),
      ]

      mockDb.personalTransactions.and.mockImplementation((filterFn: (t: typeof transactions[0]) => boolean) => {
        const filtered = transactions.filter(filterFn)
        return { toArray: vi.fn().mockResolvedValue(filtered) }
      })

      const balance = await recalculateWalletBalance('w1')

      // Incoming transfer: 1000 * 1200 = 1200000
      expect(balance).toBe(1200000)
    })

    it('should return 0 for wallets with no transactions', async () => {
      mockDb.personalTransactions.and.mockImplementation(() => {
        return { toArray: vi.fn().mockResolvedValue([]) }
      })

      const balance = await recalculateWalletBalance('w1')
      expect(balance).toBe(0)
    })
  })

  describe('fixWalletBalance', () => {
    it('should detect and correct balance discrepancy', async () => {
      const wallet = createMockWallet({ id: 'w1', balance: 50000 })
      mockDb.personalWallets.get.mockResolvedValue(wallet)

      // Mock recalculateWalletBalance to return different value
      const transactions = [
        createMockIncome({ walletId: 'w1', amount: 60000, status: 'completed' }),
      ]
      mockDb.personalTransactions.and.mockImplementation((filterFn: (t: typeof transactions[0]) => boolean) => {
        const filtered = transactions.filter(filterFn)
        return { toArray: vi.fn().mockResolvedValue(filtered) }
      })

      const result = await fixWalletBalance('w1')

      expect(result.oldBalance).toBe(50000)
      expect(result.newBalance).toBe(60000)
      expect(result.difference).toBe(10000)
      expect(mockDb.personalWallets.update).toHaveBeenCalledWith('w1', {
        balance: 60000,
        updatedAt: expect.any(Date),
      })
    })

    it('should throw if wallet not found', async () => {
      mockDb.personalWallets.get.mockResolvedValue(undefined)

      await expect(fixWalletBalance('nonexistent')).rejects.toThrow('Wallet not found')
    })
  })
})
