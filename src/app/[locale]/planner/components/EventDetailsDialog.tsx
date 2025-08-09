"use client"

import { CalendarEvent, User } from "@/lib/db"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { Clock, Users, Trash2, Pencil } from "lucide-react"

interface EventDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: CalendarEvent | null
  usersById: Record<number, User>
  onEdit: (event: CalendarEvent) => void
  onDelete: (event: CalendarEvent) => void
}

export function EventDetailsDialog({ open, onOpenChange, event, usersById, onEdit, onDelete }: EventDetailsDialogProps) {
  const t = useTranslations('planner')
  if (!event) return null
  const assignedNames = (event.userIds || []).map(id => usersById[id]?.name).filter(Boolean)
  const date = new Date(event.date)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">{date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" /> {event.time || 'All day'}</div>
          <div className="text-xs inline-block px-2 py-0.5 rounded border w-fit">{t(`types.${event.type}`)}</div>
          {event.description && (
            <div className="text-sm whitespace-pre-wrap">{event.description}</div>
          )}
          {assignedNames.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              <span>{assignedNames.join(', ')}</span>
            </div>
          )}
        </div>
        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('close')}</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(event)}>
              <Pencil className="h-4 w-4 mr-2" />{t('edit')}
            </Button>
            <Button variant="destructive" onClick={() => onDelete(event)}>
              <Trash2 className="h-4 w-4 mr-2" />{t('delete')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


