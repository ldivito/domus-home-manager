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

interface EditItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MaintenanceItem | null
}

const ITEM_TYPES: MaintenanceItemType[] = [
  'appliance', 'hvac', 'plumbing', 'electrical', 'vehicle',
  'roof', 'exterior', 'landscaping', 'pool', 'security', 'other'
]

export function EditItemDialog({ open, onOpenChange, item }: EditItemDialogProps) {
  const t = useTranslations('maintenance')
  const tCommon = useTranslations('common')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'appliance' as MaintenanceItemType,
    location: '',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyExpirationDate: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (item) {
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
    }
  }, [item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item?.id) return
    if (!formData.name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      await db.maintenanceItems.update(item.id, {
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
        updatedAt: new Date()
      })

      toast.success(t('messages.itemUpdated'))
      onOpenChange(false)
    } catch (error) {
      logger.error('Error updating item:', error)
      toast.error(t('messages.updateError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dialogs.editItem.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">{t('form.name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t('form.type')}</Label>
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
              <Label htmlFor="location">{t('form.location')}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder={t('form.locationPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">{t('form.brand')}</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder={t('form.brandPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">{t('form.model')}</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder={t('form.modelPlaceholder')}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="serialNumber">{t('form.serialNumber')}</Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder={t('form.serialNumberPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate">{t('form.purchaseDate')}</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warrantyExpirationDate">{t('form.warrantyExpiration')}</Label>
              <Input
                id="warrantyExpirationDate"
                type="date"
                value={formData.warrantyExpirationDate}
                onChange={(e) => setFormData({ ...formData, warrantyExpirationDate: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">{t('form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">{t('form.notes')}</Label>
              <Textarea
                id="notes"
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
