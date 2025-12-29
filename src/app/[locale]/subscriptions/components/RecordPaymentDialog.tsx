'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db, Subscription } from '@/lib/db'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: Subscription | null
}

export function RecordPaymentDialog({ open, onOpenChange, subscription }: RecordPaymentDialogProps) {
  const t = useTranslations('subscriptions')
  const tCommon = useTranslations('common')

  const [formData, setFormData] = useState({
    amount: '',
    currency: 'ARS' as 'ARS' | 'USD',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    status: 'paid' as 'paid' | 'failed' | 'pending' | 'refunded',
    transactionId: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when subscription changes
  useState(() => {
    if (subscription) {
      setFormData(prev => ({
        ...prev,
        amount: subscription.amount.toString(),
        currency: subscription.currency
      }))
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subscription?.id) return
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error(t('validation.amountRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      // Record the payment
      await db.subscriptionPayments.add({
        id: `sp_${crypto.randomUUID()}`,
        subscriptionId: subscription.id,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        paymentDate: new Date(formData.paymentDate),
        paymentMethod: formData.paymentMethod.trim() || undefined,
        status: formData.status,
        transactionId: formData.transactionId.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        createdAt: new Date()
      })

      // Calculate next billing date based on billing cycle
      const currentDate = new Date(subscription.nextBillingDate)
      const nextDate = new Date(currentDate)

      switch (subscription.billingCycle) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7)
          break
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1)
          break
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3)
          break
        case 'biannually':
          nextDate.setMonth(nextDate.getMonth() + 6)
          break
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1)
          break
      }

      // Update subscription with new next billing date
      await db.subscriptions.update(subscription.id, {
        nextBillingDate: nextDate,
        updatedAt: new Date()
      })

      toast.success(t('messages.paymentRecorded'))
      onOpenChange(false)
      setFormData({
        amount: '',
        currency: 'ARS',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        status: 'paid',
        transactionId: '',
        notes: ''
      })
    } catch (error) {
      logger.error('Error recording payment:', error)
      toast.error(t('messages.paymentError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!subscription) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('dialogs.recordPayment.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">{t('dialogs.recordPayment.for')}</p>
            <p className="font-medium">{subscription.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">{t('form.amount')} *</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
                step="0.01"
              />
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">{t('form.currency')}</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value as 'ARS' | 'USD' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">{t('form.paymentDate')}</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">{t('form.paymentStatus')}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as 'paid' | 'failed' | 'pending' | 'refunded' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">{t('paymentStatus.paid')}</SelectItem>
                  <SelectItem value="pending">{t('paymentStatus.pending')}</SelectItem>
                  <SelectItem value="failed">{t('paymentStatus.failed')}</SelectItem>
                  <SelectItem value="refunded">{t('paymentStatus.refunded')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">{t('form.paymentMethod')}</Label>
              <Input
                id="paymentMethod"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                placeholder={t('form.paymentMethodPlaceholder')}
              />
            </div>

            {/* Transaction ID */}
            <div className="space-y-2">
              <Label htmlFor="transactionId">{t('form.transactionId')}</Label>
              <Input
                id="transactionId"
                value={formData.transactionId}
                onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                placeholder={t('form.transactionIdPlaceholder')}
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">{t('form.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('form.notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : t('actions.recordPayment')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
