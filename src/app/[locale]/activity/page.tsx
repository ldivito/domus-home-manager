'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import {
  Search,
  Filter,
  X,
  CheckSquare,
  ShoppingCart,
  List,
  UtensilsCrossed,
  Bell,
  Heart,
  Wallet,
  CreditCard,
  PawPrint,
  Wrench,
  FileText,
  PiggyBank,
  Users,
  Calendar,
  Hammer,
  Activity,
  Clock
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { db, ActivityLog, ActivityAction, EntityType, User } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

type TimeGrouping = 'hour' | 'day' | 'week' | 'month'

// Icon mapping for entity types
const entityTypeIcons: Record<EntityType, React.ElementType> = {
  chore: CheckSquare,
  groceryItem: ShoppingCart,
  task: List,
  homeImprovement: Hammer,
  meal: UtensilsCrossed,
  reminder: Bell,
  ketoWeight: Heart,
  ketoSymptom: Heart,
  ketoWater: Heart,
  income: Wallet,
  expense: Wallet,
  subscription: CreditCard,
  pet: PawPrint,
  petFeeding: PawPrint,
  petMedication: PawPrint,
  maintenance: Wrench,
  document: FileText,
  savings: PiggyBank,
  user: Users,
  calendarEvent: Calendar
}

// Color mapping for action types
const getActionColor = (action: ActivityAction): string => {
  if (action.includes('created') || action.includes('added') || action.includes('planned') || action.includes('uploaded')) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
  }
  if (action.includes('completed') || action.includes('purchased') || action.includes('logged') || action.includes('reached')) {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  }
  if (action.includes('deleted') || action.includes('cancelled') || action.includes('dismissed')) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  }
  if (action.includes('assigned')) {
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
  }
  if (action.includes('updated') || action.includes('status_changed')) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
}

