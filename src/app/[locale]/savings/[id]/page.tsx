'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteWithSync, bulkDeleteWithSync } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Calendar,
  Target,
  Users,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { formatARS } from '@/lib/utils'
import { SavingMethodBadge } from '../components/SavingMethodBadge'
import { OverviewTab } from './components/OverviewTab'
import { AnalyticsTab } from './components/AnalyticsTab'
import { MilestonesTab } from './components/MilestonesTab'
import { ContributionsTab } from './components/ContributionsTab'
import { ParticipantsTab } from './components/ParticipantsTab'
import { SettlementTab } from './components/SettlementTab'
import { EditCampaignDialog } from './components/EditCampaignDialog'

export default function SavingsDetailPage() {
  const params = useParams()
  const campaignId = params.id as string
  const t = useTranslations('savings')
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('overview')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)

  // Load campaign data
  const campaign = useLiveQuery(
    () => db.savingsCampaigns.get(campaignId),
    [campaignId]
  )

  const milestones = useLiveQuery(
    () => db.savingsMilestones.where('campaignId').equals(campaignId).sortBy('order'),
    [campaignId]
  ) || []

  const participants = useLiveQuery(
    () => db.savingsParticipants.where('campaignId').equals(campaignId).toArray(),
    [campaignId]
  ) || []

  const contributions = useLiveQuery(
    () => db.savingsContributions.where('campaignId').equals(campaignId).toArray(),
    [campaignId]
  ) || []

  const users = useLiveQuery(() => db.users.toArray()) || []

  // Calculate progress
  const progress = useMemo(() => {
    if (!campaign || campaign.goalAmount <= 0) return 0
    return Math.min(100, (campaign.currentAmount / campaign.goalAmount) * 100)
  }, [campaign])

  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    if (!campaign) return 0
    const today = new Date()
    const deadline = new Date(campaign.deadline)
    return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }, [campaign])

  // Format amount
  const formatAmount = (amount: number) => {
    if (!campaign) return `$ ${formatARS(amount)}`
    if (campaign.currency === 'USD') {
      return `US$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amount)}`
  }

  // Handle delete campaign
  const handleDeleteCampaign = async () => {
    if (!campaign) return

    try {
      // Get all related record IDs for sync-aware deletion
      const contributionIds = (await db.savingsContributions.where('campaignId').equals(campaignId).toArray()).map(c => c.id!)
      const participantIds = (await db.savingsParticipants.where('campaignId').equals(campaignId).toArray()).map(p => p.id!)
      const milestoneIds = (await db.savingsMilestones.where('campaignId').equals(campaignId).toArray()).map(m => m.id!)

      // Delete all related data with sync tracking
      await bulkDeleteWithSync(db.savingsContributions, 'savingsContributions', contributionIds)
      await bulkDeleteWithSync(db.savingsParticipants, 'savingsParticipants', participantIds)
      await bulkDeleteWithSync(db.savingsMilestones, 'savingsMilestones', milestoneIds)
      await deleteWithSync(db.savingsCampaigns, 'savingsCampaigns', campaignId)

      toast.success(t('messages.campaignDeleted'))
      router.push('/savings')
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error(t('messages.error'))
    }
  }

  // Handle mark as complete
  const handleMarkComplete = async () => {
    if (!campaign) return

    try {
      await db.savingsCampaigns.update(campaignId, {
        isCompleted: true,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      toast.success(t('messages.campaignCompleted'))
      setShowCompleteDialog(false)
    } catch (error) {
      console.error('Error completing campaign:', error)
      toast.error(t('messages.error'))
    }
  }

  // Handle reopen campaign
  const handleReopenCampaign = async () => {
    if (!campaign) return

    try {
      await db.savingsCampaigns.update(campaignId, {
        isCompleted: false,
        completedAt: undefined,
        updatedAt: new Date()
      })
      toast.success(t('messages.campaignReopened'))
    } catch (error) {
      console.error('Error reopening campaign:', error)
      toast.error(t('messages.error'))
    }
  }

  // Loading state
  if (!campaign) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
            <div className="h-12 w-64 bg-gray-200 dark:bg-gray-800 rounded mb-8" />
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/savings"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.backToList')}
        </Link>

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {campaign.name}
              </h1>
              <SavingMethodBadge method={campaign.savingMethod} showLabel />
              {campaign.isCompleted && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t('campaign.completed')}
                </Badge>
              )}
            </div>
            {campaign.description && (
              <p className="text-gray-600 dark:text-gray-400">
                {campaign.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {campaign.isCompleted ? (
              <Button variant="outline" onClick={handleReopenCampaign}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('detail.reopen')}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => setShowCompleteDialog(true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t('detail.markComplete')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEditDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('detail.edit')}
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Progress Bar with Milestones */}
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('campaign.progress', { percent: Math.round(progress) })}
                  </span>
                  <span className="text-sm font-medium">
                    {formatAmount(campaign.currentAmount)} {t('campaign.of')} {formatAmount(campaign.goalAmount)}
                  </span>
                </div>
                <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                      campaign.isCompleted ? 'bg-green-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                  {/* Milestone markers */}
                  {milestones.map((milestone) => {
                    const position = (milestone.targetAmount / campaign.goalAmount) * 100
                    if (position > 100) return null
                    return (
                      <div
                        key={milestone.id}
                        className="absolute top-0 h-full w-0.5 bg-gray-400 dark:bg-gray-500"
                        style={{ left: `${position}%` }}
                        title={milestone.name}
                      />
                    )
                  })}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatAmount(campaign.goalAmount - campaign.currentAmount)} {t('campaign.remaining')}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 flex-shrink-0">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                    {daysRemaining < 0 ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                  </div>
                  <p className={`text-2xl font-bold ${daysRemaining < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                    {Math.abs(daysRemaining)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {daysRemaining < 0 ? t('campaign.overdue') : t('campaign.daysLeft', { days: '' }).replace('{days}', '').trim()}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                    <Target className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {milestones.filter(m => m.isReached).length}/{milestones.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('milestones.title')}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                    <Users className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {participants.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('participants.title')}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {contributions.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('contributions.title')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
            <TabsTrigger value="analytics">{t('tabs.analytics')}</TabsTrigger>
            <TabsTrigger value="milestones">{t('tabs.milestones')}</TabsTrigger>
            <TabsTrigger value="contributions">{t('tabs.contributions')}</TabsTrigger>
            <TabsTrigger value="participants">{t('tabs.participants')}</TabsTrigger>
            <TabsTrigger value="settlement">{t('tabs.settlement')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              campaign={campaign}
              participants={participants}
              contributions={contributions}
              users={users}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab
              campaign={campaign}
              contributions={contributions}
            />
          </TabsContent>

          <TabsContent value="milestones">
            <MilestonesTab
              campaign={campaign}
              milestones={milestones}
            />
          </TabsContent>

          <TabsContent value="contributions">
            <ContributionsTab
              campaign={campaign}
              contributions={contributions}
              participants={participants}
              users={users}
            />
          </TabsContent>

          <TabsContent value="participants">
            <ParticipantsTab
              campaign={campaign}
              participants={participants}
              contributions={contributions}
              users={users}
            />
          </TabsContent>

          <TabsContent value="settlement">
            <SettlementTab
              campaign={campaign}
              participants={participants}
              contributions={contributions}
              users={users}
            />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <EditCampaignDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          campaign={campaign}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dialogs.delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('dialogs.delete.description', { name: campaign.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('dialogs.delete.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCampaign}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('dialogs.delete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Complete Confirmation Dialog */}
        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dialogs.complete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('dialogs.complete.description', { name: campaign.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('dialogs.complete.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleMarkComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                {t('dialogs.complete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
