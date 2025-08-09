"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CalendarEvent, User } from "@/lib/db"
import { EventPill } from "./EventPill"
import type { PlannerItem } from "../types"

interface MonthViewProps {
  month: Date // any date within the month
  itemsByDate: Record<string, PlannerItem[]>
  usersById: Record<number, User>
  onView?: (payload: { event: CalendarEvent; source: PlannerItem['source'] }) => void
  onEdit?: (payload: { event: CalendarEvent; source: PlannerItem['source'] }) => void
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

export function MonthView({ month, itemsByDate, usersById, onView, onEdit }: MonthViewProps) {
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
        const list = (itemsByDate[key] || []).slice(0, 3)
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
                {list.map((item, idx) => (
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
                {(itemsByDate[key]?.length || 0) > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{(itemsByDate[key]!.length - 3)} more</div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}


