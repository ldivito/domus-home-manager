"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarEvent, User } from "@/lib/db"
import { EventPill } from "./EventPill"
import type { PlannerItem } from "../types"

interface DayViewProps {
  date: Date
  items: PlannerItem[]
  usersById: Record<number, User>
  onView?: (payload: { event: CalendarEvent; source: PlannerItem['source'] }) => void
  onEdit?: (payload: { event: CalendarEvent; source: PlannerItem['source'] }) => void
}

export function DayView({ date, items, usersById, onView, onEdit }: DayViewProps) {
  const sorted = [...items].sort((a, b) => (a.event.time || '').localeCompare(b.event.time || ''))

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
        <CardTitle className="text-lg sm:text-2xl">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-2 sm:space-y-3">
          {sorted.length === 0 && (
            <div className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">No events</div>
          )}
          {sorted.map((item, idx) => (
            <EventPill
              key={`${item.source}-${item.event.id ?? idx}`}
              event={item.event}
              source={item.source}
              typeLabel={item.typeLabel}
              usersById={usersById}
              onView={(payload)=>onView?.(payload)}
              onEdit={(payload)=>onEdit?.(payload)}
              hideEdit={item.hideEdit}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


