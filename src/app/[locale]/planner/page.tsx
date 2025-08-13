"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, CalendarEvent, User as UserType, Task, Meal, Chore } from "@/lib/db"
import { useCalendarSettings } from "@/hooks/useCalendarSettings"
import { AddEventDialog } from "./components/AddEventDialog"
import { DayView } from "./components/DayView"
import { WeekView } from "./components/WeekView"
import { MonthView } from "./components/MonthView"
import { EventDetailsDialog } from "./components/EventDetailsDialog"
import { EditEventDialog } from "./components/EditEventDialog"
import type { PlannerItem } from "./types"

type PlannerView = 'day' | 'week' | 'month'

function toKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getStartOfWeek(d: Date, startOfWeek: 'sunday' | 'monday' = 'sunday') {
  const x = new Date(d)
  const dayOfWeek = x.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  let delta: number
  if (startOfWeek === 'monday') {
    // Monday start: Sunday (0) becomes 6, Monday (1) becomes 0
    delta = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  } else {
    // Sunday start: Sunday (0) becomes 0, Monday (1) becomes 1
    delta = dayOfWeek
  }
  
  x.setDate(x.getDate() - delta)
  x.setHours(0, 0, 0, 0)
  return x
}

export default function PlannerPage() {
  const t = useTranslations('planner')
  const locale = useLocale()
  const router = useRouter()
  const { startOfWeek } = useCalendarSettings()
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
      const start = getStartOfWeek(cursorDate, startOfWeek)
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

  const tasksLive = useLiveQuery(async () => {
    const from = new Date(cursorDate)
    const to = new Date(cursorDate)
    if (view === 'week') {
      const start = getStartOfWeek(cursorDate, startOfWeek)
      from.setTime(start.getTime())
      to.setTime(start.getTime())
      to.setDate(start.getDate() + 6)
    } else if (view === 'month') {
      const s = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1)
      const e = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0)
      from.setTime(s.getTime()); to.setTime(e.getTime())
    }
    from.setHours(0,0,0,0); to.setHours(23,59,59,999)
    const all = await db.tasks
      .where('dueDate')
      .between(from, to, true, true)
      .toArray()
    return all as Task[]
  }, [cursorDate, view])
  const tasks = useMemo(() => tasksLive ?? [], [tasksLive])

  const mealsLive = useLiveQuery(async () => {
    const from = new Date(cursorDate)
    const to = new Date(cursorDate)
    if (view === 'week') {
      const start = getStartOfWeek(cursorDate, startOfWeek)
      from.setTime(start.getTime())
      to.setTime(start.getTime())
      to.setDate(start.getDate() + 6)
    } else if (view === 'month') {
      const s = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1)
      const e = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0)
      from.setTime(s.getTime()); to.setTime(e.getTime())
    }
    from.setHours(0,0,0,0); to.setHours(23,59,59,999)
    const all = await db.meals
      .where('date')
      .between(from, to, true, true)
      .toArray()
    return all as Meal[]
  }, [cursorDate, view])
  const meals = useMemo(() => mealsLive ?? [], [mealsLive])

  const choresLive = useLiveQuery(async () => {
    const from = new Date(cursorDate)
    const to = new Date(cursorDate)
    if (view === 'week') {
      const start = getStartOfWeek(cursorDate, startOfWeek)
      from.setTime(start.getTime())
      to.setTime(start.getTime())
      to.setDate(start.getDate() + 6)
    } else if (view === 'month') {
      const s = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1)
      const e = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0)
      from.setTime(s.getTime()); to.setTime(e.getTime())
    }
    from.setHours(0,0,0,0); to.setHours(23,59,59,999)
    const all = await db.chores
      .where('nextDue')
      .between(from, to, true, true)
      .toArray()
    return all as Chore[]
  }, [cursorDate, view])
  const chores = useMemo(() => choresLive ?? [], [choresLive])

  const items = useMemo<PlannerItem[]>(() => {
    const arr: PlannerItem[] = []
    for (const evt of events) {
      arr.push({
        source: 'calendar',
        typeLabel: t(`types.${evt.type}`),
        event: evt,
      })
    }
    for (const task of tasks) {
      if (!task.dueDate) continue
      const synthetic: CalendarEvent = {
        id: task.id,
        title: task.title,
        description: task.description,
        date: new Date(task.dueDate),
        time: undefined,
        type: 'task',
        relatedId: task.id,
        userIds: task.assignedUserId ? [task.assignedUserId] : undefined,
        createdAt: task.createdAt,
      }
      arr.push({ source: 'task', typeLabel: t('types.task'), event: synthetic, hideEdit: true })
    }
    for (const meal of meals) {
      const synthetic: CalendarEvent = {
        id: meal.id,
        title: meal.title,
        description: meal.description,
        date: new Date(meal.date),
        time: undefined,
        type: 'meal',
        relatedId: meal.id,
        userIds: meal.assignedUserId ? [meal.assignedUserId] : undefined,
        createdAt: meal.createdAt,
      }
      arr.push({ source: 'meal', typeLabel: t('types.meal'), event: synthetic, hideEdit: true })
    }
    for (const chore of chores) {
      const synthetic: CalendarEvent = {
        id: chore.id,
        title: chore.title,
        description: chore.description,
        date: new Date(chore.nextDue),
        time: chore.scheduledTime,
        type: 'general',
        relatedId: chore.id,
        userIds: chore.assignedUserId ? [chore.assignedUserId] : undefined,
        createdAt: chore.createdAt,
      }
      arr.push({ source: 'chore', typeLabel: t('types.chore'), event: synthetic, hideEdit: true })
    }
    return arr
  }, [events, tasks, meals, chores, t])

  const itemsByDate = useMemo(() => {
    const map: Record<string, PlannerItem[]> = {}
    for (const item of items) {
      const key = toKey(new Date(item.event.date))
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    return map
  }, [items])

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
              items={itemsByDate[toKey(cursorDate)] || []}
              usersById={usersById}
              onView={({ event, source }) => {
                if (source === 'calendar') { setSelectedEvent(event); setDetailsOpen(true) }
                else if (source === 'task') { router.push(`/${locale}/tasks`) }
                else if (source === 'meal') { router.push(`/${locale}/meals`) }
                else if (source === 'chore') { router.push(`/${locale}/chores`) }
              }}
              onEdit={({ event, source }) => {
                if (source === 'calendar') { setSelectedEvent(event); setEditOpen(true) }
                else if (source === 'task') { router.push(`/${locale}/tasks`) }
                else if (source === 'meal') { router.push(`/${locale}/meals`) }
                else if (source === 'chore') { router.push(`/${locale}/chores`) }
              }}
            />
          )}
          {view === 'week' && (
            <WeekView
              startOfWeek={getStartOfWeek(cursorDate, startOfWeek)}
              itemsByDate={itemsByDate}
              usersById={usersById}
              onView={({ event, source }) => {
                if (source === 'calendar') { setSelectedEvent(event); setDetailsOpen(true) }
                else if (source === 'task') { router.push(`/${locale}/tasks`) }
                else if (source === 'meal') { router.push(`/${locale}/meals`) }
                else if (source === 'chore') { router.push(`/${locale}/chores`) }
              }}
              onEdit={({ event, source }) => {
                if (source === 'calendar') { setSelectedEvent(event); setEditOpen(true) }
                else if (source === 'task') { router.push(`/${locale}/tasks`) }
                else if (source === 'meal') { router.push(`/${locale}/meals`) }
                else if (source === 'chore') { router.push(`/${locale}/chores`) }
              }}
            />
          )}
          {view === 'month' && (
            <MonthView
              month={cursorDate}
              itemsByDate={itemsByDate}
              usersById={usersById}
              startOfWeek={startOfWeek}
              onView={({ event, source }) => {
                if (source === 'calendar') { setSelectedEvent(event); setDetailsOpen(true) }
                else if (source === 'task') { router.push(`/${locale}/tasks`) }
                else if (source === 'meal') { router.push(`/${locale}/meals`) }
                else if (source === 'chore') { router.push(`/${locale}/chores`) }
              }}
              onEdit={({ event, source }) => {
                if (source === 'calendar') { setSelectedEvent(event); setEditOpen(true) }
                else if (source === 'task') { router.push(`/${locale}/tasks`) }
                else if (source === 'meal') { router.push(`/${locale}/meals`) }
                else if (source === 'chore') { router.push(`/${locale}/chores`) }
              }}
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