'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, SavingsCampaign, SavingsParticipant, SavingsContribution, User } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Zap, Plus } from 'lucide-react'
import { logger } from '@/lib/logger'

interface QuickContributeCardProps {
  campaign: SavingsCampaign
  participants: SavingsParticipant[]
  contributions: SavingsContribution[]
  users: User[]
  onContributionAdded?: () => void
}

export function QuickContributeCard({
  campaign,
  participants,
  contributions,
  users,
  onContributionAdded
}: QuickContributeCardProps) {
  const t = useTranslations('savings')
  const [isAdding, setIsAdding] = useState<string | null>(null)

  // Format amount based on currency
  const formatAmount = (amount: number) => {
    if (campaign.currency === 'USD') {
      return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amount)}`
  }

  // Calculate preset amounts based on goal
  const presetAmounts = (() => {
    const goal = campaign.goalAmount
    const remaining = goal - campaign.currentAmount

    // Generate smart preset amounts
    if (campaign.currency === 'USD') {
      if (remaining <= 100) return [10, 25, 50]
      if (remaining <= 500) return [25, 50, 100]
      if (remaining <= 1000) return [50, 100, 250]
      return [100, 250, 500]
    } else {
      // ARS amounts
      if (remaining <= 10000) return [1000, 2500, 5000]
      if (remaining <= 50000) return [5000, 10000, 25000]
      if (remaining <= 100000) return [10000, 25000, 50000]
      return [25000, 50000, 100000]
    }
  })()

  // Get first participant (for quick "my share" feature)
  const firstParticipant = participants[0]
  const firstUser = users.find(u => u.id === firstParticipant?.userId)

  // Calculate "my share" amount
  const myShareAmount = (() => {
    if (!firstParticipant) return 0

    let expected: number
    if (campaign.distributionMethod === 'percentage' && firstParticipant.sharePercentage) {
      expected = (campaign.goalAmount * firstParticipant.sharePercentage) / 100
    } else {
      expected = campaign.goalAmount / participants.length
    }

    const contributed = contributions
      .filter(c => c.userId === firstParticipant.userId)
      .reduce((sum, c) => sum + c.amount, 0)

    return Math.max(0, Math.round(expected - contributed))
  })()

  // Handle quick contribution
  const handleQuickContribute = async (amount: number) => {
    if (!firstParticipant || !firstUser) {
      toast.error(t('validation.contributorRequired'))
      return
    }

    setIsAdding(amount.toString())

    try {
      // Create contribution
      await db.savingsContributions.add({
        id: generateId('scn'),
        campaignId: campaign.id!,
        participantId: firstParticipant.id!,
        userId: firstParticipant.userId,
        amount,
        currency: campaign.currency,
        contributionDate: new Date(),
        createdAt: new Date()
      })

      // Update campaign current amount
      const newAmount = campaign.currentAmount + amount
      await db.savingsCampaigns.update(campaign.id!, {
        currentAmount: newAmount,
        updatedAt: new Date()
      })

      // Check if goal reached
      if (newAmount >= campaign.goalAmount) {
        toast.success(t('messages.goalReached'))
      } else {
        toast.success(t('messages.contributionAdded'))
      }

      onContributionAdded?.()
    } catch (error) {
      logger.error('Error adding contribution:', error)
      toast.error(t('messages.error'))
    } finally {
      setIsAdding(null)
    }
  }

  if (campaign.isCompleted || participants.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mr-2">
        <Zap className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          {t('quickContribute.title')}
        </span>
      </div>

      {/* My Share Button */}
      {myShareAmount > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="bg-white dark:bg-gray-900 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950"
          onClick={() => handleQuickContribute(myShareAmount)}
          disabled={isAdding !== null}
        >
          {isAdding === myShareAmount.toString() ? (
            <span className="animate-pulse">...</span>
          ) : (
            <>
              <Plus className="h-3 w-3 mr-1" />
              {t('quickContribute.myShare')} ({formatAmount(myShareAmount)})
            </>
          )}
        </Button>
      )}

      {/* Preset Amount Buttons */}
      {presetAmounts.map(amount => (
        <Button
          key={amount}
          size="sm"
          variant="outline"
          className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700"
          onClick={() => handleQuickContribute(amount)}
          disabled={isAdding !== null}
        >
          {isAdding === amount.toString() ? (
            <span className="animate-pulse">...</span>
          ) : (
            <>
              <Plus className="h-3 w-3 mr-1" />
              {formatAmount(amount)}
            </>
          )}
        </Button>
      ))}
    </div>
  )
}
