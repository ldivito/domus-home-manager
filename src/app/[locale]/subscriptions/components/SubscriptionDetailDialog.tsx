'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Subscription, SubscriptionPayment } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import {
  Calendar,
  CreditCard,
  Globe,
  Mail,
  Clock,
  DollarSign,
  RefreshCw,
  Bell,
  FileText,
  ExternalLink
} from 'lucide-react'

interface SubscriptionDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: Subscription | null
  onEdit: () => void
  onRecordPayment: () => void
}

const EMPTY_PAYMENTS: SubscriptionPayment[] = []

export function SubscriptionDetailDialog({
  open,
  onOpenChange,
  subscription,
  onEdit,
  onRecordPayment
}: SubscriptionDetailDialogProps) {
  const t = useTranslations('subscriptions')
  const tCommon = useTranslations('common')

  // Get payment history for this subscription
  const payments = useLiveQuery(
    () => subscription?.id
      ? db.subscriptionPayments
          .where('subscriptionId')
          .equals(subscription.id)
          .reverse()
          .sortBy('paymentDate')
      : Promise.resolve([]),
    [subscription?.id]
  ) ?? EMPTY_PAYMENTS

  if (!subscription) return null

  const formatCurrency = (amount: number, currency: 'ARS' | 'USD') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date))
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'trial': return 'secondary'
      case 'paused': return 'outline'
      case 'cancelled': return 'destructive'
      default: return 'default'
    }
  }

  const getPaymentStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default'
      case 'pending': return 'secondary'
      case 'failed': return 'destructive'
      case 'refunded': return 'outline'
      default: return 'default'
    }
  }

  const getDaysUntilBilling = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextBilling = new Date(subscription.nextBillingDate)
    nextBilling.setHours(0, 0, 0, 0)
    const diffTime = nextBilling.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilBilling = getDaysUntilBilling()

  // Calculate total spent
  const totalSpent = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{subscription.name}</span>
            <Badge variant={getStatusVariant(subscription.status)}>
              {t(`status.${subscription.status}`)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('form.category')}</p>
              <Badge variant="outline">{t(`categories.${subscription.category}`)}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('form.amount')}</p>
              <p className="text-lg font-semibold">
                {formatCurrency(subscription.amount, subscription.currency)}
              </p>
            </div>
          </div>

          {/* Billing Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              {t('details.billingInfo')}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span>{t(`cycles.${subscription.billingCycle}`)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{t('details.billingDay', { day: subscription.billingDay })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t('details.nextBilling')}: {formatDate(subscription.nextBillingDate)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                {daysUntilBilling >= 0 ? (
                  <span className={daysUntilBilling <= 7 ? 'text-orange-600 font-medium' : ''}>
                    {t('details.daysUntil', { days: daysUntilBilling })}
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">
                    {t('details.overdue', { days: Math.abs(daysUntilBilling) })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Provider Info */}
          {(subscription.providerName || subscription.providerWebsite || subscription.accountEmail) && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('details.providerInfo')}
              </h4>
              <div className="space-y-2 text-sm">
                {subscription.providerName && (
                  <p>{subscription.providerName}</p>
                )}
                {subscription.providerWebsite && (
                  <a
                    href={subscription.providerWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    {subscription.providerWebsite}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {subscription.accountEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{subscription.accountEmail}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${subscription.autoRenew ? 'text-green-600' : 'text-muted-foreground'}`} />
              <span>
                {subscription.autoRenew ? t('details.autoRenewOn') : t('details.autoRenewOff')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className={`h-4 w-4 ${subscription.reminderEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
              <span>
                {subscription.reminderEnabled
                  ? t('details.reminderOn', { days: subscription.reminderDaysBefore || 3 })
                  : t('details.reminderOff')
                }
              </span>
            </div>
          </div>

          {/* Notes */}
          {subscription.notes && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('form.notes')}
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {subscription.notes}
              </p>
            </div>
          )}

          {/* Payment History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{t('details.paymentHistory')}</h4>
              {totalSpent > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('details.totalSpent')}: {formatCurrency(totalSpent, subscription.currency)}
                </p>
              )}
            </div>
            {payments.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={getPaymentStatusVariant(payment.status)}>
                        {t(`paymentStatus.${payment.status}`)}
                      </Badge>
                      <span>{formatDate(payment.paymentDate)}</span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(payment.amount, payment.currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('details.noPayments')}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('close')}
            </Button>
            <Button variant="outline" onClick={onRecordPayment}>
              {t('actions.recordPayment')}
            </Button>
            <Button onClick={onEdit}>
              {tCommon('edit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
