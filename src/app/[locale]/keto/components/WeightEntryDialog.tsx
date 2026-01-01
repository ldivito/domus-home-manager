"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Scale } from "lucide-react"

interface WeightEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weightUnit: 'kg' | 'lb'
  currentWeight?: number
  currentNotes?: string
  currentDate?: Date
  onSave: (weight: number, date: Date, notes?: string) => Promise<void>
}

export default function WeightEntryDialog({
  open,
  onOpenChange,
  weightUnit,
  currentWeight,
  currentNotes,
  currentDate,
  onSave,
}: WeightEntryDialogProps) {
  const t = useTranslations('keto')
  const [weight, setWeight] = useState("")
  const [date, setDate] = useState("")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (currentWeight) {
      setWeight(currentWeight.toString())
    } else {
      setWeight("")
    }

    if (currentDate) {
      const d = currentDate instanceof Date ? currentDate : new Date(currentDate)
      setDate(d.toISOString().split('T')[0])
    } else {
      setDate(new Date().toISOString().split('T')[0])
    }

    setNotes(currentNotes || "")
  }, [currentWeight, currentNotes, currentDate, open])

  const handleSave = async () => {
    if (!weight || !date) return

    setIsSaving(true)
    try {
      await onSave(
        parseFloat(weight),
        new Date(date + "T00:00:00.000Z"),
        notes || undefined
      )
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Scale className="h-5 w-5" />
            {t('weight.entryTitle')}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {t('weight.entryDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-3">
            <Label htmlFor="weight-value" className="text-sm sm:text-base font-medium">
              {t('weight.weight')} ({weightUnit})
            </Label>
            <Input
              id="weight-value"
              type="number"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={`${t('weight.weightPlaceholder')} ${weightUnit}`}
              className="text-sm sm:text-base"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="weight-date" className="text-sm sm:text-base font-medium">
              {t('weight.date')}
            </Label>
            <Input
              id="weight-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="text-sm sm:text-base"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="weight-notes" className="text-sm sm:text-base font-medium">
              {t('weight.notes')} ({t('weight.optional')})
            </Label>
            <Textarea
              id="weight-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('weight.notesPlaceholder')}
              className="text-sm sm:text-base min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t('settings.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!weight || !date || isSaving}
          >
            {isSaving ? "..." : t('weight.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
