import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { generateTransactionId } from '@/lib/utils/finance/helpers'
import { validateTransaction } from '@/lib/utils/finance/validators'

interface TransactionRow {
  id: string
  userId: string
  type: string
  amount: number
  currency: string
  walletId: string
  targetWalletId: string | null
  categoryId: string | null
  description: string
  exchangeRate: number | null
  date: string
  creditCardStatementId: string | null
  isFromCreditCard: boolean
  sharedWithHousehold: boolean
  householdContribution: number | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface WalletData {
  id: string
  balance: number
  [key: string]: unknown
}

export async function GET(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const walletId = url.searchParams.get('walletId')
    const type = url.searchParams.get('type')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const categoryId = url.searchParams.get('categoryId')
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')

    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200)
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0)

    // Build the data query dynamically
    let dataQuery = `
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
        json_extract(sm.data, '$.creditCardStatementId') as creditCardStatementId,
        json_extract(sm.data, '$.isFromCreditCard') as isFromCreditCard,
        json_extract(sm.data, '$.sharedWithHousehold') as sharedWithHousehold,
        json_extract(sm.data, '$.householdContribution') as householdContribution,
        json_extract(sm.data, '$.status') as status,
        json_extract(sm.data, '$.notes') as notes,
        sm.createdAt,
        sm.updatedAt
      FROM sync_metadata sm
      WHERE sm.tableName = 'personalTransactions'
      AND sm.userId = ?
      AND sm.deletedAt IS NULL
    `

    // Build the count query in parallel
    let countQuery = `
      SELECT COUNT(*) as total
      FROM sync_metadata sm
      WHERE sm.tableName = 'personalTransactions'
      AND sm.userId = ?
      AND sm.deletedAt IS NULL
    `

    const params: unknown[] = [session.userId]
    const countParams: unknown[] = [session.userId]

    // Apply optional filters
    if (walletId) {
      const walletFilter = ` AND (json_extract(sm.data, '$.walletId') = ? OR json_extract(sm.data, '$.targetWalletId') = ?)`
      dataQuery += walletFilter
      countQuery += walletFilter
      params.push(walletId, walletId)
      countParams.push(walletId, walletId)
    }

    if (type) {
      const typeFilter = ` AND json_extract(sm.data, '$.type') = ?`
      dataQuery += typeFilter
      countQuery += typeFilter
      params.push(type)
      countParams.push(type)
    }

    if (from) {
      const fromFilter = ` AND json_extract(sm.data, '$.date') >= ?`
      dataQuery += fromFilter
      countQuery += fromFilter
      params.push(from)
      countParams.push(from)
    }

    if (to) {
      const toFilter = ` AND json_extract(sm.data, '$.date') <= ?`
      dataQuery += toFilter
      countQuery += toFilter
      params.push(to)
      countParams.push(to)
    }

    if (categoryId) {
      const categoryFilter = ` AND json_extract(sm.data, '$.categoryId') = ?`
      dataQuery += categoryFilter
      countQuery += categoryFilter
      params.push(categoryId)
      countParams.push(categoryId)
    }

    // Order and paginate data query
    dataQuery += ` ORDER BY json_extract(sm.data, '$.date') DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    // Execute both queries
    const [transactions, countResult] = await Promise.all([
      db.prepare(dataQuery).bind(...params).all(),
      db.prepare(countQuery).bind(...countParams).first<{ total: number }>()
    ])

    const total = countResult?.total ?? 0

    return NextResponse.json({
      success: true,
      transactions: (transactions.results as TransactionRow[]) || [],
      total
    })
  } catch (error) {
    logger.error('Get personal transactions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type,
      amount,
      currency,
      walletId,
      targetWalletId,
      categoryId,
      description,
      date,
      exchangeRate,
      notes,
      sharedWithHousehold,
      householdContribution
    } = body

    // For transfers, categoryId is not required, so we validate conditionally
    const dataToValidate = {
      type,
      amount: typeof amount === 'string' ? parseFloat(amount) : amount,
      currency,
      walletId,
      targetWalletId,
      categoryId: type === 'transfer' ? (categoryId || 'transfer') : categoryId,
      description,
      date: date ? new Date(date) : undefined
    }

    const validation = validateTransaction(dataToValidate)
    if (!validation.isValid) {
      // If the only error is categoryId and it's a transfer, ignore it
      if (type === 'transfer') {
        delete validation.errors.categoryId
        if (Object.keys(validation.errors).length > 0) {
          return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 })
      }
    }

    // For transfers, validate source != target
    if (type === 'transfer') {
      if (!targetWalletId) {
        return NextResponse.json(
          { error: 'Validation failed', details: { targetWalletId: ['Target wallet is required for transfers'] } },
          { status: 400 }
        )
      }
      if (walletId === targetWalletId) {
        return NextResponse.json(
          { error: 'Validation failed', details: { targetWalletId: ['Source and target wallets must be different'] } },
          { status: 400 }
        )
      }
    }

    const transactionId = generateTransactionId()
    const now = new Date().toISOString()
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: { amount: ['Amount must be a positive number'] } },
        { status: 400 }
      )
    }

    // Validate source wallet exists and is not deleted BEFORE inserting
    const sourceWalletRow = await db
      .prepare(`
        SELECT data FROM sync_metadata
        WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ? AND deletedAt IS NULL
      `)
      .bind(walletId, session.userId)
      .first<{ data: string }>()

    if (!sourceWalletRow) {
      return NextResponse.json(
        { error: 'Validation failed', details: { walletId: ['Source wallet not found'] } },
        { status: 400 }
      )
    }

    // For transfers, validate target wallet exists too
    let targetWalletRow: { data: string } | null = null
    if (type === 'transfer' && targetWalletId) {
      targetWalletRow = await db
        .prepare(`
          SELECT data FROM sync_metadata
          WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ? AND deletedAt IS NULL
        `)
        .bind(targetWalletId, session.userId)
        .first<{ data: string }>()

      if (!targetWalletRow) {
        return NextResponse.json(
          { error: 'Validation failed', details: { targetWalletId: ['Target wallet not found'] } },
          { status: 400 }
        )
      }
    }

    const transactionData = {
      id: transactionId,
      userId: session.userId,
      type,
      amount: parsedAmount,
      currency: currency || 'ARS',
      walletId,
      targetWalletId: targetWalletId || null,
      categoryId: categoryId || null,
      description: description?.trim() || '',
      exchangeRate: exchangeRate ?? null,
      date: date || now,
      creditCardStatementId: null,
      isFromCreditCard: false,
      sharedWithHousehold: sharedWithHousehold ?? false,
      householdContribution: householdContribution ?? null,
      status: 'completed',
      notes: notes ?? null,
      createdAt: now,
      updatedAt: now
    }

    // Insert the transaction into sync_metadata
    await db
      .prepare(`
        INSERT INTO sync_metadata (
          id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, 'personalTransactions', ?, 'insert', ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        session.userId,
        session.householdId || null,
        transactionId,
        JSON.stringify(transactionData),
        now,
        now
      )
      .run()

    // --- Balance update logic (wallets already fetched and validated above) ---

    const sourceWallet: WalletData = JSON.parse(sourceWalletRow.data)
    let newSourceBalance = sourceWallet.balance

    switch (type) {
      case 'income':
        newSourceBalance = sourceWallet.balance + parsedAmount
        break
      case 'expense':
      case 'transfer':
        newSourceBalance = sourceWallet.balance - parsedAmount
        break
    }

    const updatedSourceData = {
      ...sourceWallet,
      balance: Math.round(newSourceBalance * 100) / 100,
      updatedAt: now
    }

    await db
      .prepare(`
        UPDATE sync_metadata SET data = ?, operation = 'update', updatedAt = ?
        WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ? AND deletedAt IS NULL
      `)
      .bind(JSON.stringify(updatedSourceData), now, walletId, session.userId)
      .run()

    // For transfers, also update the target wallet (already fetched above)
    if (type === 'transfer' && targetWalletId && targetWalletRow) {
      const targetWallet: WalletData = JSON.parse(targetWalletRow.data)
      const effectiveAmount = Math.round(parsedAmount * (exchangeRate || 1) * 100) / 100
      const newTargetBalance = targetWallet.balance + effectiveAmount

      const updatedTargetData = {
        ...targetWallet,
        balance: Math.round(newTargetBalance * 100) / 100,
        updatedAt: now
      }

      await db
        .prepare(`
          UPDATE sync_metadata SET data = ?, operation = 'update', updatedAt = ?
          WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ? AND deletedAt IS NULL
        `)
        .bind(JSON.stringify(updatedTargetData), now, targetWalletId, session.userId)
        .run()
    }

    return NextResponse.json({
      success: true,
      transaction: transactionData
    })
  } catch (error) {
    logger.error('Create personal transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
