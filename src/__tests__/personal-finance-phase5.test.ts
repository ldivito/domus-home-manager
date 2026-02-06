import { describe, it, expect, beforeEach } from '@jest/globals'
import { formatCurrency } from '@/lib/utils/finance'

// Mock data for testing analytics calculations
const mockTransactions = [
  {
    id: 'pt_1',
    userId: 'user_1',
    walletId: 'pw_1',
    categoryId: 'pc_1',
    type: 'income' as const,
    amount: 100000,
    currency: 'ARS' as const,
    description: 'Salary',
    date: new Date('2026-01-15'),
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isFromCreditCard: false
  },
  {
    id: 'pt_2',
    userId: 'user_1',
    walletId: 'pw_1',
    categoryId: 'pc_2',
    type: 'expense' as const,
    amount: 25000,
    currency: 'ARS' as const,
    description: 'Groceries',
    date: new Date('2026-01-16'),
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isFromCreditCard: false
  },
  {
    id: 'pt_3',
    userId: 'user_1',
    walletId: 'pw_1',
    categoryId: 'pc_3',
    type: 'expense' as const,
    amount: 15000,
    currency: 'ARS' as const,
    description: 'Transport',
    date: new Date('2026-01-17'),
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    isFromCreditCard: false
  }
]

describe('Personal Finance Phase 5: Analytics', () => {
  describe('Financial calculations', () => {
    it('should calculate total income correctly', () => {
      const totalIncome = mockTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
      
      expect(totalIncome).toBe(100000)
    })

    it('should calculate total expenses correctly', () => {
      const totalExpenses = mockTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
      
      expect(totalExpenses).toBe(40000)
    })

    it('should calculate net income correctly', () => {
      const totalIncome = mockTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const totalExpenses = mockTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const netIncome = totalIncome - totalExpenses
      
      expect(netIncome).toBe(60000)
    })
  })

  describe('Monthly data generation', () => {
    it('should generate monthly data for a given date range', () => {
      const generateMonthlyData = (transactions: typeof mockTransactions, start: Date, end: Date) => {
        const months = []
        const current = new Date(start)
        
        while (current <= end) {
          const monthTransactions = transactions.filter(t => {
            const txnDate = new Date(t.date)
            return txnDate.getFullYear() === current.getFullYear() && 
                   txnDate.getMonth() === current.getMonth()
          })
          
          const income = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)
          
          const expenses = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0)
          
          months.push({
            month: current.toLocaleDateString('es', { month: 'short', year: '2-digit' }),
            income,
            expenses,
            net: income - expenses
          })
          
          current.setMonth(current.getMonth() + 1)
        }
        
        return months
      }

      const start = new Date('2026-01-01')
      const end = new Date('2026-01-31')
      const monthlyData = generateMonthlyData(mockTransactions, start, end)

      expect(monthlyData).toHaveLength(1)
      expect(monthlyData[0].income).toBe(100000)
      expect(monthlyData[0].expenses).toBe(40000)
      expect(monthlyData[0].net).toBe(60000)
    })
  })

  describe('Category breakdown generation', () => {
    it('should generate category breakdown correctly', () => {
      const mockCategories = [
        { id: 'pc_2', name: 'Food', color: '#ff0000' },
        { id: 'pc_3', name: 'Transport', color: '#00ff00' }
      ]

      const generateCategoryBreakdown = (expenseTransactions: any[], totalExpenses: number) => {
        const categoryTotals = new Map()
        
        expenseTransactions.forEach(txn => {
          const category = mockCategories.find(c => c.id === txn.categoryId)
          if (category) {
            const current = categoryTotals.get(category.id) || { 
              name: category.name, 
              amount: 0, 
              color: category.color 
            }
            current.amount += txn.amount
            categoryTotals.set(category.id, current)
          }
        })
        
        return Array.from(categoryTotals.values())
          .map(cat => ({
            category: cat.name,
            amount: cat.amount,
            color: cat.color,
            percentage: totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0
          }))
          .sort((a, b) => b.amount - a.amount)
      }

      const expenseTransactions = mockTransactions.filter(t => t.type === 'expense')
      const totalExpenses = 40000
      const breakdown = generateCategoryBreakdown(expenseTransactions, totalExpenses)

      expect(breakdown).toHaveLength(2)
      expect(breakdown[0].category).toBe('Food')
      expect(breakdown[0].amount).toBe(25000)
      expect(breakdown[0].percentage).toBe(62.5)
      expect(breakdown[1].category).toBe('Transport')
      expect(breakdown[1].amount).toBe(15000)
      expect(breakdown[1].percentage).toBe(37.5)
    })
  })

  describe('Data export functionality', () => {
    it('should format CSV export data correctly', () => {
      const formatTransactionForCSV = (txn: typeof mockTransactions[0]) => {
        return [
          new Date(txn.date).toISOString().split('T')[0],
          txn.type,
          `"${txn.description.replace(/"/g, '""')}"`,
          txn.amount,
          txn.currency,
          '', // wallet name would be added later
          '', // category name would be added later
          txn.notes ? `"${txn.notes.replace(/"/g, '""')}"` : ''
        ].join(',')
      }

      const csvRow = formatTransactionForCSV(mockTransactions[0])
      expect(csvRow).toBe('2026-01-15,income,"Salary",100000,ARS,,,"')
    })

    it('should calculate summary data for export', () => {
      const generateSummary = (transactions: typeof mockTransactions) => {
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
        const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
        
        return {
          totalIncome,
          totalExpenses,
          netIncome: totalIncome - totalExpenses,
          transactionCount: transactions.length,
          incomeCount: transactions.filter(t => t.type === 'income').length,
          expenseCount: transactions.filter(t => t.type === 'expense').length
        }
      }

      const summary = generateSummary(mockTransactions)
      
      expect(summary.totalIncome).toBe(100000)
      expect(summary.totalExpenses).toBe(40000)
      expect(summary.netIncome).toBe(60000)
      expect(summary.transactionCount).toBe(3)
      expect(summary.incomeCount).toBe(1)
      expect(summary.expenseCount).toBe(2)
    })
  })

  describe('Time range calculations', () => {
    it('should calculate correct date ranges', () => {
      const getDateRange = (range: string): { start: Date; end: Date } => {
        const end = new Date('2026-01-31') // Fixed end date for testing
        const start = new Date('2026-01-31')
        
        switch (range) {
          case 'last7days':
            start.setDate(start.getDate() - 7)
            break
          case 'last30days':
            start.setDate(start.getDate() - 30)
            break
          case 'last3months':
            start.setMonth(start.getMonth() - 3)
            break
          case 'currentyear':
            start.setMonth(0, 1)
            break
        }
        
        return { start, end }
      }

      const last7days = getDateRange('last7days')
      expect(last7days.start.getDate()).toBe(24) // 31 - 7 = 24

      const last30days = getDateRange('last30days')
      expect(last30days.start.getDate()).toBe(1) // 31 - 30 = 1

      const currentYear = getDateRange('currentyear')
      expect(currentYear.start.getMonth()).toBe(0)
      expect(currentYear.start.getDate()).toBe(1)
    })
  })

  describe('Performance optimizations', () => {
    it('should handle large datasets efficiently', () => {
      // Generate a large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...mockTransactions[0],
        id: `pt_${i}`,
        amount: Math.floor(Math.random() * 100000),
        date: new Date(2026, 0, Math.floor(Math.random() * 30) + 1)
      }))

      const startTime = performance.now()
      
      // Simulate analytics calculations
      const totalIncome = largeDataset.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
      const totalExpenses = largeDataset.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should process 10k records in under 100ms
      expect(duration).toBeLessThan(100)
      expect(typeof totalIncome).toBe('number')
      expect(typeof totalExpenses).toBe('number')
    })
  })
})

describe('Currency formatting', () => {
  it('should format ARS currency correctly', () => {
    expect(formatCurrency(1234.56, 'ARS')).toBe('$1,235')
  })

  it('should format USD currency correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('US$1,235')
  })

  it('should handle zero values', () => {
    expect(formatCurrency(0, 'ARS')).toBe('$0')
    expect(formatCurrency(0, 'USD')).toBe('US$0')
  })

  it('should handle negative values', () => {
    expect(formatCurrency(-1234, 'ARS')).toBe('-$1,234')
    expect(formatCurrency(-1234, 'USD')).toBe('-US$1,234')
  })
})