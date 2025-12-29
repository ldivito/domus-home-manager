'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, User, MonthlyIncome, MonthlyExchangeRate, deleteWithSync } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  DollarSign,
  User as UserIcon,
  Percent,
  ArrowRightLeft,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Briefcase
} from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface IncomeTabProps {
  users: User[]
  currentIncomes: MonthlyIncome[]
  currentMonth: number
  currentYear: number
  exchangeRate?: MonthlyExchangeRate
  isFutureMonth?: boolean
  hideAmounts?: boolean
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function IncomeTab({ users, currentIncomes, currentMonth, currentYear, exchangeRate, isFutureMonth, hideAmounts: _hideAmounts }: IncomeTabProps) {
  // Note: _hideAmounts is reserved for future implementation of hiding amounts in this tab
  void _hideAmounts
  const t = useTranslations('finance.income')
  const tMessages = useTranslations('finance.messages')
  const [showDialog, setShowDialog] = useState(false)
  const [showExchangeDialog, setShowExchangeDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [editingIncome, setEditingIncome] = useState<MonthlyIncome | null>(null)
  const [deletingIncome, setDeletingIncome] = useState<MonthlyIncome | null>(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [source, setSource] = useState('')
  const [exchangeRateValue, setExchangeRateValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  const rate = exchangeRate?.rate || 1

  // Get incomes grouped by user
  const getIncomesForUser = (userId: string) => {
    return currentIncomes.filter(inc => inc.userId === userId)
  }

  // Calculate income in ARS for a single entry
  const getIncomeInARS = (income: MonthlyIncome): number => {
    if (income.currency === 'USD') {
      return income.amount * rate
    }
    return income.amount
  }

  // Calculate total income for a user in ARS
  const getUserTotalInARS = (userId: string): number => {
    const userIncomes = getIncomesForUser(userId)
    return userIncomes.reduce((sum, inc) => sum + getIncomeInARS(inc), 0)
  }

  // Calculate total household income in ARS
  const totalHouseholdIncome = currentIncomes.reduce((sum, inc) => sum + getIncomeInARS(inc), 0)

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedUsers(newExpanded)
  }

  const handleOpenAddDialog = (userId: string) => {
    setSelectedUserId(userId)
    setEditingIncome(null)
    setAmount('')
    setCurrency('ARS')
    setSource('')
    setShowDialog(true)
  }

  const handleOpenEditDialog = (income: MonthlyIncome) => {
    setSelectedUserId(income.userId)
    setEditingIncome(income)
    setAmount(income.amount.toString())
    setCurrency(income.currency || 'ARS')
    setSource(income.source || '')
    setShowDialog(true)
  }

  const handleOpenDeleteDialog = (income: MonthlyIncome) => {
    setDeletingIncome(income)
    setShowDeleteDialog(true)
  }

  const handleOpenExchangeDialog = () => {
    setExchangeRateValue(exchangeRate?.rate?.toString() || '')
    setShowExchangeDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !amount || !source) return

    setIsSubmitting(true)
    try {
      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum < 0) {
        toast.error(t('dialog.invalidAmount'))
        return
      }

      if (editingIncome) {
        // Update existing
        await db.monthlyIncomes.update(editingIncome.id!, {
          amount: amountNum,
          currency: currency,
          source: source,
          updatedAt: new Date()
        })
        toast.success(tMessages('incomeUpdated'))
      } else {
        // Create new
        await db.monthlyIncomes.add({
          id: generateId('inc'),
          userId: selectedUserId,
          amount: amountNum,
          currency: currency,
          source: source,
          month: currentMonth,
          year: currentYear,
          createdAt: new Date()
        })
        toast.success(tMessages('incomeAdded'))
      }

      setShowDialog(false)
      setSelectedUserId('')
      setEditingIncome(null)
      setAmount('')
      setCurrency('ARS')
      setSource('')
    } catch (error) {
      logger.error('Error saving income:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingIncome) return

    setIsSubmitting(true)
    try {
      await deleteWithSync(db.monthlyIncomes, 'monthlyIncomes', deletingIncome.id!)
      toast.success(t('incomeDeleted'))
      setShowDeleteDialog(false)
      setDeletingIncome(null)
    } catch (error) {
      logger.error('Error deleting income:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExchangeRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exchangeRateValue) return

    setIsSubmitting(true)
    try {
      const rateNum = parseFloat(exchangeRateValue)
      if (isNaN(rateNum) || rateNum <= 0) {
        toast.error('Please enter a valid exchange rate')
        return
      }

      if (exchangeRate?.id) {
        // Update existing
        await db.monthlyExchangeRates.update(exchangeRate.id, {
          rate: rateNum,
          updatedAt: new Date()
        })
      } else {
        // Create new
        await db.monthlyExchangeRates.add({
          id: generateId('exr'),
          rate: rateNum,
          month: currentMonth,
          year: currentYear,
          createdAt: new Date()
        })
      }

      toast.success(t('exchangeRateUpdated'))
      setShowExchangeDialog(false)
      setExchangeRateValue('')
    } catch (error) {
      logger.error('Error saving exchange rate:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const residentUsers = users.filter(u => u.type === 'resident')

  return (
    <>
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
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

          {/* Current Month Header */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-muted/50 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('currentMonth')}</p>
                <p className="text-xl sm:text-2xl font-bold">{monthNames[currentMonth - 1]} {currentYear}</p>
                <p className="text-sm sm:text-lg text-muted-foreground mt-1">
                  {t('totalHousehold')}: <span className="font-semibold text-foreground">$ {formatARS(totalHouseholdIncome)}</span>
                  {rate > 1 && (
                    <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-muted-foreground/70">
                      (USD {formatARS(totalHouseholdIncome / rate)})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end">
                <Button
                  variant="outline"
                  onClick={handleOpenExchangeDialog}
                  className="h-9 sm:h-10 w-full sm:w-auto text-sm"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                  {t('exchangeRate')}
                </Button>
                <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
                  {rate > 1 ? (
                    <span>1 USD = $ {formatARS(rate)} ARS</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">{t('noExchangeRate')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {residentUsers.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <UserIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">{t('noIncome')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('noIncomeDescription')}</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {residentUsers.map(user => {
                const userIncomes = getIncomesForUser(user.id!)
                const userTotalARS = getUserTotalInARS(user.id!)
                const percentage = totalHouseholdIncome > 0
                  ? ((userTotalARS / totalHouseholdIncome) * 100).toFixed(1)
                  : '0'
                const isExpanded = expandedUsers.has(user.id!) || userIncomes.length === 0

                return (
                  <div
                    key={user.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* User Header */}
                    <div
                      className={`p-3 sm:p-4 bg-card transition-colors ${userIncomes.length > 0 && !isFutureMonth ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                      onClick={userIncomes.length > 0 ? () => toggleUserExpanded(user.id!) : undefined}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* User info */}
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-base sm:text-lg">{user.name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {userIncomes.length > 0 ? (
                                <span className="text-xs sm:text-sm text-muted-foreground">
                                  {t('entries', { count: userIncomes.length })} · {t('share')}: {percentage}%
                                </span>
                              ) : (
                                <span className="text-xs sm:text-sm text-muted-foreground">{t('noIncomeSet')}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Amount and expand */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-13 sm:pl-0">
                          <div className="text-left sm:text-right">
                            <p className="text-xl sm:text-2xl font-bold">
                              $ {formatARS(userTotalARS)}
                            </p>
                            {rate > 1 && userTotalARS > 0 && (
                              <p className="text-xs sm:text-sm text-muted-foreground/70">
                                USD {formatARS(userTotalARS / rate)}
                              </p>
                            )}
                            {userIncomes.length > 0 && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                <Percent className="h-3 w-3 mr-1" />
                                {percentage}%
                              </Badge>
                            )}
                          </div>
                          {userIncomes.length > 0 && (
                            <div className="text-muted-foreground">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" />
                              ) : (
                                <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Income Entries List */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20">
                        {userIncomes.length > 0 ? (
                          <div className="divide-y">
                            {userIncomes.map(income => {
                              const incomeARS = getIncomeInARS(income)
                              return (
                                <div
                                  key={income.id}
                                  className="p-3 sm:p-4 hover:bg-muted/30"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                      <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm sm:text-base truncate">{income.source}</p>
                                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                                          <Badge variant="outline" className="text-xs">
                                            {income.currency}
                                          </Badge>
                                          {income.currency === 'USD' && rate > 1 && (
                                            <span>USD {formatARS(income.amount)}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-6 sm:pl-0">
                                      <div className="text-left sm:text-right">
                                        <p className="font-semibold text-base sm:text-lg">
                                          $ {formatARS(incomeARS)}
                                        </p>
                                        {income.currency === 'USD' && rate > 1 && (
                                          <p className="text-xs text-muted-foreground">
                                            = USD {formatARS(income.amount)}
                                          </p>
                                        )}
                                      </div>
                                      {!isFutureMonth && (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 sm:h-9 sm:w-9"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleOpenEditDialog(income)
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleOpenDeleteDialog(income)
                                            }}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}

                        {/* Add Income Button */}
                        {!isFutureMonth && (
                          <div className="p-3 sm:p-4 border-t">
                            <Button
                              variant="outline"
                              className="w-full h-10 sm:h-12 text-sm"
                              onClick={() => handleOpenAddDialog(user.id!)}
                            >
                              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                              {t('addIncome')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Total Summary */}
          {currentIncomes.length > 0 && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t('totalSummary')}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {currentIncomes.length} {t('totalEntries')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl sm:text-3xl font-bold text-primary">
                    $ {formatARS(totalHouseholdIncome)}
                  </p>
                  {rate > 1 && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      USD {formatARS(totalHouseholdIncome / rate)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Income Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingIncome ? t('dialog.editTitle') : t('dialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('dialog.description', { month: monthNames[currentMonth - 1], year: currentYear })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="source" className="text-base">{t('dialog.source')}</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t('dialog.sourcePlaceholder')}
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency" className="text-base">{t('dialog.currency')}</Label>
              <Select value={currency} onValueChange={(val) => setCurrency(val as 'ARS' | 'USD')}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">ARS</span>
                      <span className="text-muted-foreground">- {t('dialog.argentinePeso')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="USD">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">USD</span>
                      <span className="text-muted-foreground">- {t('dialog.usDollar')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {currency === 'USD' && rate > 1 && (
                <p className="text-sm text-muted-foreground">
                  {t('dialog.willBeConverted', { rate: formatARS(rate) })}
                </p>
              )}
              {currency === 'USD' && rate <= 1 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t('dialog.setExchangeRateFirst')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-base">{t('dialog.amount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  {currency === 'USD' ? 'USD' : '$'}
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t('dialog.amountPlaceholder')}
                  className="h-12 pl-12 text-lg"
                  required
                />
              </div>
              {currency === 'USD' && amount && rate > 1 && (
                <p className="text-sm text-muted-foreground">
                  = $ {formatARS(parseFloat(amount) * rate)} ARS
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="h-12"
              >
                {t('dialog.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !source || !amount}
                className="h-12"
              >
                {isSubmitting ? t('dialog.saving') : t('dialog.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t('deleteDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description', { source: deletingIncome?.source || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="h-12"
            >
              {t('deleteDialog.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="h-12"
            >
              {isSubmitting ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exchange Rate Dialog */}
      <Dialog open={showExchangeDialog} onOpenChange={setShowExchangeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              {t('exchangeDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('exchangeDialog.description', { month: monthNames[currentMonth - 1], year: currentYear })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleExchangeRateSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="exchangeRate" className="text-base">
                {t('exchangeDialog.rate')}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground whitespace-nowrap">1 USD =</span>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={exchangeRateValue}
                  onChange={(e) => setExchangeRateValue(e.target.value)}
                  placeholder={t('exchangeDialog.ratePlaceholder')}
                  className="h-12 text-lg"
                  required
                />
                <span className="text-muted-foreground whitespace-nowrap">ARS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('exchangeDialog.hint')}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowExchangeDialog(false)}
                className="h-12"
              >
                {t('dialog.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !exchangeRateValue}
                className="h-12"
              >
                {isSubmitting ? t('dialog.saving') : t('dialog.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
