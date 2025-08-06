"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, User, Settings, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AddUserModal } from "@/components/AddUserModal"
import { db, User as UserType } from "@/lib/db"

interface UserStats {
  activeTasks: number
  completedTasks: number
  chores: number
}

export default function UsersPage() {
  const t = useTranslations('users')
  const [users, setUsers] = useState<UserType[]>([])
  const [userStats, setUserStats] = useState<Record<number, UserStats>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
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
      const stats: Record<number, UserStats> = {}
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
      const newUser: Omit<UserType, 'id'> = {
        ...userData,
        createdAt: new Date()
      }
      
      await db.users.add(newUser)
      await loadUsers() // Reload users after creation
    } catch (error) {
      console.error('Error creating user:', error)
      throw error
    }
  }

  const getCompletionRate = (userId: number) => {
    const stats = userStats[userId]
    if (!stats) return 0
    const total = stats.activeTasks + stats.completedTasks
    return total > 0 ? Math.round((stats.completedTasks / total) * 100) : 0
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-gray-600">Loading users...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('title')}</h1>
            <p className="text-xl text-gray-600">{t('subtitle')}</p>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-6 w-6" />
            {t('addUser')}
          </Button>
        </div>
        
        {users.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <User className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">{t('noUsers')}</h3>
              <p className="text-lg text-gray-600 mb-6">{t('addFirstUser')}</p>
              <Button size="lg" onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-5 w-5" />
                {t('addUser')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {users.map((user) => {
                const completionRate = user.id ? getCompletionRate(user.id) : 0
                const stats = user.id ? userStats[user.id] : null
                
                return (
                  <Card key={user.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="text-center pb-4">
                      <div className="flex justify-center mb-3">
                        <Avatar className={`h-16 w-16 ${user.color}`}>
                          <AvatarFallback className="text-white text-xl font-bold">
                            {user.avatar || user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <CardTitle className="text-2xl">{user.name}</CardTitle>
                      <CardDescription className="text-base">
                        {user.type === 'resident' ? t('familyMember') : t('guest')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-gray-800">{completionRate}%</p>
                          <p className="text-sm text-gray-500">{t('completionRate')}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <p className="text-lg font-semibold text-blue-600">
                              {stats?.activeTasks || 0}
                            </p>
                            <p className="text-xs text-gray-500">{t('activeTasks')}</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-green-600">
                              {stats?.chores || 0}
                            </p>
                            <p className="text-xs text-gray-500">{t('chores')}</p>
                          </div>
                        </div>
                        
                        {completionRate >= 80 && (
                          <Badge className="w-full justify-center bg-yellow-100 text-yellow-800">
                            <Award className="mr-1 h-3 w-3" />
                            {t('topPerformer')}
                          </Badge>
                        )}
                        
                        <Button variant="outline" size="sm" className="w-full">
                          <Settings className="mr-2 h-4 w-4" />
                          {t('editProfile')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center">
                    <User className="mr-2 h-6 w-6" />
                    {t('recentActivity')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    Coming soon - Recent activity will be displayed here
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center">
                    <Award className="mr-2 h-6 w-6" />
                    {t('familyStats')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-800">
                        {Object.values(userStats).reduce((sum, stats) => sum + stats.completedTasks, 0)}
                      </p>
                      <p className="text-lg text-gray-600">{t('totalTasksCompleted')}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          {Object.values(userStats).reduce((sum, stats) => sum + stats.activeTasks, 0)}
                        </p>
                        <p className="text-sm text-blue-700">{t('activeTasks')}</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">
                          {Object.values(userStats).reduce((sum, stats) => sum + stats.chores, 0)}
                        </p>
                        <p className="text-sm text-green-700">{t('assignedChores')}</p>
                      </div>
                    </div>
                    
                    {users.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-700">{t('topContributors')}</h4>
                        {users
                          .filter(user => user.id)
                          .sort((a, b) => getCompletionRate(b.id!) - getCompletionRate(a.id!))
                          .slice(0, 3)
                          .map((user, index) => (
                            <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center">
                                <span className="text-lg font-bold text-gray-500 mr-2">#{index + 1}</span>
                                <Avatar className={`h-6 w-6 ${user.color}`}>
                                  <AvatarFallback className="text-white text-xs font-bold">
                                    {user.avatar || user.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="ml-2 font-medium">{user.name}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-600">
                                {user.id ? getCompletionRate(user.id) : 0}%
                              </span>
                            </div>
                          ))
                        }
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
      </div>
    </div>
  )
}