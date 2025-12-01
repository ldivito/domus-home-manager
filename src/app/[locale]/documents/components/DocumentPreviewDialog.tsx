'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Calendar, Tag, DollarSign, FileText, AlertTriangle } from "lucide-react"
import { Document, DocumentCategory } from '@/lib/db'
import { toast } from 'sonner'

interface DocumentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document | null
}

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  warranty: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  manual: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  receipt: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  contract: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  insurance: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  medical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  legal: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  financial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  vehicle: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  property: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  pet: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

export function DocumentPreviewDialog({ open, onOpenChange, document }: DocumentPreviewDialogProps) {
  const t = useTranslations('documents')

  if (!document) return null

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isExpiringSoon = (expirationDate?: Date) => {
    if (!expirationDate) return false
    const daysUntilExpiration = Math.ceil((new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0
  }

  const isExpired = (expirationDate?: Date) => {
    if (!expirationDate) return false
    return new Date(expirationDate) < new Date()
  }

  const getDaysUntilExpiration = (expirationDate: Date) => {
    return Math.ceil((new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  const handleDownload = () => {
    if (!document.fileData) {
      toast.error(t('messages.noFileData'))
      return
    }

    try {
      const byteCharacters = atob(document.fileData.split(',')[1] || document.fileData)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: document.fileType })

      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.fileName
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(t('messages.downloaded'))
    } catch (error) {
      console.error('Error downloading document:', error)
      toast.error(t('messages.downloadError'))
    }
  }

  const isImage = document.fileType.startsWith('image/')
  const isPdf = document.fileType === 'application/pdf'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl">{document.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={CATEGORY_COLORS[document.category]}>
                  {t(`categories.${document.category}`)}
                </Badge>
                {isExpired(document.expirationDate) && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t('status.expired')}
                  </Badge>
                )}
                {isExpiringSoon(document.expirationDate) && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    {getDaysUntilExpiration(document.expirationDate!)} {t('status.daysLeft')}
                  </Badge>
                )}
              </div>
            </div>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              {t('actions.download')}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Preview */}
          {document.fileData && (
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              {isImage ? (
                <img
                  src={document.fileData}
                  alt={document.name}
                  className="max-w-full h-auto max-h-[400px] mx-auto object-contain"
                />
              ) : isPdf ? (
                <div className="h-[400px]">
                  <iframe
                    src={document.fileData}
                    className="w-full h-full"
                    title={document.name}
                  />
                </div>
              ) : (
                <div className="p-8 text-center">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('preview.noPreview')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{document.fileName}</p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {document.description && (
            <div>
              <h3 className="font-medium mb-2">{t('form.description')}</h3>
              <p className="text-muted-foreground">{document.description}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* File Info */}
            <div className="space-y-2">
              <h3 className="font-medium">{t('preview.fileInfo')}</h3>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium">{t('preview.fileName')}:</span> {document.fileName}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">{t('preview.fileSize')}:</span> {formatFileSize(document.fileSize)}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">{t('preview.fileType')}:</span> {document.fileType}
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('preview.dates')}
              </h3>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium">{t('preview.uploaded')}:</span> {new Date(document.createdAt).toLocaleDateString()}
                </p>
                {document.expirationDate && (
                  <p className={`${
                    isExpired(document.expirationDate)
                      ? 'text-red-600 dark:text-red-400'
                      : isExpiringSoon(document.expirationDate)
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-muted-foreground'
                  }`}>
                    <span className="font-medium">{t('form.expires')}:</span> {new Date(document.expirationDate).toLocaleDateString()}
                  </p>
                )}
                {document.purchaseDate && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">{t('form.purchaseDate')}:</span> {new Date(document.purchaseDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Purchase Info */}
          {(document.purchasePrice || document.vendor) && (
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t('form.purchaseInfo')}
              </h3>
              <div className="space-y-1 text-sm">
                {document.purchasePrice && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">{t('form.price')}:</span> {document.purchaseCurrency} {document.purchasePrice.toLocaleString()}
                  </p>
                )}
                {document.vendor && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">{t('form.vendor')}:</span> {document.vendor}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                {t('form.tags')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {document.notes && (
            <div className="space-y-2">
              <h3 className="font-medium">{t('form.notes')}</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{document.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
