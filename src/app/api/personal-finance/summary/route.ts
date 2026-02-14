import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

interface WalletBalanceRow {
  currency: string
  totalBalance: number
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

interface WalletCountRow {
  count: number
}

interface MonthTotalRow {
  type: string
  currency: string
  total: number
}

export async function GET(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`

    // Run all 4 queries in parallel for better performance
    const [balanceResults, recentTransactionsResult, walletCountResult, monthTotalsResult] = await Promise.all([
      // 1. Total balances by currency from active wallets
      db.prepare(`
        SELECT
          json_extract(sm.data, '$.currency') as currency,
          SUM(json_extract(sm.data, '$.balance')) as totalBalance
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalWallets'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.isActive') != 0
        GROUP BY json_extract(sm.data, '$.currency')
      `).bind(session.userId).all(),

      // 2. Recent 10 transactions
      db.prepare(`
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
        ORDER BY json_extract(sm.data, '$.date') DESC
        LIMIT 10
      `).bind(session.userId).all(),

      // 3. Active wallet count
      db.prepare(`
        SELECT COUNT(*) as count
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalWallets'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.isActive') != 0
      `).bind(session.userId).first<WalletCountRow>(),

      // 4. Month-to-date income/expense totals by currency
      db.prepare(`
        SELECT
          json_extract(sm.data, '$.type') as type,
          json_extract(sm.data, '$.currency') as currency,
          SUM(json_extract(sm.data, '$.amount')) as total
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalTransactions'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.status') != 'cancelled'
        AND json_extract(sm.data, '$.type') IN ('income', 'expense')
        AND substr(json_extract(sm.data, '$.date'), 1, 7) = ?
        GROUP BY json_extract(sm.data, '$.type'), json_extract(sm.data, '$.currency')
      `).bind(session.userId, currentMonth).all()
    ])

    const balances: Record<string, number> = { ARS: 0, USD: 0 }
    const balanceRows = (balanceResults.results as WalletBalanceRow[]) || []
    for (const row of balanceRows) {
      if (row.currency === 'ARS' || row.currency === 'USD') {
        balances[row.currency] = Math.round((row.totalBalance || 0) * 100) / 100
      }
    }

    const recentTransactions = (recentTransactionsResult.results as TransactionRow[]) || []
    const activeWalletCount = walletCountResult?.count ?? 0

    const monthToDate = {
      income: { ARS: 0, USD: 0 } as Record<string, number>,
      expenses: { ARS: 0, USD: 0 } as Record<string, number>
    }

    const monthTotalRows = (monthTotalsResult.results as MonthTotalRow[]) || []
    for (const row of monthTotalRows) {
      const currency = row.currency
      if (currency !== 'ARS' && currency !== 'USD') continue

      const total = Math.round((row.total || 0) * 100) / 100

      if (row.type === 'income') {
        monthToDate.income[currency] = total
      } else if (row.type === 'expense') {
        monthToDate.expenses[currency] = total
      }
    }

    return NextResponse.json({
      success: true,
      balances,
      recentTransactions,
      activeWalletCount,
      monthToDate
    })
  } catch (error) {
    logger.error('Get personal finance summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
