/**
 * Data API v1 improvements: dryRun, partial validation, balance
 * recalculation, /me, list filters, import batches and the automatic
 * exchange rate. Real SQLite loaded with schema.sql.
 */
import { createTestD1, createTestKV, hasNodeSqlite, type TestD1 } from '@/test/mocks/d1-sqlite'
import type { CloudflareEnv } from '@/lib/cloudflare'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: async (request: Request) => {
    const raw = request.headers.get('x-test-session')
    return raw ? { ...JSON.parse(raw), exp: 0, iat: 0 } : null
  }
}))

import * as keysRoute from '@/app/api/api-keys/route'
import * as meRoute from '@/app/api/v1/me/route'
import * as listRoute from '@/app/api/v1/[table]/route'
import * as bulkRoute from '@/app/api/v1/[table]/bulk/route'
import * as recordRoute from '@/app/api/v1/[table]/[id]/route'
import * as recalcRoute from '@/app/api/v1/[table]/[id]/recalculate/route'
import * as batchRoute from '@/app/api/v1/import-batches/[batchId]/route'
import { resetRateLimits } from '@/lib/rate-limit'
import { TABLE_METADATA } from '../table-metadata'

const BASE = 'https://domus.test'
const ALICE = { userId: 'usr_alice', email: 'alice@test', householdId: 'household_1' }

let db: TestD1
let env: CloudflareEnv
let ipCounter = 0
let ip = ''
let secret = ''

