'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export type ViewMode = 'day' | 'week' | 'month'

interface DateNavigatorProps {
  view: ViewMode
  currentDate: Date
  onViewChange: (view: ViewMode) => void
  onNavigate: (direction: 'prev' | 'next') => void
  onGoToToday: () => void
  onDateChange: (date: Date) => void
}

/** Returns the Monday of the week containing the given date */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun, 1 = Mon, …, 6 = Sat
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns [start, end] dates for the period described by view + date */
export function getDateRangeForView(
  view: ViewMode,
  date: Date
): { start: Date; end: Date } {
  if (view === 'month') {
    return {
      start: new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
    }
  }

  if (view === 'week') {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  // day
  return {
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
  }
}

/** Human-readable label for the active period */
export function getPeriodLabel(view: ViewMode, date: Date): string {
  if (view === 'month') {
    const label = date.toLocaleDateString('es', {
      month: 'long',
      year: 'numeric',
    })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  if (view === 'week') {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const startDay = start.getDate()
    const endDay = end.getDate()
    const startMonth = start.toLocaleDateString('es', { month: 'short' })
    const endMonth = end.toLocaleDateString('es', { month: 'short' })

    if (start.getMonth() === end.getMonth()) {
      return `${startDay}–${endDay} ${endMonth}`
    }
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}`
  }

  // day
  return date.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function DateNavigator({
  view,
  currentDate,
  onViewChange,
  onNavigate,
  onGoToToday,
  onDateChange,
}: DateNavigatorProps) {
  const t = useTranslations('personalFinance')
  const dateInputRef = useRef<HTMLInputElement>(null)

  const label = getPeriodLabel(view, currentDate)

  const inputType = view === 'month' ? 'month' : 'date'
  const inputValue =
    view === 'month'
      ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      : `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (!val) return
    if (view === 'month') {
      const [y, m] = val.split('-').map(Number)
      onDateChange(new Date(y, m - 1, 1))
    } else {
      const [y, m, d] = val.split('-').map(Number)
      onDateChange(new Date(y, m - 1, d))
    }
  }

  const views: ViewMode[] = ['day', 'week', 'month']
  const viewLabels: Record<ViewMode, string> = {
    day: t('transactions.dateNav.viewDay'),
    week: t('transactions.dateNav.viewWeek'),
    month: t('transactions.dateNav.viewMonth'),
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-2">
      {/* ← label → / Go to today */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('prev')}
          title={t('transactions.dateNav.prevPeriod')}
          aria-label={t('transactions.dateNav.prevPeriod')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Clickable period label — clicking opens native date/month picker */}
        <div className="relative">
          <Button
            variant="ghost"
            className="min-w-[160px] font-semibold text-base gap-1.5"
            onClick={() =>
              dateInputRef.current?.showPicker
                ? dateInputRef.current.showPicker()
                : dateInputRef.current?.click()
            }
            title={t('transactions.dateNav.selectPeriod')}
          >
            <CalendarDays className="h-4 w-4" />
            {label}
          </Button>
          <input
            ref={dateInputRef}
            type={inputType}
            value={inputValue}
            onChange={handleInputChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('next')}
          title={t('transactions.dateNav.nextPeriod')}
          aria-label={t('transactions.dateNav.nextPeriod')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Go to today */}
        <Button
          variant="outline"
          size="sm"
          onClick={onGoToToday}
          className="text-xs"
        >
          {t('transactions.dateNav.goToToday')}
        </Button>
      </div>

      {/* View selector: Día | Semana | Mes */}
      <div className="flex items-center rounded-md border bg-muted p-1 gap-1">
        {views.map((v) => (
          <Button
            key={v}
            variant={view === v ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => onViewChange(v)}
          >
            {viewLabels[v]}
          </Button>
        ))}
      </div>
    </div>
  )
}
