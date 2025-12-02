'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { db, User, SavingMethod, DistributionMethod } from '@/lib/db'
import { generateId } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Calendar,
  Wallet,
  ArrowUpCircle,
  CalendarDays,
  CalendarRange,
  Settings,
  Users,
  Percent,
  Equal
} from 'lucide-react'

interface AddCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: User[]
}

const savingMethods: { value: SavingMethod; icon: React.ElementType }[] = [
  { value: '52_week_challenge', icon: Calendar },
  { value: 'envelope_method', icon: Wallet },
  { value: 'round_up', icon: ArrowUpCircle },
  { value: 'fixed_monthly', icon: CalendarDays },
  { value: 'bi_weekly', icon: CalendarRange },
  { value: 'custom', icon: Settings },
]

export function AddCampaignDialog({ open, onOpenChange, users }: AddCampaignDialogProps) {
  const t = useTranslations('savings')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [deadline, setDeadline] = useState('')
  const [savingMethod, setSavingMethod] = useState<SavingMethod>('fixed_monthly')
  const [customMethodDetails, setCustomMethodDetails] = useState('')
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('equal')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userPercentages, setUserPercentages] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form
  const resetForm = () => {
    setName('')
    setDescription('')
    setGoalAmount('')
    setCurrency('ARS')
    setDeadline('')
    setSavingMethod('fixed_monthly')
    setCustomMethodDetails('')
    setDistributionMethod('equal')
    setSelectedUserIds([])
    setUserPercentages({})
  }

  // Handle user selection toggle
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        const newSelection = prev.filter(id => id !== userId)
        // Remove percentage for unselected user
        const newPercentages = { ...userPercentages }
        delete newPercentages[userId]
        setUserPercentages(newPercentages)
        return newSelection
      } else {
        return [...prev, userId]
      }
    })
  }

  // Calculate total percentage
  const totalPercentage = Object.values(userPercentages).reduce((sum, p) => sum + (p || 0), 0)

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast.error(t('validation.nameRequired'))
      return
    }

    const goal = parseFloat(goalAmount)
    if (isNaN(goal) || goal <= 0) {
      toast.error(t('validation.goalPositive'))
      return
    }

    if (!deadline) {
      toast.error(t('validation.deadlineRequired'))
      return
    }

    const deadlineDate = new Date(deadline)
    if (deadlineDate <= new Date()) {
      toast.error(t('validation.deadlineFuture'))
      return
    }

    if (selectedUserIds.length === 0) {
      toast.error(t('validation.participantsRequired'))
      return
    }

    if (distributionMethod === 'percentage' && totalPercentage !== 100) {
      toast.error(t('validation.percentageTotal'))
      return
    }

    setIsSubmitting(true)

    try {
      const campaignId = generateId('sav')

      // Create campaign
      await db.savingsCampaigns.add({
        id: campaignId,
        name: name.trim(),
        description: description.trim() || undefined,
        goalAmount: goal,
        currency,
        deadline: deadlineDate,
        savingMethod,
        customMethodDetails: savingMethod === 'custom' ? customMethodDetails.trim() : undefined,
        distributionMethod,
        currentAmount: 0,
        isActive: true,
        isCompleted: false,
        createdAt: new Date(),
      })

      // Create participants
      const participantPromises = selectedUserIds.map(userId => {
        const participantId = generateId('spt')
        return db.savingsParticipants.add({
          id: participantId,
          campaignId,
          userId,
          sharePercentage: distributionMethod === 'percentage' ? userPercentages[userId] : undefined,
          isActive: true,
          joinedAt: new Date(),
          createdAt: new Date(),
        })
      })

      await Promise.all(participantPromises)

      toast.success(t('messages.campaignCreated'))
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating campaign:', error)
      toast.error(t('messages.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('addCampaign')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('form.name')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">{t('form.deadline')}</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('form.description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goalAmount">{t('form.goalAmount')}</Label>
                <Input
                  id="goalAmount"
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">{t('form.currency')}</Label>
                <Select value={currency} onValueChange={(v: 'ARS' | 'USD') => setCurrency(v)}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Saving Method Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t('form.savingMethod')}</Label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {savingMethods.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSavingMethod(value)}
                  className={`p-5 rounded-xl border-2 transition-all text-left hover:shadow-md ${
                    savingMethod === value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-md ring-2 ring-purple-200 dark:ring-purple-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2.5 rounded-lg ${savingMethod === value ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Icon className={`h-5 w-5 ${savingMethod === value ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <span className={`font-semibold ${savingMethod === value ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t(`methods.${value}.name`)}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${savingMethod === value ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t(`methods.${value}.description`)}
                  </p>
                </button>
              ))}
            </div>

            {savingMethod === 'custom' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="customMethodDetails">{t('form.customMethodDetails')}</Label>
                <Textarea
                  id="customMethodDetails"
                  value={customMethodDetails}
                  onChange={(e) => setCustomMethodDetails(e.target.value)}
                  placeholder={t('form.customMethodPlaceholder')}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Participants Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-5 w-5 text-purple-500" />
                {t('form.participants')}
              </Label>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {users.map((user) => (
                <label
                  key={user.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm ${
                    selectedUserIds.includes(user.id!)
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-900'
                  }`}
                >
                  <Checkbox
                    checked={selectedUserIds.includes(user.id!)}
                    onCheckedChange={() => toggleUserSelection(user.id!)}
                    className="h-5 w-5"
                  />
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium truncate">{user.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Distribution Method Section */}
          {selectedUserIds.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">{t('distribution.title')}</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setDistributionMethod('equal')}
                  className={`p-5 rounded-xl border-2 transition-all text-left hover:shadow-md ${
                    distributionMethod === 'equal'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-md ring-2 ring-purple-200 dark:ring-purple-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2.5 rounded-lg ${distributionMethod === 'equal' ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Equal className={`h-5 w-5 ${distributionMethod === 'equal' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <span className={`font-semibold ${distributionMethod === 'equal' ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t('distribution.equal')}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${distributionMethod === 'equal' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t('distribution.equalDescription')}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionMethod('percentage')}
                  className={`p-5 rounded-xl border-2 transition-all text-left hover:shadow-md ${
                    distributionMethod === 'percentage'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-md ring-2 ring-purple-200 dark:ring-purple-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2.5 rounded-lg ${distributionMethod === 'percentage' ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Percent className={`h-5 w-5 ${distributionMethod === 'percentage' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <span className={`font-semibold ${distributionMethod === 'percentage' ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t('distribution.percentage')}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${distributionMethod === 'percentage' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t('distribution.percentageDescription')}
                  </p>
                </button>
              </div>

              {/* Percentage inputs when percentage distribution is selected */}
              {distributionMethod === 'percentage' && (
                <div className="space-y-3 p-5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-medium">{t('form.sharePercentage')}</Label>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${totalPercentage === 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30'}`}>
                      {t('participants.currentTotal', { total: totalPercentage })}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedUserIds.map(userId => {
                      const user = users.find(u => u.id === userId)
                      if (!user) return null
                      return (
                        <div key={userId} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium flex-1 truncate">{user.name}</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={userPercentages[userId] || ''}
                              onChange={(e) => setUserPercentages(prev => ({
                                ...prev,
                                [userId]: parseFloat(e.target.value) || 0
                              }))}
                              placeholder="0"
                              min="0"
                              max="100"
                              className="w-24 text-right font-medium"
                            />
                            <span className="text-sm font-medium text-gray-500">%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="px-6"
            >
              {t('form.cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('form.creating') : t('form.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
