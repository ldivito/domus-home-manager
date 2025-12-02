'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SavingsCampaign, SavingsParticipant, SavingsContribution, User } from '@/lib/db'
import { formatARS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Calculator,
  ArrowRight,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'

interface SettlementTabProps {
  campaign: SavingsCampaign
  participants: SavingsParticipant[]
  contributions: SavingsContribution[]
  users: User[]
}

interface Balance {
  participantId: string
  userId: string
  name: string
  color: string
  expected: number
  contributed: number
  balance: number // positive = overpaid, negative = underpaid
}

interface Transfer {
  from: { name: string; color: string }
  to: { name: string; color: string }
  amount: number
}

export function SettlementTab({ campaign, participants, contributions, users }: SettlementTabProps) {
  const t = useTranslations('savings')
  const [copied, setCopied] = useState(false)

  // Format amount based on currency
  const formatAmount = (amount: number) => {
    if (campaign.currency === 'USD') {
      return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amount)}`
  }

  // Calculate balances for each participant
  const balances = useMemo((): Balance[] => {
    return participants.map(participant => {
      const user = users.find(u => u.id === participant.userId)

      // Calculate expected contribution
      let expected: number
      if (campaign.distributionMethod === 'percentage' && participant.sharePercentage) {
        expected = (campaign.goalAmount * participant.sharePercentage) / 100
      } else {
        // Equal distribution
        expected = campaign.goalAmount / participants.length
      }

      // Calculate actual contributions
      const contributed = contributions
        .filter(c => c.userId === participant.userId)
        .reduce((sum, c) => sum + c.amount, 0)

      return {
        participantId: participant.id!,
        userId: participant.userId,
        name: user?.name || 'Unknown',
        color: user?.color || '#8B5CF6',
        expected: Math.round(expected),
        contributed,
        balance: contributed - Math.round(expected) // positive = overpaid
      }
    }).sort((a, b) => b.balance - a.balance) // Sort by balance descending
  }, [campaign, participants, contributions, users])

  // Calculate optimal transfers to settle debts
  const transfers = useMemo((): Transfer[] => {
    // Create working copies of balances
    const creditors = balances
      .filter(b => b.balance > 0)
      .map(b => ({ ...b }))
      .sort((a, b) => b.balance - a.balance)

    const debtors = balances
      .filter(b => b.balance < 0)
      .map(b => ({ ...b, balance: Math.abs(b.balance) }))
      .sort((a, b) => b.balance - a.balance)

    const result: Transfer[] = []

    // Match debtors with creditors
    while (creditors.length > 0 && debtors.length > 0) {
      const creditor = creditors[0]
      const debtor = debtors[0]

      const amount = Math.min(creditor.balance, debtor.balance)

      if (amount > 0) {
        result.push({
          from: { name: debtor.name, color: debtor.color },
          to: { name: creditor.name, color: creditor.color },
          amount
        })
      }

      creditor.balance -= amount
      debtor.balance -= amount

      if (creditor.balance <= 0) creditors.shift()
      if (debtor.balance <= 0) debtors.shift()
    }

    return result
  }, [balances])

  // Copy transfers to clipboard
  const copyTransfers = async () => {
    const text = transfers
      .map(t => `${t.from.name} → ${t.to.name}: ${formatAmount(t.amount)}`)
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(t('settlement.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('messages.error'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Balance Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-500" />
            {t('settlement.summary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('settlement.participant')}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('settlement.expected')}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('settlement.contributed')}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('settlement.balance')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {balances.map(balance => (
                  <tr
                    key={balance.participantId}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: balance.color }}
                        >
                          {balance.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{balance.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-400">
                      {formatAmount(balance.expected)}
                    </td>
                    <td className="text-right py-3 px-2 font-medium">
                      {formatAmount(balance.contributed)}
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        {balance.balance > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="font-medium text-green-600 dark:text-green-400">
                              +{formatAmount(balance.balance)}
                            </span>
                          </>
                        ) : balance.balance < 0 ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="font-medium text-red-600 dark:text-red-400">
                              {formatAmount(balance.balance)}
                            </span>
                          </>
                        ) : (
                          <>
                            <Minus className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-500">
                              {t('settlement.evenBalance')}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('settlement.overpaid')}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('settlement.underpaid')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Transfers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-purple-500" />
              {t('settlement.transfers')}
            </CardTitle>
            {transfers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyTransfers}
                className="text-sm"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {t('settlement.copyTransfers')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {t('settlement.noTransfers')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((transfer, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                >
                  {/* From */}
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: transfer.from.color }}
                    >
                      {transfer.from.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{transfer.from.name}</span>
                  </div>

                  {/* Arrow with amount */}
                  <div className="flex items-center gap-2 px-4">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {formatAmount(transfer.amount)}
                      </span>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  {/* To */}
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="font-medium">{transfer.to.name}</span>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: transfer.to.color }}
                    >
                      {transfer.to.name.charAt(0).toUpperCase()}
                    </div>
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
