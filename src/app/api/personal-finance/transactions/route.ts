import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

interface PersonalTransactionRecord {
  id: string
  userId: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: 'ARS' | 'USD'
  walletId: string
  targetWalletId?: string
  categoryId: string
  description: string
  exchangeRate?: number
  date: string
  isFromCreditCard: boolean
  sharedWithHousehold: boolean
  householdContribution?: number
  status: 'pending' | 'completed' | 'cancelled'
  notes?: string
  updatedAt: string
  createdAt: string
}

export async function GET(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const walletId = searchParams.get('walletId')
    const type = searchParams.get('type')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') ?? '100', 10)
    const categoryId = searchParams.get('categoryId')
    const status = searchParams.get('status')

    // Build dynamic WHERE clauses
    const conditions: string[] = [
      "sm.tableName = 'personalTransactions'",
      'sm.userId = ?',
      'sm.deletedAt IS NULL'
    ]
    const bindings: (string | number)[] = [session.userId]

    if (walletId) {
      conditions.push("json_extract(sm.data, '$.walletId') = ?")
      bindings.push(walletId)
    }
    if (type) {
      conditions.push("json_extract(sm.data, '$.type') = ?")
      bindings.push(type)
    }
    if (categoryId) {
      conditions.push("json_extract(sm.data, '$.categoryId') = ?")
      bindings.push(categoryId)
    }
    if (status) {
      conditions.push("json_extract(sm.data, '$.status') = ?")
      bindings.push(status)
    }
    if (dateFrom) {
      conditions.push("json_extract(sm.data, '$.date') >= ?")
      bindings.push(dateFrom)
    }
    if (dateTo) {
      conditions.push("json_extract(sm.data, '$.date') <= ?")
      bindings.push(dateTo)
    }

    bindings.push(Math.min(limit, 500)) // cap at 500

    const query = `
      SELECT
        sm.recordId as id,
        json_extract(sm.data, '$.userId') as userId,
        json_extract(sm.data, '$.type') as type,
        json_extract(sm.data, '$.amount') as amount,
        json_extract(sm.data, '$.currency') as currency,
        json_extract(sm.data, '$.walletId') as walletId,
        json_extract(sm.data, '$.targetWalletId') as targetWalletId,
        json_extract(sm.data, '$.categoryId') as categoryId,
        json_extract(sm.data, '$.description') as description,
        json_extract(sm.data, '$.exchangeRate') as exchangeRate,
        json_extract(sm.data, '$.date') as date,
        json_extract(sm.data, '$.isFromCreditCard') as isFromCreditCard,
        json_extract(sm.data, '$.sharedWithHousehold') as sharedWithHousehold,
        json_extract(sm.data, '$.householdContribution') as householdContribution,
        json_extract(sm.data, '$.status') as status,
        json_extract(sm.data, '$.notes') as notes,
        sm.updatedAt,
        sm.createdAt
      FROM sync_metadata sm
      WHERE ${conditions.join(' AND ')}
      ORDER BY json_extract(sm.data, '$.date') DESC
      LIMIT ?
    `

    const transactions = await db
      .prepare(query)
      .bind(...bindings)
      .all()

    return NextResponse.json({
      success: true,
      data: (transactions.results as PersonalTransactionRecord[]) || []
    })
  } catch (error) {
    logger.error('Get personal transactions error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      type?: string
      amount?: number
      currency?: string
      walletId?: string
      targetWalletId?: string
      categoryId?: string
      description?: string
      exchangeRate?: number
      date?: string
      isFromCreditCard?: boolean
      sharedWithHousehold?: boolean
      householdContribution?: number
      status?: string
      notes?: string
    }

    const {
      type, amount, currency, walletId, targetWalletId, categoryId,
      description, exchangeRate, date, isFromCreditCard, sharedWithHousehold,
      householdContribution, status, notes
    } = body

    if (!type || amount === undefined || !currency || !walletId || !categoryId || !description) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: type, amount, currency, walletId, categoryId, description'
      }, { status: 400 })
    }

    const validTypes = ['income', 'expense', 'transfer']
    const validCurrencies = ['ARS', 'USD']
    const validStatuses = ['pending', 'completed', 'cancelled']

    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid type. Must be: income, expense, or transfer' }, { status: 400 })
    }
    if (!validCurrencies.includes(currency)) {
      return NextResponse.json({ success: false, error: 'Invalid currency. Must be: ARS or USD' }, { status: 400 })
    }
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status. Must be: pending, completed, or cancelled' }, { status: 400 })
    }
    if (amount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be positive' }, { status: 400 })
    }

    const txId = uuidv4()
    const now = new Date().toISOString()

    const txData = {
      id: txId,
      userId: session.userId,
      type,
      amount,
      currency,
      walletId,
      targetWalletId: targetWalletId ?? null,
      categoryId,
      description,
      exchangeRate: exchangeRate ?? null,
      date: date ?? now,
      isFromCreditCard: isFromCreditCard ?? false,
      sharedWithHousehold: sharedWithHousehold ?? false,
      householdContribution: householdContribution ?? null,
      status: status ?? 'completed',
      notes: notes ?? null,
      householdId: session.householdId ?? null,
      createdAt: now,
      updatedAt: now
    }

    await db
      .prepare(`
        INSERT INTO sync_metadata (
          id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        uuidv4(),
        session.userId,
        session.householdId ?? null,
        'personalTransactions',
        txId,
        'insert',
        JSON.stringify(txData),
        now,
        now
      )
      .run()

    // Update wallet balance
    if (type !== 'transfer') {
      const wallet = await db
        .prepare(`
          SELECT data FROM sync_metadata
          WHERE tableName = 'personalWallets'
          AND recordId = ?
          AND userId = ?
          AND deletedAt IS NULL
        `)
        .bind(walletId, session.userId)
        .first<{ data: string }>()

      if (wallet) {
        const walletData = typeof wallet.data === 'string' ? JSON.parse(wallet.data) : wallet.data
        const currentBalance: number = walletData.balance ?? 0
        const newBalance = type === 'income'
          ? currentBalance + amount
          : currentBalance - amount

        walletData.balance = newBalance
        walletData.updatedAt = now

        await db
          .prepare(`
            UPDATE sync_metadata
            SET data = ?, operation = 'update', updatedAt = ?
            WHERE tableName = 'personalWallets'
            AND recordId = ?
            AND userId = ?
          `)
          .bind(JSON.stringify(walletData), now, walletId, session.userId)
          .run()
      }
    }

    return NextResponse.json({ success: true, data: txData }, { status: 201 })
  } catch (error) {
    logger.error('Create personal transaction error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
