"use client"

import { useState, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { CheckSquare, Plus, Calendar, User, Clock, Repeat, Edit3, Undo, Trash2, Search, Filter, X, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChoreFormModal } from "@/components/ChoreFormModal"
import { CompleteChoreModal } from "@/components/CompleteChoreModal"
import { db, Chore, User as UserType, deleteWithSync } from "@/lib/db"
import { generateId } from "@/lib/utils"
import { logger } from '@/lib/logger'

type FrequencyFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'custom'
type StatusFilter = 'all' | 'pending' | 'completed' | 'overdue'

export default function ChoresPage() {
  const t = useTranslations('chores')
  const tCommon = useTranslations('common')
  const tFreq = useTranslations('chores.frequency')
  const [chores, setChores] = useState<Chore[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

  // Load chores and users from database
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [dbChores, dbUsers] = await Promise.all([
        db.chores.orderBy('nextDue').toArray(),
        db.users.toArray()
      ])
      setChores(dbChores)
      setUsers(dbUsers)
    } catch (error) {
      logger.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateChore = async (choreData: Omit<Chore, 'id' | 'createdAt'>) => {
    try {
      const newChore: Chore = {
        id: generateId('chr'),
        ...choreData,
        createdAt: new Date()
      }

      await db.chores.add(newChore)
      await loadData()
    } catch (error) {
      logger.error('Error creating chore:', error)
      throw error
    }
  }

  const handleCompleteChore = (chore: Chore) => {
    setSelectedChore(chore)
    setIsCompleteModalOpen(true)
  }

  const handleEditChore = (chore: Chore) => {
    setSelectedChore(chore)
    setIsEditModalOpen(true)
  }

  const handleDeleteChore = async (chore: Chore) => {
    if (!chore.id) return
    try {
      await deleteWithSync(db.chores, 'chores', chore.id)
      await loadData()
    } catch (error) {
      logger.error('Error deleting chore:', error)
    }
  }

  const handleConfirmComplete = async (completedByUserId: string) => {
    if (!selectedChore?.id) return

    try {
      const now = new Date()
      let nextDue: Date

      switch (selectedChore.frequency) {
        case 'daily':
          nextDue = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          break
        case 'weekly':
          nextDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          nextDue = new Date(now)
          nextDue.setMonth(nextDue.getMonth() + 1)
          break
        case 'custom':
          if (selectedChore.customFrequency?.type === 'days_interval') {
            nextDue = new Date(now.getTime() + (selectedChore.customFrequency.value * 24 * 60 * 60 * 1000))
          } else {
            nextDue = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
          break
        default:
          nextDue = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }

      await db.chores.update(selectedChore.id, {
        lastCompleted: now,
        lastCompletedBy: completedByUserId,
        completedAt: now,
        nextDue,
        isCompleted: true,
        updatedAt: now
      })

      await loadData()
    } catch (error) {
      logger.error('Error completing chore:', error)
      throw error
    }
  }

  const handleUndoComplete = async (chore: Chore) => {
    if (!chore.id) return

    try {
      await db.chores.update(chore.id, {
        isCompleted: false,
        completedAt: undefined,
        lastCompletedBy: undefined,
        updatedAt: new Date()
      })

      await loadData()
    } catch (error) {
      logger.error('Error undoing completion:', error)
    }
  }

  const handleEditChoreSubmit = async (choreId: string, choreData: Partial<Chore>) => {
    try {
      await db.chores.update(choreId, { ...choreData, updatedAt: new Date() })
      await loadData()
    } catch (error) {
      logger.error('Error editing chore:', error)
      throw error
    }
  }

  const getUserById = (userId?: string) => {
    return users.find(user => user.id === userId)
  }

  const getFrequencyDisplay = (chore: Chore) => {
    if (chore.frequency === 'custom' && chore.customFrequency) {
      const { type, value } = chore.customFrequency
      switch (type) {
        case 'times_per_day':
          return tFreq('timesDaily', { times: value })
        case 'times_per_week':
          return tFreq('timesWeekly', { times: value })
        case 'times_per_month':
          return tFreq('timesMonthly', { times: value })
        case 'days_interval':
          return tFreq('everyDays', { days: value })
        default:
          return tFreq('custom')
      }
    }

    switch (chore.frequency) {
      case 'daily':
        return tFreq('daily')
      case 'weekly':
        return tFreq('weekly')
      case 'monthly':
        return tFreq('monthly')
      default:
        return chore.frequency
    }
  }

  const isOverdue = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    return d < new Date()
  }

  const formatDueDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000))

    if (days === 0) return t('dueToday')
    if (days === 1) return t('dueTomorrow')
    if (days === -1) return t('dueYesterday')
    if (days < 0) return t('overdueDays', { days: Math.abs(days) })
    return t('dueInDays', { days })
  }

  // Filter chores
  const filteredChores = useMemo(() => {
    return chores.filter(chore => {
      const matchesSearch = !searchQuery ||
        chore.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (chore.description && chore.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesFrequency = frequencyFilter === 'all' || chore.frequency === frequencyFilter

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'completed' && chore.isCompleted) ||
        (statusFilter === 'pending' && !chore.isCompleted && !isOverdue(chore.nextDue)) ||
        (statusFilter === 'overdue' && !chore.isCompleted && isOverdue(chore.nextDue))

      const matchesAssignee = assigneeFilter === 'all' ||
        (assigneeFilter === 'unassigned' && !chore.assignedUserId) ||
        chore.assignedUserId === assigneeFilter

      return matchesSearch && matchesFrequency && matchesStatus && matchesAssignee
    })
  }, [chores, searchQuery, frequencyFilter, statusFilter, assigneeFilter])

  // Helper to check if chore is due today or overdue
  const isDueToday = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return d <= today
  }

  // Separate chores into three categories
  const dueTodayChores = filteredChores.filter(c => !c.isCompleted && isDueToday(c.nextDue))
  const completedChores = filteredChores.filter(c => c.isCompleted)
  const upcomingChores = filteredChores.filter(c => !c.isCompleted && !isDueToday(c.nextDue))

  // Calculate daily progress (chores due today that are completed)
  const dailyProgress = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dueTodayOrOverdue = chores.filter(c => {
      const dueDate = c.nextDue instanceof Date ? c.nextDue : new Date(c.nextDue)
      return dueDate < tomorrow
    })

    const completedToday = dueTodayOrOverdue.filter(c => c.isCompleted)

    return {
      total: dueTodayOrOverdue.length,
      completed: completedToday.length,
      percentage: dueTodayOrOverdue.length > 0 ? (completedToday.length / dueTodayOrOverdue.length) * 100 : 0
    }
  }, [chores])

  const clearFilters = () => {
    setSearchQuery('')
    setFrequencyFilter('all')
    setStatusFilter('all')
    setAssigneeFilter('all')
  }

  const hasActiveFilters = frequencyFilter !== 'all' || statusFilter !== 'all' || assigneeFilter !== 'all'

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-96">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-lg font-medium text-muted-foreground">{t('loadingChores')}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const ChoreCard = ({ chore, isUpcoming = false }: { chore: Chore; isUpcoming?: boolean }) => {
    const assignedUser = getUserById(chore.assignedUserId)
    const completedByUser = getUserById(chore.lastCompletedBy)
    const overdue = !chore.isCompleted && isOverdue(chore.nextDue)
    const isCompleted = chore.isCompleted

    return (
      <Card className={`group h-full flex flex-col transition-all hover:shadow-md ${
        isUpcoming ? 'opacity-50 bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700' :
        isCompleted ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
        overdue ? 'border-red-300 dark:border-red-700' : 'hover:border-purple-300 dark:hover:border-purple-600'
      }`}>
        <CardContent className="p-3 flex flex-col h-full">
          {/* Title and badges */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className={`font-medium text-sm truncate ${isCompleted ? 'line-through text-green-700 dark:text-green-400' : ''}`}>
                {chore.title}
              </h3>
              {chore.description && (
                <p className={`text-xs line-clamp-1 mt-0.5 ${isCompleted ? 'text-green-600/70 dark:text-green-500/70' : 'text-gray-500 dark:text-gray-400'}`}>
                  {chore.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {overdue && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{t('overdue')}</Badge>}
              {isCompleted && <Badge className="text-[10px] px-1.5 py-0 bg-green-500">✓</Badge>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditChore(chore)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    {t('editChore')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 dark:text-red-400"
                    onClick={() => handleDeleteChore(chore)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {tCommon('delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Info row: frequency, due date, assignee */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3 flex-wrap">
            <span className="flex items-center gap-0.5">
              <Repeat className="h-3 w-3" />
              {getFrequencyDisplay(chore)}
            </span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className={`flex items-center gap-0.5 ${overdue ? 'text-red-600 dark:text-red-400' : isCompleted ? 'text-green-600 dark:text-green-400' : ''}`}>
              <Calendar className="h-3 w-3" />
              {isCompleted && chore.completedAt
                ? new Date(chore.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : formatDueDate(chore.nextDue)
              }
            </span>
            {assignedUser && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-medium"
                    style={{ backgroundColor: assignedUser.color }}
                  >
                    {assignedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[60px]">{assignedUser.name}</span>
                </span>
              </>
            )}
          </div>

          {/* Completed by info */}
          {isCompleted && completedByUser && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mb-3 bg-green-100/50 dark:bg-green-900/20 rounded px-2 py-1">
              <CheckSquare className="h-3 w-3" />
              <span>{t('completedBy')}: {completedByUser.name}</span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action button */}
          <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
            {!isCompleted ? (
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => handleCompleteChore(chore)}
              >
                <CheckSquare className="mr-1 h-3 w-3" />
                {t('markComplete')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                onClick={() => handleUndoComplete(chore)}
              >
                <Undo className="mr-1 h-3 w-3" />
                {t('undoComplete')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <Button size="default" className="h-10 px-4" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addChore')}
          </Button>
        </div>

        {/* Daily Progress Bar */}
        {chores.length > 0 && (
          <div className="mb-4 p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('dailyProgress')}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {dailyProgress.completed}/{dailyProgress.total} {t('completed')}
              </span>
            </div>
            <Progress value={dailyProgress.percentage} className="h-2" />
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-4 space-y-2">
          <div className="flex gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-10"
              />
            </div>

            {/* Filter Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {t('filters.title')}
                  {hasActiveFilters && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] text-white">
                      {[frequencyFilter, statusFilter, assigneeFilter].filter(f => f !== 'all').length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">{t('filters.title')}</h4>

                  {/* Frequency */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.frequency')}</Label>
                    <Select value={frequencyFilter} onValueChange={(v) => setFrequencyFilter(v as FrequencyFilter)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="daily">{tFreq('daily')}</SelectItem>
                        <SelectItem value="weekly">{tFreq('weekly')}</SelectItem>
                        <SelectItem value="monthly">{tFreq('monthly')}</SelectItem>
                        <SelectItem value="custom">{tFreq('custom')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.status')}</Label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="pending">{t('filters.pending')}</SelectItem>
                        <SelectItem value="completed">{t('filters.completed')}</SelectItem>
                        <SelectItem value="overdue">{t('overdue')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignee */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.assignee')}</Label>
                    <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="unassigned">{t('notAssigned')}</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id!}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                              <span>{user.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear all */}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-gray-500"
                      onClick={clearFilters}
                    >
                      {t('filters.clearAll')}
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs text-gray-500">{t('filters.active')}:</span>

              {frequencyFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                  <Repeat className="h-3 w-3" />
                  {tFreq(frequencyFilter)}
                  <button
                    onClick={() => setFrequencyFilter('all')}
                    className="btn-compact ml-0.5 hover:text-purple-900 dark:hover:text-purple-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {statusFilter !== 'all' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  statusFilter === 'overdue'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : statusFilter === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  <CheckSquare className="h-3 w-3" />
                  {statusFilter === 'pending' ? t('filters.pending') : statusFilter === 'completed' ? t('filters.completed') : t('overdue')}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="btn-compact ml-0.5 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {assigneeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                  <User className="h-3 w-3" />
                  {assigneeFilter === 'unassigned'
                    ? t('notAssigned')
                    : users.find(u => u.id === assigneeFilter)?.name || ''}
                  <button
                    onClick={() => setAssigneeFilter('all')}
                    className="btn-compact ml-0.5 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {filteredChores.length} {filteredChores.length === 1 ? t('chore') : t('chores')}
        </div>

        {chores.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
            <CardContent className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Repeat className="mx-auto h-12 w-12 mb-4" />
                <p className="text-xl mb-2">{t('noChoresYet')}</p>
                <p className="text-base mb-4">{t('createFirstChore')}</p>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('addFirstChore')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : filteredChores.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
            <CardContent className="flex items-center justify-center h-24 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Search className="mx-auto h-6 w-6 mb-1" />
                <p>{t('noChoresFound')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Due Today Section */}
            {dueTodayChores.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('sections.dueToday')} ({dueTodayChores.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {dueTodayChores.map((chore) => (
                    <ChoreCard key={chore.id} chore={chore} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Chores Section */}
            {completedChores.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-500" />
                  {t('sections.completed')} ({completedChores.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {completedChores.map((chore) => (
                    <ChoreCard key={chore.id} chore={chore} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Chores Section (greyed out) */}
            {upcomingChores.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('sections.upcoming')} ({upcomingChores.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {upcomingChores.map((chore) => (
                    <ChoreCard key={chore.id} chore={chore} isUpcoming />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Chore Modal */}
        <ChoreFormModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onCreateChore={handleCreateChore}
        />

        {/* Edit Chore Modal */}
        <ChoreFormModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          chore={selectedChore}
          onEditChore={handleEditChoreSubmit}
        />

        <CompleteChoreModal
          open={isCompleteModalOpen}
          onOpenChange={setIsCompleteModalOpen}
          onComplete={handleConfirmComplete}
          choreTitle={selectedChore?.title || ""}
        />
      </div>
    </div>
  )
}
