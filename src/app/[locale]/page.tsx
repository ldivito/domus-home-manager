'use client'
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
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

export default function HomePage() {

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

  const calendarEvents = useLiveQuery(() => db.calendarEvents.toArray(), []) || []
  const todaysEvents = calendarEvents.filter(event => {
    const today = new Date()
    const eventDate = new Date(event.date)
    return eventDate.toDateString() === today.toDateString()
  })

  const reminders = useLiveQuery(() => db.reminders.toArray(), []) || []
  const activeReminders = reminders.filter(r => !r.isCompleted)
  const upcomingReminders = activeReminders.filter(r => new Date(r.reminderTime) >= new Date())

  // Get next 1-2 chores for display
  const nextChores = useLiveQuery(
    () => db.chores.where('isCompleted').equals(0).toArray().then(chores => 
      chores
        .filter(c => c.nextDue)
        .sort((a, b) => new Date(a.nextDue!).getTime() - new Date(b.nextDue!).getTime())
        .slice(0, 2)
    ),
    []
  ) || []

  const formatCompactDate = (date: Date) => {
    return new Intl.DateTimeFormat('default', {
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  return (
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
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Chores</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/40 transition-all hover:shadow-md">
                <div className="p-3 bg-green-500/15 rounded-xl border border-green-200/50">
                  <ShoppingCart className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{groceryItems.length}</p>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Shopping</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 transition-all hover:shadow-md">
                <div className="p-3 bg-orange-500/15 rounded-xl border border-orange-200/50">
                  <UtensilsCrossed className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{todaysMeals.length}</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Meals</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/40 transition-all hover:shadow-md">
                <div className="p-3 bg-yellow-500/15 rounded-xl border border-yellow-200/50">
                  <List className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{pendingTasks.length}</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Tasks</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/40 transition-all hover:shadow-md">
                <div className="p-3 bg-red-500/15 rounded-xl border border-red-200/50">
                  <Hammer className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{activeProjects.length}</p>
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Projects</p>
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
                  Next Chores
                </CardTitle>
                <Link href="/chores">
                  <Button variant="ghost" size="lg" className="touch-target">
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {nextChores.length > 0 ? (
                <>
                  {nextChores.map((chore) => (
                    <div key={chore.id} className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/40 rounded-xl border border-blue-200/50 transition-all hover:shadow-md">
                      <h4 className="font-semibold text-base mb-3 text-blue-900 dark:text-blue-100">{chore.title}</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {chore.nextDue ? formatCompactDate(new Date(chore.nextDue)) : 'No date'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {chore.assignedUserId && (
                            <Avatar className={`h-6 w-6 ${users.find(u => u.id === chore.assignedUserId)?.color || 'bg-gray-500'} border border-background`}>
                              <AvatarFallback className="text-white text-xs font-bold">
                                {users.find(u => u.id === chore.assignedUserId)?.name?.charAt(0).toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {users.find(u => u.id === chore.assignedUserId)?.name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingChores.length > 2 && (
                    <div className="text-center pt-3">
                      <p className="text-sm text-muted-foreground font-medium">
                        +{pendingChores.length - 2} more chores
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckSquare className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">No pending chores</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">You&apos;re all caught up!</p>
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
                  Shopping List
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
                      <p className="text-sm text-muted-foreground font-medium">+{groceryItems.length - 6} more items</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">Shopping list is empty</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Add some items to get started</p>
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
                  Today&apos;s Schedule
                </CardTitle>
                <Link href="/planner">
                  <Button variant="ghost" size="lg" className="touch-target">
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {(todaysEvents.length > 0 || todaysMeals.length > 0) ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {/* Today's Events */}
                  {todaysEvents.map((event) => (
                    <div key={event.id} className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/40 rounded-xl border border-purple-200/50 transition-all hover:shadow-md">
                      <h4 className="font-semibold text-base mb-2 text-purple-900 dark:text-purple-100">{event.title}</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            {event.time || 'All day'}
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
                            {meal.mealType}
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
                              {users.find(u => u.id === meal.assignedUserId)?.name || 'Unassigned'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-purple-500" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">No events scheduled</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Your day is free!</p>
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
                  Notifications & Reminders
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
                          {overdueChores.length} Overdue Chore{overdueChores.length > 1 ? 's' : ''}
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
                          {highPriorityTasks.length} High Priority Task{highPriorityTasks.length > 1 ? 's' : ''}
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
                      <p className="text-sm text-muted-foreground font-medium">+{upcomingReminders.length - 2} more reminders</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-2">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="h-10 w-10 text-green-500" />
                  </div>
                  <p className="text-xl font-semibold text-green-600 mb-2">All caught up!</p>
                  <p className="text-base text-muted-foreground">No urgent notifications or reminders</p>
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
                Quick Stats
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
                  <p className="text-base font-semibold text-blue-700 dark:text-blue-300">Chores Complete</p>
                </div>

                <div className="text-center px-2 py-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/40 rounded-xl border border-green-200/50 transition-all hover:shadow-md">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-white font-bold text-xl">{highPriorityGrocery.length}</span>
                  </div>
                  <p className="text-base font-semibold text-green-700 dark:text-green-300">Urgent Shopping</p>
                </div>

                <div className="text-center px-2 py-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/40 rounded-xl border border-orange-200/50 transition-all hover:shadow-md">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-white font-bold text-xl">{todaysEvents.length + todaysMeals.length}</span>
                  </div>
                  <p className="text-base font-semibold text-orange-700 dark:text-orange-300">Today&apos;s Events</p>
                </div>

                <div className="text-center px-2 py-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/40 rounded-xl border border-purple-200/50 transition-all hover:shadow-md">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-white font-bold text-xl">{activeReminders.length}</span>
                  </div>
                  <p className="text-base font-semibold text-purple-700 dark:text-purple-300">Active Reminders</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}