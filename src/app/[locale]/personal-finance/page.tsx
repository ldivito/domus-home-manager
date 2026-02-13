'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, TrendingUp, TrendingDown, Plus, CreditCard, ArrowUpDown, AlertCircle, BarChart3, PieChart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  formatCurrency,
  calculateTotalBalance,
} from '@/lib/utils/finance'
import CreditCardNotifications from './components/CreditCardNotifications'

export default function PersonalFinancePage() {
  const t = useTranslations('personalFinance')

  // Reactive data loading via useLiveQuery
  const wallets = useLiveQuery(
    () => db.personalWallets
      .where('isActive')
      .equals(1)
      .toArray(),
    []
  )

  const categories = useLiveQuery(
    () => db.personalCategories
      .where('isActive')
      .equals(1)
      .toArray(),
    []
  )

  const recentTransactions = useLiveQuery(
    () => db.personalTransactions
      .orderBy('date')
      .reverse()
      .limit(10)
      .toArray(),
    []
  )

  const monthTransactions = useLiveQuery(
    () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      return db.personalTransactions
        .where('date')
        .between(start, end)
        .toArray()
    },
    []
  )

  const loading = wallets === undefined || categories === undefined ||
    recentTransactions === undefined || monthTransactions === undefined

  // Memoized calculations
  const totalBalances = useMemo(
    () => wallets ? calculateTotalBalance(wallets) : { ARS: 0, USD: 0 },
    [wallets]
  )

  const monthlyStats = useMemo(() => {
    if (!monthTransactions) return { income: 0, expenses: 0, net: 0 }
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    return { income, expenses, net: income - expenses }
  }, [monthTransactions])

  const monthlyStatsFormatted = useMemo(() => {
    const { income, expenses, net } = monthlyStats
    return {
      income: formatCurrency(income, 'ARS'),
      expenses: formatCurrency(expenses, 'ARS'),
      net: formatCurrency(net, 'ARS'),
      netColor: net >= 0 ? 'text-green-600' : 'text-red-600'
    }
  }, [monthlyStats])

  const enrichedTransactions = useMemo(() => {
    if (!recentTransactions || !wallets || !categories) return []
    return recentTransactions.map(txn => ({
      ...txn,
      wallet: wallets.find(w => w.id === txn.walletId),
      category: categories.find(c => c.id === txn.categoryId)
    }))
  }, [recentTransactions, wallets, categories])

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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ARS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalBalances.ARS, 'ARS')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total USD</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalBalances.USD, 'USD')}
            </div>
          </CardContent>
        </Card>

        {/* Active Wallets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('wallets.activeWallets')}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets!.length}</div>
          </CardContent>
        </Card>

        {/* Monthly Net */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.title')}</CardTitle>
            {monthlyStats.net >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyStatsFormatted.netColor}`}>
              {monthlyStatsFormatted.net}
            </div>
            <p className="text-xs text-muted-foreground">{t('analytics.metrics.netIncome')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Button asChild className="h-20 flex-col">
              <Link href="/personal-finance/transactions/new?type=expense">
                <TrendingDown className="h-6 w-6 mb-2" />
                {t('dashboard.addExpense')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/personal-finance/transactions/new?type=income">
                <TrendingUp className="h-6 w-6 mb-2" />
                {t('dashboard.addIncome')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/personal-finance/transactions/new?type=transfer">
                <ArrowUpDown className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                {t('dashboard.transfer')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/wallets/new">
                <Plus className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                {t('dashboard.newWallet')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Analytics Quick Access */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.insightsReports')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/analytics">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                {t('dashboard.viewAnalytics')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/analytics">
                <PieChart className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                {t('dashboard.expenseBreakdown')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/transactions">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                {t('dashboard.allTransactions')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/wallets">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                {t('dashboard.manageWallets')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Financial Health Snapshot */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('dashboard.financialHealth')}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/personal-finance/analytics">
              {t('common.viewDetails')}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold mb-1">{monthlyStatsFormatted.income}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.monthlyIncome')}</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold mb-1 text-red-600">{monthlyStatsFormatted.expenses}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.monthlyExpenses')}</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold mb-1 ${monthlyStatsFormatted.netColor}`}>
                {monthlyStats.expenses > 0
                  ? `${((monthlyStats.income / monthlyStats.expenses) * 100).toFixed(0)}%`
                  : '\u221E'
                }
              </div>
              <div className="text-sm text-muted-foreground">
                {monthlyStats.expenses > 0
                  ? t('dashboard.incomeExpenseRatio')
                  : t('dashboard.noExpensesYet')
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Card Notifications */}
      <CreditCardNotifications
        userId="current-user-id"
        compact={false}
        onNotificationClick={(notification) => {
          console.log('Notification clicked:', notification)
        }}
      />

      {/* Wallets and Transactions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Wallets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('wallets.title')}</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/personal-finance/wallets">
                {t('common.viewAll')}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {wallets!.length === 0 ? (
              <div className="text-center py-6">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">{t('wallets.noWallets')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('wallets.noWalletsHint')}
                </p>
                <Button asChild size="sm">
                  <Link href="/personal-finance/wallets/new">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('wallets.addWallet')}
                  </Link>
                </Button>
              </div>
            ) : (
              wallets!.slice(0, 4).map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full" style={{ backgroundColor: `${wallet.color}20` }}>
                      {wallet.type === 'credit_card' ? (
                        <CreditCard className="h-4 w-4" style={{ color: wallet.color }} />
                      ) : (
                        <Wallet className="h-4 w-4" style={{ color: wallet.color }} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{wallet.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {wallet.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className={`font-bold ${
                    wallet.balance < 0 ? 'text-red-500' : 'text-green-600'
                  }`}>
                    {formatCurrency(wallet.balance, wallet.currency)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('transactions.title')}</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/personal-finance/transactions">
                {t('common.viewAll')}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrichedTransactions.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">{t('transactions.noTransactions')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('transactions.noTransactionsHint')}
                </p>
                <Button asChild size="sm">
                  <Link href="/personal-finance/transactions/new">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('transactions.newTransaction')}
                  </Link>
                </Button>
              </div>
            ) : (
              enrichedTransactions.map((transaction) => {
                const getTransactionIcon = (type: string) => {
                  switch (type) {
                    case 'income': return <TrendingUp className="h-4 w-4 text-green-600" />
                    case 'expense': return <TrendingDown className="h-4 w-4 text-red-600" />
                    case 'transfer': return <ArrowUpDown className="h-4 w-4 text-blue-600" />
                    default: return <TrendingDown className="h-4 w-4 text-gray-600" />
                  }
                }

                const getTransactionAmount = (txn: typeof transaction) => {
                  let sign = ''
                  let colorClass = ''

                  switch (txn.type) {
                    case 'income':
                      sign = '+'
                      colorClass = 'text-green-600'
                      break
                    case 'expense':
                      sign = '-'
                      colorClass = 'text-red-600'
                      break
                    case 'transfer':
                      colorClass = 'text-blue-600'
                      break
                    default:
                      colorClass = 'text-gray-600'
                  }

                  return (
                    <span className={`font-bold ${colorClass}`}>
                      {sign}{formatCurrency(txn.amount, txn.currency)}
                    </span>
                  )
                }

                return (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="p-2 rounded-full bg-muted">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{transaction.date instanceof Date ? transaction.date.toLocaleDateString() : new Date(transaction.date).toLocaleDateString()}</span>
                          {transaction.wallet && (
                            <>
                              <span>&bull;</span>
                              <div className="flex items-center gap-1">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: transaction.wallet.color }}
                                />
                                <span className="truncate">{transaction.wallet.name}</span>
                              </div>
                            </>
                          )}
                          {transaction.category && (
                            <>
                              <span>&bull;</span>
                              <div className="flex items-center gap-1">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: transaction.category.color }}
                                />
                                <span className="truncate">{transaction.category.name}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getTransactionAmount(transaction)}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
