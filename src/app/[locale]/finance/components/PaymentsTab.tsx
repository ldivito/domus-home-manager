'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { db, RecurringExpense, ExpensePayment, User, MonthlyIncome, MonthlyExchangeRate, deleteWithSync } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { resolveDefaultForMonth } from '@/lib/utils/finance/monthlyValues'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, Check, Clock, AlertTriangle, Trash2, MoreHorizontal, Undo2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { logger } from '@/lib/logger'

interface PaymentsTabProps {
  expenses: RecurringExpense[]
  payments: ExpensePayment[]
  users: User[]
  incomes: MonthlyIncome[]
  currentMonth: number
  currentYear: number
  exchangeRate?: MonthlyExchangeRate
  isFutureMonth?: boolean
  hideAmounts?: boolean
}

export function PaymentsTab({
  expenses,
  payments,
  users,
  incomes,
  currentMonth,
  currentYear,
  exchangeRate,
  isFutureMonth,
  hideAmounts: _hideAmounts
}: PaymentsTabProps) {
  // Note: _hideAmounts is reserved for future implementation
  void _hideAmounts
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
  // Serialize generation runs so overlapping effect invocations can't race each other
  const generationLockRef = useRef<Promise<void>>(Promise.resolve())

  // Exchange rate for the selected month; null when not configured (never assume 1)
  const rate = exchangeRate?.rate ?? null

  // Convert an amount to ARS; null when it's USD and the month has no exchange rate
  const toARS = (amount: number, currency?: 'ARS' | 'USD'): number | null => {
    if ((currency ?? 'ARS') === 'ARS') return amount
    return rate != null ? amount * rate : null
  }

  // Calculate total income in ARS for percentage (USD incomes without a rate are excluded)
  const totalIncomeARS = incomes.reduce((sum, inc) => {
    const amountARS = toARS(inc.amount, inc.currency)
    return amountARS != null ? sum + amountARS : sum
  }, 0)

  // Get user income percentage (based on ARS values)
  const getUserPercentage = (userId: string) => {
    const userIncome = incomes.find(inc => inc.userId === userId)
    if (!userIncome || totalIncomeARS === 0) return 0
    const userIncomeARS = toARS(userIncome.amount, userIncome.currency)
    if (userIncomeARS == null) return 0
    return (userIncomeARS / totalIncomeARS) * 100
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

        try {
          // Check-and-insert atomically against Dexie using the month/year/expense
          // key, instead of the `payments` prop (which can be a stale/empty snapshot
          // while the live query or a sync pull is still resolving)
          await db.transaction('rw', db.expensePayments, async () => {
            const existingPayment = await db.expensePayments
              .where('[recurringExpenseId+year+month]')
              .equals([expense.id!, currentYear, currentMonth])
              .first()

            if (existingPayment) return

            // Clamp the day so short months don't roll the due date into the next month
            const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
            const dueDate = new Date(currentYear, currentMonth - 1, Math.min(expense.dueDay, daysInMonth))

            // Determine status
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            let status: 'pending' | 'paid' | 'overdue' = 'pending'
            if (dueDate < today) {
              status = 'overdue'
            }

            // Seed from the freshest data in Dexie, not the possibly-stale prop
            const storedPayments = await db.expensePayments.toArray()
            const seed = resolveDefaultForMonth(expense, currentMonth, currentYear, storedPayments)
            await db.expensePayments.add({
              id: generateId('pay'),
              recurringExpenseId: expense.id!,
              amount: seed.amount,
              currency: seed.currency,
              month: currentMonth,
              year: currentYear,
              dueDate,
              status,
              createdAt: new Date()
            })
          })
          generatedPaymentsRef.current.add(paymentKey)
        } catch (error) {
          // Not added to the generated set so it can be retried
          logger.error('Error generating payment:', error)
        }
      }
    }

    if (expenses.length > 0) {
      // Chain runs so a new effect invocation waits for the previous one to finish
      generationLockRef.current = generationLockRef.current
        .then(generatePayments)
        .catch((error) => logger.error('Error generating payments:', error))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, currentMonth, currentYear]) // Existence is checked against Dexie, not the payments prop

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

  // Filter payments for current month: month/year fields are the source of truth
  // (dueDate can overflow into the next month for dueDay 29-31 in short months);
  // fall back to dueDate only for legacy records synced without month/year
  const currentMonthPayments = payments.filter(p => {
    if (p.month != null && p.year != null) {
      return p.month === currentMonth && p.year === currentYear
    }
    const dueDate = new Date(p.dueDate)
    return dueDate.getMonth() + 1 === currentMonth && dueDate.getFullYear() === currentYear
  })

  // USD data present but no exchange rate configured for this month
  const hasMissingRateUSD = rate == null && (
    incomes.some(inc => inc.currency === 'USD') ||
    currentMonthPayments.some(p => p.currency === 'USD')
  )

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
    setSelectedPayment(payment)
    setActualAmount(payment.amount.toString())
    setPaidByUserId('')
    setNotes('')
    setShowMarkPaidDialog(true)
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPayment || !paidByUserId) return

    // Validate explicitly: `|| fallback` would silently discard an intentional 0
    const parsedAmount = parseFloat(actualAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error(t('dialog.invalidAmount'))
      return
    }

    setIsSubmitting(true)
    try {
      await db.expensePayments.update(selectedPayment.id!, {
        status: 'paid',
        paidByUserId,
        paidDate: new Date(),
        amount: parsedAmount,
        notes: notes.trim() || undefined,
        updatedAt: new Date()
      })

      toast.success(tMessages('paymentMarkedPaid'))
      setShowMarkPaidDialog(false)
      setSelectedPayment(null)
    } catch (error) {
      logger.error('Error marking payment:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deleteWithSync(db.expensePayments, 'expensePayments', paymentId)
      toast.success(tMessages('paymentDeleted'))
    } catch (error) {
      logger.error('Error deleting payment:', error)
      toast.error(tMessages('error'))
    }
  }

  const handleUnmarkPaid = async (payment: ExpensePayment) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDate = new Date(payment.dueDate)
      dueDate.setHours(0, 0, 0, 0)

      const newStatus = dueDate < today ? 'overdue' : 'pending'

      await db.expensePayments.update(payment.id!, {
        status: newStatus,
        paidByUserId: undefined,
        paidDate: undefined,
        notes: undefined,
        updatedAt: new Date()
      })
      toast.success(tMessages('paymentUnmarked'))
    } catch (error) {
      logger.error('Error unmarking payment:', error)
      toast.error(tMessages('error'))
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
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
                {t('title')}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t('subtitle')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Future Month Notice */}
          {isFutureMonth && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                {t('futureMonthNotice')}
              </p>
            </div>
          )}

          {/* Missing Exchange Rate Notice */}
          {hasMissingRateUSD && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                {t('missingRateWarning')}
              </p>
            </div>
          )}

          {/* Status Summary */}
          <div className="mb-4 sm:mb-6 p-2 sm:p-4 bg-muted/50 rounded-lg overflow-x-auto">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
              <Button
                variant={filter === 'all' ? 'default' : 'ghost'}
                onClick={() => setFilter('all')}
                className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
              >
                {t('filter.all')} ({currentMonthPayments.length})
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'ghost'}
                onClick={() => setFilter('pending')}
                className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
              >
                {t('filter.pending')} ({pendingCount})
              </Button>
              <Button
                variant={filter === 'overdue' ? 'default' : 'ghost'}
                onClick={() => setFilter('overdue')}
                className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
              >
                {t('filter.overdue')} ({overdueCount})
              </Button>
              <Button
                variant={filter === 'paid' ? 'default' : 'ghost'}
                onClick={() => setFilter('paid')}
                className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
              >
                {t('filter.paid')} ({paidCount})
              </Button>
            </div>
          </div>

          {sortedPayments.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Calendar className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">{t('noPayments')}</h3>
              <p className="text-sm text-muted-foreground">{t('noPaymentsDescription')}</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {sortedPayments.map(payment => {
                const expense = getExpense(payment.recurringExpenseId)
                const amountARS = toARS(payment.amount, payment.currency)

                return (
                  <div
                    key={payment.id}
                    className={`p-3 sm:p-4 border rounded-lg ${payment.status === 'overdue' ? 'border-destructive/50 bg-destructive/5' : ''}`}
                  >
                    {/* Header: Name, amount, status */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-base sm:text-lg truncate">{getExpenseName(payment.recurringExpenseId)}</p>
                            {!expense && (
                              <Badge variant="outline" className="text-[10px] sm:text-xs text-amber-600 border-amber-600 shrink-0">
                                {t('expenseDeleted')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                            <span>{t('dueDate', { date: format(new Date(payment.dueDate), 'MMM d, yyyy') })}</span>
                            {expense?.currency === 'USD' && (
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                USD {formatARS(expense.amount)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                        <div className="text-left sm:text-right">
                          {amountARS != null ? (
                            <>
                              <p className="text-xl sm:text-2xl font-bold">$ {formatARS(amountARS)}</p>
                              {rate != null && (
                                <p className="text-xs sm:text-sm text-muted-foreground/70">
                                  USD {formatARS(amountARS / rate)}
                                </p>
                              )}
                            </>
                          ) : (
                            // USD payment without an exchange rate for the month: show in USD
                            <p className="text-xl sm:text-2xl font-bold">USD {formatARS(payment.amount)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          {getStatusBadge(payment.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                                <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {payment.status === 'paid' && (
                                <DropdownMenuItem onClick={() => handleUnmarkPaid(payment)}>
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  {t('unmarkPaid')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeletePayment(payment.id!)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    {/* Split breakdown (needs an ARS amount, so skipped for USD payments without a rate) */}
                    {totalIncomeARS > 0 && amountARS != null && (
                      <div className="mb-3 p-2 sm:p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs sm:text-sm font-medium mb-2">{t('split')}:</p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {residents.map(user => {
                            const percentage = getUserPercentage(user.id!)
                            const share = (amountARS * percentage) / 100
                            return (
                              <div
                                key={user.id}
                                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-background rounded-full"
                              >
                                <div
                                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: user.color }}
                                />
                                <span className="text-xs sm:text-sm">{user.name}</span>
                                <span className="text-xs sm:text-sm font-medium">$ {formatARS(share)}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground">({percentage.toFixed(0)}%)</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Paid info or Mark as Paid button */}
                    {payment.status === 'paid' ? (
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                        <span>{t('paidBy', { name: getUserName(payment.paidByUserId!) })}</span>
                        {payment.paidDate && (
                          <span>• {t('paidOn', { date: format(new Date(payment.paidDate), 'MMM d') })}</span>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleMarkPaid(payment)}
                        variant={payment.status === 'overdue' ? 'destructive' : 'default'}
                        className="w-full h-10 sm:h-12 text-sm"
                        disabled={isFutureMonth}
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
                {/* Show the payment's stored currency so USD amounts aren't typed in ARS */}
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  {(selectedPayment?.currency ?? 'ARS') === 'USD' ? 'USD' : '$'}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualAmount}
                  onChange={(e) => setActualAmount(e.target.value)}
                  className={`h-12 ${(selectedPayment?.currency ?? 'ARS') === 'USD' ? 'pl-14' : 'pl-8'}`}
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
