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
import { User } from "lucide-react"
import { db, User as UserType, HomeImprovement } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: HomeImprovement | null  // If provided, we're editing
  users: UserType[]
}

interface ProjectFormState {
  title: string
  description: string
  assignedUserId: string
  estimatedCost: string
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in-progress' | 'done'
}

const initialFormState: ProjectFormState = {
  title: '',
  description: '',
  assignedUserId: 'unassigned',
  estimatedCost: '',
  priority: 'medium',
  status: 'todo'
}

export function ProjectFormDialog({ open, onOpenChange, project, users }: ProjectFormDialogProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')

  const isEditing = !!project
  const [formState, setFormState] = useState<ProjectFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (project) {
        // Edit mode - populate with project data
        setFormState({
          title: project.title,
          description: project.description || '',
          assignedUserId: project.assignedUserId ? project.assignedUserId.toString() : 'unassigned',
          estimatedCost: project.estimatedCost ? project.estimatedCost.toString() : '',
          priority: project.priority,
          status: project.status
        })
      } else {
        // Create mode - reset form
        setFormState(initialFormState)
      }
    }
  }, [open, project])

  const updateField = <K extends keyof ProjectFormState>(field: K, value: ProjectFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formState.title.trim()) return
    if (isEditing && !project?.id) return

    setIsSubmitting(true)

    try {
      const projectData = {
        title: formState.title.trim(),
        description: formState.description.trim() || undefined,
        assignedUserId: formState.assignedUserId && formState.assignedUserId !== 'unassigned' ? formState.assignedUserId : undefined,
        estimatedCost: formState.estimatedCost ? parseFloat(formState.estimatedCost) : undefined,
        priority: formState.priority,
        status: formState.status,
      }

      if (isEditing) {
        await db.homeImprovements.update(project!.id!, {
          ...projectData,
          updatedAt: new Date()
        })
      } else {
        const newProject: HomeImprovement = {
          id: generateId('prj'),
          ...projectData,
          createdAt: new Date()
        }
        await db.homeImprovements.add(newProject)
      }

      setFormState(initialFormState)
      onOpenChange(false)
    } catch (error) {
      logger.error(`Error ${isEditing ? 'updating' : 'creating'} project:`, error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setFormState(initialFormState)
    onOpenChange(false)
  }

  if (isEditing && !project) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditing ? t('editProject') : t('addProject')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="prj-title">{t('form.name')} *</Label>
            <Input
              id="prj-title"
              value={formState.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('form.namePlaceholder')}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="prj-description">{t('form.description')}</Label>
            <Textarea
              id="prj-description"
              value={formState.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          {/* Assigned User */}
          <div className="space-y-2">
            <Label htmlFor="prj-assignedUser">{t('form.assignedTo')}</Label>
            <Select value={formState.assignedUserId} onValueChange={(v) => updateField('assignedUserId', v)}>
              <SelectTrigger>
                <User className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('form.selectUser')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{tCommon('notAssigned')}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id!.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="prj-priority">{t('form.priority')}</Label>
            <Select value={formState.priority} onValueChange={(v) => updateField('priority', v as ProjectFormState['priority'])}>
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

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="prj-status">{t('form.status')}</Label>
            <Select value={formState.status} onValueChange={(v) => updateField('status', v as ProjectFormState['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">{t('status.todo')}</SelectItem>
                <SelectItem value="in-progress">{t('status.inProgress')}</SelectItem>
                <SelectItem value="done">{t('status.done')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estimated Cost */}
          <div className="space-y-2">
            <Label htmlFor="prj-estimatedCost">{t('form.estimatedCost')}</Label>
            <Input
              id="prj-estimatedCost"
              type="number"
              step="0.01"
              min="0"
              value={formState.estimatedCost}
              onChange={(e) => updateField('estimatedCost', e.target.value)}
              placeholder={t('form.costPlaceholder')}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!formState.title.trim() || isSubmitting}
            >
              {isSubmitting
                ? (isEditing ? t('form.updating') : t('form.creating'))
                : (isEditing ? t('form.updateProject') : t('form.createProject'))
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Re-export with legacy names for backward compatibility
export { ProjectFormDialog as AddProjectDialog }
export { ProjectFormDialog as EditProjectDialog }
