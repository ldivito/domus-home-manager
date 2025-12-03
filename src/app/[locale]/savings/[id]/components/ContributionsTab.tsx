'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SavingsCampaign, SavingsContribution, SavingsParticipant, User, db, deleteWithSync } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { toast } from 'sonner'
import { Plus, TrendingUp, Trash2, Calendar } from 'lucide-react'
import { QuickContributeCard } from './QuickContributeCard'

interface ContributionsTabProps {
  campaign: SavingsCampaign
  contributions: SavingsContribution[]
  participants: SavingsParticipant[]
  users: User[]
}

export function ContributionsTab({ campaign, contributions, participants, users }: ContributionsTabProps) {
  const t = useTranslations('savings')

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedContribution, setSelectedContribution] = useState<SavingsContribution | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [amount, setAmount] = useState('')
  const [contributorId, setContributorId] = useState('')
  const [contributionDate, setContributionDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // Format amount
  const formatAmount = (amt: number) => {
    if (campaign.currency === 'USD') {
      return `US$ ${amt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amt)}`
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Get participant users
  const participantUsers = participants.map(p => {
    const user = users.find(u => u.id === p.userId)
    return { participant: p, user }
  }).filter(({ user }) => user !== undefined)

  // Reset form
  const resetForm = () => {
    setAmount('')
    setContributorId('')
    setContributionDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setSelectedContribution(null)
  }

  // Calculate total contributions
  const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0)

  // Update campaign's current amount
  const updateCampaignAmount = async () => {
    const allContributions = await db.savingsContributions
      .where('campaignId')
      .equals(campaign.id!)
      .toArray()
    const total = allContributions.reduce((sum, c) => sum + c.amount, 0)

    const isNowComplete = total >= campaign.goalAmount && !campaign.isCompleted

    await db.savingsCampaigns.update(campaign.id!, {
      currentAmount: total,
      updatedAt: new Date(),
      ...(isNowComplete ? { isCompleted: true, completedAt: new Date() } : {})
    })

    if (isNowComplete) {
      toast.success(t('messages.goalReached'))
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('validation.contributionAmountPositive'))
      return
    }

    if (!contributorId) {
      toast.error(t('validation.contributorRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      const participant = participants.find(p => p.userId === contributorId)
      if (!participant) {
        toast.error(t('messages.error'))
        return
      }

      await db.savingsContributions.add({
        id: generateId('scn'),
        campaignId: campaign.id!,
        participantId: participant.id!,
        userId: contributorId,
        amount: amountNum,
        currency: campaign.currency,
        contributionDate: new Date(contributionDate),
        notes: notes.trim() || undefined,
        createdAt: new Date()
      })

      await updateCampaignAmount()
      toast.success(t('messages.contributionAdded'))
      resetForm()
      setShowAddDialog(false)
    } catch (error) {
      console.error('Error adding contribution:', error)
      toast.error(t('messages.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedContribution) return

    try {
      await deleteWithSync(db.savingsContributions, 'savingsContributions', selectedContribution.id!)
      await updateCampaignAmount()
      toast.success(t('messages.contributionDeleted'))
      setShowDeleteDialog(false)
      setSelectedContribution(null)
    } catch (error) {
      console.error('Error deleting contribution:', error)
      toast.error(t('messages.error'))
    }
  }

  // Sort contributions by date (newest first)
  const sortedContributions = [...contributions].sort(
    (a, b) => new Date(b.contributionDate).getTime() - new Date(a.contributionDate).getTime()
  )

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              {t('contributions.title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('contributions.total')}: {formatAmount(totalContributions)}
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('contributions.addContribution')}
          </Button>
        </div>

        {/* Quick Contribute Card */}
        {!campaign.isCompleted && participants.length > 0 && (
          <div className="mb-6">
            <QuickContributeCard
              campaign={campaign}
              participants={participants}
              contributions={contributions}
              users={users}
              onContributionAdded={() => updateCampaignAmount()}
            />
          </div>
        )}

        {contributions.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-1">
              {t('contributions.noContributions')}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t('contributions.noContributionsDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedContributions.map((contribution) => {
              const user = users.find(u => u.id === contribution.userId)

              return (
                <div
                  key={contribution.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback style={{ backgroundColor: user?.color }}>
                      {user?.name.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {formatDate(contribution.contributionDate)}
                      {contribution.notes && (
                        <span className="truncate">• {contribution.notes}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      +{formatAmount(contribution.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setSelectedContribution(contribution)
                        setShowDeleteDialog(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add Contribution Dialog */}
        <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowAddDialog(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('contributions.addContribution')}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contributor">{t('contributions.contributor')}</Label>
                <Select value={contributorId} onValueChange={setContributorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contributions.selectContributor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {participantUsers.map(({ participant, user }) => (
                      <SelectItem key={participant.id} value={user!.id!}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                            style={{ backgroundColor: user!.color }}
                          >
                            {user!.name.charAt(0).toUpperCase()}
                          </div>
                          {user!.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contributionAmount">{t('contributions.amount')}</Label>
                <Input
                  id="contributionAmount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contributionDate">{t('contributions.date')}</Label>
                <Input
                  id="contributionDate"
                  type="date"
                  value={contributionDate}
                  onChange={(e) => setContributionDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contributionNotes">{t('contributions.notes')}</Label>
                <Textarea
                  id="contributionNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('contributions.notesPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { resetForm(); setShowAddDialog(false); }}
                >
                  {t('form.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('form.saving') : t('form.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('contributions.delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('contributions.deleteConfirm')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('form.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                {t('contributions.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
