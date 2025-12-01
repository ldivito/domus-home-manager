'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, User, MonthlyIncome, MonthlyExchangeRate } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, DollarSign, User as UserIcon, Percent, ArrowRightLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface IncomeTabProps {
  users: User[]
  currentIncomes: MonthlyIncome[]
  currentMonth: number
  currentYear: number
  exchangeRate?: MonthlyExchangeRate
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function IncomeTab({ users, currentIncomes, currentMonth, currentYear, exchangeRate }: IncomeTabProps) {
  const t = useTranslations('finance.income')
  const tMessages = useTranslations('finance.messages')
  const [showDialog, setShowDialog] = useState(false)
  const [showExchangeDialog, setShowExchangeDialog] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [exchangeRateValue, setExchangeRateValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const rate = exchangeRate?.rate || 1

  // Calculate total income in ARS
  const totalIncome = currentIncomes.reduce((sum, inc) => {
    if (inc.currency === 'USD') {
      return sum + (inc.amount * rate)
    }
    return sum + inc.amount
  }, 0)

  // Get user income map
  const userIncomeMap = new Map<string, MonthlyIncome>()
  currentIncomes.forEach(inc => {
    userIncomeMap.set(inc.userId, inc)
  })

  // Calculate income in ARS for a user
  const getIncomeInARS = (income: MonthlyIncome | undefined): number => {
    if (!income) return 0
    if (income.currency === 'USD') {
      return income.amount * rate
    }
    return income.amount
  }

  const handleOpenDialog = (userId?: string) => {
    if (userId) {
      setSelectedUserId(userId)
      const existing = userIncomeMap.get(userId)
      if (existing) {
        setAmount(existing.amount.toString())
        setCurrency(existing.currency || 'ARS')
      } else {
        setAmount('')
        setCurrency('ARS')
      }
    } else {
      setSelectedUserId('')
      setAmount('')
      setCurrency('ARS')
    }
    setShowDialog(true)
  }

  const handleOpenExchangeDialog = () => {
    setExchangeRateValue(exchangeRate?.rate?.toString() || '')
    setShowExchangeDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !amount) return

    setIsSubmitting(true)
    try {
      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum < 0) {
        toast.error('Please enter a valid amount')
        return
      }

      const existing = userIncomeMap.get(selectedUserId)

      if (existing) {
        // Update existing
        await db.monthlyIncomes.update(existing.id!, {
          amount: amountNum,
          currency: currency,
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
          month: currentMonth,
          year: currentYear,
          createdAt: new Date()
        })
        toast.success(tMessages('incomeAdded'))
      }

      setShowDialog(false)
      setSelectedUserId('')
      setAmount('')
      setCurrency('ARS')
    } catch (error) {
      console.error('Error saving income:', error)
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
      console.error('Error saving exchange rate:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                {t('title')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('subtitle')}
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="h-12 px-6">
              <Plus className="h-5 w-5 mr-2" />
              {t('setIncome')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Current Month Header */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">{t('currentMonth')}</p>
                <p className="text-2xl font-bold">{monthNames[currentMonth - 1]} {currentYear}</p>
                <p className="text-lg text-muted-foreground mt-1">
                  {t('totalHousehold')}: <span className="font-semibold text-foreground">$ {formatARS(totalIncome)}</span>
                </p>
              </div>
              <div className="text-right">
                <Button
                  variant="outline"
                  onClick={handleOpenExchangeDialog}
                  className="h-10"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  {t('exchangeRate')}
                </Button>
                <div className="mt-2 text-sm text-muted-foreground">
                  {rate > 1 ? (
                    <span>1 USD = $ {formatARS(rate)} ARS</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">{t('noExchangeRate')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noIncome')}</h3>
              <p className="text-muted-foreground mb-4">{t('noIncomeDescription')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.filter(u => u.type === 'resident').map(user => {
                const income = userIncomeMap.get(user.id!)
                const incomeInARS = getIncomeInARS(income)
                const percentage = totalIncome > 0 && income
                  ? ((incomeInARS / totalIncome) * 100).toFixed(1)
                  : '0'

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleOpenDialog(user.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-lg">{user.name}</p>
                        <div className="flex items-center gap-2">
                          {income ? (
                            <>
                              <span className="text-sm text-muted-foreground">
                                {t('share')}: {percentage}%
                              </span>
                              {income.currency === 'USD' && (
                                <Badge variant="secondary" className="text-xs">
                                  USD {formatARS(income.amount)}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">{t('noIncomeSet')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        $ {formatARS(incomeInARS)}
                      </p>
                      {income && (
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <Badge variant="secondary">
                            <Percent className="h-3 w-3 mr-1" />
                            {percentage}%
                          </Badge>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set Income Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('dialog.description', { month: monthNames[currentMonth - 1], year: currentYear })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="user" className="text-base">{t('dialog.selectUser')}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t('dialog.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.type === 'resident').map(user => (
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
                disabled={isSubmitting || !selectedUserId || !amount}
                className="h-12"
              >
                {isSubmitting ? t('dialog.saving') : t('dialog.save')}
              </Button>
            </DialogFooter>
          </form>
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
