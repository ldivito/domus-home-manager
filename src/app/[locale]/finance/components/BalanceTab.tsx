'use client'

import { useTranslations } from 'next-intl'
import { User, ExpensePayment, MonthlyIncome } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Scale, ArrowRight, Check, TrendingUp, TrendingDown } from 'lucide-react'

interface BalanceTabProps {
  users: User[]
  payments: ExpensePayment[]
  incomes: MonthlyIncome[]
}

interface UserBalance {
  userId: string
  userName: string
  userColor: string
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

export function BalanceTab({ users, payments, incomes }: BalanceTabProps) {
  const t = useTranslations('finance.balance')

  const residents = users.filter(u => u.type === 'resident')

  // Calculate total household income
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0)

  // Get paid payments only
  const paidPayments = payments.filter(p => p.status === 'paid')

  // Calculate total expenses paid
  const totalExpensesPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0)

  // Calculate balances for each user
  const userBalances: UserBalance[] = residents.map(user => {
    // Get user's income share percentage
    const userIncome = incomes.find(inc => inc.userId === user.id)
    const percentage = totalIncome > 0 && userIncome
      ? (userIncome.amount / totalIncome) * 100
      : 0

    // Calculate what they should have paid (their share of all paid expenses)
    const totalOwed = (totalExpensesPaid * percentage) / 100

    // Calculate what they actually paid
    const totalPaid = paidPayments
      .filter(p => p.paidByUserId === user.id)
      .reduce((sum, p) => sum + p.amount, 0)

    // Net balance: positive means others owe them
    const netBalance = totalPaid - totalOwed

    return {
      userId: user.id!,
      userName: user.name,
      userColor: user.color,
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
    const debtors = balances.filter(b => b.netBalance < 0).sort((a, b) => a.netBalance - b.netBalance)
    const creditors = balances.filter(b => b.netBalance > 0).sort((a, b) => b.netBalance - a.netBalance)

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
            <h3 className="text-lg font-medium mb-2">No payments yet</h3>
            <p className="text-muted-foreground">Balances will appear once payments are recorded</p>
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
                    className="flex items-center justify-between p-4 bg-card border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: balance.userColor }}
                      >
                        {balance.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-lg">{balance.userName}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{t('totalOwed')}: ${balance.totalOwed.toFixed(2)}</span>
                          <span>•</span>
                          <span>{t('totalPaid')}: ${balance.totalPaid.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${
                        balance.netBalance > 0
                          ? 'text-green-600 dark:text-green-400'
                          : balance.netBalance < 0
                            ? 'text-red-600 dark:text-red-400'
                            : ''
                      }`}>
                        {balance.netBalance >= 0 ? '+' : ''}${balance.netBalance.toFixed(2)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {balance.netBalance > 0.01 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 dark:text-green-400">{t('owesYou')}</span>
                          </>
                        ) : balance.netBalance < -0.01 ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-600 dark:text-red-400">{t('youOwe')}</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t('settled')}</span>
                          </>
                        )}
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
                <div className="text-center py-8 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <Check className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-lg font-medium text-green-700 dark:text-green-300">
                    {t('noSettlement')}
                  </p>
                </div>
              ) : settlements.length === 0 ? (
                <div className="text-center py-8 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">No settlements needed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((settlement, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: settlement.fromColor }}
                        >
                          {settlement.fromName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{settlement.fromName}</span>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: settlement.toColor }}
                        >
                          {settlement.toName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{settlement.toName}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                          ${settlement.amount.toFixed(2)}
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
  )
}
