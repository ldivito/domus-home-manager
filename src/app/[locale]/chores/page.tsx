"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, Plus, Calendar, User, Clock, Repeat, Edit, Undo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AddChoreModal } from "@/components/AddChoreModal"
import { EditChoreModal } from "@/components/EditChoreModal"
import { CompleteChoreModal } from "@/components/CompleteChoreModal"
import { db, Chore, User as UserType } from "@/lib/db"

export default function ChoresPage() {
  const t = useTranslations('chores')
  const tFreq = useTranslations('chores.frequency')
  const [chores, setChores] = useState<Chore[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load chores and users from database
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [dbChores, dbUsers] = await Promise.all([
        db.chores.orderBy('nextDue').toArray(),
        db.users.toArray()
      ])
      setChores(dbChores)
      setUsers(dbUsers)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateChore = async (choreData: Omit<Chore, 'id' | 'createdAt'>) => {
    try {
      const newChore: Omit<Chore, 'id'> = {
        ...choreData,
        createdAt: new Date()
      }
      
      await db.chores.add(newChore)
      await loadData() // Reload data after creation
    } catch (error) {
      console.error('Error creating chore:', error)
      throw error
    }
  }

  const handleCompleteChore = (chore: Chore) => {
    setSelectedChore(chore)
    setIsCompleteModalOpen(true)
  }

  const handleEditChore = (chore: Chore) => {
    setSelectedChore(chore)
    setIsEditModalOpen(true)
  }

  const handleConfirmComplete = async (completedByUserId: number) => {
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
      
      await loadData()
    } catch (error) {
      console.error('Error completing chore:', error)
      throw error
    }
  }

  const handleUndoComplete = async (chore: Chore) => {
    if (!chore.id) return
    
    try {
      await db.chores.update(chore.id, {
        isCompleted: false,
        completedAt: undefined,
        lastCompletedBy: undefined
      })
      
      await loadData()
    } catch (error) {
      console.error('Error undoing completion:', error)
    }
  }

  const handleEditChoreSubmit = async (choreId: number, choreData: Partial<Chore>) => {
    try {
      await db.chores.update(choreId, choreData)
      await loadData()
    } catch (error) {
      console.error('Error editing chore:', error)
      throw error
    }
  }

  const getUserById = (userId?: number) => {
    return users.find(user => user.id === userId)
  }

  const getFrequencyDisplay = (chore: Chore) => {
    if (chore.frequency === 'custom' && chore.customFrequency) {
      const { type, value } = chore.customFrequency
      switch (type) {
        case 'times_per_day':
          return tFreq('timesDaily', { times: value })
        case 'times_per_week':
          return tFreq('timesWeekly', { times: value })
        case 'times_per_month':
          return tFreq('timesMonthly', { times: value })
        case 'days_interval':
          return tFreq('everyDays', { days: value })
        default:
          return tFreq('custom')
      }
    }
    
    switch (chore.frequency) {
      case 'daily':
        return tFreq('daily')
      case 'weekly':
        return tFreq('weekly')
      case 'monthly':
        return tFreq('monthly')
      default:
        return chore.frequency
    }
  }

  const isOverdue = (date: Date) => {
    return date < new Date()
  }

  const formatDueDate = (date: Date) => {
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
    
    if (days === 0) return t('dueToday')
    if (days === 1) return t('dueTomorrow')
    if (days === -1) return t('dueYesterday')
    if (days < 0) return t('overdueDays', { days: Math.abs(days) })
    return t('dueInDays', { days })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-96">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-lg font-medium text-muted-foreground">{t('loadingChores')}</div>
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
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="mr-2 h-6 w-6" />
            {t('addChore')}
          </Button>
        </div>
        
        {chores.length === 0 ? (
          <Card className="glass-card border-2 border-dashed border-primary/30 shadow-modern-lg">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                <Repeat className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-3">{t('noChoresYet')}</h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                {t('createFirstChore')}
              </p>
              <Button 
                size="lg" 
                onClick={() => setIsAddModalOpen(true)}
                className="h-14 px-8 text-lg shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="mr-2 h-6 w-6" />
                {t('addFirstChore')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {chores.map((chore) => {
              const assignedUser = getUserById(chore.assignedUserId)
              const completedByUser = getUserById(chore.lastCompletedBy)
              const overdue = !chore.isCompleted && isOverdue(chore.nextDue)
              const isCompleted = chore.isCompleted
              
              return (
                <Card key={chore.id} className={`glass-card shadow-modern hover:shadow-modern-lg transition-all duration-300 hover:scale-[1.02] ${
                  isCompleted ? 'opacity-75 bg-green-50 border-green-200' : 
                  overdue ? 'border-red-500/50' : ''
                }`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className={`text-xl mb-2 flex items-center gap-2 ${isCompleted ? 'line-through text-green-700' : ''}`}>
                          {chore.title}
                          {overdue && <Badge variant="destructive" className="text-xs">{t('overdue')}</Badge>}
                          {isCompleted && <Badge variant="default" className="text-xs bg-green-500">✓</Badge>}
                        </CardTitle>
                        {chore.description && (
                          <CardDescription className={`text-base ${isCompleted ? 'text-green-600/70' : ''}`}>
                            {chore.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditChore(chore)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <CheckSquare className={`h-6 w-6 ${
                          isCompleted ? 'text-green-500' :
                          overdue ? 'text-red-500' : 'text-primary'
                        }`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        {getFrequencyDisplay(chore)}
                      </div>
                      
                      {chore.scheduledTime && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="mr-2 h-4 w-4" />
                          {t('scheduledFor')} {chore.scheduledTime}
                        </div>
                      )}
                      
                      {!isCompleted ? (
                        <div className={`flex items-center text-sm ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                          <Calendar className="mr-2 h-4 w-4" />
                          {formatDueDate(chore.nextDue)}
                        </div>
                      ) : (
                        <div className="flex items-center text-sm text-green-600">
                          <Calendar className="mr-2 h-4 w-4" />
                          {t('completedOn')} {chore.completedAt?.toLocaleDateString()} {chore.completedAt?.toLocaleTimeString()}
                        </div>
                      )}
                      
                      {assignedUser ? (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Avatar className={`h-8 w-8 ${assignedUser.color}`}>
                            <AvatarFallback className="text-white text-sm font-bold">
                              {assignedUser.avatar || assignedUser.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {t('assignedTo')}: {assignedUser.name}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <User className="mr-2 h-4 w-4" />
                          {t('notAssigned')}
                        </div>
                      )}
                      
                      {isCompleted && completedByUser && (
                        <div className="flex items-center gap-3 p-3 bg-green-100 rounded-lg border border-green-200">
                          <Avatar className={`h-8 w-8 ${completedByUser.color}`}>
                            <AvatarFallback className="text-white text-sm font-bold">
                              {completedByUser.avatar || completedByUser.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-green-700">
                            {t('completedBy')}: {completedByUser.name}
                          </span>
                        </div>
                      )}
                      
                      {!isCompleted ? (
                        <Button 
                          className="w-full h-12 text-base shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95" 
                          onClick={() => handleCompleteChore(chore)}
                        >
                          <CheckSquare className="mr-2 h-4 w-4" />
                          {t('markComplete')}
                        </Button>
                      ) : (
                        <Button 
                          variant="outline"
                          className="w-full h-12 text-base border-green-300 text-green-700 hover:bg-green-50" 
                          onClick={() => handleUndoComplete(chore)}
                        >
                          <Undo className="mr-2 h-4 w-4" />
                          {t('undoComplete')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
        
        <AddChoreModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onCreateChore={handleCreateChore}
        />
        
        <EditChoreModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          onEditChore={handleEditChoreSubmit}
          chore={selectedChore}
        />
        
        <CompleteChoreModal
          open={isCompleteModalOpen}
          onOpenChange={setIsCompleteModalOpen}
          onComplete={handleConfirmComplete}
          choreTitle={selectedChore?.title || ""}
        />
      </div>
    </div>
  )
}