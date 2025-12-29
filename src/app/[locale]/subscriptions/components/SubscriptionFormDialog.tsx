'use client'

import { useState, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db, Subscription, SubscriptionCategory, SubscriptionBillingCycle, SubscriptionStatus } from '@/lib/db'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface SubscriptionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription?: Subscription | null  // If provided, we're editing
}

interface SubscriptionFormState {
  name: string
  description: string
  category: SubscriptionCategory
  amountARS: string
  amountUSD: string
  billingCycle: SubscriptionBillingCycle
  billingDay: string
  nextBillingDate: string
  status: SubscriptionStatus
  autoRenew: boolean
  reminderEnabled: boolean
  reminderDaysBefore: string
  providerName: string
  providerWebsite: string
  accountEmail: string
  notes: string
}

const CATEGORIES: SubscriptionCategory[] = [
  'streaming', 'software', 'gaming', 'music', 'cloud_storage',
  'news', 'fitness', 'utilities', 'insurance', 'membership', 'other'
]

const BILLING_CYCLES: SubscriptionBillingCycle[] = [
  'weekly', 'monthly', 'quarterly', 'biannually', 'yearly'
]

const initialFormState: SubscriptionFormState = {
  name: '',
  description: '',
  category: 'streaming',
  amountARS: '',
  amountUSD: '',
  billingCycle: 'monthly',
  billingDay: '1',
  nextBillingDate: new Date().toISOString().split('T')[0],
  status: 'active',
  autoRenew: true,
  reminderEnabled: true,
  reminderDaysBefore: '3',
  providerName: '',
  providerWebsite: '',
  accountEmail: '',
  notes: ''
}

