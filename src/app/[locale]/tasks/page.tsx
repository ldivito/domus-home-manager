'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { List, Plus, Calendar, AlertCircle, CheckCircle, Edit3, Trash2, Search, Filter, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, Task } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddTaskDialog } from './components/AddTaskDialog'
import { EditTaskDialog } from './components/EditTaskDialog'

export default function TasksPage() {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

  const tasks = useLiveQuery(
    () => db.tasks.orderBy('createdAt').reverse().toArray(),
    []
  ) || []

  const users = useLiveQuery(
    () => db.users.toArray(),
    []
  ) || []

  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800'
  }

  const handleMarkComplete = async (taskId: number) => {
    try {
      await db.tasks.update(taskId, { isCompleted: true })
    } catch (error) {
      console.error('Error marking task as complete:', error)
    }
  }

  const handleDeleteTask = async (taskId: number) => {
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

  const getUserName = (userId?: number) => {
    if (!userId) return tCommon('notAssigned')
    const user = users.find(u => u.id === userId)
    return user?.name || tCommon('notAssigned')
  }

  const filteredTasks = tasks.filter(task => {
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
    
    return matchesSearch && matchesPriority && matchesStatus && matchesAssignee
  })

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('title')}</h1>
            <p className="text-xl text-gray-600">{t('subtitle')}</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-6 w-6" />
            {t('addTask')}
          </Button>
        </div>
        
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t('filters.priority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
                  <SelectItem value="high">{t('priority.high')}</SelectItem>
                  <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                  <SelectItem value="low">{t('priority.low')}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('filters.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
                  <SelectItem value="pending">{t('status.pending')}</SelectItem>
                  <SelectItem value="completed">{t('status.completed')}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-40">
                  <User className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t('filters.assignee')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
                  <SelectItem value="unassigned">{tCommon('notAssigned')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id!.toString()}>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: user.color }}
                        />
                        <span>{user.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <div className="grid gap-6">
          {filteredTasks.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  {tasks.length === 0 ? (
                    <>
                      <Plus className="mx-auto h-8 w-8 mb-2" />
                      <p className="text-lg">{t('noTasks')}</p>
                      <p className="text-sm">{t('addFirstTask')}</p>
                    </>
                  ) : (
                    <>
                      <Search className="mx-auto h-8 w-8 mb-2" />
                      <p className="text-lg">{t('noTasksFound')}</p>
                      <p className="text-sm">{t('tryDifferentFilter')}</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map((task) => (
            <Card key={task.id} className={`transition-all ${task.isCompleted ? 'opacity-75 bg-green-50' : 'hover:shadow-md'}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className={`text-xl flex items-center ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {task.isCompleted ? (
                        <CheckCircle className="mr-3 h-6 w-6 text-green-600" />
                      ) : (
                        <List className="mr-3 h-6 w-6 text-gray-600" />
                      )}
                      {task.title}
                    </CardTitle>
                    {task.description && (
                      <CardDescription className="text-base mt-2">{task.description}</CardDescription>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="mr-1 h-4 w-4" />
                        <span>{getUserName(task.assignedUserId)}</span>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="mr-1 h-4 w-4" />
                          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
                      {task.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    {task.priority === 'high' && !task.isCompleted && (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="mr-1 h-4 w-4" />
                        <span className="text-sm font-medium">{t('priority.high')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {!task.isCompleted && (
                      <Button className="h-10 px-6" onClick={() => handleMarkComplete(task.id!)}>
                        {t('markComplete')}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEditTask(task)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteTask(task.id!)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
          )}
        </div>
        
        <AddTaskDialog 
          open={addDialogOpen} 
          onOpenChange={setAddDialogOpen}
          users={users}
        />
        
        <EditTaskDialog 
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          task={editingTask}
          users={users}
        />
      </div>
    </div>
  )
}