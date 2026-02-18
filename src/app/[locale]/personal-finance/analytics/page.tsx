'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils/finance'
import { PersonalTransaction, PersonalWallet, PersonalCategory } from '@/types/personal-finance'
import ExpenseChart from './components/ExpenseChart'
import IncomeChart from './components/IncomeChart'
import MonthlyOverview from './components/MonthlyOverview'
import CategoryBreakdown from './components/CategoryBreakdown'
import FinancialTrends from './components/FinancialTrends'
import DataExportDialog from './components/DataExportDialog'
import { useSyncContext } from '@/contexts/SyncContext'

type TimeRange = 'last7days' | 'last30days' | 'last3months' | 'last6months' | 'currentyear' | 'lastyear'

type EnrichedTransaction = PersonalTransaction & {
  wallet?: PersonalWallet
  category?: PersonalCategory
}

interface AnalyticsData {
  transactions: EnrichedTransaction[]
  totalIncome: number
  totalExpenses: number
  netIncome: number
  monthlyData: Array<{
    month: string
    income: number
    expenses: number
    net: number
  }>
  categoryBreakdown: Array<{
    category: string
    amount: number
    color: string
    percentage: number
  }>
  walletBreakdown: Array<{
    wallet: string
    balance: number
    color: string
  }>
}

// Get date range based on selection
function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()

  switch (range) {
    case 'last7days':
      start.setDate(start.getDate() - 7)
      break
    case 'last30days':
      start.setDate(start.getDate() - 30)
      break
    case 'last3months':
      start.setMonth(start.getMonth() - 3)
      break
    case 'last6months':
      start.setMonth(start.getMonth() - 6)
      break
    case 'currentyear':
      start.setMonth(0, 1) // 1 de enero
      break
    case 'lastyear':
      start.setFullYear(start.getFullYear() - 1, 0, 1)
      end.setFullYear(end.getFullYear() - 1, 11, 31)
      break
  }

  return { start, end }
}

// Helper: días en el rango
function getDaysInRange(timeRange: TimeRange): number {
  switch (timeRange) {
    case 'last7days': return 7
    case 'last30days': return 30
    case 'last3months': return 90
    case 'last6months': return 180
    case 'currentyear': return Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24))
    case 'lastyear': return 365
    default: return 30
  }
}

function generateMonthlyData(
  transactions: EnrichedTransaction[],
  start: Date,
  end: Date
) {
  const months = []
  const current = new Date(start)

  while (current <= end) {
    const monthTransactions = transactions.filter(t => {
      const txnDate = new Date(t.date)
      return txnDate.getFullYear() === current.getFullYear() &&
        txnDate.getMonth() === current.getMonth()
    })

    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    months.push({
      month: current.toLocaleDateString('es', { month: 'short', year: '2-digit' }),
      income,
      expenses,
      net: income - expenses
    })

    current.setMonth(current.getMonth() + 1)
  }

  return months
}

