'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SavingsCampaign, SavingsContribution } from '@/lib/db'
import { formatARS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import {
  TrendingUp,
  BarChart3,
  Target,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'

interface AnalyticsTabProps {
  campaign: SavingsCampaign
  contributions: SavingsContribution[]
}

const CHART_COLORS = {
  actual: '#8B5CF6',
  expected: '#D1D5DB',
  positive: '#10B981',
  negative: '#EF4444',
}

export function AnalyticsTab({ campaign, contributions }: AnalyticsTabProps) {
  const t = useTranslations('savings')

  // Format amount based on currency
  const formatAmount = (amount: number) => {
    if (campaign.currency === 'USD') {
      return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amount)}`
  }

  // Format for tooltip
  const formatTooltipValue = (value: number) => formatAmount(value)

  // Calculate progress data for the area chart
  const progressData = useMemo(() => {
    if (contributions.length === 0) return []

    const startDate = new Date(campaign.createdAt)
    const deadline = new Date(campaign.deadline)
    const totalDays = Math.ceil((deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    // Sort contributions by date
    const sortedContributions = [...contributions].sort(
      (a, b) => new Date(a.contributionDate).getTime() - new Date(b.contributionDate).getTime()
    )

    // Create data points
    const data: { date: string; actual: number; expected: number; rawDate: Date }[] = []

    // Start point
    data.push({
      date: startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      actual: 0,
      expected: 0,
      rawDate: startDate
    })

    // Add contribution points
    let cumulative = 0
    sortedContributions.forEach(c => {
      cumulative += c.amount
      const contributionDate = new Date(c.contributionDate)
      const daysPassed = Math.ceil((contributionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const expectedAtDate = (campaign.goalAmount / totalDays) * daysPassed

      data.push({
        date: contributionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        actual: cumulative,
        expected: Math.round(expectedAtDate),
        rawDate: contributionDate
      })
    })

    // Add current date if different from last contribution
    const now = new Date()
    if (now < deadline) {
      const daysPassed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const expectedNow = (campaign.goalAmount / totalDays) * daysPassed

      // Only add if significantly different from last point
      const lastPoint = data[data.length - 1]
      if (Math.abs(now.getTime() - lastPoint.rawDate.getTime()) > 1000 * 60 * 60 * 24) {
        data.push({
          date: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          actual: cumulative,
          expected: Math.round(expectedNow),
          rawDate: now
        })
      }
    }

    // Add deadline point
    data.push({
      date: deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      actual: cumulative,
      expected: campaign.goalAmount,
      rawDate: deadline
    })

    return data
  }, [campaign, contributions])

  // Calculate velocity data (contributions per week)
  const velocityData = useMemo(() => {
    if (contributions.length === 0) return []

    // Group contributions by week
    const weekMap = new Map<string, number>()

    contributions.forEach(c => {
      const date = new Date(c.contributionDate)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + c.amount)
    })

    // Convert to array and sort
    const weeks = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8) // Last 8 weeks

    return weeks.map(([weekStart, amount]) => {
      const date = new Date(weekStart)
      return {
        week: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        amount
      }
    })
  }, [contributions])

  // Calculate analytics metrics
  const analytics = useMemo(() => {
    const now = new Date()
    const startDate = new Date(campaign.createdAt)
    const deadline = new Date(campaign.deadline)

    const totalDays = Math.ceil((deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysPassed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    const expectedProgress = (campaign.goalAmount / totalDays) * daysPassed
    const actualProgress = campaign.currentAmount

    // Status calculation
    let status: 'onTrack' | 'ahead' | 'behind' | 'noData' = 'noData'
    let daysDiff = 0

    if (contributions.length > 0) {
      const progressDiff = actualProgress - expectedProgress
      const dailyRate = campaign.goalAmount / totalDays

      if (Math.abs(progressDiff) < dailyRate * 3) {
        status = 'onTrack'
      } else if (progressDiff > 0) {
        status = 'ahead'
        daysDiff = Math.round(progressDiff / dailyRate)
      } else {
        status = 'behind'
        daysDiff = Math.round(Math.abs(progressDiff) / dailyRate)
      }
    }

    // Projected completion date
    let projectedDate: Date | null = null
    if (contributions.length > 0 && actualProgress > 0) {
      const weeksElapsed = daysPassed / 7
      const weeklyRate = actualProgress / weeksElapsed
      const remainingAmount = campaign.goalAmount - actualProgress

      if (weeklyRate > 0) {
        const weeksRemaining = remainingAmount / weeklyRate
        projectedDate = new Date(now.getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000)
      }
    }

    // Average contribution
    const averageContribution = contributions.length > 0
      ? contributions.reduce((sum, c) => sum + c.amount, 0) / contributions.length
      : 0

    // Weekly savings rate
    const weeksElapsed = Math.max(1, daysPassed / 7)
    const weeklyRate = actualProgress / weeksElapsed

    return {
      status,
      daysDiff,
      projectedDate,
      averageContribution,
      weeklyRate,
      monthlyRate: weeklyRate * 4.33,
      daysRemaining,
      contributionCount: contributions.length
    }
  }, [campaign, contributions])

  // Average line for velocity chart
  const averageVelocity = useMemo(() => {
    if (velocityData.length === 0) return 0
    return velocityData.reduce((sum, d) => sum + d.amount, 0) / velocityData.length
  }, [velocityData])

  if (contributions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('analytics.noContributions')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <Card className={`${
          analytics.status === 'ahead' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
          analytics.status === 'behind' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
          'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {analytics.status === 'ahead' ? (
                <ArrowUp className="h-4 w-4 text-green-600" />
              ) : analytics.status === 'behind' ? (
                <ArrowDown className="h-4 w-4 text-red-600" />
              ) : (
                <Minus className="h-4 w-4 text-purple-600" />
              )}
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('analytics.projectionCard')}
              </span>
            </div>
            <p className={`text-lg font-bold ${
              analytics.status === 'ahead' ? 'text-green-700 dark:text-green-400' :
              analytics.status === 'behind' ? 'text-red-700 dark:text-red-400' :
              'text-purple-700 dark:text-purple-400'
            }`}>
              {t(`analytics.status.${analytics.status}`)}
            </p>
            {analytics.daysDiff > 0 && analytics.status !== 'onTrack' && analytics.status !== 'noData' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {analytics.status === 'ahead'
                  ? t('analytics.daysAhead', { days: analytics.daysDiff })
                  : t('analytics.daysBehind', { days: analytics.daysDiff })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Projected Date Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('analytics.projectedCompletion')}
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {analytics.projectedDate
                ? analytics.projectedDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : '-'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('analytics.atCurrentRate')}
            </p>
          </CardContent>
        </Card>

        {/* Savings Rate Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('analytics.savingsRate')}
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatAmount(Math.round(analytics.weeklyRate))}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('analytics.perWeek')}
            </p>
          </CardContent>
        </Card>

        {/* Average Contribution Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('analytics.averageContribution')}
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatAmount(Math.round(analytics.averageContribution))}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('analytics.contributionCount', { count: analytics.contributionCount })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              {t('analytics.progressChart')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => {
                    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
                    return v.toString()
                  }}
                />
                <Tooltip formatter={formatTooltipValue} />
                <Area
                  type="monotone"
                  dataKey="expected"
                  name={t('analytics.expected')}
                  stroke={CHART_COLORS.expected}
                  fill={CHART_COLORS.expected}
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name={t('analytics.actual')}
                  stroke={CHART_COLORS.actual}
                  fill={CHART_COLORS.actual}
                  fillOpacity={0.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Velocity Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              {t('analytics.velocityChart')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => {
                    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
                    return v.toString()
                  }}
                />
                <Tooltip formatter={formatTooltipValue} />
                <Bar
                  dataKey="amount"
                  name={t('contributions.amount')}
                  fill={CHART_COLORS.actual}
                  radius={[4, 4, 0, 0]}
                />
                <ReferenceLine
                  y={averageVelocity}
                  stroke={CHART_COLORS.positive}
                  strokeDasharray="5 5"
                  label={{
                    value: t('analytics.average'),
                    position: 'insideTopRight',
                    fill: CHART_COLORS.positive,
                    fontSize: 11
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
