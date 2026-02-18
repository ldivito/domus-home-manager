import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

interface PersonalWalletRecord {
  id: string
  userId: string
  name: string
  type: 'physical' | 'bank' | 'credit_card'
  currency: 'ARS' | 'USD'
  balance: number
  creditLimit?: number
  closingDay?: number
  dueDay?: number
  accountNumber?: string
  bankName?: string
  color: string
  icon: string
  isActive: boolean
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

    const wallets = await db
      .prepare(`
        SELECT
          sm.recordId as id,
          json_extract(sm.data, '$.userId') as userId,
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
          sm.updatedAt,
          sm.createdAt
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalWallets'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        ORDER BY sm.createdAt ASC
      `)
      .bind(session.userId)
      .all()

    return NextResponse.json({
      success: true,
      data: (wallets.results as PersonalWalletRecord[]) || []
    })
  } catch (error) {
    logger.error('Get personal wallets error:', error)
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
      name?: string
      type?: string
      currency?: string
      balance?: number
      creditLimit?: number
      closingDay?: number
      dueDay?: number
      accountNumber?: string
      bankName?: string
      color?: string
      icon?: string
      notes?: string
    }

    const { name, type, currency, balance, creditLimit, closingDay, dueDay, accountNumber, bankName, color, icon, notes } = body

    if (!name || !type || !currency) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, type, currency' }, { status: 400 })
    }

    const validTypes = ['physical', 'bank', 'credit_card']
    const validCurrencies = ['ARS', 'USD']

    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid type. Must be: physical, bank, or credit_card' }, { status: 400 })
    }
    if (!validCurrencies.includes(currency)) {
      return NextResponse.json({ success: false, error: 'Invalid currency. Must be: ARS or USD' }, { status: 400 })
    }

    const walletId = uuidv4()
    const now = new Date().toISOString()

    const walletData = {
      id: walletId,
      userId: session.userId,
      name,
      type,
      currency,
      balance: balance ?? 0,
      creditLimit: creditLimit ?? null,
      closingDay: closingDay ?? null,
      dueDay: dueDay ?? null,
      accountNumber: accountNumber ?? null,
      bankName: bankName ?? null,
      color: color ?? '#8b5cf6',
      icon: icon ?? 'Wallet',
      isActive: true,
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
        'personalWallets',
        walletId,
        'insert',
        JSON.stringify(walletData),
        now,
        now
      )
      .run()

    return NextResponse.json({ success: true, data: walletData }, { status: 201 })
  } catch (error) {
    logger.error('Create personal wallet error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
