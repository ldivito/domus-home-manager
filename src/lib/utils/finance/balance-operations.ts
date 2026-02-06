// Balance Operations - Database operations for wallet balances

import { db } from '@/lib/db'
import { PersonalTransaction, CurrencyType } from '@/types/personal-finance'

/**
 * Update a wallet's balance in the database
 */
export async function updateWalletBalanceInDb(
  walletId: string, 
  amount: number
): Promise<void> {
  const wallet = await db.personalWallets.get(walletId)
  if (!wallet) {
    throw new Error(`Wallet ${walletId} not found`)
  }

  const newBalance = wallet.balance + amount
  
  await db.personalWallets.update(walletId, {
    balance: newBalance,
    updatedAt: new Date()
  })
}

/**
 * Process a transaction and update wallet balances
 */
export async function processTransactionBalanceUpdate(
  transaction: PersonalTransaction
): Promise<void> {
  switch (transaction.type) {
    case 'income':
      await updateWalletBalanceInDb(transaction.walletId, transaction.amount)
      break
      
    case 'expense':
      await updateWalletBalanceInDb(transaction.walletId, -transaction.amount)
      break
      
    case 'transfer':
      if (!transaction.targetWalletId) {
        throw new Error('Transfer transaction missing target wallet')
      }
      
      // Update source wallet (subtract amount)
      await updateWalletBalanceInDb(transaction.walletId, -transaction.amount)
      
      // Update target wallet (add amount, considering exchange rate)
      const sourceWallet = await db.personalWallets.get(transaction.walletId)
      const targetWallet = await db.personalWallets.get(transaction.targetWalletId)
      
      if (!sourceWallet || !targetWallet) {
        throw new Error('Source or target wallet not found')
      }
      
      // Calculate amount to add to target wallet
      let amountToAdd = transaction.amount
      if (transaction.exchangeRate && sourceWallet.currency !== targetWallet.currency) {
        amountToAdd = transaction.amount * transaction.exchangeRate
      }
      
      await updateWalletBalanceInDb(transaction.targetWalletId, amountToAdd)
      break
  }
}

/**
 * Reverse a transaction's balance effects (for deletion/editing)
 */
export async function reverseTransactionBalanceUpdate(
  transaction: PersonalTransaction
): Promise<void> {
  switch (transaction.type) {
    case 'income':
      // Remove the income from wallet
      await updateWalletBalanceInDb(transaction.walletId, -transaction.amount)
      break
      
    case 'expense':
      // Add back the expense to wallet
      await updateWalletBalanceInDb(transaction.walletId, transaction.amount)
      break
      
    case 'transfer':
      if (!transaction.targetWalletId) {
        throw new Error('Transfer transaction missing target wallet')
      }
      
      // Reverse source wallet (add amount back)
      await updateWalletBalanceInDb(transaction.walletId, transaction.amount)
      
      // Reverse target wallet (subtract amount)
      const sourceWallet = await db.personalWallets.get(transaction.walletId)
      const targetWallet = await db.personalWallets.get(transaction.targetWalletId)
      
      if (!sourceWallet || !targetWallet) {
        throw new Error('Source or target wallet not found')
      }
      
      // Calculate amount to subtract from target wallet
      let amountToSubtract = transaction.amount
      if (transaction.exchangeRate && sourceWallet.currency !== targetWallet.currency) {
        amountToSubtract = transaction.amount * transaction.exchangeRate
      }
      
      await updateWalletBalanceInDb(transaction.targetWalletId, -amountToSubtract)
      break
  }
}

/**
 * Validate wallet has sufficient funds for transaction
 */
export async function validateSufficientFunds(
  walletId: string, 
  amount: number
): Promise<{ isValid: boolean; error?: string }> {
  const wallet = await db.personalWallets.get(walletId)
  
  if (!wallet) {
    return { isValid: false, error: 'Wallet not found' }
  }
  
  // Credit cards don't need balance validation (they have credit limits)
  if (wallet.type === 'credit_card') {
    if (wallet.creditLimit) {
      const availableCredit = wallet.creditLimit + wallet.balance // balance is negative for debt
      if (amount > availableCredit) {
        return { 
          isValid: false, 
          error: `Insufficient credit. Available: ${availableCredit.toLocaleString()}` 
        }
      }
    }
    return { isValid: true }
  }
  
  // For other wallet types, check balance
  if (wallet.balance < amount) {
    return { 
      isValid: false, 
      error: `Insufficient balance. Available: ${wallet.balance.toLocaleString()}` 
    }
  }
  
  return { isValid: true }
}

/**
 * Get wallet balance summary for dashboard
 */
export interface WalletBalanceSummary {
  totalByWallet: { walletId: string; name: string; balance: number; currency: CurrencyType }[]
  totalByCurrency: { currency: CurrencyType; total: number }[]
  totalWallets: number
  activeWallets: number
}

export async function getWalletBalanceSummary(userId: string): Promise<WalletBalanceSummary> {
  const wallets = await db.personalWallets
    .where('userId')
    .equals(userId)
    .and(wallet => wallet.isActive)
    .toArray()
  
  const totalByWallet = wallets.map(wallet => ({
    walletId: wallet.id!,
    name: wallet.name,
    balance: wallet.balance,
    currency: wallet.currency
  }))
  
  const totalByCurrency = wallets.reduce((acc, wallet) => {
    const existing = acc.find(item => item.currency === wallet.currency)
    if (existing) {
      existing.total += wallet.balance
    } else {
      acc.push({ currency: wallet.currency, total: wallet.balance })
    }
    return acc
  }, [] as { currency: CurrencyType; total: number }[])
  
  return {
    totalByWallet,
    totalByCurrency,
    totalWallets: wallets.length,
    activeWallets: wallets.filter(w => w.isActive).length
  }
}

/**
 * Recalculate wallet balance from transactions (for consistency check)
 */
export async function recalculateWalletBalance(walletId: string): Promise<number> {
  // Get all transactions for this wallet
  const transactions = await db.personalTransactions
    .where('walletId')
    .equals(walletId)
    .or('targetWalletId')
    .equals(walletId)
    .and(tx => tx.status === 'completed')
    .toArray()
  
  let calculatedBalance = 0
  
  for (const transaction of transactions) {
    if (transaction.walletId === walletId) {
      // This wallet is the source
      switch (transaction.type) {
        case 'income':
          calculatedBalance += transaction.amount
          break
        case 'expense':
          calculatedBalance -= transaction.amount
          break
        case 'transfer':
          calculatedBalance -= transaction.amount
          break
      }
    } else if (transaction.targetWalletId === walletId) {
      // This wallet is the target of a transfer
      let amountReceived = transaction.amount
      if (transaction.exchangeRate) {
        amountReceived = transaction.amount * transaction.exchangeRate
      }
      calculatedBalance += amountReceived
    }
  }
  
  return calculatedBalance
}

/**
 * Fix wallet balance discrepancies (admin function)
 */
export async function fixWalletBalance(walletId: string): Promise<{
  oldBalance: number
  newBalance: number
  difference: number
}> {
  const wallet = await db.personalWallets.get(walletId)
  if (!wallet) {
    throw new Error('Wallet not found')
  }
  
  const calculatedBalance = await recalculateWalletBalance(walletId)
  const difference = calculatedBalance - wallet.balance
  
  await db.personalWallets.update(walletId, {
    balance: calculatedBalance,
    updatedAt: new Date()
  })
  
  return {
    oldBalance: wallet.balance,
    newBalance: calculatedBalance,
    difference
  }
}