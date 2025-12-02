'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  User,
  DollarSign,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  ListTodo,
  AlertCircle
} from "lucide-react"
import { HomeImprovement, Task, User as UserType } from '@/lib/db'

interface ProjectDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: HomeImprovement | null
  users: UserType[]
  tasks: Task[]
  onEdit: () => void
}

export function ProjectDetailDialog({
  open,
  onOpenChange,
  project,
  users,
  tasks,
  onEdit
}: ProjectDetailDialogProps) {
  const t = useTranslations('projects')
  const tTasks = useTranslations('tasks')
  const locale = useLocale()

  if (!project) return null

  const linkedTasks = tasks.filter(task => task.linkedProjectId === project.id)
  const pendingTasks = linkedTasks.filter(task => !task.isCompleted)
  const completedTasks = linkedTasks.filter(task => task.isCompleted)

  const getUserName = (userId?: string) => {
    if (!userId) return null
    const user = users.find(u => u.id === userId)
    return user?.name || null
  }

  const getUserColor = (userId?: string) => {
    if (!userId) return null
    const user = users.find(u => u.id === userId)
    return user?.color || null
  }

  const priorityColors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
  }

  const statusColors = {
    todo: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const TaskItem = ({ task }: { task: Task }) => {
    const taskUserName = getUserName(task.assignedUserId)
    const taskUserColor = getUserColor(task.assignedUserId)

    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        task.isCompleted
          ? 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
      }`}>
        {task.isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
        ) : (
          <Circle className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${task.isCompleted ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </span>
            <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
              {tTasks(`priority.${task.priority}`)}
            </Badge>
          </div>
          {task.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {taskUserName && (
              <span className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: taskUserColor || '#9ca3af' }}
                />
                {taskUserName}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </span>
            )}
            {task.estimatedTime && (task.estimatedTime.hours > 0 || task.estimatedTime.minutes > 0) && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.estimatedTime.hours > 0 && `${task.estimatedTime.hours}h`}
                {task.estimatedTime.minutes > 0 && `${task.estimatedTime.minutes}m`}
              </span>
            )}
            {task.blockedByTaskId && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertCircle className="h-3 w-3" />
                {tTasks('blocked')}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className={`p-6 pr-12 ${
          project.status === 'done'
            ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-900/20 dark:to-emerald-900/20'
            : project.status === 'in-progress'
            ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-900/20 dark:to-cyan-900/20'
            : 'bg-gradient-to-r from-gray-500/10 to-slate-500/10 dark:from-gray-900/20 dark:to-slate-900/20'
        }`}>
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={statusColors[project.status]}>
                    {t(`status.${project.status === 'in-progress' ? 'inProgress' : project.status}`)}
                  </Badge>
                  <Badge variant="outline" className={priorityColors[project.priority]}>
                    {t(`priority.${project.priority}`)}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-bold">{project.title}</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <Button variant="outline" size="sm" onClick={onEdit} className="mt-4">
            <Edit3 className="h-4 w-4 mr-1" />
            {t('editProject')}
          </Button>
        </div>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 pt-0 space-y-6">
            {/* Description */}
            {project.description && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">{project.description}</p>
              </div>
            )}

            {/* Project Details */}
            <div className="grid grid-cols-2 gap-4">
              {getUserName(project.assignedUserId) && (
                <Card className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: getUserColor(project.assignedUserId) || '#9ca3af' }}
                    >
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('form.assignedTo')}</p>
                      <p className="font-medium">{getUserName(project.assignedUserId)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {project.estimatedCost !== undefined && project.estimatedCost > 0 && (
                <Card className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('form.estimatedCost')}</p>
                      <p className="font-medium">${project.estimatedCost.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('detail.createdAt')}</p>
                    <p className="font-medium">{formatDate(project.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('detail.linkedTasks')}</p>
                    <p className="font-medium">
                      {completedTasks.length}/{linkedTasks.length} {t('detail.completed')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Linked Tasks Section */}
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                {t('detail.linkedTasks')}
                {linkedTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {linkedTasks.length}
                  </Badge>
                )}
              </h3>

              {linkedTasks.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">{t('detail.noLinkedTasks')}</p>
                    <p className="text-sm mt-1">{t('detail.noLinkedTasksHint')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Pending Tasks */}
                  {pendingTasks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                        <Circle className="h-4 w-4" />
                        {t('detail.pendingTasks')} ({pendingTasks.length})
                      </h4>
                      <div className="space-y-2">
                        {pendingTasks.map(task => (
                          <TaskItem key={task.id} task={task} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed Tasks */}
                  {completedTasks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {t('detail.completedTasks')} ({completedTasks.length})
                      </h4>
                      <div className="space-y-2">
                        {completedTasks.map(task => (
                          <TaskItem key={task.id} task={task} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
