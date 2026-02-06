'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils/finance'

interface CategoryBreakdownProps {
  data: Array<{
    category: string
    amount: number
    color: string
    percentage: number
  }>
}

export default function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-4 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: data.color }}
            />
            <span className="font-medium">{data.category}</span>
          </div>
          <div className="space-y-1 text-sm">
            <p>Amount: <span className="font-medium">{formatCurrency(data.amount, 'ARS')}</span></p>
            <p>Percentage: <span className="font-medium">{data.percentage.toFixed(1)}%</span></p>
          </div>
        </div>
      )
    }
    return null
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    if (percentage < 5) return null // Don't show label for small slices
    
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${percentage.toFixed(0)}%`}
      </text>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No expenses data</p>
          <p className="text-sm">Start adding expense transactions to see breakdown</p>
        </div>
      </div>
    )
  }

  // Prepare data for chart - limit to top 8 categories and group others
  let chartData = [...data]
  if (chartData.length > 8) {
    const top7 = chartData.slice(0, 7)
    const others = chartData.slice(7)
    const othersTotal = others.reduce((sum, item) => sum + item.amount, 0)
    const othersPercentage = others.reduce((sum, item) => sum + item.percentage, 0)
    
    chartData = [
      ...top7,
      {
        category: 'Others',
        amount: othersTotal,
        color: '#6b7280',
        percentage: othersPercentage
      }
    ]
  }

  return (
    <div className="space-y-4">
      {/* Pie Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="amount"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">Categories</h4>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-sm truncate">{item.category}</span>
                <span className="text-xs text-muted-foreground">
                  ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="flex-shrink-0 text-sm font-medium">
                {formatCurrency(item.amount, 'ARS')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}