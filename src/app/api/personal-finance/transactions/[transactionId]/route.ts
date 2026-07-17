import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

interface TransactionData {
  id: string
  userId: string
  type: string
  amount: number
  currency: string
  walletId: string
  targetWalletId?: string | null
  categoryId: string | null
  description: string
  exchangeRate?: number | null
  date: string
  creditCardStatementId?: string | null
  isFromCreditCard: boolean
  sharedWithHousehold: boolean
  householdContribution?: number | null
  status: string
  notes?: string | null
  createdAt: string
  updatedAt: string
}

interface WalletData {
  id: string
  balance: number
  [key: string]: unknown
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transactionId } = await params

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    const row = await db
      .prepare(`
        SELECT
          sm.recordId as id,
          sm.data
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalTransactions'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(transactionId, session.userId)
      .first<{ id: string; data: string }>()

    if (!row) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction: TransactionData = JSON.parse(row.data)

    return NextResponse.json({
      success: true,
      transaction
    })
  } catch (error) {
    logger.error('Get personal transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transactionId } = await params

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    // Fetch the transaction to verify ownership and get balance reversal data
    const row = await db
      .prepare(`
        SELECT sm.data
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalTransactions'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(transactionId, session.userId)
      .first<{ data: string }>()

    if (!row) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction: TransactionData = JSON.parse(row.data)
    const now = new Date().toISOString()

    // --- Reverse balance update on source wallet ---
    const sourceWalletRow = await db
      .prepare(`
        SELECT data FROM sync_metadata
        WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ? AND deletedAt IS NULL
      `)
      .bind(transaction.walletId, session.userId)
      .first<{ data: string }>()

    if (sourceWalletRow?.data) {
      const sourceWallet: WalletData = JSON.parse(sourceWalletRow.data)
      let newSourceBalance = sourceWallet.balance

      switch (transaction.type) {
        case 'income':
          newSourceBalance = sourceWallet.balance - transaction.amount
          break
        case 'expense':
        case 'transfer':
          newSourceBalance = sourceWallet.balance + transaction.amount
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
        .bind(JSON.stringify(updatedSourceData), now, transaction.walletId, session.userId)
        .run()
    }

    // For transfers, reverse the target wallet balance too
    if (transaction.type === 'transfer' && transaction.targetWalletId) {
      const targetWalletRow = await db
        .prepare(`
          SELECT data FROM sync_metadata
          WHERE tableName = 'personalWallets' AND recordId = ? AND userId = ? AND deletedAt IS NULL
        `)
        .bind(transaction.targetWalletId, session.userId)
        .first<{ data: string }>()

      if (targetWalletRow?.data) {
        const targetWallet: WalletData = JSON.parse(targetWalletRow.data)
        const effectiveAmount = Math.round(transaction.amount * (transaction.exchangeRate || 1) * 100) / 100
        const newTargetBalance = targetWallet.balance - effectiveAmount

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
          .bind(JSON.stringify(updatedTargetData), now, transaction.targetWalletId, session.userId)
          .run()
      }
    }

    // Soft-delete the transaction by setting deletedAt
    await db
      .prepare(`
        UPDATE sync_metadata SET deletedAt = ?, operation = 'delete', updatedAt = ?
        WHERE tableName = 'personalTransactions' AND recordId = ? AND userId = ?
      `)
      .bind(now, now, transactionId, session.userId)
      .run()

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    logger.error('Delete personal transaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
