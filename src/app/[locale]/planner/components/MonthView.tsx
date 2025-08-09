"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CalendarEvent, User } from "@/lib/db"
import { EventPill } from "./EventPill"

interface MonthViewProps {
  month: Date // any date within the month
  eventsByDate: Record<string, CalendarEvent[]>
  usersById: Record<number, User>
  onView?: (event: CalendarEvent) => void
  onEdit?: (event: CalendarEvent) => void
}

function startOfMonth(d: Date) {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}

// endOfMonth was previously used; keeping startOfGrid renders full month grid

function startOfGrid(month: Date) {
  const s = startOfMonth(month)
  const day = s.getDay() // 0-6 Sunday
  const gridStart = new Date(s)
  gridStart.setDate(s.getDate() - day)
  return gridStart
}

function formatKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function MonthView({ month, eventsByDate, usersById, onView, onEdit }: MonthViewProps) {
  const gridStart = startOfGrid(month)
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })

  const currentMonth = month.getMonth()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {cells.map((day, idx) => {
        const isCurrentMonth = day.getMonth() === currentMonth
        const key = formatKey(day)
        const list = (eventsByDate[key] || []).slice(0, 3)
        return (
          <Card key={`${key}-${idx}`} className={!isCurrentMonth ? 'opacity-60' : ''}>
            <CardContent className="pt-2 pb-3">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-muted-foreground">
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div className="text-sm font-semibold">{day.getDate()}</div>
              </div>
              <div className="space-y-1">
                {list.map(evt => (
                  <EventPill key={evt.id} event={evt} usersById={usersById} compact onView={(e)=>onView?.(e)} onEdit={(e)=>onEdit?.(e)} />
                ))}
                {(eventsByDate[key]?.length || 0) > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{(eventsByDate[key]!.length - 3)} more</div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}


