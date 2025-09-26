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

interface KetoSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStartDate?: Date
  onSave: (startDate: Date) => void
}

export default function KetoSettingsModal({
  open,
  onOpenChange,
  currentStartDate,
  onSave,
}: KetoSettingsModalProps) {
  const t = useTranslations('keto')
  const [startDate, setStartDate] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (currentStartDate) {
      // Format date as YYYY-MM-DD for input
      const formatted = currentStartDate.toISOString().split('T')[0]
      setStartDate(formatted)
    } else {
      // Default to today
      const today = new Date().toISOString().split('T')[0]
      setStartDate(today)
    }
  }, [currentStartDate, open])

  const handleSave = async () => {
    if (!startDate) return

    setIsSaving(true)
    try {
      const date = new Date(startDate + "T00:00:00.000Z")
      await onSave(date)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {t('settings.title')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('settings.startDateLabel')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-3">
            <Label htmlFor="start-date" className="text-base font-medium">
              {t('settings.startDate')}
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-base"
              max={new Date().toISOString().split('T')[0]} // Can't start in the future
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
            disabled={!startDate || isSaving}
          >
            {isSaving ? "..." : t('settings.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}