'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  Wallet,
  Tag
} from 'lucide-react'
import { db, deleteWithSync } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  formatCurrency,
  formatTransactionAmount,
  sortTransactionsByDate,
  filterTransactionsByDateRange,
  getCurrentMonthRange,
  getLastNMonthsRange,
  reverseTransactionBalanceUpdate
} from '@/lib/utils/finance'
import {
  PersonalTransaction,
  PersonalWallet,
  PersonalCategory,
  TransactionType
} from '@/types/personal-finance'
import { useToast } from '@/hooks/use-toast'

interface TransactionFilters {
  search: string
  type: TransactionType | 'all'
  walletId: string | 'all'
  categoryId: string | 'all'
  dateRange: 'all' | 'today' | 'week' | 'month' | 'last-month' | '3-months'
  sortBy: 'date' | 'amount'
  sortOrder: 'asc' | 'desc'
}

const defaultFilters: TransactionFilters = {
  search: '',
  type: 'all',
  walletId: 'all',
  categoryId: 'all',
  dateRange: 'month',
  sortBy: 'date',
  sortOrder: 'desc'
}

interface TransactionWithDetails extends PersonalTransaction {
  wallet?: PersonalWallet
  category?: PersonalCategory
  targetWallet?: PersonalWallet
}

export function TransactionList() {
  const t = useTranslations('personalFinance')
  const { toast } = useToast()
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  // Reactive data loading
  const rawTransactions = useLiveQuery(
    () => db.personalTransactions.toArray(),
    []
  )

  const wallets = useLiveQuery(
    () => db.personalWallets.where('isActive').equals(1).toArray(),
    []
  )

  const categories = useLiveQuery(
    () => db.personalCategories.where('isActive').equals(1).toArray(),
    []
  )

  const loading = rawTransactions === undefined || wallets === undefined || categories === undefined

  const getDateRangeForFilter = (range: string) => {
    const now = new Date()

    switch (range) {
      case 'today':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        }
      case 'week': {
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        return { start: startOfWeek, end: now }
      }
      case 'month':
        return getCurrentMonthRange()
      case 'last-month': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        return { start: lastMonth, end: endLastMonth }
      }
      case '3-months':
        return getLastNMonthsRange(3)
      default:
        return null
    }
  }

  // Apply filters and enrichment via useMemo
  const transactions = useMemo(() => {
    if (!rawTransactions || !wallets || !categories) return []

    let filtered = [...rawTransactions]

    // Apply search filter
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase()
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(searchLower) ||
        (t.notes && t.notes.toLowerCase().includes(searchLower))
      )
    }

    // Apply type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type)
    }

    // Apply wallet filter
    if (filters.walletId !== 'all') {
      filtered = filtered.filter(t =>
        t.walletId === filters.walletId || t.targetWalletId === filters.walletId
      )
    }

    // Apply category filter
    if (filters.categoryId !== 'all') {
      filtered = filtered.filter(t => t.categoryId === filters.categoryId)
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const dateRange = getDateRangeForFilter(filters.dateRange)
      if (dateRange) {
        filtered = filterTransactionsByDateRange(filtered, dateRange.start, dateRange.end)
      }
    }

    // Sort transactions
    filtered = sortTransactionsByDate(filtered)
    if (filters.sortBy === 'amount') {
      filtered.sort((a, b) => {
        const comparison = b.amount - a.amount
        return filters.sortOrder === 'desc' ? comparison : -comparison
      })
    }

    // Enrich with wallet and category details
    return filtered.map(txn => ({
      ...txn,
      wallet: wallets.find(w => w.id === txn.walletId),
      category: categories.find(c => c.id === txn.categoryId),
      targetWallet: txn.targetWalletId ? wallets.find(w => w.id === txn.targetWalletId) : undefined
    })) as TransactionWithDetails[]
  }, [rawTransactions, wallets, categories, debouncedSearch, filters])

  const handleDeleteTransaction = (transactionId: string) => {
    setTransactionToDelete(transactionId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!transactionToDelete) return

    try {
      const transaction = rawTransactions?.find(t => t.id === transactionToDelete)
      if (!transaction) return

      // Reverse the transaction's balance effects
      await reverseTransactionBalanceUpdate(transaction)

      // Delete the transaction (with sync logging)
      await deleteWithSync(db.personalTransactions, 'personalTransactions', transactionToDelete)

      toast({
        title: t('transactionList.deleteSuccessTitle'),
        description: t('transactionList.deleteSuccessMessage')
      })
    } catch (error) {
      console.error('Error deleting transaction:', error)
      toast({
        title: t('transactionList.deleteErrorTitle'),
        description: t('transactionList.deleteErrorMessage'),
        variant: 'destructive'
      })
    } finally {
      setDeleteDialogOpen(false)
      setTransactionToDelete(null)
    }
  }

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'income': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'expense': return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'transfer': return <ArrowUpDown className="h-4 w-4 text-blue-600" />
    }
  }

  const getTransactionColor = (type: TransactionType) => {
    switch (type) {
      case 'income': return 'text-green-600'
      case 'expense': return 'text-red-600'
      case 'transfer': return 'text-blue-600'
    }
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
  }

  const hasActiveFilters = () => {
    return Object.entries(filters).some(([key, value]) =>
      key !== 'sortBy' && key !== 'sortOrder' && value !== defaultFilters[key as keyof TransactionFilters]
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton loading */}
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t('transactionList.filters')}
              {hasActiveFilters() && (
                <Badge variant="secondary" className="ml-2">
                  {t('transactionList.active')}
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? t('transactionList.hideFilters') : t('transactionList.showFilters')}
              </Button>
              {hasActiveFilters() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                >
                  {t('transactionList.clearAll')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t('transactionList.searchPlaceholder')}
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            {/* Filter Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {t('transactionList.type')}
                </label>
                <Select
                  value={filters.type}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, type: value as TransactionType | 'all' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('transactionList.allTypes')}</SelectItem>
                    <SelectItem value="income">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        {t('transactionList.income')}
                      </div>
                    </SelectItem>
                    <SelectItem value="expense">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        {t('transactionList.expense')}
                      </div>
                    </SelectItem>
                    <SelectItem value="transfer">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4 text-blue-600" />
                        {t('transactionList.transfer')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Wallet Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {t('transactionList.wallet')}
                </label>
                <Select
                  value={filters.walletId}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, walletId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('transactionList.allWallets')}</SelectItem>
                    {wallets?.map(wallet => (
                      <SelectItem key={wallet.id} value={wallet.id!}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: wallet.color }}
                          />
                          {wallet.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {t('transactionList.category')}
                </label>
                <Select
                  value={filters.categoryId}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('transactionList.allCategories')}</SelectItem>
                    {categories?.map(category => (
                      <SelectItem key={category.id} value={category.id!}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('transactionList.dateRange')}
                </label>
                <Select
                  value={filters.dateRange}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value as TransactionFilters['dateRange'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('transactionList.allTime')}</SelectItem>
                    <SelectItem value="today">{t('transactionList.today')}</SelectItem>
                    <SelectItem value="week">{t('transactionList.thisWeek')}</SelectItem>
                    <SelectItem value="month">{t('transactionList.thisMonth')}</SelectItem>
                    <SelectItem value="last-month">{t('transactionList.lastMonth')}</SelectItem>
                    <SelectItem value="3-months">{t('transactionList.last3Months')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sort Options */}
            <div className="flex gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('transactionList.sortBy')}</label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value as 'date' | 'amount' }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">{t('transactionList.date')}</SelectItem>
                    <SelectItem value="amount">{t('transactionList.amount')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('transactionList.order')}</label>
                <Select
                  value={filters.sortOrder}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, sortOrder: value as 'asc' | 'desc' }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">{t('transactionList.newestFirst')}</SelectItem>
                    <SelectItem value="asc">{t('transactionList.oldestFirst')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t('transactions.noTransactions')}</h3>
              <p>
                {hasActiveFilters()
                  ? t('transactions.noTransactionsFilterHint')
                  : t('transactions.noTransactionsHint')
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card key={transaction.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Icon and Type */}
                    <div className="flex-shrink-0">
                      <div className="p-2 rounded-full bg-muted">
                        {getTransactionIcon(transaction.type)}
                      </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{transaction.description}</h3>
                        <Badge variant="outline" className="text-xs">
                          {transaction.type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {/* Date */}
                        <span>{transaction.date instanceof Date ? transaction.date.toLocaleDateString() : new Date(transaction.date).toLocaleDateString()}</span>

                        {/* Wallet Info */}
                        <div className="flex items-center gap-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: transaction.wallet?.color || '#666' }}
                          />
                          <span>{transaction.wallet?.name}</span>
                        </div>

                        {/* Transfer Target */}
                        {transaction.type === 'transfer' && transaction.targetWallet && (
                          <div className="flex items-center gap-1">
                            <ArrowUpDown className="h-3 w-3" />
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: transaction.targetWallet.color }}
                            />
                            <span>{transaction.targetWallet.name}</span>
                          </div>
                        )}

                        {/* Category */}
                        {transaction.category && (
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: transaction.category.color }}
                            />
                            <span>{transaction.category.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {transaction.notes}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="flex-shrink-0 text-right">
                      <div className={`font-bold text-lg ${getTransactionColor(transaction.type)}`}>
                        {formatTransactionAmount(transaction.amount, transaction.type, transaction.currency).formatted}
                      </div>
                      {transaction.sharedWithHousehold && transaction.householdContribution && (
                        <div className="text-xs text-muted-foreground">
                          {t('transactions.amountShared', { amount: formatCurrency(transaction.householdContribution, transaction.currency) })}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => console.log('Edit:', transaction.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('transactionList.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteTransaction(transaction.id!)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('transactionList.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {transactions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{t('transactions.showingCount', { count: transactions.length })}</span>
              <div className="flex gap-4">
                <span className="text-green-600">
                  {t('transactions.incomeLabel')} {formatCurrency(
                    transactions
                      .filter(t => t.type === 'income')
                      .reduce((sum, t) => sum + t.amount, 0),
                    'ARS'
                  )}
                </span>
                <span className="text-red-600">
                  {t('transactions.expensesLabel')} {formatCurrency(
                    transactions
                      .filter(t => t.type === 'expense')
                      .reduce((sum, t) => sum + t.amount, 0),
                    'ARS'
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.deleteTransactionMessage')} {t('deleteConfirm.cannotBeUndone')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              {t('deleteConfirm.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
