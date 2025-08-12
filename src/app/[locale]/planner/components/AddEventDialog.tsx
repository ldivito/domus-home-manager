"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { db, User as UserType, CalendarEvent } from "@/lib/db"
import { generateId } from "@/lib/utils"

type EventType = 'general' | 'task' | 'meal' | 'reminder'

interface AddEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: UserType[]
  defaultDate?: Date
  onCreated?: () => void
}

export function AddEventDialog({ open, onOpenChange, users, defaultDate, onCreated }: AddEventDialogProps) {
  const t = useTranslations('planner')
  const tCommon = useTranslations('common')

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState<string>("")
  const [time, setTime] = useState<string>("")
  const [type, setType] = useState<EventType>('general')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize date with provided default
  useEffect(() => {
    if (open) {
      if (defaultDate) {
        const local = new Date(defaultDate)
        const yyyy = local.getFullYear()
        const mm = String(local.getMonth() + 1).padStart(2, '0')
        const dd = String(local.getDate()).padStart(2, '0')
        setDate(`${yyyy}-${mm}-${dd}`)
      } else {
        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        setDate(`${yyyy}-${mm}-${dd}`)
      }
      setTime("")
      setType('general')
      setSelectedUserIds([])
      setTitle("")
      setDescription("")
    }
  }, [open, defaultDate])

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  const handleCreate = async () => {
    if (!title.trim() || !date) return
    setIsSubmitting(true)
    try {
      const eventDate = new Date(`${date}T12:00:00`)
      const event: CalendarEvent = {
        id: generateId('evt'),
        title: title.trim(),
        description: description.trim() || undefined,
        date: eventDate,
        time: time || undefined,
        type,
        userIds: selectedUserIds.length ? selectedUserIds : undefined,
        createdAt: new Date()
      }
      await db.calendarEvents.add(event)
      onCreated?.()
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('addEvent')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">{t('form.title')} *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('form.titlePlaceholder')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('form.description')}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.descriptionPlaceholder')} rows={3} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">{t('form.date')} *</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">{t('form.time')}</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t('form.type')}</Label>
              <Select value={type} onValueChange={(value) => setType(value as EventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">{t('types.general')}</SelectItem>
                  <SelectItem value="task">{t('types.task')}</SelectItem>
                  <SelectItem value="meal">{t('types.meal')}</SelectItem>
                  <SelectItem value="reminder">{t('types.reminder')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('form.assignedUsers')}</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                {users.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">{t('noUsers')}</div>
                ) : (
                  <div className="space-y-2">
                    {users.map(user => (
                      <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedUserIds.includes(user.id!)}
                          onCheckedChange={() => toggleUser(user.id!)}
                        />
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: user.color }}
                          />
                          {user.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tCommon('cancel')}</Button>
          <Button onClick={handleCreate} disabled={!title.trim() || !date || isSubmitting}>
            {isSubmitting ? t('form.creating') : t('form.createEvent')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


