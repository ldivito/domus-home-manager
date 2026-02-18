import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

interface TransactionRow {
  type: string
  amount: number
  currency: string
  date: string
  categoryId: string
  categoryName: string | null
  categoryColor: string | null
}

interface WalletRow {
  id: string
  name: string
  type: string
  currency: string
  balance: number
  isActive: number
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
    const now = new Date()
    const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)
    const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)

    // Build month range
    const monthStr = String(month).padStart(2, '0')
    const dateFrom = `${year}-${monthStr}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const dateTo = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`

    // Get all wallets (active)
    const walletsResult = await db
      .prepare(`
        SELECT
          sm.recordId as id,
          json_extract(sm.data, '$.name') as name,
          json_extract(sm.data, '$.type') as type,
          json_extract(sm.data, '$.currency') as currency,
          CAST(json_extract(sm.data, '$.balance') AS REAL) as balance,
          json_extract(sm.data, '$.isActive') as isActive
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalWallets'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.isActive') = 1
      `)
      .bind(session.userId)
      .all()

    const wallets = (walletsResult.results as WalletRow[]) || []

    // Total balance per currency
    const balanceByCurrency: Record<string, number> = {}
    for (const wallet of wallets) {
      const curr = wallet.currency ?? 'ARS'
      balanceByCurrency[curr] = (balanceByCurrency[curr] ?? 0) + (wallet.balance ?? 0)
    }

    // Get monthly transactions with category info
    const txResult = await db
      .prepare(`
        SELECT
          json_extract(t.data, '$.type') as type,
          CAST(json_extract(t.data, '$.amount') AS REAL) as amount,
          json_extract(t.data, '$.currency') as currency,
          json_extract(t.data, '$.date') as date,
          json_extract(t.data, '$.categoryId') as categoryId,
          json_extract(c.data, '$.name') as categoryName,
          json_extract(c.data, '$.color') as categoryColor
        FROM sync_metadata t
        LEFT JOIN sync_metadata c ON
          json_extract(t.data, '$.categoryId') = c.recordId
          AND c.tableName = 'personalCategories'
          AND c.userId = t.userId
          AND c.deletedAt IS NULL
        WHERE t.tableName = 'personalTransactions'
        AND t.userId = ?
        AND t.deletedAt IS NULL
        AND json_extract(t.data, '$.status') != 'cancelled'
        AND json_extract(t.data, '$.date') >= ?
        AND json_extract(t.data, '$.date') <= ?
        ORDER BY json_extract(t.data, '$.date') DESC
      `)
      .bind(session.userId, dateFrom, dateTo + 'T23:59:59')
      .all()

    const transactions = (txResult.results as TransactionRow[]) || []

    // Aggregate monthly stats
    let monthlyIncome = 0
    let monthlyExpenses = 0
    const categoryTotals: Record<string, { name: string; color: string; total: number; count: number }> = {}

    for (const tx of transactions) {
      const amount = tx.amount ?? 0
      if (tx.type === 'income') {
        monthlyIncome += amount
      } else if (tx.type === 'expense') {
        monthlyExpenses += amount
        // Track category totals for expenses
        const catId = tx.categoryId ?? 'unknown'
        if (!categoryTotals[catId]) {
          categoryTotals[catId] = {
            name: tx.categoryName ?? 'Unknown',
            color: tx.categoryColor ?? '#6b7280',
            total: 0,
            count: 0
          }
        }
        categoryTotals[catId].total += amount
        categoryTotals[catId].count += 1
      }
    }

    // Top categories by expense amount
    const topCategories = Object.entries(categoryTotals)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // Recent transactions (last 10)
    const recentTxResult = await db
      .prepare(`
        SELECT
          sm.recordId as id,
          json_extract(sm.data, '$.type') as type,
          CAST(json_extract(sm.data, '$.amount') AS REAL) as amount,
          json_extract(sm.data, '$.currency') as currency,
          json_extract(sm.data, '$.description') as description,
          json_extract(sm.data, '$.date') as date,
          json_extract(sm.data, '$.categoryId') as categoryId,
          json_extract(sm.data, '$.walletId') as walletId,
          json_extract(sm.data, '$.status') as status
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalTransactions'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.status') != 'cancelled'
        ORDER BY json_extract(sm.data, '$.date') DESC
        LIMIT 10
      `)
      .bind(session.userId)
      .all()

    return NextResponse.json({
      success: true,
      data: {
        period: { month, year, dateFrom, dateTo },
        wallets: {
          total: wallets.length,
          balanceByCurrency,
          list: wallets
        },
        monthly: {
          income: monthlyIncome,
          expenses: monthlyExpenses,
          net: monthlyIncome - monthlyExpenses,
          transactionCount: transactions.length
        },
        topCategories,
        recentTransactions: recentTxResult.results ?? []
      }
    })
  } catch (error) {
    logger.error('Get personal finance stats error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
