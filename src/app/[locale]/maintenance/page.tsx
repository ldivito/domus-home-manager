'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, MaintenanceItem, MaintenanceTask, MaintenanceItemType, MaintenanceLog, User } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Wrench,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  History,
  ClipboardList
} from 'lucide-react'
import { toast } from 'sonner'
import { AddItemDialog } from './components/AddItemDialog'
import { EditItemDialog } from './components/EditItemDialog'
import { AddTaskDialog } from './components/AddTaskDialog'
import { EditTaskDialog } from './components/EditTaskDialog'
import { LogMaintenanceDialog } from './components/LogMaintenanceDialog'
import { ItemDetailDialog } from './components/ItemDetailDialog'

// Stable empty arrays to avoid useMemo dependency issues
const EMPTY_ITEMS: MaintenanceItem[] = []
const EMPTY_TASKS: MaintenanceTask[] = []
const EMPTY_LOGS: MaintenanceLog[] = []
const EMPTY_USERS: User[] = []

const ITEM_TYPE_ICONS: Record<MaintenanceItemType, string> = {
  appliance: 'Refrigerator',
  hvac: 'Thermometer',
  plumbing: 'Droplet',
  electrical: 'Zap',
  vehicle: 'Car',
  roof: 'Home',
  exterior: 'Trees',
  landscaping: 'Flower',
  pool: 'Waves',
  security: 'Shield',
  other: 'Box'
}

const ITEM_TYPE_COLORS: Record<MaintenanceItemType, string> = {
  appliance: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  hvac: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  plumbing: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  electrical: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  vehicle: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  roof: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  exterior: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  landscaping: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  pool: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}

