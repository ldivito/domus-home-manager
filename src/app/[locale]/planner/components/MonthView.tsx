"use client"

import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { CalendarEvent, User } from "@/lib/db"
import { EventPill } from "./EventPill"
import type { PlannerItem } from "../types"

interface MonthViewProps {
  month: Date // any date within the month
  itemsByDate: Record<string, PlannerItem[]>
  usersById: Record<number, User>
  startOfWeek?: 'sunday' | 'monday'
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

function startOfGrid(month: Date, startOfWeek: 'sunday' | 'monday' = 'sunday') {
  const s = startOfMonth(month)
  const dayOfWeek = s.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  let delta: number
  if (startOfWeek === 'monday') {
    // Monday start: Sunday (0) becomes 6, Monday (1) becomes 0
    delta = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  } else {
    // Sunday start: Sunday (0) becomes 0, Monday (1) becomes 1
    delta = dayOfWeek
  }
  
  const gridStart = new Date(s)
  gridStart.setDate(s.getDate() - delta)
  return gridStart
}

function formatKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function MonthView({ month, itemsByDate, usersById, startOfWeek = 'sunday', onView, onEdit }: MonthViewProps) {
  const t = useTranslations('planner')
  const gridStart = startOfGrid(month, startOfWeek)
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })

  const currentMonth = month.getMonth()
  
  // Get day names in the correct order based on start of week
  const sundayFirstDayNames = [
    t('days.short.sun'),
    t('days.short.mon'), 
    t('days.short.tue'),
    t('days.short.wed'),
    t('days.short.thu'),
    t('days.short.fri'),
    t('days.short.sat')
  ]
  
  const dayNames = startOfWeek === 'monday'
    ? [...sundayFirstDayNames.slice(1), sundayFirstDayNames[0]] // Move Sunday to the end
    : sundayFirstDayNames

  return (
    <div className="space-y-2">
      {/* Day names header - only show on larger screens where we have 7 columns */}
      <div className="hidden sm:grid sm:grid-cols-7 gap-2">
        {dayNames.map((dayName, idx) => (
          <div key={idx} className="text-center text-sm font-semibold text-muted-foreground p-2">
            {dayName}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {cells.map((day, idx) => {
        const isCurrentMonth = day.getMonth() === currentMonth
        const key = formatKey(day)
        const list = (itemsByDate[key] || []).slice(0, 3)
        const dayOfWeekIndex = idx % 7 // Get the day of week index (0-6)
        return (
          <Card key={`${key}-${idx}`} className={!isCurrentMonth ? 'opacity-60' : ''}>
            <CardContent className="pt-2 pb-3">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-muted-foreground">
                  {dayNames[dayOfWeekIndex]}
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
                  <div className="text-[10px] text-muted-foreground">+{(itemsByDate[key]!.length - 3)} {t('more')}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
      </div>
    </div>
  )
}


