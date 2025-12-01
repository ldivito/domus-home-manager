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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db, SubscriptionCategory, SubscriptionBillingCycle, SubscriptionStatus } from '@/lib/db'
import { toast } from 'sonner'

interface AddSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORIES: SubscriptionCategory[] = [
  'streaming', 'software', 'gaming', 'music', 'cloud_storage',
  'news', 'fitness', 'utilities', 'insurance', 'membership', 'other'
]

const BILLING_CYCLES: SubscriptionBillingCycle[] = [
  'weekly', 'monthly', 'quarterly', 'biannually', 'yearly'
]

export function AddSubscriptionDialog({ open, onOpenChange }: AddSubscriptionDialogProps) {
  const t = useTranslations('subscriptions')
  const tCommon = useTranslations('common')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'streaming' as SubscriptionCategory,
    amount: '',
    currency: 'ARS' as 'ARS' | 'USD',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error(t('validation.amountRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      await db.subscriptions.add({
        id: `sub_${crypto.randomUUID()}`,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
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
        createdAt: new Date()
      })

      toast.success(t('messages.added'))
      onOpenChange(false)
      setFormData({
        name: '',
        description: '',
        category: 'streaming',
        amount: '',
        currency: 'ARS',
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
      })
    } catch (error) {
      console.error('Error adding subscription:', error)
      toast.error(t('messages.addError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dialogs.add.title')}</DialogTitle>
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
                </SelectContent>
              </Select>
            </div>

            {/* Amount and Currency */}
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

            {/* Billing Cycle and Day */}
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
