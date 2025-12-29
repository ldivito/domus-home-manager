'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, Info } from "lucide-react"
import { db, User as UserType, Task, TaskCategory, HomeImprovement } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface ImportTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: UserType[]
  categories: TaskCategory[]
  projects: HomeImprovement[]
  existingTasks: Task[]
}

interface ParsedTask {
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  categoryName?: string
  assignedUserName?: string
  dueDate?: string
  linkedProjectName?: string
  estimatedHours?: number
  estimatedMinutes?: number
  blockedByTaskTitle?: string
  isCompleted?: boolean
}

interface ImportError {
  row: number
  field: string
  message: string
}

export function ImportTasksDialog({
  open,
  onOpenChange,
  users,
  categories,
  projects,
  existingTasks
}: ImportTasksDialogProps) {
  const t = useTranslations('tasks')
  const tCommon = useTranslations('common')
  const tCat = useTranslations('tasks.defaultTaskCategories')

  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
  const [errors, setErrors] = useState<ImportError[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importComplete, setImportComplete] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const generateExampleCSV = () => {
    const headers = [
      'title',
      'description',
      'priority',
      'category',
      'assignedTo',
      'dueDate',
      'linkedProject',
      'estimatedHours',
      'estimatedMinutes',
      'blockedByTask',
      'isCompleted'
    ]

    const categoryNames = categories.map(c => translateCategoryName(c.name))
    const userNames = users.map(u => u.name)
    const projectNames = projects.map(p => p.title)
    const taskTitles = existingTasks.map(t => t.title)

    const exampleRows = [
      [
        'Buy groceries',
        'Get milk, eggs, and bread from the store',
        'high',
        categoryNames[0] || 'Personal',
        userNames[0] || '',
        '2024-12-15',
        projectNames[0] || '',
        '1',
        '30',
        '',
        'false'
      ],
      [
        'Schedule dentist appointment',
        'Annual checkup',
        'medium',
        categoryNames.find(c => c.toLowerCase().includes('health')) || categoryNames[0] || 'Health',
        userNames[0] || '',
        '2024-12-20',
        '',
        '0',
        '15',
        '',
        'false'
      ],
      [
        'Pay utility bills',
        'Electric and water bills',
        'high',
        categoryNames.find(c => c.toLowerCase().includes('finance')) || categoryNames[0] || 'Finance',
        '',
        '2024-12-10',
        '',
        '0',
        '30',
        '',
        'false'
      ]
    ]

    const comments = [
      '# Task Import Template',
      '# ',
      '# Instructions:',
      '# - Fill in the rows below with your tasks',
      '# - Required fields: title, priority',
      '# - priority: must be "low", "medium", or "high"',
      '# - dueDate: format YYYY-MM-DD (e.g., 2024-12-31)',
      '# - isCompleted: "true" or "false"',
      '# - estimatedHours/Minutes: numbers only',
      '# ',
      `# Available categories: ${categoryNames.join(', ') || 'Personal, Work, Home, Shopping, Health, Finance, Errands, Other'}`,
      `# Available users: ${userNames.join(', ') || 'No users configured'}`,
      `# Available projects: ${projectNames.join(', ') || 'No projects configured'}`,
      `# Existing tasks (for blockedByTask): ${taskTitles.slice(0, 5).join(', ')}${taskTitles.length > 5 ? '...' : ''}`,
      '#'
    ]

    const csvContent = [
      ...comments,
      headers.join(','),
      ...exampleRows.map(row => row.map(cell => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(','))
    ].join('\n')

    return csvContent
  }

  const handleDownloadExample = () => {
    const csvContent = generateExampleCSV()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'tasks_import_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const parseCSV = (content: string): string[][] => {
    const rows: string[][] = []
    let currentRow: string[] = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      const nextChar = content[i + 1]

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentCell += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          currentCell += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          currentRow.push(currentCell.trim())
          currentCell = ''
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentCell.trim())
          if (currentRow.some(cell => cell !== '')) {
            rows.push(currentRow)
          }
          currentRow = []
          currentCell = ''
          if (char === '\r') i++
        } else if (char !== '\r') {
          currentCell += char
        }
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim())
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow)
      }
    }

    return rows
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setErrors([])
    setParsedTasks([])
    setImportComplete(false)

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const rows = parseCSV(content)

      // Filter out comment lines
      const dataRows = rows.filter(row => !row[0]?.startsWith('#'))

      if (dataRows.length < 2) {
        setErrors([{ row: 0, field: 'file', message: t('import.errors.noDataRows') }])
        return
      }

      const headers = dataRows[0].map(h => h.toLowerCase().trim())
      const titleIndex = headers.indexOf('title')
      const descriptionIndex = headers.indexOf('description')
      const priorityIndex = headers.indexOf('priority')
      const categoryIndex = headers.indexOf('category')
      const assignedToIndex = headers.indexOf('assignedto')
      const dueDateIndex = headers.indexOf('duedate')
      const linkedProjectIndex = headers.indexOf('linkedproject')
      const estimatedHoursIndex = headers.indexOf('estimatedhours')
      const estimatedMinutesIndex = headers.indexOf('estimatedminutes')
      const blockedByTaskIndex = headers.indexOf('blockedbytask')
      const isCompletedIndex = headers.indexOf('iscompleted')

      if (titleIndex === -1) {
        setErrors([{ row: 1, field: 'title', message: t('import.errors.missingTitleColumn') }])
        return
      }

      const parsed: ParsedTask[] = []
      const parseErrors: ImportError[] = []

      for (let i = 1; i < dataRows.length; i++) {
        const row = dataRows[i]
        const rowNum = i + 1

        const title = row[titleIndex]?.trim()
        if (!title) {
          parseErrors.push({ row: rowNum, field: 'title', message: t('import.errors.emptyTitle') })
          continue
        }

        const priorityValue = row[priorityIndex]?.toLowerCase().trim() || 'medium'
        if (!['low', 'medium', 'high'].includes(priorityValue)) {
          parseErrors.push({ row: rowNum, field: 'priority', message: t('import.errors.invalidPriority') })
          continue
        }

        const dueDateStr = dueDateIndex !== -1 ? row[dueDateIndex]?.trim() : undefined
        if (dueDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
          parseErrors.push({ row: rowNum, field: 'dueDate', message: t('import.errors.invalidDateFormat') })
        }

        const estimatedHoursStr = estimatedHoursIndex !== -1 ? row[estimatedHoursIndex]?.trim() : undefined
        const estimatedMinutesStr = estimatedMinutesIndex !== -1 ? row[estimatedMinutesIndex]?.trim() : undefined

        let estimatedHours: number | undefined
        let estimatedMinutes: number | undefined

        if (estimatedHoursStr) {
          estimatedHours = parseInt(estimatedHoursStr)
          if (isNaN(estimatedHours) || estimatedHours < 0) {
            parseErrors.push({ row: rowNum, field: 'estimatedHours', message: t('import.errors.invalidNumber') })
            estimatedHours = undefined
          }
        }

        if (estimatedMinutesStr) {
          estimatedMinutes = parseInt(estimatedMinutesStr)
          if (isNaN(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 59) {
            parseErrors.push({ row: rowNum, field: 'estimatedMinutes', message: t('import.errors.invalidMinutes') })
            estimatedMinutes = undefined
          }
        }

        const isCompletedStr = isCompletedIndex !== -1 ? row[isCompletedIndex]?.toLowerCase().trim() : 'false'
        const isCompleted = isCompletedStr === 'true' || isCompletedStr === '1' || isCompletedStr === 'yes'

        parsed.push({
          title,
          description: descriptionIndex !== -1 ? row[descriptionIndex]?.trim() || undefined : undefined,
          priority: priorityValue as 'low' | 'medium' | 'high',
          categoryName: categoryIndex !== -1 ? row[categoryIndex]?.trim() || undefined : undefined,
          assignedUserName: assignedToIndex !== -1 ? row[assignedToIndex]?.trim() || undefined : undefined,
          dueDate: dueDateStr && /^\d{4}-\d{2}-\d{2}$/.test(dueDateStr) ? dueDateStr : undefined,
          linkedProjectName: linkedProjectIndex !== -1 ? row[linkedProjectIndex]?.trim() || undefined : undefined,
          estimatedHours,
          estimatedMinutes,
          blockedByTaskTitle: blockedByTaskIndex !== -1 ? row[blockedByTaskIndex]?.trim() || undefined : undefined,
          isCompleted
        })
      }

      setParsedTasks(parsed)
      setErrors(parseErrors)
    }

    reader.readAsText(file)
  }

  const findCategoryId = (categoryName?: string): string | undefined => {
    if (!categoryName) return undefined

    const normalizedName = categoryName.toLowerCase().trim()

    // Check exact match first
    let category = categories.find(c =>
      translateCategoryName(c.name).toLowerCase() === normalizedName ||
      c.name.toLowerCase() === normalizedName
    )

    // Check for partial match
    if (!category) {
      category = categories.find(c =>
        translateCategoryName(c.name).toLowerCase().includes(normalizedName) ||
        normalizedName.includes(translateCategoryName(c.name).toLowerCase())
      )
    }

    return category?.id
  }

  const findUserId = (userName?: string): string | undefined => {
    if (!userName) return undefined
    const normalizedName = userName.toLowerCase().trim()
    const user = users.find(u => u.name.toLowerCase() === normalizedName)
    return user?.id
  }

  const findProjectId = (projectName?: string): string | undefined => {
    if (!projectName) return undefined
    const normalizedName = projectName.toLowerCase().trim()
    const project = projects.find(p => p.title.toLowerCase() === normalizedName)
    return project?.id
  }

  const findBlockerTaskId = (taskTitle?: string): string | undefined => {
    if (!taskTitle) return undefined
    const normalizedTitle = taskTitle.toLowerCase().trim()
    const task = existingTasks.find(t => t.title.toLowerCase() === normalizedTitle)
    return task?.id
  }

  const handleImport = async () => {
    if (parsedTasks.length === 0) return

    setIsImporting(true)
    let successCount = 0

    try {
      const tasksToAdd: Task[] = []

      for (const parsed of parsedTasks) {
        const hasEstimatedTime = (parsed.estimatedHours && parsed.estimatedHours > 0) ||
                                 (parsed.estimatedMinutes && parsed.estimatedMinutes > 0)

        const task: Task = {
          id: generateId('tsk'),
          title: parsed.title,
          description: parsed.description,
          priority: parsed.priority,
          isCompleted: parsed.isCompleted || false,
          category: findCategoryId(parsed.categoryName),
          assignedUserId: findUserId(parsed.assignedUserName),
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
          linkedProjectId: findProjectId(parsed.linkedProjectName),
          estimatedTime: hasEstimatedTime ? {
            hours: parsed.estimatedHours || 0,
            minutes: parsed.estimatedMinutes || 0
          } : undefined,
          blockedByTaskId: findBlockerTaskId(parsed.blockedByTaskTitle),
          createdAt: new Date()
        }

        tasksToAdd.push(task)
      }

      await db.tasks.bulkAdd(tasksToAdd)
      successCount = tasksToAdd.length
      setImportedCount(successCount)
      setImportComplete(true)
      toast.success(t('import.success', { count: successCount }))
    } catch (error) {
      logger.error('Error importing tasks:', error)
      toast.error(t('import.error'))
    } finally {
      setIsImporting(false)
    }
  }

  const handleClose = () => {
    setParsedTasks([])
    setErrors([])
    setImportComplete(false)
    setImportedCount(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            {t('import.title')}
          </DialogTitle>
          <DialogDescription>
            {t('import.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Download Template Section */}
          <div className="space-y-2">
            <Label className="text-base font-medium">{t('import.downloadTemplate')}</Label>
            <p className="text-sm text-muted-foreground">{t('import.downloadTemplateDescription')}</p>
            <Button variant="outline" onClick={handleDownloadExample} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              {t('import.downloadExample')}
            </Button>
          </div>

          {/* Info about fields */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('import.fieldsInfo')}</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-2">
              <p><strong>title</strong> ({t('import.required')}): {t('import.fieldDescriptions.title')}</p>
              <p><strong>priority</strong>: low, medium, high ({t('import.defaultValue')}: medium)</p>
              <p><strong>category</strong>: {t('import.fieldDescriptions.category')}</p>
              <p><strong>assignedTo</strong>: {t('import.fieldDescriptions.assignedTo')}</p>
              <p><strong>dueDate</strong>: YYYY-MM-DD</p>
              <p><strong>linkedProject</strong>: {t('import.fieldDescriptions.linkedProject')}</p>
              <p><strong>estimatedHours/Minutes</strong>: {t('import.fieldDescriptions.estimatedTime')}</p>
              <p><strong>blockedByTask</strong>: {t('import.fieldDescriptions.blockedByTask')}</p>
              <p><strong>isCompleted</strong>: true/false</p>
            </AlertDescription>
          </Alert>

          {/* Upload Section */}
          <div className="space-y-2">
            <Label className="text-base font-medium">{t('import.uploadFile')}</Label>
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('import.dropOrClick')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('import.csvOnly')}</p>
              </label>
            </div>
          </div>

          {/* Parsing Results */}
          {parsedTasks.length > 0 && !importComplete && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-200">
                {t('import.parsedSuccess', { count: parsedTasks.length })}
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                {t('import.readyToImport')}
              </AlertDescription>
            </Alert>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('import.errorsFound', { count: errors.length })}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 text-sm max-h-32 overflow-y-auto">
                  {errors.slice(0, 10).map((error, index) => (
                    <li key={index}>
                      {t('import.errorRow', { row: error.row })}: {error.field} - {error.message}
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li className="text-muted-foreground">
                      {t('import.moreErrors', { count: errors.length - 10 })}
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Import Complete */}
          {importComplete && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-200">
                {t('import.complete')}
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                {t('import.importedCount', { count: importedCount })}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              {importComplete ? tCommon('close') : tCommon('cancel')}
            </Button>
            {!importComplete && parsedTasks.length > 0 && (
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? t('import.importing') : t('import.importTasks', { count: parsedTasks.length })}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
