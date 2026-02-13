import Dexie from 'dexie'
import { PersonalWallet, PersonalTransaction, PersonalCategory, CreditCardStatement, CreditCardPayment } from '@/types/personal-finance'
import { createMockWallet, createMockCreditCard, createMockBankAccount } from '../factories/wallet.factory'
import { createMockTransaction, createMockIncome } from '../factories/transaction.factory'
import { createMockCategory, createMockIncomeCategory } from '../factories/category.factory'

/**
 * Seed a test database with sample data
 */
export async function seedDatabase(testDb: Dexie, options?: {
  wallets?: number
  transactions?: number
  categories?: number
}) {
  const { wallets: walletCount = 3, transactions: txCount = 5, categories: catCount = 3 } = options || {}

  const walletTable = testDb.table<PersonalWallet>('personalWallets')
  const transactionTable = testDb.table<PersonalTransaction>('personalTransactions')
  const categoryTable = testDb.table<PersonalCategory>('personalCategories')

  // Create wallets
  const wallets: PersonalWallet[] = []
  for (let i = 0; i < walletCount; i++) {
    if (i === 0) wallets.push(createMockWallet({ id: `pw_seed-${i}` }))
    else if (i === 1) wallets.push(createMockBankAccount({ id: `pw_seed-${i}` }))
    else wallets.push(createMockCreditCard({ id: `pw_seed-${i}` }))
  }
  await walletTable.bulkAdd(wallets)

  // Create categories
  const categories: PersonalCategory[] = []
  for (let i = 0; i < catCount; i++) {
    if (i % 2 === 0) categories.push(createMockCategory({ id: `pc_seed-${i}` }))
    else categories.push(createMockIncomeCategory({ id: `pc_seed-${i}` }))
  }
  await categoryTable.bulkAdd(categories)

  // Create transactions
  const transactions: PersonalTransaction[] = []
  for (let i = 0; i < txCount; i++) {
    const wallet = wallets[i % wallets.length]
    const category = categories[i % categories.length]
    if (i % 2 === 0) {
      transactions.push(createMockTransaction({
        id: `pt_seed-${i}`,
        walletId: wallet.id!,
        categoryId: category.id!,
      }))
    } else {
      transactions.push(createMockIncome({
        id: `pt_seed-${i}`,
        walletId: wallet.id!,
        categoryId: category.id!,
      }))
    }
  }
  await transactionTable.bulkAdd(transactions)

  return { wallets, categories, transactions }
}

/**
 * Clear all data from a test database
 */
export async function clearDatabase(testDb: Dexie) {
  const tables = ['personalWallets', 'personalCategories', 'personalTransactions', 'creditCardStatements', 'creditCardPayments', 'deletionLog']
  for (const table of tables) {
    try {
      await testDb.table(table).clear()
    } catch {
      // Table might not exist, skip
    }
  }
}
