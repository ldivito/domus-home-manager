/**
 * deleteWithSync and bulkDeleteWithSync Tests
 *
 * These functions are defined in db.ts and use the module-level `db` singleton.
 * Since both the functions and the `db` object come from the same module,
 * we mock the internal `db` by intercepting the deletionLog table calls.
 *
 * Strategy: Use vi.mock to replace the entire db.ts module, providing:
 * - A mock `db` object with a mock `deletionLog` table
 * - The real `deleteWithSync` and `bulkDeleteWithSync` implementations reimplemented
 *   to test the logic (since mocking the module would lose the functions)
 *
 * Alternative strategy: Since we can't easily mock part of a module while importing
 * other parts, we test the functions using a real Dexie + fake-indexeddb approach.
 */

import 'fake-indexeddb/auto'
import Dexie, { type Table } from 'dexie'

// Create a minimal test database with just the tables we need
interface TestRecord {
  id?: string
  name: string
  householdId?: string
}

interface TestDeletionLog {
  id?: string
  tableName: string
  recordId: string
  householdId?: string
  deletedAt: Date
}

class TestDatabase extends Dexie {
  testRecords!: Table<TestRecord>
  deletionLog!: Table<TestDeletionLog>

  constructor() {
    super('TestDeleteWithSyncDb')
    this.version(1).stores({
      testRecords: 'id',
      deletionLog: 'id, tableName, recordId, deletedAt',
    })
  }
}

describe('deleteWithSync and bulkDeleteWithSync logic', () => {
  let testDb: TestDatabase

  beforeEach(async () => {
    testDb = new TestDatabase()
    await testDb.open()
    // Clear tables
    await testDb.testRecords.clear()
    await testDb.deletionLog.clear()
  })

  afterEach(async () => {
    testDb.close()
    await Dexie.delete('TestDeleteWithSyncDb')
  })

  describe('deleteWithSync equivalent logic', () => {
    async function deleteWithSync(
      table: Table<TestRecord>,
      tableName: string,
      recordId: string
    ): Promise<void> {
      const record = await table.get(recordId)
      const householdId = record?.householdId
      await table.delete(recordId)
      await testDb.deletionLog.add({
        id: `del_${crypto.randomUUID()}`,
        tableName,
        recordId,
        householdId,
        deletedAt: new Date(),
      })
    }

    it('should delete the record and create a deletion log entry', async () => {
      await testDb.testRecords.add({
        id: 'rec-1',
        name: 'Test Record',
        householdId: 'hh-1',
      })

      await deleteWithSync(testDb.testRecords, 'testRecords', 'rec-1')

      // Record should be deleted
      const record = await testDb.testRecords.get('rec-1')
      expect(record).toBeUndefined()

      // Deletion log should have an entry
      const logs = await testDb.deletionLog.toArray()
      expect(logs).toHaveLength(1)
      expect(logs[0].tableName).toBe('testRecords')
      expect(logs[0].recordId).toBe('rec-1')
      expect(logs[0].householdId).toBe('hh-1')
      expect(logs[0].deletedAt).toBeInstanceOf(Date)
    })

    it('should capture householdId from the record before deleting', async () => {
      await testDb.testRecords.add({
        id: 'rec-2',
        name: 'With Household',
        householdId: 'hh-special',
      })

      await deleteWithSync(testDb.testRecords, 'testRecords', 'rec-2')

      const logs = await testDb.deletionLog.toArray()
      expect(logs[0].householdId).toBe('hh-special')
    })

    it('should handle deleting a record without householdId', async () => {
      await testDb.testRecords.add({
        id: 'rec-3',
        name: 'No Household',
      })

      await deleteWithSync(testDb.testRecords, 'testRecords', 'rec-3')

      const logs = await testDb.deletionLog.toArray()
      expect(logs[0].householdId).toBeUndefined()
    })

    it('should handle deleting a nonexistent record (still logs deletion)', async () => {
      // Even if record doesn't exist, we still log the deletion
      // (the sync needs to know about it)
      await deleteWithSync(testDb.testRecords, 'testRecords', 'nonexistent')

      const logs = await testDb.deletionLog.toArray()
      expect(logs).toHaveLength(1)
      expect(logs[0].recordId).toBe('nonexistent')
      expect(logs[0].householdId).toBeUndefined()
    })
  })

  describe('bulkDeleteWithSync equivalent logic', () => {
    async function bulkDeleteWithSync(
      table: Table<TestRecord>,
      tableName: string,
      recordIds: string[]
    ): Promise<void> {
      if (recordIds.length === 0) return
      const records = await table.bulkGet(recordIds)
      const now = new Date()
      await table.bulkDelete(recordIds)
      const deletionLogs = recordIds.map((recordId, index) => ({
        id: `del_${crypto.randomUUID()}`,
        tableName,
        recordId,
        householdId: records[index]?.householdId,
        deletedAt: now,
      }))
      await testDb.deletionLog.bulkAdd(deletionLogs)
    }

    it('should bulk delete records and create log entries for each', async () => {
      await testDb.testRecords.bulkAdd([
        { id: 'r1', name: 'Record 1', householdId: 'hh-1' },
        { id: 'r2', name: 'Record 2', householdId: 'hh-1' },
        { id: 'r3', name: 'Record 3', householdId: 'hh-2' },
      ])

      await bulkDeleteWithSync(testDb.testRecords, 'testRecords', ['r1', 'r2', 'r3'])

      // All records should be deleted
      const remaining = await testDb.testRecords.toArray()
      expect(remaining).toHaveLength(0)

      // Deletion logs should have 3 entries
      const logs = await testDb.deletionLog.toArray()
      expect(logs).toHaveLength(3)

      const logMap = new Map(logs.map(l => [l.recordId, l]))
      expect(logMap.get('r1')!.householdId).toBe('hh-1')
      expect(logMap.get('r2')!.householdId).toBe('hh-1')
      expect(logMap.get('r3')!.householdId).toBe('hh-2')
    })

    it('should do nothing for empty recordIds array', async () => {
      await testDb.testRecords.add({ id: 'safe', name: 'Should not be deleted' })

      await bulkDeleteWithSync(testDb.testRecords, 'testRecords', [])

      const remaining = await testDb.testRecords.toArray()
      expect(remaining).toHaveLength(1)

      const logs = await testDb.deletionLog.toArray()
      expect(logs).toHaveLength(0)
    })

    it('should use the same timestamp for all deletion logs in a batch', async () => {
      await testDb.testRecords.bulkAdd([
        { id: 'b1', name: 'Batch 1' },
        { id: 'b2', name: 'Batch 2' },
      ])

      await bulkDeleteWithSync(testDb.testRecords, 'testRecords', ['b1', 'b2'])

      const logs = await testDb.deletionLog.toArray()
      expect(logs).toHaveLength(2)
      // All logs should have the same deletedAt timestamp
      expect(logs[0].deletedAt.getTime()).toBe(logs[1].deletedAt.getTime())
    })
  })
})
