'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, User, MonthlyIncome } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, DollarSign, User as UserIcon, Percent } from 'lucide-react'
import { toast } from 'sonner'

interface IncomeTabProps {
  users: User[]
  currentIncomes: MonthlyIncome[]
  currentMonth: number
  currentYear: number
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function IncomeTab({ users, currentIncomes, currentMonth, currentYear }: IncomeTabProps) {
  const t = useTranslations('finance.income')
  const tMessages = useTranslations('finance.messages')
  const [showDialog, setShowDialog] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalIncome = currentIncomes.reduce((sum, inc) => sum + inc.amount, 0)

  // Get user income map
  const userIncomeMap = new Map<string, MonthlyIncome>()
  currentIncomes.forEach(inc => {
    userIncomeMap.set(inc.userId, inc)
  })

  const handleOpenDialog = (userId?: string) => {
    if (userId) {
      setSelectedUserId(userId)
      const existing = userIncomeMap.get(userId)
      if (existing) {
        setAmount(existing.amount.toString())
      } else {
        setAmount('')
      }
    } else {
      setSelectedUserId('')
      setAmount('')
    }
    setShowDialog(true)
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
          updatedAt: new Date()
        })
        toast.success(tMessages('incomeUpdated'))
      } else {
        // Create new
        await db.monthlyIncomes.add({
          id: generateId('inc'),
          userId: selectedUserId,
          amount: amountNum,
          month: currentMonth,
          year: currentYear,
          createdAt: new Date()
        })
        toast.success(tMessages('incomeAdded'))
      }

      setShowDialog(false)
      setSelectedUserId('')
      setAmount('')
    } catch (error) {
      console.error('Error saving income:', error)
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
            <p className="text-sm text-muted-foreground">{t('currentMonth')}</p>
            <p className="text-2xl font-bold">{monthNames[currentMonth - 1]} {currentYear}</p>
            <p className="text-lg text-muted-foreground mt-1">
              {t('totalHousehold')}: <span className="font-semibold text-foreground">${totalIncome.toLocaleString()}</span>
            </p>
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
                const percentage = totalIncome > 0 && income
                  ? ((income.amount / totalIncome) * 100).toFixed(1)
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
                        <p className="text-sm text-muted-foreground">
                          {income ? `${t('share')}: ${percentage}%` : 'No income set'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        ${income?.amount.toLocaleString() || '0'}
                      </p>
                      {income && (
                        <Badge variant="secondary" className="mt-1">
                          <Percent className="h-3 w-3 mr-1" />
                          {percentage}%
                        </Badge>
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
              <Label htmlFor="amount" className="text-base">{t('dialog.amount')}</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t('dialog.amountPlaceholder')}
                  className="h-12 pl-10 text-lg"
                  required
                />
              </div>
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
    </>
  )
}
