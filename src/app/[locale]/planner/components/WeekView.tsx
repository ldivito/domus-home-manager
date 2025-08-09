"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CalendarEvent, User } from "@/lib/db"
import { EventPill } from "./EventPill"
import type { PlannerItem } from "../types"

interface WeekViewProps {
  startOfWeek: Date // Sunday as start
  itemsByDate: Record<string, PlannerItem[]>
  usersById: Record<number, User>
  onView?: (payload: { event: CalendarEvent; source: PlannerItem['source'] }) => void
  onEdit?: (payload: { event: CalendarEvent; source: PlannerItem['source'] }) => void
}

function formatKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function WeekView({ startOfWeek, itemsByDate, usersById, onView, onEdit }: WeekViewProps) {
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
      {days.map((day) => {
        const key = formatKey(day)
        const list = (itemsByDate[key] || []).sort((a, b) => (a.event.time || '').localeCompare(b.event.time || ''))
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
                ) : list.map((item, idx) => (
                  <EventPill
                    key={`${item.source}-${item.event.id ?? idx}`}
                    event={item.event}
                    source={item.source}
                    typeLabel={item.typeLabel}
                    usersById={usersById}
                    compact
                    onView={(payload)=>onView?.(payload)}
                    onEdit={(payload)=>onEdit?.(payload)}
                    hideEdit={item.hideEdit}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}


