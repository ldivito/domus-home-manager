'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, MedicationFrequency } from '@/lib/db'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Pill } from 'lucide-react'
import { toast } from 'sonner'

interface AddMedicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petId: string
}

const MEDICATION_FREQUENCIES: MedicationFrequency[] = ['once', 'daily', 'twice_daily', 'weekly', 'monthly', 'as_needed']

export function AddMedicationDialog({ open, onOpenChange, petId }: AddMedicationDialogProps) {
  const t = useTranslations('pets')
  const tCommon = useTranslations('common')

  // Form state
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState<MedicationFrequency>('daily')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [prescribedBy, setPrescribedBy] = useState('')
  const [pharmacy, setPharmacy] = useState('')
  const [refillsRemaining, setRefillsRemaining] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('08:00')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName('')
    setDosage('')
    setFrequency('daily')
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setPrescribedBy('')
    setPharmacy('')
    setRefillsRemaining('')
    setReminderEnabled(true)
    setReminderTime('08:00')
    setNotes('')
  }

  const calculateNextDose = (start: Date, freq: MedicationFrequency): Date => {
    const now = new Date()
    const next = new Date(start)

    if (next > now) return next

    switch (freq) {
      case 'daily':
      case 'twice_daily':
        next.setDate(now.getDate())
        if (next <= now) next.setDate(next.getDate() + 1)
        break
      case 'weekly':
        while (next <= now) next.setDate(next.getDate() + 7)
        break
      case 'monthly':
        while (next <= now) next.setMonth(next.getMonth() + 1)
        break
      default:
        return now
    }
    return next
  }

  const handleSubmit = async () => {
    if (!name.trim() || !dosage.trim()) {
      toast.error(t('messages.medicationFieldsRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const start = new Date(startDate)
      const now = new Date()

      await db.petMedications.add({
        id: `med_${crypto.randomUUID()}`,
        petId,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        startDate: start,
        endDate: endDate ? new Date(endDate) : undefined,
        nextDose: frequency !== 'once' && frequency !== 'as_needed'
          ? calculateNextDose(start, frequency)
          : undefined,
        prescribedBy: prescribedBy.trim() || undefined,
        pharmacy: pharmacy.trim() || undefined,
        refillsRemaining: refillsRemaining ? parseInt(refillsRemaining) : undefined,
        reminderEnabled,
        reminderTime: reminderEnabled ? reminderTime : undefined,
        notes: notes.trim() || undefined,
        isActive: true,
        createdAt: now,
        updatedAt: now
      })

      toast.success(t('messages.medicationAdded'))
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Error adding medication:', error)
      toast.error(t('messages.medicationAddError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            {t('dialogs.addMedication.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.addMedication.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="medName">{t('medication.name')} *</Label>
            <Input
              id="medName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('medication.namePlaceholder')}
            />
          </div>

          {/* Dosage */}
          <div className="space-y-2">
            <Label htmlFor="dosage">{t('medication.dosage')} *</Label>
            <Input
              id="dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder={t('medication.dosagePlaceholder')}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>{t('medication.frequency')}</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as MedicationFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDICATION_FREQUENCIES.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {t(`medicationFrequency.${freq}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t('medication.startDate')} *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t('medication.endDate')}</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Prescribed By */}
          <div className="space-y-2">
            <Label htmlFor="prescribedBy">{t('medication.prescribedBy')}</Label>
            <Input
              id="prescribedBy"
              value={prescribedBy}
              onChange={(e) => setPrescribedBy(e.target.value)}
              placeholder={t('medication.prescribedByPlaceholder')}
            />
          </div>

          {/* Pharmacy */}
          <div className="space-y-2">
            <Label htmlFor="pharmacy">{t('medication.pharmacy')}</Label>
            <Input
              id="pharmacy"
              value={pharmacy}
              onChange={(e) => setPharmacy(e.target.value)}
              placeholder={t('medication.pharmacyPlaceholder')}
            />
          </div>

          {/* Refills */}
          <div className="space-y-2">
            <Label htmlFor="refills">{t('medication.refillsRemaining')}</Label>
            <Input
              id="refills"
              type="number"
              min="0"
              value={refillsRemaining}
              onChange={(e) => setRefillsRemaining(e.target.value)}
            />
          </div>

          {/* Reminder */}
          <div className="flex items-center justify-between">
            <Label htmlFor="reminder">{t('medication.enableReminder')}</Label>
            <Switch
              id="reminder"
              checked={reminderEnabled}
              onCheckedChange={setReminderEnabled}
            />
          </div>

          {reminderEnabled && (
            <div className="space-y-2">
              <Label htmlFor="reminderTime">{t('medication.reminderTime')}</Label>
              <Input
                id="reminderTime"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="medNotes">{t('form.notes')}</Label>
            <Textarea
              id="medNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('medication.notesPlaceholder')}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? tCommon('saving') : tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
