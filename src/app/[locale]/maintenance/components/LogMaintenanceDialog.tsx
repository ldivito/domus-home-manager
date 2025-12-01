'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { db, MaintenanceTask, MaintenanceItem, MaintenanceFrequency } from '@/lib/db'
import { toast } from 'sonner'

interface LogMaintenanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: MaintenanceTask | null
  items: MaintenanceItem[]
}

function calculateNextDueDate(frequency: MaintenanceFrequency, customDays?: number): Date {
  const now = new Date()
  switch (frequency) {
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    case 'quarterly':
      return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
    case 'biannually':
      return new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
    case 'yearly':
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    case 'custom':
      return new Date(now.getTime() + (customDays || 30) * 24 * 60 * 60 * 1000)
    case 'once':
    default:
      return now
  }
}

export function LogMaintenanceDialog({ open, onOpenChange, task, items }: LogMaintenanceDialogProps) {
  const t = useTranslations('maintenance')
  const tCommon = useTranslations('common')

  const users = useLiveQuery(() => db.users.toArray()) || []

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    completedDate: new Date().toISOString().split('T')[0],
    completedByUserId: '',
    actualCost: '',
    costCurrency: 'ARS' as 'ARS' | 'USD',
    serviceProvider: '',
    isExternalService: false,
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (task) {
      setFormData(prev => ({
        ...prev,
        title: task.name,
        serviceProvider: task.preferredProvider || '',
        completedByUserId: task.assignedUserId || ''
      }))
    }
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task?.id) return
    if (!formData.title.trim()) {
      toast.error(t('validation.titleRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      // Add maintenance log
      await db.maintenanceLogs.add({
        id: `log_${crypto.randomUUID()}`,
        maintenanceItemId: task.maintenanceItemId,
        maintenanceTaskId: task.id,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        completedDate: new Date(formData.completedDate),
        completedByUserId: formData.completedByUserId && formData.completedByUserId !== '__none__' ? formData.completedByUserId : undefined,
        actualCost: formData.actualCost ? parseFloat(formData.actualCost) : undefined,
        costCurrency: formData.costCurrency,
        serviceProvider: formData.serviceProvider.trim() || undefined,
        isExternalService: formData.isExternalService,
        notes: formData.notes.trim() || undefined,
        createdAt: new Date()
      })

      // Update task with next due date (if not a one-time task)
      if (task.frequency !== 'once') {
        const nextDue = calculateNextDueDate(task.frequency, task.customFrequencyDays)
        await db.maintenanceTasks.update(task.id, {
          lastCompleted: new Date(formData.completedDate),
          nextDue,
          updatedAt: new Date()
        })
      } else {
        // For one-time tasks, just mark as completed
        await db.maintenanceTasks.delete(task.id)
      }

      toast.success(t('messages.maintenanceLogged'))
      onOpenChange(false)
      setFormData({
        title: '',
        description: '',
        completedDate: new Date().toISOString().split('T')[0],
        completedByUserId: '',
        actualCost: '',
        costCurrency: 'ARS',
        serviceProvider: '',
        isExternalService: false,
        notes: ''
      })
    } catch (error) {
      console.error('Error logging maintenance:', error)
      toast.error(t('messages.logError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!task) return null

  const item = items.find(i => i.id === task.maintenanceItemId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dialogs.logMaintenance.title')}</DialogTitle>
          <DialogDescription>
            {item?.name && `${item.name} - `}{task.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('form.workPerformed')} *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('form.workPerformedPlaceholder')}
              />
            </div>

            {/* Completed Date and By */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="completedDate">{t('form.completedDate')}</Label>
                <Input
                  id="completedDate"
                  type="date"
                  value={formData.completedDate}
                  onChange={(e) => setFormData({ ...formData, completedDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="completedBy">{t('form.completedBy')}</Label>
                <Select
                  value={formData.completedByUserId}
                  onValueChange={(value) => setFormData({ ...formData, completedByUserId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectUser')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('form.notSpecified')}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id || `user_${user.name}`}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* External Service Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="external">{t('form.externalService')}</Label>
                <p className="text-sm text-muted-foreground">{t('form.externalServiceDescription')}</p>
              </div>
              <Switch
                id="external"
                checked={formData.isExternalService}
                onCheckedChange={(checked) => setFormData({ ...formData, isExternalService: checked })}
              />
            </div>

            {/* Service Provider (if external) */}
            {formData.isExternalService && (
              <div className="space-y-2">
                <Label htmlFor="provider">{t('form.serviceProvider')}</Label>
                <Input
                  id="provider"
                  value={formData.serviceProvider}
                  onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value })}
                  placeholder={t('form.providerPlaceholder')}
                />
              </div>
            )}

            {/* Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">{t('form.actualCost')}</Label>
                <Input
                  id="cost"
                  type="number"
                  value={formData.actualCost}
                  onChange={(e) => setFormData({ ...formData, actualCost: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">{t('form.currency')}</Label>
                <Select
                  value={formData.costCurrency}
                  onValueChange={(value) => setFormData({ ...formData, costCurrency: value as 'ARS' | 'USD' })}
                >
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

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.logDescriptionPlaceholder')}
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
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
              {isSubmitting ? tCommon('saving') : t('actions.logMaintenance')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
