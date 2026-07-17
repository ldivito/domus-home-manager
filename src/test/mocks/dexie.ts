import { vi } from 'vitest'

// Create a mock table with chainable query methods
function createMockTable() {
  const mockTable = {
    get: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue('mock-id'),
    put: vi.fn().mockResolvedValue('mock-id'),
    update: vi.fn().mockResolvedValue(1),
    delete: vi.fn().mockResolvedValue(undefined),
    toArray: vi.fn().mockResolvedValue([]),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    above: vi.fn().mockReturnThis(),
    below: vi.fn().mockReturnThis(),
    belowOrEqual: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    reverse: vi.fn().mockReturnThis(),
    sortBy: vi.fn().mockResolvedValue([]),
    bulkAdd: vi.fn().mockResolvedValue(undefined),
    bulkPut: vi.fn().mockResolvedValue(undefined),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    between: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  }
  return mockTable
}

// Create the full mock database
export function createMockDb() {
  return {
    personalWallets: createMockTable(),
    personalCategories: createMockTable(),
    personalTransactions: createMockTable(),
    creditCardStatements: createMockTable(),
    creditCardPayments: createMockTable(),
    deletionLog: createMockTable(),
    // Add other tables as needed
    transaction: vi.fn().mockImplementation((mode: string, tables: string[], fn: () => Promise<void>) => fn()),
  }
}

// Singleton mock db instance
export const mockDb = createMockDb()

// Mock deleteWithSync function
export const mockDeleteWithSync = vi.fn().mockResolvedValue(undefined)

// Setup the mock for vi.mock('@/lib/db')
export function setupDexieMock() {
  return {
    db: mockDb,
    getDatabase: vi.fn(() => mockDb),
    deleteWithSync: mockDeleteWithSync,
  }
}

// Reset all mock table methods
export function resetMockDb() {
  const tables = [
    'personalWallets',
    'personalCategories',
    'personalTransactions',
    'creditCardStatements',
    'creditCardPayments',
    'deletionLog',
  ] as const

  for (const table of tables) {
    const mockTable = mockDb[table]
    for (const key of Object.keys(mockTable)) {
      const fn = mockTable[key as keyof typeof mockTable]
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as ReturnType<typeof vi.fn>).mockReset()
      }
    }
    // Re-establish chainable returns
    mockTable.where.mockReturnThis()
    mockTable.equals.mockReturnThis()
    mockTable.above.mockReturnThis()
    mockTable.below.mockReturnThis()
    mockTable.belowOrEqual.mockReturnThis()
    mockTable.and.mockReturnThis()
    mockTable.or.mockReturnThis()
    mockTable.filter.mockReturnThis()
    mockTable.reverse.mockReturnThis()
    mockTable.between.mockReturnThis()
    mockTable.limit.mockReturnThis()
    mockTable.offset.mockReturnThis()
    // Re-establish default resolved values
    mockTable.get.mockResolvedValue(undefined)
    mockTable.add.mockResolvedValue('mock-id')
    mockTable.put.mockResolvedValue('mock-id')
    mockTable.update.mockResolvedValue(1)
    mockTable.delete.mockResolvedValue(undefined)
    mockTable.toArray.mockResolvedValue([])
    mockTable.first.mockResolvedValue(undefined)
    mockTable.count.mockResolvedValue(0)
    mockTable.sortBy.mockResolvedValue([])
  }
}

// Mock useLiveQuery from dexie-react-hooks
export const mockUseLiveQuery = vi.fn((queryFn: () => unknown) => {
  // By default, return undefined (loading state)
  // Tests should override this: mockUseLiveQuery.mockReturnValue(data)
  return undefined
})

export function setupDexieReactHooksMock() {
  return {
    useLiveQuery: mockUseLiveQuery,
  }
}
