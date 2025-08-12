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
import { db, CalendarEvent, User as UserType } from "@/lib/db"

type EventType = 'general' | 'task' | 'meal' | 'reminder'

interface EditEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: UserType[]
  event: CalendarEvent | null
}

export function EditEventDialog({ open, onOpenChange, users, event }: EditEventDialogProps) {
  const t = useTranslations('planner')
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState<string>("")
  const [time, setTime] = useState<string>("")
  const [type, setType] = useState<EventType>('general')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && event) {
      setTitle(event.title)
      setDescription(event.description || "")
      const d = new Date(event.date)
      const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0')
      setDate(`${yyyy}-${mm}-${dd}`)
      setTime(event.time || "")
      setType(event.type)
      setSelectedUserIds([...(event.userIds || [])])
    }
  }, [open, event])

  const toggleUser = (id: string) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (!event) return
    if (!title.trim() || !date) return
    setIsSubmitting(true)
    try {
      await db.calendarEvents.update(event.id!, {
        title: title.trim(),
        description: description.trim() || undefined,
        date: new Date(`${date}T12:00:00`),
        time: time || undefined,
        type,
        userIds: selectedUserIds.length ? selectedUserIds : undefined,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('editEvent')}</DialogTitle>
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
              <Select value={type} onValueChange={(v) => setType(v as EventType)}>
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
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: user.color }} />
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={!title.trim() || !date || isSubmitting}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


