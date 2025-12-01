"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Check, X, CalendarDays, Clock } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, KetoSettings, KetoDay } from "@/lib/db"
import { generateId } from "@/lib/utils"
import { toast } from "sonner"
import { useCalendarSettings } from "@/hooks/useCalendarSettings"
import KetoSettingsModal from "./components/KetoSettingsModal"

interface DayStatus {
  date: Date
  status?: 'success' | 'fasting' | 'cheat'
}

export default function KetoPage() {
  const t = useTranslations('keto')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  // Get calendar settings (start of week preference)
  const { startOfWeek } = useCalendarSettings()

  // Get users from database
  const users = useLiveQuery(() => db.users.toArray())

  // Get current user's keto settings
  const ketoSettings = useLiveQuery(() => {
    if (!selectedUser) return undefined
    return db.ketoSettings.where('userId').equals(selectedUser).first()
  }, [selectedUser])

  // Get current user's keto days
  const ketoDays = useLiveQuery(() => {
    if (!selectedUser) return []
    return db.ketoDays.where('userId').equals(selectedUser).toArray()
  }, [selectedUser])

  // Set default user to first user
  useEffect(() => {
    if (!selectedUser && users?.length) {
      const firstUser = users[0]
      if (firstUser?.id) {
        setSelectedUser(firstUser.id)
      }
    }
  }, [selectedUser, users])

  // Auto-mark past days as 'cheat' if not marked after a grace period (next day has passed)
  useEffect(() => {
    const autoMarkPastDays = async () => {
      if (!selectedUser || !ketoSettings || !ketoDays) return

      const startDate = ketoSettings.startDate instanceof Date
        ? ketoSettings.startDate
        : new Date(ketoSettings.startDate)

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Grace period: only auto-mark days that are at least 2 days in the past
      // (the whole day passed AND the next day passed too)
      const cutoffDate = new Date(today)
      cutoffDate.setDate(cutoffDate.getDate() - 1) // Yesterday is the cutoff

      const msPerDay = 24 * 60 * 60 * 1000
      const daysToCheck = Math.floor((cutoffDate.getTime() - startDate.getTime()) / msPerDay)

      if (daysToCheck < 0) return

      const daysToMark: Date[] = []

      for (let i = 0; i <= daysToCheck; i++) {
        const checkDate = new Date(startDate)
        checkDate.setDate(startDate.getDate() + i)
        checkDate.setHours(0, 0, 0, 0)

        const dayKey = formatDateKey(checkDate)
        const existingDay = ketoDays.find(day => {
          const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
          return formatDateKey(dayDate) === dayKey
        })

        if (!existingDay) {
          daysToMark.push(new Date(checkDate))
        }
      }

      // Batch add all unmarked days as 'cheat'
      if (daysToMark.length > 0) {
        const newEntries: KetoDay[] = daysToMark.map(date => ({
          id: generateId('keto'),
          userId: selectedUser,
          date: date,
          status: 'cheat' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        }))

        await db.ketoDays.bulkAdd(newEntries)
      }
    }

    autoMarkPastDays()
  }, [selectedUser, ketoSettings, ketoDays])

  // Generate calendar days for current month
  const generateCalendarDays = (): DayStatus[] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // Start from first day of month
    const firstDay = new Date(year, month, 1)
    const dayOfWeek = firstDay.getDay() // 0 = Sunday, 1 = Monday, etc.

    // Calculate offset based on start of week preference
    let delta: number
    if (startOfWeek === 'monday') {
      // Monday start: Sunday (0) becomes 6, Monday (1) becomes 0
      delta = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    } else {
      // Sunday start: Sunday (0) becomes 0, Monday (1) becomes 1
      delta = dayOfWeek
    }

    // Get first day of week for the grid
    const startDate = new Date(firstDay)
    startDate.setDate(firstDay.getDate() - delta)

    const days: DayStatus[] = []
    const currentDay = new Date(startDate)

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const dayKey = formatDateKey(currentDay)
      const ketoDay = ketoDays?.find(day => {
        const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
        return formatDateKey(dayDate) === dayKey
      })

      days.push({
        date: new Date(currentDay),
        status: ketoDay?.status
      })

      currentDay.setDate(currentDay.getDate() + 1)
    }

    return days
  }

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const calculateStats = () => {
    if (!ketoSettings || !ketoDays) {
      return {
        daysOnKeto: 0,
        totalDaysSinceStart: 0,
        successfulDays: 0,
        fastingDays: 0,
        currentStreak: 0,
        weeklySuccessRate: 0,
        monthlySuccessRate: 0
      }
    }

    // Ensure startDate is a Date object
    const startDate = ketoSettings.startDate instanceof Date
      ? ketoSettings.startDate
      : new Date(ketoSettings.startDate)
    const today = new Date()
    const msPerDay = 24 * 60 * 60 * 1000

    // Calculate total days since start (for internal calculations)
    const totalDaysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / msPerDay) + 1

    // Calculate successful days (keto success + fasting combined)
    const successfulDays = ketoDays.filter(day =>
      day.status === 'success' || day.status === 'fasting'
    ).length

    // Days on keto now only counts days that were actually done (success or fasting)
    const daysOnKeto = successfulDays

    // Calculate fasting days specifically
    const fastingDays = ketoDays.filter(day => day.status === 'fasting').length

    // Calculate current streak
    let currentStreak = 0
    const sortedDays = ketoDays
      .map(day => ({
        ...day,
        date: day.date instanceof Date ? day.date : new Date(day.date)
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    for (const day of sortedDays) {
      if (day.status === 'success' || day.status === 'fasting') {
        currentStreak++
      } else if (day.status === 'cheat') {
        break
      }
    }

    // Calculate weekly success rate (last 7 days)
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 6) // Last 7 days including today

    const weeklyKetoDays = ketoDays.filter(day => {
      const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
      return dayDate >= weekAgo && dayDate <= today
    })
    const weeklySuccessful = weeklyKetoDays.filter(day =>
      day.status === 'success' || day.status === 'fasting'
    ).length
    const weeklySuccessRate = Math.round((weeklySuccessful / 7) * 100)

    // Calculate monthly success rate (last 30 days)
    const monthAgo = new Date(today)
    monthAgo.setDate(today.getDate() - 29) // Last 30 days including today

    const monthlyKetoDays = ketoDays.filter(day => {
      const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
      return dayDate >= monthAgo && dayDate <= today
    })
    const monthlySuccessful = monthlyKetoDays.filter(day =>
      day.status === 'success' || day.status === 'fasting'
    ).length
    const monthlySuccessRate = Math.round((monthlySuccessful / 30) * 100)

    // Calculate cheat days (days with 'cheat' status)
    const cheatDays = ketoDays.filter(day => day.status === 'cheat').length

    return {
      daysOnKeto,
      totalDaysSinceStart,
      successfulDays,
      fastingDays,
      cheatDays,
      currentStreak,
      weeklySuccessRate: Math.min(weeklySuccessRate, 100),
      monthlySuccessRate: Math.min(monthlySuccessRate, 100)
    }
  }

  const handleDayClick = async (day: DayStatus) => {
    if (!selectedUser) return

    try {
      const dayKey = formatDateKey(day.date)
      const existingDay = ketoDays?.find(kd => {
        const dayDate = kd.date instanceof Date ? kd.date : new Date(kd.date)
        return formatDateKey(dayDate) === dayKey
      })

      if (!existingDay) {
        // Create new entry with success status
        const newDay: KetoDay = {
          id: generateId('keto'),
          userId: selectedUser,
          date: day.date,
          status: 'success',
          createdAt: new Date(),
          updatedAt: new Date()
        }
        await db.ketoDays.add(newDay)
      } else {
        // Cycle through states: success -> fasting -> cheat -> delete
        if (existingDay.status === 'success') {
          await db.ketoDays.update(existingDay.id!, {
            status: 'fasting',
            updatedAt: new Date()
          })
        } else if (existingDay.status === 'fasting') {
          await db.ketoDays.update(existingDay.id!, {
            status: 'cheat',
            updatedAt: new Date()
          })
        } else if (existingDay.status === 'cheat') {
          await db.ketoDays.delete(existingDay.id!)
        }
      }

      toast.success(t('messages.dayUpdated'))
    } catch (error) {
      console.error('Error updating keto day:', error)
      toast.error(t('messages.error'))
    }
  }

  const handleSaveSettings = async (startDate: Date) => {
    if (!selectedUser) return

    try {
      const now = new Date()

      if (ketoSettings) {
        // Update existing settings
        await db.ketoSettings.update(ketoSettings.id!, {
          startDate,
          updatedAt: now
        })
      } else {
        // Create new settings
        const newSettings: KetoSettings = {
          id: generateId('keto_settings'),
          userId: selectedUser,
          startDate,
          createdAt: now,
          updatedAt: now
        }
        await db.ketoSettings.add(newSettings)
      }

      toast.success(t('messages.settingsUpdated'))
      setIsSettingsModalOpen(false)
    } catch (error) {
      console.error('Error saving keto settings:', error)
      toast.error(t('messages.error'))
    }
  }

  const getDayIcon = (status?: 'success' | 'fasting' | 'cheat') => {
    if (status === 'success') {
      return <Check className="h-4 w-4 text-green-600" />
    } else if (status === 'fasting') {
      return (
        <div className="flex items-center justify-center gap-0.5">
          <Check className="h-3 w-3 text-blue-600" />
          <Clock className="h-3 w-3 text-blue-600" />
        </div>
      )
    } else if (status === 'cheat') {
      return <X className="h-4 w-4 text-red-600" />
    }
    return null
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const getDayStyles = (day: DayStatus, isCurrentMonth: boolean) => {
    let baseStyles = "aspect-square flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 hover:bg-muted/50 cursor-pointer text-center"

    if (!isCurrentMonth) {
      baseStyles += " opacity-40"
    }

    // Today highlighting
    const todayHighlight = isToday(day.date)
    if (todayHighlight) {
      baseStyles += " bg-primary/10 border-primary/30"
    }

    if (day.status === 'success') {
      baseStyles += " bg-green-100 border-green-300 dark:bg-green-900/20 dark:border-green-700"
    } else if (day.status === 'fasting') {
      baseStyles += " bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700"
    } else if (day.status === 'cheat') {
      baseStyles += " bg-red-100 border-red-300 dark:bg-red-900/20 dark:border-red-700"
    } else if (!todayHighlight) {
      baseStyles += " border-border hover:border-muted-foreground"
    }

    return baseStyles
  }

  if (!selectedUser) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-96">
            <div className="text-lg font-medium text-muted-foreground">{t('loading')}</div>
          </div>
        </div>
      </div>
    )
  }

  const stats = calculateStats()
  const calendarDays = generateCalendarDays()
  const monthNames = [
    t('months.january'), t('months.february'), t('months.march'), t('months.april'),
    t('months.may'), t('months.june'), t('months.july'), t('months.august'),
    t('months.september'), t('months.october'), t('months.november'), t('months.december')
  ]

  // Get day names in the correct order based on start of week
  const sundayFirstDayNames = [
    t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat')
  ]
  const dayNames = startOfWeek === 'monday'
    ? [...sundayFirstDayNames.slice(1), sundayFirstDayNames[0]] // Move Sunday to the end
    : sundayFirstDayNames

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('title')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              {t('subtitle')}
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsSettingsModalOpen(true)}
            className="h-12 px-6 shadow-modern hover:shadow-modern-lg transition-all duration-200"
          >
            <Settings className="mr-2 h-5 w-5" />
            {t('stats.settings')}
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card shadow-modern">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">{stats.daysOnKeto}</div>
                <div className="text-sm font-medium text-muted-foreground">{t('stats.daysOnKeto')}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-modern">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">{stats.successfulDays}</div>
                <div className="text-sm font-medium text-muted-foreground">{t('stats.successfulDays')}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-modern">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{stats.fastingDays}</div>
                <div className="text-sm font-medium text-muted-foreground">{t('stats.fastingDays')}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar and Progress Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar */}
          <Card className="glass-card shadow-modern">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center justify-between">
                <span>{t('calendar.title')}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                  >
                    ←
                  </Button>
                  <span className="text-lg font-medium min-w-[160px] text-center">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                    title="Jump to current month"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                  >
                    →
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                {t('calendar.clickToToggle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {dayNames.map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = day.date.getMonth() === currentDate.getMonth()
                  const todayHighlight = isToday(day.date)
                  return (
                    <div
                      key={index}
                      className={getDayStyles(day, isCurrentMonth)}
                      onClick={() => handleDayClick(day)}
                    >
                      <div className={`text-sm mb-1 ${todayHighlight ? 'font-bold' : 'font-medium'}`}>
                        {day.date.getDate()}
                      </div>
                      {getDayIcon(day.status)}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex justify-center gap-4 mt-6 pt-6 border-t flex-wrap">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">{t('calendar.success')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center gap-0.5">
                    <Check className="h-3 w-3 text-blue-600" />
                    <Clock className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">{t('calendar.fasting')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-muted-foreground">{t('calendar.cheat')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border border-muted rounded"></div>
                  <span className="text-sm text-muted-foreground">{t('calendar.noData')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Insights */}
          <Card className="glass-card shadow-modern">
            <CardHeader>
              <CardTitle className="text-2xl">{t('progress.insights')}</CardTitle>
              <CardDescription>
                {t('progress.insightsSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Circular Progress Rates */}
              <div className="grid grid-cols-2 gap-6">
                {/* Weekly Success Rate */}
                <div className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-3">
                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted"
                      />
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${stats.weeklySuccessRate}, 100`}
                        className="text-green-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-foreground">{stats.weeklySuccessRate}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{t('progress.weeklySuccess')}</p>
                </div>

                {/* Monthly Success Rate */}
                <div className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-3">
                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted"
                      />
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${stats.monthlySuccessRate}, 100`}
                        className="text-blue-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-foreground">{stats.monthlySuccessRate}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{t('progress.monthlySuccess')}</p>
                </div>
              </div>

              {/* Weekly Progress */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">{t('progress.thisWeek')}</h4>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date()
                    date.setDate(date.getDate() - date.getDay() + i) // Start from Sunday
                    const dayKey = formatDateKey(date)
                    const ketoDay = ketoDays?.find(day => {
                      const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
                      return formatDateKey(dayDate) === dayKey
                    })
                    const isCurrentDay = isToday(date)

                    return (
                      <div key={i} className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCurrentDay ? 'ring-2 ring-primary ring-offset-2' : ''
                        } ${
                          ketoDay?.status === 'success' ? 'bg-green-500 text-white' :
                          ketoDay?.status === 'fasting' ? 'bg-blue-500 text-white' :
                          ketoDay?.status === 'cheat' ? 'bg-red-500 text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {ketoDay?.status === 'success' ? '✓' :
                           ketoDay?.status === 'fasting' ? '🕐' :
                           ketoDay?.status === 'cheat' ? '✗' :
                           date.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Motivational Section */}
              <div className="space-y-3 p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  🎯 {t('progress.keepGoing')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {stats.currentStreak > 0
                    ? t('progress.streakMessage', { streak: stats.currentStreak })
                    : stats.daysOnKeto > 0
                    ? t('progress.journeyMessage')
                    : t('progress.welcomeMessage')
                  }
                </p>
                {stats.daysOnKeto >= 7 && (
                  <div className="text-sm">
                    <span className="text-green-600 font-medium">{t('progress.weekCompleted', { week: Math.ceil(stats.daysOnKeto / 7) })}</span>
                  </div>
                )}
              </div>

              {/* Enhanced Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.fastingDays}
                  </div>
                  <div className="text-xs text-green-600/70 dark:text-green-400/70">{t('progress.fastingRate')}</div>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.cheatDays}
                  </div>
                  <div className="text-xs text-red-600/70 dark:text-red-400/70">{t('progress.cheatDays')}</div>
                </div>
              </div>

              {/* Current Streak Badge */}
              {stats.currentStreak > 0 && (
                <div className="text-center p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl border border-orange-500/20">
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                    {stats.currentStreak}
                  </div>
                  <div className="text-sm font-medium text-orange-600/70 dark:text-orange-400/70">
                    {t('progress.dayStreak')} 🔥
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings Modal */}
        <KetoSettingsModal
          open={isSettingsModalOpen}
          onOpenChange={setIsSettingsModalOpen}
          currentStartDate={ketoSettings?.startDate}
          onSave={handleSaveSettings}
        />
      </div>
    </div>
  )
}