'use client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  CheckSquare, 
  ShoppingCart, 
  List, 
  Hammer, 
  UtensilsCrossed, 
  Users,
  ArrowRight,
  Check,
  Activity,
  Target
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

  // Statistics calculations
  const completionRate = chores.length > 0 ? ((chores.filter(c => c.isCompleted).length / chores.length) * 100).toFixed(0) : 0
  const weeklyMeals = meals.filter(meal => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return new Date(meal.date) >= weekAgo
  }).length

  const formatCompactDate = (date: Date) => {
    return new Intl.DateTimeFormat('default', {
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <div className="h-full max-w-[1600px] mx-auto p-6 flex flex-col gap-6">
        
        {/* Header Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="glass-card shadow-modern group hover:shadow-modern-lg transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CheckSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingChores.length}</p>
                <p className="text-xs text-muted-foreground">Pending Chores</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-modern group hover:shadow-modern-lg transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groceryItems.length}</p>
                <p className="text-xs text-muted-foreground">Grocery Items</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-modern group hover:shadow-modern-lg transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <UtensilsCrossed className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todaysMeals.length}</p>
                <p className="text-xs text-muted-foreground">Today&apos;s Meals</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-modern group hover:shadow-modern-lg transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <List className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingTasks.length}</p>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-modern group hover:shadow-modern-lg transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Hammer className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeProjects.length}</p>
                <p className="text-xs text-muted-foreground">Active Projects</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-modern group hover:shadow-modern-lg transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Family Members</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mosaic Grid */}
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
          
          {/* Chores Overview - Compact */}
          <Card className="glass-card shadow-modern col-span-12 lg:col-span-4 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckSquare className="h-5 w-5 text-blue-600" />
                Chores Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-blue-600 font-bold text-xl">{pendingChores.length}</span>
                  </div>
                  <p className="text-sm font-medium text-blue-600">Pending</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-red-600 font-bold text-xl">{overdueChores.length}</span>
                  </div>
                  <p className="text-sm font-medium text-red-600">Overdue</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{completionRate}%</p>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </div>
              <Link href="/chores">
                <Button variant="outline" className="w-full">
                  Manage Chores
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Shopping Stats */}
          <Card className="glass-card shadow-modern col-span-12 lg:col-span-4 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                Shopping List
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-1">
                    <span className="text-red-600 font-bold">{highPriorityGrocery.length}</span>
                  </div>
                  <p className="text-xs text-red-600 font-medium">High</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-1">
                    <span className="text-yellow-600 font-bold">{groceryItems.filter(item => item.importance === 'medium').length}</span>
                  </div>
                  <p className="text-xs text-yellow-600 font-medium">Medium</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                    <span className="text-green-600 font-bold">{groceryItems.filter(item => item.importance === 'low').length}</span>
                  </div>
                  <p className="text-xs text-green-600 font-medium">Low</p>
                </div>
              </div>
              {groceryItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recent Items</h4>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {groceryItems.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${
                          item.importance === 'high' ? 'bg-red-500' : 
                          item.importance === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Link href="/grocery">
                <Button variant="outline" className="w-full">
                  View Shopping List
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Family Members Compact */}
          <Card className="glass-card shadow-modern col-span-12 lg:col-span-4 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-indigo-600" />
                Family Members
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-indigo-600 font-bold text-xl">{users.filter(u => u.type === 'resident').length}</span>
                  </div>
                  <p className="text-sm font-medium text-indigo-600">Residents</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-purple-600 font-bold text-xl">{users.filter(u => u.type === 'guest').length}</span>
                  </div>
                  <p className="text-sm font-medium text-purple-600">Guests</p>
                </div>
              </div>
              {users.length > 0 && (
                <div className="flex -space-x-2 justify-center">
                  {users.slice(0, 4).map((user) => (
                    <Avatar key={user.id} className={`h-8 w-8 ${user.color} border-2 border-background`}>
                      <AvatarFallback className="text-white text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {users.length > 4 && (
                    <div className="h-8 w-8 bg-muted border-2 border-background rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold">+{users.length - 4}</span>
                    </div>
                  )}
                </div>
              )}
              <Link href="/users">
                <Button variant="outline" className="w-full">
                  Manage Members
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Activity Stats */}
          <Card className="glass-card shadow-modern col-span-12 lg:col-span-6 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-purple-600" />
                Weekly Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid grid-cols-4 gap-4 h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-blue-600 font-bold text-lg">{chores.filter(c => {
                      const weekAgo = new Date()
                      weekAgo.setDate(weekAgo.getDate() - 7)
                      return c.completedAt && new Date(c.completedAt) >= weekAgo
                    }).length}</span>
                  </div>
                  <p className="text-sm font-medium text-blue-600">Chores Done</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-orange-600 font-bold text-lg">{weeklyMeals}</span>
                  </div>
                  <p className="text-sm font-medium text-orange-600">Meals Planned</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-yellow-600 font-bold text-lg">{tasks.filter(t => {
                      const weekAgo = new Date()
                      weekAgo.setDate(weekAgo.getDate() - 7)
                      return t.completedAt && new Date(t.completedAt) >= weekAgo
                    }).length}</span>
                  </div>
                  <p className="text-sm font-medium text-yellow-600">Tasks Done</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-red-600 font-bold text-lg">{projects.filter(p => {
                      const weekAgo = new Date()
                      weekAgo.setDate(weekAgo.getDate() - 7)
                      return p.createdAt && new Date(p.createdAt) >= weekAgo
                    }).length}</span>
                  </div>
                  <p className="text-sm font-medium text-red-600">New Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Priority Focus */}
          <Card className="glass-card shadow-modern col-span-12 lg:col-span-6 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-red-600" />
                Priority Focus
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="space-y-3">
                {highPriorityTasks.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="font-medium text-red-700 dark:text-red-300">
                        {highPriorityTasks.length} High Priority Tasks
                      </span>
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      Next: {highPriorityTasks[0]?.title}
                    </div>
                  </div>
                )}
                
                {overdueChores.length > 0 && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="font-medium text-orange-700 dark:text-orange-300">
                        {overdueChores.length} Overdue Chores
                      </span>
                    </div>
                    <div className="text-sm text-orange-600 dark:text-orange-400">
                      {overdueChores[0] && `Due: ${formatCompactDate(new Date(overdueChores[0].nextDue!))}`}
                    </div>
                  </div>
                )}

                {highPriorityGrocery.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-green-700 dark:text-green-300">
                        {highPriorityGrocery.length} Urgent Grocery Items
                      </span>
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      {highPriorityGrocery[0]?.name}
                    </div>
                  </div>
                )}

                {highPriorityTasks.length === 0 && overdueChores.length === 0 && highPriorityGrocery.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-lg font-medium text-green-600">All caught up!</p>
                    <p className="text-sm text-muted-foreground">No urgent items to address</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}