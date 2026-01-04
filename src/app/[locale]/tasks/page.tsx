'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Calendar, CheckCircle, Edit3, Trash2, Search, User, Clock, FolderKanban, AlertTriangle, Tag, Settings, Upload, ChevronLeft, ChevronRight, Filter, X, Eye } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { db, Task, HomeImprovement, TaskCategory, deleteWithSync } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { TaskFormDialog } from './components/TaskFormDialog'
import { ManageTaskCategoriesDialog } from './components/ManageTaskCategoriesDialog'
import { ImportTasksDialog } from './components/ImportTasksDialog'
import { logger } from '@/lib/logger'
import { ActivityLogger } from '@/lib/activity'

const TASKS_PER_PAGE = 20

export default function TasksPage() {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const tCat = useTranslations('tasks.defaultTaskCategories')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const tasksData = useLiveQuery(
    () => db.tasks.orderBy('createdAt').reverse().toArray(),
    []
  )
  const tasks = useMemo(() => tasksData || [], [tasksData])

  const taskStats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const completed = tasks.filter(t => t.isCompleted)
    const pending = tasks.filter(t => !t.isCompleted)

    const completedThisMonth = completed.filter(t => {
      const updatedAt = t.updatedAt ? new Date(t.updatedAt) : null
      return updatedAt && updatedAt >= startOfMonth
    })

    const overdue = pending.filter(t => {
      if (!t.dueDate) return false
      const dueDate = new Date(t.dueDate)
      dueDate.setHours(23, 59, 59, 999)
      return dueDate < now
    })

    const highPriorityPending = pending.filter(t => t.priority === 'high')

    return {
      total: tasks.length,
      completed: completed.length,
      completionRate: tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0,
      completedThisMonth: completedThisMonth.length,
      overdue: overdue.length,
      highPriorityPending: highPriorityPending.length
    }
  }, [tasks])

  const users = useLiveQuery(
    () => db.users.toArray(),
    []
  ) || []

  const projects = useLiveQuery(
    () => db.homeImprovements.toArray(),
    []
  ) || []

  const categories = useLiveQuery(
    () => db.taskCategories.toArray(),
    []
  ) || []

  const priorityBorderColors = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-green-500'
  }

  const translateCategoryName = (categoryName: string) => {
    if (categoryName.startsWith('defaultTaskCategories.')) {
      const key = categoryName.replace('defaultTaskCategories.', '')
      const categoryMap: Record<string, string> = {
        'personal': tCat('personal'),
        'work': tCat('work'),
        'home': tCat('home'),
        'shopping': tCat('shopping'),
        'health': tCat('health'),
        'finance': tCat('finance'),
        'errands': tCat('errands'),
        'other': tCat('other')
      }
      return categoryMap[key] || categoryName
    }
    return categoryName
  }

  const handleMarkComplete = async (task: Task) => {
    if (!task.id) return
    try {
      await db.tasks.update(task.id, { isCompleted: true, updatedAt: new Date() })
      await ActivityLogger.taskCompleted(task.id, task.title, task.assignedUserId, task.householdId)
    } catch (error) {
      logger.error('Error marking task as complete:', error)
    }
  }

  const handleDeleteTask = async (task: Task) => {
    if (!task.id) return
    try {
      await deleteWithSync(db.tasks, 'tasks', task.id)
      await ActivityLogger.taskDeleted(task.id, task.title, task.assignedUserId, task.householdId)
    } catch (error) {
      logger.error('Error deleting task:', error)
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setEditDialogOpen(true)
  }

  const handleViewTask = (task: Task) => {
    setViewingTask(task)
    setDetailsDialogOpen(true)
  }

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null
    const project = projects.find(p => p.id === projectId)
    return project?.title || null
  }

  const getCategory = (categoryId?: string) => {
    if (!categoryId) return null
    return categories.find(c => c.id === categoryId) || null
  }

  const formatEstimatedTime = (estimatedTime?: { hours: number; minutes: number }) => {
    if (!estimatedTime) return null
    const { hours, minutes } = estimatedTime
    if (hours === 0 && minutes === 0) return null
    if (hours === 0) return `${minutes}m`
    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}m`
  }

  const isBlockedByIncompleteTask = (task: Task) => {
    if (!task.blockedByTaskId) return false
    const blocker = tasks.find(t => t.id === task.blockedByTaskId)
    return blocker && !blocker.isCompleted
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'completed' && task.isCompleted) ||
        (statusFilter === 'pending' && !task.isCompleted)
      const matchesAssignee = assigneeFilter === 'all' ||
        (assigneeFilter === 'unassigned' && !task.assignedUserId) ||
        task.assignedUserId?.toString() === assigneeFilter
      const matchesProject = projectFilter === 'all' ||
        (projectFilter === 'none' && !task.linkedProjectId) ||
        task.linkedProjectId?.toString() === projectFilter
      const matchesCategory = categoryFilter === 'all' ||
        (categoryFilter === 'none' && !task.category) ||
        task.category?.toString() === categoryFilter

      return matchesSearch && matchesPriority && matchesStatus && matchesAssignee && matchesProject && matchesCategory
    })
  }, [tasks, searchQuery, priorityFilter, statusFilter, assigneeFilter, projectFilter, categoryFilter])

  // Reset to page 1 when filters change
  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE)
  const validCurrentPage = Math.min(currentPage, Math.max(1, totalPages))

  const paginatedTasks = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * TASKS_PER_PAGE
    return filteredTasks.slice(startIndex, startIndex + TASKS_PER_PAGE)
  }, [filteredTasks, validCurrentPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="p-4 sm:p-6 pb-24 sm:pb-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('import.button')}</span>
            </Button>
            <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setCategoriesDialogOpen(true)}>
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('manageCategories')}</span>
            </Button>
            <Button size="sm" className="sm:size-default flex-1 sm:flex-initial" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="sm:hidden">{t('addTask')}</span>
              <span className="hidden sm:inline">{t('addTask')}</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats Section */}
        {tasks.length > 0 && (
          <div className="mb-4 space-y-3">
            {/* Overall Progress - Full Width */}
            <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('stats.overallProgress')}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {taskStats.completed}/{taskStats.total}
                </span>
              </div>
              <Progress value={taskStats.completionRate} className="h-2" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Completed This Month */}
              <div className="p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {taskStats.completedThisMonth}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('stats.completedThisMonth')}
                </div>
              </div>

              {/* Overdue Tasks */}
              <div className={`p-3 rounded-lg border ${
                taskStats.overdue > 0
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
              }`}>
                <div className={`text-2xl font-bold ${
                  taskStats.overdue > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {taskStats.overdue}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('stats.overdue')}
                </div>
              </div>

              {/* High Priority Pending */}
              <div className={`p-3 rounded-lg border ${
                taskStats.highPriorityPending > 0
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
              }`}>
                <div className={`text-2xl font-bold ${
                  taskStats.highPriorityPending > 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {taskStats.highPriorityPending}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('stats.highPriority')}
                </div>
              </div>
            </div>
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
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
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
                  {(categoryFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || assigneeFilter !== 'all' || projectFilter !== 'all') && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] text-white">
                      {[categoryFilter, priorityFilter, statusFilter, assigneeFilter, projectFilter].filter(f => f !== 'all').length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">{t('filters.title')}</h4>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.category')}</Label>
                    <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="none">{t('form.noCategory')}</SelectItem>
                        {categories.map((category: TaskCategory) => (
                          <SelectItem key={category.id} value={category.id!.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color || '#6b7280' }} />
                              <span>{translateCategoryName(category.name)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.priority')}</Label>
                    <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            {t('priority.high')}
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            {t('priority.medium')}
                          </div>
                        </SelectItem>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            {t('priority.low')}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.status')}</Label>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="pending">{t('status.pending')}</SelectItem>
                        <SelectItem value="completed">{t('status.completed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignee */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.assignee')}</Label>
                    <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="unassigned">{tCommon('notAssigned')}</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id!.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                              <span>{user.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Project */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{t('filters.project')}</Label>
                    <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tCommon('all')}</SelectItem>
                        <SelectItem value="none">{t('form.noProject')}</SelectItem>
                        {projects.map((project: HomeImprovement) => (
                          <SelectItem key={project.id} value={project.id!.toString()}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear all */}
                  {(categoryFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || assigneeFilter !== 'all' || projectFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-gray-500"
                      onClick={() => {
                        setCategoryFilter('all')
                        setPriorityFilter('all')
                        setStatusFilter('all')
                        setAssigneeFilter('all')
                        setProjectFilter('all')
                        setCurrentPage(1)
                      }}
                    >
                      {t('filters.clearAll')}
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Active Filters */}
          {(categoryFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || assigneeFilter !== 'all' || projectFilter !== 'all') && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs text-gray-500">{t('filters.active')}:</span>

              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                  <Tag className="h-3 w-3" />
                  {categoryFilter === 'none'
                    ? t('form.noCategory')
                    : translateCategoryName(categories.find(c => c.id === categoryFilter)?.name || '')}
                  <button
                    onClick={() => { setCategoryFilter('all'); setCurrentPage(1) }}
                    className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {priorityFilter !== 'all' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  priorityFilter === 'high'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : priorityFilter === 'medium'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                }`}>
                  {t(`priority.${priorityFilter}`)}
                  <button
                    onClick={() => { setPriorityFilter('all'); setCurrentPage(1) }}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
                  <CheckCircle className="h-3 w-3" />
                  {t(`status.${statusFilter}`)}
                  <button
                    onClick={() => { setStatusFilter('all'); setCurrentPage(1) }}
                    className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {assigneeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                  <User className="h-3 w-3" />
                  {assigneeFilter === 'unassigned'
                    ? tCommon('notAssigned')
                    : users.find(u => u.id === assigneeFilter)?.name || ''}
                  <button
                    onClick={() => { setAssigneeFilter('all'); setCurrentPage(1) }}
                    className="ml-0.5 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {projectFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs">
                  <FolderKanban className="h-3 w-3" />
                  {projectFilter === 'none'
                    ? t('form.noProject')
                    : projects.find(p => p.id === projectFilter)?.title || ''}
                  <button
                    onClick={() => { setProjectFilter('all'); setCurrentPage(1) }}
                    className="ml-0.5 hover:text-violet-900 dark:hover:text-violet-100"
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
          {filteredTasks.length} {filteredTasks.length === 1 ? t('pagination.task') : t('pagination.tasks')}
          {totalPages > 1 && ` • ${t('pagination.page')} ${validCurrentPage} ${t('pagination.of')} ${totalPages}`}
        </div>

        {/* Compact Task List */}
        <div className="space-y-2 sm:space-y-1">
          {paginatedTasks.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
              <CardContent className="flex items-center justify-center h-24 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  {tasks.length === 0 ? (
                    <>
                      <Plus className="mx-auto h-6 w-6 mb-1" />
                      <p>{t('noTasks')}</p>
                    </>
                  ) : (
                    <>
                      <Search className="mx-auto h-6 w-6 mb-1" />
                      <p>{t('noTasksFound')}</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            paginatedTasks.map((task) => {
              const projectName = getProjectName(task.linkedProjectId)
              const category = getCategory(task.category)
              const estimatedTimeStr = formatEstimatedTime(task.estimatedTime)
              const isBlocked = isBlockedByIncompleteTask(task)
              const assignedUser = task.assignedUserId ? users.find(u => u.id === task.assignedUserId) : null

              return (
                <div
                  key={task.id}
                  className={`group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 py-3 sm:py-1.5 px-3 rounded-lg sm:rounded-md border-l-3 transition-all ${
                    priorityBorderColors[task.priority as keyof typeof priorityBorderColors]
                  } ${
                    task.isCompleted
                      ? 'bg-gray-50/50 dark:bg-gray-800/30 opacity-50'
                      : isBlocked
                        ? 'bg-orange-50/30 dark:bg-orange-900/5 border-l-3 border-y border-r border-orange-100/50 dark:border-orange-900/20'
                        : 'bg-white/50 dark:bg-gray-800/50 sm:bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/30 border-l-3 border-y border-r border-gray-100 dark:border-gray-800 sm:border-transparent sm:hover:border-gray-100 dark:sm:hover:border-gray-800'
                  }`}
                >
                  {/* Top row: Checkbox, Title, Actions */}
                  <div className="flex items-center gap-2 sm:gap-2 flex-1 min-w-0">
                    {/* Checkbox / Status */}
                    <button
                      onClick={() => !task.isCompleted && !isBlocked && handleMarkComplete(task)}
                      disabled={task.isCompleted || isBlocked}
                      className={`flex-shrink-0 w-5 h-5 sm:w-3.5 sm:h-3.5 rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
                        task.isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : isBlocked
                            ? 'border-orange-400 bg-orange-100 dark:bg-orange-900/30 cursor-not-allowed'
                            : 'border-gray-300 dark:border-gray-500 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 active:bg-purple-100 dark:active:bg-purple-900/40'
                      }`}
                      title={task.isCompleted ? t('status.completed') : isBlocked ? t('completeBlockerFirst') : t('markComplete')}
                    >
                      {task.isCompleted && <CheckCircle className="h-3 w-3 sm:h-2 sm:w-2" />}
                      {isBlocked && !task.isCompleted && <AlertTriangle className="h-3 w-3 sm:h-2 sm:w-2 text-orange-500" />}
                    </button>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <button
                        onClick={() => handleViewTask(task)}
                        className={`font-medium text-sm text-left ${
                          task.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400'
                        } sm:truncate line-clamp-2 sm:line-clamp-1`}
                      >
                        {task.title}
                      </button>

                      {/* Inline badges - desktop only */}
                      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                        {/* Priority badge */}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          task.priority === 'high'
                            ? 'bg-red-100/70 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            : task.priority === 'medium'
                              ? 'bg-yellow-100/70 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-green-100/70 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {t(`priority.${task.priority}`)}
                        </span>
                        {category && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: `${category.color}15`, color: category.color }}
                          >
                            {translateCategoryName(category.name)}
                          </span>
                        )}
                        {isBlocked && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-orange-100/70 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            {t('blocked')}
                          </span>
                        )}
                      </div>

                      {/* Actions - desktop: show on hover, mobile: always visible */}
                      <div className="flex items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto sm:ml-0">
                        <button
                          className="p-2 sm:p-1 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-900/30 active:bg-purple-100 dark:active:bg-purple-900/50 sm:hidden"
                          onClick={() => handleViewTask(task)}
                          title={t('viewDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 sm:p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit3 className="h-4 w-4 sm:h-3 sm:w-3" />
                        </button>
                        <button
                          className="p-2 sm:p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 active:bg-red-100 dark:active:bg-red-900/50"
                          onClick={() => handleDeleteTask(task)}
                        >
                          <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Mobile badges and meta info */}
                  <div className="flex sm:hidden flex-wrap items-center gap-1.5 pl-7">
                    {/* Priority badge */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      task.priority === 'high'
                        ? 'bg-red-100/70 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : task.priority === 'medium'
                          ? 'bg-yellow-100/70 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-green-100/70 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {t(`priority.${task.priority}`)}
                    </span>
                    {category && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${category.color}15`, color: category.color }}
                      >
                        {translateCategoryName(category.name)}
                      </span>
                    )}
                    {isBlocked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-100/70 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                        {t('blocked')}
                      </span>
                    )}
                    {assignedUser && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-medium"
                          style={{ backgroundColor: assignedUser.color }}
                        >
                          {assignedUser.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="max-w-[60px] truncate">{assignedUser.name}</span>
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {estimatedTimeStr && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {estimatedTimeStr}
                      </span>
                    )}
                    {projectName && (
                      <span className="flex items-center gap-0.5 text-[10px] text-purple-500 dark:text-purple-400">
                        <FolderKanban className="h-3 w-3" />
                        <span className="max-w-[80px] truncate">{projectName}</span>
                      </span>
                    )}
                  </div>

                  {/* Meta info - desktop only */}
                  <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {assignedUser && (
                      <span className="flex items-center gap-1">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-medium flex-shrink-0"
                          style={{ backgroundColor: assignedUser.color }}
                        >
                          {assignedUser.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-gray-600 dark:text-gray-300 max-w-[80px] truncate">
                          {assignedUser.name}
                        </span>
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-0.5 whitespace-nowrap">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {estimatedTimeStr && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {estimatedTimeStr}
                      </span>
                    )}
                    {projectName && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-0.5 text-purple-500 dark:text-purple-400 max-w-[150px] truncate cursor-default">
                              <FolderKanban className="h-2.5 w-2.5 flex-shrink-0" />
                              {projectName}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{projectName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(validCurrentPage - 1)}
              disabled={validCurrentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first page, last page, and pages around current
              const showPage = page === 1 ||
                page === totalPages ||
                Math.abs(page - validCurrentPage) <= 1

              if (!showPage) {
                // Show ellipsis
                if (page === 2 || page === totalPages - 1) {
                  return <span key={page} className="px-2 text-gray-400">...</span>
                }
                return null
              }

              return (
                <Button
                  key={page}
                  variant={page === validCurrentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className="min-w-[36px]"
                >
                  {page}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(validCurrentPage + 1)}
              disabled={validCurrentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Add Task Dialog */}
        <TaskFormDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          users={users}
          categories={categories}
        />

        {/* Edit Task Dialog */}
        <TaskFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          task={editingTask}
          users={users}
          categories={categories}
        />

        <ManageTaskCategoriesDialog
          open={categoriesDialogOpen}
          onOpenChange={setCategoriesDialogOpen}
          categories={categories}
        />

        <ImportTasksDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          users={users}
          categories={categories}
          projects={projects}
          existingTasks={tasks}
        />

        {/* Task Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            {viewingTask && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl pr-8">
                    {viewingTask.title}
                  </DialogTitle>
                  {viewingTask.description && (
                    <DialogDescription className="text-base mt-2 whitespace-pre-wrap">
                      {viewingTask.description}
                    </DialogDescription>
                  )}
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Status and Priority */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={viewingTask.isCompleted ? "secondary" : "default"}>
                      {viewingTask.isCompleted ? t('status.completed') : t('status.pending')}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        viewingTask.priority === 'high'
                          ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/30'
                          : viewingTask.priority === 'medium'
                            ? 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30'
                            : 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/30'
                      }
                    >
                      {t(`priority.${viewingTask.priority}`)}
                    </Badge>
                    {isBlockedByIncompleteTask(viewingTask) && (
                      <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-900/30">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {t('blocked')}
                      </Badge>
                    )}
                  </div>

                  {/* Category */}
                  {viewingTask.category && (
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        {translateCategoryName(getCategory(viewingTask.category)?.name || '')}
                      </span>
                    </div>
                  )}

                  {/* Assigned User */}
                  {viewingTask.assignedUserId && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        {users.find(u => u.id === viewingTask.assignedUserId)?.name || tCommon('notAssigned')}
                      </span>
                    </div>
                  )}

                  {/* Due Date */}
                  {viewingTask.dueDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        {new Date(viewingTask.dueDate).toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}

                  {/* Estimated Time */}
                  {viewingTask.estimatedTime && (viewingTask.estimatedTime.hours > 0 || viewingTask.estimatedTime.minutes > 0) && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        {formatEstimatedTime(viewingTask.estimatedTime)}
                      </span>
                    </div>
                  )}

                  {/* Linked Project */}
                  {viewingTask.linkedProjectId && (
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-purple-600 dark:text-purple-400">
                        {getProjectName(viewingTask.linkedProjectId)}
                      </span>
                    </div>
                  )}

                  {/* Blocked By */}
                  {viewingTask.blockedByTaskId && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('blockedBy')}:</span>
                      </div>
                      <span className="text-sm text-orange-700 dark:text-orange-300 mt-1 block">
                        {tasks.find(t => t.id === viewingTask.blockedByTaskId)?.title || viewingTask.blockedByTaskId}
                      </span>
                    </div>
                  )}

                  {/* Created At */}
                  <div className="text-xs text-gray-400 pt-2 border-t">
                    {t('createdAt')}: {new Date(viewingTask.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setDetailsDialogOpen(false)
                        handleEditTask(viewingTask)
                      }}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      {t('editTask')}
                    </Button>
                    {!viewingTask.isCompleted && !isBlockedByIncompleteTask(viewingTask) && (
                      <Button
                        className="flex-1"
                        onClick={() => {
                          handleMarkComplete(viewingTask)
                          setDetailsDialogOpen(false)
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('markComplete')}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
