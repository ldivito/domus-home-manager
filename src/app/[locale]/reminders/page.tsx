'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Trash2, Clock, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  title: string
  description: string
  type: 'chore' | 'task'
  priority: 'high' | 'medium' | 'low'
  triggerTime: Date
  sourceId: string
  sourcePage: string
  isRead: boolean
}

export default function NotificationsPage() {
  const t = useTranslations('notifications')
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  const chores = useLiveQuery(
    () => db.chores.orderBy('nextDue').toArray(),
    []
  )
  
  const tasks = useLiveQuery(
    () => db.tasks.where('isCompleted').equals(0).toArray(),
    []
  )
  

  const typeColors = {
    chore: 'bg-blue-100 text-blue-800',
    task: 'bg-green-100 text-green-800'
  }

  const priorityIcons = {
    high: AlertTriangle,
    medium: Clock,
    low: Bell
  }

  // Generate notifications from chores and tasks
  useEffect(() => {
    if (!chores || !tasks) {
      setNotifications([])
      return
    }
    
    const now = new Date()
    const generated: Notification[] = []

    // Generate chore notifications
    chores.forEach(chore => {
      if (!chore.isCompleted && chore.nextDue) {
        const nextDue = new Date(chore.nextDue)
        const oneHourBefore = new Date(nextDue.getTime() - 60 * 60 * 1000)
        
        // Due time notification
        if (nextDue <= now) {
          generated.push({
            id: `chore-due-${chore.id}`,
            title: t('choreDue', { title: chore.title }),
            description: t('choreDueDescription'),
            type: 'chore',
            priority: 'high',
            triggerTime: nextDue,
            sourceId: chore.id!,
            sourcePage: '/chores',
            isRead: false
          })
        }
        
        // One hour before notification
        else if (oneHourBefore <= now && nextDue > now) {
          generated.push({
            id: `chore-soon-${chore.id}`,
            title: t('choreSoon', { title: chore.title }),
            description: t('choreSoonDescription'),
            type: 'chore',
            priority: 'medium',
            triggerTime: oneHourBefore,
            sourceId: chore.id!,
            sourcePage: '/chores',
            isRead: false
          })
        }
      }
    })

    // Generate task notifications - sort tasks by due date first
    const sortedTasks = [...tasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    
    sortedTasks.forEach(task => {
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate)
        const dayBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000)
        
        // Due day notification
        if (dueDate.toDateString() === now.toDateString()) {
          generated.push({
            id: `task-due-${task.id}`,
            title: t('taskDue', { title: task.title }),
            description: t('taskDueDescription'),
            type: 'task',
            priority: task.priority === 'high' ? 'high' : 'medium',
            triggerTime: dueDate,
            sourceId: task.id!,
            sourcePage: '/tasks',
            isRead: false
          })
        }
        
        // Day before notification
        else if (dayBefore.toDateString() === now.toDateString()) {
          generated.push({
            id: `task-tomorrow-${task.id}`,
            title: t('taskTomorrow', { title: task.title }),
            description: t('taskTomorrowDescription'),
            type: 'task',
            priority: 'low',
            triggerTime: dayBefore,
            sourceId: task.id!,
            sourcePage: '/tasks',
            isRead: false
          })
        }
      }
    })

    // Sort by priority and time
    generated.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      return b.triggerTime.getTime() - a.triggerTime.getTime()
    })

    setNotifications(generated)
  }, [chores, tasks, t])

  const handleNotificationClick = (notification: Notification) => {
    router.push(notification.sourcePage)
  }

  const handleDeleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const handleClearAll = () => {
    setNotifications([])
  }

  const urgentNotifications = notifications.filter(n => n.priority === 'high')
  const regularNotifications = notifications.filter(n => n.priority !== 'high')

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('title')}</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          {notifications.length > 0 && (
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg"
              variant="outline"
              onClick={handleClearAll}
            >
              <Trash2 className="mr-2 h-6 w-6" />
              {t('clearAll')}
            </Button>
          )}
        </div>
        
        {urgentNotifications.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-red-600 mb-4 flex items-center">
              <AlertTriangle className="mr-2 h-6 w-6" />
              {t('urgent')} ({urgentNotifications.length})
            </h2>
            <div className="grid gap-4">
              {urgentNotifications.map((notification) => {
                const PriorityIcon = priorityIcons[notification.priority]
                return (
                  <Card key={notification.id} className="border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1" onClick={() => handleNotificationClick(notification)}>
                          <CardTitle className="text-xl text-red-800 flex items-center">
                            <PriorityIcon className="mr-2 h-5 w-5" />
                            {notification.title}
                          </CardTitle>
                          <CardDescription className="text-base text-red-700 mt-1">
                            {notification.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={typeColors[notification.type]}>
                            {t(`type.${notification.type}`)}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteNotification(notification.id)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-red-600">
                        {new Date(notification.triggerTime).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
        
        {regularNotifications.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <Bell className="mr-2 h-6 w-6" />
              {t('regular')} ({regularNotifications.length})
            </h2>
            <div className="grid gap-4">
              {regularNotifications.map((notification) => {
                const PriorityIcon = priorityIcons[notification.priority]
                return (
                  <Card key={notification.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1" onClick={() => handleNotificationClick(notification)}>
                          <CardTitle className="text-xl flex items-center">
                            <PriorityIcon className="mr-2 h-5 w-5" />
                            {notification.title}
                          </CardTitle>
                          <CardDescription className="text-base mt-1">
                            {notification.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={typeColors[notification.type]}>
                            {t(`type.${notification.type}`)}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteNotification(notification.id)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-600">
                        {new Date(notification.triggerTime).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
        
        {notifications.length === 0 && (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Bell className="mx-auto h-12 w-12 mb-4" />
                <p className="text-xl mb-2">{t('noNotifications')}</p>
                <p className="text-base">{t('noNotificationsDescription')}</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {notifications.length > 0 && (
          <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('summary.title')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-red-600">{urgentNotifications.length}</p>
                <p className="text-sm text-gray-500">{t('summary.urgent')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{regularNotifications.length}</p>
                <p className="text-sm text-gray-500">{t('summary.regular')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {notifications.filter(n => n.type === 'chore').length}
                </p>
                <p className="text-sm text-gray-500">{t('summary.chores')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {notifications.filter(n => n.type === 'task').length}
                </p>
                <p className="text-sm text-gray-500">{t('summary.tasks')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}