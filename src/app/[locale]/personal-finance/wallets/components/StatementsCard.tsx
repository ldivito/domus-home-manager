'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { CreditCardStatement } from '@/types/personal-finance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/finance'
import { EditStatementDialog } from './EditStatementDialog'

const STATUS_VARIANT: Record<CreditCardStatement['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default',
  closed: 'secondary',
  paid: 'outline',
  overdue: 'destructive'
}

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value))
const fmtDate = (value: Date | string) => toDate(value).toLocaleDateString()

/** Statements of one credit card, newest first, with both currencies. */
export function StatementsCard({ walletId }: { walletId: string }) {
  const t = useTranslations('personalFinance.statements')
  const [editing, setEditing] = useState<CreditCardStatement | null>(null)

  const statements = useLiveQuery(
    async () => (await db.creditCardStatements.where('walletId').equals(walletId).toArray())
      .sort((a, b) => toDate(b.periodEnd).getTime() - toDate(a.periodEnd).getTime()),
    [walletId]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!statements || statements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('empty')}</p>
        ) : (
          statements.map(st => {
            const hasUsd = [st.totalChargesUSD, st.currentBalanceUSD, st.minimumPaymentUSD, st.paidAmountUSD]
              .some(v => typeof v === 'number' && v !== 0)
            const lines: Array<{ currency: 'ARS' | 'USD'; balance: number; minimum: number; paid: number; charges: number }> = [
              { currency: st.currency, balance: st.currentBalance, minimum: st.minimumPayment, paid: st.paidAmount, charges: st.totalCharges }
            ]
            if (hasUsd && st.currency !== 'USD') {
              lines.push({
                currency: 'USD',
                balance: st.currentBalanceUSD ?? 0,
                minimum: st.minimumPaymentUSD ?? 0,
                paid: st.paidAmountUSD ?? 0,
                charges: st.totalChargesUSD ?? 0
              })
            }
            return (
              <div key={st.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {t('period', { start: fmtDate(st.periodStart), end: fmtDate(st.periodEnd) })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('closesOn', { date: fmtDate(st.periodEnd) })} · {t('dueOn', { date: fmtDate(st.dueDate) })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[st.status]}>{t(`status.${st.status}`)}</Badge>
                    <Button variant="ghost" size="icon" aria-label={t('edit')} onClick={() => setEditing(st)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className={`grid gap-2 ${lines.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                  {lines.map(line => (
                    <div key={line.currency} className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{t('balance')} {line.currency}</span>
                        <span>{formatCurrency(line.balance, line.currency)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('charges')}</span>
                        <span>{formatCurrency(line.charges, line.currency)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('minimum')}</span>
                        <span>{formatCurrency(line.minimum, line.currency)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('paid')}</span>
                        <span>{formatCurrency(line.paid, line.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {st.notes && <p className="text-sm text-muted-foreground whitespace-pre-line">{st.notes}</p>}
                {st.manualTotals && <p className="text-xs text-muted-foreground">{t('manualTotals')}</p>}
              </div>
            )
          })
        )}
      </CardContent>

      <EditStatementDialog statement={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}
