'use client'

import { useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { User, MonthlyIncome, RecurringExpense, ExpensePayment, MonthlyExchangeRate } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatARS } from '@/lib/utils'
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
  currentYear
}: AnalysisTabProps) {
  const t = useTranslations('finance.analysis')

  // Get exchange rate for a specific month/year
  const getExchangeRate = useCallback((month: number, year: number): number => {
    const rate = allExchangeRates.find(r => r.month === month && r.year === year)
    return rate?.rate || 1
  }, [allExchangeRates])

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

  // 1. Income per month data
  const incomePerMonthData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const monthIncomes = allIncomes.filter(i => i.month === month && i.year === year)
      const total = monthIncomes.reduce((sum, inc) => {
        return sum + (inc.currency === 'USD' ? inc.amount * rate : inc.amount)
      }, 0)
      return { name: label, value: total, month, year }
    })
  }, [allIncomes, last12Months, getExchangeRate])

  // 2. Expenses per month data (based on payments)
  const expensesPerMonthData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0)

      const monthPayments = allPayments.filter(p => {
        const dueDate = new Date(p.dueDate)
        return dueDate >= startOfMonth && dueDate <= endOfMonth && p.status === 'paid'
      })

      const total = monthPayments.reduce((sum, p) => {
        const expense = allExpenses.find(e => e.id === p.recurringExpenseId)
        const amount = p.amount || expense?.amount || 0
        const currency = expense?.currency || 'ARS'
        return sum + (currency === 'USD' ? amount * rate : amount)
      }, 0)

      return { name: label, value: total, month, year }
    })
  }, [allPayments, allExpenses, last12Months, getExchangeRate])

  // 3. Each service/expense progression over time
  const expenseProgressionData = useMemo(() => {
    const activeExpenses = allExpenses.filter(e => e.isActive).slice(0, 5) // Top 5 expenses

    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0)

      const dataPoint: Record<string, string | number> = { name: label }

      activeExpenses.forEach(expense => {
        const payment = allPayments.find(p => {
          const dueDate = new Date(p.dueDate)
          return p.recurringExpenseId === expense.id &&
                 dueDate >= startOfMonth &&
                 dueDate <= endOfMonth &&
                 p.status === 'paid'
        })

        const amount = payment?.amount || expense.amount
        const value = expense.currency === 'USD' ? amount * rate : amount
        dataPoint[expense.name] = value
      })

      return dataPoint
    })
  }, [allExpenses, allPayments, last12Months, getExchangeRate])

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
          return sum + (inc.currency === 'USD' ? inc.amount * rate : inc.amount)
        }, 0)
        dataPoint[user.name] = total
      })

      return dataPoint
    })
  }, [users, allIncomes, last12Months, getExchangeRate])

  // 5. Income vs Expenses comparison
  const incomeVsExpensesData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)

      const monthIncomes = allIncomes.filter(i => i.month === month && i.year === year)
      const income = monthIncomes.reduce((sum, inc) => {
        return sum + (inc.currency === 'USD' ? inc.amount * rate : inc.amount)
      }, 0)

      const startOfMonth = new Date(year, month - 1, 1)
      const endOfMonth = new Date(year, month, 0)

      const monthPayments = allPayments.filter(p => {
        const dueDate = new Date(p.dueDate)
        return dueDate >= startOfMonth && dueDate <= endOfMonth && p.status === 'paid'
      })

      const expenses = monthPayments.reduce((sum, p) => {
        const expense = allExpenses.find(e => e.id === p.recurringExpenseId)
        const amount = p.amount || expense?.amount || 0
        const currency = expense?.currency || 'ARS'
        return sum + (currency === 'USD' ? amount * rate : amount)
      }, 0)

      return { name: label, income, expenses, savings: income - expenses }
    })
  }, [allIncomes, allPayments, allExpenses, last12Months, getExchangeRate])

  // 6. Expense categories breakdown (current month)
  const expenseCategoryData = useMemo(() => {
    const rate = getExchangeRate(currentMonth, currentYear)
    const categoryTotals: Record<string, number> = {}

    allExpenses.filter(e => e.isActive).forEach(expense => {
      const category = expense.category || 'Other'
      const amount = expense.currency === 'USD' ? expense.amount * rate : expense.amount
      categoryTotals[category] = (categoryTotals[category] || 0) + amount
    })

    return Object.entries(categoryTotals).map(([name, value]) => ({ name, value }))
  }, [allExpenses, currentMonth, currentYear, getExchangeRate])

  // 7. Income share by member (current month)
  const incomeShareData = useMemo(() => {
    const rate = getExchangeRate(currentMonth, currentYear)
    const currentIncomes = allIncomes.filter(i => i.month === currentMonth && i.year === currentYear)

    const memberTotals: Record<string, { value: number; color: string }> = {}

    currentIncomes.forEach(income => {
      const user = users.find(u => u.id === income.userId)
      if (user) {
        const amount = income.currency === 'USD' ? income.amount * rate : income.amount
        if (!memberTotals[user.name]) {
          memberTotals[user.name] = { value: 0, color: user.color }
        }
        memberTotals[user.name].value += amount
      }
    })

    return Object.entries(memberTotals).map(([name, { value, color }]) => ({ name, value, color }))
  }, [allIncomes, users, currentMonth, currentYear, getExchangeRate])

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
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const endOfMonth = new Date(currentYear, currentMonth, 0)

    const monthPayments = allPayments.filter(p => {
      const dueDate = new Date(p.dueDate)
      return dueDate >= startOfMonth && dueDate <= endOfMonth
    })

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
  }, [allPayments, currentMonth, currentYear, t])

  // 10. Exchange rate trend
  const exchangeRateTrendData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      return { name: label, rate: rate > 1 ? rate : null }
    })
  }, [last12Months, getExchangeRate])

  // Get active expense names for the legend
  const activeExpenseNames = allExpenses.filter(e => e.isActive).slice(0, 5).map(e => e.name)
  const residentUserNames = users.filter(u => u.type === 'resident').map(u => u.name)

  // Custom tooltip formatter
  const formatTooltipValue = (value: number) => `$ ${formatARS(value)}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('subtitle')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Row 1: Income and Expenses per month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Income per Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              {t('charts.incomePerMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={incomePerMonthData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="value" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} name={t('charts.income')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. Expenses per Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              {t('charts.expensesPerMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={expensesPerMonthData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="value" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} name={t('charts.expenses')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Service and Member progressions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. Service/Expense Progression */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-purple-500" />
              {t('charts.serviceProgression')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={expenseProgressionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                {activeExpenseNames.map((name, index) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 4. Member Income Progression */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              {t('charts.memberIncomeProgression')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={memberIncomeProgressionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                {residentUserNames.map((name, index) => {
                  const user = users.find(u => u.name === name)
                  return (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={user?.color || COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Income vs Expenses and Savings Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5. Income vs Expenses Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              {t('charts.incomeVsExpenses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={incomeVsExpensesData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                <Bar dataKey="income" fill={CHART_COLORS.income} name={t('charts.income')} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill={CHART_COLORS.expense} name={t('charts.expenses')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 8. Net Savings Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" />
              {t('charts.savingsTrend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={savingsTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 6. Expense Categories Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-orange-500" />
              {t('charts.expenseCategories')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={expenseCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              {t('charts.incomeShare')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={incomeShareData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-cyan-500" />
              {t('charts.paymentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              {paymentStatusData.length > 0 ? (
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('charts.noPaymentData')}
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Exchange Rate Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-amber-500" />
            {t('charts.exchangeRateTrend')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={exchangeRateTrendData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value) => [`$${formatARS(value as number)}`, 'USD/ARS']} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 4, fill: '#F59E0B' }}
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
