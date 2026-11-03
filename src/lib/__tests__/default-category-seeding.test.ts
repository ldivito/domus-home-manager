/**
 * Regression: every fresh install used to seed default categories with random
 * ids before its first sync pull, so each new device/browser pushed a whole
 * new set of defaults and the household accumulated dozens of copies.
 * Seeds must be deterministic so independent installs produce the same records.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach } from 'vitest'
import { DomusDatabase, DEFAULT_SEED_DATE, defaultCategoryId, defaultPersonalCategoryId } from '@/lib/db'

const SEEDED_TABLES = ['groceryCategories', 'mealCategories', 'taskCategories', 'expenseCategories'] as const

async function freshInstallIds(): Promise<Record<string, string[]>> {
  const device = new DomusDatabase()
  await device.open()
  await device.seedDefaultCategoriesIfNeeded()
  await device.seedPersonalFinanceCategoriesForUser('usr_test')
  const ids: Record<string, string[]> = {}
  for (const t of SEEDED_TABLES) {
    ids[t] = (await device[t].toArray()).map(c => c.id!).sort()
  }
  ids.personalCategories = (await device.personalCategories.toArray()).map(c => c.id!).sort()
  device.close()
  await device.delete()
  return ids
}

describe('default category seeding', () => {
  afterEach(async () => {
    await Dexie_deleteAll()
  })

  it('produces identical ids on two independent fresh installs', async () => {
    const a = await freshInstallIds()
    const b = await freshInstallIds()
    expect(a).toEqual(b)
    expect(a.groceryCategories).toHaveLength(10)
    expect(a.mealCategories).toHaveLength(10)
    expect(a.taskCategories).toHaveLength(8)
    expect(a.expenseCategories).toHaveLength(8)
    expect(a.personalCategories).toHaveLength(15)
  })

  it('uses the documented id scheme and a fixed old timestamp', async () => {
    const device = new DomusDatabase()
    await device.open()
    await device.seedDefaultCategoriesIfNeeded()
    await device.seedPersonalFinanceCategoriesForUser('usr_test')

    const produce = await device.groceryCategories.get(defaultCategoryId('gcat', 'defaultCategories.produce'))
    expect(produce?.id).toBe('gcat_default_produce')
    expect(new Date(produce!.createdAt).getTime()).toBe(DEFAULT_SEED_DATE.getTime())

    const bills = await device.personalCategories.get(defaultPersonalCategoryId('usr_test', 'Bills & Utilities'))
    expect(bills?.id).toBe('pc_default_usr_test_bills-utilities')
    expect(new Date(bills!.updatedAt).getTime()).toBe(DEFAULT_SEED_DATE.getTime())

    // Re-seeding is a no-op, not a duplicate set
    await device.seedDefaultCategoriesIfNeeded()
    await device.seedPersonalFinanceCategoriesForUser('usr_test')
    expect(await device.groceryCategories.count()).toBe(10)
    expect(await device.personalCategories.count()).toBe(15)
    device.close()
  })
})

async function Dexie_deleteAll() {
  const { default: Dexie } = await import('dexie')
  await Dexie.delete('DomusDatabase')
}
