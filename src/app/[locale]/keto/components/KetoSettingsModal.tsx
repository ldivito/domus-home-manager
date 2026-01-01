"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Settings, Target, Trash2 } from "lucide-react"
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

export interface KetoSettingsData {
  startDate: Date
  goalWeight?: number
  weightUnit?: 'kg' | 'lb'
  targetDate?: Date
}

interface KetoSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStartDate?: Date | string
  currentGoalWeight?: number
  currentWeightUnit?: 'kg' | 'lb'
  currentTargetDate?: Date | string
  onSave: (settings: KetoSettingsData) => void
  onReset: () => Promise<void>
  userName?: string
}

export default function KetoSettingsModal({
  open,
  onOpenChange,
  currentStartDate,
  currentGoalWeight,
  currentWeightUnit = 'kg',
  currentTargetDate,
  onSave,
  onReset,
  userName,
}: KetoSettingsModalProps) {
  const t = useTranslations('keto')
  const [startDate, setStartDate] = useState("")
  const [goalWeight, setGoalWeight] = useState("")
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg')
  const [targetDate, setTargetDate] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState("")

  useEffect(() => {
    if (currentStartDate) {
      const date = currentStartDate instanceof Date ? currentStartDate : new Date(currentStartDate)
      const formatted = date.toISOString().split('T')[0]
      setStartDate(formatted)
    } else {
      const today = new Date().toISOString().split('T')[0]
      setStartDate(today)
    }

    if (currentGoalWeight) {
      setGoalWeight(currentGoalWeight.toString())
    } else {
      setGoalWeight("")
    }

    setWeightUnit(currentWeightUnit || 'kg')

    if (currentTargetDate) {
      const date = currentTargetDate instanceof Date ? currentTargetDate : new Date(currentTargetDate)
      const formatted = date.toISOString().split('T')[0]
      setTargetDate(formatted)
    } else {
      setTargetDate("")
    }
  }, [currentStartDate, currentGoalWeight, currentWeightUnit, currentTargetDate, open])

  const handleSave = async () => {
    if (!startDate) return

    setIsSaving(true)
    try {
      const settings: KetoSettingsData = {
        startDate: new Date(startDate + "T00:00:00.000Z"),
        weightUnit,
      }

      if (goalWeight) {
        settings.goalWeight = parseFloat(goalWeight)
      }

      if (targetDate) {
        settings.targetDate = new Date(targetDate + "T00:00:00.000Z")
      }

      await onSave(settings)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (resetConfirmText.toLowerCase() !== 'reset') return

    setIsResetting(true)
    try {
      await onReset()
      setShowResetConfirm(false)
      setResetConfirmText("")
      onOpenChange(false)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('settings.title')}
              {userName && <span className="text-muted-foreground font-normal text-base">- {userName}</span>}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              {t('settings.description')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general" className="text-xs sm:text-sm">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {t('settings.generalTab')}
              </TabsTrigger>
              <TabsTrigger value="goals" className="text-xs sm:text-sm">
                <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {t('settings.goalsTab')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid gap-3">
                <Label htmlFor="start-date" className="text-sm sm:text-base font-medium">
                  {t('settings.startDate')}
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm sm:text-base"
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.startDateLabel')}
                </p>
              </div>

              {/* Reset Section */}
              <div className="pt-4 border-t">
                <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-destructive text-sm">
                      {t('settings.resetTitle')}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('settings.resetDescription')}
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {t('settings.resetButton')}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="goals" className="space-y-4 mt-4">
              <div className="grid gap-3">
                <Label htmlFor="weight-unit" className="text-sm sm:text-base font-medium">
                  {t('settings.weightUnit')}
                </Label>
                <Select value={weightUnit} onValueChange={(v) => setWeightUnit(v as 'kg' | 'lb')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">{t('settings.kilograms')}</SelectItem>
                    <SelectItem value="lb">{t('settings.pounds')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="goal-weight" className="text-sm sm:text-base font-medium">
                  {t('settings.goalWeight')} ({weightUnit})
                </Label>
                <Input
                  id="goal-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                  placeholder={t('settings.goalWeightPlaceholder')}
                  className="text-sm sm:text-base"
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.goalWeightDescription')}
                </p>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="target-date" className="text-sm sm:text-base font-medium">
                  {t('settings.targetDate')}
                </Label>
                <Input
                  id="target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="text-sm sm:text-base"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.targetDateDescription')}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t('settings.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!startDate || isSaving}
            >
              {isSaving ? "..." : t('settings.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('settings.resetConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{t('settings.resetConfirmDescription')}</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>{t('settings.resetWillDelete1')}</li>
                <li>{t('settings.resetWillDelete2')}</li>
                <li>{t('settings.resetWillDelete3')}</li>
              </ul>
              <div className="pt-2">
                <Label htmlFor="reset-confirm" className="text-sm font-medium">
                  {t('settings.resetConfirmLabel')}
                </Label>
                <Input
                  id="reset-confirm"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>
              {t('settings.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={resetConfirmText.toLowerCase() !== 'reset' || isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? "..." : t('settings.confirmReset')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
