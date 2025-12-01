'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  CheckSquare,
  ShoppingCart,
  List,
  Hammer,
  UtensilsCrossed,
  Users,
  Check,
  Calendar,
  Bell,
  ExternalLink,
  Clock,
  AlertCircle,
  DollarSign,
  Flame,
  FileText,
  Wrench,
  CreditCard
} from "lucide-react"
import Link from 'next/link'
import { db, Chore, Task, Meal, CalendarEvent } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { CompleteChoreModal } from '@/components/CompleteChoreModal'

export default function HomePage() {
  const t = useTranslations('home')
  const mealsT = useTranslations('meals')
  const tasksT = useTranslations('tasks')
  const commonT = useTranslations('common')
  const ketoT = useTranslations('keto')

  // State for chore completion modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null)

  // Auto-reset completed chores that are now due
  const resetOverdueChores = async () => {
    try {
      const chores = await db.chores.toArray()
      const overdueCompleted = chores.filter(c => 
        c.isCompleted && c.nextDue && new Date(c.nextDue) <= new Date()
      )
      
      for (const chore of overdueCompleted) {
        if (chore.id) {
          await db.chores.update(chore.id, {
            isCompleted: false,
            completedAt: undefined,
            lastCompletedBy: undefined
          })
        }
      }
    } catch (error) {
      console.error('Error resetting overdue chores:', error)
    }
  }

  // Run reset check on component mount and periodically
  useLiveQuery(async () => {
    await resetOverdueChores()
    return db.chores.toArray() // Return something to trigger reactivity
  }, [])

  // Chore completion handlers
  const handleCompleteChore = (chore: Chore) => {
    setSelectedChore(chore)
    setIsCompleteModalOpen(true)
  }

  const handleConfirmComplete = async (completedByUserId: string) => {
    if (!selectedChore?.id) return
    
    try {
      // Calculate next due date based on frequency
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
            nextDue = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Default to tomorrow
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
        isCompleted: true
      })
      
    } catch (error) {
      console.error('Error completing chore:', error)
      throw error
    }
  }

  // Live data queries
  const users = useLiveQuery(() => db.users.toArray(), []) || []
  
  const chores = useLiveQuery(() => db.chores.toArray(), []) || []
  const pendingChores = chores.filter(c => !c.isCompleted)
  const overdueChores = pendingChores.filter(c => c.nextDue && new Date(c.nextDue) < new Date())
  
  const groceryItems = useLiveQuery(() => db.groceryItems.toArray(), []) || []
  
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) || []
  const pendingTasks = tasks.filter(t => !t.isCompleted)
  const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high')
  
  const projects = useLiveQuery(() => db.homeImprovements.toArray(), []) || []
  const activeProjects = projects.filter(p => p.status === 'in-progress')
  
  const meals = useLiveQuery(() => db.meals.toArray(), []) || []
  const todaysMeals = meals.filter(meal => {
    const today = new Date()
    const mealDate = new Date(meal.date)
    return mealDate.toDateString() === today.toDateString()
  })
  
  // Today's tasks and chores
  const todaysTasks = (useLiveQuery(() => db.tasks.toArray(), []) || [])
    .filter(task => !!task.dueDate && !task.isCompleted)
    .filter(task => new Date(task.dueDate!).toDateString() === new Date().toDateString())
  const todaysChores = chores
    .filter(c => !!c.nextDue && !c.isCompleted)
    .filter(c => new Date(c.nextDue!).toDateString() === new Date().toDateString())

  const calendarEvents = useLiveQuery(() => db.calendarEvents.toArray(), []) || []
  const todaysEvents = calendarEvents.filter(event => {
    const today = new Date()
    const eventDate = new Date(event.date)
    return eventDate.toDateString() === today.toDateString()
  })

  // Upcoming mixed items type and helpers
  type UpcomingItem =
    | ({ kind: 'event' } & CalendarEvent)
    | ({ kind: 'meal' } & Meal)
    | ({ kind: 'task' } & Task)
    | ({ kind: 'chore' } & Chore)

  const getUpcomingDate = (item: UpcomingItem): Date => {
    switch (item.kind) {
      case 'event':
        return new Date(item.date)
      case 'meal':
        return new Date(item.date)
      case 'task':
        return new Date(item.dueDate!)
      case 'chore':
        return new Date(item.nextDue!)
    }
  }

  // Get next 4 upcoming items across events, meals, tasks, and chores when today is empty
  const nextUpcomingItems = useLiveQuery<UpcomingItem[]>(() => {
    const now = new Date()
    return Promise.all([
      db.calendarEvents.toArray(),
      db.meals.toArray(),
      db.tasks.toArray(),
      db.chores.toArray()
    ]).then(([events, mealsList, tasksList, choresList]) => {
      const upcomingEvents: UpcomingItem[] = events
        .filter(e => new Date(e.date) > now)
        .map(e => ({ kind: 'event', ...e }))
      const upcomingMeals: UpcomingItem[] = mealsList
        .filter(m => new Date(m.date) > now)
        .map(m => ({ kind: 'meal', ...m }))
      const upcomingTasks: UpcomingItem[] = tasksList
        .filter(t => !!t.dueDate && !t.isCompleted && new Date(t.dueDate!) > now)
        .map(t => ({ kind: 'task', ...t }))
      const upcomingChores: UpcomingItem[] = choresList
        .filter(c => !!c.nextDue && !c.isCompleted && new Date(c.nextDue!) > now)
        .map(c => ({ kind: 'chore', ...c }))
      return [...upcomingEvents, ...upcomingMeals, ...upcomingTasks, ...upcomingChores]
        .sort((a, b) => getUpcomingDate(a).getTime() - getUpcomingDate(b).getTime())
        .slice(0, 4)
    })
  }, []) || []

  const reminders = useLiveQuery(() => db.reminders.toArray(), []) || []
  const activeReminders = reminders.filter(r => !r.isCompleted)
  const upcomingReminders = activeReminders.filter(r => new Date(r.reminderTime) >= new Date())

  // Finance data queries
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const monthlyIncomes = useLiveQuery(
    () => db.monthlyIncomes.filter(i => i.month === currentMonth && i.year === currentYear).toArray(),
    [currentMonth, currentYear]
  ) || []

  const exchangeRate = useLiveQuery(
    () => db.monthlyExchangeRates.filter(r => r.month === currentMonth && r.year === currentYear).first(),
    [currentMonth, currentYear]
  )

  const recurringExpenses = useLiveQuery(() => db.recurringExpenses.filter(e => e.isActive).toArray(), []) || []

  const expensePayments = useLiveQuery(
    () => db.expensePayments.filter(p => {
      const dueDate = new Date(p.dueDate)
      return dueDate.getMonth() + 1 === currentMonth && dueDate.getFullYear() === currentYear
    }).toArray(),
    [currentMonth, currentYear]
  ) || []

  // Calculate finance totals
  const totalIncome = monthlyIncomes.reduce((sum, inc) => {
    if (inc.currency === 'USD' && exchangeRate?.rate) {
      return sum + (inc.amount * exchangeRate.rate)
    }
    return sum + inc.amount
  }, 0)

  const totalExpenses = recurringExpenses.reduce((sum, exp) => {
    if (exp.currency === 'USD' && exchangeRate?.rate) {
      return sum + (exp.amount * exchangeRate.rate)
    }
    return sum + exp.amount
  }, 0)

  const pendingPayments = expensePayments.filter(p => p.status === 'pending')
  const overduePayments = expensePayments.filter(p => p.status === 'overdue')
  const netBalance = totalIncome - totalExpenses

  // Keto data queries
  const ketoSettings = useLiveQuery(() => db.ketoSettings.toArray(), [])
  const ketoDays = useLiveQuery(() => db.ketoDays.toArray(), []) || []

  // Calculate keto stats
  const ketoSuccessfulDays = ketoDays.filter(d => d.status === 'success' || d.status === 'fasting')
  const ketoCheatDays = ketoDays.filter(d => d.status === 'cheat')

  // Calculate current streak
  const calculateKetoStreak = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let streak = 0
    let daysBack = 0

    while (true) {
      const checkDate = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000)
      const dayEntry = ketoDays.find(d => {
        const entryDate = new Date(d.date)
        entryDate.setHours(0, 0, 0, 0)
        return entryDate.getTime() === checkDate.getTime()
      })

      if (dayEntry && (dayEntry.status === 'success' || dayEntry.status === 'fasting')) {
        streak++
        daysBack++
      } else {
        break
      }
    }
    return streak
  }

  const ketoStreak = calculateKetoStreak()

  // Weekly success rate for keto
  const calculateWeeklySuccessRate = () => {
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekDays = ketoDays.filter(d => {
      const date = new Date(d.date)
      return date >= weekAgo && date <= today
    })
    const successDays = weekDays.filter(d => d.status === 'success' || d.status === 'fasting')
    return weekDays.length > 0 ? Math.round((successDays.length / 7) * 100) : 0
  }

  const ketoWeeklyRate = calculateWeeklySuccessRate()

  // Documents data queries
  const documents = useLiveQuery(() => db.documents.toArray(), []) || []

  const expiringDocuments = documents.filter(doc => {
    if (!doc.expirationDate) return false
    const daysUntil = Math.ceil((new Date(doc.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 30 && daysUntil > 0
  })

  const expiredDocuments = documents.filter(doc => {
    if (!doc.expirationDate) return false
    return new Date(doc.expirationDate) < new Date()
  })

  // Maintenance data queries
  const maintenanceItems = useLiveQuery(() => db.maintenanceItems.toArray(), []) || []
  const maintenanceTasks = useLiveQuery(() => db.maintenanceTasks.toArray(), []) || []

  const overdueMaintenanceTasks = maintenanceTasks.filter(task => {
    return new Date(task.nextDue) < new Date()
  })

  const upcomingMaintenanceTasks = maintenanceTasks.filter(task => {
    const daysUntil = Math.ceil((new Date(task.nextDue).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 7 && daysUntil > 0
  })

  // Subscriptions data queries
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray(), []) || []
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active' || s.status === 'trial')

  const subscriptionsDueThisWeek = activeSubscriptions.filter(sub => {
    const daysUntil = Math.ceil((new Date(sub.nextBillingDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 7 && daysUntil >= 0
  })

  const monthlySubscriptionTotal = activeSubscriptions.reduce((sum, sub) => {
    let monthlyAmount = sub.amount
    // Convert to monthly equivalent
    switch (sub.billingCycle) {
      case 'weekly': monthlyAmount *= 4; break
      case 'quarterly': monthlyAmount /= 3; break
      case 'biannually': monthlyAmount /= 6; break
      case 'yearly': monthlyAmount /= 12; break
    }
    // Convert USD to ARS if exchange rate available
    if (sub.currency === 'USD' && exchangeRate?.rate) {
      monthlyAmount *= exchangeRate.rate
    }
    return sum + monthlyAmount
  }, 0)

  // Get next 4-5 chores for display
  const nextChores = useLiveQuery(
    () => db.chores.toArray().then(chores => 
      chores
        .filter(c => c.nextDue)
        .filter(c => !c.isCompleted || (c.isCompleted && new Date(c.nextDue) <= new Date()))
        .sort((a, b) => new Date(a.nextDue!).getTime() - new Date(b.nextDue!).getTime())
        .slice(0, 4)
    ),
    []
  ) || []

  const formatCompactDate = (date: Date) => {
    return new Intl.DateTimeFormat('default', {
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  const formatUpcomingDate = (date: Date) => {
    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
    
    if (date.toDateString() === tomorrow.toDateString()) {
      return t('widgets.schedule.tomorrow')
    } else if (date.toDateString() === dayAfterTomorrow.toDateString()) {
      return t('widgets.schedule.dayAfterTomorrow')
    } else {
      return new Intl.DateTimeFormat('default', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(date)
    }
  }

  return (
    <>
      <div className="h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <div className="h-full max-h-[100vh] overflow-y-auto mx-auto p-2 flex flex-col gap-2">
          
          {/* Enhanced Top Stats Bar - Tablet Optimized */}
          <Card className="glass-card shadow-modern-lg border-border/30">
            <CardContent className="">
              <div className="grid grid-cols-6 gap-2">
                <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/40 transition-all hover:shadow-md">
                  <div className="p-3 bg-blue-500/15 rounded-xl border border-blue-200/50">
                    <CheckSquare className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pendingChores.length}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{t('widgets.stats.chores')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/40 transition-all hover:shadow-md">
                  <div className="p-3 bg-green-500/15 rounded-xl border border-green-200/50">
                    <ShoppingCart className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{groceryItems.length}</p>
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">{t('widgets.grocery.title')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 transition-all hover:shadow-md">
                  <div className="p-3 bg-orange-500/15 rounded-xl border border-orange-200/50">
                    <UtensilsCrossed className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{todaysMeals.length}</p>
                    <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">{t('widgets.meals.title')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 transition-all hover:shadow-md">
                  <div className="p-3 bg-yellow-500/15 rounded-xl border border-yellow-200/50">
                    <List className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{pendingTasks.length}</p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">{t('widgets.tasks.title')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 transition-all hover:shadow-md">
                  <div className="p-3 bg-red-500/15 rounded-xl border border-red-200/50">
                    <Hammer className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">{activeProjects.length}</p>
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">{t('widgets.projects.title')}</p>
                  </div>
                </div>

                <Link href="/users" className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/40 transition-all hover:shadow-md group touch-target">
                  <div className="p-3 bg-indigo-500/15 rounded-xl border border-indigo-200/50">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex -space-x-2 mb-2">
                      {users.slice(0, 3).map((user) => (
                        <Avatar key={user.id} className={`h-7 w-7 ${user.color} border-2 border-background shadow-sm`}>
                          <AvatarFallback className="text-white text-sm font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {users.length > 3 && (
                        <div className="h-7 w-7 bg-muted border-2 border-background rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-xs font-medium">+{users.length - 3}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium truncate">
                      {users.slice(0, 2).map(u => u.name).join(', ')}
                      {users.length > 2 && ` +${users.length - 2}`}
                    </p>
                  </div>
                  <ExternalLink className="h-5 w-5 text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Grid - Enhanced for Tablet */}
          <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
            
            {/* Next Chores - Enhanced */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-4 flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-blue-500/15 rounded-xl border border-blue-200/50">
                      <CheckSquare className="h-6 w-6 text-blue-600" />
                    </div>
                    {t('widgets.chores.title')}
                  </CardTitle>
                  <Link href="/chores">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {nextChores.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {nextChores.map((chore) => (
                        <div key={chore.id} className="flex items-center gap-3 p-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/40 rounded-lg border border-blue-200/50 transition-all hover:shadow-md">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100 truncate">{chore.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-blue-500" />
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                {chore.nextDue ? formatCompactDate(new Date(chore.nextDue)) : t('widgets.chores.none')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {chore.assignedUserId && (
                              <Avatar className={`h-5 w-5 ${users.find(u => u.id === chore.assignedUserId)?.color || 'bg-gray-500'} border border-background`}>
                                <AvatarFallback className="text-white text-xs font-bold">
                                  {users.find(u => u.id === chore.assignedUserId)?.name?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCompleteChore(chore)}
                              className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600 transition-colors"
                            >
                              <CheckSquare className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {pendingChores.length > 4 && (
                      <div className="text-center pt-2">
                        <p className="text-xs text-muted-foreground font-medium">
                          +{pendingChores.length - 4} {t('widgets.chores.moreChores')}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckSquare className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">{t('widgets.chores.none')}</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">{t('widgets.chores.completed')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shopping List - Enhanced */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-4 flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-green-500/15 rounded-xl border border-green-200/50">
                      <ShoppingCart className="h-6 w-6 text-green-600" />
                    </div>
                    {t('widgets.grocery.title')}
                  </CardTitle>
                  <Link href="/grocery">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {groceryItems.length > 0 ? (
                  <>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {groceryItems.slice(0, 6).map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/40 rounded-xl border border-green-200/50 transition-all hover:shadow-md">
                          <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                            item.importance === 'high' ? 'bg-red-500' : 
                            item.importance === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-base font-semibold text-green-900 dark:text-green-100 truncate block">{item.name}</span>
                            <p className="text-sm text-green-700 dark:text-green-300">{item.amount}</p>
                          </div>
                          <Badge className={`text-sm px-3 py-1 font-medium ${
                            item.importance === 'high' ? 'bg-red-100 text-red-700 border-red-200' : 
                            item.importance === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200'
                          }`}>
                            {item.importance}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {groceryItems.length > 6 && (
                      <div className="text-center pt-3">
                        <p className="text-sm text-muted-foreground font-medium">+{groceryItems.length - 6} {t('widgets.grocery.moreItems')}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="h-8 w-8 text-green-500" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">{t('widgets.grocery.empty')}</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">{t('widgets.grocery.addFirst')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Schedule - Enhanced */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-4 flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-purple-500/15 rounded-xl border border-purple-200/50">
                      <Calendar className="h-6 w-6 text-purple-600" />
                    </div>
                    {t('widgets.schedule.title')}
                  </CardTitle>
                  <Link href="/planner">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {(todaysEvents.length > 0 || todaysMeals.length > 0 || todaysTasks.length > 0 || todaysChores.length > 0) ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {/* Today's Events */}
                    {todaysEvents.map((event) => (
                      <div key={event.id} className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/40 rounded-xl border border-purple-200/50 transition-all hover:shadow-md">
                        <h4 className="font-semibold text-base mb-2 text-purple-900 dark:text-purple-100">{event.title}</h4>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                              {event.time || t('widgets.schedule.allDay')}
                            </span>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-sm px-3 py-1">
                            {event.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {/* Today's Meals */}
                    {todaysMeals.map((meal) => (
                      <div key={meal.id} className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 rounded-xl border border-orange-200/50 transition-all hover:shadow-md">
                        <h4 className="font-semibold text-base mb-2 text-orange-900 dark:text-orange-100">{meal.title}</h4>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-medium text-orange-700 dark:text-orange-300 capitalize">
                              {mealsT(`mealTypes.${meal.mealType}`)}
                            </span>
                          </div>
                          {meal.assignedUserId && (
                            <div className="flex items-center gap-2">
                              <Avatar className={`h-6 w-6 ${users.find(u => u.id === meal.assignedUserId)?.color || 'bg-gray-500'} border border-background`}>
                                <AvatarFallback className="text-white text-xs font-bold">
                                  {users.find(u => u.id === meal.assignedUserId)?.name?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                {users.find(u => u.id === meal.assignedUserId)?.name || commonT('notAssigned')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Today's Tasks */}
                    {todaysTasks.map((task) => (
                      <div key={task.id} className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 rounded-xl border border-yellow-200/50 transition-all hover:shadow-md">
                        <h4 className="font-semibold text-base mb-2 text-yellow-900 dark:text-yellow-100">{task.title}</h4>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <List className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                              {tasksT(`priority.${task.priority}`)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Today's Chores */}
                    {todaysChores.map((chore) => (
                      <div key={chore.id} className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/40 rounded-xl border border-blue-200/50 transition-all hover:shadow-md">
                        <h4 className="font-semibold text-base mb-2 text-blue-900 dark:text-blue-100">{chore.title}</h4>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              {formatCompactDate(new Date(chore.nextDue!))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : nextUpcomingItems.length > 0 ? (
                  <div className="space-y-2">
                    
                    {/* Upcoming mixed items (next 4) */}
                    {nextUpcomingItems.map((item) => (
                      <div key={`${item.kind}-${item.id}`} className={`flex items-center gap-3 p-2 rounded-lg border transition-all hover:shadow-md ${
                        item.kind === 'event' ? 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/40 border-purple-200/50' :
                        item.kind === 'meal' ? 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 border-orange-200/50' :
                        item.kind === 'task' ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 border-yellow-200/50' :
                        'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/40 border-blue-200/50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-sm truncate ${
                            item.kind === 'event' ? 'text-purple-900 dark:text-purple-100' :
                            item.kind === 'meal' ? 'text-orange-900 dark:text-orange-100' :
                            item.kind === 'task' ? 'text-yellow-900 dark:text-yellow-100' :
                            'text-blue-900 dark:text-blue-100'
                          }`}>
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            {item.kind === 'event' && <Clock className="h-3 w-3 text-purple-500" />}
                            {item.kind === 'meal' && <UtensilsCrossed className="h-3 w-3 text-orange-500" />}
                            {item.kind === 'task' && <List className="h-3 w-3 text-yellow-500" />}
                            {item.kind === 'chore' && <CheckSquare className="h-3 w-3 text-blue-500" />}
                            <span className={`text-xs font-medium ${
                              item.kind === 'event' ? 'text-purple-700 dark:text-purple-300' :
                              item.kind === 'meal' ? 'text-orange-700 dark:text-orange-300' :
                              item.kind === 'task' ? 'text-yellow-700 dark:text-yellow-300' :
                              'text-blue-700 dark:text-blue-300'
                            }`}>
                              {formatUpcomingDate(new Date(
                                item.kind === 'event' || item.kind === 'meal'
                                  ? item.date
                                  : item.kind === 'task'
                                  ? (item.dueDate as Date)
                                  : (item.nextDue as Date)
                              ))}
                              {item.kind === 'event' && item.time && ` • ${item.time}`}
                              {item.kind === 'meal' && ` • ${mealsT(`mealTypes.${item.mealType}`)}`}
                              {item.kind === 'task' && ` • ${tasksT(`priority.${item.priority}`)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-8 w-8 text-purple-500" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">{t('widgets.schedule.none')}</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">{t('widgets.schedule.free')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications & Reminders - Enhanced */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-6 flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-amber-500/15 rounded-xl border border-amber-200/50">
                      <Bell className="h-6 w-6 text-amber-600" />
                    </div>
                    {t('widgets.notifications.title')}
                  </CardTitle>
                  <Link href="/reminders">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {(upcomingReminders.length > 0 || overdueChores.length > 0 || highPriorityTasks.length > 0) ? (
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {/* Overdue Chores Alert */}
                    {overdueChores.length > 0 && (
                      <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 rounded-xl border border-red-200/50 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          <span className="font-semibold text-base text-red-700 dark:text-red-300">
                            {overdueChores.length} {t('widgets.notifications.overdueChores', { count: overdueChores.length })}
                          </span>
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                          {overdueChores[0]?.title}
                          {overdueChores.length > 1 && ` and ${overdueChores.length - 1} more`}
                        </p>
                      </div>
                    )}

                    {/* High Priority Tasks Alert */}
                    {highPriorityTasks.length > 0 && (
                      <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 rounded-xl border border-orange-200/50 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                          <AlertCircle className="h-5 w-5 text-orange-500" />
                          <span className="font-semibold text-base text-orange-700 dark:text-orange-300">
                            {highPriorityTasks.length} {t('widgets.notifications.highPriorityTasks', { count: highPriorityTasks.length })}
                          </span>
                        </div>
                        <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                          {highPriorityTasks[0]?.title}
                          {highPriorityTasks.length > 1 && ` and ${highPriorityTasks.length - 1} more`}
                        </p>
                      </div>
                    )}

                    {/* Upcoming Reminders */}
                    {upcomingReminders.slice(0, 2).map((reminder) => (
                      <div key={reminder.id} className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/40 rounded-xl border border-blue-200/50 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                          <Bell className="h-5 w-5 text-blue-500" />
                          <span className="font-semibold text-base text-blue-700 dark:text-blue-300">{reminder.title}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate flex-1 mr-4">
                            {reminder.description}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                            <Clock className="h-4 w-4" />
                            {formatCompactDate(new Date(reminder.reminderTime))}
                          </div>
                        </div>
                      </div>
                    ))}

                    {upcomingReminders.length > 2 && (
                      <div className="text-center pt-3">
                        <p className="text-sm text-muted-foreground font-medium">+{upcomingReminders.length - 2} {t('widgets.notifications.moreReminders')}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-2">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Check className="h-10 w-10 text-green-500" />
                    </div>
                    <p className="text-xl font-semibold text-green-600 mb-2">{t('widgets.notifications.allCaughtUp')}</p>
                    <p className="text-base text-muted-foreground">{t('widgets.notifications.noUrgent')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Finance Summary Card */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-3 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-emerald-500/15 rounded-xl border border-emerald-200/50">
                      <DollarSign className="h-6 w-6 text-emerald-600" />
                    </div>
                    {t('widgets.finance.title')}
                  </CardTitle>
                  <Link href="/finance">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {/* Balance Summary */}
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/40 rounded-xl border border-emerald-200/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t('widgets.finance.balance')}</span>
                    <span className={`text-lg font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {netBalance >= 0 ? '+' : ''}${Math.abs(netBalance).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>{t('widgets.finance.income')}: ${totalIncome.toLocaleString('es-AR')}</span>
                    <span>{t('widgets.finance.expenses')}: ${totalExpenses.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 rounded-lg border border-yellow-200/50 text-center">
                    <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{pendingPayments.length}</p>
                    <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">{t('widgets.finance.pending')}</p>
                  </div>
                  <div className="p-2 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 rounded-lg border border-red-200/50 text-center">
                    <p className="text-xl font-bold text-red-700 dark:text-red-300">{overduePayments.length}</p>
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">{t('widgets.finance.overdue')}</p>
                  </div>
                </div>

                {/* Active Expenses Count */}
                <div className="text-center pt-1">
                  <p className="text-xs text-muted-foreground">
                    {recurringExpenses.length} {t('widgets.finance.activeExpenses')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Keto Tracker Card */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-3 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-orange-500/15 rounded-xl border border-orange-200/50">
                      <Flame className="h-6 w-6 text-orange-600" />
                    </div>
                    {t('widgets.keto.title')}
                  </CardTitle>
                  <Link href="/keto">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {ketoSettings && ketoSettings.length > 0 ? (
                  <>
                    {/* Current Streak */}
                    <div className="p-3 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 rounded-xl border border-orange-200/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{t('widgets.keto.streak')}</span>
                        <div className="flex items-center gap-1">
                          <Flame className="h-5 w-5 text-orange-500" />
                          <span className="text-2xl font-bold text-orange-600">{ketoStreak}</span>
                          <span className="text-sm text-orange-500">{ketoT('stats.days')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Weekly Success Rate */}
                    <div className="p-2 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/40 rounded-lg border border-green-200/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-green-700 dark:text-green-300">{t('widgets.keto.weeklySuccess')}</span>
                        <span className="text-lg font-bold text-green-600">{ketoWeeklyRate}%</span>
                      </div>
                      <div className="mt-1 h-2 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                          style={{ width: `${ketoWeeklyRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/40 rounded-lg border border-emerald-200/50 text-center">
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{ketoSuccessfulDays.length}</p>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('widgets.keto.successDays')}</p>
                      </div>
                      <div className="p-2 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 rounded-lg border border-red-200/50 text-center">
                        <p className="text-xl font-bold text-red-700 dark:text-red-300">{ketoCheatDays.length}</p>
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">{t('widgets.keto.cheatDays')}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Flame className="h-7 w-7 text-orange-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{t('widgets.keto.notStarted')}</p>
                    <Link href="/keto">
                      <Button variant="outline" size="sm" className="mt-2">
                        {t('widgets.keto.startTracking')}
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents Widget */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-6 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-slate-500/15 rounded-xl border border-slate-200/50">
                      <FileText className="h-6 w-6 text-slate-600" />
                    </div>
                    {t('widgets.documents.title')}
                  </CardTitle>
                  <Link href="/documents">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {documents.length > 0 ? (
                  <>
                    {/* Documents Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/30 dark:to-slate-900/40 rounded-xl border border-slate-200/50 text-center">
                        <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{documents.length}</p>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('widgets.documents.total')}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 rounded-xl border border-yellow-200/50 text-center">
                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{expiringDocuments.length}</p>
                        <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">{t('widgets.documents.expiring')}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 rounded-xl border border-red-200/50 text-center">
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{expiredDocuments.length}</p>
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">{t('widgets.documents.expired')}</p>
                      </div>
                    </div>

                    {/* Expiring Soon Alert */}
                    {(expiredDocuments.length > 0 || expiringDocuments.length > 0) && (
                      <div className={`p-3 rounded-xl border ${
                        expiredDocuments.length > 0
                          ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 border-red-200/50'
                          : 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 border-yellow-200/50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`h-4 w-4 ${expiredDocuments.length > 0 ? 'text-red-500' : 'text-yellow-500'}`} />
                          <span className={`text-sm font-medium ${
                            expiredDocuments.length > 0
                              ? 'text-red-700 dark:text-red-300'
                              : 'text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {expiredDocuments.length > 0
                              ? `${expiredDocuments.length} ${t('widgets.documents.expired')}`
                              : `${expiringDocuments.length} ${t('widgets.documents.expiring')}`
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-7 w-7 text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{t('widgets.documents.noDocuments')}</p>
                    <Link href="/documents">
                      <Button variant="outline" size="sm" className="mt-2">
                        {t('widgets.documents.uploadFirst')}
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Maintenance Widget */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-6 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-cyan-500/15 rounded-xl border border-cyan-200/50">
                      <Wrench className="h-6 w-6 text-cyan-600" />
                    </div>
                    {t('widgets.maintenance.title')}
                  </CardTitle>
                  <Link href="/maintenance">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {maintenanceItems.length > 0 ? (
                  <>
                    {/* Maintenance Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/30 dark:to-cyan-900/40 rounded-xl border border-cyan-200/50 text-center">
                        <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{maintenanceItems.length}</p>
                        <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">{t('widgets.maintenance.items')}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 rounded-xl border border-yellow-200/50 text-center">
                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{upcomingMaintenanceTasks.length}</p>
                        <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">{t('widgets.maintenance.dueSoon')}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 rounded-xl border border-red-200/50 text-center">
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{overdueMaintenanceTasks.length}</p>
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">{t('widgets.maintenance.overdue')}</p>
                      </div>
                    </div>

                    {/* Overdue Alert */}
                    {(overdueMaintenanceTasks.length > 0 || upcomingMaintenanceTasks.length > 0) && (
                      <div className={`p-3 rounded-xl border ${
                        overdueMaintenanceTasks.length > 0
                          ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 border-red-200/50'
                          : 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 border-yellow-200/50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`h-4 w-4 ${overdueMaintenanceTasks.length > 0 ? 'text-red-500' : 'text-yellow-500'}`} />
                          <span className={`text-sm font-medium ${
                            overdueMaintenanceTasks.length > 0
                              ? 'text-red-700 dark:text-red-300'
                              : 'text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {overdueMaintenanceTasks.length > 0
                              ? `${overdueMaintenanceTasks.length} ${t('widgets.maintenance.overdueAlert')}`
                              : `${upcomingMaintenanceTasks.length} ${t('widgets.maintenance.dueSoonAlert')}`
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Wrench className="h-7 w-7 text-cyan-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{t('widgets.maintenance.noItems')}</p>
                    <Link href="/maintenance">
                      <Button variant="outline" size="sm" className="mt-2">
                        {t('widgets.maintenance.addFirst')}
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subscriptions Widget */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-6 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                    <div className="p-2 bg-violet-500/15 rounded-xl border border-violet-200/50">
                      <CreditCard className="h-6 w-6 text-violet-600" />
                    </div>
                    {t('widgets.subscriptions.title')}
                  </CardTitle>
                  <Link href="/subscriptions">
                    <Button variant="ghost" size="lg" className="touch-target">
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {subscriptions.length > 0 ? (
                  <>
                    {/* Subscriptions Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950/30 dark:to-violet-900/40 rounded-xl border border-violet-200/50 text-center">
                        <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{activeSubscriptions.length}</p>
                        <p className="text-xs font-medium text-violet-600 dark:text-violet-400">{t('widgets.subscriptions.active')}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/40 rounded-xl border border-emerald-200/50 text-center">
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">${Math.round(monthlySubscriptionTotal).toLocaleString('es-AR')}</p>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('widgets.subscriptions.monthlyTotal')}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 rounded-xl border border-yellow-200/50 text-center">
                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{subscriptionsDueThisWeek.length}</p>
                        <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">{t('widgets.subscriptions.dueSoon')}</p>
                      </div>
                    </div>

                    {/* Due This Week Alert */}
                    {subscriptionsDueThisWeek.length > 0 && (
                      <div className="p-3 rounded-xl border bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 border-yellow-200/50">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                            {subscriptionsDueThisWeek.length} {t('widgets.subscriptions.dueThisWeek')}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CreditCard className="h-7 w-7 text-violet-500" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{t('widgets.subscriptions.noSubscriptions')}</p>
                    <Link href="/subscriptions">
                      <Button variant="outline" size="sm" className="mt-2">
                        {t('widgets.subscriptions.addFirst')}
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      <CompleteChoreModal
        open={isCompleteModalOpen}
        onOpenChange={setIsCompleteModalOpen}
        onComplete={handleConfirmComplete}
        choreTitle={selectedChore?.title || ""}
      />
    </>
  )
}