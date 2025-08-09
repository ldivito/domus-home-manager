'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, User } from "lucide-react"
import { format } from "date-fns"
import { db, User as UserType, Task } from '@/lib/db'
import { cn } from "@/lib/utils"

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  users: UserType[]
}

export function EditTaskDialog({ open, onOpenChange, task, users }: EditTaskDialogProps) {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedUserId, setAssignedUserId] = useState<string>('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-fill form when task changes
  useEffect(() => {
    if (task && open) {
      setTitle(task.title)
      setDescription(task.description || '')
      setAssignedUserId(task.assignedUserId ? task.assignedUserId.toString() : 'unassigned')
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined)
      setPriority(task.priority)
    }
  }, [task, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !task?.id) {
      return
    }

    setIsSubmitting(true)
    
    try {
      await db.tasks.update(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedUserId: assignedUserId && assignedUserId !== 'unassigned' ? parseInt(assignedUserId) : undefined,
        dueDate: dueDate,
        priority,
      })

      onOpenChange(false)
    } catch (error) {
      console.error('Error updating task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('editTask')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">{t('form.title')} *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('form.titlePlaceholder')}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">{t('form.description')}</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          {/* Assigned User */}
          <div className="space-y-2">
            <Label htmlFor="edit-assignedUser">{t('form.assignedTo')}</Label>
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
              <SelectTrigger>
                <User className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('form.selectUser')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{tCommon('notAssigned')}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id!.toString()}>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: user.color }}
                      />
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="edit-priority">{t('form.priority')}</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as 'low' | 'medium' | 'high')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>{t('priority.low')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>{t('priority.medium')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>{t('priority.high')}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>{t('form.dueDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>{t('form.pickDate')}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon('cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? t('form.updating') : t('form.updateTask')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}