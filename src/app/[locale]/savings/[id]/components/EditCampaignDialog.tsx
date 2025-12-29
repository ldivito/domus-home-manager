'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { db, SavingsCampaign, SavingMethod } from '@/lib/db'
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
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import {
  Calendar,
  Wallet,
  ArrowUpCircle,
  CalendarDays,
  CalendarRange,
  Settings
} from 'lucide-react'

interface EditCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: SavingsCampaign
}

const savingMethods: { value: SavingMethod; icon: React.ElementType }[] = [
  { value: '52_week_challenge', icon: Calendar },
  { value: 'envelope_method', icon: Wallet },
  { value: 'round_up', icon: ArrowUpCircle },
  { value: 'fixed_monthly', icon: CalendarDays },
  { value: 'bi_weekly', icon: CalendarRange },
  { value: 'custom', icon: Settings },
]

export function EditCampaignDialog({ open, onOpenChange, campaign }: EditCampaignDialogProps) {
  const t = useTranslations('savings')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [deadline, setDeadline] = useState('')
  const [savingMethod, setSavingMethod] = useState<SavingMethod>('fixed_monthly')
  const [customMethodDetails, setCustomMethodDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Populate form when campaign changes
  useEffect(() => {
    if (campaign) {
      setName(campaign.name)
      setDescription(campaign.description || '')
      setGoalAmount(campaign.goalAmount.toString())
      setCurrency(campaign.currency)
      setDeadline(new Date(campaign.deadline).toISOString().split('T')[0])
      setSavingMethod(campaign.savingMethod)
      setCustomMethodDetails(campaign.customMethodDetails || '')
    }
  }, [campaign])

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }

    const goal = parseFloat(goalAmount)
    if (isNaN(goal) || goal <= 0) {
      toast.error(t('validation.goalPositive'))
      return
    }

    if (!deadline) {
      toast.error(t('validation.deadlineRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      await db.savingsCampaigns.update(campaign.id!, {
        name: name.trim(),
        description: description.trim() || undefined,
        goalAmount: goal,
        currency,
        deadline: new Date(deadline),
        savingMethod,
        customMethodDetails: savingMethod === 'custom' ? customMethodDetails.trim() : undefined,
        updatedAt: new Date()
      })

      toast.success(t('messages.campaignUpdated'))
      onOpenChange(false)
    } catch (error) {
      logger.error('Error updating campaign:', error)
      toast.error(t('messages.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('detail.edit')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editName">{t('form.name')}</Label>
                <Input
                  id="editName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editDeadline">{t('form.deadline')}</Label>
                <Input
                  id="editDeadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">{t('form.description')}</Label>
              <Textarea
                id="editDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editGoalAmount">{t('form.goalAmount')}</Label>
                <Input
                  id="editGoalAmount"
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editCurrency">{t('form.currency')}</Label>
                <Select value={currency} onValueChange={(v: 'ARS' | 'USD') => setCurrency(v)}>
                  <SelectTrigger id="editCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Saving Method Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t('form.savingMethod')}</Label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {savingMethods.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSavingMethod(value)}
                  className={`p-5 rounded-xl border-2 transition-all text-left hover:shadow-md ${
                    savingMethod === value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-md ring-2 ring-purple-200 dark:ring-purple-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2.5 rounded-lg ${savingMethod === value ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Icon className={`h-5 w-5 ${savingMethod === value ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <span className={`font-semibold ${savingMethod === value ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t(`methods.${value}.name`)}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${savingMethod === value ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t(`methods.${value}.description`)}
                  </p>
                </button>
              ))}
            </div>

            {savingMethod === 'custom' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="editCustomMethodDetails">{t('form.customMethodDetails')}</Label>
                <Textarea
                  id="editCustomMethodDetails"
                  value={customMethodDetails}
                  onChange={(e) => setCustomMethodDetails(e.target.value)}
                  placeholder={t('form.customMethodPlaceholder')}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="px-6"
            >
              {t('form.cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('form.updating') : t('form.update')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
