"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, CalendarEvent, User as UserType } from "@/lib/db"
import { AddEventDialog } from "./components/AddEventDialog"
import { DayView } from "./components/DayView"
import { WeekView } from "./components/WeekView"
import { MonthView } from "./components/MonthView"
import { EventDetailsDialog } from "./components/EventDetailsDialog"
import { EditEventDialog } from "./components/EditEventDialog"

type PlannerView = 'day' | 'week' | 'month'

function toKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getStartOfWeek(d: Date) {
  const x = new Date(d)
  const delta = x.getDay() // Sunday start
  x.setDate(x.getDate() - delta)
  x.setHours(0, 0, 0, 0)
  return x
}

export default function PlannerPage() {
  const t = useTranslations('planner')
  const [view, setView] = useState<PlannerView>('week')
  const [cursorDate, setCursorDate] = useState<Date>(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  })
  const [showAdd, setShowAdd] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const usersLive = useLiveQuery(() => db.users.toArray(), [])
  const users = useMemo(() => usersLive ?? [], [usersLive])
  const usersById = useMemo(() => {
    return Object.fromEntries(users.map(u => [u.id!, u as UserType]))
  }, [users])

  const eventsLive = useLiveQuery(async () => {
    // Fetch a range depending on view
    const from = new Date(cursorDate)
    const to = new Date(cursorDate)
    if (view === 'day') {
      // same day
    } else if (view === 'week') {
      const start = getStartOfWeek(cursorDate)
      from.setTime(start.getTime())
      to.setTime(start.getTime())
      to.setDate(start.getDate() + 6)
    } else {
      // month
      const s = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1)
      const e = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0)
      from.setTime(s.getTime())
      to.setTime(e.getTime())
    }
    from.setHours(0,0,0,0)
    to.setHours(23,59,59,999)
    const all = await db.calendarEvents
      .where('date')
      .between(from, to, true, true)
      .toArray()
    return all as CalendarEvent[]
  }, [cursorDate, view])
  const events = useMemo(() => eventsLive ?? [], [eventsLive])

  const eventsByDate = useMemo(() => {
    const list = events
    const map: Record<string, CalendarEvent[]> = {}
    for (const evt of list) {
      const key = toKey(new Date(evt.date))
      if (!map[key]) map[key] = []
      map[key].push(evt)
    }
    return map
  }, [events])

  const goPrev = () => {
    const next = new Date(cursorDate)
    if (view === 'day') next.setDate(next.getDate() - 1)
    else if (view === 'week') next.setDate(next.getDate() - 7)
    else next.setMonth(next.getMonth() - 1)
    setCursorDate(next)
  }
  const goNext = () => {
    const next = new Date(cursorDate)
    if (view === 'day') next.setDate(next.getDate() + 1)
    else if (view === 'week') next.setDate(next.getDate() + 7)
    else next.setMonth(next.getMonth() + 1)
    setCursorDate(next)
  }
  const goToday = () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    setCursorDate(now)
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">{t('title')}</h1>
            <p className="text-xl text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={goPrev} className="h-12 px-4">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={goToday} className="h-12 px-4">{t('today')}</Button>
            <Button variant="outline" onClick={goNext} className="h-12 px-4">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="border rounded-lg p-1 ml-2">
              <Button variant={view==='day'? 'default':'ghost'} onClick={() => setView('day')} className="h-10">{t('views.day')}</Button>
              <Button variant={view==='week'? 'default':'ghost'} onClick={() => setView('week')} className="h-10">{t('views.week')}</Button>
              <Button variant={view==='month'? 'default':'ghost'} onClick={() => setView('month')} className="h-10">{t('views.month')}</Button>
            </div>
            <Button onClick={() => setShowAdd(true)} className="h-12 px-6">
              <Plus className="mr-2 h-5 w-5" />
              {t('addEvent')}
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <Card className="p-4">
          {view === 'day' && (
            <DayView
              date={cursorDate}
              events={eventsByDate[toKey(cursorDate)] || []}
              usersById={usersById}
              onView={(evt) => { setSelectedEvent(evt); setDetailsOpen(true) }}
              onEdit={(evt) => { setSelectedEvent(evt); setEditOpen(true) }}
            />
          )}
          {view === 'week' && (
            <WeekView
              startOfWeek={getStartOfWeek(cursorDate)}
              eventsByDate={eventsByDate}
              usersById={usersById}
              onView={(evt) => { setSelectedEvent(evt); setDetailsOpen(true) }}
              onEdit={(evt) => { setSelectedEvent(evt); setEditOpen(true) }}
            />
          )}
          {view === 'month' && (
            <MonthView
              month={cursorDate}
              eventsByDate={eventsByDate}
              usersById={usersById}
              onView={(evt) => { setSelectedEvent(evt); setDetailsOpen(true) }}
              onEdit={(evt) => { setSelectedEvent(evt); setEditOpen(true) }}
            />
          )}
        </Card>

        <AddEventDialog open={showAdd} onOpenChange={setShowAdd} users={users} defaultDate={cursorDate} onCreated={() => {}} />
        <EventDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          event={selectedEvent}
          usersById={usersById}
          onEdit={(evt) => { setSelectedEvent(evt); setEditOpen(true) }}
          onDelete={async (evt) => { await db.calendarEvents.delete(evt.id!); setDetailsOpen(false) }}
        />
        <EditEventDialog open={editOpen} onOpenChange={setEditOpen} users={users} event={selectedEvent} />
      </div>
    </div>
  )
}