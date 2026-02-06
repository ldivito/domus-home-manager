'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '@/lib/utils/finance'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MonthlyOverviewProps {
  data: Array<{
    month: string
    income: number
    expenses: number
    net: number
  }>
  currency: 'ARS' | 'USD' | 'ALL'
}

export default function MonthlyOverview({ data, currency }: MonthlyOverviewProps) {
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: { value: number; name: string; dataKey: string; color: string; payload?: unknown }[]
    label?: string
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as { income: number; expenses: number; net: number }
      return (
        <div className="bg-background border border-border rounded-lg p-4 shadow-md">
          <p className="font-medium mb-3">{label}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm">Income:</span>
              </div>
              <span className="font-medium text-green-600">
                {currency === 'ALL' 
                  ? `${formatCurrency(data.income, 'ARS')}*`
                  : formatCurrency(data.income, currency)
                }
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm">Expenses:</span>
              </div>
              <span className="font-medium text-red-600">
                {currency === 'ALL' 
                  ? `${formatCurrency(data.expenses, 'ARS')}*`
                  : formatCurrency(data.expenses, currency)
                }
              </span>
            </div>
            <hr />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Net:</span>
              <span className={`font-bold ${data.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {currency === 'ALL' 
                  ? `${formatCurrency(data.net, 'ARS')}*`
                  : formatCurrency(data.net, currency)
                }
              </span>
            </div>
          </div>
          {currency === 'ALL' && (
            <p className="text-xs text-muted-foreground mt-2">*Mixed currencies shown in ARS</p>
          )}
        </div>
      )
    }
    return null
  }

  const formatYAxisTick = (value: number) => {
    if (value === 0) return '0'
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}k`
    }
    return value.toFixed(0)
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No monthly data</p>
          <p className="text-sm">Transaction history will appear here</p>
        </div>
      </div>
    )
  }

  // Calculate statistics
  const totalMonths = data.length
  const avgIncome = data.reduce((sum, month) => sum + month.income, 0) / totalMonths
  const avgExpenses = data.reduce((sum, month) => sum + month.expenses, 0) / totalMonths
  const bestMonth = data.reduce((best, current) => current.net > best.net ? current : best, data[0])
  const worstMonth = data.reduce((worst, current) => current.net < worst.net ? current : worst, data[0])

  return (
    <div className="space-y-4">
      {/* Bar Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              tickFormatter={formatYAxisTick}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Bar dataKey="net" name="Net Income" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.net >= 0 ? '#10b981' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Income:</span>
            <span className="font-medium text-green-600">
              {currency === 'ALL' 
                ? `${formatCurrency(avgIncome, 'ARS')}*`
                : formatCurrency(avgIncome, currency)
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Expenses:</span>
            <span className="font-medium text-red-600">
              {currency === 'ALL' 
                ? `${formatCurrency(avgExpenses, 'ARS')}*`
                : formatCurrency(avgExpenses, currency)
              }
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Best Month:</span>
            <div className="text-right">
              <div className="font-medium text-green-600">
                {currency === 'ALL' 
                  ? `${formatCurrency(bestMonth.net, 'ARS')}*`
                  : formatCurrency(bestMonth.net, currency)
                }
              </div>
              <div className="text-xs text-muted-foreground">{bestMonth.month}</div>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Worst Month:</span>
            <div className="text-right">
              <div className="font-medium text-red-600">
                {currency === 'ALL' 
                  ? `${formatCurrency(worstMonth.net, 'ARS')}*`
                  : formatCurrency(worstMonth.net, currency)
                }
              </div>
              <div className="text-xs text-muted-foreground">{worstMonth.month}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}