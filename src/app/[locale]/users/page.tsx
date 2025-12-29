"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, User, Settings, Award, TrendingUp, UserPlus, CheckCircle, Utensils, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { UserFormModal } from "@/components/UserFormModal"
import { db, User as UserType, deleteWithSync } from "@/lib/db"
import { generateId } from "@/lib/utils"
import { toast } from "sonner"

interface UserStats {
  activeTasks: number
  completedTasks: number
  chores: number
}

interface RecentActivity {
  id: string
  type: 'task_completed' | 'chore_completed' | 'meal_planned' | 'task_created'
  title: string
  userId?: string
  userName?: string
  userColor?: string
  timestamp: Date
}

export default function UsersPage() {
  const t = useTranslations('users')
  const [users, setUsers] = useState<UserType[]>([])
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({})
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load users from database
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const dbUsers = await db.users.toArray()
      setUsers(dbUsers)
      
      // Load stats for each user
      const stats: Record<string, UserStats> = {}
      for (const user of dbUsers) {
        if (user.id) {
          const [activeTasks, completedTasks, chores] = await Promise.all([
            db.tasks.where('assignedUserId').equals(user.id).and(task => !task.isCompleted).count(),
            db.tasks.where('assignedUserId').equals(user.id).and(task => task.isCompleted).count(),
            db.chores.where('assignedUserId').equals(user.id).count()
          ])
          
          stats[user.id] = {
            activeTasks,
            completedTasks,
            chores
          }
        }
      }
      setUserStats(stats)

      // Load recent activities
      const activities: RecentActivity[] = []

      // Get completed tasks (last 7 days)
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const allTasks = await db.tasks.toArray()
      const completedTasks = allTasks.filter(
        task => task.isCompleted && task.updatedAt && new Date(task.updatedAt) >= oneWeekAgo
      )

      for (const task of completedTasks.slice(0, 10)) {
        const user = dbUsers.find(u => u.id === task.assignedUserId)
        activities.push({
          id: `task-${task.id}`,
          type: 'task_completed',
          title: task.title,
          userId: task.assignedUserId,
          userName: user?.name,
          userColor: user?.color,
          timestamp: task.updatedAt || task.createdAt
        })
      }

      // Get completed chores (last 7 days)
      const allChores = await db.chores.toArray()
      const completedChores = allChores.filter(
        chore => chore.isCompleted && chore.completedAt && new Date(chore.completedAt) >= oneWeekAgo
      )

      for (const chore of completedChores.slice(0, 10)) {
        const user = dbUsers.find(u => u.id === chore.lastCompletedBy)
        activities.push({
          id: `chore-${chore.id}`,
          type: 'chore_completed',
          title: chore.title,
          userId: chore.lastCompletedBy,
          userName: user?.name,
          userColor: user?.color,
          timestamp: chore.completedAt!
        })
      }

      // Get recent meals (last 7 days)
      const allMeals = await db.meals.toArray()
      const recentMeals = allMeals.filter(
        meal => new Date(meal.date) >= oneWeekAgo && new Date(meal.date) <= new Date()
      )

      for (const meal of recentMeals.slice(0, 5)) {
        activities.push({
          id: `meal-${meal.id}`,
          type: 'meal_planned',
          title: meal.title,
          timestamp: new Date(meal.date)
        })
      }

      // Sort by timestamp and take top 10
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setRecentActivities(activities.slice(0, 8))

    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateUser = async (userData: Omit<UserType, 'id' | 'createdAt'>) => {
    try {
      const newUser: UserType = {
        id: generateId('usr'),
        ...userData,
        createdAt: new Date()
      }

      await db.users.add(newUser)
      await loadUsers() // Reload users after creation
      toast.success(t('messages.userCreated'))
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error(t('messages.error'))
      throw error
    }
  }

  const handleEditUser = (user: UserType) => {
    setSelectedUser(user)
    setIsEditModalOpen(true)
  }

  const handleUpdateUser = async (userId: string, userData: Partial<UserType>) => {
    try {
      await db.users.update(userId, { ...userData, updatedAt: new Date() })
      await loadUsers()
      toast.success(t('messages.userUpdated'))
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error(t('messages.error'))
      throw error
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteWithSync(db.users, 'users', userId)
      await loadUsers()
      toast.success(t('messages.userDeleted'))
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error(t('messages.error'))
      throw error
    }
  }

  const getCompletionRate = (userId: string) => {
    const stats = userStats[userId]
    if (!stats) return 0
    const total = stats.activeTasks + stats.completedTasks
    return total > 0 ? Math.round((stats.completedTasks / total) * 100) : 0
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-96">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-lg font-medium text-muted-foreground">Loading users...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('title')}
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl">
              {t('subtitle')}
            </p>
          </div>
          <Button
            size="lg"
            className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95 w-full md:w-auto"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
            {t('addUser')}
          </Button>
        </div>
        
        {users.length === 0 ? (
          <Card className="glass-card border-2 border-dashed border-primary/30 shadow-modern-lg">
            <CardContent className="text-center py-10 sm:py-12 md:py-16 px-4 sm:px-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                <UserPlus className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-3">{t('noUsers')}</h3>
              <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-md mx-auto">
                {t('addFirstUser')}
              </p>
              <Button
                size="lg"
                onClick={() => setIsModalOpen(true)}
                className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95 w-full sm:w-auto"
              >
                <Plus className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                {t('addUser')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Users Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {users.map((user) => {
                const completionRate = user.id ? getCompletionRate(user.id) : 0
                const stats = user.id ? userStats[user.id] : null

                return (
                  <Card key={user.id} className="glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 hover:scale-[1.02] group">
                    <CardHeader className="text-center pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
                      <div className="flex justify-center mb-3 sm:mb-4">
                        <div className="relative">
                          <Avatar className={`h-16 w-16 sm:h-20 sm:w-20 ${user.color} ring-4 ring-background shadow-modern`}>
                            <AvatarFallback className="text-white text-xl sm:text-2xl font-bold">
                              {user.avatar || user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-primary rounded-full border-2 border-background flex items-center justify-center">
                            <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground" />
                          </div>
                        </div>
                      </div>
                      <CardTitle className="text-xl sm:text-2xl font-bold">{user.name}</CardTitle>
                      <CardDescription className="text-sm sm:text-base font-medium">
                        <Badge variant={user.type === 'resident' ? 'default' : 'secondary'} className="font-medium">
                          {user.type === 'resident' ? t('familyMember') : t('guest')}
                        </Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
                      <div className="text-center">
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3">
                          <div className="absolute inset-0 bg-primary/20 rounded-full"></div>
                          <div
                            className="absolute inset-0 bg-primary rounded-full transition-all duration-300"
                            style={{
                              clipPath: `circle(${completionRate/2}% at 50% 50%)`
                            }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl sm:text-2xl font-bold text-foreground">{completionRate}%</span>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t('completionRate')}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div className="text-center p-2 sm:p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {stats?.activeTasks || 0}
                          </p>
                          <p className="text-[10px] sm:text-xs font-medium text-blue-600/70 dark:text-blue-400/70">{t('activeTasks')}</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                          <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats?.chores || 0}
                          </p>
                          <p className="text-[10px] sm:text-xs font-medium text-green-600/70 dark:text-green-400/70">{t('chores')}</p>
                        </div>
                      </div>

                      {completionRate >= 80 && (
                        <Badge className="w-full justify-center bg-gradient-to-r from-yellow-400 to-orange-400 text-white border-0 font-medium py-1.5 sm:py-2 text-xs sm:text-sm">
                          <Award className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {t('topPerformer')}
                        </Badge>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-10 sm:h-9 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200"
                        onClick={() => handleEditUser(user)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        {t('editProfile')}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
              <Card className="glass-card shadow-modern">
                <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl flex items-center">
                    <TrendingUp className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    {t('recentActivity')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  {recentActivities.length === 0 ? (
                    <div className="text-center py-8 sm:py-10 md:py-12 space-y-3 sm:space-y-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-muted/50 rounded-full flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-base sm:text-lg font-medium text-muted-foreground">{t('noActivity')}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground/70">{t('noActivityDescription')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
                      {recentActivities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                            activity.type === 'task_completed'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              : activity.type === 'chore_completed'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                          }`}>
                            {activity.type === 'task_completed' && <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
                            {activity.type === 'chore_completed' && <Repeat className="h-4 w-4 sm:h-5 sm:w-5" />}
                            {activity.type === 'meal_planned' && <Utensils className="h-4 w-4 sm:h-5 sm:w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm sm:text-base font-medium text-foreground truncate">
                              {activity.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {activity.userName && (
                                <div className="flex items-center gap-1">
                                  <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                    style={{ backgroundColor: activity.userColor || '#6b7280' }}
                                  >
                                    {activity.userName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{activity.userName}</span>
                                </div>
                              )}
                              <span className="text-xs text-muted-foreground/70">
                                {new Date(activity.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card shadow-modern">
                <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl flex items-center">
                    <Award className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    {t('familyStats')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="text-center p-4 sm:p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                      <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-1 sm:mb-2">
                        {Object.values(userStats).reduce((sum, stats) => sum + stats.completedTasks, 0)}
                      </p>
                      <p className="text-sm sm:text-base md:text-lg font-medium text-muted-foreground">{t('totalTasksCompleted')}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="text-center p-3 sm:p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mb-0.5 sm:mb-1">
                          {Object.values(userStats).reduce((sum, stats) => sum + stats.activeTasks, 0)}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-blue-600/70 dark:text-blue-400/70">{t('activeTasks')}</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                        <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mb-0.5 sm:mb-1">
                          {Object.values(userStats).reduce((sum, stats) => sum + stats.chores, 0)}
                        </p>
                        <p className="text-xs sm:text-sm font-medium text-green-600/70 dark:text-green-400/70">{t('assignedChores')}</p>
                      </div>
                    </div>

                    {users.length > 0 && (
                      <div className="space-y-2 sm:space-y-3">
                        <h4 className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-1.5 sm:gap-2">
                          <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                          {t('topContributors')}
                        </h4>
                        <div className="space-y-1.5 sm:space-y-2">
                          {users
                            .filter(user => user.id)
                            .sort((a, b) => getCompletionRate(b.id!) - getCompletionRate(a.id!))
                            .slice(0, 3)
                            .map((user, index) => (
                              <div key={user.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-400 text-white' :
                                    index === 1 ? 'bg-gray-400 text-white' :
                                    'bg-orange-400 text-white'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <Avatar className={`h-6 w-6 sm:h-8 sm:w-8 ${user.color}`}>
                                    <AvatarFallback className="text-white text-xs sm:text-sm font-bold">
                                      {user.avatar || user.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                                <span className="font-medium text-sm sm:text-base text-foreground flex-1 truncate">{user.name}</span>
                                <Badge variant="secondary" className="font-semibold text-xs sm:text-sm">
                                  {user.id ? getCompletionRate(user.id) : 0}%
                                </Badge>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
        
        {/* Add User Modal */}
        <UserFormModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onCreateUser={handleCreateUser}
        />

        {/* Edit User Modal */}
        <UserFormModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          user={selectedUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
        />
      </div>
    </div>
  )
}