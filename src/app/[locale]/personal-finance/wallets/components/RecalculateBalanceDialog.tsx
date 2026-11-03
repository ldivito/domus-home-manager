'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { db } from '@/lib/db'
import type { PersonalWallet } from '@/types/personal-finance'
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
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/finance'
import { computeWalletBalance } from '@/lib/utils/finance/balance-math'

const toInputDate = (value: Date | string | undefined) => {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Recompute a wallet's balance as opening balance + completed transactions
 * since the opening date, with a preview before anything is written.
 */
export function RecalculateBalanceDialog({
  wallet,
  open,
  onOpenChange
}: {
  wallet: PersonalWallet
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('personalFinance.recalculate')
  const { toast } = useToast()
  const [openingBalance, setOpeningBalance] = useState('')
  const [openingDate, setOpeningDate] = useState('')
  const [preview, setPreview] = useState<{ balance: number; counted: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setOpeningBalance(wallet.openingBalance !== undefined ? String(wallet.openingBalance) : '')
    setOpeningDate(toInputDate(wallet.openingBalanceDate))
  }, [open, wallet])

  const opening = openingBalance.trim() === '' ? undefined : Number(openingBalance)
  const openingDateValue = openingDate ? (() => {
    const [y, m, d] = openingDate.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0)
  })() : undefined
  const invalid = opening !== undefined && !Number.isFinite(opening)

  // Live preview of the recalculated balance
  useEffect(() => {
    if (!open || invalid || !wallet.id) return
    let cancelled = false
    void (async () => {
      const [transactions, wallets] = await Promise.all([
        db.personalTransactions.filter(tx => tx.walletId === wallet.id || tx.targetWalletId === wallet.id).toArray(),
        db.personalWallets.toArray()
      ])
      const currencies = new Map(wallets.map(w => [w.id!, w.currency]))
      const from = openingDateValue?.getTime()
      const counted = transactions.filter(tx =>
        tx.status === 'completed' && (from === undefined || new Date(tx.date).getTime() >= from)
      ).length
      const balance = computeWalletBalance(
        { id: wallet.id!, openingBalance: opening, openingBalanceDate: openingDateValue },
        transactions,
        id => currencies.get(id)
      )
      if (!cancelled) setPreview({ balance, counted })
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wallet.id, openingBalance, openingDate, invalid])

  const apply = async () => {
    if (!wallet.id || !preview || invalid) return
    setSaving(true)
    try {
      await db.personalWallets.update(wallet.id, {
        openingBalance: opening,
        openingBalanceDate: openingDateValue,
        balance: preview.balance,
        updatedAt: new Date()
      })
      toast({ title: t('done', { balance: formatCurrency(preview.balance, wallet.currency) }) })
      onOpenChange(false)
    } catch {
      toast({ title: t('error'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opening-balance">{t('openingBalance')}</Label>
            <Input
              id="opening-balance"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opening-date">{t('openingDate')}</Label>
            <Input id="opening-date" type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('current')}</span>
            <span>{formatCurrency(wallet.balance || 0, wallet.currency)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>{t('recalculated')}</span>
            <span>{preview ? formatCurrency(preview.balance, wallet.currency) : '…'}</span>
          </div>
          {preview && (
            <div className="text-xs text-muted-foreground">{t('counted', { count: preview.counted })}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={apply} disabled={saving || !preview || invalid}>{t('apply')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
