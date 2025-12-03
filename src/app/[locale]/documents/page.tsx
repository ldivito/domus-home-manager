'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Plus, Search, Filter, Calendar, AlertTriangle, Download, Eye, Edit3, Trash2, Grid, List, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, Document, DocumentCategory, deleteWithSync } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddDocumentDialog } from './components/AddDocumentDialog'
import { EditDocumentDialog } from './components/EditDocumentDialog'
import { DocumentPreviewDialog } from './components/DocumentPreviewDialog'
import { toast } from 'sonner'

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

export default function DocumentsPage() {
  const t = useTranslations('documents')
  const tCommon = useTranslations('common')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [previewingDocument, setPreviewingDocument] = useState<Document | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const documents = useLiveQuery(
    () => db.documents.orderBy('createdAt').reverse().toArray(),
    []
  ) || []

  const users = useLiveQuery(
    () => db.users.toArray(),
    []
  ) || []

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteWithSync(db.documents, 'documents', documentId)
      toast.success(t('messages.deleted'))
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error(t('messages.deleteError'))
    }
  }

  const handleEditDocument = (document: Document) => {
    setEditingDocument(document)
    setEditDialogOpen(true)
  }

  const handlePreviewDocument = (document: Document) => {
    setPreviewingDocument(document)
    setPreviewDialogOpen(true)
  }

  const handleDownloadDocument = (document: Document) => {
    if (!document.fileData) {
      toast.error(t('messages.noFileData'))
      return
    }

    try {
      // Create blob from base64
      const byteCharacters = atob(document.fileData.split(',')[1] || document.fileData)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: document.fileType })

      // Create download link
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

  const isExpiringSoon = (expirationDate?: Date) => {
    if (!expirationDate) return false
    const daysUntilExpiration = Math.ceil((new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0
  }

  const isExpired = (expirationDate?: Date) => {
    if (!expirationDate) return false
    return new Date(expirationDate) < new Date()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  const expiringCount = documents.filter(d => isExpiringSoon(d.expirationDate)).length
  const expiredCount = documents.filter(d => isExpired(d.expirationDate)).length

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 md:mb-2">{t('title')}</h1>
            <p className="text-base md:text-xl text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <Button size="lg" className="h-12 md:h-14 px-4 md:px-8 text-base md:text-lg w-full sm:w-auto" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-5 w-5 md:h-6 md:w-6" />
            {t('actions.upload')}
          </Button>
        </div>

        {/* Stats */}
        {(expiringCount > 0 || expiredCount > 0) && (
          <div className="mb-4 md:mb-6 flex flex-wrap gap-2 md:gap-4">
            {expiredCount > 0 && (
              <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 dark:text-red-400" />
                <span className="text-xs md:text-sm font-medium text-red-800 dark:text-red-200">
                  {expiredCount} {t('status.expired')}
                </span>
              </div>
            )}
            {expiringCount > 0 && (
              <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs md:text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {expiringCount} {t('status.expiringSoon')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-4 md:mb-6 space-y-3 md:space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-10 h-10 md:h-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="flex-1 sm:w-48 h-10">
                  <Filter className="mr-2 h-4 w-4 shrink-0" />
                  <SelectValue placeholder={t('filters.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon('all')}</SelectItem>
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

              <div className="flex border rounded-md shrink-0">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Documents */}
        {filteredDocuments.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                {documents.length === 0 ? (
                  <>
                    <FileText className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">{t('empty.title')}</p>
                    <p className="text-sm">{t('empty.description')}</p>
                  </>
                ) : (
                  <>
                    <Search className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">{t('noDocumentsFound')}</p>
                    <p className="text-sm">{t('tryDifferentFilter')}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredDocuments.map((document) => (
              <Card
                key={document.id}
                className={`transition-all hover:shadow-lg cursor-pointer ${
                  isExpired(document.expirationDate)
                    ? 'border-red-300 dark:border-red-700'
                    : isExpiringSoon(document.expirationDate)
                      ? 'border-yellow-300 dark:border-yellow-700'
                      : ''
                }`}
                onClick={() => handlePreviewDocument(document)}
              >
                <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base md:text-lg truncate">{document.name}</CardTitle>
                      {document.description && (
                        <CardDescription className="mt-1 line-clamp-2 text-sm">{document.description}</CardDescription>
                      )}
                    </div>
                    <Badge className={`${CATEGORY_COLORS[document.category]} text-xs shrink-0`}>
                      {t(`categories.${document.category}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex items-center text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      <FileText className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{document.fileName}</span>
                      <span className="ml-auto shrink-0">{formatFileSize(document.fileSize)}</span>
                    </div>

                    {document.expirationDate && (
                      <div className={`flex items-center text-xs md:text-sm ${
                        isExpired(document.expirationDate)
                          ? 'text-red-600 dark:text-red-400'
                          : isExpiringSoon(document.expirationDate)
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <Calendar className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {isExpired(document.expirationDate)
                            ? t('status.expired')
                            : t('form.expires')}: {new Date(document.expirationDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {document.tags && document.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Tag className="h-3 w-3 text-gray-400 shrink-0" />
                        {document.tags.slice(0, 3).map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {document.tags.length > 3 && (
                          <span className="text-xs text-gray-400">+{document.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-1 md:gap-2 mt-3 md:mt-4 pt-3 border-t" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handlePreviewDocument(document)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handleDownloadDocument(document)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handleEditDocument(document)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handleDeleteDocument(document.id!)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((document) => (
              <Card
                key={document.id}
                className={`transition-all hover:shadow-md cursor-pointer ${
                  isExpired(document.expirationDate)
                    ? 'border-red-300 dark:border-red-700'
                    : isExpiringSoon(document.expirationDate)
                      ? 'border-yellow-300 dark:border-yellow-700'
                      : ''
                }`}
                onClick={() => handlePreviewDocument(document)}
              >
                <CardContent className="p-3 md:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-sm md:text-base truncate">{document.name}</h3>
                          <Badge className={`${CATEGORY_COLORS[document.category]} text-xs shrink-0`}>
                            {t(`categories.${document.category}`)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          <span className="truncate max-w-[150px] md:max-w-none">{document.fileName}</span>
                          <span className="shrink-0">{formatFileSize(document.fileSize)}</span>
                          {document.expirationDate && (
                            <span className={`shrink-0 ${
                              isExpired(document.expirationDate)
                                ? 'text-red-600 dark:text-red-400'
                                : isExpiringSoon(document.expirationDate)
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : ''
                            }`}>
                              {isExpired(document.expirationDate) ? t('status.expired') : t('form.expires')}: {new Date(document.expirationDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 md:gap-2 justify-end sm:justify-start shrink-0" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handlePreviewDocument(document)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handleDownloadDocument(document)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handleEditDocument(document)}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9 w-9 md:h-8 md:w-8 p-0" onClick={() => handleDeleteDocument(document.id!)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AddDocumentDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          users={users}
        />

        <EditDocumentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          document={editingDocument}
          users={users}
        />

        <DocumentPreviewDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          document={previewingDocument}
        />
      </div>
    </div>
  )
}
