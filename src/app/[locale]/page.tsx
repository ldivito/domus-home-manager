'use client'
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
  ArrowRight,
  Plus,
  Check,
  Clock
} from "lucide-react"
import Link from 'next/link'
import { db } from '@/lib/db'
// import { generateId } from '@/lib/utils'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'

export default function HomePage() {
  const tHome = useTranslations('home')
  const tCommon = useTranslations('common')
  const tChores = useTranslations('chores')
  const tGrocery = useTranslations('grocery')
  const tMeals = useTranslations('meals')
  const tTasks = useTranslations('tasks')
  const tProjects = useTranslations('projects')
  const tUsers = useTranslations('users')
  // Compact dashboard: removed quick-add state

  // Live data queries
  const users = useLiveQuery(() => db.users.toArray(), []) || []
  
  const nextChore = useLiveQuery(
    () => db.chores.where('isCompleted').equals(0).toArray().then(chores => 
      chores.sort((a, b) => {
        if (!a.nextDue && !b.nextDue) return 0
        if (!a.nextDue) return 1
        if (!b.nextDue) return -1
        return new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()
      })[0]
    ),
    []
  )
  
  const groceryItems = useLiveQuery(
    () => db.groceryItems.orderBy('createdAt').reverse().limit(6).toArray(),
    []
  ) || []
  
  const todaysMeals = useLiveQuery(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    return db.meals.where('date').between(today, tomorrow).toArray()
  }, []) || []
  
  const upcomingTasks = useLiveQuery(
    () => db.tasks.where('isCompleted').equals(0).toArray().then(tasks => 
      tasks
        .filter(task => task.dueDate)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 5)
    ),
    []
  ) || []
  
  const currentProjects = useLiveQuery(
    () => db.homeImprovements.where('status').equals('in-progress').limit(3).toArray(),
    []
  ) || []

  const completedChore = async (choreId: string) => {
    try {
      const chore = await db.chores.get(choreId)
      if (chore) {
        const now = new Date()
        
        // Calculate next due date based on frequency
        const nextDue = new Date(now)
        switch (chore.frequency) {
          case 'daily':
            nextDue.setDate(nextDue.getDate() + 1)
            break
          case 'weekly':
            nextDue.setDate(nextDue.getDate() + 7)
            break
          case 'monthly':
            nextDue.setMonth(nextDue.getMonth() + 1)
            break
          default:
            nextDue.setDate(nextDue.getDate() + 1)
        }

        await db.chores.update(choreId, {
          isCompleted: true,
          completedAt: now,
          lastCompleted: now,
          nextDue: nextDue
        })
        
        toast.success(tHome('widgets.chores.completed'))
      }
    } catch (error) {
      console.error('Error completing chore:', error)
      toast.error(tHome('widgets.chores.error'))
    }
  }

  // Quick-add removed for compact layout

  const getUserName = (userId?: string) => {
    if (!userId) return tCommon('notAssigned')
    const user = users.find(u => u.id === userId)
    return user?.name || tCommon('notAssigned')
  }

  const getUserColor = (userId?: string) => {
    if (!userId) return 'bg-gray-500'
    const user = users.find(u => u.id === userId)
    return user?.color || 'bg-gray-500'
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('default', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <div className="h-full max-w-[1400px] mx-auto p-6 flex flex-col gap-4">
        {/* Top Stats Strip */}
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 sm:col-span-6 lg:col-span-3">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-muted-foreground">Open Tasks</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-3xl font-bold">{upcomingTasks.length}</CardContent>
          </Card>
          <Card className="col-span-12 sm:col-span-6 lg:col-span-3">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-muted-foreground">Grocery Items</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-3xl font-bold">{groceryItems.length}</CardContent>
          </Card>
          <Card className="col-span-12 sm:col-span-6 lg:col-span-3">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-muted-foreground">Meals Today</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-3xl font-bold">{todaysMeals.length}</CardContent>
          </Card>
          <Card className="col-span-12 sm:col-span-6 lg:col-span-3">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-muted-foreground">Active Members</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-3xl font-bold">{users.length}</CardContent>
          </Card>
        </div>

        {/* Mosaic Grid */}
        <div className="flex-1 grid grid-cols-12 auto-rows-[1fr] gap-4 min-h-0">
          
          {/* Next Chore Widget */}
          <Card className="glass-card shadow-modern transition-all duration-300 group flex flex-col min-h-0 col-span-12 md:col-span-6 xl:col-span-4">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <CheckSquare className="h-6 w-6 text-blue-600" />
                  </div>
                  {tHome('widgets.chores.title')}
                </CardTitle>
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  Due Soon
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-auto min-h-0">
              {nextChore ? (
                <div className="space-y-5">
                  <div className="p-3 bg-gradient-to-r from-blue-500/5 to-blue-600/5 rounded-lg border border-blue-200/50">
                    <h3 className="font-semibold text-base mb-1 text-blue-900 dark:text-blue-100 truncate">{nextChore.title}</h3>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Due</p>
                          <p className="font-medium text-xs">{nextChore.nextDue ? formatDate(new Date(nextChore.nextDue)) : 'Not scheduled'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className={`h-6 w-6 ${getUserColor(nextChore.assignedUserId)}`}>
                          <AvatarFallback className="text-white text-xs font-bold">
                            {getUserName(nextChore.assignedUserId).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Assigned</p>
                          <p className="font-medium text-xs truncate max-w-[120px]">{getUserName(nextChore.assignedUserId)}</p>
                        </div>
                      </div>
                    </div>
                    {/* Frequency section removed for compactness */}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      className="flex-1 h-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                      onClick={() => completedChore(nextChore.id!)}
                    >
                      <Check className="h-3 w-3 mr-2" />
                      {tHome('widgets.chores.complete')}
                    </Button>
                    <Link href="/chores">
                      <Button variant="outline" className="h-8 w-full border-blue-200 text-blue-600 hover:bg-blue-50">View</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckSquare className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-4">{tHome('widgets.chores.none')}</h3>
                  <Link href="/chores">
                    <Button className="bg-gradient-to-r from-blue-600 to-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      {tHome('widgets.chores.addFirst')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shopping List Widget */}
          <Card className="glass-card shadow-modern transition-all duration-300 group flex flex-col min-h-0 col-span-12 md:col-span-6 xl:col-span-4">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <ShoppingCart className="h-6 w-6 text-green-600" />
                  </div>
                  {tHome('widgets.grocery.title')}
                </CardTitle>
                <Badge variant="outline" className="text-green-600 border-green-200">
                  {groceryItems.length} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-auto min-h-0">
              {/* Recent Items Compact */}
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  Recent Items
                </h4>
                {groceryItems.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {groceryItems.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                          item.importance === 'high' ? 'bg-red-500' : 
                          item.importance === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">{item.name}</span>
                          <p className="text-[10px] text-muted-foreground truncate">{item.amount}</p>
                        </div>
                        <Badge className={`text-[10px] ${
                          item.importance === 'high' ? 'bg-red-100 text-red-700' : 
                          item.importance === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {tGrocery(`importance.${item.importance}`)}
                        </Badge>
                      </div>
                    ))}
                    {groceryItems.length > 6 && (
                      <div className="text-center py-2">
                        <span className="text-sm text-muted-foreground">+{groceryItems.length - 6} more items</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                      <ShoppingCart className="h-5 w-5 text-green-500" />
                    </div>
                    <p className="text-muted-foreground text-sm">{tHome('widgets.grocery.empty')}</p>
                  </div>
                )}
              </div>
              
              <Link href="/grocery">
                <Button variant="outline" className="h-8 w-full border-green-200 text-green-600 hover:bg-green-50 text-sm">
                  {tHome('widgets.grocery.viewAll')}
                  <ArrowRight className="h-3 w-3 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Today's Meals Widget */}
          <Card className="glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 group flex flex-col min-h-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <UtensilsCrossed className="h-6 w-6 text-orange-600" />
                  </div>
                  {tHome('widgets.meals.title')}
                </CardTitle>
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  {todaysMeals.length} planned
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {todaysMeals.length > 0 ? (
                <div className="space-y-4">
                  {/* Meal Timeline */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      Today&apos;s Menu
                    </h4>
                    {todaysMeals.map((meal) => (
                      <div key={meal.id} className="relative">
                        <div className="flex gap-3 p-3 bg-gradient-to-r from-orange-500/5 to-orange-600/5 rounded-lg border border-orange-200/50">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                              <UtensilsCrossed className="h-6 w-6 text-orange-600" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-bold text-lg text-orange-900 dark:text-orange-100">{meal.title}</h5>
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                                {tMeals(`mealTypes.${meal.mealType}`)}
                              </Badge>
                            </div>
                            {meal.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{meal.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className={`h-6 w-6 ${getUserColor(meal.assignedUserId)}`}>
                                  <AvatarFallback className="text-white text-xs font-bold">
                                    {getUserName(meal.assignedUserId).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{getUserName(meal.assignedUserId)}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {meal.ingredientIds?.length || 0} {tMeals('ingredients')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Link href="/meals">
                    <Button variant="outline" className="w-full border-orange-200 text-orange-600 hover:bg-orange-50">
                      {tHome('widgets.meals.viewAll')}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UtensilsCrossed className="h-8 w-8 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{tHome('widgets.meals.none')}</h3>
                  <p className="text-muted-foreground mb-6">{tHome('widgets.meals.planToday')}</p>
                  <Link href="/meals">
                    <Button className="bg-gradient-to-r from-orange-600 to-orange-700">
                      <Plus className="h-4 w-4 mr-2" />
                      {tHome('widgets.meals.addFirst')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Tasks Widget */}
          <Card className="glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 group flex flex-col min-h-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <List className="h-6 w-6 text-yellow-600" />
                  </div>
                  {tHome('widgets.tasks.title')}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                    {upcomingTasks.length} pending
                  </Badge>
                  <Badge variant="outline" className="text-red-600 border-red-200">
                    {upcomingTasks.filter(task => task.priority === 'high').length} high
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {upcomingTasks.length > 0 ? (
                <div className="space-y-4">
                  {/* Priority Statistics */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-yellow-500/5 to-yellow-600/5 rounded-xl border border-yellow-200/50">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-red-600 font-bold text-lg">{upcomingTasks.filter(t => t.priority === 'high').length}</span>
                      </div>
                      <p className="text-xs text-red-600 font-medium">High</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-yellow-600 font-bold text-lg">{upcomingTasks.filter(t => t.priority === 'medium').length}</span>
                      </div>
                      <p className="text-xs text-yellow-600 font-medium">Medium</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-green-600 font-bold text-lg">{upcomingTasks.filter(t => t.priority === 'low').length}</span>
                      </div>
                      <p className="text-xs text-green-600 font-medium">Low</p>
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      Upcoming Tasks
                    </h4>
                    {upcomingTasks.slice(0, 3).map((task, index) => (
                      <div key={task.id} className="group/task hover:bg-muted/30 transition-colors rounded-lg">
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-muted">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              task.priority === 'high' ? 'bg-red-100' : 
                              task.priority === 'medium' ? 'bg-yellow-100' : 'bg-green-100'
                            }`}>
                              <span className={`font-bold text-sm ${
                                task.priority === 'high' ? 'text-red-600' : 
                                task.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                #{index + 1}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-base truncate">{task.title}</h5>
                              <Badge className={`text-xs ${priorityColors[task.priority]}`}>
                                {tTasks(`priority.${task.priority}`)}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{task.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              {task.dueDate && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {formatDate(new Date(task.dueDate))}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Avatar className={`h-6 w-6 ${getUserColor(task.assignedUserId)}`}>
                                  <AvatarFallback className="text-white text-xs font-bold">
                                    {getUserName(task.assignedUserId).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground font-medium">{getUserName(task.assignedUserId)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {upcomingTasks.length > 3 && (
                      <div className="text-center py-2 border-t border-muted">
                        <span className="text-sm text-muted-foreground">+{upcomingTasks.length - 3} more tasks</span>
                      </div>
                    )}
                  </div>
                  
                  <Link href="/tasks">
                    <Button variant="outline" className="w-full border-yellow-200 text-yellow-600 hover:bg-yellow-50">
                      {tHome('widgets.tasks.viewAll')}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <List className="h-8 w-8 text-yellow-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-4">{tHome('widgets.tasks.none')}</h3>
                  <Link href="/tasks">
                    <Button className="bg-gradient-to-r from-yellow-600 to-yellow-700">
                      <Plus className="h-4 w-4 mr-2" />
                      {tHome('widgets.tasks.addFirst')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Projects Widget */}
          <Card className="glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 group flex flex-col min-h-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg border border-red-500/20">
                    <Hammer className="h-6 w-6 text-red-600" />
                  </div>
                  {tHome('widgets.projects.title')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-red-100 text-red-700 font-semibold">
                    {currentProjects.length} active
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentProjects.length > 0 ? (
                <div className="space-y-6">
                  {/* Statistics Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                        <span className="text-red-600 font-bold text-lg">{currentProjects.filter(p => p.priority === 'high').length}</span>
                      </div>
                      <p className="text-xs text-red-600 font-medium">High</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                        <span className="text-yellow-600 font-bold text-lg">{currentProjects.filter(p => p.priority === 'medium').length}</span>
                      </div>
                      <p className="text-xs text-yellow-600 font-medium">Medium</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                        <span className="text-green-600 font-bold text-lg">{currentProjects.filter(p => p.priority === 'low').length}</span>
                      </div>
                      <p className="text-xs text-green-600 font-medium">Low</p>
                    </div>
                  </div>

                  {/* Projects List */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Hammer className="h-4 w-4 text-red-600" />
                      In Progress
                    </h4>
                    {currentProjects.slice(0, 3).map((project) => (
                      <div key={project.id} className="group/project hover:bg-muted/30 transition-colors rounded-lg">
                        <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/20 rounded-lg border border-border hover:border-muted-foreground/20 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-semibold text-base">{project.title}</h5>
                                <Badge className={`text-xs ${priorityColors[project.priority]}`}>
                                  {tProjects(`priority.${project.priority}`)}
                                </Badge>
                              </div>
                              {project.description && (
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{project.description}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Avatar className={`h-6 w-6 ${getUserColor(project.assignedUserId)}`}>
                                  <AvatarFallback className="text-white text-xs font-bold">
                                    {getUserName(project.assignedUserId).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground font-medium">{getUserName(project.assignedUserId)}</span>
                              </div>
                            </div>
                            
                            {project.estimatedCost && (
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-semibold text-green-600">
                                  ${project.estimatedCost.toFixed(0)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {currentProjects.length > 3 && (
                      <div className="text-center py-3 border-t border-muted">
                        <span className="text-sm text-muted-foreground">+{currentProjects.length - 3} more projects</span>
                      </div>
                    )}
                  </div>
                  
                  <Link href="/projects">
                    <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
                      {tHome('widgets.projects.viewAll')}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Hammer className="h-8 w-8 text-red-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-4">{tHome('widgets.projects.none')}</h3>
                  <Link href="/projects">
                    <Button className="bg-gradient-to-r from-red-600 to-red-700">
                      <Plus className="h-4 w-4 mr-2" />
                      {tHome('widgets.projects.addFirst')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Users Stats Widget */}
          <Card className="glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 group flex flex-col min-h-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg border border-indigo-500/20">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  {tHome('widgets.users.title')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 font-semibold">
                    {users.length} active
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-6 overflow-auto min-h-0">
              {users.length > 0 ? (
                <div className="space-y-6">
                  {/* User Type Statistics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                        <span className="text-indigo-600 font-bold text-lg">{users.filter(u => u.type === 'resident').length}</span>
                      </div>
                      <p className="text-xs text-indigo-600 font-medium">{tHome('widgets.users.residents')}</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                        <span className="text-purple-600 font-bold text-lg">{users.filter(u => u.type === 'guest').length}</span>
                      </div>
                      <p className="text-xs text-purple-600 font-medium">Guests</p>
                    </div>
                  </div>

                  {/* User Avatars with enhanced design */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-600" />
                      Active Members
                    </h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center gap-3 p-3 bg-gradient-to-r from-muted/30 to-muted/20 rounded-lg border border-border hover:border-muted-foreground/20 transition-all">
                          <Avatar className={`h-10 w-10 ${user.color} border-2 border-background shadow-sm`}>
                            <AvatarFallback className="text-white font-bold">
                              {user.avatar || user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-semibold text-sm">{user.name}</h5>
                              <Badge className={`text-xs ${
                                user.type === 'resident' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {user.type === 'resident' ? tUsers('resident') : tUsers('guest')}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 font-bold text-xs">
                                {Math.floor(Math.random() * 15) + 1}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Tasks</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Link href="/users">
                    <Button variant="outline" className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                      {tHome('widgets.users.manage')}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-indigo-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-4">{tHome('widgets.users.none')}</h3>
                  <Link href="/users">
                    <Button className="bg-gradient-to-r from-indigo-600 to-indigo-700">
                      <Plus className="h-4 w-4 mr-2" />
                      {tHome('widgets.users.addFirst')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}