"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Check, X, CalendarDays, Clock, User, Users } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, KetoSettings, KetoDay, KetoWeightEntry, deleteWithSync, bulkDeleteWithSync } from "@/lib/db"
import { generateId } from "@/lib/utils"
import { toast } from "sonner"
import { useCalendarSettings } from "@/hooks/useCalendarSettings"
import KetoSettingsModal, { KetoSettingsData } from "./components/KetoSettingsModal"
import WeightEntryDialog from "./components/WeightEntryDialog"
import WeightProgressChart from "./components/WeightProgressChart"
import KetoStagesCard from "./components/KetoStagesCard"
import HouseholdOverview from "./components/HouseholdOverview"
import { logger } from '@/lib/logger'

interface DayStatus {
  date: Date
  status?: 'success' | 'fasting' | 'cheat'
}

type ViewMode = 'individual' | 'household'

export default function KetoPage() {
  const t = useTranslations('keto')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('individual')

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

  // Get current user's weight entries
  const weightEntries = useLiveQuery(() => {
    if (!selectedUser) return []
    return db.ketoWeightEntries.where('userId').equals(selectedUser).toArray()
  }, [selectedUser])

  // Get all keto settings for household view
  const allKetoSettings = useLiveQuery(() => db.ketoSettings.toArray())

  // Get all keto days for household view
  const allKetoDays = useLiveQuery(() => db.ketoDays.toArray())

  // Get all weight entries for household view
  const allWeightEntries = useLiveQuery(() => db.ketoWeightEntries.toArray())

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
      const cutoffDate = new Date(today)
      cutoffDate.setDate(cutoffDate.getDate() - 1)

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

    const firstDay = new Date(year, month, 1)
    const dayOfWeek = firstDay.getDay()

    let delta: number
    if (startOfWeek === 'monday') {
      delta = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    } else {
      delta = dayOfWeek
    }

    const startDate = new Date(firstDay)
    startDate.setDate(firstDay.getDate() - delta)

    const days: DayStatus[] = []
    const currentDay = new Date(startDate)

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
        cheatDays: 0,
        currentStreak: 0,
        weeklySuccessRate: 0,
        monthlySuccessRate: 0
      }
    }

    const startDate = ketoSettings.startDate instanceof Date
      ? ketoSettings.startDate
      : new Date(ketoSettings.startDate)
    const today = new Date()
    const msPerDay = 24 * 60 * 60 * 1000

    const totalDaysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / msPerDay) + 1

    const successfulDays = ketoDays.filter(day =>
      day.status === 'success' || day.status === 'fasting'
    ).length

    const daysOnKeto = successfulDays

    const fastingDays = ketoDays.filter(day => day.status === 'fasting').length
    const cheatDays = ketoDays.filter(day => day.status === 'cheat').length

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

    // Weekly success rate
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 6)

    const weeklyKetoDays = ketoDays.filter(day => {
      const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
      return dayDate >= weekAgo && dayDate <= today
    })
    const weeklySuccessful = weeklyKetoDays.filter(day =>
      day.status === 'success' || day.status === 'fasting'
    ).length
    const weeklySuccessRate = Math.round((weeklySuccessful / 7) * 100)

    // Monthly success rate
    const monthAgo = new Date(today)
    monthAgo.setDate(today.getDate() - 29)

    const monthlyKetoDays = ketoDays.filter(day => {
      const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
      return dayDate >= monthAgo && dayDate <= today
    })
    const monthlySuccessful = monthlyKetoDays.filter(day =>
      day.status === 'success' || day.status === 'fasting'
    ).length
    const monthlySuccessRate = Math.round((monthlySuccessful / 30) * 100)

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
          await deleteWithSync(db.ketoDays, 'ketoDays', existingDay.id!)
        }
      }

      toast.success(t('messages.dayUpdated'))
    } catch (error) {
      logger.error('Error updating keto day:', error)
      toast.error(t('messages.error'))
    }
  }

  const handleSaveSettings = async (settings: KetoSettingsData) => {
    if (!selectedUser) return

    try {
      const now = new Date()

      if (ketoSettings) {
        await db.ketoSettings.update(ketoSettings.id!, {
          startDate: settings.startDate,
          goalWeight: settings.goalWeight,
          weightUnit: settings.weightUnit,
          targetDate: settings.targetDate,
          updatedAt: now
        })
      } else {
        const newSettings: KetoSettings = {
          id: generateId('keto_settings'),
          userId: selectedUser,
          startDate: settings.startDate,
          goalWeight: settings.goalWeight,
          weightUnit: settings.weightUnit,
          targetDate: settings.targetDate,
          createdAt: now,
          updatedAt: now
        }
        await db.ketoSettings.add(newSettings)
      }

      toast.success(t('messages.settingsUpdated'))
      setIsSettingsModalOpen(false)
    } catch (error) {
      logger.error('Error saving keto settings:', error)
      toast.error(t('messages.error'))
    }
  }

  const handleResetData = async () => {
    if (!selectedUser) return

    try {
      // Delete all keto days for this user
      const userKetoDays = ketoDays || []
      const ketoDayIds = userKetoDays.map(d => d.id!).filter(Boolean)
      if (ketoDayIds.length > 0) {
        await bulkDeleteWithSync(db.ketoDays, 'ketoDays', ketoDayIds)
      }

      // Delete all weight entries for this user
      const userWeights = weightEntries || []
      const weightIds = userWeights.map(w => w.id!).filter(Boolean)
      if (weightIds.length > 0) {
        await bulkDeleteWithSync(db.ketoWeightEntries, 'ketoWeightEntries', weightIds)
      }

      // Delete keto settings for this user
      if (ketoSettings?.id) {
        await deleteWithSync(db.ketoSettings, 'ketoSettings', ketoSettings.id)
      }

      toast.success(t('messages.dataReset'))
    } catch (error) {
      logger.error('Error resetting keto data:', error)
      toast.error(t('messages.error'))
    }
  }

  const handleAddWeight = async (weight: number, date: Date, notes?: string) => {
    if (!selectedUser) return

    try {
      const weightUnit = ketoSettings?.weightUnit || 'kg'
      const now = new Date()

      const newEntry: KetoWeightEntry = {
        id: generateId('weight'),
        userId: selectedUser,
        date: date,
        weight: weight,
        unit: weightUnit,
        notes: notes,
        createdAt: now,
        updatedAt: now
      }

      await db.ketoWeightEntries.add(newEntry)
      toast.success(t('messages.weightAdded'))
    } catch (error) {
      logger.error('Error adding weight entry:', error)
      toast.error(t('messages.error'))
    }
  }

  const getDayIcon = (status?: 'success' | 'fasting' | 'cheat') => {
    if (status === 'success') {
      return <Check className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
    } else if (status === 'fasting') {
      return (
        <div className="flex items-center justify-center gap-0.5">
          <Check className="h-2 w-2 md:h-3 md:w-3 text-blue-600" />
          <Clock className="h-2 w-2 md:h-3 md:w-3 text-blue-600" />
        </div>
      )
    } else if (status === 'cheat') {
      return <X className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
    }
    return null
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const getDayStyles = (day: DayStatus, isCurrentMonth: boolean) => {
    let baseStyles = "aspect-square flex flex-col items-center justify-center p-0.5 sm:p-1 md:p-2 rounded sm:rounded-lg border transition-all duration-200 hover:bg-muted/50 cursor-pointer text-center min-h-[32px] sm:min-h-[40px] md:min-h-[48px]"

    if (!isCurrentMonth) {
      baseStyles += " opacity-40"
    }

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

  const currentUser = users?.find(u => u.id === selectedUser)

  if (!selectedUser) {
    return (
      <div className="min-h-screen p-3 sm:p-4 md:p-8 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64 sm:h-80 md:h-96">
            <div className="text-sm sm:text-base md:text-lg font-medium text-muted-foreground">{t('loading')}</div>
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

  const sundayFirstDayNames = [
    t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat')
  ]
  const dayNames = startOfWeek === 'monday'
    ? [...sundayFirstDayNames.slice(1), sundayFirstDayNames[0]]
    : sundayFirstDayNames

  const startDate = ketoSettings?.startDate
    ? (ketoSettings.startDate instanceof Date ? ketoSettings.startDate : new Date(ketoSettings.startDate))
    : undefined

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 md:gap-6">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 sm:space-y-1 md:space-y-2 min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t('title')}
              </h1>
              <p className="text-sm sm:text-base md:text-xl text-muted-foreground line-clamp-2">
                {t('subtitle')}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsSettingsModalOpen(true)}
              className="h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-auto md:px-6 shadow-modern hover:shadow-modern-lg transition-all duration-200 shrink-0"
            >
              <Settings className="h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden md:inline md:ml-2">{t('stats.settings')}</span>
            </Button>
          </div>

          {/* View Mode and User Selection */}
          {users && users.length > 1 && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              {/* View Mode Toggle */}
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                <Button
                  variant={viewMode === 'individual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('individual')}
                  className="gap-1.5"
                >
                  <User className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">{currentUser?.name || 'Individual'}</span>
                </Button>
                <Button
                  variant={viewMode === 'household' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('household')}
                  className="gap-1.5"
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">{t('household.viewAll')}</span>
                </Button>
              </div>

              {/* User Selection Tabs - Only show in individual mode */}
              {viewMode === 'individual' && (
                <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide flex-1">
                  <Tabs value={selectedUser || ''} onValueChange={setSelectedUser} className="w-full">
                    <TabsList className="inline-flex w-auto min-w-full sm:w-full h-10 sm:h-11 p-1 bg-muted/50">
                      {users.map((user) => (
                        <TabsTrigger
                          key={user.id}
                          value={user.id!}
                          className="flex-1 min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap gap-1.5 sm:gap-2"
                        >
                          <div
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                            style={{ backgroundColor: user.color }}
                          />
                          <span className="truncate max-w-[60px] sm:max-w-none">{user.name}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Household Overview Mode */}
        {viewMode === 'household' && users && users.length > 1 && (
          <HouseholdOverview
            users={users}
            allKetoSettings={allKetoSettings || []}
            allKetoDays={allKetoDays || []}
            allWeightEntries={allWeightEntries || []}
            onSelectUser={(userId) => {
              setSelectedUser(userId)
              setViewMode('individual')
            }}
          />
        )}

        {/* Individual User View */}
        {viewMode === 'individual' && (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-6">
              <Card className="glass-card shadow-modern">
                <CardContent className="p-2 sm:p-3 md:p-6">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl md:text-3xl font-bold text-primary mb-0.5 sm:mb-1 md:mb-2">{stats.daysOnKeto}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground leading-tight">{t('stats.daysOnKeto')}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card shadow-modern">
                <CardContent className="p-2 sm:p-3 md:p-6">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl md:text-3xl font-bold text-green-600 mb-0.5 sm:mb-1 md:mb-2">{stats.successfulDays}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground leading-tight">{t('stats.successfulDays')}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card shadow-modern">
                <CardContent className="p-2 sm:p-3 md:p-6">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl md:text-3xl font-bold text-blue-600 mb-0.5 sm:mb-1 md:mb-2">{stats.fastingDays}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground leading-tight">{t('stats.fastingDays')}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-8">
              {/* Calendar */}
              <Card className="glass-card shadow-modern">
                <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
                  <CardTitle className="text-base sm:text-lg md:text-2xl">
                    <div className="flex flex-col gap-2 sm:gap-3">
                      <span>{t('calendar.title')}</span>
                      <div className="flex items-center justify-between gap-1 sm:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                          className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0"
                        >
                          <span>←</span>
                        </Button>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="text-xs sm:text-sm md:text-lg font-medium text-center">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentDate(new Date())}
                            title="Jump to current month"
                            className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 p-0"
                          >
                            <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                          className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0"
                        >
                          <span>→</span>
                        </Button>
                      </div>
                    </div>
                  </CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs md:text-sm mt-1 sm:mt-2">
                    {t('calendar.clickToToggle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 md:p-6 pt-0">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2 mb-1 sm:mb-2 md:mb-4">
                    {dayNames.map((day) => (
                      <div key={day} className="text-center text-[10px] sm:text-xs md:text-sm font-semibold text-muted-foreground p-0.5 sm:p-1 md:p-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2">
                    {calendarDays.map((day, index) => {
                      const isCurrentMonth = day.date.getMonth() === currentDate.getMonth()
                      const todayHighlight = isToday(day.date)
                      return (
                        <div
                          key={index}
                          className={getDayStyles(day, isCurrentMonth)}
                          onClick={() => handleDayClick(day)}
                        >
                          <div className={`text-[10px] sm:text-xs md:text-sm mb-0 sm:mb-0.5 md:mb-1 ${todayHighlight ? 'font-bold' : 'font-medium'}`}>
                            {day.date.getDate()}
                          </div>
                          {getDayIcon(day.status)}
                        </div>
                      )
                    })}
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:flex md:justify-center md:gap-4 mt-3 sm:mt-4 md:mt-6 pt-3 sm:pt-4 md:pt-6 border-t">
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                      <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 text-green-600" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">{t('calendar.success')}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                      <div className="flex items-center justify-center gap-0.5">
                        <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3 text-blue-600" />
                        <Clock className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3 text-blue-600" />
                      </div>
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">{t('calendar.fasting')}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                      <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 text-red-600" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">{t('calendar.cheat')}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4 border border-muted rounded"></div>
                      <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">{t('calendar.noData')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Progress Insights */}
              <Card className="glass-card shadow-modern">
                <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
                  <CardTitle className="text-base sm:text-lg md:text-2xl">{t('progress.insights')}</CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs md:text-sm">
                    {t('progress.insightsSubtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 md:p-6 pt-0 space-y-3 sm:space-y-4 md:space-y-6">
                  {/* Circular Progress Rates */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6">
                    {/* Weekly Success Rate */}
                    <div className="text-center">
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 mx-auto mb-1.5 sm:mb-2 md:mb-3">
                        <svg className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 transform -rotate-90" viewBox="0 0 36 36">
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
                          <span className="text-xs sm:text-sm md:text-lg font-bold text-foreground">{stats.weeklySuccessRate}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground leading-tight">{t('progress.weeklySuccess')}</p>
                    </div>

                    {/* Monthly Success Rate */}
                    <div className="text-center">
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 mx-auto mb-1.5 sm:mb-2 md:mb-3">
                        <svg className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 transform -rotate-90" viewBox="0 0 36 36">
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
                          <span className="text-xs sm:text-sm md:text-lg font-bold text-foreground">{stats.monthlySuccessRate}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground leading-tight">{t('progress.monthlySuccess')}</p>
                    </div>
                  </div>

                  {/* Weekly Progress */}
                  <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                    <h4 className="text-xs sm:text-sm md:text-base font-semibold text-foreground">{t('progress.thisWeek')}</h4>
                    <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2">
                      {Array.from({ length: 7 }, (_, i) => {
                        const date = new Date()
                        date.setDate(date.getDate() - date.getDay() + i)
                        const dayKey = formatDateKey(date)
                        const ketoDay = ketoDays?.find(day => {
                          const dayDate = day.date instanceof Date ? day.date : new Date(day.date)
                          return formatDateKey(dayDate) === dayKey
                        })
                        const isCurrentDay = isToday(date)

                        return (
                          <div key={i} className="text-center">
                            <div className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground mb-0.5">
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}
                            </div>
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 mx-auto rounded-full flex items-center justify-center text-[9px] sm:text-[10px] md:text-xs font-medium ${
                              isCurrentDay ? 'ring-1 sm:ring-2 ring-primary ring-offset-1' : ''
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
                  <div className="space-y-1.5 sm:space-y-2 md:space-y-3 p-2 sm:p-3 md:p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg sm:rounded-xl border border-primary/20">
                    <h4 className="text-xs sm:text-sm md:text-base font-semibold text-foreground flex items-center gap-1.5 sm:gap-2">
                      🎯 {t('progress.keepGoing')}
                    </h4>
                    <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-relaxed">
                      {stats.currentStreak > 0
                        ? t('progress.streakMessage', { streak: stats.currentStreak })
                        : stats.daysOnKeto > 0
                        ? t('progress.journeyMessage')
                        : t('progress.welcomeMessage')
                      }
                    </p>
                    {stats.daysOnKeto >= 7 && (
                      <div className="text-[10px] sm:text-xs md:text-sm">
                        <span className="text-green-600 font-medium">{t('progress.weekCompleted', { week: Math.ceil(stats.daysOnKeto / 7) })}</span>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Stats Grid */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:gap-4">
                    <div className="text-center p-1.5 sm:p-2 md:p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.fastingDays}
                      </div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-green-600/70 dark:text-green-400/70 leading-tight">{t('progress.fastingRate')}</div>
                    </div>
                    <div className="text-center p-1.5 sm:p-2 md:p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 dark:text-red-400">
                        {stats.cheatDays}
                      </div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-red-600/70 dark:text-red-400/70 leading-tight">{t('progress.cheatDays')}</div>
                    </div>
                  </div>

                  {/* Current Streak Badge */}
                  {stats.currentStreak > 0 && (
                    <div className="text-center p-2 sm:p-3 md:p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-lg sm:rounded-xl border border-orange-500/20">
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600 dark:text-orange-400 mb-0.5">
                        {stats.currentStreak}
                      </div>
                      <div className="text-[10px] sm:text-xs md:text-sm font-medium text-orange-600/70 dark:text-orange-400/70">
                        {t('progress.dayStreak')} 🔥
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Second Row - Weight Tracking and Stages */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-8">
              {/* Weight Progress */}
              <WeightProgressChart
                weightEntries={weightEntries || []}
                goalWeight={ketoSettings?.goalWeight}
                targetDate={ketoSettings?.targetDate}
                weightUnit={ketoSettings?.weightUnit || 'kg'}
                onAddWeight={() => setIsWeightDialogOpen(true)}
              />

              {/* Keto Stages */}
              <KetoStagesCard
                daysOnKeto={stats.daysOnKeto}
                startDate={startDate}
                fastingDays={stats.fastingDays}
              />
            </div>
          </>
        )}

        {/* Settings Modal */}
        <KetoSettingsModal
          open={isSettingsModalOpen}
          onOpenChange={setIsSettingsModalOpen}
          currentStartDate={ketoSettings?.startDate}
          currentGoalWeight={ketoSettings?.goalWeight}
          currentWeightUnit={ketoSettings?.weightUnit}
          currentTargetDate={ketoSettings?.targetDate}
          onSave={handleSaveSettings}
          onReset={handleResetData}
          userName={currentUser?.name}
        />

        {/* Weight Entry Dialog */}
        <WeightEntryDialog
          open={isWeightDialogOpen}
          onOpenChange={setIsWeightDialogOpen}
          weightUnit={ketoSettings?.weightUnit || 'kg'}
          onSave={handleAddWeight}
        />
      </div>
    </div>
  )
}
