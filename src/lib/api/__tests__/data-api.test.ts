/**
 * End-to-end tests of the API key management routes and the /api/v1 data API
 * against a real SQLite database loaded with schema.sql.
 */
import { readFileSync } from 'node:fs'
import { createTestD1, createTestKV, hasNodeSqlite, type TestD1 } from '@/test/mocks/d1-sqlite'
import type { CloudflareEnv } from '@/lib/cloudflare'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

// Session auth: the test passes the session as a header
vi.mock('@/lib/auth', () => ({
  getUserFromRequest: async (request: Request) => {
    const raw = request.headers.get('x-test-session')
    return raw ? { ...JSON.parse(raw), exp: 0, iat: 0 } : null
  }
}))

import * as keysRoute from '@/app/api/api-keys/route'
import * as keyRoute from '@/app/api/api-keys/[id]/route'
import * as tablesRoute from '@/app/api/v1/tables/route'
import * as listRoute from '@/app/api/v1/[table]/route'
import * as bulkRoute from '@/app/api/v1/[table]/bulk/route'
import * as recordRoute from '@/app/api/v1/[table]/[id]/route'
import * as pullRoute from '@/app/api/sync/pull/route'
import { SYNC_TABLE_NAMES } from '@/lib/sync-tables'
import { resetRateLimits } from '@/lib/rate-limit'

const BASE = 'https://domus.test'

let db: TestD1
let env: CloudflareEnv
let ipCounter = 0
let ip = ''

const ALICE = { userId: 'usr_alice', email: 'alice@test', householdId: 'household_1' }
const BOB = { userId: 'usr_bob', email: 'bob@test', householdId: 'household_2' }

function makeRequest(
  path: string,
  init: { method?: string; key?: string; session?: object; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  const headers: Record<string, string> = { 'cf-connecting-ip': ip, ...init.headers }
  if (init.key) headers.authorization = `Bearer ${init.key}`
  if (init.session) headers['x-test-session'] = JSON.stringify(init.session)
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const request = new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  })
  return Object.assign(request, { env })
}

const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) })

async function createKey(session: object, body: object = { name: 'agent' }) {
  const res = await keysRoute.POST(makeRequest('/api/api-keys', { method: 'POST', session, body }))
  expect(res.status).toBe(201)
  return (await res.json()) as { key: { id: string; prefix: string; scopes: string[] }; secret: string }
}

async function bulk(key: string, table: string, records: unknown[], query = '') {
  const res = await bulkRoute.POST(
    makeRequest(`/api/v1/${table}/bulk${query}`, { method: 'POST', key, body: { records } }),
    params({ table })
  )
  return { status: res.status, body: await res.json() }
}

async function getRecord(key: string, table: string, id: string) {
  const res = await recordRoute.GET(makeRequest(`/api/v1/${table}/${id}`, { key }), params({ table, id }))
  return { status: res.status, body: await res.json() }
}

function seedHousehold(householdId: string, userId: string) {
  db.raw.prepare('INSERT INTO households (id, name, ownerId, inviteCode) VALUES (?, ?, ?, ?)').run(householdId, householdId, userId, `code-${householdId}`)
  db.raw.prepare('INSERT INTO users (id, email, password, householdId) VALUES (?, ?, ?, ?)').run(userId, `${userId}@test`, 'x', householdId)
  db.raw.prepare("INSERT INTO household_members (id, householdId, userId, role) VALUES (?, ?, ?, 'owner')").run(`hm_${userId}`, householdId, userId)
}

