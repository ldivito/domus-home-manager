import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import { DomusDatabase } from '@/lib/db'
import { dedupeSyncedData, findDuplicateGroups, DEDUPE_BACKUP_KEY } from '@/lib/dedupe'

const old = new Date('2024-01-01T00:00:00.000Z')
const newer = new Date('2025-06-01T00:00:00.000Z')

let database: DomusDatabase

beforeEach(async () => {
  database = new DomusDatabase()
  await database.open()
  // Start from empty tables (ready handler seeds defaults)
  await Promise.all([
    database.groceryCategories.clear(), database.mealCategories.clear(),
    database.taskCategories.clear(), database.expenseCategories.clear(),
    database.personalCategories.clear(), database.deletionLog.clear(),
    database.creditCardStatements.clear()
  ])
})

afterEach(async () => {
  database.close()
  await Dexie.delete('DomusDatabase')
})

describe('findDuplicateGroups', () => {
  it('keeps stable default ids, then the oldest, then the smallest id', () => {
    const groups = findDuplicateGroups([
      { id: 'gcat_b', name: 'Produce', createdAt: old },
      { id: 'gcat_a', name: 'produce ', createdAt: old },
      { id: 'gcat_default_produce', name: 'Produce', createdAt: newer },
      { id: 'gcat_c', name: 'Produce', createdAt: new Date('2023-01-01') }
    ], r => r.name!.trim().toLowerCase())
    expect(groups).toHaveLength(1)
    expect(groups[0].keep.id).toBe('gcat_default_produce')

    const withoutStable = findDuplicateGroups([
      { id: 'gcat_b', name: 'X', createdAt: old },
      { id: 'gcat_a', name: 'X', createdAt: old },
      { id: 'gcat_c', name: 'X', createdAt: newer }
    ], r => r.name!)
    expect(withoutStable[0].keep.id).toBe('gcat_a')
  })

  it('picks the same canonical record regardless of input order', () => {
    const records = [
      { id: 'b', name: 'n', createdAt: old },
      { id: 'a', name: 'n', createdAt: old },
      { id: 'c', name: 'n', createdAt: newer }
    ]
    const forward = findDuplicateGroups(records, r => r.name!)[0].keep.id
    const reverse = findDuplicateGroups([...records].reverse(), r => r.name!)[0].keep.id
    expect(forward).toBe(reverse)
  })
})

