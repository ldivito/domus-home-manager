'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db } from '@/lib/db'
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
import { Switch } from '@/components/ui/switch'
import { Syringe } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface AddVaccinationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petId: string
}

export function AddVaccinationDialog({ open, onOpenChange, petId }: AddVaccinationDialogProps) {
  const t = useTranslations('pets')
  const tCommon = useTranslations('common')

  // Form state
  const [vaccineName, setVaccineName] = useState('')
  const [dateAdministered, setDateAdministered] = useState(new Date().toISOString().split('T')[0])
  const [administeredBy, setAdministeredBy] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [nextDueDate, setNextDueDate] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderDaysBefore, setReminderDaysBefore] = useState('7')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setVaccineName('')
    setDateAdministered(new Date().toISOString().split('T')[0])
    setAdministeredBy('')
    setClinicName('')
    setBatchNumber('')
    setExpirationDate('')
    setNextDueDate('')
    setReminderEnabled(true)
    setReminderDaysBefore('7')
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!vaccineName.trim()) {
      toast.error(t('messages.vaccineNameRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const now = new Date()

      await db.petVaccinations.add({
        id: `vax_${crypto.randomUUID()}`,
        petId,
        vaccineName: vaccineName.trim(),
        dateAdministered: new Date(dateAdministered),
        administeredBy: administeredBy.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        batchNumber: batchNumber.trim() || undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
        reminderEnabled,
        reminderDaysBefore: reminderEnabled && reminderDaysBefore
          ? parseInt(reminderDaysBefore)
          : undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      })

      toast.success(t('messages.vaccinationAdded'))
      resetForm()
      onOpenChange(false)
    } catch (error) {
      logger.error('Error adding vaccination:', error)
      toast.error(t('messages.vaccinationAddError'))
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
            <Syringe className="h-5 w-5" />
            {t('dialogs.addVaccination.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.addVaccination.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vaccine Name */}
          <div className="space-y-2">
            <Label htmlFor="vaccineName">{t('vaccination.name')} *</Label>
            <Input
              id="vaccineName"
              value={vaccineName}
              onChange={(e) => setVaccineName(e.target.value)}
              placeholder={t('vaccination.namePlaceholder')}
            />
          </div>

          {/* Date Administered */}
          <div className="space-y-2">
            <Label htmlFor="dateAdministered">{t('vaccination.dateAdministered')} *</Label>
            <Input
              id="dateAdministered"
              type="date"
              value={dateAdministered}
              onChange={(e) => setDateAdministered(e.target.value)}
            />
          </div>

          {/* Administered By & Clinic */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="administeredBy">{t('vaccination.administeredBy')}</Label>
              <Input
                id="administeredBy"
                value={administeredBy}
                onChange={(e) => setAdministeredBy(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinicName">{t('vaccination.clinic')}</Label>
              <Input
                id="clinicName"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
            </div>
          </div>

          {/* Batch Number */}
          <div className="space-y-2">
            <Label htmlFor="batchNumber">{t('vaccination.batchNumber')}</Label>
            <Input
              id="batchNumber"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder={t('vaccination.batchNumberPlaceholder')}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expirationDate">{t('vaccination.expirationDate')}</Label>
              <Input
                id="expirationDate"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextDueDate">{t('vaccination.nextDueDate')}</Label>
              <Input
                id="nextDueDate"
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Reminder */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder">{t('vaccination.enableReminder')}</Label>
              <Switch
                id="reminder"
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
              />
            </div>

            {reminderEnabled && (
              <div className="space-y-2">
                <Label htmlFor="reminderDays">{t('vaccination.reminderDaysBefore')}</Label>
                <Input
                  id="reminderDays"
                  type="number"
                  min="1"
                  max="90"
                  value={reminderDaysBefore}
                  onChange={(e) => setReminderDaysBefore(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="vaxNotes">{t('form.notes')}</Label>
            <Textarea
              id="vaxNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
