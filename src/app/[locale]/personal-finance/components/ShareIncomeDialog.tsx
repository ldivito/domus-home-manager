'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlertCircle, DollarSign, Home, User } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils/finance'
import { PersonalTransaction } from '@/types/personal-finance'

interface ShareIncomeDialogProps {
  transaction: PersonalTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onShare: (transactionId: string, contribution: number, sharePercentage: number) => Promise<void>
}

export default function ShareIncomeDialog({
  transaction,
  open,
  onOpenChange,
  onShare
}: ShareIncomeDialogProps) {
  const t = useTranslations('personalFinance')
  const [shareEnabled, setShareEnabled] = useState(false)
  const [shareAmount, setShareAmount] = useState('')
  const [sharePercentage, setSharePercentage] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!transaction || transaction.type !== 'income') return null

  const maxAmount = transaction.amount
  const numericShareAmount = parseFloat(shareAmount) || 0
  const calculatedPercentage = maxAmount > 0 ? (numericShareAmount / maxAmount) * 100 : 0

  const handlePercentageChange = (percentage: number) => {
    setSharePercentage(percentage)
    const amount = (maxAmount * percentage / 100).toFixed(2)
    setShareAmount(amount)
  }

  const handleAmountChange = (amount: string) => {
    setShareAmount(amount)
    const numAmount = parseFloat(amount) || 0
    if (maxAmount > 0) {
      setSharePercentage((numAmount / maxAmount) * 100)
    }
  }

  const handleShare = async () => {
    if (!shareEnabled || numericShareAmount <= 0 || !transaction || !transaction.id) return

    setLoading(true)
    setError(null)

    try {
      await onShare(transaction.id, numericShareAmount, sharePercentage)
      onOpenChange(false)
      // Reset form
      setShareEnabled(false)
      setShareAmount('')
      setSharePercentage(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shareIncome.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            {t('shareIncome.title')}
          </DialogTitle>
          <DialogDescription>
            {t('shareIncome.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Info */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">{transaction.description}</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('shareIncome.totalIncome')}</span>
              <span className="font-bold text-green-600">
                {formatCurrency(transaction.amount, transaction.currency)}
              </span>
            </div>
          </div>

          {/* Share Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="share-toggle">{t('shareIncome.shareToggle')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('shareIncome.shareToggleHint')}
              </p>
            </div>
            <Switch
              id="share-toggle"
              checked={shareEnabled}
              onCheckedChange={setShareEnabled}
            />
          </div>

          {shareEnabled && (
            <div className="space-y-4">
              {/* Share Amount */}
              <div className="space-y-2">
                <Label htmlFor="share-amount">{t('shareIncome.amountToShare')}</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="share-amount"
                    type="number"
                    min="0"
                    max={maxAmount}
                    step="0.01"
                    value={shareAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Percentage Buttons */}
              <div className="space-y-2">
                <Label>{t('shareIncome.quickSelectPercentage')}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <Button
                      key={pct}
                      variant={sharePercentage === pct ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePercentageChange(pct)}
                      disabled={loading}
                    >
                      {pct}%
                    </Button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{t('shareIncome.keepPersonal')}</div>
                      <div className="text-green-600 font-bold">
                        {formatCurrency(maxAmount - numericShareAmount, transaction.currency)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{t('shareIncome.shareWithHousehold')}</div>
                      <div className="text-blue-600 font-bold">
                        {formatCurrency(numericShareAmount, transaction.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {numericShareAmount > maxAmount && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('shareIncome.exceedsTotal')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('shareIncome.cancel')}
          </Button>
          <Button
            onClick={handleShare}
            disabled={!shareEnabled || numericShareAmount <= 0 || numericShareAmount > maxAmount || loading}
          >
            {loading ? t('shareIncome.sharing') : t('shareIncome.shareIncome')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