export default function ActivityPage() {
  const t = useTranslations('activity')

  const [searchQuery, setSearchQuery] = useState('')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [grouping, setGrouping] = useState<TimeGrouping>('day')
  const [showAllHistory, setShowAllHistory] = useState(false)

  // Get activities from last 30 days by default
  const thirtyDaysAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date
  }, [])

  const activitiesData = useLiveQuery(
    () => {
      if (showAllHistory) {
        return db.activityLogs.orderBy('timestamp').reverse().toArray()
      }
      return db.activityLogs
        .where('timestamp')
        .above(thirtyDaysAgo)
        .reverse()
        .toArray()
    },
    [showAllHistory, thirtyDaysAgo]
  )
  const activities = useMemo(() => activitiesData || [], [activitiesData])

  const usersData = useLiveQuery(() => db.users.toArray())
  const users = useMemo(() => usersData || [], [usersData])
  const usersMap = useMemo(() => {
    const map = new Map<string, User>()
    users.forEach(u => {
      if (u.id) map.set(u.id, u)
    })
    return map
  }, [users])

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!activity.entityTitle.toLowerCase().includes(query) &&
            !activity.action.toLowerCase().includes(query)) {
          return false
        }
      }

      // User filter
      if (userFilter !== 'all' && activity.userId !== userFilter) {
        return false
      }

      // Module filter
      if (moduleFilter !== 'all') {
        // Map entity types to modules
        const entityToModule: Record<string, string> = {
          ketoWeight: 'keto', ketoSymptom: 'keto', ketoWater: 'keto',
          income: 'finance', expense: 'finance',
          pet: 'pets', petFeeding: 'pets', petMedication: 'pets'
        }
        const activityModule = entityToModule[activity.entityType] || activity.entityType
        if (activityModule !== moduleFilter) {
          return false
        }
      }

      return true
    })
  }, [activities, searchQuery, userFilter, moduleFilter])

  // Group activities by time
  const groupedActivities = useMemo(() => {
    const groups: Map<string, ActivityLog[]> = new Map()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay())
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    filteredActivities.forEach(activity => {
      const timestamp = new Date(activity.timestamp)
      let groupKey: string

      if (grouping === 'hour') {
        groupKey = timestamp.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric'
        })
      } else if (grouping === 'day') {
        if (timestamp >= today) {
          groupKey = t('timeLabels.today')
        } else if (timestamp >= yesterday) {
          groupKey = t('timeLabels.yesterday')
        } else if (timestamp >= thisWeekStart) {
          groupKey = t('timeLabels.thisWeek')
        } else if (timestamp >= lastWeekStart) {
          groupKey = t('timeLabels.lastWeek')
        } else if (timestamp >= thisMonthStart) {
          groupKey = t('timeLabels.thisMonth')
        } else {
          groupKey = t('timeLabels.older')
        }
      } else if (grouping === 'week') {
        const weekStart = new Date(timestamp)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        groupKey = weekStart.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        })
      } else {
        groupKey = timestamp.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric'
        })
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(activity)
    })

    return groups
  }, [filteredActivities, grouping, t])

  const hasActiveFilters = userFilter !== 'all' || moduleFilter !== 'all'

  const clearFilters = () => {
    setUserFilter('all')
    setModuleFilter('all')
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Grouping selector */}
          <Select value={grouping} onValueChange={(value: TimeGrouping) => setGrouping(value)}>
            <SelectTrigger className="w-[140px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">{t('grouping.hour')}</SelectItem>
              <SelectItem value="day">{t('grouping.day')}</SelectItem>
              <SelectItem value="week">{t('grouping.week')}</SelectItem>
              <SelectItem value="month">{t('grouping.month')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Filters popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={hasActiveFilters ? "default" : "outline"} className="gap-2">
                <Filter className="h-4 w-4" />
                {t('filters.title')}
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {(userFilter !== 'all' ? 1 : 0) + (moduleFilter !== 'all' ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{t('filters.title')}</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      {t('filters.clearAll')}
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('filters.user')}</Label>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('filters.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.all')}</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id!}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: user.color }}
                            />
                            {user.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('filters.module')}</Label>
                  <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('filters.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.all')}</SelectItem>
                      <SelectItem value="chore">{t('modules.chore')}</SelectItem>
                      <SelectItem value="groceryItem">{t('modules.groceryItem')}</SelectItem>
                      <SelectItem value="task">{t('modules.task')}</SelectItem>
                      <SelectItem value="homeImprovement">{t('modules.homeImprovement')}</SelectItem>
                      <SelectItem value="meal">{t('modules.meal')}</SelectItem>
                      <SelectItem value="reminder">{t('modules.reminder')}</SelectItem>
                      <SelectItem value="keto">{t('modules.ketoWeight')}</SelectItem>
                      <SelectItem value="finance">{t('modules.income')}</SelectItem>
                      <SelectItem value="subscription">{t('modules.subscription')}</SelectItem>
                      <SelectItem value="pets">{t('modules.pet')}</SelectItem>
                      <SelectItem value="maintenance">{t('modules.maintenance')}</SelectItem>
                      <SelectItem value="document">{t('modules.document')}</SelectItem>
                      <SelectItem value="savings">{t('modules.savings')}</SelectItem>
                      <SelectItem value="user">{t('modules.user')}</SelectItem>
                      <SelectItem value="calendarEvent">{t('modules.calendarEvent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Info badge */}
        {!showAllHistory && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {t('showingLast30Days')}
            </Badge>
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0"
              onClick={() => setShowAllHistory(true)}
            >
              {t('loadMore')}
            </Button>
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      {filteredActivities.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              {searchQuery ? t('search.noResults') : t('noActivities')}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t('noActivitiesDescription')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedActivities.entries()).map(([groupLabel, groupActivities]) => (
            <div key={groupLabel}>
              {/* Time Group Header */}
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {groupLabel}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <Badge variant="secondary" className="text-xs">
                  {groupActivities.length}
                </Badge>
              </div>

              {/* Activities in this group */}
              <Card className="glass-card">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {groupActivities.map((activity) => {
                      const Icon = entityTypeIcons[activity.entityType] || Activity
                      const user = activity.userId ? usersMap.get(activity.userId) : null

                      return (
                        <div
                          key={activity.id}
                          className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors"
                        >
                          {/* Icon */}
                          <div className={`p-2 rounded-lg flex-shrink-0 ${getActionColor(activity.action)}`}>
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {t(`actions.${activity.action}` as Parameters<typeof t>[0])}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {activity.entityTitle}
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTime(activity.timestamp)}
                              </span>
                            </div>

                            {/* User info */}
                            {user && (
                              <div className="flex items-center gap-2 mt-2">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                                  style={{ backgroundColor: user.color }}
                                >
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {user.name}
                                </span>
                              </div>
                            )}

                            {/* Details */}
                            {activity.details && Object.keys(activity.details).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {Object.entries(activity.details).map(([key, value]) => (
                                  <Badge key={key} variant="outline" className="text-xs">
                                    {key}: {String(value)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