export default function MaintenancePage() {
  const t = useTranslations('maintenance')
  const tCommon = useTranslations('common')

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<MaintenanceItemType | 'all'>('all')
  const [activeTab, setActiveTab] = useState('items')

  // Dialog states
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [editItemOpen, setEditItemOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [editTaskOpen, setEditTaskOpen] = useState(false)
  const [logMaintenanceOpen, setLogMaintenanceOpen] = useState(false)
  const [itemDetailOpen, setItemDetailOpen] = useState(false)
  const [deleteItemOpen, setDeleteItemOpen] = useState(false)
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false)

  // Selected items
  const [selectedItem, setSelectedItem] = useState<MaintenanceItem | null>(null)
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null)
  const [selectedItemForTask, setSelectedItemForTask] = useState<MaintenanceItem | null>(null)

  // Data queries
  const items = useLiveQuery(() => db.maintenanceItems.orderBy('name').toArray()) ?? EMPTY_ITEMS
  const tasks = useLiveQuery(() => db.maintenanceTasks.orderBy('nextDue').toArray()) ?? EMPTY_TASKS
  const logs = useLiveQuery(() => db.maintenanceLogs.orderBy('completedDate').reverse().toArray()) ?? EMPTY_LOGS
  const users = useLiveQuery(() => db.users.toArray()) ?? EMPTY_USERS

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = selectedType === 'all' || item.type === selectedType
      return matchesSearch && matchesType
    })
  }, [items, searchQuery, selectedType])

  // Calculate task stats
  const taskStats = useMemo(() => {
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    return {
      overdue: tasks.filter(t => new Date(t.nextDue) < now).length,
      dueThisWeek: tasks.filter(t => {
        const dueDate = new Date(t.nextDue)
        return dueDate >= now && dueDate <= weekFromNow
      }).length,
      upcoming: tasks.filter(t => new Date(t.nextDue) > weekFromNow).length,
      total: tasks.length
    }
  }, [tasks])

  // Get upcoming tasks (next 30 days)
  const upcomingTasks = useMemo(() => {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return tasks.filter(t => {
      const dueDate = new Date(t.nextDue)
      return dueDate <= thirtyDaysFromNow
    }).slice(0, 10)
  }, [tasks])

  // Helper functions
  const getUserName = (userId?: string) => {
    if (!userId) return null
    const user = users.find(u => u.id === userId)
    return user?.name || null
  }

  const getItemName = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    return item?.name || 'Unknown Item'
  }

  const isOverdue = (date: Date) => new Date(date) < new Date()
  const isDueSoon = (date: Date) => {
    const now = new Date()
    const dueDate = new Date(date)
    const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff <= 7 && daysDiff >= 0
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString()
  }

  // Delete handlers
  const handleDeleteItem = async () => {
    if (!selectedItem?.id) return
    try {
      // Delete associated tasks and logs
      await db.maintenanceTasks.where('maintenanceItemId').equals(selectedItem.id).delete()
      await db.maintenanceLogs.where('maintenanceItemId').equals(selectedItem.id).delete()
      await db.maintenanceItems.delete(selectedItem.id)
      toast.success(t('messages.itemDeleted'))
      setDeleteItemOpen(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error(t('messages.deleteError'))
    }
  }

  const handleDeleteTask = async () => {
    if (!selectedTask?.id) return
    try {
      await db.maintenanceTasks.delete(selectedTask.id)
      toast.success(t('messages.taskDeleted'))
      setDeleteTaskOpen(false)
      setSelectedTask(null)
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error(t('messages.deleteError'))
    }
  }

  const handleCompleteTask = async (task: MaintenanceTask) => {
    setSelectedTask(task)
    setLogMaintenanceOpen(true)
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wrench className="h-8 w-8 text-primary" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('description')}</p>
          </div>
          <Button onClick={() => setAddItemOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('actions.addItem')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taskStats.overdue}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.overdue')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taskStats.dueThisWeek}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.dueThisWeek')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taskStats.upcoming}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.upcoming')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{items.length}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.totalItems')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            {t('tabs.items')}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {t('tabs.tasks')}
            {taskStats.overdue > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {taskStats.overdue}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('tabs.history')}
          </TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {selectedType === 'all' ? t('filter.allTypes') : t(`itemTypes.${selectedType}`)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedType('all')}>
                  {t('filter.allTypes')}
                </DropdownMenuItem>
                {Object.keys(ITEM_TYPE_ICONS).map((type) => (
                  <DropdownMenuItem key={type} onClick={() => setSelectedType(type as MaintenanceItemType)}>
                    {t(`itemTypes.${type}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Items Grid */}
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('empty.items.title')}</h3>
                <p className="text-muted-foreground mb-4">{t('empty.items.description')}</p>
                <Button onClick={() => setAddItemOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('actions.addItem')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const itemTasks = tasks.filter(t => t.maintenanceItemId === item.id)
                const overdueTasks = itemTasks.filter(t => isOverdue(t.nextDue))
                const nextTask = itemTasks.sort((a, b) =>
                  new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()
                )[0]

                return (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      setSelectedItem(item)
                      setItemDetailOpen(true)
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{item.name}</CardTitle>
                          <CardDescription className="truncate">
                            {item.location || item.brand || t('noLocation')}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              setSelectedItemForTask(item)
                              setAddTaskOpen(true)
                            }}>
                              <Plus className="h-4 w-4 mr-2" />
                              {t('actions.addTask')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              setSelectedItem(item)
                              setEditItemOpen(true)
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {tCommon('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedItem(item)
                                setDeleteItemOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {tCommon('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={ITEM_TYPE_COLORS[item.type]}>
                          {t(`itemTypes.${item.type}`)}
                        </Badge>
                        {overdueTasks.length > 0 && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {overdueTasks.length} {t('overdue')}
                          </Badge>
                        )}
                      </div>
                      {nextTask && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{t('nextMaintenance')}:</span>{' '}
                          <span className={isOverdue(nextTask.nextDue) ? 'text-red-600 dark:text-red-400' : ''}>
                            {formatDate(nextTask.nextDue)}
                          </span>
                        </div>
                      )}
                      {itemTasks.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">{t('noScheduledTasks')}</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <div className="space-y-4">
            {upcomingTasks.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">{t('empty.tasks.title')}</h3>
                  <p className="text-muted-foreground">{t('empty.tasks.description')}</p>
                </CardContent>
              </Card>
            ) : (
              upcomingTasks.map((task) => {
                const isTaskOverdue = isOverdue(task.nextDue)
                const isTaskDueSoon = isDueSoon(task.nextDue)

                return (
                  <Card
                    key={task.id}
                    className={`${isTaskOverdue ? 'border-red-500 dark:border-red-400' : isTaskDueSoon ? 'border-yellow-500 dark:border-yellow-400' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{task.name}</h3>
                            <Badge className={PRIORITY_COLORS[task.priority]}>
                              {t(`priorities.${task.priority}`)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getItemName(task.maintenanceItemId)}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className={`flex items-center gap-1 ${isTaskOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(task.nextDue)}
                              {isTaskOverdue && ` (${t('overdue')})`}
                            </span>
                            {task.assignedUserId && (
                              <span className="text-muted-foreground">
                                {getUserName(task.assignedUserId)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompleteTask(task)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {t('actions.complete')}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedTask(task)
                                setEditTaskOpen(true)
                              }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {tCommon('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedTask(task)
                                  setDeleteTaskOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {tCommon('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('empty.history.title')}</h3>
                <p className="text-muted-foreground">{t('empty.history.description')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {logs.slice(0, 20).map((log) => (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{log.title}</h3>
                        <p className="text-sm text-muted-foreground">{getItemName(log.maintenanceItemId)}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(log.completedDate)}
                          </span>
                          {log.actualCost && (
                            <span>
                              {log.costCurrency || 'ARS'} {log.actualCost.toLocaleString()}
                            </span>
                          )}
                          {log.serviceProvider && (
                            <span>{log.serviceProvider}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant={log.isExternalService ? 'secondary' : 'outline'}>
                        {log.isExternalService ? t('professional') : t('diy')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddItemDialog open={addItemOpen} onOpenChange={setAddItemOpen} />
      <EditItemDialog open={editItemOpen} onOpenChange={setEditItemOpen} item={selectedItem} />
      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        item={selectedItemForTask}
        items={items}
      />
      <EditTaskDialog open={editTaskOpen} onOpenChange={setEditTaskOpen} task={selectedTask} />
      <LogMaintenanceDialog
        open={logMaintenanceOpen}
        onOpenChange={setLogMaintenanceOpen}
        task={selectedTask}
        items={items}
      />
      <ItemDetailDialog
        open={itemDetailOpen}
        onOpenChange={setItemDetailOpen}
        item={selectedItem}
        tasks={tasks.filter(t => t.maintenanceItemId === selectedItem?.id)}
        logs={logs.filter(l => l.maintenanceItemId === selectedItem?.id)}
        onAddTask={() => {
          setSelectedItemForTask(selectedItem)
          setAddTaskOpen(true)
        }}
        onEditItem={() => {
          setEditItemOpen(true)
        }}
      />

      {/* Delete Item Confirmation */}
      <AlertDialog open={deleteItemOpen} onOpenChange={setDeleteItemOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.deleteItem.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.deleteItem.description', { name: selectedItem?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Task Confirmation */}
      <AlertDialog open={deleteTaskOpen} onOpenChange={setDeleteTaskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.deleteTask.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.deleteTask.description', { name: selectedTask?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
