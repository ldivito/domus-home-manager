'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { List, Plus, Calendar, CheckCircle, Edit3, Trash2, Search, Filter, User, Clock, FolderKanban, AlertTriangle, Tag, Settings, Upload, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, Task, HomeImprovement, TaskCategory } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddTaskDialog } from './components/AddTaskDialog'
import { EditTaskDialog } from './components/EditTaskDialog'
import { ManageTaskCategoriesDialog } from './components/ManageTaskCategoriesDialog'
import { ImportTasksDialog } from './components/ImportTasksDialog'

const TASKS_PER_PAGE = 10

export default function TasksPage() {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const tCat = useTranslations('tasks.defaultTaskCategories')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const tasksData = useLiveQuery(
    () => db.tasks.orderBy('createdAt').reverse().toArray(),
    []
  )
  const tasks = useMemo(() => tasksData || [], [tasksData])

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

  const priorityColors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
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

  const handleMarkComplete = async (taskId: string) => {
    try {
      await db.tasks.update(taskId, { isCompleted: true })
    } catch (error) {
      console.error('Error marking task as complete:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await db.tasks.delete(taskId)
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setEditDialogOpen(true)
  }

  const getUserName = (userId?: string) => {
    if (!userId) return null
    const user = users.find(u => u.id === userId)
    return user?.name || null
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

  const getBlockerTask = (blockerTaskId?: string) => {
    if (!blockerTaskId) return null
    const blocker = tasks.find(t => t.id === blockerTaskId)
    return blocker || null
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
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('import.button')}
            </Button>
            <Button variant="outline" onClick={() => setCategoriesDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              {t('manageCategories')}
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addTask')}
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                placeholder={t('searchPlaceholder')}
                className="pl-10 h-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-36 h-9">
                  <Tag className="mr-1 h-3 w-3" />
                  <SelectValue placeholder={t('filters.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
                  <SelectItem value="none">{t('form.noCategory')}</SelectItem>
                  {categories.map((category: TaskCategory) => (
                    <SelectItem key={category.id} value={category.id!.toString()}>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color || '#6b7280' }} />
                        <span>{translateCategoryName(category.name)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-32 h-9">
                  <Filter className="mr-1 h-3 w-3" />
                  <SelectValue placeholder={t('filters.priority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
                  <SelectItem value="high">{t('priority.high')}</SelectItem>
                  <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                  <SelectItem value="low">{t('priority.low')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder={t('filters.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
                  <SelectItem value="pending">{t('status.pending')}</SelectItem>
                  <SelectItem value="completed">{t('status.completed')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-32 h-9">
                  <User className="mr-1 h-3 w-3" />
                  <SelectValue placeholder={t('filters.assignee')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
                  <SelectItem value="unassigned">{tCommon('notAssigned')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id!.toString()}>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                        <span>{user.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setCurrentPage(1) }}>
                <SelectTrigger className="w-36 h-9">
                  <FolderKanban className="mr-1 h-3 w-3" />
                  <SelectValue placeholder={t('filters.project')} />
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
          </div>
        </div>

        {/* Results count */}
        <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {filteredTasks.length} {filteredTasks.length === 1 ? t('pagination.task') : t('pagination.tasks')}
          {totalPages > 1 && ` • ${t('pagination.page')} ${validCurrentPage} ${t('pagination.of')} ${totalPages}`}
        </div>

        {/* Compact Task List */}
        <div className="space-y-2">
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
              const blockerTask = getBlockerTask(task.blockedByTaskId)
              const isBlocked = isBlockedByIncompleteTask(task)
              const userName = getUserName(task.assignedUserId)

              return (
                <Card
                  key={task.id}
                  className={`transition-all ${
                    task.isCompleted
                      ? 'opacity-60 bg-green-50/50 dark:bg-green-900/10'
                      : isBlocked
                        ? 'border-orange-300 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-900/10'
                        : 'hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {task.isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : isBlocked ? (
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                        ) : (
                          <List className="h-5 w-5 text-gray-400" />
                        )}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium truncate ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                            {task.title}
                          </span>
                          {category && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ borderColor: category.color, color: category.color }}>
                              {translateCategoryName(category.name)}
                            </Badge>
                          )}
                          {blockerTask && !blockerTask.isCompleted && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 border-orange-400 text-orange-600 dark:text-orange-400">
                              {t('blocked')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {userName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {userName}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {estimatedTimeStr && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {estimatedTimeStr}
                            </span>
                          )}
                          {projectName && (
                            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                              <FolderKanban className="h-3 w-3" />
                              {projectName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Priority Badge */}
                      <Badge className={`${priorityColors[task.priority as keyof typeof priorityColors]} text-xs px-2`}>
                        {t(`priority.${task.priority}`).charAt(0).toUpperCase()}
                      </Badge>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!task.isCompleted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleMarkComplete(task.id!)}
                            disabled={isBlocked}
                            title={isBlocked ? t('completeBlockerFirst') : t('markComplete')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditTask(task)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteTask(task.id!)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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

        <AddTaskDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          users={users}
          categories={categories}
        />

        <EditTaskDialog
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
      </div>
    </div>
  )
}
