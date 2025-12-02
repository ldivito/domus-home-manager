'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SavingsCampaign, SavingsParticipant, SavingsContribution, User } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatARS } from '@/lib/utils'
import {
  Target,
  Users,
  Percent,
  Equal,
  TrendingUp,
  TrendingDown,
  CheckCircle2
} from 'lucide-react'
import { SavingMethodBadge } from '../../components/SavingMethodBadge'

interface OverviewTabProps {
  campaign: SavingsCampaign
  participants: SavingsParticipant[]
  contributions: SavingsContribution[]
  users: User[]
}

export function OverviewTab({ campaign, participants, contributions, users }: OverviewTabProps) {
  const t = useTranslations('savings')

  // Format amount
  const formatAmount = (amount: number) => {
    if (campaign.currency === 'USD') {
      return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amount)}`
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Calculate who owes what
  const participantBalances = useMemo(() => {
    const balances: {
      userId: string
      user: User | undefined
      expected: number
      contributed: number
      owes: number
      status: 'ahead' | 'onTrack' | 'behind'
    }[] = []

    const totalExpected = campaign.goalAmount
    const totalContributed = campaign.currentAmount

    participants.forEach(participant => {
      const user = users.find(u => u.id === participant.userId)
      let expectedAmount: number

      if (campaign.distributionMethod === 'percentage') {
        expectedAmount = (participant.sharePercentage || 0) / 100 * totalExpected
      } else {
        // Equal distribution
        expectedAmount = totalExpected / participants.length
      }

      // Calculate contributed by this user
      const userContributions = contributions.filter(c => c.userId === participant.userId)
      const contributed = userContributions.reduce((sum, c) => sum + c.amount, 0)

      // Calculate how much they owe (pro-rated by progress)
      const progressRatio = totalContributed / totalExpected
      const expectedByNow = expectedAmount * progressRatio
      const owes = Math.max(0, expectedByNow - contributed)

      let status: 'ahead' | 'onTrack' | 'behind' = 'onTrack'
      if (contributed > expectedByNow * 1.05) status = 'ahead'
      else if (contributed < expectedByNow * 0.95) status = 'behind'

      balances.push({
        userId: participant.userId,
        user,
        expected: expectedAmount,
        contributed,
        owes,
        status
      })
    })

    return balances
  }, [campaign, participants, contributions, users])

  // Calculate suggested contribution
  const suggestedContribution = useMemo(() => {
    if (!campaign.deadline) return null

    const today = new Date()
    const deadline = new Date(campaign.deadline)
    const remaining = campaign.goalAmount - campaign.currentAmount

    if (remaining <= 0) return null

    const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysRemaining <= 0) return null

    let period = ''
    let amount = 0

    switch (campaign.savingMethod) {
      case 'fixed_monthly':
        const monthsRemaining = Math.ceil(daysRemaining / 30)
        amount = remaining / monthsRemaining
        period = t('overview.month')
        break
      case 'bi_weekly':
        const biweeksRemaining = Math.ceil(daysRemaining / 14)
        amount = remaining / biweeksRemaining
        period = t('overview.biweekly')
        break
      case '52_week_challenge':
      default:
        const weeksRemaining = Math.ceil(daysRemaining / 7)
        amount = remaining / weeksRemaining
        period = t('overview.week')
        break
    }

    return { amount, period }
  }, [campaign, t])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Campaign Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            {t('overview.campaignDetails')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('overview.savingMethod')}</span>
            <SavingMethodBadge method={campaign.savingMethod} showLabel />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('overview.distribution')}</span>
            <Badge variant="secondary" className="gap-1">
              {campaign.distributionMethod === 'equal' ? (
                <>
                  <Equal className="h-3 w-3" />
                  {t('distribution.equal')}
                </>
              ) : (
                <>
                  <Percent className="h-3 w-3" />
                  {t('distribution.percentage')}
                </>
              )}
            </Badge>
          </div>

          <div className="py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400 block mb-2">{t('overview.timeline')}</span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-500">{t('overview.started')}</p>
                <p className="text-sm font-medium">{formatDate(campaign.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-500">{t('overview.deadline')}</p>
                <p className="text-sm font-medium">{formatDate(campaign.deadline)}</p>
              </div>
            </div>
          </div>

          {campaign.savingMethod === 'custom' && campaign.customMethodDetails && (
            <div className="py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
                {t('form.customMethodDetails')}
              </span>
              <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                {campaign.customMethodDetails}
              </p>
            </div>
          )}

          {suggestedContribution && (
            <div className="py-2 bg-purple-50 dark:bg-purple-950/30 -mx-6 px-6 mt-4">
              <span className="text-sm text-purple-600 dark:text-purple-400 block mb-1">
                {t('overview.suggestedContribution')}
              </span>
              <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {formatAmount(suggestedContribution.amount)}
                <span className="text-sm font-normal text-purple-600 dark:text-purple-400 ml-1">
                  {t('overview.perPeriod', { period: suggestedContribution.period })}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Who Owes What Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            {t('overview.whoOwesWhat')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {participantBalances.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {t('participants.noParticipants')}
            </p>
          ) : (
            <div className="space-y-3">
              {participantBalances.map((balance) => (
                <div
                  key={balance.userId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback style={{ backgroundColor: balance.user?.color }}>
                      {balance.user?.name.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {balance.user?.name || 'Unknown'}
                      </span>
                      {balance.status === 'ahead' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-0.5 text-xs">
                          <TrendingUp className="h-3 w-3" />
                          {t('participants.ahead')}
                        </Badge>
                      )}
                      {balance.status === 'behind' && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-0.5 text-xs">
                          <TrendingDown className="h-3 w-3" />
                          {t('participants.behind')}
                        </Badge>
                      )}
                      {balance.status === 'onTrack' && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 gap-0.5 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('participants.onTrack')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('participants.contributed')}: {formatAmount(balance.contributed)} / {formatAmount(balance.expected)}
                    </div>
                  </div>

                  <div className="text-right">
                    {balance.owes > 0 ? (
                      <>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('participants.owes')}</p>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">
                          {formatAmount(balance.owes)}
                        </p>
                      </>
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
