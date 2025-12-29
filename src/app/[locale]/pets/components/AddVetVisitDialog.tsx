'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, VetVisitType } from '@/lib/db'
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
import { Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface AddVetVisitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petId: string
}

const VISIT_TYPES: VetVisitType[] = ['checkup', 'vaccination', 'illness', 'injury', 'surgery', 'dental', 'grooming', 'emergency', 'other']

export function AddVetVisitDialog({ open, onOpenChange, petId }: AddVetVisitDialogProps) {
  const t = useTranslations('pets')
  const tCommon = useTranslations('common')

  // Form state
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [visitType, setVisitType] = useState<VetVisitType>('checkup')
  const [vetName, setVetName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [reason, setReason] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [treatment, setTreatment] = useState('')
  const [prescriptions, setPrescriptions] = useState('')
  const [cost, setCost] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setVisitDate(new Date().toISOString().split('T')[0])
    setVisitType('checkup')
    setVetName('')
    setClinicName('')
    setReason('')
    setDiagnosis('')
    setTreatment('')
    setPrescriptions('')
    setCost('')
    setCurrency('ARS')
    setFollowUpDate('')
    setFollowUpNotes('')
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error(t('messages.vetVisitReasonRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const now = new Date()

      await db.petVetVisits.add({
        id: `vet_${crypto.randomUUID()}`,
        petId,
        visitDate: new Date(visitDate),
        visitType,
        vetName: vetName.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        reason: reason.trim(),
        diagnosis: diagnosis.trim() || undefined,
        treatment: treatment.trim() || undefined,
        prescriptions: prescriptions.trim() || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        currency,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        followUpNotes: followUpNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      })

      toast.success(t('messages.vetVisitAdded'))
      resetForm()
      onOpenChange(false)
    } catch (error) {
      logger.error('Error adding vet visit:', error)
      toast.error(t('messages.vetVisitAddError'))
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
            <Calendar className="h-5 w-5" />
            {t('dialogs.addVetVisit.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.addVetVisit.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Visit Date */}
          <div className="space-y-2">
            <Label htmlFor="visitDate">{t('vetVisit.visitDate')} *</Label>
            <Input
              id="visitDate"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </div>

          {/* Visit Type */}
          <div className="space-y-2">
            <Label>{t('vetVisit.visitType')}</Label>
            <Select value={visitType} onValueChange={(v) => setVisitType(v as VetVisitType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`visitTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vet & Clinic */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vetName">{t('vetVisit.vetName')}</Label>
              <Input
                id="vetName"
                value={vetName}
                onChange={(e) => setVetName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinicName">{t('vetVisit.clinicName')}</Label>
              <Input
                id="clinicName"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">{t('vetVisit.reason')} *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('vetVisit.reasonPlaceholder')}
              rows={2}
            />
          </div>

          {/* Diagnosis */}
          <div className="space-y-2">
            <Label htmlFor="diagnosis">{t('vetVisit.diagnosis')}</Label>
            <Textarea
              id="diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
            />
          </div>

          {/* Treatment */}
          <div className="space-y-2">
            <Label htmlFor="treatment">{t('vetVisit.treatment')}</Label>
            <Textarea
              id="treatment"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              rows={2}
            />
          </div>

          {/* Prescriptions */}
          <div className="space-y-2">
            <Label htmlFor="prescriptions">{t('vetVisit.prescriptions')}</Label>
            <Textarea
              id="prescriptions"
              value={prescriptions}
              onChange={(e) => setPrescriptions(e.target.value)}
              placeholder={t('vetVisit.prescriptionsPlaceholder')}
              rows={2}
            />
          </div>

          {/* Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">{t('vetVisit.cost')}</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('vetVisit.currency')}</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as 'ARS' | 'USD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Follow-up */}
          <div className="space-y-4 pt-2 border-t">
            <h4 className="font-medium">{t('vetVisit.followUp')}</h4>
            <div className="space-y-2">
              <Label htmlFor="followUpDate">{t('vetVisit.followUpDate')}</Label>
              <Input
                id="followUpDate"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
            {followUpDate && (
              <div className="space-y-2">
                <Label htmlFor="followUpNotes">{t('vetVisit.followUpNotes')}</Label>
                <Textarea
                  id="followUpNotes"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="visitNotes">{t('form.notes')}</Label>
            <Textarea
              id="visitNotes"
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
