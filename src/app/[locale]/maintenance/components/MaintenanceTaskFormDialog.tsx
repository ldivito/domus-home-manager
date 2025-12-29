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
import { db, MaintenanceItem, MaintenanceTask, MaintenanceFrequency } from '@/lib/db'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface MaintenanceTaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: MaintenanceTask | null  // If provided, we're editing
  item?: MaintenanceItem | null  // Pre-selected item for new tasks
  items?: MaintenanceItem[]      // List of items for selection
}

interface TaskFormState {
  maintenanceItemId: string
  name: string
  description: string
  frequency: MaintenanceFrequency
  customFrequencyDays: number
  nextDue: string
  reminderEnabled: boolean
  reminderDaysBefore: number
  estimatedCostMin: string
  estimatedCostMax: string
  estimatedCurrency: 'ARS' | 'USD'
  estimatedDurationMinutes: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedUserId: string
  preferredProvider: string
  providerPhone: string
  providerEmail: string
  notes: string
}

const FREQUENCIES: MaintenanceFrequency[] = [
  'once', 'weekly', 'monthly', 'quarterly', 'biannually', 'yearly', 'custom'
]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

const initialFormState: TaskFormState = {
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
}

export function MaintenanceTaskFormDialog({ open, onOpenChange, task, item, items = [] }: MaintenanceTaskFormDialogProps) {
  const t = useTranslations('maintenance')
  const tCommon = useTranslations('common')

  const isEditing = !!task
  const users = useLiveQuery(() => db.users.toArray()) || []
  const [formData, setFormData] = useState<TaskFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (task) {
        // Edit mode - populate with task data
        setFormData({
          maintenanceItemId: task.maintenanceItemId,
          name: task.name,
          description: task.description || '',
          frequency: task.frequency,
          customFrequencyDays: task.customFrequencyDays || 30,
          nextDue: new Date(task.nextDue).toISOString().split('T')[0],
          reminderEnabled: task.reminderEnabled,
          reminderDaysBefore: task.reminderDaysBefore || 7,
          estimatedCostMin: task.estimatedCostMin?.toString() || '',
          estimatedCostMax: task.estimatedCostMax?.toString() || '',
          estimatedCurrency: task.estimatedCurrency || 'ARS',
          estimatedDurationMinutes: task.estimatedDurationMinutes?.toString() || '',
          priority: task.priority,
          assignedUserId: task.assignedUserId || '',
          preferredProvider: task.preferredProvider || '',
          providerPhone: task.providerPhone || '',
          providerEmail: task.providerEmail || '',
          notes: task.notes || ''
        })
      } else {
        // Create mode - reset form, optionally pre-select item
        setFormData({
          ...initialFormState,
          maintenanceItemId: item?.id || ''
        })
      }
    }
  }, [open, task, item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }

    if (!isEditing && !formData.maintenanceItemId) {
      toast.error(t('validation.itemRequired'))
      return
    }

    if (isEditing && !task?.id) return

    setIsSubmitting(true)
    try {
      const taskData = {
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
      }

      if (isEditing) {
        await db.maintenanceTasks.update(task!.id!, {
          ...taskData,
          updatedAt: new Date()
        })
        toast.success(t('messages.taskUpdated'))
      } else {
        await db.maintenanceTasks.add({
          id: `task_${crypto.randomUUID()}`,
          maintenanceItemId: formData.maintenanceItemId,
          ...taskData,
          createdAt: new Date()
        })
        toast.success(t('messages.taskAdded'))
      }

      setFormData(initialFormState)
      onOpenChange(false)
    } catch (error) {
      logger.error(`Error ${isEditing ? 'updating' : 'adding'} task:`, error)
      toast.error(isEditing ? t('messages.updateError') : t('messages.addError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing && !task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('dialogs.editTask.title') : t('dialogs.addTask.title')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Item Selection - only show for new tasks */}
            {!isEditing && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="mtask-item">{t('form.item')} *</Label>
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
            )}

            {/* Task Name */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="mtask-name">{t('form.taskName')} *</Label>
              <Input
                id="mtask-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.taskNamePlaceholder')}
              />
            </div>

            {/* Frequency and Next Due */}
            <div className="space-y-2">
              <Label htmlFor="mtask-frequency">{t('form.frequency')}</Label>
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
              <Label htmlFor="mtask-nextDue">{t('form.nextDue')} *</Label>
              <Input
                id="mtask-nextDue"
                type="date"
                value={formData.nextDue}
                onChange={(e) => setFormData({ ...formData, nextDue: e.target.value })}
              />
            </div>

            {formData.frequency === 'custom' && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="mtask-customFrequencyDays">{t('form.customDays')}</Label>
                <Input
                  id="mtask-customFrequencyDays"
                  type="number"
                  value={formData.customFrequencyDays}
                  onChange={(e) => setFormData({ ...formData, customFrequencyDays: parseInt(e.target.value) || 30 })}
                  min={1}
                />
              </div>
            )}

            {/* Priority and Assignee */}
            <div className="space-y-2">
              <Label htmlFor="mtask-priority">{t('form.priority')}</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as TaskFormState['priority'] })}
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
              <Label htmlFor="mtask-assignee">{t('form.assignee')}</Label>
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
                <Label htmlFor="mtask-reminder">{t('form.enableReminder')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.reminderDescription')}</p>
              </div>
              <Switch
                id="mtask-reminder"
                checked={formData.reminderEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, reminderEnabled: checked })}
              />
            </div>

            {formData.reminderEnabled && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="mtask-reminderDays">{t('form.reminderDaysBefore')}</Label>
                <Input
                  id="mtask-reminderDays"
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
              <Label htmlFor="mtask-costMin">{t('form.estimatedCostMin')}</Label>
              <Input
                id="mtask-costMin"
                type="number"
                value={formData.estimatedCostMin}
                onChange={(e) => setFormData({ ...formData, estimatedCostMin: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mtask-costMax">{t('form.estimatedCostMax')}</Label>
              <Input
                id="mtask-costMax"
                type="number"
                value={formData.estimatedCostMax}
                onChange={(e) => setFormData({ ...formData, estimatedCostMax: e.target.value })}
                placeholder="0"
              />
            </div>

            {/* Description */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="mtask-description">{t('form.description')}</Label>
              <Textarea
                id="mtask-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.taskDescriptionPlaceholder')}
                rows={2}
              />
            </div>

            {/* Service Provider */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="mtask-provider">{t('form.preferredProvider')}</Label>
              <Input
                id="mtask-provider"
                value={formData.preferredProvider}
                onChange={(e) => setFormData({ ...formData, preferredProvider: e.target.value })}
                placeholder={t('form.providerPlaceholder')}
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="mtask-notes">{t('form.notes')}</Label>
              <Textarea
                id="mtask-notes"
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

// Re-export with legacy names for backward compatibility
export { MaintenanceTaskFormDialog as AddTaskDialog }
export { MaintenanceTaskFormDialog as EditTaskDialog }