function generateCategoryBreakdown(
  expenseTransactions: EnrichedTransaction[],
  totalExpenses: number
) {
  const categoryTotals = new Map<string, { name: string; amount: number; color: string }>()

  expenseTransactions.forEach(txn => {
    if (txn.category) {
      const current = categoryTotals.get(txn.category.id!) || {
        name: txn.category.name,
        amount: 0,
        color: txn.category.color
      }
      current.amount += txn.amount
      categoryTotals.set(txn.category.id!, current)
    }
  })

  return Array.from(categoryTotals.values())
    .map(cat => ({
      category: cat.name,
      amount: cat.amount,
      color: cat.color,
      percentage: totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
}

function generateWalletBreakdown(wallets: PersonalWallet[], currency: string) {
  if (currency === 'ALL') {
    return wallets
      .filter(w => w.isActive)
      .map(w => ({
        wallet: w.name,
        balance: w.balance,
        color: w.color || '#3b82f6'
      }))
  } else {
    return wallets
      .filter(w => w.isActive && w.currency === currency)
      .map(w => ({
        wallet: w.name,
        balance: w.balance,
        color: w.color || '#3b82f6'
      }))
  }
}

const emptyAnalytics: AnalyticsData = {
  transactions: [],
  totalIncome: 0,
  totalExpenses: 0,
  netIncome: 0,
  monthlyData: [],
  categoryBreakdown: [],
  walletBreakdown: []
}

export default function AnalyticsPage() {
  const t = useTranslations('personalFinance')
  const { triggerSync } = useSyncContext()
  const [timeRange, setTimeRange] = useState<TimeRange>('last30days')
  const [currency, setCurrency] = useState<'ARS' | 'USD' | 'ALL'>('ALL')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // Trigger sync on mount so data is siempre fresco
  useEffect(() => {
    triggerSync(false, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Live queries — se actualizan automáticamente cada vez que Dexie cambia
  const allTransactions = useLiveQuery(() => db.personalTransactions.toArray(), [])
  const allWallets = useLiveQuery(() => db.personalWallets.toArray(), [])
  const allCategories = useLiveQuery(() => db.personalCategories.toArray(), [])

  // Loading: undefined significa que useLiveQuery todavía está cargando
  const loading = allTransactions === undefined || allWallets === undefined || allCategories === undefined

  // Toda la lógica de analytics se computa en useMemo (re-corre cuando cambian los datos o los filtros)
  const data = useMemo((): AnalyticsData => {
    if (!allTransactions || !allWallets || !allCategories) return emptyAnalytics

    const { start, end } = getDateRange(timeRange)

    // Filtrar por rango de fechas
    const inRange = allTransactions.filter(t => {
      const d = new Date(t.date)
      return d >= start && d <= end
    })

    // Filtrar por moneda si está especificado
    const filtered = currency !== 'ALL'
      ? inRange.filter(t => t.currency === currency)
      : inRange

    // Enriquecer con wallet y categoría
    const enriched: EnrichedTransaction[] = filtered.map(txn => ({
      ...txn,
      wallet: allWallets.find(w => w.id === txn.walletId),
      category: allCategories.find(c => c.id === txn.categoryId)
    }))

    const totalIncome = enriched
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = enriched
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const netIncome = totalIncome - totalExpenses

    const monthlyData = generateMonthlyData(enriched, start, end)
    const categoryBreakdown = generateCategoryBreakdown(
      enriched.filter(t => t.type === 'expense'),
      totalExpenses
    )
    const walletBreakdown = generateWalletBreakdown(allWallets, currency)

    return {
      transactions: enriched,
      totalIncome,
      totalExpenses,
      netIncome,
      monthlyData,
      categoryBreakdown,
      walletBreakdown
    }
  }, [allTransactions, allWallets, allCategories, timeRange, currency])

  const timeRangeOptions = [
    { value: 'last7days', label: t('analytics.timeRanges.last7days') },
    { value: 'last30days', label: t('analytics.timeRanges.last30days') },
    { value: 'last3months', label: t('analytics.timeRanges.last3months') },
    { value: 'last6months', label: t('analytics.timeRanges.last6months') },
    { value: 'currentyear', label: t('analytics.timeRanges.currentyear') },
    { value: 'lastyear', label: t('analytics.timeRanges.lastyear') }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-96">
              <CardContent className="p-6">
                <div className="h-full bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-4">
          <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={currency} onValueChange={(value: 'ARS' | 'USD' | 'ALL') => setCurrency(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('analytics.allCurrencies')}</SelectItem>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={() => setExportDialogOpen(true)}
          className="w-full sm:w-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          {t('analytics.exportData')}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.metrics.totalIncome')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currency === 'ALL'
                ? `${formatCurrency(data.totalIncome, 'ARS')}*`
                : formatCurrency(data.totalIncome, currency)
              }
            </div>
            {currency === 'ALL' && (
              <p className="text-xs text-muted-foreground">*Mixed currencies</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.metrics.totalExpenses')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {currency === 'ALL'
                ? `${formatCurrency(data.totalExpenses, 'ARS')}*`
                : formatCurrency(data.totalExpenses, currency)
              }
            </div>
            {currency === 'ALL' && (
              <p className="text-xs text-muted-foreground">*Mixed currencies</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.metrics.netIncome')}</CardTitle>
            <DollarSign className={`h-4 w-4 ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {currency === 'ALL'
                ? `${formatCurrency(data.netIncome, 'ARS')}*`
                : formatCurrency(data.netIncome, currency)
              }
            </div>
            {currency === 'ALL' && (
              <p className="text-xs text-muted-foreground">*Mixed currencies</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.metrics.avgDailyExpense')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currency === 'ALL'
                ? `${formatCurrency(data.totalExpenses / getDaysInRange(timeRange), 'ARS')}*`
                : formatCurrency(data.totalExpenses / getDaysInRange(timeRange), currency)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.perDay')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Income vs Expenses Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('analytics.charts.financialTrends')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FinancialTrends data={data.monthlyData} currency={currency} />
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={data.categoryBreakdown} />
          </CardContent>
        </Card>

        {/* Monthly Overview */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.monthlyOverview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyOverview data={data.monthlyData} currency={currency} />
          </CardContent>
        </Card>

        {/* Income Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.incomeBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeChart
              transactions={data.transactions.filter(t => t.type === 'income')}
              currency={currency}
            />
          </CardContent>
        </Card>

        {/* Expense Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.charts.expenseDetails')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseChart
              transactions={data.transactions.filter(t => t.type === 'expense')}
              currency={currency}
            />
          </CardContent>
        </Card>
      </div>

      {/* Export Dialog */}
      <DataExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        transactions={data.transactions}
        timeRange={timeRange}
        currency={currency}
      />
    </div>
  )
}
