"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Chore, User, db } from "@/lib/db"
import { CalendarDays, Clock, Repeat, Edit, User as UserIcon } from "lucide-react"
import { logger } from '@/lib/logger'

interface ChoreFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chore?: Chore | null  // If provided, we're editing. If not, we're creating.
  onCreateChore?: (chore: Omit<Chore, 'id' | 'createdAt'>) => void
  onEditChore?: (choreId: string, choreData: Partial<Chore>) => void
}

interface ChoreFormState {
  title: string
  description: string
  assignedUserId: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  customType: 'times_per_day' | 'times_per_week' | 'times_per_month' | 'days_interval'
  customValue: number
  selectedDays: number[]
  scheduledTime: string
}

const initialFormState: ChoreFormState = {
  title: '',
  description: '',
  assignedUserId: 'none',
  frequency: 'daily',
  customType: 'times_per_week',
  customValue: 2,
  selectedDays: [],
  scheduledTime: ''
}

const weekdays = [
  { value: 0, key: "sunday" },
  { value: 1, key: "monday" },
  { value: 2, key: "tuesday" },
  { value: 3, key: "wednesday" },
  { value: 4, key: "thursday" },
  { value: 5, key: "friday" },
  { value: 6, key: "saturday" }
]

export function ChoreFormModal({ open, onOpenChange, chore, onCreateChore, onEditChore }: ChoreFormModalProps) {
  const t = useTranslations('chores.addChoreModal')
  const tEdit = useTranslations('chores.editChoreModal')

  const isEditing = !!chore
  const [formState, setFormState] = useState<ChoreFormState>(initialFormState)
  const [users, setUsers] = useState<User[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load users and populate form
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const dbUsers = await db.users.toArray()
        setUsers(dbUsers)
      } catch (error) {
        logger.error('Error loading users:', error)
      }
    }

    if (open) {
      loadUsers()

      if (chore) {
        // Edit mode - populate with chore data
        setFormState({
          title: chore.title,
          description: chore.description || '',
          assignedUserId: chore.assignedUserId?.toString() || 'none',
          frequency: chore.frequency,
          customType: chore.customFrequency?.type || 'times_per_week',
          customValue: chore.customFrequency?.value || 2,
          selectedDays: chore.customFrequency?.specificDays || [],
          scheduledTime: chore.scheduledTime || ''
        })
      } else {
        // Create mode - reset form
        setFormState(initialFormState)
      }
    }
  }, [open, chore])

  const updateField = <K extends keyof ChoreFormState>(field: K, value: ChoreFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }

  const calculateNextDue = () => {
    const now = new Date()

    switch (formState.frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      case 'monthly':
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return nextMonth
      case 'custom':
        if (formState.customType === 'days_interval') {
          return new Date(now.getTime() + formState.customValue * 24 * 60 * 60 * 1000)
        }
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formState.title.trim()) return
    if (isEditing && !chore?.id) return

    setIsSubmitting(true)

    try {
      const choreData = {
        title: formState.title.trim(),
        description: formState.description.trim() || undefined,
        assignedUserId: formState.assignedUserId && formState.assignedUserId !== 'none' ? formState.assignedUserId : undefined,
        frequency: formState.frequency,
        customFrequency: formState.frequency === 'custom' ? {
          type: formState.customType,
          value: formState.customValue,
          specificDays: formState.customType === 'times_per_week' && formState.selectedDays.length > 0 ? formState.selectedDays : undefined
        } : undefined,
        scheduledTime: formState.scheduledTime || undefined,
      }

      if (isEditing && onEditChore) {
        await onEditChore(chore!.id!, choreData)
      } else if (onCreateChore) {
        const newChore: Omit<Chore, 'id' | 'createdAt'> = {
          ...choreData,
          nextDue: calculateNextDue(),
          isCompleted: false
        }
        await onCreateChore(newChore)
      }

      setFormState(initialFormState)
      onOpenChange(false)
    } catch (error) {
      logger.error(`Error ${isEditing ? 'editing' : 'creating'} chore:`, error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleDay = (day: number) => {
    setFormState(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day].sort()
    }))
  }

  const getAssignedUser = () => {
    return formState.assignedUserId && formState.assignedUserId !== 'none'
      ? users.find(user => user.id?.toString() === formState.assignedUserId)
      : null
  }

  if (isEditing && !chore) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] glass-card shadow-modern-lg border-2 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-3">
            {isEditing ? (
              <>
                <Edit className="h-8 w-8 text-primary" />
                {tEdit('title')}
              </>
            ) : (
              <>
                <Repeat className="h-8 w-8 text-primary" />
                {t('title')}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="chore-title" className="text-base font-medium">
              {t('choreName')}
            </Label>
            <Input
              id="chore-title"
              value={formState.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('choreNamePlaceholder')}
              className="h-12 text-base"
              required
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="chore-description" className="text-base font-medium">
              {t('description')}
            </Label>
            <Input
              id="chore-description"
              value={formState.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className="h-12 text-base"
            />
          </div>

          {/* User Assignment */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              {t('assignTo')}
            </Label>

            {getAssignedUser() && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <Avatar className={`h-10 w-10 ${getAssignedUser()?.color}`}>
                  <AvatarFallback className="text-white font-bold">
                    {getAssignedUser()?.avatar || getAssignedUser()?.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{getAssignedUser()?.name}</span>
              </div>
            )}

            <Select value={formState.assignedUserId} onValueChange={(v) => updateField('assignedUserId', v)}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={t('selectUser')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="py-3">
                  <span className="text-muted-foreground">{t('noAssignment')}</span>
                </SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id?.toString() || "none"} className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className={`h-6 w-6 ${user.color}`}>
                        <AvatarFallback className="text-white text-xs font-bold">
                          {user.avatar || user.name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled Time */}
          <div className="space-y-3">
            <Label htmlFor="chore-scheduledTime" className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('scheduledTime')}
            </Label>
            <Input
              id="chore-scheduledTime"
              type="time"
              value={formState.scheduledTime}
              onChange={(e) => updateField('scheduledTime', e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Frequency Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('frequency')}
            </Label>
            <Select
              value={formState.frequency}
              onValueChange={(v: 'daily' | 'weekly' | 'monthly' | 'custom') => updateField('frequency', v)}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily" className="py-3">
                  <div>
                    <div className="font-medium">{t('daily')}</div>
                    <div className="text-sm text-muted-foreground">{t('dailyDescription')}</div>
                  </div>
                </SelectItem>
                <SelectItem value="weekly" className="py-3">
                  <div>
                    <div className="font-medium">{t('weekly')}</div>
                    <div className="text-sm text-muted-foreground">{t('weeklyDescription')}</div>
                  </div>
                </SelectItem>
                <SelectItem value="monthly" className="py-3">
                  <div>
                    <div className="font-medium">{t('monthly')}</div>
                    <div className="text-sm text-muted-foreground">{t('monthlyDescription')}</div>
                  </div>
                </SelectItem>
                <SelectItem value="custom" className="py-3">
                  <div>
                    <div className="font-medium">{t('custom')}</div>
                    <div className="text-sm text-muted-foreground">{t('customDescription')}</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Frequency Options */}
          {formState.frequency === 'custom' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed">
              <h4 className="font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {t('customSchedule')}
              </h4>

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  {t('pattern')}
                </Label>
                <Select
                  value={formState.customType}
                  onValueChange={(v: ChoreFormState['customType']) => updateField('customType', v)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="times_per_day">{t('timesPerDay')}</SelectItem>
                    <SelectItem value="times_per_week">{t('timesPerWeek')}</SelectItem>
                    <SelectItem value="times_per_month">{t('timesPerMonth')}</SelectItem>
                    <SelectItem value="days_interval">{t('everyXDays')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  {formState.customType === 'days_interval' ? t('daysInterval') : t('numberOfTimes')}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={formState.customType === 'times_per_day' ? 10 : formState.customType === 'times_per_week' ? 7 : formState.customType === 'times_per_month' ? 31 : 365}
                  value={formState.customValue}
                  onChange={(e) => updateField('customValue', parseInt(e.target.value) || 1)}
                  className="h-10"
                />
              </div>

              {/* Specific Days Selection for Weekly */}
              {formState.customType === 'times_per_week' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    {t('specificDays')}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {weekdays.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`chore-day-${day.value}`}
                          checked={formState.selectedDays.includes(day.value)}
                          onCheckedChange={() => toggleDay(day.value)}
                        />
                        <Label htmlFor={`chore-day-${day.value}`} className="text-sm cursor-pointer">
                          {t(day.key)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-14 text-base font-medium hover:bg-muted/80 transition-all duration-200"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!formState.title.trim() || isSubmitting}
              className="flex-1 h-14 text-base font-medium shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                isEditing ? tEdit('save') : t('create')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Re-export with legacy names for backward compatibility
export { ChoreFormModal as AddChoreModal }
export { ChoreFormModal as EditChoreModal }
