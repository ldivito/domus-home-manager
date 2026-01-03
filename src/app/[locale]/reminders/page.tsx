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
  type: 'chore' | 'task' | 'document' | 'maintenance' | 'payment' | 'pet'
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

  // Additional data sources for notifications
  const documents = useLiveQuery(
    () => db.documents.toArray(),
    []
  )

  const maintenanceTasks = useLiveQuery(
    () => db.maintenanceTasks.toArray(),
    []
  )

  const expensePayments = useLiveQuery(
    () => db.expensePayments.toArray(),
    []
  )

  const recurringExpenses = useLiveQuery(
    () => db.recurringExpenses.toArray(),
    []
  )

  const petVaccinations = useLiveQuery(
    () => db.petVaccinations.toArray(),
    []
  )

  const pets = useLiveQuery(
    () => db.pets.toArray(),
    []
  )

  const typeColors: Record<string, string> = {
    chore: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    task: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    document: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
    maintenance: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    payment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    pet: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  }

  const priorityIcons = {
    high: AlertTriangle,
    medium: Clock,
    low: Bell
  }

  // Generate notifications from all sources
  useEffect(() => {
    if (!chores || !tasks) {
      setNotifications([])
      return
    }

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
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

    // Generate document expiration notifications
    if (documents) {
      documents.forEach(doc => {
        if (doc.expirationDate && doc.reminderEnabled) {
          const expirationDate = new Date(doc.expirationDate)
          const reminderDays = doc.reminderDaysBefore || 7
          const reminderDate = new Date(expirationDate.getTime() - reminderDays * 24 * 60 * 60 * 1000)

          // Document expired
          if (expirationDate <= now) {
            generated.push({
              id: `doc-expired-${doc.id}`,
              title: t('documentExpired', { name: doc.name }),
              description: t('documentExpiredDescription'),
              type: 'document',
              priority: 'high',
              triggerTime: expirationDate,
              sourceId: doc.id!,
              sourcePage: '/documents',
              isRead: false
            })
          }
          // Document expiring soon
          else if (reminderDate <= now && expirationDate > now) {
            generated.push({
              id: `doc-expiring-${doc.id}`,
              title: t('documentExpiring', { name: doc.name }),
              description: t('documentExpiringDescription', { days: reminderDays }),
              type: 'document',
              priority: 'medium',
              triggerTime: reminderDate,
              sourceId: doc.id!,
              sourcePage: '/documents',
              isRead: false
            })
          }
        }
      })
    }

    // Generate maintenance task notifications
    if (maintenanceTasks) {
      maintenanceTasks.forEach(task => {
        if (task.nextDue) {
          const nextDue = new Date(task.nextDue)
          const dayBefore = new Date(nextDue.getTime() - 24 * 60 * 60 * 1000)

          // Maintenance overdue
          if (nextDue <= now) {
            generated.push({
              id: `maintenance-due-${task.id}`,
              title: t('maintenanceDue', { name: task.name }),
              description: t('maintenanceDueDescription'),
              type: 'maintenance',
              priority: task.priority === 'high' ? 'high' : 'medium',
              triggerTime: nextDue,
              sourceId: task.id!,
              sourcePage: '/maintenance',
              isRead: false
            })
          }
          // Maintenance due tomorrow
          else if (dayBefore.toDateString() === now.toDateString()) {
            generated.push({
              id: `maintenance-soon-${task.id}`,
              title: t('maintenanceSoon', { name: task.name }),
              description: t('maintenanceSoonDescription'),
              type: 'maintenance',
              priority: 'low',
              triggerTime: dayBefore,
              sourceId: task.id!,
              sourcePage: '/maintenance',
              isRead: false
            })
          }
        }
      })
    }

    // Generate expense payment notifications
    if (expensePayments && recurringExpenses) {
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()

      expensePayments.forEach(payment => {
        const dueDate = new Date(payment.dueDate)
        const paymentMonth = dueDate.getMonth() + 1
        const paymentYear = dueDate.getFullYear()

        // Only check current month payments
        if (paymentMonth === currentMonth && paymentYear === currentYear) {
          const expense = recurringExpenses.find(e => e.id === payment.recurringExpenseId)
          const expenseName = expense?.name || 'Payment'

          // Payment overdue
          if (payment.status === 'overdue' || (payment.status === 'pending' && dueDate < now)) {
            generated.push({
              id: `payment-overdue-${payment.id}`,
              title: t('paymentOverdue', { name: expenseName }),
              description: t('paymentOverdueDescription'),
              type: 'payment',
              priority: 'high',
              triggerTime: dueDate,
              sourceId: payment.id!,
              sourcePage: '/finance',
              isRead: false
            })
          }
          // Payment due today
          else if (payment.status === 'pending' && dueDate.toDateString() === now.toDateString()) {
            generated.push({
              id: `payment-due-${payment.id}`,
              title: t('paymentDue', { name: expenseName }),
              description: t('paymentDueDescription'),
              type: 'payment',
              priority: 'medium',
              triggerTime: dueDate,
              sourceId: payment.id!,
              sourcePage: '/finance',
              isRead: false
            })
          }
        }
      })
    }

    // Generate pet vaccination notifications
    if (petVaccinations && pets) {
      petVaccinations.forEach(vaccination => {
        if (vaccination.nextDueDate) {
          const nextDueDate = new Date(vaccination.nextDueDate)
          const weekBefore = new Date(nextDueDate.getTime() - 7 * 24 * 60 * 60 * 1000)
          const pet = pets.find(p => p.id === vaccination.petId)
          const petName = pet?.name || 'Pet'

          // Vaccination overdue
          if (nextDueDate <= now) {
            generated.push({
              id: `vaccine-overdue-${vaccination.id}`,
              title: t('vaccineOverdue', { pet: petName, vaccine: vaccination.vaccineName }),
              description: t('vaccineOverdueDescription'),
              type: 'pet',
              priority: 'high',
              triggerTime: nextDueDate,
              sourceId: vaccination.id!,
              sourcePage: '/pets',
              isRead: false
            })
          }
          // Vaccination due soon (within a week)
          else if (weekBefore <= now && nextDueDate > now) {
            generated.push({
              id: `vaccine-soon-${vaccination.id}`,
              title: t('vaccineSoon', { pet: petName, vaccine: vaccination.vaccineName }),
              description: t('vaccineSoonDescription'),
              type: 'pet',
              priority: 'medium',
              triggerTime: weekBefore,
              sourceId: vaccination.id!,
              sourcePage: '/pets',
              isRead: false
            })
          }
        }
      })
    }

    // Sort by priority and time
    generated.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      return b.triggerTime.getTime() - a.triggerTime.getTime()
    })

    setNotifications(generated)
  }, [chores, tasks, documents, maintenanceTasks, expensePayments, recurringExpenses, petVaccinations, pets, t])

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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm sm:text-base lg:text-xl text-gray-600 dark:text-gray-400 mt-1">{t('subtitle')}</p>
          </div>
          {notifications.length > 0 && (
            <Button
              size="default"
              className="h-10 sm:h-12 lg:h-14 px-4 sm:px-6 lg:px-8 text-sm sm:text-base lg:text-lg w-full sm:w-auto"
              variant="outline"
              onClick={handleClearAll}
            >
              <Trash2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
              {t('clearAll')}
            </Button>
          )}
        </div>

        {/* Urgent Notifications */}
        {urgentNotifications.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-red-600 dark:text-red-400 mb-3 sm:mb-4 flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              {t('urgent')} ({urgentNotifications.length})
            </h2>
            <div className="grid gap-3 sm:gap-4">
              {urgentNotifications.map((notification) => {
                const PriorityIcon = priorityIcons[notification.priority]
                return (
                  <Card key={notification.id} className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors">
                    <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0" onClick={() => handleNotificationClick(notification)}>
                          <CardTitle className="text-base sm:text-lg lg:text-xl text-red-800 dark:text-red-200 flex items-start sm:items-center gap-2">
                            <PriorityIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 sm:mt-0" />
                            <span className="break-words">{notification.title}</span>
                          </CardTitle>
                          <CardDescription className="text-sm sm:text-base text-red-700 dark:text-red-300 mt-1">
                            {notification.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
                          <Badge className={`${typeColors[notification.type]} text-xs sm:text-sm`}>
                            {t(`type.${notification.type}`)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 sm:h-9 sm:w-9 p-0"
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
                    <CardContent className="px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6 pt-0">
                      <div className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                        {new Date(notification.triggerTime).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Regular Notifications */}
        {regularNotifications.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-3 sm:mb-4 flex items-center">
              <Bell className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              {t('regular')} ({regularNotifications.length})
            </h2>
            <div className="grid gap-3 sm:gap-4">
              {regularNotifications.map((notification) => {
                const PriorityIcon = priorityIcons[notification.priority]
                return (
                  <Card key={notification.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0" onClick={() => handleNotificationClick(notification)}>
                          <CardTitle className="text-base sm:text-lg lg:text-xl flex items-start sm:items-center gap-2">
                            <PriorityIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 sm:mt-0" />
                            <span className="break-words">{notification.title}</span>
                          </CardTitle>
                          <CardDescription className="text-sm sm:text-base mt-1">
                            {notification.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
                          <Badge className={`${typeColors[notification.type]} text-xs sm:text-sm`}>
                            {t(`type.${notification.type}`)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 sm:h-9 sm:w-9 p-0"
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
                    <CardContent className="px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6 pt-0">
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {new Date(notification.triggerTime).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {notifications.length === 0 && (
          <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
            <CardContent className="flex items-center justify-center h-48 sm:h-56 lg:h-64 text-gray-500 dark:text-gray-400">
              <div className="text-center px-4">
                <Bell className="mx-auto h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4" />
                <p className="text-base sm:text-lg lg:text-xl mb-1 sm:mb-2">{t('noNotifications')}</p>
                <p className="text-sm sm:text-base">{t('noNotificationsDescription')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {notifications.length > 0 && (
          <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 sm:mb-4">{t('summary.title')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
              <div className="p-2 sm:p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{urgentNotifications.length}</p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('summary.urgent')}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{regularNotifications.length}</p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('summary.regular')}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {notifications.filter(n => n.type === 'chore').length}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('summary.chores')}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {notifications.filter(n => n.type === 'task').length}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('summary.tasks')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}