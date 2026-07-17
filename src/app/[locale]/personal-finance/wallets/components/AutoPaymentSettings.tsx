'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { scheduleAutomaticPayment, cancelAutomaticPayment } from '@/lib/utils/finance'
import { logger } from '@/lib/logger'

interface AutoPaymentSettingsProps {
  walletId: string
}

export function AutoPaymentSettings({ walletId }: AutoPaymentSettingsProps) {
  const t = useTranslations('personalFinance.autoPayment')

  const schedule = useLiveQuery(
    () => db.personalScheduledPayments.where('walletId').equals(walletId).first(),
    [walletId]
  )

  const sourceWallets = useLiveQuery(
    () => db.personalWallets
      .filter(w => w.isActive !== false && w.type !== 'credit_card' && w.id !== walletId)
      .toArray(),
    [walletId]
  ) || []

  const [enabled, setEnabled] = useState(false)
  const [sourceWalletId, setSourceWalletId] = useState('')
  const [paymentType, setPaymentType] = useState<'minimum' | 'full' | 'fixed'>('minimum')
  const [fixedAmount, setFixedAmount] = useState('')
  const [daysBefore, setDaysBefore] = useState('3')
  const [isSaving, setIsSaving] = useState(false)

  // Load persisted schedule into the form when it arrives
  useEffect(() => {
    if (!schedule) return
    setEnabled(schedule.isActive !== false)
    setSourceWalletId(schedule.sourceWalletId)
    setPaymentType(schedule.paymentType)
    setFixedAmount(schedule.fixedAmount != null ? String(schedule.fixedAmount) : '')
    setDaysBefore(String(schedule.daysBefore))
  }, [schedule])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (!enabled) {
        await cancelAutomaticPayment(walletId)
        toast.success(t('disabledMessage'))
        return
      }

      if (!sourceWalletId) {
        toast.error(t('sourceRequired'))
        return
      }
      const parsedFixed = parseFloat(fixedAmount)
      if (paymentType === 'fixed' && (isNaN(parsedFixed) || parsedFixed <= 0)) {
        toast.error(t('fixedAmountRequired'))
        return
      }
      const parsedDays = parseInt(daysBefore, 10)

      await scheduleAutomaticPayment(
        walletId,
        sourceWalletId,
        paymentType,
        paymentType === 'fixed' ? parsedFixed : undefined,
        isNaN(parsedDays) ? 3 : Math.min(Math.max(parsedDays, 0), 28)
      )
      toast.success(t('savedMessage'))
    } catch (error) {
      logger.error('Error saving automatic payment schedule:', error)
      toast.error(t('errorMessage'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="auto-payment-enabled">{t('enable')}</Label>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <Switch
            id="auto-payment-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('sourceWallet')}</Label>
              <Select value={sourceWalletId} onValueChange={setSourceWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('sourceWalletPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {sourceWallets.map(wallet => (
                    <SelectItem key={wallet.id} value={wallet.id!}>
                      {wallet.name} ({wallet.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceWallets.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">{t('noSourceWallets')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('paymentType')}</Label>
              <Select
                value={paymentType}
                onValueChange={(value) => setPaymentType(value as 'minimum' | 'full' | 'fixed')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimum">{t('typeMinimum')}</SelectItem>
                  <SelectItem value="full">{t('typeFull')}</SelectItem>
                  <SelectItem value="fixed">{t('typeFixed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="auto-payment-amount">{t('fixedAmount')}</Label>
                <Input
                  id="auto-payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="auto-payment-days">{t('daysBefore')}</Label>
              <Input
                id="auto-payment-days"
                type="number"
                min="0"
                max="28"
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
              />
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? t('saving') : t('save')}
        </Button>
      </CardContent>
    </Card>
  )
}
