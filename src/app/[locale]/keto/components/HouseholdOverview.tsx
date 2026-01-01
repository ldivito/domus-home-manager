"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TrendingUp, Award, Flame } from "lucide-react"
import { User, KetoSettings, KetoDay, KetoWeightEntry } from "@/lib/db"

interface HouseholdOverviewProps {
  users: User[]
  allKetoSettings: KetoSettings[]
  allKetoDays: KetoDay[]
  allWeightEntries: KetoWeightEntry[]
  onSelectUser: (userId: string) => void
}

export default function HouseholdOverview({
  users,
  allKetoSettings,
  allKetoDays,
  allWeightEntries,
  onSelectUser,
}: HouseholdOverviewProps) {
  const t = useTranslations('keto')

  const userStats = useMemo(() => {
    return users.map((user) => {
      const settings = allKetoSettings.find(s => s.userId === user.id)
      const days = allKetoDays.filter(d => d.userId === user.id)
      const weights = allWeightEntries.filter(w => w.userId === user.id)

      // Calculate stats
      const successfulDays = days.filter(d => d.status === 'success' || d.status === 'fasting').length
      const fastingDays = days.filter(d => d.status === 'fasting').length
      const cheatDays = days.filter(d => d.status === 'cheat').length

      // Calculate current streak
      let currentStreak = 0
      const sortedDays = [...days]
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

      // Calculate weight change
      let weightChange = 0
      if (weights.length >= 2) {
        const sorted = [...weights].sort((a, b) => {
          const dateA = a.date instanceof Date ? a.date : new Date(a.date)
          const dateB = b.date instanceof Date ? b.date : new Date(b.date)
          return dateA.getTime() - dateB.getTime()
        })
        weightChange = sorted[sorted.length - 1].weight - sorted[0].weight
      }

      // Current weight
      const currentWeight = weights.length > 0
        ? [...weights].sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date : new Date(a.date)
            const dateB = b.date instanceof Date ? b.date : new Date(b.date)
            return dateB.getTime() - dateA.getTime()
          })[0]
        : null

      return {
        user,
        settings,
        hasStarted: !!settings,
        successfulDays,
        fastingDays,
        cheatDays,
        currentStreak,
        weightChange,
        currentWeight,
        totalDays: days.length,
      }
    })
  }, [users, allKetoSettings, allKetoDays, allWeightEntries])

  // Find the user with the best streak
  const bestStreak = useMemo(() => {
    return userStats.reduce((best, current) => {
      if (current.currentStreak > (best?.currentStreak || 0)) {
        return current
      }
      return best
    }, userStats[0] as typeof userStats[0] | undefined)
  }, [userStats])

  // Total household stats
  const householdStats = useMemo(() => {
    const totalSuccessful = userStats.reduce((sum, u) => sum + u.successfulDays, 0)
    const totalFasting = userStats.reduce((sum, u) => sum + u.fastingDays, 0)
    const totalCheat = userStats.reduce((sum, u) => sum + u.cheatDays, 0)
    const activeUsers = userStats.filter(u => u.hasStarted).length

    return {
      totalSuccessful,
      totalFasting,
      totalCheat,
      activeUsers,
      totalUsers: users.length,
    }
  }, [userStats, users.length])

  if (users.length <= 1) {
    return null
  }

  return (
    <Card className="glass-card shadow-modern">
      <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
        <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
          <Users className="h-4 w-4 sm:h-5 sm:w-5" />
          {t('household.title')}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {t('household.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6 pt-0 space-y-4 sm:space-y-6">
        {/* Household Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="text-center p-2 sm:p-3 bg-primary/10 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary">
              {householdStats.activeUsers}/{householdStats.totalUsers}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('household.activeUsers')}</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-green-500/10 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
              {householdStats.totalSuccessful}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('household.totalSuccess')}</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-blue-500/10 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">
              {householdStats.totalFasting}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('household.totalFasting')}</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-orange-500/10 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600">
              {bestStreak?.currentStreak || 0}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('household.bestStreak')}</div>
          </div>
        </div>

        {/* Leader Board */}
        {bestStreak && bestStreak.currentStreak > 0 && (
          <div className="p-3 sm:p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 text-white rounded-lg">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('household.leaderTitle')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bestStreak.user.name || 'User'} - {t('household.streakDays', { days: bestStreak.currentStreak })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User Cards */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">{t('household.memberProgress')}</h4>
          <div className="grid gap-2 sm:gap-3">
            {userStats.map((stat) => (
              <button
                key={stat.user.id}
                onClick={() => onSelectUser(stat.user.id!)}
                className="w-full text-left p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-medium text-sm"
                      style={{ backgroundColor: stat.user.color || '#888' }}
                    >
                      {(stat.user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm sm:text-base text-foreground">
                        {stat.user.name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stat.hasStarted
                          ? t('household.daysTracked', { days: stat.successfulDays })
                          : t('household.notStarted')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    {stat.currentStreak > 0 && (
                      <div className="flex items-center gap-1 text-orange-500">
                        <Flame className="h-4 w-4" />
                        <span className="text-sm font-medium">{stat.currentStreak}</span>
                      </div>
                    )}

                    {stat.weightChange !== 0 && (
                      <div className={`flex items-center gap-1 ${
                        stat.weightChange < 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        <TrendingUp className={`h-4 w-4 ${stat.weightChange < 0 ? 'rotate-180' : ''}`} />
                        <span className="text-sm font-medium">
                          {stat.weightChange > 0 ? '+' : ''}{stat.weightChange.toFixed(1)}
                          {stat.currentWeight?.unit || 'kg'}
                        </span>
                      </div>
                    )}

                    {stat.hasStarted && (
                      <div className="hidden sm:flex items-center gap-2 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-600">
                          {stat.successfulDays - stat.fastingDays}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600">
                          {stat.fastingDays}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-600">
                          {stat.cheatDays}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
