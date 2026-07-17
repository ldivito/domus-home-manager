import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { generateWalletId } from '@/lib/utils/finance/helpers'
import { validateWallet } from '@/lib/utils/finance/validators'

interface WalletRow {
  id: string
  name: string
  type: string
  currency: string
  balance: number
  creditLimit: number | null
  closingDay: number | null
  dueDay: number | null
  accountNumber: string | null
  bankName: string | null
  color: string
  icon: string
  isActive: number
  notes: string | null
  createdAt: string
  updatedAt: string
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
    const typeFilter = url.searchParams.get('type')
    const currencyFilter = url.searchParams.get('currency')

    // Build query with optional filters
    let query = `
      SELECT
        sm.recordId as id,
        json_extract(sm.data, '$.name') as name,
        json_extract(sm.data, '$.type') as type,
        json_extract(sm.data, '$.currency') as currency,
        json_extract(sm.data, '$.balance') as balance,
        json_extract(sm.data, '$.creditLimit') as creditLimit,
        json_extract(sm.data, '$.closingDay') as closingDay,
        json_extract(sm.data, '$.dueDay') as dueDay,
        json_extract(sm.data, '$.accountNumber') as accountNumber,
        json_extract(sm.data, '$.bankName') as bankName,
        json_extract(sm.data, '$.color') as color,
        json_extract(sm.data, '$.icon') as icon,
        json_extract(sm.data, '$.isActive') as isActive,
        json_extract(sm.data, '$.notes') as notes,
        sm.createdAt,
        sm.updatedAt
      FROM sync_metadata sm
      WHERE sm.tableName = 'personalWallets'
      AND sm.userId = ?
      AND sm.deletedAt IS NULL
      AND json_extract(sm.data, '$.isActive') != 0
    `

    const params: unknown[] = [session.userId]

    if (typeFilter) {
      query += ` AND json_extract(sm.data, '$.type') = ?`
      params.push(typeFilter)
    }

    if (currencyFilter) {
      query += ` AND json_extract(sm.data, '$.currency') = ?`
      params.push(currencyFilter)
    }

    query += ` ORDER BY json_extract(sm.data, '$.name')`

    const wallets = await db
      .prepare(query)
      .bind(...params)
      .all()

    return NextResponse.json({
      success: true,
      wallets: (wallets.results as WalletRow[]) || []
    })
  } catch (error) {
    logger.error('Get personal wallets error:', error)
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

    // Validate input
    const validation = validateWallet(body)
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 })
    }

    const walletId = generateWalletId()
    const now = new Date().toISOString()

    const walletData = {
      id: walletId,
      userId: session.userId,
      name: body.name.trim(),
      type: body.type,
      currency: body.currency,
      balance: body.balance ?? 0,
      creditLimit: body.creditLimit ?? null,
      closingDay: body.closingDay ?? null,
      dueDay: body.dueDay ?? null,
      accountNumber: body.accountNumber ?? null,
      bankName: body.bankName ?? null,
      color: body.color,
      icon: body.icon,
      isActive: true,
      notes: body.notes ?? null,
      createdAt: now,
      updatedAt: now
    }

    await db
      .prepare(`
        INSERT INTO sync_metadata (
          id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, 'personalWallets', ?, 'insert', ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        session.userId,
        session.householdId || null,
        walletId,
        JSON.stringify(walletData),
        now,
        now
      )
      .run()

    return NextResponse.json({
      success: true,
      wallet: walletData
    })
  } catch (error) {
    logger.error('Create personal wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
