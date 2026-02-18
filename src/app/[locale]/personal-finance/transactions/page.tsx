'use client'

import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { TransactionList } from './components/TransactionList'

export default function TransactionsPage() {
  const t = useTranslations('personalFinance')

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('transactions.title')}</h1>
          <p className="text-muted-foreground">
            {t('transactions.subtitle')}
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          <Link href="/personal-finance/transactions/new?type=income">
            <Button variant="outline" size="sm" className="gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              {t('transactions.addIncome')}
            </Button>
          </Link>
          <Link href="/personal-finance/transactions/new?type=expense">
            <Button variant="outline" size="sm" className="gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              {t('transactions.addExpense')}
            </Button>
          </Link>
          <Link href="/personal-finance/transactions/new?type=transfer">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowUpDown className="h-4 w-4 text-blue-600" />
              {t('transactions.transfer')}
            </Button>
          </Link>
          <Link href="/personal-finance/transactions/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('transactions.newTransaction')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Transaction List */}
      <TransactionList />
    </div>
  )
}
