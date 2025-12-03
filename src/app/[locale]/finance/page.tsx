'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, Receipt, Scale, Calendar, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import { IncomeTab } from './components/IncomeTab'
import { ExpensesTab } from './components/ExpensesTab'
import { PaymentsTab } from './components/PaymentsTab'
import { BalanceTab } from './components/BalanceTab'
import { AnalysisTab } from './components/AnalysisTab'
import { formatARS } from '@/lib/utils'

export default function FinancePage() {
  const t = useTranslations('finance')
  const [activeTab, setActiveTab] = useState('income')

  // Current date for reference
  const currentDate = new Date()
  const actualMonth = currentDate.getMonth() + 1
  const actualYear = currentDate.getFullYear()

  // Selected month/year for navigation (defaults to current)
  const [selectedMonth, setSelectedMonth] = useState(actualMonth)
  const [selectedYear, setSelectedYear] = useState(actualYear)

  // Calculate if viewing current, past, or future month
  const isCurrentMonth = selectedMonth === actualMonth && selectedYear === actualYear
  const isPastMonth = selectedYear < actualYear || (selectedYear === actualYear && selectedMonth < actualMonth)
  const isFutureMonth = selectedYear > actualYear || (selectedYear === actualYear && selectedMonth > actualMonth)

  // Load data
  const users = useLiveQuery(() => db.users.toArray()) || []

  // Navigation functions
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  const goToCurrentMonth = () => {
    setSelectedMonth(actualMonth)
    setSelectedYear(actualYear)
  }

  // Get selected month's income
  const selectedIncomes = useLiveQuery(
    () => db.monthlyIncomes
      .where('[month+year]')
      .equals([selectedMonth, selectedYear])
      .toArray(),
    [selectedMonth, selectedYear]
  ) || []

  // Get selected month's exchange rate
  const selectedExchangeRate = useLiveQuery(
    () => db.monthlyExchangeRates
      .where('[month+year]')
      .equals([selectedMonth, selectedYear])
      .first(),
    [selectedMonth, selectedYear]
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

  // Get all incomes for analysis
  const allIncomes = useLiveQuery(() => db.monthlyIncomes.toArray()) || []

  // Get all exchange rates for analysis
  const allExchangeRates = useLiveQuery(() => db.monthlyExchangeRates.toArray()) || []

  // Get exchange rate value (default to 1 if not set)
  const exchangeRate = selectedExchangeRate?.rate || 1

  // Month names for display
  const monthNames = [
    t('months.january'), t('months.february'), t('months.march'),
    t('months.april'), t('months.may'), t('months.june'),
    t('months.july'), t('months.august'), t('months.september'),
    t('months.october'), t('months.november'), t('months.december')
  ]

  // Calculate totals - convert USD to ARS
  const totalHouseholdIncome = selectedIncomes.reduce((sum, inc) => {
    if (inc.currency === 'USD') {
      return sum + (inc.amount * exchangeRate)
    }
    return sum + inc.amount
  }, 0)
  const totalMonthlyExpenses = activeExpenses.reduce((sum, exp) => {
    if (exp.currency === 'USD') {
      return sum + (exp.amount * exchangeRate)
    }
    return sum + exp.amount
  }, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with Month Navigator */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
              {t('title')}
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>

          {/* Compact Month Navigator */}
          <div className="flex items-center justify-center sm:justify-end gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPreviousMonth}
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            <div className="flex flex-col items-center min-w-[120px] sm:min-w-[140px]">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-lg font-semibold whitespace-nowrap">
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </span>
                {isPastMonth && (
                  <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {t('navigator.history')}
                  </span>
                )}
                {isFutureMonth && (
                  <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {t('navigator.upcoming')}
                  </span>
                )}
              </div>
              {!isCurrentMonth && (
                <Button
                  variant="link"
                  onClick={goToCurrentMonth}
                  className="text-xs h-auto p-0 text-muted-foreground hover:text-foreground"
                >
                  {t('navigator.backToCurrent')}
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={goToNextMonth}
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400 truncate">
                    {t('income.totalHousehold')}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-300">
                    $ {formatARS(totalHouseholdIncome)}
                  </p>
                  {exchangeRate > 1 && (
                    <p className="text-xs sm:text-sm text-green-600/70 dark:text-green-400/70">
                      USD {formatARS(totalHouseholdIncome / exchangeRate)}
                    </p>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/50 rounded-full shrink-0 ml-2">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800">
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 truncate">
                    {t('expenses.title')}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-red-700 dark:text-red-300">
                    $ {formatARS(totalMonthlyExpenses)}
                  </p>
                  {exchangeRate > 1 && (
                    <p className="text-xs sm:text-sm text-red-600/70 dark:text-red-400/70">
                      USD {formatARS(totalMonthlyExpenses / exchangeRate)}
                    </p>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/50 rounded-full shrink-0 ml-2">
                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                    {t('balance.netBalance')}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                    $ {formatARS(totalHouseholdIncome - totalMonthlyExpenses)}
                  </p>
                  {exchangeRate > 1 && (
                    <p className="text-xs sm:text-sm text-blue-600/70 dark:text-blue-400/70">
                      USD {formatARS((totalHouseholdIncome - totalMonthlyExpenses) / exchangeRate)}
                    </p>
                  )}
                </div>
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full shrink-0 ml-2">
                  <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-5 h-11 sm:h-14">
              <TabsTrigger value="income" className="text-xs sm:text-base py-2 sm:py-3 px-3 sm:px-4 whitespace-nowrap">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden xs:inline sm:inline">{t('tabs.income')}</span>
                <span className="xs:hidden sm:hidden">{t('tabs.income')}</span>
              </TabsTrigger>
              <TabsTrigger value="expenses" className="text-xs sm:text-base py-2 sm:py-3 px-3 sm:px-4 whitespace-nowrap">
                <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span>{t('tabs.expenses')}</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs sm:text-base py-2 sm:py-3 px-3 sm:px-4 whitespace-nowrap">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span>{t('tabs.payments')}</span>
              </TabsTrigger>
              <TabsTrigger value="balance" className="text-xs sm:text-base py-2 sm:py-3 px-3 sm:px-4 whitespace-nowrap">
                <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span>{t('tabs.balance')}</span>
              </TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs sm:text-base py-2 sm:py-3 px-3 sm:px-4 whitespace-nowrap">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span>{t('tabs.analysis')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="income">
            <IncomeTab
              users={users}
              currentIncomes={selectedIncomes}
              currentMonth={selectedMonth}
              currentYear={selectedYear}
              exchangeRate={selectedExchangeRate}
              isFutureMonth={isFutureMonth}
            />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpensesTab
              expenses={recurringExpenses}
              categories={expenseCategories}
              exchangeRate={selectedExchangeRate}
            />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab
              expenses={recurringExpenses}
              payments={payments}
              users={users}
              incomes={selectedIncomes}
              currentMonth={selectedMonth}
              currentYear={selectedYear}
              exchangeRate={selectedExchangeRate}
              isFutureMonth={isFutureMonth}
            />
          </TabsContent>

          <TabsContent value="balance">
            <BalanceTab
              users={users}
              payments={payments}
              incomes={selectedIncomes}
              expenses={recurringExpenses}
              exchangeRate={selectedExchangeRate}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          </TabsContent>

          <TabsContent value="analysis">
            <AnalysisTab
              users={users}
              allIncomes={allIncomes}
              allExpenses={recurringExpenses}
              allPayments={payments}
              allExchangeRates={allExchangeRates}
              currentMonth={selectedMonth}
              currentYear={selectedYear}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
