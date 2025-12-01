'use client'

import { useTranslations } from 'next-intl'
import { User, ExpensePayment, MonthlyIncome, MonthlyExchangeRate, RecurringExpense } from '@/lib/db'
import { formatARS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Scale, ArrowRight, Check, TrendingUp, TrendingDown, Wallet, Receipt, PiggyBank } from 'lucide-react'

interface BalanceTabProps {
  users: User[]
  payments: ExpensePayment[]
  incomes: MonthlyIncome[]
  expenses: RecurringExpense[]
  exchangeRate?: MonthlyExchangeRate
}

interface UserBalance {
  userId: string
  userName: string
  userColor: string
  incomePercentage: number
  totalOwed: number      // What they should have paid based on income share
  totalPaid: number      // What they actually paid
  netBalance: number     // Positive = others owe them, Negative = they owe others
}

interface Settlement {
  from: string
  fromName: string
  fromColor: string
  to: string
  toName: string
  toColor: string
  amount: number
}

export function BalanceTab({ users, payments, incomes, expenses, exchangeRate }: BalanceTabProps) {
  const t = useTranslations('finance.balance')

  const residents = users.filter(u => u.type === 'resident')
  const rate = exchangeRate?.rate || 1

  // Calculate total household income in ARS
  const totalIncomeARS = incomes.reduce((sum, inc) => {
    if (inc.currency === 'USD') {
      return sum + (inc.amount * rate)
    }
    return sum + inc.amount
  }, 0)

  // Get paid payments only
  const paidPayments = payments.filter(p => p.status === 'paid')

  // Get expense amount in ARS
  const getExpenseAmountARS = (expenseId: string, fallbackAmount: number): number => {
    const expense = expenses.find(e => e.id === expenseId)
    if (!expense) return fallbackAmount
    if (expense.currency === 'USD') {
      return expense.amount * rate
    }
    return expense.amount
  }

  // Calculate total expenses paid in ARS
  const totalExpensesPaidARS = paidPayments.reduce((sum, p) => {
    return sum + getExpenseAmountARS(p.recurringExpenseId, p.amount)
  }, 0)

  // Calculate balances for each user
  const userBalances: UserBalance[] = residents.map(user => {
    // Get user's income in ARS
    const userIncome = incomes.find(inc => inc.userId === user.id)
    const userIncomeARS = userIncome
      ? (userIncome.currency === 'USD' ? userIncome.amount * rate : userIncome.amount)
      : 0
    const percentage = totalIncomeARS > 0
      ? (userIncomeARS / totalIncomeARS) * 100
      : 0

    // Calculate what they should have paid (their share of all paid expenses in ARS)
    const totalOwed = (totalExpensesPaidARS * percentage) / 100

    // Calculate what they actually paid in ARS
    const totalPaid = paidPayments
      .filter(p => p.paidByUserId === user.id)
      .reduce((sum, p) => sum + getExpenseAmountARS(p.recurringExpenseId, p.amount), 0)

    // Net balance: positive means others owe them
    const netBalance = totalPaid - totalOwed

    return {
      userId: user.id!,
      userName: user.name,
      userColor: user.color,
      incomePercentage: percentage,
      totalOwed,
      totalPaid,
      netBalance
    }
  })

  // Calculate settlements (who owes whom)
  const calculateSettlements = (): Settlement[] => {
    const settlements: Settlement[] = []

    // Copy balances for calculation
    const balances = userBalances.map(b => ({ ...b }))

    // Sort: those who owe (negative) first, those owed (positive) last
    const debtors = balances.filter(b => b.netBalance < -0.01).sort((a, b) => a.netBalance - b.netBalance)
    const creditors = balances.filter(b => b.netBalance > 0.01).sort((a, b) => b.netBalance - a.netBalance)

    // Match debtors with creditors
    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i]
      const creditor = creditors[j]

      const amount = Math.min(Math.abs(debtor.netBalance), creditor.netBalance)

      if (amount > 0.01) { // Ignore tiny amounts
        settlements.push({
          from: debtor.userId,
          fromName: debtor.userName,
          fromColor: debtor.userColor,
          to: creditor.userId,
          toName: creditor.userName,
          toColor: creditor.userColor,
          amount
        })
      }

      debtor.netBalance += amount
      creditor.netBalance -= amount

      if (Math.abs(debtor.netBalance) < 0.01) i++
      if (creditor.netBalance < 0.01) j++
    }

    return settlements
  }

  const settlements = calculateSettlements()
  const isAllSettled = settlements.length === 0 && paidPayments.length > 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t('totalIncome')}
                </p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  $ {formatARS(totalIncomeARS)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {t('totalPaidExpenses')}
                </p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  $ {formatARS(totalExpensesPaidARS)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                <Receipt className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {t('remaining')}
                </p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  $ {formatARS(totalIncomeARS - totalExpensesPaidARS)}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                <PiggyBank className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Scale className="h-6 w-6" />
            {t('title')}
          </CardTitle>
          <CardDescription className="mt-1">
            {t('subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paidPayments.length === 0 ? (
            <div className="text-center py-12">
              <Scale className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noPaymentsYet')}</h3>
              <p className="text-muted-foreground">{t('noPaymentsDescription')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Individual Balances */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('summary')}</h3>
                <div className="space-y-3">
                  {userBalances.map(balance => (
                    <div
                      key={balance.userId}
                      className={`p-4 border rounded-xl transition-all ${
                        balance.netBalance > 0.01
                          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                          : balance.netBalance < -0.01
                            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                            : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shadow-md"
                            style={{ backgroundColor: balance.userColor }}
                          >
                            {balance.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-lg">{balance.userName}</p>
                              <Badge variant="secondary" className="text-xs">
                                {balance.incomePercentage.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <span className="text-muted-foreground/70">{t('shouldPay')}:</span>
                                <span className="font-medium">$ {formatARS(balance.totalOwed)}</span>
                              </span>
                              <span className="text-muted-foreground/50">•</span>
                              <span className="flex items-center gap-1">
                                <span className="text-muted-foreground/70">{t('actuallyPaid')}:</span>
                                <span className="font-medium">$ {formatARS(balance.totalPaid)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            balance.netBalance > 0.01
                              ? 'text-green-600 dark:text-green-400'
                              : balance.netBalance < -0.01
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground'
                          }`}>
                            {balance.netBalance >= 0 ? '+' : '-'}$ {formatARS(Math.abs(balance.netBalance))}
                          </p>
                          <div className="flex items-center justify-end gap-1.5 mt-1">
                            {balance.netBalance > 0.01 ? (
                              <>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">{t('toReceive')}</span>
                              </>
                            ) : balance.netBalance < -0.01 ? (
                              <>
                                <TrendingDown className="h-4 w-4 text-red-500" />
                                <span className="text-sm font-medium text-red-600 dark:text-red-400">{t('toPay')}</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">{t('settled')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settlement Suggestions */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('settlement')}</h3>
                {isAllSettled ? (
                  <div className="text-center py-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                      <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                      {t('noSettlement')}
                    </p>
                    <p className="text-sm text-green-600/70 dark:text-green-400/70 mt-1">
                      {t('allBalanced')}
                    </p>
                  </div>
                ) : settlements.length === 0 ? (
                  <div className="text-center py-8 bg-muted/50 rounded-xl">
                    <p className="text-muted-foreground">{t('noSettlementsNeeded')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settlements.map((settlement, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shadow-md"
                            style={{ backgroundColor: settlement.fromColor }}
                          >
                            {settlement.fromName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold">{settlement.fromName}</span>
                            <p className="text-xs text-muted-foreground">{t('pays')}</p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-amber-600 dark:text-amber-400 mx-2" />
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shadow-md"
                            style={{ backgroundColor: settlement.toColor }}
                          >
                            {settlement.toName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold">{settlement.toName}</span>
                            <p className="text-xs text-muted-foreground">{t('receives')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                            $ {formatARS(settlement.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
