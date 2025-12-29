'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SavingsCampaign, SavingsParticipant, SavingsContribution, User, db, deleteWithSync, bulkDeleteWithSync } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Users, Trash2, TrendingUp, TrendingDown, CheckCircle2, Percent } from 'lucide-react'
import { logger } from '@/lib/logger'

interface ParticipantsTabProps {
  campaign: SavingsCampaign
  participants: SavingsParticipant[]
  contributions: SavingsContribution[]
  users: User[]
}

export function ParticipantsTab({ campaign, participants, contributions, users }: ParticipantsTabProps) {
  const t = useTranslations('savings')

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<SavingsParticipant | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [sharePercentage, setSharePercentage] = useState('')

  // Format amount
  const formatAmount = (amt: number) => {
    if (campaign.currency === 'USD') {
      return `US$ ${amt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$ ${formatARS(amt)}`
  }

  // Get non-participant users
  const nonParticipantUsers = users.filter(
    u => !participants.some(p => p.userId === u.id)
  )

  // Calculate participant stats
  const participantStats = useMemo(() => {
    return participants.map(participant => {
      const user = users.find(u => u.id === participant.userId)
      const userContributions = contributions.filter(c => c.userId === participant.userId)
      const contributed = userContributions.reduce((sum, c) => sum + c.amount, 0)

      let expected: number
      if (campaign.distributionMethod === 'percentage') {
        expected = ((participant.sharePercentage || 0) / 100) * campaign.goalAmount
      } else {
        expected = campaign.goalAmount / participants.length
      }

      const progressRatio = campaign.currentAmount / campaign.goalAmount
      const expectedByNow = expected * progressRatio
      const owes = Math.max(0, expectedByNow - contributed)

      let status: 'ahead' | 'onTrack' | 'behind' = 'onTrack'
      if (contributed > expectedByNow * 1.05) status = 'ahead'
      else if (contributed < expectedByNow * 0.95) status = 'behind'

      return {
        participant,
        user,
        contributed,
        expected,
        owes,
        status,
        percentage: campaign.distributionMethod === 'percentage' ? participant.sharePercentage : undefined
      }
    })
  }, [campaign, participants, contributions, users])

  // Reset form
  const resetForm = () => {
    setSelectedUserId('')
    setSharePercentage('')
    setSelectedParticipant(null)
  }

  // Handle add participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      toast.error(t('participants.selectUser'))
      return
    }

    if (campaign.distributionMethod === 'percentage') {
      const pct = parseFloat(sharePercentage)
      if (isNaN(pct) || pct < 0 || pct > 100) {
        toast.error(t('validation.percentageTotal'))
        return
      }
    }

    setIsSubmitting(true)

    try {
      await db.savingsParticipants.add({
        id: generateId('spt'),
        campaignId: campaign.id!,
        userId: selectedUserId,
        sharePercentage: campaign.distributionMethod === 'percentage' ? parseFloat(sharePercentage) : undefined,
        isActive: true,
        joinedAt: new Date(),
        createdAt: new Date()
      })

      toast.success(t('messages.participantAdded'))
      resetForm()
      setShowAddDialog(false)
    } catch (error) {
      logger.error('Error adding participant:', error)
      toast.error(t('messages.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle update percentage
  const handleUpdatePercentage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedParticipant) return

    const pct = parseFloat(sharePercentage)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error(t('validation.percentageTotal'))
      return
    }

    setIsSubmitting(true)

    try {
      await db.savingsParticipants.update(selectedParticipant.id!, {
        sharePercentage: pct,
        updatedAt: new Date()
      })

      toast.success(t('messages.participantUpdated'))
      resetForm()
      setShowEditDialog(false)
    } catch (error) {
      logger.error('Error updating participant:', error)
      toast.error(t('messages.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle remove participant
  const handleRemoveParticipant = async () => {
    if (!selectedParticipant) return

    try {
      // Delete participant's contributions first
      const contributionIds = (await db.savingsContributions
        .where('participantId')
        .equals(selectedParticipant.id!)
        .toArray()).map(c => c.id!)
      await bulkDeleteWithSync(db.savingsContributions, 'savingsContributions', contributionIds)

      // Then delete participant
      await deleteWithSync(db.savingsParticipants, 'savingsParticipants', selectedParticipant.id!)

      // Update campaign amount
      const remainingContributions = await db.savingsContributions
        .where('campaignId')
        .equals(campaign.id!)
        .toArray()
      const total = remainingContributions.reduce((sum, c) => sum + c.amount, 0)
      await db.savingsCampaigns.update(campaign.id!, {
        currentAmount: total,
        updatedAt: new Date()
      })

      toast.success(t('messages.participantRemoved'))
      setShowRemoveDialog(false)
      setSelectedParticipant(null)
    } catch (error) {
      logger.error('Error removing participant:', error)
      toast.error(t('messages.error'))
    }
  }

  // Current total percentage
  const currentTotalPercentage = participants.reduce((sum, p) => sum + (p.sharePercentage || 0), 0)

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              {t('participants.title')}
            </h3>
            {campaign.distributionMethod === 'percentage' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('participants.currentTotal', { total: currentTotalPercentage })}
              </p>
            )}
          </div>
          <Button
            onClick={() => { resetForm(); setShowAddDialog(true); }}
            size="sm"
            disabled={nonParticipantUsers.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('participants.addParticipant')}
          </Button>
        </div>

        {participants.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('participants.noParticipants')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {participantStats.map(({ participant, user, contributed, expected, owes, status, percentage }) => (
              <div
                key={participant.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback style={{ backgroundColor: user?.color }} className="text-lg">
                    {user?.name.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-lg">{user?.name || 'Unknown'}</span>
                    {status === 'ahead' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-0.5">
                        <TrendingUp className="h-3 w-3" />
                        {t('participants.ahead')}
                      </Badge>
                    )}
                    {status === 'behind' && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-0.5">
                        <TrendingDown className="h-3 w-3" />
                        {t('participants.behind')}
                      </Badge>
                    )}
                    {status === 'onTrack' && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 gap-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('participants.onTrack')}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('participants.share')}</p>
                      <p className="font-medium">
                        {percentage !== undefined ? `${percentage}%` : `1/${participants.length}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('participants.contributed')}</p>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {formatAmount(contributed)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('participants.owes')}</p>
                      <p className={`font-medium ${owes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {formatAmount(owes)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (contributed / expected) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatAmount(contributed)} / {formatAmount(expected)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {campaign.distributionMethod === 'percentage' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedParticipant(participant)
                        setSharePercentage((participant.sharePercentage || 0).toString())
                        setShowEditDialog(true)
                      }}
                    >
                      <Percent className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setSelectedParticipant(participant)
                      setShowRemoveDialog(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Participant Dialog */}
        <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowAddDialog(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('participants.addParticipant')}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddParticipant} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('participants.selectUser')}</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('participants.selectUser')} />
                  </SelectTrigger>
                  <SelectContent>
                    {nonParticipantUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id!}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          {user.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {campaign.distributionMethod === 'percentage' && (
                <div className="space-y-2">
                  <Label htmlFor="sharePercentage">{t('form.sharePercentage')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="sharePercentage"
                      type="number"
                      value={sharePercentage}
                      onChange={(e) => setSharePercentage(e.target.value)}
                      placeholder="0"
                      min="0"
                      max="100"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('participants.currentTotal', { total: currentTotalPercentage })}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowAddDialog(false); }}>
                  {t('form.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('form.saving') : t('form.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Percentage Dialog */}
        <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowEditDialog(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('participants.editParticipant')}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleUpdatePercentage} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editSharePercentage">{t('form.sharePercentage')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="editSharePercentage"
                    type="number"
                    value={sharePercentage}
                    onChange={(e) => setSharePercentage(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                  <span className="text-gray-500">%</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowEditDialog(false); }}>
                  {t('form.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('form.updating') : t('form.update')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Remove Confirmation Dialog */}
        <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('participants.removeParticipant')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('participants.removeConfirm')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('form.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveParticipant} className="bg-red-600 hover:bg-red-700">
                {t('participants.removeParticipant')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
