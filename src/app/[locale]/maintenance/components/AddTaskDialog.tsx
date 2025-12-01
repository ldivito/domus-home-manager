'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db, MaintenanceItem, MaintenanceFrequency } from '@/lib/db'
import { toast } from 'sonner'

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MaintenanceItem | null
  items: MaintenanceItem[]
}

const FREQUENCIES: MaintenanceFrequency[] = [
  'once', 'weekly', 'monthly', 'quarterly', 'biannually', 'yearly', 'custom'
]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export function AddTaskDialog({ open, onOpenChange, item, items }: AddTaskDialogProps) {
  const t = useTranslations('maintenance')
  const tCommon = useTranslations('common')

  const users = useLiveQuery(() => db.users.toArray()) || []

  const [formData, setFormData] = useState({
    maintenanceItemId: '',
    name: '',
    description: '',
    frequency: 'monthly' as MaintenanceFrequency,
    customFrequencyDays: 30,
    nextDue: new Date().toISOString().split('T')[0],
    reminderEnabled: true,
    reminderDaysBefore: 7,
    estimatedCostMin: '',
    estimatedCostMax: '',
    estimatedCurrency: 'ARS' as 'ARS' | 'USD',
    estimatedDurationMinutes: '',
    priority: 'medium' as typeof PRIORITIES[number],
    assignedUserId: '',
    preferredProvider: '',
    providerPhone: '',
    providerEmail: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (item) {
      setFormData(prev => ({ ...prev, maintenanceItemId: item.id || '' }))
    }
  }, [item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }
    if (!formData.maintenanceItemId) {
      toast.error(t('validation.itemRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      await db.maintenanceTasks.add({
        id: `task_${crypto.randomUUID()}`,
        maintenanceItemId: formData.maintenanceItemId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        frequency: formData.frequency,
        customFrequencyDays: formData.frequency === 'custom' ? formData.customFrequencyDays : undefined,
        nextDue: new Date(formData.nextDue),
        reminderEnabled: formData.reminderEnabled,
        reminderDaysBefore: formData.reminderEnabled ? formData.reminderDaysBefore : undefined,
        estimatedCostMin: formData.estimatedCostMin ? parseFloat(formData.estimatedCostMin) : undefined,
        estimatedCostMax: formData.estimatedCostMax ? parseFloat(formData.estimatedCostMax) : undefined,
        estimatedCurrency: formData.estimatedCurrency,
        estimatedDurationMinutes: formData.estimatedDurationMinutes ? parseInt(formData.estimatedDurationMinutes) : undefined,
        priority: formData.priority,
        assignedUserId: formData.assignedUserId && formData.assignedUserId !== '__none__' ? formData.assignedUserId : undefined,
        preferredProvider: formData.preferredProvider.trim() || undefined,
        providerPhone: formData.providerPhone.trim() || undefined,
        providerEmail: formData.providerEmail.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        createdAt: new Date()
      })

      toast.success(t('messages.taskAdded'))
      onOpenChange(false)
      setFormData({
        maintenanceItemId: '',
        name: '',
        description: '',
        frequency: 'monthly',
        customFrequencyDays: 30,
        nextDue: new Date().toISOString().split('T')[0],
        reminderEnabled: true,
        reminderDaysBefore: 7,
        estimatedCostMin: '',
        estimatedCostMax: '',
        estimatedCurrency: 'ARS',
        estimatedDurationMinutes: '',
        priority: 'medium',
        assignedUserId: '',
        preferredProvider: '',
        providerPhone: '',
        providerEmail: '',
        notes: ''
      })
    } catch (error) {
      console.error('Error adding task:', error)
      toast.error(t('messages.addError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dialogs.addTask.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Item Selection */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="item">{t('form.item')} *</Label>
              <Select
                value={formData.maintenanceItemId}
                onValueChange={(value) => setFormData({ ...formData, maintenanceItemId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectItem')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id || ''}>
                      {i.name} {i.location && `(${i.location})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task Name */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">{t('form.taskName')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.taskNamePlaceholder')}
              />
            </div>

            {/* Frequency and Next Due */}
            <div className="space-y-2">
              <Label htmlFor="frequency">{t('form.frequency')}</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value as MaintenanceFrequency })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {t(`frequencies.${freq}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextDue">{t('form.nextDue')} *</Label>
              <Input
                id="nextDue"
                type="date"
                value={formData.nextDue}
                onChange={(e) => setFormData({ ...formData, nextDue: e.target.value })}
              />
            </div>

            {formData.frequency === 'custom' && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="customFrequencyDays">{t('form.customDays')}</Label>
                <Input
                  id="customFrequencyDays"
                  type="number"
                  value={formData.customFrequencyDays}
                  onChange={(e) => setFormData({ ...formData, customFrequencyDays: parseInt(e.target.value) || 30 })}
                  min={1}
                />
              </div>
            )}

            {/* Priority and Assignee */}
            <div className="space-y-2">
              <Label htmlFor="priority">{t('form.priority')}</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as typeof PRIORITIES[number] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`priorities.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignee">{t('form.assignee')}</Label>
              <Select
                value={formData.assignedUserId}
                onValueChange={(value) => setFormData({ ...formData, assignedUserId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.unassigned')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('form.unassigned')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id || `user_${user.name}`}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reminder */}
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="reminder">{t('form.enableReminder')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.reminderDescription')}</p>
              </div>
              <Switch
                id="reminder"
                checked={formData.reminderEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, reminderEnabled: checked })}
              />
            </div>

            {formData.reminderEnabled && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="reminderDays">{t('form.reminderDaysBefore')}</Label>
                <Input
                  id="reminderDays"
                  type="number"
                  value={formData.reminderDaysBefore}
                  onChange={(e) => setFormData({ ...formData, reminderDaysBefore: parseInt(e.target.value) || 7 })}
                  min={1}
                  max={90}
                />
              </div>
            )}

            {/* Cost Estimates */}
            <div className="space-y-2">
              <Label htmlFor="costMin">{t('form.estimatedCostMin')}</Label>
              <Input
                id="costMin"
                type="number"
                value={formData.estimatedCostMin}
                onChange={(e) => setFormData({ ...formData, estimatedCostMin: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="costMax">{t('form.estimatedCostMax')}</Label>
              <Input
                id="costMax"
                type="number"
                value={formData.estimatedCostMax}
                onChange={(e) => setFormData({ ...formData, estimatedCostMax: e.target.value })}
                placeholder="0"
              />
            </div>

            {/* Description */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">{t('form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.taskDescriptionPlaceholder')}
                rows={2}
              />
            </div>

            {/* Service Provider */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="provider">{t('form.preferredProvider')}</Label>
              <Input
                id="provider"
                value={formData.preferredProvider}
                onChange={(e) => setFormData({ ...formData, preferredProvider: e.target.value })}
                placeholder={t('form.providerPlaceholder')}
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">{t('form.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('form.notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
