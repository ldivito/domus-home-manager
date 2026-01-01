"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, TrendingDown, TrendingUp, Minus, Scale, Target, Calendar, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { KetoWeightEntry } from "@/lib/db"

interface WeightProgressChartProps {
  weightEntries: KetoWeightEntry[]
  goalWeight?: number
  targetDate?: Date
  weightUnit: 'kg' | 'lb'
  onAddWeight: () => void
  onEditWeight?: (entry: KetoWeightEntry) => void
  onDeleteWeight?: (id: string) => void
}

export default function WeightProgressChart({
  weightEntries,
  goalWeight,
  targetDate,
  weightUnit,
  onAddWeight,
  onEditWeight,
  onDeleteWeight,
}: WeightProgressChartProps) {
  const t = useTranslations('keto')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const entryToDelete = weightEntries.find(e => e.id === deleteConfirmId)

  const stats = useMemo(() => {
    if (!weightEntries.length) {
      return {
        currentWeight: null,
        startWeight: null,
        lowestWeight: null,
        highestWeight: null,
        totalLoss: 0,
        progressToGoal: 0,
        estimatedDaysToGoal: null,
        weeklyAvgLoss: 0,
        trend: 'stable' as const,
      }
    }

    const sorted = [...weightEntries].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateA.getTime() - dateB.getTime()
    })

    const currentWeight = sorted[sorted.length - 1].weight
    const startWeight = sorted[0].weight
    const lowestWeight = Math.min(...sorted.map(e => e.weight))
    const highestWeight = Math.max(...sorted.map(e => e.weight))
    const totalLoss = startWeight - currentWeight

    // Calculate weekly average loss
    const firstDate = sorted[0].date instanceof Date ? sorted[0].date : new Date(sorted[0].date)
    const lastDate = sorted[sorted.length - 1].date instanceof Date ? sorted[sorted.length - 1].date : new Date(sorted[sorted.length - 1].date)
    const daysDiff = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))
    const weeksDiff = daysDiff / 7
    const weeklyAvgLoss = weeksDiff > 0 ? totalLoss / weeksDiff : 0

    // Calculate progress to goal
    let progressToGoal = 0
    let estimatedDaysToGoal: number | null = null
    if (goalWeight && startWeight > goalWeight) {
      const totalNeeded = startWeight - goalWeight
      const achieved = startWeight - currentWeight
      progressToGoal = Math.min(100, Math.max(0, (achieved / totalNeeded) * 100))

      if (weeklyAvgLoss > 0) {
        const remaining = currentWeight - goalWeight
        const weeksRemaining = remaining / weeklyAvgLoss
        estimatedDaysToGoal = Math.ceil(weeksRemaining * 7)
      }
    }

    // Determine trend (last 3 entries)
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (sorted.length >= 2) {
      const recentEntries = sorted.slice(-3)
      const firstWeight = recentEntries[0].weight
      const lastWeight = recentEntries[recentEntries.length - 1].weight
      const diff = lastWeight - firstWeight
      if (diff < -0.5) trend = 'down'
      else if (diff > 0.5) trend = 'up'
    }

    return {
      currentWeight,
      startWeight,
      lowestWeight,
      highestWeight,
      totalLoss,
      progressToGoal,
      estimatedDaysToGoal,
      weeklyAvgLoss,
      trend,
    }
  }, [weightEntries, goalWeight])

  // Prepare chart data - last 30 days or all entries
  const chartData = useMemo(() => {
    if (!weightEntries.length) return []

    const sorted = [...weightEntries].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateA.getTime() - dateB.getTime()
    })

    // Take last 30 entries for chart
    const last30 = sorted.slice(-30)
    const weights = last30.map(e => e.weight)
    const minWeight = Math.min(...weights, goalWeight || Infinity) - 2
    const maxWeight = Math.max(...weights) + 2
    const range = maxWeight - minWeight

    return last30.map((entry, index) => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date)
      const heightPercent = range > 0 ? ((entry.weight - minWeight) / range) * 100 : 50

      return {
        date,
        weight: entry.weight,
        heightPercent: Math.max(5, Math.min(95, heightPercent)),
        isFirst: index === 0,
        isLast: index === last30.length - 1,
      }
    })
  }, [weightEntries, goalWeight])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  if (!weightEntries.length) {
    return (
      <Card className="glass-card shadow-modern">
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
          <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
            <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('weight.title')}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t('weight.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
            <Scale className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              {t('weight.noEntries')}
            </p>
            <Button onClick={onAddWeight} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('weight.addFirst')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card shadow-modern">
      <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
              <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('weight.title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('weight.description')}
            </CardDescription>
          </div>
          <Button onClick={onAddWeight} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t('weight.addEntry')}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6 pt-0 space-y-4 sm:space-y-6">
        {/* Current Weight & Trend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="text-center p-2 sm:p-3 bg-primary/10 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary">
              {stats.currentWeight?.toFixed(1)} {weightUnit}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('weight.current')}</div>
          </div>

          <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold flex items-center justify-center gap-1">
              {stats.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
              {stats.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
              {stats.trend === 'stable' && <Minus className="h-4 w-4 text-yellow-500" />}
              <span className={
                stats.trend === 'down' ? 'text-green-600' :
                stats.trend === 'up' ? 'text-red-600' : 'text-yellow-600'
              }>
                {stats.trend === 'down' ? t('weight.losing') :
                 stats.trend === 'up' ? t('weight.gaining') : t('weight.stable')}
              </span>
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('weight.trend')}</div>
          </div>

          <div className="text-center p-2 sm:p-3 bg-green-500/10 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
              {stats.totalLoss > 0 ? '-' : ''}{Math.abs(stats.totalLoss).toFixed(1)} {weightUnit}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('weight.totalChange')}</div>
          </div>

          <div className="text-center p-2 sm:p-3 bg-blue-500/10 rounded-lg">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">
              {stats.weeklyAvgLoss > 0 ? '-' : ''}{Math.abs(stats.weeklyAvgLoss).toFixed(2)}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('weight.weeklyAvg')} ({weightUnit})</div>
          </div>
        </div>

        {/* Goal Progress */}
        {goalWeight && (
          <div className="space-y-2 p-3 sm:p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                {t('weight.goalProgress')}
              </span>
              <span className="font-medium">{stats.progressToGoal.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${stats.progressToGoal}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.startWeight?.toFixed(1)} {weightUnit}</span>
              <span className="font-medium text-primary">{goalWeight} {weightUnit}</span>
            </div>

            {stats.estimatedDaysToGoal !== null && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('weight.estimatedDays', { days: stats.estimatedDaysToGoal })}
                </span>
              </div>
            )}

            {targetDate && (
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('weight.targetDateLabel')}: {formatDate(targetDate instanceof Date ? targetDate : new Date(targetDate))}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Simple Bar Chart */}
        {chartData.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">{t('weight.history')}</h4>
            <div className="h-32 sm:h-40 flex items-end gap-0.5 sm:gap-1 bg-muted/30 rounded-lg p-2 sm:p-3">
              {chartData.map((point, index) => (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                >
                  <div
                    className="w-full bg-primary/70 hover:bg-primary rounded-t transition-colors cursor-pointer min-h-[4px]"
                    style={{ height: `${point.heightPercent}%` }}
                    title={`${formatDate(point.date)}: ${point.weight} ${weightUnit}`}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                    <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      <div className="font-medium">{point.weight} {weightUnit}</div>
                      <div className="text-muted-foreground">{formatDate(point.date)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
              <span>{formatDate(chartData[0].date)}</span>
              <span>{formatDate(chartData[chartData.length - 1].date)}</span>
            </div>
          </div>
        )}

        {/* Weight Entry Table */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">{t('weight.recentEntries')}</h4>
          <div className="max-h-40 overflow-y-auto rounded-lg border">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">{t('weight.date')}</th>
                  <th className="text-right p-2 font-medium">{t('weight.weight')}</th>
                  <th className="text-right p-2 font-medium hidden sm:table-cell">{t('weight.change')}</th>
                  {(onEditWeight || onDeleteWeight) && (
                    <th className="text-right p-2 font-medium w-12">{t('weight.actions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {[...weightEntries]
                  .sort((a, b) => {
                    const dateA = a.date instanceof Date ? a.date : new Date(a.date)
                    const dateB = b.date instanceof Date ? b.date : new Date(b.date)
                    return dateB.getTime() - dateA.getTime()
                  })
                  .slice(0, 10)
                  .map((entry, index, arr) => {
                    const prevEntry = arr[index + 1]
                    const change = prevEntry ? entry.weight - prevEntry.weight : 0
                    const date = entry.date instanceof Date ? entry.date : new Date(entry.date)

                    return (
                      <tr key={entry.id} className="border-t hover:bg-muted/30 group">
                        <td className="p-2">{formatDate(date)}</td>
                        <td className="p-2 text-right font-medium">{entry.weight.toFixed(1)} {weightUnit}</td>
                        <td className={`p-2 text-right hidden sm:table-cell ${
                          change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          {change !== 0 && (change > 0 ? '+' : '')}{change.toFixed(1)}
                        </td>
                        {(onEditWeight || onDeleteWeight) && (
                          <td className="p-1.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {onEditWeight && (
                                  <DropdownMenuItem onClick={() => onEditWeight(entry)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                    {t('weight.edit')}
                                  </DropdownMenuItem>
                                )}
                                {onDeleteWeight && (
                                  <DropdownMenuItem
                                    onClick={() => setDeleteConfirmId(entry.id!)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    {t('weight.delete')}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('weight.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('weight.deleteConfirmDescription', {
                weight: entryToDelete?.weight.toFixed(1) || '',
                unit: weightUnit,
                date: entryToDelete ? formatDate(entryToDelete.date instanceof Date ? entryToDelete.date : new Date(entryToDelete.date)) : ''
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId && onDeleteWeight) {
                  onDeleteWeight(deleteConfirmId)
                  setDeleteConfirmId(null)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('weight.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
