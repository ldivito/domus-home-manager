'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/finance'
import { PersonalTransaction, PersonalWallet, PersonalCategory } from '@/types/personal-finance'
import { toast } from 'sonner'

type ExportFormat = 'csv' | 'json'
type TimeRange = 'last7days' | 'last30days' | 'last3months' | 'last6months' | 'currentyear' | 'lastyear'

interface DataExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactions: (PersonalTransaction & {
    wallet?: PersonalWallet
    category?: PersonalCategory
  })[]
  timeRange: TimeRange
  currency: 'ARS' | 'USD' | 'ALL'
}

interface ExportOptions {
  format: ExportFormat
  includeTransactions: boolean
  includeWallets: boolean
  includeCategories: boolean
  includeSummary: boolean
}

export default function DataExportDialog({
  open,
  onOpenChange,
  transactions,
  timeRange,
  currency
}: DataExportDialogProps) {
  const t = useTranslations('personalFinance')
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    includeTransactions: true,
    includeWallets: true,
    includeCategories: true,
    includeSummary: true
  })
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      if (options.format === 'csv') {
        await exportToCSV()
      } else {
        await exportToJSON()
      }

      toast.success(t('export.success'))
      onOpenChange(false)

    } catch (error) {
      console.error('Export failed:', error)
      toast.error(t('export.error'))
    } finally {
      setIsExporting(false)
    }
  }

  const exportToCSV = async () => {
    let csvContent = ''

    // Summary section
    if (options.includeSummary) {
      const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
      const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      const netIncome = totalIncome - totalExpenses

      csvContent += '=== FINANCIAL SUMMARY ===\n'
      csvContent += `Period,${getTimeRangeLabel(timeRange)}\n`
      csvContent += `Currency Filter,${currency}\n`
      csvContent += `Total Income,${totalIncome}\n`
      csvContent += `Total Expenses,${totalExpenses}\n`
      csvContent += `Net Income,${netIncome}\n`
      csvContent += `Export Date,${new Date().toISOString().split('T')[0]}\n\n`
    }

    // Transactions section
    if (options.includeTransactions && transactions.length > 0) {
      csvContent += '=== TRANSACTIONS ===\n'
      csvContent += 'Date,Type,Description,Amount,Currency,Wallet,Category,Notes\n'

      transactions.forEach(txn => {
        const row = [
          new Date(txn.date).toISOString().split('T')[0],
          txn.type,
          `"${txn.description.replace(/"/g, '""')}"`,
          txn.amount,
          txn.currency,
          txn.wallet ? `"${txn.wallet.name.replace(/"/g, '""')}"` : '',
          txn.category ? `"${txn.category.name.replace(/"/g, '""')}"` : '',
          txn.notes ? `"${txn.notes.replace(/"/g, '""')}"` : ''
        ]
        csvContent += row.join(',') + '\n'
      })
      csvContent += '\n'
    }

    // Wallets section
    if (options.includeWallets) {
      // Load wallets from database
      const { db } = await import('@/lib/db')
      const wallets = await db.personalWallets.where('isActive').equals(1).toArray()

      if (wallets.length > 0) {
        csvContent += '=== WALLETS ===\n'
        csvContent += 'Name,Type,Currency,Balance,Created Date\n'

        wallets.forEach(wallet => {
          const row = [
            `"${wallet.name.replace(/"/g, '""')}"`,
            wallet.type,
            wallet.currency,
            wallet.balance,
            new Date(wallet.createdAt).toISOString().split('T')[0]
          ]
          csvContent += row.join(',') + '\n'
        })
        csvContent += '\n'
      }
    }

    // Categories section
    if (options.includeCategories) {
      // Load categories from database
      const { db } = await import('@/lib/db')
      const categories = await db.personalCategories.where('isActive').equals(1).toArray()

      if (categories.length > 0) {
        csvContent += '=== CATEGORIES ===\n'
        csvContent += 'Name,Type,Color,Created Date\n'

        categories.forEach(category => {
          const row = [
            `"${category.name.replace(/"/g, '""')}"`,
            category.type,
            category.color,
            new Date(category.createdAt).toISOString().split('T')[0]
          ]
          csvContent += row.join(',') + '\n'
        })
      }
    }

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `personal-finance-${timeRange}-${Date.now()}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const exportToJSON = async () => {
    const exportData: any = {
      meta: {
        exportDate: new Date().toISOString(),
        period: getTimeRangeLabel(timeRange),
        currency: currency,
        format: 'json',
        version: '1.0'
      }
    }

    // Summary
    if (options.includeSummary) {
      const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
      const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

      exportData.summary = {
        totalIncome,
        totalExpenses,
        netIncome: totalIncome - totalExpenses,
        transactionCount: transactions.length,
        incomeCount: transactions.filter(t => t.type === 'income').length,
        expenseCount: transactions.filter(t => t.type === 'expense').length,
        transferCount: transactions.filter(t => t.type === 'transfer').length
      }
    }

    // Transactions
    if (options.includeTransactions) {
      exportData.transactions = transactions.map(txn => ({
        id: txn.id,
        date: txn.date,
        type: txn.type,
        description: txn.description,
        amount: txn.amount,
        currency: txn.currency,
        wallet: txn.wallet ? {
          id: txn.wallet.id,
          name: txn.wallet.name,
          type: txn.wallet.type
        } : null,
        category: txn.category ? {
          id: txn.category.id,
          name: txn.category.name,
          type: txn.category.type,
          color: txn.category.color
        } : null,
        notes: txn.notes,
        createdAt: txn.createdAt
      }))
    }

    // Wallets
    if (options.includeWallets) {
      const { db } = await import('@/lib/db')
      const wallets = await db.personalWallets.where('isActive').equals(1).toArray()

      exportData.wallets = wallets.map(wallet => ({
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        currency: wallet.currency,
        balance: wallet.balance,
        color: wallet.color,
        createdAt: wallet.createdAt
      }))
    }

    // Categories
    if (options.includeCategories) {
      const { db } = await import('@/lib/db')
      const categories = await db.personalCategories.where('isActive').equals(1).toArray()

      exportData.categories = categories.map(category => ({
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        createdAt: category.createdAt
      }))
    }

    // Download file
    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `personal-finance-${timeRange}-${Date.now()}.json`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const getTimeRangeLabel = (range: TimeRange): string => {
    const labels: Record<TimeRange, string> = {
      last7days: t('analytics.timeRanges.last7days'),
      last30days: t('analytics.timeRanges.last30days'),
      last3months: t('analytics.timeRanges.last3months'),
      last6months: t('analytics.timeRanges.last6months'),
      currentyear: t('analytics.timeRanges.currentyear'),
      lastyear: t('analytics.timeRanges.lastyear')
    }
    return labels[range]
  }

  const getPreviewInfo = () => {
    const items = []
    if (options.includeTransactions) items.push(`${transactions.length} ${t('export.transactions').toLowerCase()}`)
    if (options.includeWallets) items.push(t('export.walletInfo').toLowerCase())
    if (options.includeCategories) items.push(t('export.categoryDefinitions').toLowerCase())
    if (options.includeSummary) items.push(t('export.summary').toLowerCase())
    return items.join(', ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('export.title')}</DialogTitle>
          <DialogDescription>
            {t('export.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t('export.format')}</label>
            <Select
              value={options.format}
              onValueChange={(value: ExportFormat) => setOptions(prev => ({ ...prev, format: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {t('export.csvExcel')}
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('export.jsonComplete')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t('export.includeData')}</label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transactions"
                  checked={options.includeTransactions}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeTransactions: !!checked }))
                  }
                />
                <label htmlFor="transactions" className="text-sm">
                  {t('export.transactions')} ({t('analytics.items', { count: transactions.length })})
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="summary"
                  checked={options.includeSummary}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeSummary: !!checked }))
                  }
                />
                <label htmlFor="summary" className="text-sm">
                  {t('export.summary')}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wallets"
                  checked={options.includeWallets}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeWallets: !!checked }))
                  }
                />
                <label htmlFor="wallets" className="text-sm">
                  {t('export.walletInfo')}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="categories"
                  checked={options.includeCategories}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeCategories: !!checked }))
                  }
                />
                <label htmlFor="categories" className="text-sm">
                  {t('export.categoryDefinitions')}
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2">{t('export.preview')}</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{t('export.period')}: {getTimeRangeLabel(timeRange)}</p>
              <p>{t('export.currency')}: {currency === 'ALL' ? t('export.allCurrencies') : currency}</p>
              <p>{t('export.format')}: {options.format.toUpperCase()}</p>
              <p>{t('export.includes')}: {getPreviewInfo()}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              {t('export.cancel')}
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || (!options.includeTransactions && !options.includeWallets && !options.includeCategories && !options.includeSummary)}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('export.exporting')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t('export.exportData')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
