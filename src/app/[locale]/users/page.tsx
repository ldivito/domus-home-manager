"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, User, Settings, Award, TrendingUp, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AddUserModal } from "@/components/AddUserModal"
import { EditUserModal } from "@/components/EditUserModal"
import { db, User as UserType, deleteWithSync } from "@/lib/db"
import { generateId } from "@/lib/utils"
import { toast } from "sonner"

interface UserStats {
  activeTasks: number
  completedTasks: number
  chores: number
}

export default function UsersPage() {
  const t = useTranslations('users')
  const [users, setUsers] = useState<UserType[]>([])
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({})
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
      <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-muted/20">
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
    <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('title')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              {t('subtitle')}
            </p>
          </div>
          <Button 
            size="lg" 
            className="h-14 px-8 text-lg shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="mr-2 h-6 w-6" />
            {t('addUser')}
          </Button>
        </div>
        
        {users.length === 0 ? (
          <Card className="glass-card border-2 border-dashed border-primary/30 shadow-modern-lg">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                <UserPlus className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-3">{t('noUsers')}</h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                {t('addFirstUser')}
              </p>
              <Button 
                size="lg" 
                onClick={() => setIsModalOpen(true)}
                className="h-14 px-8 text-lg shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="mr-2 h-6 w-6" />
                {t('addUser')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Users Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {users.map((user) => {
                const completionRate = user.id ? getCompletionRate(user.id) : 0
                const stats = user.id ? userStats[user.id] : null
                
                return (
                  <Card key={user.id} className="glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 hover:scale-[1.02] group">
                    <CardHeader className="text-center pb-4">
                      <div className="flex justify-center mb-4">
                        <div className="relative">
                          <Avatar className={`h-20 w-20 ${user.color} ring-4 ring-background shadow-modern`}>
                            <AvatarFallback className="text-white text-2xl font-bold">
                              {user.avatar || user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full border-2 border-background flex items-center justify-center">
                            <User className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                      </div>
                      <CardTitle className="text-2xl font-bold">{user.name}</CardTitle>
                      <CardDescription className="text-base font-medium">
                        <Badge variant={user.type === 'resident' ? 'default' : 'secondary'} className="font-medium">
                          {user.type === 'resident' ? t('familyMember') : t('guest')}
                        </Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="text-center">
                        <div className="relative w-16 h-16 mx-auto mb-3">
                          <div className="absolute inset-0 bg-primary/20 rounded-full"></div>
                          <div 
                            className="absolute inset-0 bg-primary rounded-full transition-all duration-300"
                            style={{
                              clipPath: `circle(${completionRate/2}% at 50% 50%)`
                            }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold text-foreground">{completionRate}%</span>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">{t('completionRate')}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {stats?.activeTasks || 0}
                          </p>
                          <p className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70">{t('activeTasks')}</p>
                        </div>
                        <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats?.chores || 0}
                          </p>
                          <p className="text-xs font-medium text-green-600/70 dark:text-green-400/70">{t('chores')}</p>
                        </div>
                      </div>
                      
                      {completionRate >= 80 && (
                        <Badge className="w-full justify-center bg-gradient-to-r from-yellow-400 to-orange-400 text-white border-0 font-medium py-2">
                          <Award className="mr-2 h-4 w-4" />
                          {t('topPerformer')}
                        </Badge>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="glass-card shadow-modern">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center">
                    <TrendingUp className="mr-3 h-6 w-6 text-primary" />
                    {t('recentActivity')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 mx-auto bg-muted/50 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-muted-foreground">Coming Soon</p>
                      <p className="text-sm text-muted-foreground/70">Recent activity will be displayed here</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card shadow-modern">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center">
                    <Award className="mr-3 h-6 w-6 text-primary" />
                    {t('familyStats')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                      <p className="text-5xl font-bold text-primary mb-2">
                        {Object.values(userStats).reduce((sum, stats) => sum + stats.completedTasks, 0)}
                      </p>
                      <p className="text-lg font-medium text-muted-foreground">{t('totalTasksCompleted')}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                          {Object.values(userStats).reduce((sum, stats) => sum + stats.activeTasks, 0)}
                        </p>
                        <p className="text-sm font-medium text-blue-600/70 dark:text-blue-400/70">{t('activeTasks')}</p>
                      </div>
                      <div className="text-center p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                          {Object.values(userStats).reduce((sum, stats) => sum + stats.chores, 0)}
                        </p>
                        <p className="text-sm font-medium text-green-600/70 dark:text-green-400/70">{t('assignedChores')}</p>
                      </div>
                    </div>
                    
                    {users.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          {t('topContributors')}
                        </h4>
                        <div className="space-y-2">
                          {users
                            .filter(user => user.id)
                            .sort((a, b) => getCompletionRate(b.id!) - getCompletionRate(a.id!))
                            .slice(0, 3)
                            .map((user, index) => (
                              <div key={user.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-400 text-white' :
                                    index === 1 ? 'bg-gray-400 text-white' :
                                    'bg-orange-400 text-white'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <Avatar className={`h-8 w-8 ${user.color}`}>
                                    <AvatarFallback className="text-white text-sm font-bold">
                                      {user.avatar || user.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                                <span className="font-medium text-foreground flex-1">{user.name}</span>
                                <Badge variant="secondary" className="font-semibold">
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
        
        <AddUserModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onCreateUser={handleCreateUser}
        />

        <EditUserModal
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