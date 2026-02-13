'use client'

import { use, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Wallet,
  CreditCard,
  Building,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Plus,
  Pencil,
  AlertCircle,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { formatBalance, formatCurrency, calculateAvailableCredit } from '@/lib/utils/finance'
import { EditWalletDialog } from '../components/EditWalletDialog'

const getWalletIcon = (type: string) => {
  switch (type) {
    case 'credit_card': return <CreditCard className="h-6 w-6" />
    case 'bank': return <Building className="h-6 w-6" />
    default: return <Wallet className="h-6 w-6" />
  }
}

export default function WalletDetailPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params)
  const t = useTranslations('personalFinance')
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const getWalletTypeName = (type: string) => {
    switch (type) {
      case 'credit_card': return t('walletCard.creditCard')
      case 'bank': return t('walletCard.bankAccount')
      default: return t('walletCard.physicalWallet')
    }
  }

  const wallet = useLiveQuery(
    () => db.personalWallets.get(walletId),
    [walletId]
  )

  const recentTransactions = useLiveQuery(
    () => db.personalTransactions
      .where('walletId')
      .equals(walletId)
      .reverse()
      .sortBy('date')
      .then(txns => txns.slice(0, 10)),
    [walletId]
  )

  const categories = useLiveQuery(
    () => db.personalCategories.where('isActive').equals(1).toArray(),
    []
  )

  // Loading state
  if (wallet === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-8 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Not found / deactivated
  if (!wallet || !wallet.isActive) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('walletDetail.notFound')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('walletDetail.notFoundHint')}
          </p>
          <Button asChild>
            <Link href="/personal-finance/wallets">{t('walletDetail.backToWallets')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const balanceInfo = formatBalance(wallet.balance || 0, wallet.currency)
  const availableCredit = wallet.type === 'credit_card' && wallet.creditLimit
    ? calculateAvailableCredit(wallet.creditLimit, Math.abs(wallet.balance || 0))
    : null

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'expense': return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'transfer': return <ArrowUpDown className="h-4 w-4 text-blue-600" />
      default: return <TrendingDown className="h-4 w-4 text-gray-600" />
    }
  }

  const getAmountDisplay = (amount: number, type: string, currency: 'ARS' | 'USD') => {
    const sign = type === 'income' ? '+' : type === 'expense' ? '-' : ''
    const colorClass = type === 'income' ? 'text-green-600' : type === 'expense' ? 'text-red-600' : 'text-blue-600'
    return <span className={`font-bold ${colorClass}`}>{sign}{formatCurrency(amount, currency)}</span>
  }

  const getCategoryName = (categoryId: string) => {
    return categories?.find(c => c.id === categoryId)?.name
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/personal-finance/wallets">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{
                backgroundColor: `${wallet.color}20`,
                color: wallet.color
              }}
            >
              {getWalletIcon(wallet.type)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{wallet.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{getWalletTypeName(wallet.type)}</Badge>
                <Badge variant="secondary">{wallet.currency}</Badge>
              </div>
            </div>
          </div>
        </div>

        <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          {t('walletDetail.editWallet')}
        </Button>
      </div>

      {/* Wallet Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              {wallet.type === 'credit_card' ? t('walletCard.currentBalance') : t('walletDetail.balance')}
            </div>
            <div className={`text-3xl font-bold ${balanceInfo.colorClass}`}>
              {balanceInfo.formatted}
            </div>
          </CardContent>
        </Card>

        {wallet.type === 'credit_card' && wallet.creditLimit && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  {t('walletCard.creditLimit')}
                </div>
                <div className="text-3xl font-bold">
                  {formatBalance(wallet.creditLimit, wallet.currency).formatted}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  {t('walletCard.availableCredit')}
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {availableCredit !== null ? formatBalance(availableCredit, wallet.currency).formatted : '-'}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {wallet.type === 'bank' && wallet.bankName && (
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">{t('walletCard.bankLabel')}</div>
              <div className="text-xl font-bold">{wallet.bankName}</div>
              {wallet.accountNumber && (
                <div className="text-sm text-muted-foreground mt-1">{wallet.accountNumber}</div>
              )}
            </CardContent>
          </Card>
        )}

        {wallet.type === 'credit_card' && wallet.dueDay && (
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">{t('walletCard.paymentDue')}</div>
              <div className="text-xl font-bold">{t('walletCard.dayOfMonth', { day: wallet.dueDay })}</div>
              {wallet.closingDay && (
                <div className="text-sm text-muted-foreground mt-1">{t('walletForm.closingDay')}: {t('walletCard.dayOfMonth', { day: wallet.closingDay })}</div>
              )}
            </CardContent>
          </Card>
        )}

        {wallet.type !== 'credit_card' && (
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">{t('walletDetail.currency')}</div>
              <div className="text-xl font-bold">{wallet.currency}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {t('walletDetail.created')} {wallet.createdAt instanceof Date ? wallet.createdAt.toLocaleDateString() : new Date(wallet.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes */}
      {wallet.notes && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{wallet.notes}</div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('walletDetail.recentTransactions')}</CardTitle>
          <Button asChild size="sm">
            <Link href={`/personal-finance/transactions/new?walletId=${walletId}`}>
              <Plus className="h-4 w-4 mr-2" />
              {t('walletDetail.addTransaction')}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!recentTransactions || recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">{t('walletDetail.noTransactions')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('walletDetail.noTransactionsHint')}
              </p>
              <Button asChild size="sm">
                <Link href={`/personal-finance/transactions/new?walletId=${walletId}`}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('walletDetail.addTransaction')}
                </Link>
              </Button>
            </div>
          ) : (
            recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="p-2 rounded-full bg-muted">
                    {getTransactionIcon(txn.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{txn.description}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{txn.date instanceof Date ? txn.date.toLocaleDateString() : new Date(txn.date).toLocaleDateString()}</span>
                      {txn.categoryId && getCategoryName(txn.categoryId) && (
                        <>
                          <span>•</span>
                          <span>{getCategoryName(txn.categoryId)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {getAmountDisplay(txn.amount, txn.type, txn.currency)}
                </div>
              </div>
            ))
          )}

          {recentTransactions && recentTransactions.length > 0 && (
            <div className="text-center pt-2">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/personal-finance/transactions?walletId=${walletId}`}>
                  {t('common.viewAll')} {t('transactions.title')}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditWalletDialog
        wallet={wallet}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
