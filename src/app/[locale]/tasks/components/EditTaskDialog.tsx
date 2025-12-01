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
import { CalendarIcon, User, FolderKanban, Clock, AlertTriangle, Tag } from "lucide-react"
import { format } from "date-fns"
import { db, User as UserType, Task, HomeImprovement, TaskCategory } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { cn } from "@/lib/utils"

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  users: UserType[]
  categories: TaskCategory[]
}

export function EditTaskDialog({ open, onOpenChange, task, users, categories }: EditTaskDialogProps) {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const tCat = useTranslations('tasks.defaultTaskCategories')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedUserId, setAssignedUserId] = useState<string>('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [categoryId, setCategoryId] = useState<string>('')
  const [linkedProjectId, setLinkedProjectId] = useState<string>('')
  const [estimatedHours, setEstimatedHours] = useState<string>('')
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('')
  const [blockedByTaskId, setBlockedByTaskId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch projects for dropdown
  const projects = useLiveQuery(
    () => db.homeImprovements.toArray(),
    []
  ) || []

  // Fetch other tasks for blocker dropdown (excluding current task)
  const existingTasks = useLiveQuery(
    () => db.tasks.where('isCompleted').equals(0).toArray(),
    []
  ) || []

  // Filter out current task from blocker options
  const blockerOptions = existingTasks.filter(t => t.id !== task?.id)

  const translateCategoryName = (categoryName: string) => {
    if (categoryName.startsWith('defaultTaskCategories.')) {
      const key = categoryName.replace('defaultTaskCategories.', '')
      const categoryMap: Record<string, string> = {
        'personal': tCat('personal'),
        'work': tCat('work'),
        'home': tCat('home'),
        'shopping': tCat('shopping'),
        'health': tCat('health'),
        'finance': tCat('finance'),
        'errands': tCat('errands'),
        'other': tCat('other')
      }
      return categoryMap[key] || categoryName
    }
    return categoryName
  }

  // Pre-fill form when task changes
  useEffect(() => {
    if (task && open) {
      setTitle(task.title)
      setDescription(task.description || '')
      setAssignedUserId(task.assignedUserId ? task.assignedUserId.toString() : 'unassigned')
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined)
      setPriority(task.priority)
      setCategoryId(task.category || 'none')
      setLinkedProjectId(task.linkedProjectId || 'none')
      setEstimatedHours(task.estimatedTime?.hours?.toString() || '')
      setEstimatedMinutes(task.estimatedTime?.minutes?.toString() || '')
      setBlockedByTaskId(task.blockedByTaskId || 'none')
    }
  }, [task, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !task?.id) {
      return
    }

    setIsSubmitting(true)

    try {
      const hours = estimatedHours ? parseInt(estimatedHours) : 0
      const minutes = estimatedMinutes ? parseInt(estimatedMinutes) : 0
      const hasEstimatedTime = hours > 0 || minutes > 0

      await db.tasks.update(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedUserId: assignedUserId && assignedUserId !== 'unassigned' ? assignedUserId : undefined,
        dueDate: dueDate,
        priority,
        category: categoryId && categoryId !== 'none' ? categoryId : undefined,
        linkedProjectId: linkedProjectId && linkedProjectId !== 'none' ? linkedProjectId : undefined,
        estimatedTime: hasEstimatedTime ? { hours, minutes } : undefined,
        blockedByTaskId: blockedByTaskId && blockedByTaskId !== 'none' ? blockedByTaskId : undefined,
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="edit-category">{t('form.category')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <Tag className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('form.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('form.noCategory')}</SelectItem>
                {categories.map((category: TaskCategory) => (
                  <SelectItem key={category.id} value={category.id!.toString()}>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color || '#6b7280' }}
                      />
                      <span>{translateCategoryName(category.name)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Linked Project */}
          <div className="space-y-2">
            <Label htmlFor="edit-linkedProject">{t('form.linkedProject')}</Label>
            <Select value={linkedProjectId} onValueChange={setLinkedProjectId}>
              <SelectTrigger>
                <FolderKanban className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('form.selectProject')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('form.noProject')}</SelectItem>
                {projects.map((project: HomeImprovement) => (
                  <SelectItem key={project.id} value={project.id!.toString()}>
                    <div className="flex items-center space-x-2">
                      <span>{project.title}</span>
                      <span className="text-xs text-gray-500">({project.status})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estimated Time */}
          <div className="space-y-2">
            <Label>{t('form.estimatedTime')}</Label>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="0"
                  className="w-20"
                />
                <span className="text-sm text-gray-500">{t('form.hours')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  placeholder="0"
                  className="w-20"
                />
                <span className="text-sm text-gray-500">{t('form.minutes')}</span>
              </div>
            </div>
          </div>

          {/* Blocked By Task */}
          <div className="space-y-2">
            <Label htmlFor="edit-blockedBy">{t('form.blockedBy')}</Label>
            <Select value={blockedByTaskId} onValueChange={setBlockedByTaskId}>
              <SelectTrigger>
                <AlertTriangle className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('form.selectBlocker')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('form.noBlocker')}</SelectItem>
                {blockerOptions.map((blockerTask: Task) => (
                  <SelectItem key={blockerTask.id} value={blockerTask.id!.toString()}>
                    <div className="flex items-center space-x-2">
                      <span>{blockerTask.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">{t('form.blockedByHint')}</p>
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