describe.skipIf(!hasNodeSqlite)('agent data API', () => {
  beforeEach(() => {
    resetRateLimits()
    db = createTestD1()
    env = { domus_db: db, KV: createTestKV() }
    ip = `10.0.0.${++ipCounter}`
    seedHousehold(ALICE.householdId, ALICE.userId)
    seedHousehold(BOB.householdId, BOB.userId)
  })

  describe('migration', () => {
    it('applies cleanly on top of the schema (idempotent)', () => {
      const sql = readFileSync(`${process.cwd()}/migrations/0001_api_keys.sql`, 'utf8')
      expect(() => db.raw.exec(sql)).not.toThrow()
    })
  })

  describe('key management', () => {
    it('creates a key, returns the secret once and stores only its hash', async () => {
      const { key, secret } = await createKey(ALICE, { name: 'Claude', scopes: ['read'] })
      expect(secret).toMatch(/^domus_sk_/)
      expect(key.scopes).toEqual(['read'])
      expect(secret.startsWith(key.prefix)).toBe(true)

      const row = db.raw.prepare('SELECT * FROM api_keys WHERE id = ?').get(key.id) as Record<string, string>
      expect(row.householdId).toBe(ALICE.householdId)
      expect(row.keyHash).toMatch(/^[0-9a-f]{64}$/)
      expect(JSON.stringify(row)).not.toContain(secret)

      const list = await keysRoute.GET(makeRequest('/api/api-keys', { session: ALICE }))
      const listed = (await list.json()).keys
      expect(listed).toHaveLength(1)
      expect(JSON.stringify(listed)).not.toContain(secret)
      expect(listed[0]).not.toHaveProperty('keyHash')
    })

    it('requires a session and validates input', async () => {
      expect((await keysRoute.POST(makeRequest('/api/api-keys', { method: 'POST', body: { name: 'x' } }))).status).toBe(401)
      expect((await keysRoute.POST(makeRequest('/api/api-keys', { method: 'POST', session: ALICE, body: { name: '' } }))).status).toBe(400)
      expect((await keysRoute.POST(makeRequest('/api/api-keys', { method: 'POST', session: ALICE, body: { name: 'x', scopes: ['admin'] } }))).status).toBe(400)
    })

    it("cannot revoke another user's key", async () => {
      const { key } = await createKey(ALICE)
      const res = await keyRoute.DELETE(makeRequest(`/api/api-keys/${key.id}`, { method: 'DELETE', session: BOB }), params({ id: key.id }))
      expect(res.status).toBe(404)
    })
  })

  describe('authentication', () => {
    it('rejects a missing key', async () => {
      const res = await tablesRoute.GET(makeRequest('/api/v1/tables'))
      expect(res.status).toBe(401)
      expect((await res.json()).error.code).toBe('unauthorized')
      expect(res.headers.get('www-authenticate')).toContain('Bearer')
    })

    it('rejects malformed and unknown keys', async () => {
      expect((await tablesRoute.GET(makeRequest('/api/v1/tables', { key: 'nope' }))).status).toBe(401)
      const unknown = `domus_sk_${'A'.repeat(43)}`
      expect((await tablesRoute.GET(makeRequest('/api/v1/tables', { key: unknown }))).status).toBe(401)
    })

    it('rejects a key that shares the prefix but not the secret', async () => {
      const { secret } = await createKey(ALICE)
      const forged = secret.slice(0, -2) + (secret.endsWith('AA') ? 'BB' : 'AA')
      expect((await tablesRoute.GET(makeRequest('/api/v1/tables', { key: forged }))).status).toBe(401)
      expect((await tablesRoute.GET(makeRequest('/api/v1/tables', { key: secret }))).status).toBe(200)
    })

    it('rejects a revoked key', async () => {
      const { key, secret } = await createKey(ALICE)
      const revoke = await keyRoute.DELETE(makeRequest(`/api/api-keys/${key.id}`, { method: 'DELETE', session: ALICE }), params({ id: key.id }))
      expect(revoke.status).toBe(200)

      const res = await tablesRoute.GET(makeRequest('/api/v1/tables', { key: secret }))
      expect(res.status).toBe(401)
      expect((await res.json()).error.message).toMatch(/revoked/)
    })

    it('rejects writes with a read-only key but allows reads', async () => {
      const { secret } = await createKey(ALICE, { name: 'reader', scopes: ['read'] })
      const { status, body } = await bulk(secret, 'tasks', [{ title: 'x' }])
      expect(status).toBe(403)
      expect(body.error.code).toBe('insufficient_scope')
      expect((await listRoute.GET(makeRequest('/api/v1/tasks', { key: secret }), params({ table: 'tasks' }))).status).toBe(200)
    })

    it('rejects reads with a write-only key', async () => {
      const { secret } = await createKey(ALICE, { name: 'writer', scopes: ['write'] })
      expect((await tablesRoute.GET(makeRequest('/api/v1/tables', { key: secret }))).status).toBe(403)
    })

    it('stops working when the owner leaves the household', async () => {
      const { secret } = await createKey(ALICE)
      db.raw.prepare('DELETE FROM household_members WHERE userId = ?').run(ALICE.userId)
      const res = await tablesRoute.GET(makeRequest('/api/v1/tables', { key: secret }))
      expect(res.status).toBe(403)
    })

    it('rate limits repeated failed attempts', async () => {
      const bad = `domus_sk_${'B'.repeat(43)}`
      const statuses: number[] = []
      for (let i = 0; i < 22; i++) statuses.push((await tablesRoute.GET(makeRequest('/api/v1/tables', { key: bad }))).status)
      expect(statuses.slice(0, 20).every(s => s === 401)).toBe(true)
      expect(statuses[21]).toBe(429)
    })

    it('updates lastUsedAt', async () => {
      const { key, secret } = await createKey(ALICE)
      await tablesRoute.GET(makeRequest('/api/v1/tables', { key: secret }))
      const row = db.raw.prepare('SELECT lastUsedAt FROM api_keys WHERE id = ?').get(key.id) as { lastUsedAt: string }
      expect(row.lastUsedAt).toBeTruthy()
    })
  })

  describe('tables and validation of names', () => {
    it('lists every syncable table with fields', async () => {
      const { secret } = await createKey(ALICE)
      const res = await tablesRoute.GET(makeRequest('/api/v1/tables', { key: secret }))
      const { tables } = await res.json()
      expect(tables.map((t: { name: string }) => t.name)).toEqual([...SYNC_TABLE_NAMES])
    })

    it('returns 404 for tables outside the whitelist', async () => {
      const { secret } = await createKey(ALICE)
      for (const table of ['api_keys', 'sync_metadata', 'deletionLog', '__proto__']) {
        const res = await listRoute.GET(makeRequest(`/api/v1/${table}`, { key: secret }), params({ table }))
        expect(res.status).toBe(404)
      }
      expect((await bulk(secret, 'api_keys', [{ id: 'x' }])).status).toBe(404)
    })
  })

  describe('bulk upsert', () => {
    it('returns per-record results without failing the batch', async () => {
      const { secret } = await createKey(ALICE)
      await bulk(secret, 'personalCategories', [{ id: 'pc_food', name: 'Food', type: 'expense' }])
      await bulk(secret, 'personalWallets', [{ id: 'pw_cash', name: 'Cash', type: 'physical' }])

      const { status, body } = await bulk(secret, 'personalTransactions', [
        // 0: valid, resolved by names, date-only
        { type: 'expense', amount: 1500, walletName: 'cash', categoryName: 'Food', description: 'Groceries', date: '2026-11-02' },
        // 1: type-poisoned amount
        { type: 'expense', amount: '1500', walletId: 'pw_cash', categoryId: 'pc_food', description: 'Bad', date: '2026-11-02' },
        // 2: missing required fields
        { type: 'income', amount: 10 },
        // 3: not an object
        'oops',
        // 4: unknown category name
        { type: 'expense', amount: 5, walletId: 'pw_cash', categoryName: 'Nope', description: 'x', date: '2026-11-02' },
        // 5: valid with explicit id and an unknown field
        { id: 'pt_fixed', type: 'income', amount: 99.5, walletId: 'pw_cash', categoryId: 'pc_food', description: 'Refund', date: '2026-11-01T10:00:00Z', extraThing: 1 },
        // 6: invalid enum
        { type: 'gift', amount: 1, walletId: 'pw_cash', categoryId: 'pc_food', description: 'x', date: '2026-11-02' },
        // 7: invalid date
        { type: 'expense', amount: 1, walletId: 'pw_cash', categoryId: 'pc_food', description: 'x', date: 'yesterday-ish' }
      ])

      expect(status).toBe(200)
      expect(body.summary).toEqual({ created: 2, updated: 0, skipped: 0, error: 6 })
      const r = body.results
      expect(r[0].status).toBe('created')
      expect(r[0].id).toMatch(/^pt_[0-9a-f-]{36}$/)
      expect(r[1]).toMatchObject({ status: 'error', error: expect.stringContaining('amount') })
      expect(r[2].error).toMatch(/walletId: required/)
      expect(r[2].error).toMatch(/date: required/)
      expect(r[3]).toMatchObject({ index: 3, status: 'error' })
      expect(r[4].error).toMatch(/categoryName: no personalCategories record named "Nope"/)
      expect(r[5]).toMatchObject({ id: 'pt_fixed', status: 'created', warnings: [expect.stringContaining('extraThing')] })
      expect(r[6].error).toMatch(/type: must be one of/)
      expect(r[7].error).toMatch(/date: invalid date/)

      const created = await getRecord(secret, 'personalTransactions', r[0].id)
      expect(created.body.data).toMatchObject({
        id: r[0].id,
        walletId: 'pw_cash',
        categoryId: 'pc_food',
        userId: ALICE.userId,
        householdId: ALICE.householdId,
        status: 'completed',
        isFromCreditCard: false,
        date: '2026-11-02T12:00:00.000Z'
      })
      expect(created.body.data).not.toHaveProperty('walletName')
      expect(created.body.data.createdAt).toMatch(/Z$/)
      expect(created.body.data.updatedAt).toMatch(/Z$/)
    })

    it('applies the app rules for transfers and categories', async () => {
      const { secret } = await createKey(ALICE)
      await bulk(secret, 'personalWallets', [
        { id: 'pw_a', name: 'Bank', type: 'bank' },
        { id: 'pw_b', name: 'Cash', type: 'physical' }
      ])
      const base = { amount: 10, walletId: 'pw_a', description: 'x', date: '2026-11-02' }
      const { body } = await bulk(secret, 'personalTransactions', [
        { ...base, type: 'transfer', targetWalletName: 'cash' },
        { ...base, type: 'transfer' },
        { ...base, type: 'expense' }
      ])
      expect(body.results[0].status).toBe('created')
      expect(body.results[1].error).toMatch(/targetWalletId: required for transfers/)
      expect(body.results[2].error).toMatch(/categoryId: required/)
      const transfer = (await getRecord(secret, 'personalTransactions', body.results[0].id)).body.data
      expect(transfer).toMatchObject({ targetWalletId: 'pw_b', categoryId: '' })
    })

    it('writes rows exactly like sync push so devices pull them', async () => {
      const { secret } = await createKey(ALICE)
      const { body } = await bulk(secret, 'meals', [{ title: 'Pasta', date: '2026-11-04', mealType: 'dinner' }])
      const id = body.results[0].id
      expect(id).toMatch(/^mea_/)

      const row = db.raw.prepare('SELECT * FROM sync_metadata WHERE recordId = ?').get(id) as Record<string, string>
      expect(row.id).toBe(`sync_${ALICE.householdId}_meals_${id}`)
      expect(row.householdId).toBe(ALICE.householdId)
      expect(row.userId).toBe(ALICE.userId)
      expect(row.operation).toBe('upsert')

      const pull = await pullRoute.GET(makeRequest('/api/sync/pull', { session: ALICE }))
      const { changes } = await pull.json()
      expect(changes).toEqual([expect.objectContaining({ id, table: 'meals', deletedAt: null })])
      expect(changes[0].data.title).toBe('Pasta')
    })

    it('forces the key household and never leaks across households', async () => {
      const alice = await createKey(ALICE)
      const bob = await createKey(BOB)
      const { body } = await bulk(alice.secret, 'tasks', [{ id: 'tsk_a', title: 'Mine', householdId: BOB.householdId }])
      expect(body.results[0].status).toBe('created')

      const stored = await getRecord(alice.secret, 'tasks', 'tsk_a')
      expect(stored.body.data.householdId).toBe(ALICE.householdId)

      expect((await getRecord(bob.secret, 'tasks', 'tsk_a')).status).toBe(404)
      const bobList = await listRoute.GET(makeRequest('/api/v1/tasks', { key: bob.secret }), params({ table: 'tasks' }))
      expect((await bobList.json()).data).toEqual([])

      // Bob writing the same id creates his own row, Alice's stays intact
      await bulk(bob.secret, 'tasks', [{ id: 'tsk_a', title: 'Hijack' }])
      expect((await getRecord(alice.secret, 'tasks', 'tsk_a')).body.data.title).toBe('Mine')
    })

    it('rejects oversized batches and malformed bodies', async () => {
      const { secret } = await createKey(ALICE)
      const tooMany = Array.from({ length: 501 }, (_, i) => ({ title: `t${i}` }))
      expect((await bulk(secret, 'tasks', tooMany)).status).toBe(413)
      expect((await bulk(secret, 'tasks', [])).status).toBe(400)

      const res = await bulkRoute.POST(
        makeRequest('/api/v1/tasks/bulk', { method: 'POST', key: secret, body: { nope: true } }),
        params({ table: 'tasks' })
      )
      expect(res.status).toBe(400)
    })

    it('flags duplicate ids within one request', async () => {
      const { secret } = await createKey(ALICE)
      const { body } = await bulk(secret, 'tasks', [{ id: 'tsk_dup', title: 'a' }, { id: 'tsk_dup', title: 'b' }])
      expect(body.results.map((r: { status: string }) => r.status)).toEqual(['created', 'error'])
    })

    it('supports merge mode onto existing records', async () => {
      const { secret } = await createKey(ALICE)
      await bulk(secret, 'tasks', [{ id: 'tsk_m', title: 'Original', description: 'keep me' }])
      const { body } = await bulk(secret, 'tasks', [{ id: 'tsk_m', priority: 'high' }], '?mode=merge')
      expect(body.results[0].status).toBe('updated')
      const stored = (await getRecord(secret, 'tasks', 'tsk_m')).body.data
      expect(stored).toMatchObject({ title: 'Original', description: 'keep me', priority: 'high' })
    })
  })

  describe('last-writer-wins', () => {
    it('does not let an older updatedAt overwrite a newer version', async () => {
      const { secret } = await createKey(ALICE)
      const first = await bulk(secret, 'monthlyIncomes', [
        { id: 'inc_1', userId: 'usr_alice', amount: 2000, source: 'Salary', month: 10, year: 2026, updatedAt: '2026-10-05T10:00:00.000Z' }
      ])
      expect(first.body.results[0].status).toBe('created')

      const stale = await bulk(secret, 'monthlyIncomes', [
        { id: 'inc_1', userId: 'usr_alice', amount: 1, source: 'Old', month: 10, year: 2026, updatedAt: '2026-10-01T10:00:00.000Z' }
      ])
      expect(stale.body.results[0]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('newer') })

      const equal = await bulk(secret, 'monthlyIncomes', [
        { id: 'inc_1', userId: 'usr_alice', amount: 3, source: 'Same', month: 10, year: 2026, updatedAt: '2026-10-05T10:00:00.000Z' }
      ])
      expect(equal.body.results[0].status).toBe('skipped')
      expect((await getRecord(secret, 'monthlyIncomes', 'inc_1')).body.data.amount).toBe(2000)

      const newer = await bulk(secret, 'monthlyIncomes', [
        { id: 'inc_1', userId: 'usr_alice', amount: 2500, source: 'Salary', month: 10, year: 2026, updatedAt: '2026-10-06T10:00:00.000Z' }
      ])
      expect(newer.body.results[0].status).toBe('updated')
      const stored = (await getRecord(secret, 'monthlyIncomes', 'inc_1')).body.data
      expect(stored.amount).toBe(2500)
      expect(stored.createdAt).toBeTruthy()
    })

    it('enforces LWW in SQL even when a device pushed a newer version meanwhile', async () => {
      const { secret } = await createKey(ALICE)
      await bulk(secret, 'tasks', [{ id: 'tsk_lww', title: 'api', updatedAt: '2026-01-01T00:00:00.000Z' }])
      // Simulate a device push with a newer edit time (same deterministic row)
      db.raw.prepare("UPDATE sync_metadata SET data = ?, updatedAt = '2026-06-01T00:00:00.000Z' WHERE recordId = 'tsk_lww'")
        .run(JSON.stringify({ id: 'tsk_lww', title: 'device', updatedAt: '2026-06-01T00:00:00.000Z' }))
      const { body } = await bulk(secret, 'tasks', [{ id: 'tsk_lww', title: 'stale api', updatedAt: '2026-03-01T00:00:00.000Z' }])
      expect(body.results[0].status).toBe('skipped')
      expect((await getRecord(secret, 'tasks', 'tsk_lww')).body.data.title).toBe('device')
    })

    it('applies back-to-back server-stamped writes within the same millisecond', async () => {
      const { secret } = await createKey(ALICE)
      const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-03T12:00:00.000Z'))
      try {
        await bulk(secret, 'tasks', [{ id: 'tsk_fast', title: 'first' }])
        const { body } = await bulk(secret, 'tasks', [{ id: 'tsk_fast', title: 'second' }])
        expect(body.results[0].status).toBe('updated')
      } finally {
        spy.mockRestore()
      }
      expect((await getRecord(secret, 'tasks', 'tsk_fast')).body.data.title).toBe('second')
    })

    it('rejects updatedAt far in the future', async () => {
      const { secret } = await createKey(ALICE)
      const { body } = await bulk(secret, 'tasks', [{ title: 'x', updatedAt: '2999-01-01T00:00:00Z' }])
      expect(body.results[0]).toMatchObject({ status: 'error', error: expect.stringContaining('future') })
    })
  })

  describe('patch and delete', () => {
    it('merges a partial update onto the latest version and clears null fields', async () => {
      const { secret } = await createKey(ALICE)
      await bulk(secret, 'groceryItems', [{ id: 'gri_milk', name: 'Milk', category: 'defaultCategories.dairy', amount: '1 l' }])

      const res = await recordRoute.PATCH(
        makeRequest('/api/v1/groceryItems/gri_milk', { method: 'PATCH', key: secret, body: { amount: '2 l', addedBy: null, importance: 'high' } }),
        params({ table: 'groceryItems', id: 'gri_milk' })
      )
      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data).toMatchObject({ id: 'gri_milk', name: 'Milk', amount: '2 l', importance: 'high' })
      expect(data).not.toHaveProperty('addedBy')

      const bad = await recordRoute.PATCH(
        makeRequest('/api/v1/groceryItems/gri_milk', { method: 'PATCH', key: secret, body: { importance: 'urgent' } }),
        params({ table: 'groceryItems', id: 'gri_milk' })
      )
      expect(bad.status).toBe(422)

      const clearRequired = await recordRoute.PATCH(
        makeRequest('/api/v1/groceryItems/gri_milk', { method: 'PATCH', key: secret, body: { name: null } }),
        params({ table: 'groceryItems', id: 'gri_milk' })
      )
      expect(clearRequired.status).toBe(422)

      const mismatched = await recordRoute.PATCH(
        makeRequest('/api/v1/groceryItems/gri_milk', { method: 'PATCH', key: secret, body: { id: 'gri_other' } }),
        params({ table: 'groceryItems', id: 'gri_milk' })
      )
      expect(mismatched.status).toBe(400)

      const missing = await recordRoute.PATCH(
        makeRequest('/api/v1/groceryItems/gri_none', { method: 'PATCH', key: secret, body: { amount: '1' } }),
        params({ table: 'groceryItems', id: 'gri_none' })
      )
      expect(missing.status).toBe(404)
    })

    it('patch wins even when the stored updatedAt is ahead of the server clock', async () => {
      const { secret } = await createKey(ALICE)
      const future = new Date(Date.now() + 60_000).toISOString()
      await bulk(secret, 'tasks', [{ id: 'tsk_skew', title: 'a', updatedAt: future }])
      const res = await recordRoute.PATCH(
        makeRequest('/api/v1/tasks/tsk_skew', { method: 'PATCH', key: secret, body: { title: 'b' } }),
        params({ table: 'tasks', id: 'tsk_skew' })
      )
      expect(res.status).toBe(200)
      expect((await getRecord(secret, 'tasks', 'tsk_skew')).body.data.title).toBe('b')
    })

    it('deletes with a tombstone that devices apply on pull', async () => {
      const { secret } = await createKey(ALICE)
      await bulk(secret, 'chores', [{ id: 'chr_dishes', title: 'Dishes', nextDue: '2026-11-05' }])

      const res = await recordRoute.DELETE(
        makeRequest('/api/v1/chores/chr_dishes', { method: 'DELETE', key: secret }),
        params({ table: 'chores', id: 'chr_dishes' })
      )
      expect(res.status).toBe(200)

      const row = db.raw.prepare('SELECT operation, data FROM sync_metadata WHERE recordId = ?').get('chr_dishes') as { operation: string; data: string }
      expect(row.operation).toBe('delete')
      expect(JSON.parse(row.data)).toEqual({ id: 'chr_dishes', householdId: ALICE.householdId })

      expect((await getRecord(secret, 'chores', 'chr_dishes')).status).toBe(404)
      const list = await listRoute.GET(makeRequest('/api/v1/chores', { key: secret }), params({ table: 'chores' }))
      expect((await list.json()).data).toEqual([])

      const pull = await pullRoute.GET(makeRequest('/api/sync/pull', { session: ALICE }))
      const { changes } = await pull.json()
      expect(changes[0]).toMatchObject({ id: 'chr_dishes', table: 'chores' })
      expect(changes[0].deletedAt).toBeTruthy()

      // Second delete: already gone
      const again = await recordRoute.DELETE(
        makeRequest('/api/v1/chores/chr_dishes', { method: 'DELETE', key: secret }),
        params({ table: 'chores', id: 'chr_dishes' })
      )
      expect(again.status).toBe(404)

      // A stale bulk re-upload cannot resurrect it
      const { body } = await bulk(secret, 'chores', [{ id: 'chr_dishes', title: 'Dishes', nextDue: '2026-11-05', updatedAt: '2026-01-01T00:00:00Z' }])
      expect(body.results[0].status).toBe('skipped')
    })
  })

  describe('listing', () => {
    it('paginates with a cursor and filters with updatedSince', async () => {
      const { secret } = await createKey(ALICE)
      await bulk(secret, 'tasks', Array.from({ length: 5 }, (_, i) => ({ id: `tsk_${i}`, title: `Task ${i}` })))

      const page1 = await (await listRoute.GET(makeRequest('/api/v1/tasks?limit=2', { key: secret }), params({ table: 'tasks' }))).json()
      expect(page1.count).toBe(2)
      expect(page1.hasMore).toBe(true)
      const page2 = await (await listRoute.GET(makeRequest(`/api/v1/tasks?limit=2&cursor=${page1.nextCursor}`, { key: secret }), params({ table: 'tasks' }))).json()
      const page3 = await (await listRoute.GET(makeRequest(`/api/v1/tasks?limit=2&cursor=${page2.nextCursor}`, { key: secret }), params({ table: 'tasks' }))).json()
      expect(page3.hasMore).toBe(false)
      const ids = [...page1.data, ...page2.data, ...page3.data].map((t: { id: string }) => t.id).sort()
      expect(ids).toEqual(['tsk_0', 'tsk_1', 'tsk_2', 'tsk_3', 'tsk_4'])

      const since = page1.serverTime
      await new Promise(resolve => setTimeout(resolve, 5))
      await bulk(secret, 'tasks', [{ id: 'tsk_new', title: 'New' }])
      const incremental = await (await listRoute.GET(makeRequest(`/api/v1/tasks?updatedSince=${encodeURIComponent(since)}`, { key: secret }), params({ table: 'tasks' }))).json()
      expect(incremental.data.map((t: { id: string }) => t.id)).toEqual(['tsk_new'])

      const badCursor = await listRoute.GET(makeRequest('/api/v1/tasks?cursor=%%%', { key: secret }), params({ table: 'tasks' }))
      expect(badCursor.status).toBe(400)
    })
  })
})
