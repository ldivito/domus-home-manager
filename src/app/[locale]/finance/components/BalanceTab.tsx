'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, User, ExpensePayment, MonthlyIncome, MonthlyExchangeRate, RecurringExpense, SettlementPayment } from '@/lib/db'
import { formatARS, generateId } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Scale, ArrowRight, Check, TrendingUp, TrendingDown, Wallet, Receipt, PiggyBank, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface BalanceTabProps {
  users: User[]
  payments: ExpensePayment[]
  incomes: MonthlyIncome[]
  expenses: RecurringExpense[]
  exchangeRate?: MonthlyExchangeRate
  selectedMonth: number
  selectedYear: number
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

export function BalanceTab({ users, payments, incomes, expenses, exchangeRate, selectedMonth, selectedYear }: BalanceTabProps) {
  const t = useTranslations('finance.balance')
  const tMessages = useTranslations('finance.messages')

  const [showSettlementDialog, setShowSettlementDialog] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [settlementNotes, setSettlementNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const residents = users.filter(u => u.type === 'resident')
  const rate = exchangeRate?.rate || 1

  // Get settlement payments for this month
  const settlementPaymentsForMonth = useLiveQuery(
    () => db.settlementPayments
      .where('[month+year]')
      .equals([selectedMonth, selectedYear])
      .toArray(),
    [selectedMonth, selectedYear]
  ) || []

  // Filter payments for the selected month
  const monthPayments = payments.filter(p => {
    const dueDate = new Date(p.dueDate)
    return dueDate.getMonth() + 1 === selectedMonth && dueDate.getFullYear() === selectedYear
  })

  // Calculate total household income in ARS
  const totalIncomeARS = incomes.reduce((sum, inc) => {
    if (inc.currency === 'USD') {
      return sum + (inc.amount * rate)
    }
    return sum + inc.amount
  }, 0)

  // Get paid payments only (filtered by selected month)
  const paidPayments = monthPayments.filter(p => p.status === 'paid')

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

  // Check if a settlement has been paid
  const isSettlementPaid = (settlement: Settlement): boolean => {
    return settlementPaymentsForMonth.some(
      sp => sp.fromUserId === settlement.from && sp.toUserId === settlement.to
    )
  }

  // Get the settlement payment record if exists
  const getSettlementPayment = (settlement: Settlement): SettlementPayment | undefined => {
    return settlementPaymentsForMonth.find(
      sp => sp.fromUserId === settlement.from && sp.toUserId === settlement.to
    )
  }

  const isAllSettled = settlements.length === 0 && paidPayments.length > 0

  // Handle opening settlement dialog
  const handleMarkSettlementPaid = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setSettlementNotes('')
    setShowSettlementDialog(true)
  }

  // Submit settlement payment
  const handleSubmitSettlement = async () => {
    if (!selectedSettlement) return

    setIsSubmitting(true)
    try {
      await db.settlementPayments.add({
        id: generateId('sett'),
        fromUserId: selectedSettlement.from,
        toUserId: selectedSettlement.to,
        amount: selectedSettlement.amount,
        month: selectedMonth,
        year: selectedYear,
        paidDate: new Date(),
        notes: settlementNotes.trim() || undefined,
        createdAt: new Date()
      })

      toast.success(tMessages('settlementMarkedPaid'))
      setShowSettlementDialog(false)
      setSelectedSettlement(null)
      setSettlementNotes('')
    } catch (error) {
      console.error('Error saving settlement:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete settlement payment (unmark as paid)
  const handleUnmarkSettlement = async (settlementPayment: SettlementPayment) => {
    try {
      await db.settlementPayments.delete(settlementPayment.id!)
      toast.success(tMessages('settlementUnmarked'))
    } catch (error) {
      console.error('Error deleting settlement:', error)
      toast.error(tMessages('error'))
    }
  }

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
                    {settlements.map((settlement, index) => {
                      const isPaid = isSettlementPaid(settlement)
                      const settlementPayment = getSettlementPayment(settlement)

                      return (
                        <div
                          key={index}
                          className={`p-4 border rounded-xl transition-all ${
                            isPaid
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800'
                              : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
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
                              <ArrowRight className={`h-5 w-5 mx-2 ${isPaid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
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
                            <div className="text-right flex items-center gap-3">
                              <p className={`text-2xl font-bold ${isPaid ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                $ {formatARS(settlement.amount)}
                              </p>
                              {isPaid && (
                                <Badge className="bg-green-500">
                                  <Check className="h-3 w-3 mr-1" />
                                  {t('paid')}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          {isPaid ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Check className="h-4 w-4 text-green-500" />
                                {settlementPayment?.paidDate && (
                                  <span>{t('paidOn', { date: format(new Date(settlementPayment.paidDate), 'MMM d, yyyy') })}</span>
                                )}
                                {settlementPayment?.notes && (
                                  <span className="text-muted-foreground/70">• {settlementPayment.notes}</span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnmarkSettlement(settlementPayment!)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Undo2 className="h-4 w-4 mr-1" />
                                {t('unmarkPaid')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleMarkSettlementPaid(settlement)}
                              className="w-full h-11"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              {t('markSettled')}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('settlementDialog.title')}</DialogTitle>
            <DialogDescription>
              {selectedSettlement && t('settlementDialog.description', {
                from: selectedSettlement.fromName,
                to: selectedSettlement.toName,
                amount: formatARS(selectedSettlement.amount)
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedSettlement && (
              <div className="flex items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: selectedSettlement.fromColor }}
                  >
                    {selectedSettlement.fromName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{selectedSettlement.fromName}</span>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: selectedSettlement.toColor }}
                  >
                    {selectedSettlement.toName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{selectedSettlement.toName}</span>
                </div>
              </div>
            )}
            <div className="text-center">
              <p className="text-3xl font-bold">
                $ {selectedSettlement ? formatARS(selectedSettlement.amount) : 0}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('settlementDialog.notes')}</Label>
              <Input
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder={t('settlementDialog.notesPlaceholder')}
                className="h-12"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSettlementDialog(false)}
              className="h-12"
            >
              {t('settlementDialog.cancel')}
            </Button>
            <Button
              onClick={handleSubmitSettlement}
              disabled={isSubmitting}
              className="h-12"
            >
              {isSubmitting ? t('settlementDialog.confirming') : t('settlementDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
