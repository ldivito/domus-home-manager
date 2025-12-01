'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, FeedingFrequency } from '@/lib/db'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Utensils } from 'lucide-react'
import { toast } from 'sonner'

interface AddFeedingScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petId: string
}

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] // Sunday to Saturday

export function AddFeedingScheduleDialog({ open, onOpenChange, petId }: AddFeedingScheduleDialogProps) {
  const t = useTranslations('pets')
  const tCommon = useTranslations('common')

  // Form state
  const [name, setName] = useState('')
  const [foodType, setFoodType] = useState('')
  const [foodBrand, setFoodBrand] = useState('')
  const [amount, setAmount] = useState('')
  const [scheduledTime, setScheduledTime] = useState('08:00')
  const [frequency, setFrequency] = useState<FeedingFrequency>('daily')
  const [specificDays, setSpecificDays] = useState<number[]>([])
  const [assignedUserId, setAssignedUserId] = useState('')
  const [notes, setNotes] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get users for assignment
  const users = useLiveQuery(() => db.users.toArray()) ?? []

  const resetForm = () => {
    setName('')
    setFoodType('')
    setFoodBrand('')
    setAmount('')
    setScheduledTime('08:00')
    setFrequency('daily')
    setSpecificDays([])
    setAssignedUserId('')
    setNotes('')
  }

  const toggleDay = (day: number) => {
    setSpecificDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim() || !foodType.trim() || !amount.trim()) {
      toast.error(t('messages.feedingFieldsRequired'))
      return
    }

    if (frequency === 'specific_days' && specificDays.length === 0) {
      toast.error(t('messages.selectDays'))
      return
    }

    setIsSubmitting(true)
    try {
      const now = new Date()
      await db.petFeedingSchedules.add({
        id: `feed_${crypto.randomUUID()}`,
        petId,
        name: name.trim(),
        foodType: foodType.trim(),
        foodBrand: foodBrand.trim() || undefined,
        amount: amount.trim(),
        scheduledTime,
        frequency,
        specificDays: frequency === 'specific_days' ? specificDays : undefined,
        assignedUserId: assignedUserId && assignedUserId !== 'anyone' ? assignedUserId : undefined,
        notes: notes.trim() || undefined,
        isActive: true,
        createdAt: now,
        updatedAt: now
      })

      toast.success(t('messages.feedingAdded'))
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Error adding feeding schedule:', error)
      toast.error(t('messages.feedingAddError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            {t('dialogs.addFeeding.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.addFeeding.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="feedingName">{t('feeding.name')} *</Label>
            <Input
              id="feedingName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('feeding.namePlaceholder')}
            />
          </div>

          {/* Food Type */}
          <div className="space-y-2">
            <Label htmlFor="foodType">{t('feeding.foodType')} *</Label>
            <Input
              id="foodType"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
              placeholder={t('feeding.foodTypePlaceholder')}
            />
          </div>

          {/* Food Brand */}
          <div className="space-y-2">
            <Label htmlFor="foodBrand">{t('feeding.foodBrand')}</Label>
            <Input
              id="foodBrand"
              value={foodBrand}
              onChange={(e) => setFoodBrand(e.target.value)}
              placeholder={t('feeding.foodBrandPlaceholder')}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">{t('feeding.amount')} *</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('feeding.amountPlaceholder')}
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="scheduledTime">{t('feeding.scheduledTime')} *</Label>
            <Input
              id="scheduledTime"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>{t('feeding.frequency')}</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as FeedingFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('feedingFrequency.daily')}</SelectItem>
                <SelectItem value="specific_days">{t('feedingFrequency.specific_days')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Specific Days */}
          {frequency === 'specific_days' && (
            <div className="space-y-2">
              <Label>{t('feeding.selectDays')}</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={specificDays.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    <label htmlFor={`day-${day}`} className="text-sm">
                      {t(`days.${day}`)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned User */}
          <div className="space-y-2">
            <Label>{t('feeding.assignedTo')}</Label>
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('feeding.selectUser')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anyone">{t('feeding.anyone')}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id!}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="feedingNotes">{t('form.notes')}</Label>
            <Textarea
              id="feedingNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('feeding.notesPlaceholder')}
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
