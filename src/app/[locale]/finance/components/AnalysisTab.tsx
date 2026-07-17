'use client'

import { useMemo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { User, MonthlyIncome, RecurringExpense, ExpensePayment, MonthlyExchangeRate } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatARS } from '@/lib/utils'
import { resolveDefaultForMonth } from '@/lib/utils/finance/monthlyValues'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  PieChartIcon,
  BarChart3,
  Users,
  Receipt,
  DollarSign,
  ArrowRightLeft,
  Wallet
} from 'lucide-react'

interface AnalysisTabProps {
  users: User[]
  allIncomes: MonthlyIncome[]
  allExpenses: RecurringExpense[]
  allPayments: ExpensePayment[]
  allExchangeRates: MonthlyExchangeRate[]
  currentMonth: number
  currentYear: number
  hideAmounts?: boolean
}

// Color palette for charts
const COLORS = [
  '#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
]

const CHART_COLORS = {
  income: '#10B981',
  expense: '#EF4444',
  savings: '#3B82F6',
  primary: '#8B5CF6'
}

export function AnalysisTab({
  users,
  allIncomes,
  allExpenses,
  allPayments,
  allExchangeRates,
  currentMonth,
  currentYear,
  hideAmounts: _hideAmounts
}: AnalysisTabProps) {
  // Note: _hideAmounts is reserved for future implementation
  void _hideAmounts
  const t = useTranslations('finance.analysis')

  const [selectedExpenseId, setSelectedExpenseId] = useState<string>('')
  const activeExpenses = useMemo(() => allExpenses.filter(e => e.isActive), [allExpenses])
  const effectiveExpenseId = selectedExpenseId || activeExpenses[0]?.id || ''

  // Get exchange rate for a specific month/year; null when the month has no rate
  // (never fall back to 1: that would silently mix USD and ARS magnitudes)
  const getExchangeRate = useCallback((month: number, year: number): number | null => {
    const rate = allExchangeRates.find(r => r.month === month && r.year === year)
    return rate?.rate ?? null
  }, [allExchangeRates])

  // Convert an amount to ARS; null when it's USD and the month has no exchange rate
  const convertToARS = useCallback((amount: number, currency: 'ARS' | 'USD' | undefined, rate: number | null): number | null => {
    if ((currency ?? 'ARS') === 'ARS') return amount
    return rate != null ? amount * rate : null
  }, [])

  // Month attribution for payments: month/year fields are the source of truth
  // (dueDate can overflow into the next month for dueDay 29-31 in short months);
  // fall back to dueDate only for legacy records synced without month/year
  const paymentInMonth = useCallback((p: ExpensePayment, month: number, year: number): boolean => {
    if (p.month != null && p.year != null) {
      return p.month === month && p.year === year
    }
    const dueDate = new Date(p.dueDate)
    return dueDate.getMonth() + 1 === month && dueDate.getFullYear() === year
  }, [])

  // Get last 12 months for analysis
  const last12Months = useMemo(() => {
    const months: { month: number; year: number; label: string }[] = []
    let month = currentMonth
    let year = currentYear

    for (let i = 0; i < 12; i++) {
      months.unshift({ month, year, label: `${month}/${year.toString().slice(-2)}` })
      month--
      if (month === 0) {
        month = 12
        year--
      }
    }
    return months
  }, [currentMonth, currentYear])

  // 1. Income per month data (USD amounts without a rate for the month are excluded)
  const incomePerMonthData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const monthIncomes = allIncomes.filter(i => i.month === month && i.year === year)
      const total = monthIncomes.reduce((sum, inc) => {
        const amountARS = convertToARS(inc.amount, inc.currency, rate)
        return amountARS != null ? sum + amountARS : sum
      }, 0)
      return { name: label, value: total, month, year }
    })
  }, [allIncomes, last12Months, getExchangeRate, convertToARS])

  // 2. Expenses per month data (based on payments)
  const expensesPerMonthData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)

      const monthPayments = allPayments.filter(p => paymentInMonth(p, month, year) && p.status === 'paid')

      const total = monthPayments.reduce((sum, p) => {
        const amountARS = convertToARS(p.amount, p.currency, rate)
        return amountARS != null ? sum + amountARS : sum
      }, 0)

      return { name: label, value: total, month, year }
    })
  }, [allPayments, last12Months, getExchangeRate, convertToARS, paymentInMonth])

  // 3. Each service/expense progression over time
  const expenseProgressionData = useMemo(() => {
    const activeExpenses = allExpenses.filter(e => e.isActive).slice(0, 5) // Top 5 expenses

    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const dataPoint: Record<string, string | number | null> = { name: label }

      activeExpenses.forEach(expense => {
        const payment = allPayments.find(
          p => p.recurringExpenseId === expense.id && paymentInMonth(p, month, year)
        )
        // null (chart gap) when there is no record or the USD amount has no rate
        dataPoint[expense.name] = payment ? convertToARS(payment.amount, payment.currency, rate) : null
      })

      return dataPoint
    })
  }, [allExpenses, allPayments, last12Months, getExchangeRate, convertToARS, paymentInMonth])

  // 4. Each member income progression over time
  const memberIncomeProgressionData = useMemo(() => {
    const residentUsers = users.filter(u => u.type === 'resident')

    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const dataPoint: Record<string, string | number> = { name: label }

      residentUsers.forEach(user => {
        const userIncomes = allIncomes.filter(i =>
          i.userId === user.id && i.month === month && i.year === year
        )
        const total = userIncomes.reduce((sum, inc) => {
          const amountARS = convertToARS(inc.amount, inc.currency, rate)
          return amountARS != null ? sum + amountARS : sum
        }, 0)
        dataPoint[user.name] = total
      })

      return dataPoint
    })
  }, [users, allIncomes, last12Months, getExchangeRate, convertToARS])

  // 5. Income vs Expenses comparison
  const incomeVsExpensesData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)

      const monthIncomes = allIncomes.filter(i => i.month === month && i.year === year)
      const income = monthIncomes.reduce((sum, inc) => {
        const amountARS = convertToARS(inc.amount, inc.currency, rate)
        return amountARS != null ? sum + amountARS : sum
      }, 0)

      const monthPayments = allPayments.filter(p => paymentInMonth(p, month, year) && p.status === 'paid')

      const expenses = monthPayments.reduce((sum, p) => {
        const amountARS = convertToARS(p.amount, p.currency, rate)
        return amountARS != null ? sum + amountARS : sum
      }, 0)

      return { name: label, income, expenses, savings: income - expenses }
    })
  }, [allIncomes, allPayments, last12Months, getExchangeRate, convertToARS, paymentInMonth])

  // 6. Expense categories breakdown (current month)
  const expenseCategoryData = useMemo(() => {
    const rate = getExchangeRate(currentMonth, currentYear)
    const categoryTotals: Record<string, number> = {}

    allExpenses.filter(e => e.isActive).forEach(expense => {
      const category = expense.category || 'Other'
      const stored = allPayments.find(
        p => p.recurringExpenseId === expense.id && paymentInMonth(p, currentMonth, currentYear)
      )
      const seed = stored
        ? { amount: stored.amount, currency: stored.currency ?? 'ARS' as const }
        : resolveDefaultForMonth(expense, currentMonth, currentYear, allPayments)
      const amountARS = convertToARS(seed.amount, seed.currency, rate)
      if (amountARS != null) {
        categoryTotals[category] = (categoryTotals[category] || 0) + amountARS
      }
    })

    return Object.entries(categoryTotals).map(([name, value]) => ({ name, value }))
  }, [allExpenses, allPayments, currentMonth, currentYear, getExchangeRate, convertToARS, paymentInMonth])

  // 7. Income share by member (current month)
  const incomeShareData = useMemo(() => {
    const rate = getExchangeRate(currentMonth, currentYear)
    const currentIncomes = allIncomes.filter(i => i.month === currentMonth && i.year === currentYear)

    const memberTotals: Record<string, { value: number; color: string }> = {}

    currentIncomes.forEach(income => {
      const user = users.find(u => u.id === income.userId)
      if (user) {
        const amount = convertToARS(income.amount, income.currency, rate)
        if (amount == null) return
        if (!memberTotals[user.name]) {
          memberTotals[user.name] = { value: 0, color: user.color }
        }
        memberTotals[user.name].value += amount
      }
    })

    return Object.entries(memberTotals).map(([name, { value, color }]) => ({ name, value, color }))
  }, [allIncomes, users, currentMonth, currentYear, getExchangeRate, convertToARS])

  // 8. Net savings trend (area chart)
  const savingsTrendData = useMemo(() => {
    let cumulativeSavings = 0
    return incomeVsExpensesData.map(d => {
      cumulativeSavings += d.savings
      return { name: d.name, savings: d.savings, cumulative: cumulativeSavings }
    })
  }, [incomeVsExpensesData])

  // 9. Payment status distribution
  const paymentStatusData = useMemo(() => {
    const monthPayments = allPayments.filter(p => paymentInMonth(p, currentMonth, currentYear))

    const statusCounts = {
      paid: 0,
      pending: 0,
      overdue: 0
    }

    monthPayments.forEach(p => {
      statusCounts[p.status as keyof typeof statusCounts]++
    })

    return [
      { name: t('charts.paid'), value: statusCounts.paid, color: '#10B981' },
      { name: t('charts.pending'), value: statusCounts.pending, color: '#F59E0B' },
      { name: t('charts.overdue'), value: statusCounts.overdue, color: '#EF4444' }
    ].filter(d => d.value > 0)
  }, [allPayments, currentMonth, currentYear, t, paymentInMonth])

  // 10. Exchange rate trend (null = month without a configured rate; rates <= 1 are still valid data)
  const exchangeRateTrendData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      return { name: label, rate: getExchangeRate(month, year) }
    })
  }, [last12Months, getExchangeRate])

  // Selected service: stored monthly value across the last 12 months (billed value, paid or not).
  // null = no record for that month (or USD without a rate) — rendered as a gap, not $0.
  const serviceTrendData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const payment = allPayments.find(
        p => p.recurringExpenseId === effectiveExpenseId && paymentInMonth(p, month, year)
      )
      const value = payment ? convertToARS(payment.amount, payment.currency, rate) : null
      return { name: label, value }
    })
  }, [allPayments, effectiveExpenseId, last12Months, getExchangeRate, convertToARS, paymentInMonth])

  // Selected service: month-over-month percentage variation.
  // Only computed between consecutive months that both have data; otherwise null
  // (a missing month is "no data", not a -100% drop followed by a fake 0%).
  const serviceVariationData = useMemo(() => {
    return serviceTrendData.map((d, i) => {
      if (i === 0) return { name: d.name, variation: null }
      const prev = serviceTrendData[i - 1].value
      if (d.value == null || prev == null || prev <= 0) {
        return { name: d.name, variation: null }
      }
      const variation = ((d.value - prev) / prev) * 100
      return { name: d.name, variation: Math.round(variation * 10) / 10 }
    })
  }, [serviceTrendData])

  // Months in the window that have USD data but no exchange rate (excluded from ARS aggregates)
  const monthsMissingRate = useMemo(() => {
    return last12Months
      .filter(({ month, year }) => {
        if (getExchangeRate(month, year) != null) return false
        const hasUSDIncome = allIncomes.some(i => i.month === month && i.year === year && i.currency === 'USD')
        const hasUSDPayment = allPayments.some(p => p.currency === 'USD' && paymentInMonth(p, month, year))
        return hasUSDIncome || hasUSDPayment
      })
      .map(({ label }) => label)
  }, [last12Months, getExchangeRate, allIncomes, allPayments, paymentInMonth])

  // Get active expense names for the legend
  const activeExpenseNames = allExpenses.filter(e => e.isActive).slice(0, 5).map(e => e.name)
  const residentUserNames = users.filter(u => u.type === 'resident').map(u => u.name)

  // Custom tooltip formatter
  const formatTooltipValue = (value: number) => `$ ${formatARS(value)}`

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
            {t('title')}
          </CardTitle>
          <CardDescription className="text-sm">
            {t('subtitle')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Months with USD data but no exchange rate: excluded from ARS aggregates */}
      {monthsMissingRate.length > 0 && (
        <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
            {t('missingRateNotice', { months: monthsMissingRate.join(', ') })}
          </p>
        </div>
      )}

      {/* Row 1: Income and Expenses per month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 1. Income per Month */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              {t('charts.incomePerMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <BarChart data={incomePerMonthData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="value" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} name={t('charts.income')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. Expenses per Month */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              {t('charts.expensesPerMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <BarChart data={expensesPerMonthData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="value" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} name={t('charts.expenses')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Service and Member progressions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 3. Service/Expense Progression */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              {t('charts.serviceProgression')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <LineChart data={expenseProgressionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {activeExpenseNames.map((name, index) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 4. Member Income Progression */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              {t('charts.memberIncomeProgression')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <LineChart data={memberIncomeProgressionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {residentUserNames.map((name, index) => {
                  const user = users.find(u => u.name === name)
                  return (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={user?.color || COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2.5: Per-service trend (selectable) and monthly % variation */}
      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              {t('charts.serviceTrend')}
            </CardTitle>
            <Select value={effectiveExpenseId} onValueChange={setSelectedExpenseId}>
              <SelectTrigger className="h-9 w-full sm:w-[220px]">
                <SelectValue placeholder={t('charts.selectService')} />
              </SelectTrigger>
              <SelectContent>
                {activeExpenses.map(exp => (
                  <SelectItem key={exp.id} value={exp.id!}>{exp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <LineChart data={serviceTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 2 }} name={t('charts.serviceTrend')} />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <BarChart data={serviceVariationData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} width={40} />
                <Tooltip formatter={(value) => [`${value}%`, t('charts.variation')]} />
                <Bar dataKey="variation" radius={[4, 4, 0, 0]} name={t('charts.variation')}>
                  {serviceVariationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.variation != null && entry.variation >= 0 ? CHART_COLORS.expense : CHART_COLORS.income} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Income vs Expenses and Savings Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 5. Income vs Expenses Comparison */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
              {t('charts.incomeVsExpenses')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <BarChart data={incomeVsExpensesData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="income" fill={CHART_COLORS.income} name={t('charts.income')} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill={CHART_COLORS.expense} name={t('charts.expenses')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 8. Net Savings Trend */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              {t('charts.savingsTrend')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <AreaChart data={savingsTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="savings"
                  stroke={CHART_COLORS.savings}
                  fill={CHART_COLORS.savings}
                  fillOpacity={0.3}
                  name={t('charts.monthlySavings')}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={CHART_COLORS.primary}
                  fill={CHART_COLORS.primary}
                  fillOpacity={0.2}
                  name={t('charts.cumulativeSavings')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Pie Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 6. Expense Categories Breakdown */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              {t('charts.expenseCategories')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px]">
              <PieChart>
                <Pie
                  data={expenseCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {expenseCategoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipValue} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 7. Income Share by Member */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              {t('charts.incomeShare')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px]">
              <PieChart>
                <Pie
                  data={incomeShareData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {incomeShareData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipValue} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 9. Payment Status Distribution */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
              {t('charts.paymentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px]">
              {paymentStatusData.length > 0 ? (
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  {t('charts.noPaymentData')}
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Exchange Rate Trend */}
      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            {t('charts.exchangeRateTrend')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px]">
            <LineChart data={exchangeRateTrendData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={40} />
              <Tooltip formatter={(value) => [`$${formatARS(value as number)}`, 'USD/ARS']} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 3, fill: '#F59E0B' }}
                connectNulls
                name="USD/ARS"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
