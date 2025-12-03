'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, RecurringExpense, ExpenseCategory, MonthlyExchangeRate, deleteWithSync } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Receipt, Trash2, Edit, Home, Zap, Wifi, Shield, FileText, Tv, Wrench, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'

interface ExpensesTabProps {
  expenses: RecurringExpense[]
  categories: ExpenseCategory[]
  exchangeRate?: MonthlyExchangeRate
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Zap,
  Wifi,
  Shield,
  FileText,
  Tv,
  Wrench,
  MoreHorizontal
}

const frequencies = ['monthly', 'bimonthly', 'quarterly', 'yearly'] as const

export function ExpensesTab({ expenses, categories, exchangeRate }: ExpensesTabProps) {
  const t = useTranslations('finance.expenses')
  const tCat = useTranslations('finance.defaultExpenseCategories')
  const tMessages = useTranslations('finance.messages')
  const tIncome = useTranslations('finance.income')

  const [showDialog, setShowDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [category, setCategory] = useState('')
  const [frequency, setFrequency] = useState<typeof frequencies[number]>('monthly')
  const [dueDay, setDueDay] = useState('1')

  const rate = exchangeRate?.rate || 1

  // Calculate expense in ARS
  const getAmountInARS = (expense: RecurringExpense): number => {
    if (expense.currency === 'USD') {
      return expense.amount * rate
    }
    return expense.amount
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setAmount('')
    setCurrency('ARS')
    setCategory('')
    setFrequency('monthly')
    setDueDay('1')
    setEditingExpense(null)
  }

  const handleOpenDialog = (expense?: RecurringExpense) => {
    if (expense) {
      setEditingExpense(expense)
      setName(expense.name)
      setDescription(expense.description || '')
      setAmount(expense.amount.toString())
      setCurrency(expense.currency || 'ARS')
      setCategory(expense.category)
      setFrequency(expense.frequency)
      setDueDay(expense.dueDay.toString())
    } else {
      resetForm()
    }
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !amount || !category) return

    setIsSubmitting(true)
    try {
      const amountNum = parseFloat(amount)
      const dueDayNum = parseInt(dueDay)

      if (isNaN(amountNum) || amountNum <= 0) {
        toast.error('Please enter a valid amount')
        return
      }

      if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
        toast.error('Please enter a valid day (1-31)')
        return
      }

      if (editingExpense) {
        await db.recurringExpenses.update(editingExpense.id!, {
          name: name.trim(),
          description: description.trim() || undefined,
          amount: amountNum,
          currency,
          category,
          frequency,
          dueDay: dueDayNum,
          updatedAt: new Date()
        })
        toast.success(tMessages('expenseUpdated'))
      } else {
        await db.recurringExpenses.add({
          id: generateId('exp'),
          name: name.trim(),
          description: description.trim() || undefined,
          amount: amountNum,
          currency,
          category,
          frequency,
          dueDay: dueDayNum,
          isActive: true,
          createdAt: new Date()
        })
        toast.success(tMessages('expenseAdded'))
      }

      setShowDialog(false)
      resetForm()
    } catch (error) {
      console.error('Error saving expense:', error)
      toast.error(tMessages('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (expense: RecurringExpense) => {
    try {
      await db.recurringExpenses.update(expense.id!, {
        isActive: !expense.isActive,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Error toggling expense:', error)
      toast.error(tMessages('error'))
    }
  }

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteWithSync(db.recurringExpenses, 'recurringExpenses', expenseId)
      toast.success(tMessages('expenseDeleted'))
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error(tMessages('error'))
    }
  }

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    if (!cat) return categoryId
    if (cat.name.startsWith('defaultExpenseCategories.')) {
      const key = cat.name.replace('defaultExpenseCategories.', '')
      return tCat(key)
    }
    return cat.name
  }

  const getCategoryIcon = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    if (!cat?.icon) return MoreHorizontal
    return iconMap[cat.icon] || MoreHorizontal
  }

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat?.color || '#6B7280'
  }

  const activeExpenses = expenses.filter(e => e.isActive)
  const inactiveExpenses = expenses.filter(e => !e.isActive)

  // Calculate totals in ARS
  const totalActiveARS = activeExpenses.reduce((sum, exp) => sum + getAmountInARS(exp), 0)

  return (
    <>
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
                {t('title')}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t('subtitle')}
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="h-10 sm:h-12 px-4 sm:px-6 w-full sm:w-auto">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              {t('addExpense')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Monthly Total Summary */}
          {activeExpenses.length > 0 && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-muted/50 rounded-lg">
              <p className="text-xs sm:text-sm text-muted-foreground">{t('totalMonthly')}</p>
              <p className="text-lg sm:text-2xl font-bold">
                $ {formatARS(totalActiveARS)}
                {rate > 1 && (
                  <span className="ml-2 text-xs sm:text-sm font-normal text-muted-foreground/70">
                    (USD {formatARS(totalActiveARS / rate)})
                  </span>
                )}
              </p>
              {rate > 1 && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  1 USD = $ {formatARS(rate)} ARS
                </p>
              )}
            </div>
          )}

          {expenses.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Receipt className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">{t('noExpenses')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('noExpensesDescription')}</p>
              <Button onClick={() => handleOpenDialog()} className="h-10 sm:h-11">
                <Plus className="h-4 w-4 mr-2" />
                {t('addExpense')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Active Expenses */}
              {activeExpenses.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
                    <Badge variant="default" className="bg-green-500 text-xs">{t('active')}</Badge>
                    <span>{activeExpenses.length} expenses</span>
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {activeExpenses.map(expense => {
                      const IconComponent = getCategoryIcon(expense.category)
                      const amountInARS = getAmountInARS(expense)
                      return (
                        <div
                          key={expense.id}
                          className="p-3 sm:p-4 bg-card border rounded-lg"
                        >
                          {/* Mobile: Stacked layout */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            {/* Expense info */}
                            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                              <div
                                className="p-2 sm:p-3 rounded-full shrink-0"
                                style={{ backgroundColor: `${getCategoryColor(expense.category)}20` }}
                              >
                                <IconComponent
                                  className="h-4 w-4 sm:h-5 sm:w-5"
                                  style={{ color: getCategoryColor(expense.category) }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-base sm:text-lg truncate">{expense.name}</p>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                  <span>{getCategoryName(expense.category)}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="hidden sm:inline">{t(`frequency.${expense.frequency}`)}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="hidden sm:inline">{t('dueOn', { day: expense.dueDay })}</span>
                                  {expense.currency === 'USD' && (
                                    <Badge variant="secondary" className="text-xs">
                                      USD {formatARS(expense.amount)}
                                    </Badge>
                                  )}
                                </div>
                                {/* Mobile-only: Show frequency and due date */}
                                <div className="sm:hidden text-xs text-muted-foreground mt-1">
                                  {t(`frequency.${expense.frequency}`)} • {t('dueOn', { day: expense.dueDay })}
                                </div>
                              </div>
                            </div>

                            {/* Amount and actions */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-11 sm:pl-0">
                              <div className="text-left sm:text-right">
                                <p className="text-xl sm:text-2xl font-bold">$ {formatARS(amountInARS)}</p>
                                {rate > 1 && (
                                  <p className="text-xs sm:text-sm text-muted-foreground/70">
                                    USD {formatARS(amountInARS / rate)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 sm:gap-2">
                                <Switch
                                  checked={expense.isActive}
                                  onCheckedChange={() => handleToggleActive(expense)}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 sm:h-9 sm:w-9"
                                  onClick={() => handleOpenDialog(expense)}
                                >
                                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 sm:h-9 sm:w-9"
                                  onClick={() => handleDelete(expense.id!)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Inactive Expenses */}
              {inactiveExpenses.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{t('inactive')}</Badge>
                    <span>{inactiveExpenses.length} expenses</span>
                  </h3>
                  <div className="space-y-2 sm:space-y-3 opacity-60">
                    {inactiveExpenses.map(expense => {
                      const IconComponent = getCategoryIcon(expense.category)
                      const amountInARS = getAmountInARS(expense)
                      return (
                        <div
                          key={expense.id}
                          className="p-3 sm:p-4 bg-card border rounded-lg"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="p-2 sm:p-3 rounded-full bg-muted shrink-0">
                                <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-base sm:text-lg truncate">{expense.name}</p>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                  <span>{getCategoryName(expense.category)}</span>
                                  {expense.currency === 'USD' && (
                                    <Badge variant="secondary" className="text-xs">
                                      USD {formatARS(expense.amount)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-11 sm:pl-0">
                              <div className="text-left sm:text-right">
                                <p className="text-lg sm:text-xl font-semibold text-muted-foreground">
                                  $ {formatARS(amountInARS)}
                                </p>
                                {rate > 1 && (
                                  <p className="text-xs sm:text-sm text-muted-foreground/70">
                                    USD {formatARS(amountInARS / rate)}
                                  </p>
                                )}
                              </div>
                              <Switch
                                checked={expense.isActive}
                                onCheckedChange={() => handleToggleActive(expense)}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowDialog(open) }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingExpense ? t('dialog.editTitle') : t('dialog.title')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('dialog.name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('dialog.namePlaceholder')}
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('dialog.description')}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('dialog.descriptionPlaceholder')}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('dialog.currency')}</Label>
              <Select value={currency} onValueChange={(val) => setCurrency(val as 'ARS' | 'USD')}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">ARS</span>
                      <span className="text-muted-foreground">- {tIncome('dialog.argentinePeso')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="USD">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">USD</span>
                      <span className="text-muted-foreground">- {tIncome('dialog.usDollar')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {currency === 'USD' && rate > 1 && (
                <p className="text-sm text-muted-foreground">
                  {tIncome('dialog.willBeConverted', { rate: formatARS(rate) })}
                </p>
              )}
              {currency === 'USD' && rate <= 1 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {tIncome('dialog.setExchangeRateFirst')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{t('dialog.amount')}</Label>
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
                    className="h-12 pl-12"
                    required
                  />
                </div>
                {currency === 'USD' && amount && rate > 1 && (
                  <p className="text-sm text-muted-foreground">
                    = $ {formatARS(parseFloat(amount) * rate)} ARS
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDay">{t('dialog.dueDay')}</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder={t('dialog.dueDayPlaceholder')}
                  className="h-12"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('dialog.category')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t('dialog.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => {
                    const IconComp = cat.icon ? iconMap[cat.icon] : MoreHorizontal
                    return (
                      <SelectItem key={cat.id} value={cat.id!}>
                        <div className="flex items-center gap-2">
                          {IconComp && <IconComp className="h-4 w-4" style={{ color: cat.color }} />}
                          {cat.name.startsWith('defaultExpenseCategories.')
                            ? tCat(cat.name.replace('defaultExpenseCategories.', ''))
                            : cat.name
                          }
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('dialog.frequency')}</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequencies[number])}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map(freq => (
                    <SelectItem key={freq} value={freq}>
                      {t(`frequency.${freq}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { resetForm(); setShowDialog(false) }}
                className="h-12"
              >
                {t('dialog.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim() || !amount || !category}
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
