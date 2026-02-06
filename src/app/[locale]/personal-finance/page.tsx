'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, TrendingUp, TrendingDown, Plus, CreditCard, ArrowUpDown, AlertCircle, BarChart3, PieChart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { db } from '@/lib/db'
import { 
  formatCurrency, 
  getWalletBalanceSummary,
  getCurrentMonthRange,
  filterTransactionsByDateRange,
  sortTransactionsByDate
} from '@/lib/utils/finance'
import { 
  PersonalWallet, 
  PersonalTransaction, 
  PersonalCategory 
} from '@/types/personal-finance'
import CreditCardNotifications from './components/CreditCardNotifications'

interface DashboardData {
  totalBalance: { currency: string; total: number }[]
  wallets: PersonalWallet[]
  recentTransactions: (PersonalTransaction & { 
    wallet?: PersonalWallet
    category?: PersonalCategory 
  })[]
  monthlyStats: {
    income: number
    expenses: number
    net: number
  }
}

export default function PersonalFinancePage() {
  const t = useTranslations('personalFinance')
  const [data, setData] = useState<DashboardData>({
    totalBalance: [],
    wallets: [],
    recentTransactions: [],
    monthlyStats: { income: 0, expenses: 0, net: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Memoized calculations for performance
  const monthlyStatsFormatted = useMemo(() => {
    const { income, expenses, net } = data.monthlyStats
    return {
      income: formatCurrency(income, 'ARS'),
      expenses: formatCurrency(expenses, 'ARS'),
      net: formatCurrency(net, 'ARS'),
      netColor: net >= 0 ? 'text-green-600' : 'text-red-600'
    }
  }, [data.monthlyStats])

  // Optimize data loading with useCallback
  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // In a real app, get current user ID from auth context
      const userId = 'current-user-id'
      
      // Load wallets
      const wallets = await db.personalWallets
        .where('isActive')
        .equals(1)
        .toArray()
      
      // Load categories
      const categories = await db.personalCategories
        .where('isActive')
        .equals(1)
        .toArray()
      
      // Calculate balance summary
      const balanceSummary = await getWalletBalanceSummary(userId)
      
      // Load recent transactions (last 10)
      const allTransactions = await db.personalTransactions
        .orderBy('date')
        .reverse()
        .limit(10)
        .toArray()
      
      // Enrich transactions with wallet and category info
      const enrichedTransactions = allTransactions.map(txn => ({
        ...txn,
        wallet: wallets.find(w => w.id === txn.walletId),
        category: categories.find(c => c.id === txn.categoryId)
      }))
      
      // Calculate monthly stats
      const monthRange = getCurrentMonthRange()
      const monthTransactions = await db.personalTransactions
        .where('date')
        .between(monthRange.start, monthRange.end)
        .toArray()
      
      const monthlyStats = {
        income: monthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0),
        expenses: monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0),
        net: 0
      }
      monthlyStats.net = monthlyStats.income - monthlyStats.expenses
      
      setData({
        totalBalance: balanceSummary.totalByCurrency,
        wallets,
        recentTransactions: enrichedTransactions,
        monthlyStats
      })
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setError('Failed to load dashboard data. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
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

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="flex items-center justify-center p-6 text-center">
          <div>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadDashboardData}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Currency Balances */}
        {data.totalBalance.length > 0 ? (
          data.totalBalance.map((balance) => (
            <Card key={balance.currency}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total {balance.currency}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(balance.total, balance.currency as any)}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total ARS</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total USD</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">US$0</div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Active Wallets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.wallets.length}</div>
          </CardContent>
        </Card>

        {/* Monthly Net */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            {data.monthlyStats.net >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyStatsFormatted.netColor}`}>
              {monthlyStatsFormatted.net}
            </div>
            <p className="text-xs text-muted-foreground">Net Income</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Button asChild className="h-20 flex-col">
              <Link href="/personal-finance/transactions/new?type=expense">
                <TrendingDown className="h-6 w-6 mb-2" />
                Add Expense
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/personal-finance/transactions/new?type=income">
                <TrendingUp className="h-6 w-6 mb-2" />
                Add Income
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link href="/personal-finance/transactions/new?type=transfer">
                <ArrowUpDown className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                Transfer
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/wallets/new">
                <Plus className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                New Wallet
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Analytics Quick Access */}
        <Card>
          <CardHeader>
            <CardTitle>Insights & Reports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/analytics">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                View Analytics
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/analytics">
                <PieChart className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                Expense Breakdown
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/transactions">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                All Transactions
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 sm:h-20 flex-col text-sm sm:text-base">
              <Link href="/personal-finance/wallets">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                Manage Wallets
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Financial Health Snapshot */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Financial Health</CardTitle>
          <Link href="/personal-finance/analytics">
            <Button variant="outline" size="sm">View Details</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold mb-1">{monthlyStatsFormatted.income}</div>
              <div className="text-sm text-muted-foreground">Monthly Income</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold mb-1 text-red-600">{monthlyStatsFormatted.expenses}</div>
              <div className="text-sm text-muted-foreground">Monthly Expenses</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold mb-1 ${monthlyStatsFormatted.netColor}`}>
                {data.monthlyStats.expenses > 0 
                  ? `${((data.monthlyStats.income / data.monthlyStats.expenses) * 100).toFixed(0)}%`
                  : '∞'
                }
              </div>
              <div className="text-sm text-muted-foreground">
                {data.monthlyStats.expenses > 0 
                  ? 'Income/Expense Ratio'
                  : 'No Expenses Yet'
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
          // Handle notification click - could navigate to payment page
          console.log('Notification clicked:', notification)
        }}
      />

      {/* Wallets and Transactions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Wallets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Wallets</CardTitle>
            <Link href="/personal-finance/wallets">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.wallets.length === 0 ? (
              <div className="text-center py-6">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No wallets yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first wallet to start tracking your finances
                </p>
                <Link href="/personal-finance/wallets/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Wallet
                  </Button>
                </Link>
              </div>
            ) : (
              data.wallets.slice(0, 4).map((wallet) => (
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
            <CardTitle>Recent Transactions</CardTitle>
            <Link href="/personal-finance/transactions">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.recentTransactions.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No transactions yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your transaction history will appear here
                </p>
                <Link href="/personal-finance/transactions/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </Link>
              </div>
            ) : (
              data.recentTransactions.map((transaction) => {
                const getTransactionIcon = (type: string) => {
                  switch (type) {
                    case 'income': return <TrendingUp className="h-4 w-4 text-green-600" />
                    case 'expense': return <TrendingDown className="h-4 w-4 text-red-600" />
                    case 'transfer': return <ArrowUpDown className="h-4 w-4 text-blue-600" />
                    default: return <TrendingDown className="h-4 w-4 text-gray-600" />
                  }
                }

                const getTransactionAmount = (transaction: any) => {
                  let sign = ''
                  let colorClass = ''
                  
                  switch (transaction.type) {
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
                      {sign}{formatCurrency(transaction.amount, transaction.currency)}
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
                          <span>{transaction.date.toLocaleDateString()}</span>
                          {transaction.wallet && (
                            <>
                              <span>•</span>
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
                              <span>•</span>
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