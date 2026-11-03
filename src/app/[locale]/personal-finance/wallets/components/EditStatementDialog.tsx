'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { db } from '@/lib/db'
import type { CreditCardStatement } from '@/types/personal-finance'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

/** yyyy-mm-dd in local time, for <input type="date"> */
function toInputDate(value: Date | string | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local date from yyyy-mm-dd; closing dates keep the end of that day */
function fromInputDate(value: string, endOfDay = false): Date {
  const [y, m, d] = value.split('-').map(Number)
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 12, 0, 0)
}

/**
 * Banks move closing and due dates every month, so each statement's real
 * dates are edited here instead of being derived from the card's fixed days.
 */
export function EditStatementDialog({
  statement,
  onClose
}: {
  statement: CreditCardStatement | null
  onClose: () => void
}) {
  const t = useTranslations('personalFinance.statements')
  const { toast } = useToast()
  const [periodEnd, setPeriodEnd] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!statement) return
    setPeriodEnd(toInputDate(statement.periodEnd))
    setDueDate(toInputDate(statement.dueDate))
    setNotes(statement.notes ?? '')
  }, [statement])

  const invalid = !periodEnd || !dueDate || dueDate < periodEnd

  const save = async () => {
    if (!statement?.id || invalid) return
    setSaving(true)
    try {
      await db.creditCardStatements.update(statement.id, {
        periodEnd: fromInputDate(periodEnd, true),
        dueDate: fromInputDate(dueDate),
        notes: notes.trim() || undefined,
        updatedAt: new Date()
      })
      toast({ title: t('saved') })
      onClose()
    } catch {
      toast({ title: t('saveError'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={statement !== null} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>{t('editHint')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="statement-closing">{t('closingDate')}</Label>
            <Input id="statement-closing" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statement-due">{t('dueDate')}</Label>
            <Input id="statement-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="statement-notes">{t('notes')}</Label>
            <Textarea id="statement-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        {periodEnd && dueDate && dueDate < periodEnd && (
          <p className="text-sm text-destructive">{t('dueBeforeClosing')}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={save} disabled={saving || invalid}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
