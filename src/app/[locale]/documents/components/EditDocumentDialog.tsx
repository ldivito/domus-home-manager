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
import { Switch } from "@/components/ui/switch"
import { CalendarIcon, FileText } from "lucide-react"
import { format } from "date-fns"
import { db, User as UserType, Document, DocumentCategory } from '@/lib/db'
import { cn } from "@/lib/utils"
import { toast } from 'sonner'

interface EditDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document | null
  users: UserType[]
}

export function EditDocumentDialog({ open, onOpenChange, document, users }: EditDocumentDialogProps) {
  const t = useTranslations('documents')
  const tCommon = useTranslations('common')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('other')
  const [tags, setTags] = useState('')
  const [expirationDate, setExpirationDate] = useState<Date | undefined>()
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderDaysBefore, setReminderDaysBefore] = useState(30)
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>()
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseCurrency, setPurchaseCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [vendor, setVendor] = useState('')
  const [notes, setNotes] = useState('')
  const [uploadedByUserId, setUploadedByUserId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (document) {
      setName(document.name)
      setDescription(document.description || '')
      setCategory(document.category)
      setTags(document.tags?.join(', ') || '')
      setExpirationDate(document.expirationDate ? new Date(document.expirationDate) : undefined)
      setReminderEnabled(document.reminderEnabled)
      setReminderDaysBefore(document.reminderDaysBefore || 30)
      setPurchaseDate(document.purchaseDate ? new Date(document.purchaseDate) : undefined)
      setPurchasePrice(document.purchasePrice?.toString() || '')
      setPurchaseCurrency(document.purchaseCurrency || 'ARS')
      setVendor(document.vendor || '')
      setNotes(document.notes || '')
      setUploadedByUserId(document.uploadedByUserId || '')
    }
  }, [document])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!document?.id) return

    if (!name.trim()) {
      toast.error(t('messages.nameRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      await db.documents.update(document.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        expirationDate,
        reminderEnabled,
        reminderDaysBefore: reminderEnabled ? reminderDaysBefore : undefined,
        purchaseDate,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchaseCurrency: purchasePrice ? purchaseCurrency : undefined,
        vendor: vendor.trim() || undefined,
        notes: notes.trim() || undefined,
        uploadedByUserId: uploadedByUserId && uploadedByUserId !== 'none' ? uploadedByUserId : undefined,
        updatedAt: new Date()
      })

      toast.success(t('messages.updated'))
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating document:', error)
      toast.error(t('messages.updateError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!document) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('actions.edit')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Info (readonly) */}
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{document.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(document.fileSize)} &bull; {document.fileType}
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('form.name')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.namePlaceholder')}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">{t('form.category')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warranty">{t('categories.warranty')}</SelectItem>
                <SelectItem value="manual">{t('categories.manual')}</SelectItem>
                <SelectItem value="receipt">{t('categories.receipt')}</SelectItem>
                <SelectItem value="contract">{t('categories.contract')}</SelectItem>
                <SelectItem value="insurance">{t('categories.insurance')}</SelectItem>
                <SelectItem value="medical">{t('categories.medical')}</SelectItem>
                <SelectItem value="legal">{t('categories.legal')}</SelectItem>
                <SelectItem value="financial">{t('categories.financial')}</SelectItem>
                <SelectItem value="vehicle">{t('categories.vehicle')}</SelectItem>
                <SelectItem value="property">{t('categories.property')}</SelectItem>
                <SelectItem value="pet">{t('categories.pet')}</SelectItem>
                <SelectItem value="other">{t('categories.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('form.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">{t('form.tags')}</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('form.tagsPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('form.tagsHelp')}</p>
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label>{t('form.expirationDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate ? format(expirationDate, "PPP") : <span>{t('form.pickDate')}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reminder Toggle */}
          {expirationDate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="reminder">{t('form.enableReminder')}</Label>
                <Switch
                  id="reminder"
                  checked={reminderEnabled}
                  onCheckedChange={setReminderEnabled}
                />
              </div>
              {reminderEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="reminderDays">{t('form.reminderDays')}</Label>
                  <Input
                    id="reminderDays"
                    type="number"
                    min="1"
                    max="365"
                    value={reminderDaysBefore}
                    onChange={(e) => setReminderDaysBefore(parseInt(e.target.value) || 30)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Purchase Info */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">{t('form.purchaseInfo')}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.purchaseDate')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !purchaseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {purchaseDate ? format(purchaseDate, "PPP") : <span>{t('form.pickDate')}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={purchaseDate}
                      onSelect={setPurchaseDate}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor">{t('form.vendor')}</Label>
                <Input
                  id="vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder={t('form.vendorPlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">{t('form.price')}</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t('form.currency')}</Label>
                <Select value={purchaseCurrency} onValueChange={(v) => setPurchaseCurrency(v as 'ARS' | 'USD')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Uploaded By */}
          <div className="space-y-2">
            <Label>{t('form.uploadedBy')}</Label>
            <Select value={uploadedByUserId} onValueChange={setUploadedByUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('form.selectUser')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tCommon('notAssigned')}</SelectItem>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('form.notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('form.notesPlaceholder')}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? t('form.saving') : tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
