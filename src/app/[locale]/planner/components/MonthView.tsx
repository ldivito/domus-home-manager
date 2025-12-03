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

  const today = new Date()

  return (
    <div className="space-y-2">
      {/* Mobile: Horizontally scrollable calendar */}
      <div className="sm:hidden -mx-2 px-2 overflow-x-auto scrollbar-thin">
        <div style={{ minWidth: '500px' }}>
          {/* Day names header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map((dayName, idx) => (
              <div key={idx} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === currentMonth
              const isToday = today.toDateString() === day.toDateString()
              const key = formatKey(day)
              const list = (itemsByDate[key] || []).slice(0, 2)
              return (
                <div
                  key={`${key}-${idx}`}
                  className={`
                    min-h-[70px] p-1 rounded-md border bg-card/80
                    ${!isCurrentMonth ? 'opacity-40' : ''}
                    ${isToday ? 'ring-2 ring-primary ring-inset' : ''}
                  `}
                >
                  <div className="text-xs font-medium text-right mb-0.5">{day.getDate()}</div>
                  <div className="space-y-0.5">
                    {list.map((item, itemIdx) => (
                      <EventPill
                        key={`${item.source}-${item.event.id ?? itemIdx}`}
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
                    {(itemsByDate[key]?.length || 0) > 2 && (
                      <div className="text-[8px] text-muted-foreground text-center">+{(itemsByDate[key]!.length - 2)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Desktop: Standard grid view */}
      <div className="hidden sm:block space-y-2">
        {/* Day names header */}
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((dayName, idx) => (
            <div key={idx} className="text-center text-sm font-semibold text-muted-foreground p-2">
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentMonth
            const isToday = today.toDateString() === day.toDateString()
            const key = formatKey(day)
            const list = (itemsByDate[key] || []).slice(0, 3)
            return (
              <Card key={`${key}-${idx}`} className={`${!isCurrentMonth ? 'opacity-60' : ''} ${isToday ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-2 pb-3">
                  <div className="text-sm font-semibold text-right mb-1">{day.getDate()}</div>
                  <div className="space-y-1">
                    {list.map((item, itemIdx) => (
                      <EventPill
                        key={`${item.source}-${item.event.id ?? itemIdx}`}
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
    </div>
  )
}


