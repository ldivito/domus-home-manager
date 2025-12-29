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
import { User } from "lucide-react"
import { db, User as UserType, HomeImprovement } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: UserType[]
}

export function AddProjectDialog({ open, onOpenChange, users }: AddProjectDialogProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedUserId, setAssignedUserId] = useState<string>('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [status, setStatus] = useState<'todo' | 'in-progress' | 'done'>('todo')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      return
    }

    setIsSubmitting(true)
    
    try {
      const project: HomeImprovement = {
        id: generateId('prj'),
        title: title.trim(),
        description: description.trim() || undefined,
        assignedUserId: assignedUserId && assignedUserId !== 'unassigned' ? assignedUserId : undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        priority,
        status,
        createdAt: new Date()
      }

      await db.homeImprovements.add(project)

      // Reset form
      setTitle('')
      setDescription('')
      setAssignedUserId('')
      setEstimatedCost('')
      setPriority('medium')
      setStatus('todo')
      
      onOpenChange(false)
    } catch (error) {
      logger.error('Error creating project:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setTitle('')
    setDescription('')
    setAssignedUserId('')
    setEstimatedCost('')
    setPriority('medium')
    setStatus('todo')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('addProject')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('form.name')} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('form.namePlaceholder')}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('form.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          {/* Assigned User */}
          <div className="space-y-2">
            <Label htmlFor="assignedUser">{t('form.assignedTo')}</Label>
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
            <Label htmlFor="priority">{t('form.priority')}</Label>
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
            <Label htmlFor="status">{t('form.status')}</Label>
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
            <Label htmlFor="estimatedCost">{t('form.estimatedCost')}</Label>
            <Input
              id="estimatedCost"
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
              {isSubmitting ? t('form.creating') : t('form.createProject')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}