function makeRequest(path: string, init: { method?: string; key?: string; session?: object; body?: unknown } = {}): Request {
  const headers: Record<string, string> = { 'cf-connecting-ip': ip }
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

async function createKey(body: object = { name: 'agent' }) {
  const res = await keysRoute.POST(makeRequest('/api/api-keys', { method: 'POST', session: ALICE, body }))
  expect(res.status).toBe(201)
  return (await res.json()) as { key: { id: string; prefix: string; scopes: string[] }; secret: string }
}

async function bulk(table: string, records: unknown[], query = '', key = secret) {
  const res = await bulkRoute.POST(
    makeRequest(`/api/v1/${table}/bulk${query}`, { method: 'POST', key, body: { records } }),
    params({ table })
  )
  return { status: res.status, body: await res.json() }
}

async function get(table: string, id: string) {
  const res = await recordRoute.GET(makeRequest(`/api/v1/${table}/${id}`, { key: secret }), params({ table, id }))
  return { status: res.status, body: await res.json() }
}

async function patch(table: string, id: string, body: object, query = '') {
  const res = await recordRoute.PATCH(
    makeRequest(`/api/v1/${table}/${id}${query}`, { method: 'PATCH', key: secret, body }),
    params({ table, id })
  )
  return { status: res.status, body: await res.json() }
}

async function list(table: string, query = '') {
  const res = await listRoute.GET(makeRequest(`/api/v1/${table}${query}`, { key: secret }), params({ table }))
  return { status: res.status, body: await res.json() }
}

async function recalc(id: string, body?: object, query = '', table = 'personalWallets') {
  const res = await recalcRoute.POST(
    makeRequest(`/api/v1/${table}/${id}/recalculate${query}`, { method: 'POST', key: secret, body }),
    params({ table, id })
  )
  return { status: res.status, body: await res.json() }
}

const syncRowCount = () => (db.raw.prepare('SELECT COUNT(*) AS n FROM sync_metadata').get() as { n: number }).n
const syncSnapshot = () => JSON.stringify(db.raw.prepare('SELECT * FROM sync_metadata ORDER BY id').all())

/** Store a record exactly as an old device would have pushed it (no API validation). */
function insertLegacy(table: string, data: Record<string, unknown>) {
  const at = '2026-01-01T00:00:00.000Z'
  db.raw.prepare(`
    INSERT INTO sync_metadata (id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'upsert', ?, ?, ?)
  `).run(`sync_${ALICE.householdId}_${table}_${data.id}`, ALICE.userId, ALICE.householdId, table, data.id as string, JSON.stringify(data), at, at)
}

function seedHousehold(householdId: string, userId: string) {
  db.raw.prepare('INSERT INTO households (id, name, ownerId, inviteCode) VALUES (?, ?, ?, ?)').run(householdId, householdId, userId, `code-${householdId}`)
  db.raw.prepare('INSERT INTO users (id, email, password, householdId) VALUES (?, ?, ?, ?)').run(userId, `${userId}@test`, 'x', householdId)
  db.raw.prepare("INSERT INTO household_members (id, householdId, userId, role) VALUES (?, ?, ?, 'owner')").run(`hm_${userId}`, householdId, userId)
}

async function seedFinance() {
  await bulk('personalCategories', [
    { id: 'pc_food', name: 'Food', type: 'expense' },
    { id: 'pc_salary', name: 'Salary', type: 'income' }
  ])
  await bulk('personalWallets', [
    { id: 'pw_ars', name: 'Bank ARS', type: 'bank', currency: 'ARS', balance: 7 },
    { id: 'pw_usd', name: 'Bank USD', type: 'bank', currency: 'USD' }
  ])
}

const tx = (id: string, extra: Record<string, unknown>) => ({
  id, walletId: 'pw_ars', categoryId: 'pc_food', description: id, currency: 'ARS', ...extra
})

/** Mixed transactions on pw_ars (and one transfer from pw_usd). */
const LEDGER = [
  tx('pt_before', { type: 'income', amount: 1000, categoryId: 'pc_salary', date: '2026-09-15' }),
  tx('pt_salary', { type: 'income', amount: 5000, categoryId: 'pc_salary', date: '2026-10-05' }),
  tx('pt_groceries', { type: 'expense', amount: 1200, date: '2026-10-06' }),
  tx('pt_refund', { type: 'refund', amount: 300, date: '2026-10-07' }),
  tx('pt_cancelled', { type: 'expense', amount: 999, date: '2026-10-08', status: 'cancelled' }),
  // USD -> ARS transfer: -100 on pw_usd, +100 * 1400 on pw_ars
  tx('pt_fx', { type: 'transfer', amount: 100, currency: 'USD', exchangeRate: 1400, walletId: 'pw_usd', targetWalletId: 'pw_ars', date: '2026-10-10' }),
  // USD charge on the ARS wallet without a rate: left out of the ARS balance
  tx('pt_usd_charge', { type: 'expense', amount: 50, currency: 'USD', date: '2026-10-11' })
]

describe.skipIf(!hasNodeSqlite)('data API v1 improvements', () => {
  beforeEach(async () => {
    resetRateLimits()
    db = createTestD1()
    env = { domus_db: db, KV: createTestKV() }
    ip = `10.1.0.${++ipCounter}`
    seedHousehold(ALICE.householdId, ALICE.userId)
    secret = (await createKey()).secret
  })

  describe('dryRun', () => {
    it('bulk returns the same per-record results but writes nothing', async () => {
      await seedFinance()
      const before = syncSnapshot()
      const records = [
        tx('pt_a', { type: 'expense', amount: 10, date: '2026-10-01' }),
        tx('pt_b', { type: 'expense', amount: 'bad', date: '2026-10-01' })
      ]
      const dry = await bulk('personalTransactions', records, '?dryRun=true')
      expect(dry.status).toBe(200)
      expect(dry.body.dryRun).toBe(true)
      expect(syncSnapshot()).toBe(before)
      expect((await get('personalTransactions', 'pt_a')).status).toBe(404)

      const real = await bulk('personalTransactions', records)
      expect(real.body).not.toHaveProperty('dryRun')
      expect(real.body.results).toEqual(dry.body.results)
      expect(real.body.summary).toEqual(dry.body.summary)
      expect(syncRowCount()).toBeGreaterThan(0)
    })

    it('reports skipped (LWW) results without writing', async () => {
      await bulk('tasks', [{ id: 'tsk_1', title: 'new', updatedAt: '2026-06-01T00:00:00Z' }])
      const before = syncSnapshot()
      const dry = await bulk('tasks', [{ id: 'tsk_1', title: 'old', updatedAt: '2026-01-01T00:00:00Z' }], '?dryRun=true')
      expect(dry.body.results[0].status).toBe('skipped')
      expect(syncSnapshot()).toBe(before)
    })

    it('PATCH and DELETE dry runs validate and answer but write nothing', async () => {
      await bulk('tasks', [{ id: 'tsk_d', title: 'Keep' }])
      const before = syncSnapshot()

      const dryPatch = await patch('tasks', 'tsk_d', { title: 'Changed' }, '?dryRun=true')
      expect(dryPatch.status).toBe(200)
      expect(dryPatch.body).toMatchObject({ dryRun: true, data: { title: 'Changed' } })
      expect((await patch('tasks', 'tsk_d', { priority: 'urgent' }, '?dryRun=true')).status).toBe(422)

      const del = await recordRoute.DELETE(
        makeRequest('/api/v1/tasks/tsk_d?dryRun=true', { method: 'DELETE', key: secret }),
        params({ table: 'tasks', id: 'tsk_d' })
      )
      expect(await del.json()).toMatchObject({ dryRun: true, deleted: true })
      const missing = await recordRoute.DELETE(
        makeRequest('/api/v1/tasks/tsk_none?dryRun=true', { method: 'DELETE', key: secret }),
        params({ table: 'tasks', id: 'tsk_none' })
      )
      expect(missing.status).toBe(404)

      expect(syncSnapshot()).toBe(before)
      expect((await get('tasks', 'tsk_d')).body.data.title).toBe('Keep')
    })

    it('rejects invalid flag values', async () => {
      expect((await bulk('tasks', [{ title: 'x' }], '?dryRun=maybe')).status).toBe(400)
    })
  })

  describe('partial validation on merge and PATCH', () => {
    it('a legacy isActive: 1 does not block an unrelated balance change', async () => {
      insertLegacy('personalWallets', {
        id: 'pw_old', userId: ALICE.userId, name: 'Old', type: 'bank', currency: 'ARS', balance: 5, isActive: 1, creditLimit: '1000'
      })
      const res = await patch('personalWallets', 'pw_old', { balance: 1234.5 })
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ balance: 1234.5, isActive: true, creditLimit: 1000 })

      const merged = await bulk('personalWallets', [{ id: 'pw_old', balance: 99 }], '?mode=merge')
      expect(merged.body.results[0]).toMatchObject({ status: 'updated' })
      expect(merged.body.results[0]).not.toHaveProperty('warnings')
      expect((await get('personalWallets', 'pw_old')).body.data).toMatchObject({ balance: 99, isActive: true })
    })

    it('keeps unknown legacy shapes untouched and does not warn about stored unknown fields', async () => {
      insertLegacy('personalWallets', {
        id: 'pw_odd', name: 'Odd', type: 'bank', balance: 1, isActive: 'yes', legacyThing: 42
      })
      const res = await patch('personalWallets', 'pw_odd', { notes: 'hi' })
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ isActive: 'yes', legacyThing: 42, notes: 'hi' })
      expect(res.body).not.toHaveProperty('warnings')
    })

    it('still validates sent fields strictly and coerces sent 0/1 booleans with a warning', async () => {
      insertLegacy('personalWallets', { id: 'pw_x', name: 'X', type: 'bank', balance: 1, isActive: 1 })
      expect((await patch('personalWallets', 'pw_x', { balance: '12' })).status).toBe(422)
      expect((await patch('personalWallets', 'pw_x', { type: 'piggy' })).status).toBe(422)
      expect((await patch('personalWallets', 'pw_x', { name: '' })).body.error.message).toMatch(/name: required, cannot be cleared/)

      const coerced = await patch('personalWallets', 'pw_x', { isActive: 0 })
      expect(coerced.status).toBe(200)
      expect(coerced.body.data.isActive).toBe(false)
      expect(coerced.body.warnings).toEqual([expect.stringContaining('isActive: converted 0 to false')])

      const merged = await bulk('personalWallets', [{ id: 'pw_x', name: null }], '?mode=merge')
      expect(merged.body.results[0]).toMatchObject({ status: 'error', error: expect.stringContaining('name: required') })
    })

    it('coerces incoming 0/1 booleans on create too', async () => {
      const { body } = await bulk('tasks', [{ id: 'tsk_b', title: 'x', isCompleted: 1 }])
      expect(body.results[0].warnings).toEqual([expect.stringContaining('isCompleted')])
      expect((await get('tasks', 'tsk_b')).body.data.isCompleted).toBe(true)
    })

    it('re-checks conditional rules when the update touches their fields', async () => {
      await seedFinance()
      await bulk('personalTransactions', [tx('pt_r', { type: 'expense', amount: 1, date: '2026-10-01' })])
      const res = await patch('personalTransactions', 'pt_r', { type: 'transfer' })
      expect(res.status).toBe(422)
      expect(res.body.error.message).toMatch(/targetWalletId: required for transfers/)
      expect((await patch('personalTransactions', 'pt_r', { type: 'transfer', targetWalletId: 'pw_usd' })).status).toBe(200)
    })

    it('a name sent in merge mode replaces the stored id', async () => {
      await seedFinance()
      await bulk('personalTransactions', [tx('pt_n', { type: 'expense', amount: 1, date: '2026-10-01' })])
      await bulk('personalTransactions', [{ id: 'pt_n', walletName: 'bank usd' }], '?mode=merge')
      expect((await get('personalTransactions', 'pt_n')).body.data.walletId).toBe('pw_usd')
    })
  })

  describe('balance recalculation', () => {
    it('computes opening balance + completed transactions since the opening date', async () => {
      await seedFinance()
      const loaded = await bulk('personalTransactions', LEDGER)
      expect(loaded.body.summary.error).toBe(0)

      const before = syncSnapshot()
      const dry = await recalc('pw_ars', { openingBalance: 10000, openingBalanceDate: '2026-10-01' }, '?dryRun=true')
      expect(dry.status).toBe(200)
      expect(syncSnapshot()).toBe(before)

      const res = await recalc('pw_ars', { openingBalance: 10000, openingBalanceDate: '2026-10-01' })
      expect(res.status).toBe(200)
      // 10000 + 5000 - 1200 + 300 (refund) + 100 * 1400 (transfer in); cancelled,
      // pre-opening and the rate-less USD charge are left out
      expect(res.body).toMatchObject({
        walletId: 'pw_ars',
        previousBalance: 7,
        balance: 154100,
        transactionsCounted: 4,
        skippedCurrency: 1,
        openingBalance: 10000,
        openingBalanceDate: '2026-10-01T12:00:00.000Z'
      })
      expect(dry.body).toEqual({ ...res.body, dryRun: true })

      const wallet = (await get('personalWallets', 'pw_ars')).body.data
      expect(wallet).toMatchObject({ balance: 154100, openingBalance: 10000, openingBalanceDate: '2026-10-01T12:00:00.000Z' })

      // Without a body the stored opening values are used
      expect((await recalc('pw_ars')).body).toMatchObject({ previousBalance: 154100, balance: 154100 })

      const usd = await recalc('pw_usd')
      expect(usd.body).toMatchObject({ balance: -100, transactionsCounted: 1, skippedCurrency: 0 })
    })

    it('clears the opening values with null and validates the body', async () => {
      await seedFinance()
      await bulk('personalTransactions', LEDGER)
      await recalc('pw_ars', { openingBalance: 10000, openingBalanceDate: '2026-10-01' })
      const cleared = await recalc('pw_ars', { openingBalance: null, openingBalanceDate: null })
      expect(cleared.body.balance).toBe(145100)
      expect(cleared.body).not.toHaveProperty('openingBalance')

      expect((await recalc('pw_ars', { openingBalance: '5' })).status).toBe(422)
      expect((await recalc('pw_ars', { openingBalanceDate: 'soon' })).status).toBe(422)
      expect((await recalc('pw_missing')).status).toBe(404)
      expect((await recalc('tsk_1', undefined, '', 'tasks')).status).toBe(404)
    })

    it('bulk ?recalculateBalances=true recalculates every wallet the batch touched', async () => {
      await seedFinance()
      const before = syncSnapshot()
      const dry = await bulk('personalTransactions', LEDGER, '?recalculateBalances=true&dryRun=true')
      expect(syncSnapshot()).toBe(before)
      expect(dry.body.balances).toEqual([
        { walletId: 'pw_ars', previousBalance: 7, balance: 145100, transactionsCounted: 5, skippedCurrency: 1 },
        { walletId: 'pw_usd', previousBalance: 0, balance: -100, transactionsCounted: 1, skippedCurrency: 0 }
      ])

      const real = await bulk('personalTransactions', LEDGER, '?recalculateBalances=true')
      expect(real.body.balances).toEqual(dry.body.balances)
      expect((await get('personalWallets', 'pw_ars')).body.data.balance).toBe(145100)

      // Moving a transaction to another wallet recalculates the old one too
      const moved = await bulk('personalTransactions', [{ id: 'pt_salary', walletId: 'pw_usd', currency: 'USD', amount: 5 }], '?mode=merge&recalculateBalances=true')
      expect(moved.body.balances.map((b: { walletId: string }) => b.walletId)).toEqual(['pw_ars', 'pw_usd'])
      expect(moved.body.balances[0].balance).toBe(140100)

      expect((await bulk('tasks', [{ title: 'x' }], '?recalculateBalances=true')).status).toBe(400)
    })
  })

  describe('GET /api/v1/me', () => {
    it('describes the calling key for any scope', async () => {
      const { key, secret: writeOnly } = await createKey({ name: 'loader', scopes: ['write'] })
      const res = await meRoute.GET(makeRequest('/api/v1/me', { key: writeOnly }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toMatchObject({
        keyId: key.id,
        name: 'loader',
        prefix: key.prefix,
        scopes: ['write'],
        userId: ALICE.userId,
        householdId: ALICE.householdId
      })
      expect(body.createdAt).toBeTruthy()
      expect(body.lastUsedAt).toBeTruthy()
      expect(JSON.stringify(body)).not.toContain(writeOnly)
      expect((await meRoute.GET(makeRequest('/api/v1/me'))).status).toBe(401)
    })
  })

  describe('list filters', () => {
    it('filters by field equality and dates, with correct pagination', async () => {
      await seedFinance()
      const records = Array.from({ length: 9 }, (_, i) =>
        tx(`pt_${i}`, {
          type: i % 3 === 0 ? 'income' : 'expense',
          categoryId: i % 3 === 0 ? 'pc_salary' : 'pc_food',
          amount: i + 1,
          walletId: i < 6 ? 'pw_ars' : 'pw_usd',
          date: `2026-10-0${i + 1}`,
          creditCardStatementId: i % 2 === 0 ? 'ccs_a' : 'ccs_b'
        })
      )
      await bulk('personalTransactions', records, '?importBatchId=load-1')

      const ids = (body: { data: Array<{ id: string }> }) => body.data.map(r => r.id).sort()
      expect(ids((await list('personalTransactions', '?walletId=pw_ars&type=expense')).body)).toEqual(['pt_1', 'pt_2', 'pt_4', 'pt_5'])
      expect(ids((await list('personalTransactions', '?creditCardStatementId=ccs_a&categoryId=pc_food')).body)).toEqual(['pt_2', 'pt_4', 'pt_8'])
      expect(ids((await list('personalTransactions', '?status=completed&importBatchId=load-1&amount=3')).body)).toEqual(['pt_2'])
      expect(ids((await list('personalTransactions', '?type=income&type=refund')).body)).toEqual(['pt_0', 'pt_3', 'pt_6'])
      expect(ids((await list('personalTransactions', '?dateFrom=2026-10-03&dateTo=2026-10-05')).body)).toEqual(['pt_2', 'pt_3', 'pt_4'])

      // Page through a filtered set two at a time
      const seen: string[] = []
      let cursor = ''
      let pages = 0
      for (;;) {
        const page = (await list('personalTransactions', `?walletId=pw_ars&limit=2${cursor ? `&cursor=${cursor}` : ''}`)).body
        pages++
        seen.push(...page.data.map((r: { id: string }) => r.id))
        expect(page.count).toBeLessThanOrEqual(2)
        if (!page.hasMore) {
          expect(page.nextCursor).toBeNull()
          break
        }
        cursor = page.nextCursor
      }
      expect(pages).toBe(3)
      expect(seen.sort()).toEqual(['pt_0', 'pt_1', 'pt_2', 'pt_3', 'pt_4', 'pt_5'])
      // Exactly `limit` matches left: hasMore is false on that page
      expect((await list('personalTransactions', '?walletId=pw_usd&limit=3')).body).toMatchObject({ count: 3, hasMore: false })
    })

    it('coerces legacy stored values and validates filters', async () => {
      insertLegacy('personalWallets', { id: 'pw_legacy', name: 'L', type: 'bank', isActive: 1 })
      await bulk('personalWallets', [{ id: 'pw_off', name: 'Off', type: 'bank', isActive: false }])
      expect((await list('personalWallets', '?isActive=true')).body.data.map((w: { id: string }) => w.id)).toEqual(['pw_legacy'])
      expect((await list('personalWallets', '?isActive=0')).body.data.map((w: { id: string }) => w.id)).toEqual(['pw_off'])

      expect((await list('personalWallets', '?nope=1')).status).toBe(400)
      expect((await list('personalWallets', '?isActive=maybe')).status).toBe(400)
      expect((await list('personalWallets', '?balance=abc')).status).toBe(400)
      expect((await list('personalWallets', '?type=piggy')).status).toBe(400)
      expect((await list('personalWallets', '?dateFrom=2026-01-01')).status).toBe(400)
      expect((await list('personalTransactions', '?dateFrom=whenever')).status).toBe(400)
    })

    it('declares a main date field that exists on the table', () => {
      for (const [table, meta] of Object.entries(TABLE_METADATA)) {
        if (meta.dateField) expect(meta.fields[meta.dateField]?.type, table).toBe('date')
      }
      expect(TABLE_METADATA.personalTransactions.dateField).toBe('date')
      expect(TABLE_METADATA.creditCardPayments.dateField).toBe('paymentDate')
      expect(TABLE_METADATA.creditCardStatements.dateField).toBe('periodEnd')
    })
  })

  describe('import batches', () => {
    it('stamps, summarizes and undoes a load across tables', async () => {
      await seedFinance()
      await bulk('creditCardStatements', [{ id: 'ccs_1', walletId: 'pw_ars', periodStart: '2026-09-26', periodEnd: '2026-10-25', dueDate: '2026-11-05' }], '?importBatchId=visa-oct')
      await bulk('personalTransactions', LEDGER.slice(1, 4), '?importBatchId=visa-oct&recalculateBalances=true')
      await bulk('personalTransactions', [tx('pt_other', { type: 'expense', amount: 1, date: '2026-10-01', importBatchId: 'other' })])

      const stamped = (await get('personalTransactions', 'pt_salary')).body.data
      expect(stamped.importBatchId).toBe('visa-oct')
      expect((await get('creditCardStatements', 'ccs_1')).body.data.manualTotals).toBe(true)

      const summary = await batchRoute.GET(makeRequest('/api/v1/import-batches/visa-oct', { key: secret }), params({ batchId: 'visa-oct' }))
      expect(await summary.json()).toEqual({ batchId: 'visa-oct', tables: { creditCardStatements: 1, personalTransactions: 3 }, total: 4 })

      const before = syncSnapshot()
      const dry = await batchRoute.DELETE(
        makeRequest('/api/v1/import-batches/visa-oct?dryRun=true&recalculateBalances=true', { method: 'DELETE', key: secret }),
        params({ batchId: 'visa-oct' })
      )
      const dryBody = await dry.json()
      expect(dryBody).toMatchObject({ dryRun: true, deleted: { creditCardStatements: 1, personalTransactions: 3 }, total: 4 })
      // 4100 from the batch is gone, the other expense of 1 stays
      expect(dryBody.balances).toEqual([expect.objectContaining({ walletId: 'pw_ars', previousBalance: 4100, balance: -1 })])
      expect(syncSnapshot()).toBe(before)

      const res = await batchRoute.DELETE(
        makeRequest('/api/v1/import-batches/visa-oct', { method: 'DELETE', key: secret }),
        params({ batchId: 'visa-oct' })
      )
      expect(await res.json()).toEqual({ batchId: 'visa-oct', deleted: { creditCardStatements: 1, personalTransactions: 3 }, total: 4 })
      expect((await get('personalTransactions', 'pt_salary')).status).toBe(404)
      expect((await get('personalTransactions', 'pt_other')).status).toBe(200)
      expect((await get('creditCardStatements', 'ccs_1')).status).toBe(404)

      const gone = await batchRoute.GET(makeRequest('/api/v1/import-batches/visa-oct', { key: secret }), params({ batchId: 'visa-oct' }))
      expect(gone.status).toBe(404)
    })

    it('does not count records whose newer version dropped the batch id', async () => {
      await bulk('tasks', [{ id: 'tsk_1', title: 'a' }, { id: 'tsk_2', title: 'b' }], '?importBatchId=b1')
      await patch('tasks', 'tsk_2', { importBatchId: null })
      const res = await batchRoute.GET(makeRequest('/api/v1/import-batches/b1', { key: secret }), params({ batchId: 'b1' }))
      expect((await res.json()).tables).toEqual({ tasks: 1 })
      expect((await bulk('tasks', [{ title: 'x' }], `?importBatchId=${'x'.repeat(201)}`)).status).toBe(400)
    })
  })

  describe('automatic exchange rate', () => {
    it('fills exchangeRate for USD transactions from the month rate, or warns', async () => {
      await seedFinance()
      await bulk('monthlyExchangeRates', [{ id: 'exr_2026_10', rate: 1450, month: 10, year: 2026 }])
      const { body } = await bulk('personalTransactions', [
        tx('pt_usd', { type: 'expense', amount: 20, currency: 'USD', date: '2026-10-15' }),
        tx('pt_usd_rate', { type: 'expense', amount: 20, currency: 'USD', exchangeRate: 1300, date: '2026-10-15' }),
        tx('pt_usd_nov', { type: 'expense', amount: 20, currency: 'USD', date: '2026-11-02' }),
        tx('pt_ars', { type: 'expense', amount: 20, date: '2026-10-15' })
      ])
      expect(body.summary.created).toBe(4)
      expect(body.results[0].warnings).toEqual([expect.stringMatching(/filled 1450 from monthlyExchangeRates exr_2026_10 \(2026-10\)/)])
      expect(body.results[1]).not.toHaveProperty('warnings')
      expect(body.results[2].warnings).toEqual([expect.stringMatching(/no monthlyExchangeRates record for 2026-11/)])
      expect(body.results[3]).not.toHaveProperty('warnings')

      expect((await get('personalTransactions', 'pt_usd')).body.data.exchangeRate).toBe(1450)
      expect((await get('personalTransactions', 'pt_usd_rate')).body.data.exchangeRate).toBe(1300)
      expect((await get('personalTransactions', 'pt_usd_nov')).body.data).not.toHaveProperty('exchangeRate')

      // PATCH moving a transaction to USD fills it as well
      const patched = await patch('personalTransactions', 'pt_ars', { currency: 'USD' })
      expect(patched.body.data.exchangeRate).toBe(1450)
      expect(patched.body.warnings).toEqual([expect.stringContaining('exr_2026_10')])
    })
  })
})
