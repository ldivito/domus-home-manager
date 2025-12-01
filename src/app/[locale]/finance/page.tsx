'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Receipt, Scale, Calendar } from 'lucide-react'
import { IncomeTab } from './components/IncomeTab'
import { ExpensesTab } from './components/ExpensesTab'
import { PaymentsTab } from './components/PaymentsTab'
import { BalanceTab } from './components/BalanceTab'
import { formatARS } from '@/lib/utils'

export default function FinancePage() {
  const t = useTranslations('finance')
  const [activeTab, setActiveTab] = useState('income')

  // Load data
  const users = useLiveQuery(() => db.users.toArray()) || []
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  // Get current month's income
  const currentIncomes = useLiveQuery(
    () => db.monthlyIncomes
      .where('[month+year]')
      .equals([currentMonth, currentYear])
      .toArray(),
    [currentMonth, currentYear]
  ) || []

  // Get current month's exchange rate
  const currentExchangeRate = useLiveQuery(
    () => db.monthlyExchangeRates
      .where('[month+year]')
      .equals([currentMonth, currentYear])
      .first(),
    [currentMonth, currentYear]
  )

  // Get all recurring expenses
  const recurringExpenses = useLiveQuery(() => db.recurringExpenses.toArray()) || []
  const activeExpenses = recurringExpenses.filter(e => e.isActive)

  // Get expense categories
  const expenseCategories = useLiveQuery(() => db.expenseCategories.toArray()) || []

  // Get payments for current month
  const payments = useLiveQuery(
    () => db.expensePayments.toArray(),
    []
  ) || []

  // Get exchange rate value (default to 1 if not set)
  const exchangeRate = currentExchangeRate?.rate || 1

  // Calculate totals - convert USD to ARS
  const totalHouseholdIncome = currentIncomes.reduce((sum, inc) => {
    if (inc.currency === 'USD') {
      return sum + (inc.amount * exchangeRate)
    }
    return sum + inc.amount
  }, 0)
  const totalMonthlyExpenses = activeExpenses.reduce((sum, exp) => sum + exp.amount, 0)

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('title')}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    {t('income.totalHousehold')}
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    $ {formatARS(totalHouseholdIncome)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {t('expenses.title')}
                  </p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    $ {formatARS(totalMonthlyExpenses)}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full">
                  <Receipt className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {t('balance.netBalance')}
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    $ {formatARS(totalHouseholdIncome - totalMonthlyExpenses)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                  <Scale className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-14">
            <TabsTrigger value="income" className="text-base py-3">
              <DollarSign className="h-4 w-4 mr-2" />
              {t('tabs.income')}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="text-base py-3">
              <Receipt className="h-4 w-4 mr-2" />
              {t('tabs.expenses')}
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-base py-3">
              <Calendar className="h-4 w-4 mr-2" />
              {t('tabs.payments')}
            </TabsTrigger>
            <TabsTrigger value="balance" className="text-base py-3">
              <Scale className="h-4 w-4 mr-2" />
              {t('tabs.balance')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="income">
            <IncomeTab
              users={users}
              currentIncomes={currentIncomes}
              currentMonth={currentMonth}
              currentYear={currentYear}
              exchangeRate={currentExchangeRate}
            />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpensesTab
              expenses={recurringExpenses}
              categories={expenseCategories}
            />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab
              expenses={recurringExpenses}
              payments={payments}
              users={users}
              incomes={currentIncomes}
              currentMonth={currentMonth}
              currentYear={currentYear}
            />
          </TabsContent>

          <TabsContent value="balance">
            <BalanceTab
              users={users}
              payments={payments}
              incomes={currentIncomes}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
