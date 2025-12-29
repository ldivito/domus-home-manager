'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { generateId } from '@/lib/utils'
import { cn } from "@/lib/utils"
import { logger } from '@/lib/logger'

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null  // If provided, we're editing. If not, we're creating.
  users: UserType[]
  categories: TaskCategory[]
}

interface TaskFormState {
  title: string
  description: string
  assignedUserId: string
  dueDate: Date | undefined
  priority: 'low' | 'medium' | 'high'
  categoryId: string
  linkedProjectId: string
  estimatedHours: string
  estimatedMinutes: string
  blockedByTaskId: string
}

const initialFormState: TaskFormState = {
  title: '',
  description: '',
  assignedUserId: '',
  dueDate: undefined,
  priority: 'medium',
  categoryId: '',
  linkedProjectId: '',
  estimatedHours: '',
  estimatedMinutes: '',
  blockedByTaskId: ''
}

export function TaskFormDialog({ open, onOpenChange, task, users, categories }: TaskFormDialogProps) {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const tCat = useTranslations('tasks.defaultTaskCategories')

  const isEditing = !!task
  const [formState, setFormState] = useState<TaskFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch projects for dropdown
  const projects = useLiveQuery(
    () => isEditing
      ? db.homeImprovements.toArray()
      : db.homeImprovements.where('status').notEqual('done').toArray(),
    [isEditing]
  ) || []

  // Fetch other tasks for blocker dropdown
  const existingTasks = useLiveQuery(
    () => db.tasks.where('isCompleted').equals(0).toArray(),
    []
  ) || []

  // Filter out current task from blocker options when editing
  const blockerOptions = isEditing
    ? existingTasks.filter(t => t.id !== task?.id)
    : existingTasks

  const translateCategoryName = useCallback((categoryName: string) => {
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
  }, [tCat])

  // Pre-fill form when task changes (edit mode) or reset when opening (create mode)
  useEffect(() => {
    if (open) {
      if (task) {
        setFormState({
          title: task.title,
          description: task.description || '',
          assignedUserId: task.assignedUserId ? task.assignedUserId.toString() : 'unassigned',
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          priority: task.priority,
          categoryId: task.category || 'none',
          linkedProjectId: task.linkedProjectId || 'none',
          estimatedHours: task.estimatedTime?.hours?.toString() || '',
          estimatedMinutes: task.estimatedTime?.minutes?.toString() || '',
          blockedByTaskId: task.blockedByTaskId || 'none'
        })
      } else {
        setFormState(initialFormState)
      }
    }
  }, [task, open])

  const updateField = <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formState.title.trim()) return
    if (isEditing && !task?.id) return

    setIsSubmitting(true)

    try {
      const hours = formState.estimatedHours ? parseInt(formState.estimatedHours) : 0
      const minutes = formState.estimatedMinutes ? parseInt(formState.estimatedMinutes) : 0
      const hasEstimatedTime = hours > 0 || minutes > 0

      const taskData = {
        title: formState.title.trim(),
        description: formState.description.trim() || undefined,
        assignedUserId: formState.assignedUserId && formState.assignedUserId !== 'unassigned' ? formState.assignedUserId : undefined,
        dueDate: formState.dueDate,
        priority: formState.priority,
        category: formState.categoryId && formState.categoryId !== 'none' ? formState.categoryId : undefined,
        linkedProjectId: formState.linkedProjectId && formState.linkedProjectId !== 'none' ? formState.linkedProjectId : undefined,
        estimatedTime: hasEstimatedTime ? { hours, minutes } : undefined,
        blockedByTaskId: formState.blockedByTaskId && formState.blockedByTaskId !== 'none' ? formState.blockedByTaskId : undefined,
      }

      if (isEditing) {
        await db.tasks.update(task!.id!, {
          ...taskData,
          updatedAt: new Date()
        })
      } else {
        const newTask: Task = {
          id: generateId('tsk'),
          ...taskData,
          isCompleted: false,
          createdAt: new Date()
        }
        await db.tasks.add(newTask)
      }

      setFormState(initialFormState)
      onOpenChange(false)
    } catch (error) {
      logger.error(`Error ${isEditing ? 'updating' : 'creating'} task:`, error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setFormState(initialFormState)
    onOpenChange(false)
  }

  if (isEditing && !task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? t('editTask') : t('addTask')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          {/* Title - Full width */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-sm font-medium">{t('form.title')} *</Label>
            <Input
              id="task-title"
              value={formState.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('form.titlePlaceholder')}
              className="h-10"
              required
            />
          </div>

          {/* Description - Full width */}
          <div className="space-y-1.5">
            <Label htmlFor="task-description" className="text-sm font-medium">{t('form.description')}</Label>
            <Textarea
              id="task-description"
              value={formState.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Row 1: Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('form.category')}</Label>
              <Select value={formState.categoryId} onValueChange={(v) => updateField('categoryId', v)}>
                <SelectTrigger className="h-10">
                  <div className="flex items-center">
                    <Tag className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder={t('form.selectCategory')} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('form.noCategory')}</SelectItem>
                  {categories.map((category: TaskCategory) => (
                    <SelectItem key={category.id} value={category.id!.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: category.color || '#6b7280' }}
                        />
                        <span>{translateCategoryName(category.name)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('form.priority')}</Label>
              <Select
                value={formState.priority}
                onValueChange={(v) => updateField('priority', v as 'low' | 'medium' | 'high')}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span>{t('priority.low')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <span>{t('priority.medium')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span>{t('priority.high')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Assigned User & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('form.assignedTo')}</Label>
              <Select value={formState.assignedUserId} onValueChange={(v) => updateField('assignedUserId', v)}>
                <SelectTrigger className="h-10">
                  <div className="flex items-center">
                    <User className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder={t('form.selectUser')} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{tCommon('notAssigned')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id!.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: user.color }}
                        />
                        <span>{user.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('form.dueDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal",
                      !formState.dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                    {formState.dueDate ? format(formState.dueDate, "PPP") : <span>{t('form.pickDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formState.dueDate}
                    onSelect={(date) => updateField('dueDate', date)}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Row 3: Estimated Time */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('form.estimatedTime')}</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={formState.estimatedHours}
                  onChange={(e) => updateField('estimatedHours', e.target.value)}
                  placeholder="0"
                  className="w-16 h-10 text-center"
                />
                <span className="text-sm text-gray-500">{t('form.hours')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={formState.estimatedMinutes}
                  onChange={(e) => updateField('estimatedMinutes', e.target.value)}
                  placeholder="0"
                  className="w-16 h-10 text-center"
                />
                <span className="text-sm text-gray-500">{t('form.minutes')}</span>
              </div>
            </div>
          </div>

          {/* Row 4: Project & Blocker */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('form.linkedProject')}</Label>
              <Select value={formState.linkedProjectId} onValueChange={(v) => updateField('linkedProjectId', v)}>
                <SelectTrigger className="h-10">
                  <div className="flex items-center">
                    <FolderKanban className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder={t('form.selectProject')} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('form.noProject')}</SelectItem>
                  {projects.map((project: HomeImprovement) => (
                    <SelectItem key={project.id} value={project.id!.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{project.title}</span>
                        <span className="text-xs text-gray-400">({project.status})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('form.blockedBy')}</Label>
              <Select value={formState.blockedByTaskId} onValueChange={(v) => updateField('blockedByTaskId', v)}>
                <SelectTrigger className="h-10">
                  <div className="flex items-center">
                    <AlertTriangle className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder={t('form.selectBlocker')} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('form.noBlocker')}</SelectItem>
                  {blockerOptions.map((blockerTask: Task) => (
                    <SelectItem key={blockerTask.id} value={blockerTask.id!.toString()}>
                      {blockerTask.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!formState.title.trim() || isSubmitting}
            >
              {isSubmitting
                ? (isEditing ? t('form.updating') : t('form.creating'))
                : (isEditing ? t('form.updateTask') : t('form.createTask'))
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Re-export with legacy names for backward compatibility
export { TaskFormDialog as AddTaskDialog }
export { TaskFormDialog as EditTaskDialog }
