import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

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
  data: string
}

interface TransactionRow {
  id: string
  type: string
  amount: number
  currency: string
  walletId: string
  targetWalletId: string | null
  categoryId: string
  description: string
  date: string
  status: string
  notes: string | null
  createdAt: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ walletId: string }> }
) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { walletId } = await params

    // Get the wallet
    const wallet = await db
      .prepare(`
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
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(walletId, session.userId)
      .first<WalletRow>()

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // Get last 10 transactions for this wallet
    const transactions = await db
      .prepare(`
        SELECT
          sm.recordId as id,
          json_extract(sm.data, '$.type') as type,
          json_extract(sm.data, '$.amount') as amount,
          json_extract(sm.data, '$.currency') as currency,
          json_extract(sm.data, '$.walletId') as walletId,
          json_extract(sm.data, '$.targetWalletId') as targetWalletId,
          json_extract(sm.data, '$.categoryId') as categoryId,
          json_extract(sm.data, '$.description') as description,
          json_extract(sm.data, '$.date') as date,
          json_extract(sm.data, '$.status') as status,
          json_extract(sm.data, '$.notes') as notes,
          sm.createdAt
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalTransactions'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        AND (
          json_extract(sm.data, '$.walletId') = ?
          OR json_extract(sm.data, '$.targetWalletId') = ?
        )
        ORDER BY json_extract(sm.data, '$.date') DESC
        LIMIT 10
      `)
      .bind(session.userId, walletId, walletId)
      .all()

    return NextResponse.json({
      success: true,
      wallet,
      recentTransactions: (transactions.results as TransactionRow[]) || []
    })
  } catch (error) {
    logger.error('Get personal wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ walletId: string }> }
) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { walletId } = await params
    const body = await request.json()

    // Verify ownership and get existing data
    const existing = await db
      .prepare(`
        SELECT sm.data
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalWallets'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(walletId, session.userId)
      .first<{ data: string }>()

    if (!existing) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const existingData = JSON.parse(existing.data)
    const now = new Date().toISOString()

    // Prevent type and currency changes after creation
    if (body.type && body.type !== existingData.type) {
      return NextResponse.json(
        { error: 'Cannot change wallet type after creation' },
        { status: 400 }
      )
    }

    if (body.currency && body.currency !== existingData.currency) {
      return NextResponse.json(
        { error: 'Cannot change wallet currency after creation' },
        { status: 400 }
      )
    }

    // Basic validation for mutable fields
    if (body.name !== undefined && (!body.name.trim() || body.name.trim().length < 2)) {
      return NextResponse.json({ error: 'Wallet name must be at least 2 characters' }, { status: 400 })
    }
    if (body.color !== undefined && !/^#[0-9A-F]{6}$/i.test(body.color)) {
      return NextResponse.json({ error: 'Color must be a valid hex color' }, { status: 400 })
    }

    // Use explicit undefined checks (not ??) so fields can be set to 0, false, or ""
    const updatedData = {
      ...existingData,
      name: body.name !== undefined ? body.name.trim() : existingData.name,
      balance: body.balance !== undefined ? body.balance : existingData.balance,
      creditLimit: body.creditLimit !== undefined ? body.creditLimit : existingData.creditLimit,
      closingDay: body.closingDay !== undefined ? body.closingDay : existingData.closingDay,
      dueDay: body.dueDay !== undefined ? body.dueDay : existingData.dueDay,
      accountNumber: body.accountNumber !== undefined ? body.accountNumber : existingData.accountNumber,
      bankName: body.bankName !== undefined ? body.bankName : existingData.bankName,
      color: body.color !== undefined ? body.color : existingData.color,
      icon: body.icon !== undefined ? body.icon : existingData.icon,
      notes: body.notes !== undefined ? body.notes : existingData.notes,
      updatedAt: now
    }

    await db
      .prepare(`
        UPDATE sync_metadata
        SET data = ?, operation = 'update', updatedAt = ?
        WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ?
      `)
      .bind(
        JSON.stringify(updatedData),
        now,
        walletId,
        session.userId
      )
      .run()

    return NextResponse.json({
      success: true,
      wallet: { id: walletId, ...updatedData }
    })
  } catch (error) {
    logger.error('Update personal wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ walletId: string }> }
) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { walletId } = await params

    // Verify ownership and get existing data
    const existing = await db
      .prepare(`
        SELECT sm.data
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalWallets'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(walletId, session.userId)
      .first<{ data: string }>()

    if (!existing) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const existingData = JSON.parse(existing.data)
    const now = new Date().toISOString()

    // Soft-delete: set isActive=false in JSON data and set deletedAt on the row
    const updatedData = {
      ...existingData,
      isActive: false,
      updatedAt: now
    }

    await db
      .prepare(`
        UPDATE sync_metadata
        SET data = ?, operation = 'update', updatedAt = ?, deletedAt = ?
        WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ?
      `)
      .bind(
        JSON.stringify(updatedData),
        now,
        now,
        walletId,
        session.userId
      )
      .run()

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete personal wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
