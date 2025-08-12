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
import { CalendarDays, Clock, Edit, User as UserIcon } from "lucide-react"

interface EditChoreModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditChore: (choreId: string, choreData: Partial<Chore>) => void
  chore: Chore | null
}

export function EditChoreModal({ open, onOpenChange, onEditChore, chore }: EditChoreModalProps) {
  const t = useTranslations('chores.addChoreModal')
  const tEdit = useTranslations('chores.editChoreModal')
  
  const weekdays = [
    { value: 0, key: "sunday" },
    { value: 1, key: "monday" },
    { value: 2, key: "tuesday" },
    { value: 3, key: "wednesday" },
    { value: 4, key: "thursday" },
    { value: 5, key: "friday" },
    { value: 6, key: "saturday" }
  ]
  
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assignedUserId, setAssignedUserId] = useState<string>("none")
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>("daily")
  const [customType, setCustomType] = useState<'times_per_day' | 'times_per_week' | 'times_per_month' | 'days_interval'>('times_per_week')
  const [customValue, setCustomValue] = useState(2)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [scheduledTime, setScheduledTime] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load users and populate form when chore changes
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const dbUsers = await db.users.toArray()
        setUsers(dbUsers)
      } catch (error) {
        console.error('Error loading users:', error)
      }
    }
    
    if (open) {
      loadUsers()
      
      // Populate form with chore data
      if (chore) {
        setTitle(chore.title)
        setDescription(chore.description || "")
        setAssignedUserId(chore.assignedUserId?.toString() || "none")
        setFrequency(chore.frequency)
        setScheduledTime(chore.scheduledTime || "")
        
        if (chore.customFrequency) {
          setCustomType(chore.customFrequency.type)
          setCustomValue(chore.customFrequency.value)
          setSelectedDays(chore.customFrequency.specificDays || [])
        }
      }
    }
  }, [open, chore])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !chore?.id) return

    setIsSubmitting(true)
    
    try {
      const updatedChore: Partial<Chore> = {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedUserId: assignedUserId && assignedUserId !== "none" ? assignedUserId : undefined,
        frequency,
        customFrequency: frequency === 'custom' ? {
          type: customType,
          value: customValue,
          specificDays: customType === 'times_per_week' && selectedDays.length > 0 ? selectedDays : undefined
        } : undefined,
        scheduledTime: scheduledTime || undefined,
      }

      await onEditChore(chore.id, updatedChore)
      onOpenChange(false)
    } catch (error) {
      console.error('Error editing chore:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const getAssignedUser = () => {
    return assignedUserId && assignedUserId !== "none" ? users.find(user => user.id?.toString() === assignedUserId) : null
  }

  if (!chore) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] glass-card shadow-modern-lg border-2 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-3">
            <Edit className="h-8 w-8 text-primary" />
            {tEdit('title')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-medium">
              {t('choreName')}
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('choreNamePlaceholder')}
              className="h-12 text-base"
              required
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-medium">
              {t('description')}
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                    {getAssignedUser()?.avatar || getAssignedUser()?.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{getAssignedUser()?.name}</span>
              </div>
            )}
            
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
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
                          {user.avatar || user.name.charAt(0).toUpperCase()}
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
            <Label htmlFor="scheduledTime" className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('scheduledTime')}
            </Label>
            <Input
              id="scheduledTime"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Frequency Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('frequency')}
            </Label>
            <Select value={frequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'custom') => setFrequency(value)}>
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
          {frequency === 'custom' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed">
              <h4 className="font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {t('customSchedule')}
              </h4>
              
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  {t('pattern')}
                </Label>
                <Select value={customType} onValueChange={(value: typeof customType) => setCustomType(value)}>
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
                  {customType === 'days_interval' ? t('daysInterval') : t('numberOfTimes')}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={customType === 'times_per_day' ? 10 : customType === 'times_per_week' ? 7 : customType === 'times_per_month' ? 31 : 365}
                  value={customValue}
                  onChange={(e) => setCustomValue(parseInt(e.target.value) || 1)}
                  className="h-10"
                />
              </div>

              {/* Specific Days Selection for Weekly */}
              {customType === 'times_per_week' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    {t('specificDays')}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {weekdays.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={selectedDays.includes(day.value)}
                          onCheckedChange={() => toggleDay(day.value)}
                        />
                        <Label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
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
              disabled={!title.trim() || isSubmitting}
              className="flex-1 h-14 text-base font-medium shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                tEdit('save')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}