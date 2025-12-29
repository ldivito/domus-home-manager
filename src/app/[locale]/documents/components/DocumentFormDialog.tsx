'use client'

import { useState, useEffect, useRef } from 'react'
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
import { CalendarIcon, Upload, X, FileText } from "lucide-react"
import { format } from "date-fns"
import { db, User as UserType, Document, DocumentCategory } from '@/lib/db'
import { generateId, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document?: Document | null  // If provided, we're editing
  users: UserType[]
}

interface DocumentFormState {
  name: string
  description: string
  category: DocumentCategory
  tags: string
  expirationDate: Date | undefined
  reminderEnabled: boolean
  reminderDaysBefore: number
  purchaseDate: Date | undefined
  purchasePrice: string
  purchaseCurrency: 'ARS' | 'USD'
  vendor: string
  notes: string
  uploadedByUserId: string
}

const initialFormState: DocumentFormState = {
  name: '',
  description: '',
  category: 'other',
  tags: '',
  expirationDate: undefined,
  reminderEnabled: false,
  reminderDaysBefore: 30,
  purchaseDate: undefined,
  purchasePrice: '',
  purchaseCurrency: 'ARS',
  vendor: '',
  notes: '',
  uploadedByUserId: ''
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function DocumentFormDialog({ open, onOpenChange, document, users }: DocumentFormDialogProps) {
  const t = useTranslations('documents')
  const tCommon = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditing = !!document
  const [formState, setFormState] = useState<DocumentFormState>(initialFormState)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileData, setFileData] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      if (document) {
        // Edit mode - populate with document data
        setFormState({
          name: document.name,
          description: document.description || '',
          category: document.category,
          tags: document.tags?.join(', ') || '',
          expirationDate: document.expirationDate ? new Date(document.expirationDate) : undefined,
          reminderEnabled: document.reminderEnabled,
          reminderDaysBefore: document.reminderDaysBefore || 30,
          purchaseDate: document.purchaseDate ? new Date(document.purchaseDate) : undefined,
          purchasePrice: document.purchasePrice?.toString() || '',
          purchaseCurrency: document.purchaseCurrency || 'ARS',
          vendor: document.vendor || '',
          notes: document.notes || '',
          uploadedByUserId: document.uploadedByUserId || ''
        })
      } else {
        // Create mode - reset form
        setFormState(initialFormState)
        setSelectedFile(null)
        setFileData('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }, [open, document])

  const updateField = <K extends keyof DocumentFormState>(field: K, value: DocumentFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('messages.fileTooLarge'))
      return
    }

    setSelectedFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setFileData(result)
    }
    reader.onerror = () => {
      toast.error(t('messages.fileReadError'))
    }
    reader.readAsDataURL(file)

    // Auto-fill name if empty
    if (!formState.name) {
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      updateField('name', fileName)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileData('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formState.name.trim()) {
      toast.error(t('messages.nameRequired'))
      return
    }

    if (!isEditing && (!selectedFile || !fileData)) {
      toast.error(t('messages.fileRequired'))
      return
    }

    if (isEditing && !document?.id) return

    setIsSubmitting(true)

    try {
      const documentData = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        category: formState.category,
        tags: formState.tags.trim() ? formState.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        expirationDate: formState.expirationDate,
        reminderEnabled: formState.reminderEnabled,
        reminderDaysBefore: formState.reminderEnabled ? formState.reminderDaysBefore : undefined,
        purchaseDate: formState.purchaseDate,
        purchasePrice: formState.purchasePrice ? parseFloat(formState.purchasePrice) : undefined,
        purchaseCurrency: formState.purchasePrice ? formState.purchaseCurrency : undefined,
        vendor: formState.vendor.trim() || undefined,
        notes: formState.notes.trim() || undefined,
        uploadedByUserId: formState.uploadedByUserId && formState.uploadedByUserId !== 'none' ? formState.uploadedByUserId : undefined,
      }

      if (isEditing) {
        await db.documents.update(document!.id!, {
          ...documentData,
          updatedAt: new Date()
        })
        toast.success(t('messages.updated'))
      } else {
        const newDocument: Document = {
          id: generateId('doc'),
          ...documentData,
          fileType: selectedFile!.type,
          fileName: selectedFile!.name,
          fileSize: selectedFile!.size,
          fileData,
          createdAt: new Date()
        }
        await db.documents.add(newDocument)
        toast.success(t('messages.uploaded'))
      }

      // Reset form
      setFormState(initialFormState)
      setSelectedFile(null)
      setFileData('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onOpenChange(false)
    } catch (error) {
      logger.error(`Error ${isEditing ? 'updating' : 'uploading'} document:`, error)
      toast.error(isEditing ? t('messages.updateError') : t('messages.uploadError'))
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

  const handleCancel = () => {
    setFormState(initialFormState)
    setSelectedFile(null)
    setFileData('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  if (isEditing && !document) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditing ? t('actions.edit') : t('actions.upload')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload / File Info */}
          {isEditing && document ? (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{document.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(document.fileSize)} &bull; {document.fileType}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('form.file')} *</Label>
              {selectedFile ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('form.dropOrClick')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('form.maxSize')}</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
              />
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="doc-name">{t('form.name')} *</Label>
            <Input
              id="doc-name"
              value={formState.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('form.namePlaceholder')}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="doc-category">{t('form.category')}</Label>
            <Select value={formState.category} onValueChange={(v) => updateField('category', v as DocumentCategory)}>
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
            <Label htmlFor="doc-description">{t('form.description')}</Label>
            <Textarea
              id="doc-description"
              value={formState.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t('form.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="doc-tags">{t('form.tags')}</Label>
            <Input
              id="doc-tags"
              value={formState.tags}
              onChange={(e) => updateField('tags', e.target.value)}
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
                    !formState.expirationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formState.expirationDate ? format(formState.expirationDate, "PPP") : <span>{t('form.pickDate')}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formState.expirationDate}
                  onSelect={(date) => updateField('expirationDate', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reminder Toggle */}
          {formState.expirationDate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="doc-reminder">{t('form.enableReminder')}</Label>
                <Switch
                  id="doc-reminder"
                  checked={formState.reminderEnabled}
                  onCheckedChange={(v) => updateField('reminderEnabled', v)}
                />
              </div>
              {formState.reminderEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="doc-reminderDays">{t('form.reminderDays')}</Label>
                  <Input
                    id="doc-reminderDays"
                    type="number"
                    min="1"
                    max="365"
                    value={formState.reminderDaysBefore}
                    onChange={(e) => updateField('reminderDaysBefore', parseInt(e.target.value) || 30)}
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
                        !formState.purchaseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formState.purchaseDate ? format(formState.purchaseDate, "PPP") : <span>{t('form.pickDate')}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formState.purchaseDate}
                      onSelect={(date) => updateField('purchaseDate', date)}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-vendor">{t('form.vendor')}</Label>
                <Input
                  id="doc-vendor"
                  value={formState.vendor}
                  onChange={(e) => updateField('vendor', e.target.value)}
                  placeholder={t('form.vendorPlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doc-price">{t('form.price')}</Label>
                <Input
                  id="doc-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.purchasePrice}
                  onChange={(e) => updateField('purchasePrice', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-currency">{t('form.currency')}</Label>
                <Select value={formState.purchaseCurrency} onValueChange={(v) => updateField('purchaseCurrency', v as 'ARS' | 'USD')}>
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
            <Select value={formState.uploadedByUserId} onValueChange={(v) => updateField('uploadedByUserId', v)}>
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
            <Label htmlFor="doc-notes">{t('form.notes')}</Label>
            <Textarea
              id="doc-notes"
              value={formState.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder={t('form.notesPlaceholder')}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!formState.name.trim() || (!isEditing && !selectedFile) || isSubmitting}
            >
              {isSubmitting
                ? (isEditing ? t('form.saving') : t('form.uploading'))
                : (isEditing ? tCommon('save') : t('actions.upload'))
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Re-export with legacy names for backward compatibility
export { DocumentFormDialog as AddDocumentDialog }
export { DocumentFormDialog as EditDocumentDialog }
