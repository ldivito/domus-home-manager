'use client'

import { useState, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Hammer, Plus, DollarSign, User, Edit3, Trash2, CheckCircle, Calendar, GripVertical, ListTodo, Search, Filter, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, HomeImprovement } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddProjectDialog } from './components/AddProjectDialog'
import { EditProjectDialog } from './components/EditProjectDialog'
import { ProjectDetailDialog } from './components/ProjectDetailDialog'

type StatusType = 'todo' | 'in-progress' | 'done'
type SortOption = 'priority' | 'name' | 'date' | 'cost'
type FilterPriority = 'all' | 'high' | 'medium' | 'low'
type FilterStatus = 'all' | 'todo' | 'in-progress' | 'done'

export default function ProjectsPage() {
  const t = useTranslations('projects')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<HomeImprovement | null>(null)
  const [selectedProject, setSelectedProject] = useState<HomeImprovement | null>(null)
  const [draggedProject, setDraggedProject] = useState<HomeImprovement | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<StatusType | null>(null)
  const isDraggingRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterUser, setFilterUser] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('priority')

  const projects = useLiveQuery(
    () => db.homeImprovements.orderBy('createdAt').reverse().toArray(),
    []
  ) || []

  const users = useLiveQuery(
    () => db.users.toArray(),
    []
  ) || []

  const tasks = useLiveQuery(
    () => db.tasks.toArray(),
    []
  ) || []

  const priorityColors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

  const statusColors = {
    todo: 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50',
    'in-progress': 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30',
    done: 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/30'
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await db.homeImprovements.delete(projectId)
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleEditProject = (project: HomeImprovement) => {
    setEditingProject(project)
    setEditDialogOpen(true)
  }

  const handleViewProject = (project: HomeImprovement) => {
    setSelectedProject(project)
    setDetailDialogOpen(true)
  }

  const handleEditFromDetail = () => {
    if (selectedProject) {
      setDetailDialogOpen(false)
      setEditingProject(selectedProject)
      setEditDialogOpen(true)
    }
  }

  const getUserName = (userId?: string) => {
    if (!userId) return null
    const user = users.find(u => u.id === userId)
    return user?.name || null
  }

  const getTaskCounts = (projectId?: string) => {
    if (!projectId) return { pending: 0, completed: 0 }
    const linkedTasks = tasks.filter(task => task.linkedProjectId === projectId)
    return {
      pending: linkedTasks.filter(task => !task.isCompleted).length,
      completed: linkedTasks.filter(task => task.isCompleted).length
    }
  }

  const handleDragStart = (e: React.DragEvent, project: HomeImprovement) => {
    isDraggingRef.current = true
    setDraggedProject(project)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', project.id || '')
  }

  const handleDragEnd = () => {
    // Small delay to prevent click from firing after drag
    setTimeout(() => {
      isDraggingRef.current = false
    }, 100)
    setDraggedProject(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, status: StatusType) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: StatusType) => {
    e.preventDefault()
    if (draggedProject && draggedProject.status !== newStatus) {
      try {
        await db.homeImprovements.update(draggedProject.id!, { status: newStatus })
      } catch (error) {
        console.error('Error updating project status:', error)
      }
    }
    setDraggedProject(null)
    setDragOverColumn(null)
  }

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    let result = [...projects]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      )
    }

    // Priority filter
    if (filterPriority !== 'all') {
      result = result.filter(p => p.priority === filterPriority)
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus)
    }

    // User filter
    if (filterUser !== 'all') {
      result = result.filter(p => p.assignedUserId === filterUser)
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) -
                 (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
        case 'name':
          return a.title.localeCompare(b.title)
        case 'date':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        case 'cost':
          return (b.estimatedCost || 0) - (a.estimatedCost || 0)
        default:
          return 0
      }
    })

    return result
  }, [projects, searchQuery, filterPriority, filterStatus, filterUser, sortBy])

  const projectsByStatus = {
    todo: filteredProjects.filter(p => p.status === 'todo'),
    inProgress: filteredProjects.filter(p => p.status === 'in-progress'),
    done: filteredProjects.filter(p => p.status === 'done')
  }

  const hasActiveFilters = searchQuery || filterPriority !== 'all' || filterStatus !== 'all' || filterUser !== 'all'

  const clearFilters = () => {
    setSearchQuery('')
    setFilterPriority('all')
    setFilterStatus('all')
    setFilterUser('all')
  }

  const ProjectCard = ({ project }: { project: HomeImprovement }) => {
    const userName = getUserName(project.assignedUserId)
    const isDragging = draggedProject?.id === project.id
    const taskCounts = getTaskCounts(project.id)
    const totalTasks = taskCounts.pending + taskCounts.completed

    const handleCardClick = () => {
      // Only open detail if not dragging
      if (!isDraggingRef.current && !draggedProject) {
        handleViewProject(project)
      }
    }

    return (
      <Card
        className={`group cursor-grab active:cursor-grabbing transition-all ${
          isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600'
        }`}
        draggable
        onDragStart={(e) => handleDragStart(e, project)}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
      >
        <CardContent className="px-2 py-1.5">
          <div className="flex items-start gap-1.5">
            <GripVertical className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 cursor-grab" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-sm truncate">{project.title}</h3>
                <Badge className={`${priorityColors[project.priority as keyof typeof priorityColors]} text-xs px-1.5 py-0`}>
                  {t(`priority.${project.priority}`)}
                </Badge>
              </div>
              {project.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{project.description}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {userName && (
                    <span className="flex items-center">
                      <User className="mr-0.5 h-3 w-3" />
                      {userName}
                    </span>
                  )}
                  {project.estimatedCost && (
                    <span className="flex items-center">
                      <DollarSign className="h-3 w-3" />
                      {project.estimatedCost.toFixed(0)}
                    </span>
                  )}
                  {totalTasks > 0 && (
                    <span className="flex items-center gap-0.5">
                      <ListTodo className="h-3 w-3" />
                      <span className="text-green-600 dark:text-green-400">{taskCounts.completed}</span>
                      <span>/</span>
                      <span>{totalTasks}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity touch-device:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEditProject(project); }}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteProject(project.id!); }}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const KanbanColumn = ({
    status,
    title,
    icon: Icon,
    projects: columnProjects
  }: {
    status: StatusType
    title: string
    icon: React.ElementType
    projects: HomeImprovement[]
  }) => {
    const isDropTarget = dragOverColumn === status && draggedProject?.status !== status

    return (
      <div
        className={`p-2 rounded-lg border-2 transition-all h-[calc(100vh-320px)] min-h-[300px] flex flex-col ${statusColors[status]} ${
          isDropTarget ? 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900' : ''
        }`}
        onDragOver={(e) => handleDragOver(e, status)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, status)}
      >
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center flex-shrink-0">
          <Icon className="mr-1.5 h-4 w-4" />
          {title} ({columnProjects.length})
        </h2>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {columnProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {columnProjects.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
              {t('dragHere')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <Button size="default" className="h-10 px-4" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addProject')}
          </Button>
        </div>

        {/* Search, Filter, and Sort Toolbar */}
        <div className="mb-4 p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder={t('toolbar.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Priority Filter */}
            <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as FilterPriority)}>
              <SelectTrigger className="w-[130px] h-9">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder={t('toolbar.priority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('toolbar.allPriorities')}</SelectItem>
                <SelectItem value="high">{t('priority.high')}</SelectItem>
                <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                <SelectItem value="low">{t('priority.low')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-[130px] h-9">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder={t('toolbar.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('toolbar.allStatuses')}</SelectItem>
                <SelectItem value="todo">{t('status.todo')}</SelectItem>
                <SelectItem value="in-progress">{t('status.inProgress')}</SelectItem>
                <SelectItem value="done">{t('status.done')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Assigned User Filter */}
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-[130px] h-9">
                <User className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder={t('toolbar.assignee')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('toolbar.allUsers')}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id!}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[130px] h-9">
                <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder={t('toolbar.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">{t('toolbar.sortPriority')}</SelectItem>
                <SelectItem value="name">{t('toolbar.sortName')}</SelectItem>
                <SelectItem value="date">{t('toolbar.sortDate')}</SelectItem>
                <SelectItem value="cost">{t('toolbar.sortCost')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                {t('toolbar.clearFilters')}
              </Button>
            )}
          </div>

          {/* Active filters indicator */}
          {hasActiveFilters && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('toolbar.showingResults', { count: filteredProjects.length, total: projects.length })}
            </div>
          )}
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
            <CardContent className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Plus className="mx-auto h-12 w-12 mb-4" />
                <p className="text-xl mb-2">{t('noProjects')}</p>
                <p className="text-base">{t('addFirstProject')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KanbanColumn
                status="todo"
                title={t('status.todo')}
                icon={Hammer}
                projects={projectsByStatus.todo}
              />
              <KanbanColumn
                status="in-progress"
                title={t('status.inProgress')}
                icon={Calendar}
                projects={projectsByStatus.inProgress}
              />
              <KanbanColumn
                status="done"
                title={t('status.done')}
                icon={CheckCircle}
                projects={projectsByStatus.done}
              />
            </div>

            {/* Project Summary */}
            <div className="mt-4 p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-600 dark:text-gray-300">{projectsByStatus.todo.length + projectsByStatus.inProgress.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('summary.activeProjects')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{projectsByStatus.done.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('summary.completed')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    ${[...projectsByStatus.todo, ...projectsByStatus.inProgress]
                      .reduce((sum, p) => sum + (p.estimatedCost || 0), 0)
                      .toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('summary.estimatedCost')}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <AddProjectDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          users={users}
        />

        <EditProjectDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          project={editingProject}
          users={users}
        />

        <ProjectDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          project={selectedProject}
          users={users}
          tasks={tasks}
          onEdit={handleEditFromDetail}
        />
      </div>
    </div>
  )
}
