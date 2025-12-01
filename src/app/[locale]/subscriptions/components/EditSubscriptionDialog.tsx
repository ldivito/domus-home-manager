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

interface EditSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: Subscription | null
}

const CATEGORIES: SubscriptionCategory[] = [
  'streaming', 'software', 'gaming', 'music', 'cloud_storage',
  'news', 'fitness', 'utilities', 'insurance', 'membership', 'other'
]

const BILLING_CYCLES: SubscriptionBillingCycle[] = [
  'weekly', 'monthly', 'quarterly', 'biannually', 'yearly'
]

export function EditSubscriptionDialog({ open, onOpenChange, subscription }: EditSubscriptionDialogProps) {
  const t = useTranslations('subscriptions')
  const tCommon = useTranslations('common')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'streaming' as SubscriptionCategory,
    amountARS: '',
    amountUSD: '',
    billingCycle: 'monthly' as SubscriptionBillingCycle,
    billingDay: '1',
    nextBillingDate: new Date().toISOString().split('T')[0],
    status: 'active' as SubscriptionStatus,
    autoRenew: true,
    reminderEnabled: true,
    reminderDaysBefore: '3',
    providerName: '',
    providerWebsite: '',
    accountEmail: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (subscription) {
      // Load amounts - prefer new fields, fallback to legacy
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
    }
  }, [subscription])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subscription?.id) return
    if (!formData.name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }

    const amountARS = formData.amountARS ? parseFloat(formData.amountARS) : undefined
    const amountUSD = formData.amountUSD ? parseFloat(formData.amountUSD) : undefined

    // At least one amount must be provided
    if (!amountARS && !amountUSD) {
      toast.error(t('validation.amountRequired'))
      return
    }

    // Determine primary amount and currency for legacy fields
    const primaryAmount = amountARS || amountUSD || 0
    const primaryCurrency = amountARS ? 'ARS' : 'USD'

    setIsSubmitting(true)
    try {
      await db.subscriptions.update(subscription.id, {
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
        updatedAt: new Date()
      })

      toast.success(t('messages.updated'))
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast.error(t('messages.updateError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!subscription) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dialogs.edit.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">{t('form.name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>

            {/* Category and Status */}
            <div className="space-y-2">
              <Label htmlFor="category">{t('form.category')}</Label>
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
              <Label htmlFor="status">{t('form.status')}</Label>
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
                  <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount in ARS */}
            <div className="space-y-2">
              <Label htmlFor="amountARS">{t('form.amountARS')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ARS</span>
                <Input
                  id="amountARS"
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
              <Label htmlFor="amountUSD">{t('form.amountUSD')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">USD</span>
                <Input
                  id="amountUSD"
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
              <Label htmlFor="billingCycle">{t('form.billingCycle')}</Label>
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
              <Label htmlFor="nextBillingDate">{t('form.nextBillingDate')}</Label>
              <Input
                id="nextBillingDate"
                type="date"
                value={formData.nextBillingDate}
                onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
              />
            </div>

            {/* Provider Info */}
            <div className="space-y-2">
              <Label htmlFor="providerName">{t('form.providerName')}</Label>
              <Input
                id="providerName"
                value={formData.providerName}
                onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                placeholder={t('form.providerNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerWebsite">{t('form.providerWebsite')}</Label>
              <Input
                id="providerWebsite"
                type="url"
                value={formData.providerWebsite}
                onChange={(e) => setFormData({ ...formData, providerWebsite: e.target.value })}
                placeholder="https://..."
              />
            </div>

            {/* Account Email */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="accountEmail">{t('form.accountEmail')}</Label>
              <Input
                id="accountEmail"
                type="email"
                value={formData.accountEmail}
                onChange={(e) => setFormData({ ...formData, accountEmail: e.target.value })}
                placeholder={t('form.accountEmailPlaceholder')}
              />
            </div>

            {/* Auto Renew */}
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="autoRenew">{t('form.autoRenew')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.autoRenewDescription')}</p>
              </div>
              <Switch
                id="autoRenew"
                checked={formData.autoRenew}
                onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
              />
            </div>

            {/* Reminder */}
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="reminder">{t('form.enableReminder')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.reminderDescription')}</p>
              </div>
              <Switch
                id="reminder"
                checked={formData.reminderEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, reminderEnabled: checked })}
              />
            </div>

            {formData.reminderEnabled && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="reminderDays">{t('form.reminderDaysBefore')}</Label>
                <Input
                  id="reminderDays"
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
              <Label htmlFor="description">{t('form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
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
              {isSubmitting ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