export function SubscriptionFormDialog({ open, onOpenChange, subscription }: SubscriptionFormDialogProps) {
  const t = useTranslations('subscriptions')
  const tCommon = useTranslations('common')

  const isEditing = !!subscription
  const [formData, setFormData] = useState<SubscriptionFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (subscription) {
        // Edit mode - populate with subscription data
        const amountARS = subscription.amountARS !== undefined
          ? subscription.amountARS.toString()
          : (subscription.currency === 'ARS' ? subscription.amount.toString() : '')
        const amountUSD = subscription.amountUSD !== undefined
          ? subscription.amountUSD.toString()
          : (subscription.currency === 'USD' ? subscription.amount.toString() : '')

        setFormData({
          name: subscription.name,
          description: subscription.description || '',
          category: subscription.category,
          amountARS,
          amountUSD,
          billingCycle: subscription.billingCycle,
          billingDay: subscription.billingDay.toString(),
          nextBillingDate: new Date(subscription.nextBillingDate).toISOString().split('T')[0],
          status: subscription.status,
          autoRenew: subscription.autoRenew,
          reminderEnabled: subscription.reminderEnabled,
          reminderDaysBefore: (subscription.reminderDaysBefore || 3).toString(),
          providerName: subscription.providerName || '',
          providerWebsite: subscription.providerWebsite || '',
          accountEmail: subscription.accountEmail || '',
          notes: subscription.notes || ''
        })
      } else {
        // Create mode - reset form
        setFormData(initialFormState)
      }
    }
  }, [open, subscription])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }

    const amountARS = formData.amountARS ? parseFloat(formData.amountARS) : undefined
    const amountUSD = formData.amountUSD ? parseFloat(formData.amountUSD) : undefined

    if (!amountARS && !amountUSD) {
      toast.error(t('validation.amountRequired'))
      return
    }

    if (isEditing && !subscription?.id) return

    const primaryAmount = amountARS || amountUSD || 0
    const primaryCurrency: 'ARS' | 'USD' = amountARS ? 'ARS' : 'USD'

    setIsSubmitting(true)
    try {
      const subscriptionData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        amount: primaryAmount,
        currency: primaryCurrency,
        amountARS: amountARS,
        amountUSD: amountUSD,
        billingCycle: formData.billingCycle,
        billingDay: parseInt(formData.billingDay),
        nextBillingDate: new Date(formData.nextBillingDate),
        status: formData.status,
        autoRenew: formData.autoRenew,
        reminderEnabled: formData.reminderEnabled,
        reminderDaysBefore: formData.reminderEnabled ? parseInt(formData.reminderDaysBefore) : undefined,
        providerName: formData.providerName.trim() || undefined,
        providerWebsite: formData.providerWebsite.trim() || undefined,
        accountEmail: formData.accountEmail.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      }

      if (isEditing) {
        await db.subscriptions.update(subscription!.id!, {
          ...subscriptionData,
          updatedAt: new Date()
        })
        toast.success(t('messages.updated'))
      } else {
        await db.subscriptions.add({
          id: `sub_${crypto.randomUUID()}`,
          ...subscriptionData,
          createdAt: new Date()
        })
        toast.success(t('messages.added'))
      }

      setFormData(initialFormState)
      onOpenChange(false)
    } catch (error) {
      logger.error(`Error ${isEditing ? 'updating' : 'adding'} subscription:`, error)
      toast.error(isEditing ? t('messages.updateError') : t('messages.addError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing && !subscription) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('dialogs.edit.title') : t('dialogs.add.title')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="sub-name">{t('form.name')} *</Label>
              <Input
                id="sub-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>

            {/* Category and Status */}
            <div className="space-y-2">
              <Label htmlFor="sub-category">{t('form.category')}</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as SubscriptionCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`categories.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-status">{t('form.status')}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as SubscriptionStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('status.active')}</SelectItem>
                  <SelectItem value="trial">{t('status.trial')}</SelectItem>
                  <SelectItem value="paused">{t('status.paused')}</SelectItem>
                  {isEditing && <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Amount in ARS */}
            <div className="space-y-2">
              <Label htmlFor="sub-amountARS">{t('form.amountARS')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ARS</span>
                <Input
                  id="sub-amountARS"
                  type="number"
                  value={formData.amountARS}
                  onChange={(e) => setFormData({ ...formData, amountARS: e.target.value })}
                  placeholder="0"
                  step="0.01"
                  className="pl-12"
                />
              </div>
            </div>

            {/* Amount in USD */}
            <div className="space-y-2">
              <Label htmlFor="sub-amountUSD">{t('form.amountUSD')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">USD</span>
                <Input
                  id="sub-amountUSD"
                  type="number"
                  value={formData.amountUSD}
                  onChange={(e) => setFormData({ ...formData, amountUSD: e.target.value })}
                  placeholder="0"
                  step="0.01"
                  className="pl-12"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('form.amountHint')}</p>
            </div>

            {/* Billing Cycle and Next Billing Date */}
            <div className="space-y-2">
              <Label htmlFor="sub-billingCycle">{t('form.billingCycle')}</Label>
              <Select
                value={formData.billingCycle}
                onValueChange={(value) => setFormData({ ...formData, billingCycle: value as SubscriptionBillingCycle })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((cycle) => (
                    <SelectItem key={cycle} value={cycle}>
                      {t(`cycles.${cycle}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-nextBillingDate">{t('form.nextBillingDate')}</Label>
              <Input
                id="sub-nextBillingDate"
                type="date"
                value={formData.nextBillingDate}
                onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
              />
            </div>

            {/* Provider Info */}
            <div className="space-y-2">
              <Label htmlFor="sub-providerName">{t('form.providerName')}</Label>
              <Input
                id="sub-providerName"
                value={formData.providerName}
                onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                placeholder={t('form.providerNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-providerWebsite">{t('form.providerWebsite')}</Label>
              <Input
                id="sub-providerWebsite"
                type="url"
                value={formData.providerWebsite}
                onChange={(e) => setFormData({ ...formData, providerWebsite: e.target.value })}
                placeholder="https://..."
              />
            </div>

            {/* Account Email */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="sub-accountEmail">{t('form.accountEmail')}</Label>
              <Input
                id="sub-accountEmail"
                type="email"
                value={formData.accountEmail}
                onChange={(e) => setFormData({ ...formData, accountEmail: e.target.value })}
                placeholder={t('form.accountEmailPlaceholder')}
              />
            </div>

            {/* Auto Renew */}
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="sub-autoRenew">{t('form.autoRenew')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.autoRenewDescription')}</p>
              </div>
              <Switch
                id="sub-autoRenew"
                checked={formData.autoRenew}
                onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
              />
            </div>

            {/* Reminder */}
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="sub-reminder">{t('form.enableReminder')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.reminderDescription')}</p>
              </div>
              <Switch
                id="sub-reminder"
                checked={formData.reminderEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, reminderEnabled: checked })}
              />
            </div>

            {formData.reminderEnabled && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="sub-reminderDays">{t('form.reminderDaysBefore')}</Label>
                <Input
                  id="sub-reminderDays"
                  type="number"
                  value={formData.reminderDaysBefore}
                  onChange={(e) => setFormData({ ...formData, reminderDaysBefore: e.target.value })}
                  min={1}
                  max={30}
                />
              </div>
            )}

            {/* Description */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="sub-description">{t('form.description')}</Label>
              <Textarea
                id="sub-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="sub-notes">{t('form.notes')}</Label>
              <Textarea
                id="sub-notes"
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
              {isSubmitting ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Re-export with legacy names for backward compatibility
export { SubscriptionFormDialog as AddSubscriptionDialog }
export { SubscriptionFormDialog as EditSubscriptionDialog }
