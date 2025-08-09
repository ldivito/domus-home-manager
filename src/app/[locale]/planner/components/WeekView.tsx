"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CalendarEvent, User } from "@/lib/db"
import { EventPill } from "./EventPill"

interface WeekViewProps {
  startOfWeek: Date // Sunday as start
  eventsByDate: Record<string, CalendarEvent[]>
  usersById: Record<number, User>
  onView?: (event: CalendarEvent) => void
  onEdit?: (event: CalendarEvent) => void
}

function formatKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function WeekView({ startOfWeek, eventsByDate, usersById, onView, onEdit }: WeekViewProps) {
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
      {days.map((day) => {
        const key = formatKey(day)
        const list = (eventsByDate[key] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
        const today = new Date()
        const isToday = today.toDateString() === day.toDateString()
        return (
          <Card key={key} className={isToday ? 'ring-2 ring-primary' : ''}>
            <CardContent className="pt-4">
              <div className="text-center mb-2">
                <div className="text-sm text-muted-foreground">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div className="text-xl font-semibold">{day.getDate()}</div>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">No events</div>
                ) : list.map(evt => (
                  <EventPill key={evt.id} event={evt} usersById={usersById} compact onView={(e)=>onView?.(e)} onEdit={(e)=>onEdit?.(e)} />
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}


