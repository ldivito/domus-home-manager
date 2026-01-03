'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { SavingsCampaign, User } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Calendar, Users, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatARS } from '@/lib/utils'
import { SavingMethodBadge } from './SavingMethodBadge'

interface CampaignCardProps {
  campaign: SavingsCampaign
  participants: (User | undefined)[]
}

export function CampaignCard({ campaign, participants }: CampaignCardProps) {
  const t = useTranslations('savings')
  const router = useRouter()

  // Calculate progress percentage
  const progress = campaign.goalAmount > 0
    ? Math.min(100, (campaign.currentAmount / campaign.goalAmount) * 100)
    : 0

  // Calculate days remaining
  const today = new Date()
  const deadline = new Date(campaign.deadline)
  const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Format currency
  const formatAmount = (amount: number) => {
    if (campaign.currency === 'USD') {
      return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amount)}`
  }

  // Get deadline status
  const getDeadlineStatus = () => {
    if (campaign.isCompleted) {
      return { text: t('campaign.completed'), color: 'text-green-600 dark:text-green-400', icon: CheckCircle2 }
    }
    if (daysRemaining < 0) {
      return { text: t('campaign.overdue'), color: 'text-red-600 dark:text-red-400', icon: AlertCircle }
    }
    return { text: t('campaign.daysLeft', { days: daysRemaining }), color: 'text-gray-600 dark:text-gray-400', icon: Calendar }
  }

  const deadlineStatus = getDeadlineStatus()
  const DeadlineIcon = deadlineStatus.icon

  // Filter valid participants
  const validParticipants = participants.filter((p): p is User => p !== undefined)
  const displayedParticipants = validParticipants.slice(0, 3)
  const remainingCount = validParticipants.length - 3

  const handleClick = () => {
    router.push(`/savings/${campaign.id}`)
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-700 group"
      onClick={handleClick}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 mr-3">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              {campaign.name}
            </h3>
            {campaign.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {campaign.description}
              </p>
            )}
          </div>
          <SavingMethodBadge method={campaign.savingMethod} />
        </div>

        {/* Circular Progress */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <path
                className="text-gray-200 dark:text-gray-700"
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Progress circle */}
              <path
                className={campaign.isCompleted ? 'text-green-500' : 'text-purple-500'}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={`${progress}, 100`}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('campaign.saved')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatAmount(campaign.currentAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('campaign.of')} {formatAmount(campaign.goalAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* Deadline */}
          <div className="flex items-center gap-1.5">
            <DeadlineIcon className={`h-4 w-4 ${deadlineStatus.color}`} />
            <span className={`text-sm ${deadlineStatus.color}`}>
              {deadlineStatus.text}
            </span>
          </div>

          {/* Participants */}
          <div className="flex items-center">
            {validParticipants.length > 0 ? (
              <div className="flex items-center -space-x-2">
                {displayedParticipants.map((user) => (
                  <Avatar key={user.id} className="h-7 w-7 border-2 border-white dark:border-gray-900">
                    <AvatarFallback
                      className="text-xs font-medium"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {remainingCount > 0 && (
                  <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-900 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      +{remainingCount}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-400">
                <Users className="h-4 w-4" />
                <span className="text-xs">0</span>
              </div>
            )}
          </div>
        </div>

        {/* Completed Badge Overlay */}
        {campaign.isCompleted && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('campaign.completed')}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