describe('dedupeSyncedData', () => {
  it('merges duplicated grocery categories and logs tombstones for sync', async () => {
    await database.groceryCategories.bulkAdd([
      { id: 'gcat_1', name: 'defaultCategories.produce', isDefault: true, createdAt: old },
      { id: 'gcat_2', name: 'defaultCategories.produce', isDefault: true, createdAt: newer },
      { id: 'gcat_3', name: 'defaultCategories.dairy', isDefault: true, createdAt: old }
    ])

    const result = await dedupeSyncedData(database)

    expect(result.removed.groceryCategories).toBe(1)
    expect((await database.groceryCategories.toArray()).map(c => c.id).sort()).toEqual(['gcat_1', 'gcat_3'])
    const log = await database.deletionLog.toArray()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ tableName: 'groceryCategories', recordId: 'gcat_2' })
  })

  it('repoints tasks, recurring expenses and personal transactions to the kept category', async () => {
    await database.taskCategories.bulkAdd([
      { id: 'tcat_old', name: 'Home', isDefault: true, createdAt: old },
      { id: 'tcat_dup', name: 'Home', isDefault: true, createdAt: newer }
    ])
    await database.tasks.add({ id: 'task_1', title: 't', category: 'tcat_dup', isCompleted: false, priority: 'medium', createdAt: newer } as never)

    await database.expenseCategories.bulkAdd([
      { id: 'ecat_old', name: 'Housing', isDefault: true, createdAt: old },
      { id: 'ecat_dup', name: 'Housing', isDefault: true, createdAt: newer }
    ])
    await database.recurringExpenses.add({ id: 'rexp_1', name: 'Rent', category: 'ecat_dup', createdAt: newer } as never)

    await database.personalCategories.bulkAdd([
      { id: 'pc_a', userId: 'u1', name: 'Salary', type: 'income', color: '', icon: '', isActive: true, isDefault: true, createdAt: old, updatedAt: old },
      { id: 'pc_b', userId: 'u1', name: 'Salary', type: 'income', color: '', icon: '', isActive: true, isDefault: true, createdAt: newer, updatedAt: newer },
      // Same name, different user / type: not duplicates
      { id: 'pc_c', userId: 'u2', name: 'Salary', type: 'income', color: '', icon: '', isActive: true, isDefault: true, createdAt: newer, updatedAt: newer },
      { id: 'pc_d', userId: 'u1', name: 'Salary', type: 'expense', color: '', icon: '', isActive: true, isDefault: true, createdAt: newer, updatedAt: newer }
    ])
    await database.personalTransactions.add({ id: 'ptx_1', userId: 'u1', categoryId: 'pc_b', createdAt: newer } as never)

    const result = await dedupeSyncedData(database)

    expect(result.removed).toMatchObject({ taskCategories: 1, expenseCategories: 1, personalCategories: 1 })
    expect(result.remapped).toBe(3)
    expect((await database.tasks.get('task_1'))?.category).toBe('tcat_old')
    expect((await database.recurringExpenses.get('rexp_1'))?.category).toBe('ecat_old')
    expect((await database.personalTransactions.get('ptx_1'))?.categoryId).toBe('pc_a')
    expect((await database.personalCategories.toArray()).map(c => c.id).sort()).toEqual(['pc_a', 'pc_c', 'pc_d'])
  })

  it('merges saved grocery items, keeps usage and repoints meal ingredients', async () => {
    await database.savedGroceryItems.bulkAdd([
      { id: 'sgi_1', name: 'Milk', category: 'defaultCategories.dairy', timesUsed: 2, createdAt: old },
      { id: 'sgi_2', name: 'milk', category: 'defaultCategories.dairy', timesUsed: 5, lastUsed: newer, createdAt: newer },
      { id: 'sgi_3', name: 'Milk', category: 'defaultCategories.beverages', timesUsed: 1, createdAt: newer }
    ] as never)
    await database.meals.add({ id: 'meal_1', title: 'x', date: newer, mealType: 'breakfast', ingredients: [{ savedGroceryItemId: 'sgi_2' }], createdAt: newer } as never)

    await dedupeSyncedData(database)

    const kept = await database.savedGroceryItems.get('sgi_1')
    expect(kept?.timesUsed).toBe(5)
    expect(await database.savedGroceryItems.get('sgi_2')).toBeUndefined()
    expect(await database.savedGroceryItems.get('sgi_3')).toBeDefined()
    const meal = await database.meals.get('meal_1')
    expect(meal?.ingredients?.[0].savedGroceryItemId).toBe('sgi_1')
  })

  it('keeps the most recently edited home settings', async () => {
    await database.homeSettings.bulkAdd([
      { id: 'hst_a', homeName: 'Old', lastUpdated: old, createdAt: old },
      { id: 'hst_b', homeName: 'New', lastUpdated: newer, createdAt: newer }
    ] as never)

    await dedupeSyncedData(database)

    expect((await database.homeSettings.toArray()).map(h => h.id)).toEqual(['hst_b'])
  })

  it('never merges saved meals whose ingredients differ', async () => {
    await database.savedMeals.bulkAdd([
      { id: 'smea_1', name: 'Guiso', category: 'x', ingredients: [{ savedGroceryItemId: 'sgi_a' }], timesUsed: 1, createdAt: old },
      { id: 'smea_2', name: 'Guiso', category: 'x', ingredients: [{ savedGroceryItemId: 'sgi_b' }], timesUsed: 1, createdAt: newer },
      { id: 'smea_3', name: 'Guiso', category: 'x', ingredients: [{ savedGroceryItemId: 'sgi_a' }], timesUsed: 4, createdAt: newer }
    ] as never)

    await dedupeSyncedData(database)

    expect((await database.savedMeals.toArray()).map(m => m.id).sort()).toEqual(['smea_1', 'smea_2'])
    expect((await database.savedMeals.get('smea_1'))?.timesUsed).toBe(4)
  })

  it('copies fields only the removed copy had onto the kept record', async () => {
    await database.homeSettings.bulkAdd([
      { id: 'hst_a', homeName: 'Casa', address: { street: 'Calle 1' }, lastUpdated: old, createdAt: old },
      { id: 'hst_b', homeName: 'Casa nueva', lastUpdated: newer, createdAt: newer }
    ] as never)

    await dedupeSyncedData(database)

    const kept = (await database.homeSettings.toArray())[0] as unknown as Record<string, unknown>
    expect(kept.id).toBe('hst_b')
    expect(kept.homeName).toBe('Casa nueva')
    expect(kept.address).toEqual({ street: 'Calle 1' })
  })

  it('keeps a local backup of every removed record', async () => {
    localStorage.removeItem(DEDUPE_BACKUP_KEY)
    await database.groceryCategories.bulkAdd([
      { id: 'gcat_1', name: 'A', isDefault: false, createdAt: old },
      { id: 'gcat_2', name: 'A', isDefault: false, color: '#fff', createdAt: newer }
    ])

    await dedupeSyncedData(database)

    const backup = JSON.parse(localStorage.getItem(DEDUPE_BACKUP_KEY) || '[]')
    expect(backup).toHaveLength(1)
    expect(backup[0]).toMatchObject({ tableName: 'groceryCategories', record: { id: 'gcat_2', color: '#fff' } })
    expect((await database.groceryCategories.get('gcat_1'))?.color).toBe('#fff')
  })

  it('removes only empty, unreferenced duplicate statements of the same card and month', async () => {
    const base = { userId: 'u1', walletId: 'pw_visa', periodStart: new Date('2026-09-27'), periodEnd: new Date('2026-10-26'), dueDate: new Date('2026-11-06'), currency: 'ARS', status: 'open', totalCharges: 0, totalPayments: 0, currentBalance: 0, minimumPayment: 0, paidAmount: 0 }
    await database.creditCardStatements.bulkAdd([
      { ...base, id: 'ccs_a', createdAt: old, updatedAt: old },
      { ...base, id: 'ccs_b', createdAt: newer, updatedAt: newer },
      { ...base, id: 'ccs_c', createdAt: newer, updatedAt: newer },               // referenced by a transaction
      { ...base, id: 'ccs_d', currentBalance: 1500, createdAt: newer, updatedAt: newer }, // has data
      { ...base, id: 'ccs_other_month', periodEnd: new Date('2026-09-26'), createdAt: old, updatedAt: old }
    ] as never)
    await database.personalTransactions.add({ id: 'pt_1', userId: 'u1', creditCardStatementId: 'ccs_c', createdAt: newer } as never)

    const result = await dedupeSyncedData(database)

    expect(result.removed.creditCardStatements).toBe(2)
    expect((await database.creditCardStatements.toArray()).map(s => s.id).sort()).toEqual(['ccs_c', 'ccs_d', 'ccs_other_month'])
  })

  it('is a no-op on clean data', async () => {
    await database.groceryCategories.add({ id: 'gcat_1', name: 'A', isDefault: false, createdAt: old })
    const result = await dedupeSyncedData(database)
    expect(result).toEqual({ removed: {}, remapped: 0 })
    expect(await database.deletionLog.count()).toBe(0)
  })
})
