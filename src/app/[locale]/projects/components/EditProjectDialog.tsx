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
import { logger } from '@/lib/logger'

interface EditProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: HomeImprovement | null
  users: UserType[]
}

export function EditProjectDialog({ open, onOpenChange, project, users }: EditProjectDialogProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedUserId, setAssignedUserId] = useState<string>('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [status, setStatus] = useState<'todo' | 'in-progress' | 'done'>('todo')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-fill form when project changes
  useEffect(() => {
    if (project && open) {
      setTitle(project.title)
      setDescription(project.description || '')
      setAssignedUserId(project.assignedUserId ? project.assignedUserId.toString() : 'unassigned')
      setEstimatedCost(project.estimatedCost ? project.estimatedCost.toString() : '')
      setPriority(project.priority)
      setStatus(project.status)
    }
  }, [project, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !project?.id) {
      return
    }

    setIsSubmitting(true)
    
    try {
      await db.homeImprovements.update(project.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedUserId: assignedUserId && assignedUserId !== 'unassigned' ? assignedUserId : undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        priority,
        status,
        updatedAt: new Date()
      })

      onOpenChange(false)
    } catch (error) {
      logger.error('Error updating project:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  if (!project) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('editProject')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">{t('form.name')} *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('form.namePlaceholder')}
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
                    {user.name}
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

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="edit-status">{t('form.status')}</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as 'todo' | 'in-progress' | 'done')}>
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
            <Label htmlFor="edit-estimatedCost">{t('form.estimatedCost')}</Label>
            <Input
              id="edit-estimatedCost"
              type="number"
              step="0.01"
              min="0"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
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
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? t('form.updating') : t('form.updateProject')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}