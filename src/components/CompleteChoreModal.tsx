"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, db } from "@/lib/db"
import { CheckSquare, User as UserIcon } from "lucide-react"

interface CompleteChoreModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (completedByUserId: number) => void
  choreTitle: string
}

export function CompleteChoreModal({ open, onOpenChange, onComplete, choreTitle }: CompleteChoreModalProps) {
  const t = useTranslations('chores.completeChoreModal')
  const [completedByUserId, setCompletedByUserId] = useState<string>("none")
  const [users, setUsers] = useState<User[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const dbUsers = await db.users.toArray()
        setUsers(dbUsers)
      } catch (error) {
        console.error('Error loading users:', error)
      }
    }
    
    if (open) {
      loadUsers()
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (completedByUserId === "none") return

    setIsSubmitting(true)
    
    try {
      await onComplete(parseInt(completedByUserId))
      
      // Reset form
      setCompletedByUserId("none")
      onOpenChange(false)
    } catch (error) {
      console.error('Error completing chore:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getSelectedUser = () => {
    return completedByUserId && completedByUserId !== "none" 
      ? users.find(user => user.id?.toString() === completedByUserId) 
      : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card shadow-modern-lg border-2">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-3">
            <CheckSquare className="h-6 w-6 text-primary" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chore Title */}
          <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-lg font-medium text-center">{choreTitle}</p>
          </div>

          {/* Who Completed */}
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              {t('whoCompleted')}
            </Label>
            
            {getSelectedUser() && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <Avatar className={`h-10 w-10 ${getSelectedUser()?.color}`}>
                  <AvatarFallback className="text-white font-bold">
                    {getSelectedUser()?.avatar || getSelectedUser()?.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{getSelectedUser()?.name}</span>
              </div>
            )}
            
            <Select value={completedByUserId} onValueChange={setCompletedByUserId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={t('selectCompleter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="py-3">
                  <span className="text-muted-foreground">{t('selectCompleter')}</span>
                </SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id?.toString() || "none"} className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className={`h-6 w-6 ${user.color}`}>
                        <AvatarFallback className="text-white text-xs font-bold">
                          {user.avatar || user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-14 text-base font-medium hover:bg-muted/80 transition-all duration-200"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={completedByUserId === "none" || isSubmitting}
              className="flex-1 h-14 text-base font-medium shadow-modern hover:shadow-modern-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {t('confirm')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}