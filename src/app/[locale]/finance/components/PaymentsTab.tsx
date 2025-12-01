'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { db, RecurringExpense, ExpensePayment, User, MonthlyIncome, MonthlyExchangeRate } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, Check, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface PaymentsTabProps {
  expenses: RecurringExpense[]
  payments: ExpensePayment[]
  users: User[]
  incomes: MonthlyIncome[]
  currentMonth: number
  currentYear: number
  exchangeRate?: MonthlyExchangeRate
}

export function PaymentsTab({
  expenses,
  payments,
  users,
  incomes,
  currentMonth,
  currentYear,
  exchangeRate
}: PaymentsTabProps) {
  const t = useTranslations('finance.payments')
  const tMessages = useTranslations('finance.messages')

  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<ExpensePayment | null>(null)
  const [paidByUserId, setPaidByUserId] = useState('')
  const [actualAmount, setActualAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all')

  // Track which payments we've already generated to prevent duplicates
  const generatedPaymentsRef = useRef<Set<string>>(new Set())

  const rate = exchangeRate?.rate || 1

  // Calculate total income in ARS for percentage
  const totalIncomeARS = incomes.reduce((sum, inc) => {
    if (inc.currency === 'USD') {
      return sum + (inc.amount * rate)
    }
    return sum + inc.amount
  }, 0)

  // Get user income percentage (based on ARS values)
  const getUserPercentage = (userId: string) => {
    const userIncome = incomes.find(inc => inc.userId === userId)
    if (!userIncome || totalIncomeARS === 0) return 0
    const userIncomeARS = userIncome.currency === 'USD'
      ? userIncome.amount * rate
      : userIncome.amount
    return (userIncomeARS / totalIncomeARS) * 100
  }

  // Get expense amount in ARS
  const getExpenseAmountARS = (expense: RecurringExpense | undefined): number => {
    if (!expense) return 0
    if (expense.currency === 'USD') {
      return expense.amount * rate
    }
    return expense.amount
  }

  // Auto-generate payments for active expenses (only once per expense per month)
  useEffect(() => {
    const generatePayments = async () => {
      const activeExpenses = expenses.filter(e => e.isActive)

      for (const expense of activeExpenses) {
        const paymentKey = `${expense.id}-${currentMonth}-${currentYear}`

        // Skip if we already generated this payment in this session
        if (generatedPaymentsRef.current.has(paymentKey)) {
          continue
        }

        // Check if payment already exists in database for this month
        const existingPayment = payments.find(p =>
          p.recurringExpenseId === expense.id &&
          new Date(p.dueDate).getMonth() + 1 === currentMonth &&
          new Date(p.dueDate).getFullYear() === currentYear
        )

        if (!existingPayment) {
          // Mark as generated before adding to prevent race conditions
          generatedPaymentsRef.current.add(paymentKey)

          // Create payment for this month
          const dueDate = new Date(currentYear, currentMonth - 1, expense.dueDay)

          // Determine status
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          let status: 'pending' | 'paid' | 'overdue' = 'pending'
          if (dueDate < today) {
            status = 'overdue'
          }

          try {
            await db.expensePayments.add({
              id: generateId('pay'),
              recurringExpenseId: expense.id!,
              amount: expense.amount,
              dueDate,
              status,
              createdAt: new Date()
            })
          } catch (error) {
            // If add fails, remove from generated set so it can be retried
            generatedPaymentsRef.current.delete(paymentKey)
            console.error('Error generating payment:', error)
          }
        } else {
          // Mark as generated since it already exists
          generatedPaymentsRef.current.add(paymentKey)
        }
      }
    }

    if (expenses.length > 0) {
      generatePayments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, currentMonth, currentYear]) // Intentionally excluding payments to prevent infinite loops

  // Update overdue status
  useEffect(() => {
    const updateOverdueStatus = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const pendingPayments = payments.filter(p => p.status === 'pending')

      for (const payment of pendingPayments) {
        const dueDate = new Date(payment.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        if (dueDate < today) {
          await db.expensePayments.update(payment.id!, { status: 'overdue' })
        }
      }
    }

    updateOverdueStatus()
  }, [payments])

  // Filter payments for current month
  const currentMonthPayments = payments.filter(p => {
    const dueDate = new Date(p.dueDate)
    return dueDate.getMonth() + 1 === currentMonth && dueDate.getFullYear() === currentYear
  })

  // Apply filter
  const filteredPayments = currentMonthPayments.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  // Sort by due date
  const sortedPayments = [...filteredPayments].sort((a, b) =>
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )

  const handleMarkPaid = (payment: ExpensePayment) => {
    const expense = expenses.find(e => e.id === payment.recurringExpenseId)
    const amountARS = expense ? getExpenseAmountARS(expense) : payment.amount
    setSelectedPayment(payment)
    setActualAmount(amountARS.toString())
    setPaidByUserId('')
    setNotes('')
    setShowMarkPaidDialog(true)
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPayment || !paidByUserId) return

    setIsSubmitting(true)
    try {
      await db.expensePayments.update(selectedPayment.id!, {
        status: 'paid',
        paidByUserId,
        paidDate: new Date(),
        amount: parseFloat(actualAmount) || selectedPayment.amount,
        notes: notes.trim() || undefined,
        updatedAt: new Date()
      })

      toast.success(tMessages('paymentMarkedPaid'))
      setShowMarkPaidDialog(false)
      setSelectedPayment(null)
    } catch (error) {
      console.error('Error marking payment:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const getExpense = (expenseId: string) => {
    return expenses.find(e => e.id === expenseId)
  }

  const getExpenseName = (expenseId: string) => {
    const expense = getExpense(expenseId)
    return expense?.name || 'Unknown'
  }

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user?.name || 'Unknown'
  }

  const getStatusBadge = (status: ExpensePayment['status']) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />{t('paid')}</Badge>
      case 'overdue':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{t('overdue')}</Badge>
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{t('pending')}</Badge>
    }
  }

  // Count by status
  const pendingCount = currentMonthPayments.filter(p => p.status === 'pending').length
  const overdueCount = currentMonthPayments.filter(p => p.status === 'overdue').length
  const paidCount = currentMonthPayments.filter(p => p.status === 'paid').length

  const residents = users.filter(u => u.type === 'resident')

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                {t('title')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('subtitle')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Status Summary */}
          <div className="flex items-center gap-2 mb-6 p-4 bg-muted/50 rounded-lg flex-wrap">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              onClick={() => setFilter('all')}
              className="h-10"
            >
              {t('filter.all')} ({currentMonthPayments.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'ghost'}
              onClick={() => setFilter('pending')}
              className="h-10"
            >
              {t('filter.pending')} ({pendingCount})
            </Button>
            <Button
              variant={filter === 'overdue' ? 'default' : 'ghost'}
              onClick={() => setFilter('overdue')}
              className="h-10"
            >
              {t('filter.overdue')} ({overdueCount})
            </Button>
            <Button
              variant={filter === 'paid' ? 'default' : 'ghost'}
              onClick={() => setFilter('paid')}
              className="h-10"
            >
              {t('filter.paid')} ({paidCount})
            </Button>
          </div>

          {sortedPayments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noPayments')}</h3>
              <p className="text-muted-foreground">{t('noPaymentsDescription')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPayments.map(payment => {
                const expense = getExpense(payment.recurringExpenseId)
                const amountARS = expense ? getExpenseAmountARS(expense) : payment.amount

                return (
                  <div
                    key={payment.id}
                    className={`p-4 border rounded-lg ${payment.status === 'overdue' ? 'border-destructive/50 bg-destructive/5' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-lg">{getExpenseName(payment.recurringExpenseId)}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{t('dueDate', { date: format(new Date(payment.dueDate), 'MMM d, yyyy') })}</span>
                            {expense?.currency === 'USD' && (
                              <Badge variant="secondary" className="text-xs">
                                USD {formatARS(expense.amount)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-2xl font-bold">$ {formatARS(amountARS)}</p>
                        {getStatusBadge(payment.status)}
                      </div>
                    </div>

                    {/* Split breakdown */}
                    {totalIncomeARS > 0 && (
                      <div className="mb-3 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium mb-2">{t('split')}:</p>
                        <div className="flex flex-wrap gap-2">
                          {residents.map(user => {
                            const percentage = getUserPercentage(user.id!)
                            const share = (amountARS * percentage) / 100
                            return (
                              <div
                                key={user.id}
                                className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-full"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: user.color }}
                                />
                                <span className="text-sm">{user.name}</span>
                                <span className="text-sm font-medium">$ {formatARS(share)}</span>
                                <span className="text-xs text-muted-foreground">({percentage.toFixed(0)}%)</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Paid info or Mark as Paid button */}
                    {payment.status === 'paid' ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-green-500" />
                        {t('paidBy', { name: getUserName(payment.paidByUserId!) })}
                        {payment.paidDate && (
                          <span>• {t('paidOn', { date: format(new Date(payment.paidDate), 'MMM d') })}</span>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleMarkPaid(payment)}
                        variant={payment.status === 'overdue' ? 'destructive' : 'default'}
                        className="w-full h-12"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        {t('markPaid')}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark as Paid Dialog */}
      <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('dialog.title')}</DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('dialog.paidBy')}</Label>
              <Select value={paidByUserId} onValueChange={setPaidByUserId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t('dialog.selectPayer')} />
                </SelectTrigger>
                <SelectContent>
                  {residents.map(user => (
                    <SelectItem key={user.id} value={user.id!}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: user.color }}
                        />
                        {user.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('dialog.actualAmount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualAmount}
                  onChange={(e) => setActualAmount(e.target.value)}
                  className="h-12 pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('dialog.notes')}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('dialog.notesPlaceholder')}
                className="h-12"
              />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMarkPaidDialog(false)}
                className="h-12"
              >
                {t('dialog.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !paidByUserId}
                className="h-12"
              >
                {isSubmitting ? t('dialog.confirming') : t('dialog.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
