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
  Activity
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
  const highPriorityGrocery = groceryItems.filter(item => item.importance === 'high')
  
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

            {/* Quick Stats - Enhanced */}
            <Card className="glass-card shadow-modern-lg border-border/30 col-span-12 lg:col-span-6 flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                  <div className="p-2 bg-purple-500/15 rounded-xl border border-purple-200/50">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                  {t('widgets.stats.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center px-2 py-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/40 rounded-xl border border-blue-200/50 transition-all hover:shadow-md">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-white font-bold text-xl">
                        {chores.length > 0 ? Math.round((chores.filter(c => c.isCompleted).length / chores.length) * 100) : 0}%
                      </span>
                    </div>
                    <p className="text-base font-semibold text-blue-700 dark:text-blue-300">{t('widgets.stats.choresComplete')}</p>
                  </div>

                  <div className="text-center px-2 py-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/40 rounded-xl border border-green-200/50 transition-all hover:shadow-md">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-white font-bold text-xl">{highPriorityGrocery.length}</span>
                    </div>
                    <p className="text-base font-semibold text-green-700 dark:text-green-300">{t('widgets.stats.urgentShopping')}</p>
                  </div>

                  <div className="text-center px-2 py-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 rounded-xl border border-orange-200/50 transition-all hover:shadow-md">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-white font-bold text-xl">{todaysEvents.length + todaysMeals.length}</span>
                    </div>
                    <p className="text-base font-semibold text-orange-700 dark:text-orange-300">{t('widgets.stats.todaysEvents')}</p>
                  </div>

                  <div className="text-center px-2 py-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/40 rounded-xl border border-purple-200/50 transition-all hover:shadow-md">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-white font-bold text-xl">{activeReminders.length}</span>
                    </div>
                    <p className="text-base font-semibold text-purple-700 dark:text-purple-300">{t('widgets.stats.activeReminders')}</p>
                  </div>
                </div>
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