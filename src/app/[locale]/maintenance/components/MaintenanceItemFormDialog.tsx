'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db, MaintenanceItem, MaintenanceItemType } from '@/lib/db'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface MaintenanceItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: MaintenanceItem | null  // If provided, we're editing
}

interface ItemFormState {
  name: string
  description: string
  type: MaintenanceItemType
  location: string
  brand: string
  model: string
  serialNumber: string
  purchaseDate: string
  warrantyExpirationDate: string
  notes: string
}

const ITEM_TYPES: MaintenanceItemType[] = [
  'appliance', 'hvac', 'plumbing', 'electrical', 'vehicle',
  'roof', 'exterior', 'landscaping', 'pool', 'security', 'other'
]

const initialFormState: ItemFormState = {
  name: '',
  description: '',
  type: 'appliance',
  location: '',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  warrantyExpirationDate: '',
  notes: ''
}

export function MaintenanceItemFormDialog({ open, onOpenChange, item }: MaintenanceItemFormDialogProps) {
  const t = useTranslations('maintenance')
  const tCommon = useTranslations('common')

  const isEditing = !!item
  const [formData, setFormData] = useState<ItemFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (item) {
        // Edit mode - populate with item data
        setFormData({
          name: item.name,
          description: item.description || '',
          type: item.type,
          location: item.location || '',
          brand: item.brand || '',
          model: item.model || '',
          serialNumber: item.serialNumber || '',
          purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : '',
          warrantyExpirationDate: item.warrantyExpirationDate ? new Date(item.warrantyExpirationDate).toISOString().split('T')[0] : '',
          notes: item.notes || ''
        })
      } else {
        // Create mode - reset form
        setFormData(initialFormState)
      }
    }
  }, [open, item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }

    if (isEditing && !item?.id) return

    setIsSubmitting(true)
    try {
      const itemData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        location: formData.location.trim() || undefined,
        brand: formData.brand.trim() || undefined,
        model: formData.model.trim() || undefined,
        serialNumber: formData.serialNumber.trim() || undefined,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate) : undefined,
        warrantyExpirationDate: formData.warrantyExpirationDate ? new Date(formData.warrantyExpirationDate) : undefined,
        notes: formData.notes.trim() || undefined,
      }

      if (isEditing) {
        await db.maintenanceItems.update(item!.id!, {
          ...itemData,
          updatedAt: new Date()
        })
        toast.success(t('messages.itemUpdated'))
      } else {
        await db.maintenanceItems.add({
          id: `maint_${crypto.randomUUID()}`,
          ...itemData,
          createdAt: new Date()
        })
        toast.success(t('messages.itemAdded'))
      }

      setFormData(initialFormState)
      onOpenChange(false)
    } catch (error) {
      logger.error(`Error ${isEditing ? 'updating' : 'adding'} item:`, error)
      toast.error(isEditing ? t('messages.updateError') : t('messages.addError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing && !item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('dialogs.editItem.title') : t('dialogs.addItem.title')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="maint-name">{t('form.name')} *</Label>
              <Input
                id="maint-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-type">{t('form.type')}</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as MaintenanceItemType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`itemTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-location">{t('form.location')}</Label>
              <Input
                id="maint-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder={t('form.locationPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-brand">{t('form.brand')}</Label>
              <Input
                id="maint-brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder={t('form.brandPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-model">{t('form.model')}</Label>
              <Input
                id="maint-model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder={t('form.modelPlaceholder')}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="maint-serialNumber">{t('form.serialNumber')}</Label>
              <Input
                id="maint-serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder={t('form.serialNumberPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-purchaseDate">{t('form.purchaseDate')}</Label>
              <Input
                id="maint-purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-warrantyExpirationDate">{t('form.warrantyExpiration')}</Label>
              <Input
                id="maint-warrantyExpirationDate"
                type="date"
                value={formData.warrantyExpirationDate}
                onChange={(e) => setFormData({ ...formData, warrantyExpirationDate: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="maint-description">{t('form.description')}</Label>
              <Textarea
                id="maint-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="maint-notes">{t('form.notes')}</Label>
              <Textarea
                id="maint-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('form.notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Re-export with legacy names for backward compatibility
export { MaintenanceItemFormDialog as AddItemDialog }
export { MaintenanceItemFormDialog as EditItemDialog }
