"use client"

import { useTranslations } from 'next-intl'
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
  const t = useTranslations('planner')
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  // Get day names in the correct order based on the week start
  const sundayFirstDayNames = [
    t('days.short.sun'),
    t('days.short.mon'), 
    t('days.short.tue'),
    t('days.short.wed'),
    t('days.short.thu'),
    t('days.short.fri'),
    t('days.short.sat')
  ]
  
  // Check if we're starting with Monday by looking at the first day
  const startsWithMonday = startOfWeek.getDay() === 1
  const dayNames = startsWithMonday
    ? [...sundayFirstDayNames.slice(1), sundayFirstDayNames[0]] // Move Sunday to the end
    : sundayFirstDayNames

  return (
    <>
      {/* Mobile: Horizontal scroll view */}
      <div className="md:hidden -mx-2 px-2 overflow-x-auto scrollbar-thin">
        <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
          {days.map((day, index) => {
            const key = formatKey(day)
            const list = (itemsByDate[key] || []).sort((a, b) => (a.event.time || '').localeCompare(b.event.time || ''))
            const today = new Date()
            const isToday = today.toDateString() === day.toDateString()
            return (
              <Card key={key} className={`w-[140px] shrink-0 ${isToday ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-3 pb-3 px-2">
                  <div className="text-center mb-2">
                    <div className="text-xs text-muted-foreground">{dayNames[index]}</div>
                    <div className="text-lg font-semibold">{day.getDate()}</div>
                  </div>
                  <div className="space-y-1.5 min-h-[60px]">
                    {list.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground text-center py-3">{t('noEvents')}</div>
                    ) : list.slice(0, 3).map((item, idx) => (
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
                    {list.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">+{list.length - 3} {t('more')}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Desktop: Grid view */}
      <div className="hidden md:grid md:grid-cols-7 gap-3 lg:gap-4">
        {days.map((day, index) => {
          const key = formatKey(day)
          const list = (itemsByDate[key] || []).sort((a, b) => (a.event.time || '').localeCompare(b.event.time || ''))
          const today = new Date()
          const isToday = today.toDateString() === day.toDateString()
          return (
            <Card key={key} className={isToday ? 'ring-2 ring-primary' : ''}>
              <CardContent className="pt-4">
                <div className="text-center mb-2">
                  <div className="text-sm text-muted-foreground">{dayNames[index]}</div>
                  <div className="text-xl font-semibold">{day.getDate()}</div>
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">{t('noEvents')}</div>
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
    </>
  )
}


