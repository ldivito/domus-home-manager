'use client'

import { useState } from 'react'
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

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: UserType[]
  categories: TaskCategory[]
}

export function AddTaskDialog({ open, onOpenChange, users, categories }: AddTaskDialogProps) {
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

  // Fetch projects and tasks for dropdowns
  const projects = useLiveQuery(
    () => db.homeImprovements.where('status').notEqual('done').toArray(),
    []
  ) || []

  const existingTasks = useLiveQuery(
    () => db.tasks.where('isCompleted').equals(0).toArray(),
    []
  ) || []

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      const hours = estimatedHours ? parseInt(estimatedHours) : 0
      const minutes = estimatedMinutes ? parseInt(estimatedMinutes) : 0
      const hasEstimatedTime = hours > 0 || minutes > 0

      const task: Task = {
        id: generateId('tsk'),
        title: title.trim(),
        description: description.trim() || undefined,
        assignedUserId: assignedUserId && assignedUserId !== 'unassigned' ? assignedUserId : undefined,
        dueDate: dueDate,
        priority,
        isCompleted: false,
        category: categoryId && categoryId !== 'none' ? categoryId : undefined,
        linkedProjectId: linkedProjectId && linkedProjectId !== 'none' ? linkedProjectId : undefined,
        estimatedTime: hasEstimatedTime ? { hours, minutes } : undefined,
        blockedByTaskId: blockedByTaskId && blockedByTaskId !== 'none' ? blockedByTaskId : undefined,
        createdAt: new Date()
      }

      await db.tasks.add(task)

      // Reset form
      setTitle('')
      setDescription('')
      setAssignedUserId('')
      setDueDate(undefined)
      setPriority('medium')
      setCategoryId('')
      setLinkedProjectId('')
      setEstimatedHours('')
      setEstimatedMinutes('')
      setBlockedByTaskId('')
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setTitle('')
    setDescription('')
    setAssignedUserId('')
    setDueDate(undefined)
    setPriority('medium')
    setCategoryId('')
    setLinkedProjectId('')
    setEstimatedHours('')
    setEstimatedMinutes('')
    setBlockedByTaskId('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">{t('addTask')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          {/* Title - Full width */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium">{t('form.title')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('form.titlePlaceholder')}
              className="h-10"
              required
            />
          </div>

          {/* Description - Full width */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium">{t('form.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Row 1: Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('form.category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
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
              <Select value={priority} onValueChange={(value) => setPriority(value as 'low' | 'medium' | 'high')}>
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
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
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
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
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
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
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
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
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
              <Select value={linkedProjectId} onValueChange={setLinkedProjectId}>
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
              <Select value={blockedByTaskId} onValueChange={setBlockedByTaskId}>
                <SelectTrigger className="h-10">
                  <div className="flex items-center">
                    <AlertTriangle className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder={t('form.selectBlocker')} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('form.noBlocker')}</SelectItem>
                  {existingTasks.map((task: Task) => (
                    <SelectItem key={task.id} value={task.id!.toString()}>
                      {task.title}
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
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? t('form.creating') : t('form.createTask')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
