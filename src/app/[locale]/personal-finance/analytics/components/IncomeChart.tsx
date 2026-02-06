'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/finance'
import { PersonalTransaction, PersonalWallet, PersonalCategory } from '@/types/personal-finance'
import { useMemo } from 'react'

interface IncomeChartProps {
  transactions: (PersonalTransaction & { 
    wallet?: PersonalWallet
    category?: PersonalCategory 
  })[]
  currency: 'ARS' | 'USD' | 'ALL'
}

export default function IncomeChart({ transactions, currency }: IncomeChartProps) {
  
  const chartData = useMemo(() => {
    if (!transactions.length) return []
    
    // Group transactions by date
    const dailyIncome = new Map()
    
    transactions.forEach(txn => {
      const dateKey = new Date(txn.date).toISOString().split('T')[0]
      const current = dailyIncome.get(dateKey) || 0
      dailyIncome.set(dateKey, current + txn.amount)
    })
    
    // Convert to array and sort by date
    const data = Array.from(dailyIncome.entries())
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString('es', { 
          month: 'short', 
          day: 'numeric' 
        }),
        amount,
        fullDate: date
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
    
    return data
  }, [transactions])

  const sourceStats = useMemo(() => {
    if (!transactions.length) return []
    
    const stats = new Map()
    
    transactions.forEach(txn => {
      if (txn.category) {
        const current = stats.get(txn.category.id) || {
          name: txn.category.name,
          amount: 0,
          count: 0,
          color: txn.category.color
        }
        current.amount += txn.amount
        current.count += 1
        stats.set(txn.category.id, current)
      }
    })
    
    return Array.from(stats.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5) // Top 5 sources
  }, [transactions])

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: { value: number }[]
    label?: string
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-4 shadow-md">
          <p className="font-medium mb-2">{label}</p>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Income:</span>
            <span className="font-medium text-green-600">
              {currency === 'ALL' 
                ? `${formatCurrency(payload[0].value, 'ARS')}*`
                : formatCurrency(payload[0].value, currency)
              }
            </span>
          </div>
          {currency === 'ALL' && (
            <p className="text-xs text-muted-foreground mt-2">*Mixed currencies shown in ARS</p>
          )}
        </div>
      )
    }
    return null
  }

  const totalIncome = transactions.reduce((sum, txn) => sum + txn.amount, 0)
  const avgDailyIncome = chartData.length > 0 ? totalIncome / chartData.length : 0
  const maxDailyIncome = chartData.length > 0 ? Math.max(...chartData.map(d => d.amount)) : 0

  return (
    <div className="space-y-6">
      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
                  return value.toFixed(0)
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#10b981"
                fill="#10b98120"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">No income data</p>
            <p className="text-sm">Add some income to see the chart</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="font-bold text-lg text-green-600">
            {currency === 'ALL' 
              ? `${formatCurrency(totalIncome, 'ARS')}*`
              : formatCurrency(totalIncome, currency)
            }
          </div>
          <div className="text-muted-foreground">Total</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-lg">
            {currency === 'ALL' 
              ? `${formatCurrency(avgDailyIncome, 'ARS')}*`
              : formatCurrency(avgDailyIncome, currency)
            }
          </div>
          <div className="text-muted-foreground">Avg/Day</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-lg">
            {currency === 'ALL' 
              ? `${formatCurrency(maxDailyIncome, 'ARS')}*`
              : formatCurrency(maxDailyIncome, currency)
            }
          </div>
          <div className="text-muted-foreground">Best Day</div>
        </div>
      </div>

      {/* Top Sources */}
      {sourceStats.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Top Income Sources</h4>
          <div className="space-y-2">
            {sourceStats.map((source, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded border">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="font-medium text-sm">{source.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({source.count} transactions)
                  </span>
                </div>
                <div className="text-sm font-medium text-green-600">
                  {currency === 'ALL' 
                    ? `${formatCurrency(source.amount, 'ARS')}*`
                    : formatCurrency(source.amount, currency)
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {currency === 'ALL' && (
        <p className="text-xs text-muted-foreground">*Mixed currencies shown in ARS</p>
      )}
    </div>
  )
}