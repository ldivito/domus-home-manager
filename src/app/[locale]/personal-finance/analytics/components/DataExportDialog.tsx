'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
// import { formatCurrency } from '@/lib/utils/finance' // TODO: Used in CSV export
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
      
      toast.success('Data exported successfully!')
      onOpenChange(false)
      
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export data. Please try again.')
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
      const wallets = await db.personalWallets.filter(w => w.isActive === true).toArray()
      
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
      const categories = await db.personalCategories.filter(c => c.isActive === true).toArray()
      
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
    interface ExportData {
      meta: {
        exportDate: string
        period: string
        currency: string
        format: string
        version: string
      }
      summary?: {
        totalIncome: number
        totalExpenses: number
        netIncome: number
        transactionCount: number
        incomeCount: number
        expenseCount: number
        transferCount: number
      }
      transactions?: Record<string, unknown>[]
      wallets?: Record<string, unknown>[]
      categories?: Record<string, unknown>[]
    }
    
    const exportData: ExportData = {
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
      const wallets = await db.personalWallets.filter(w => w.isActive === true).toArray()
      
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
      const categories = await db.personalCategories.filter(c => c.isActive === true).toArray()
      
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
    const labels = {
      last7days: 'Last 7 days',
      last30days: 'Last 30 days',
      last3months: 'Last 3 months',
      last6months: 'Last 6 months',
      currentyear: 'Current year',
      lastyear: 'Last year'
    }
    return labels[range]
  }

  const getPreviewInfo = () => {
    const items = []
    if (options.includeTransactions) items.push(`${transactions.length} transactions`)
    if (options.includeWallets) items.push('wallet information')
    if (options.includeCategories) items.push('category information')
    if (options.includeSummary) items.push('financial summary')
    return items.join(', ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Financial Data</DialogTitle>
          <DialogDescription>
            Choose what data to export and in which format
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Export Format</label>
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
                    CSV - Excel compatible
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    JSON - Complete data
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Include Data</label>
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
                  Transactions ({transactions.length} items)
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
                  Financial summary
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
                  Wallet information
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
                  Category definitions
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2">Export Preview</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Period: {getTimeRangeLabel(timeRange)}</p>
              <p>Currency: {currency === 'ALL' ? 'All currencies' : currency}</p>
              <p>Format: {options.format.toUpperCase()}</p>
              <p>Includes: {getPreviewInfo()}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
              disabled={isExporting || (!options.includeTransactions && !options.includeWallets && !options.includeCategories && !options.includeSummary)}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}