"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarEvent, User } from "@/lib/db"
import { EventPill } from "./EventPill"

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  usersById: Record<number, User>
  onView?: (event: CalendarEvent) => void
  onEdit?: (event: CalendarEvent) => void
}

export function DayView({ date, events, usersById, onView, onEdit }: DayViewProps) {
  const sorted = [...events].sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.length === 0 && (
            <div className="text-center text-muted-foreground py-8">No events</div>
          )}
          {sorted.map(evt => (
            <EventPill key={evt.id} event={evt} usersById={usersById} onView={(e)=>onView?.(e)} onEdit={(e)=>onEdit?.(e)} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


