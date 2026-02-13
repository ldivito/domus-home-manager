import Dexie from 'dexie'

/**
 * Create a real Dexie database backed by fake-indexeddb for Layer 2/3 tests.
 * This tests actual query/write behavior against a real IndexedDB implementation.
 */
export function createTestDatabase(name?: string) {
  const dbName = name || `test-db-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const testDb = new Dexie(dbName)

  testDb.version(1).stores({
    personalWallets: 'id, userId, type, currency, isActive',
    personalCategories: 'id, userId, type, isActive',
    personalTransactions: 'id, userId, walletId, targetWalletId, categoryId, type, date, status, creditCardStatementId',
    creditCardStatements: 'id, userId, walletId, status, periodEnd, dueDate',
    creditCardPayments: 'id, userId, statementId, fromWalletId, paymentDate',
    deletionLog: '++id, tableName, recordId, deletedAt',
  })

  return testDb
}

/**
 * Close and delete a test database
 */
export async function destroyTestDatabase(testDb: Dexie) {
  testDb.close()
  await Dexie.delete(testDb.name)
}
