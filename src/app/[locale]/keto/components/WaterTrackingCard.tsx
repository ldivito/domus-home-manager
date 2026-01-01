"use client"

import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Droplets, Plus, Minus, Settings } from "lucide-react"
import { KetoWaterEntry } from "@/lib/db"

interface WaterTrackingCardProps {
  todayEntry: KetoWaterEntry | undefined
  weekEntries: KetoWaterEntry[]
  defaultGoal: number
  onUpdateWater: (glasses: number, goalGlasses: number) => Promise<void>
}

export default function WaterTrackingCard({
  todayEntry,
  weekEntries,
  defaultGoal,
  onUpdateWater,
}: WaterTrackingCardProps) {
  const t = useTranslations('keto')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [goalInput, setGoalInput] = useState(String(todayEntry?.goalGlasses || defaultGoal))

  const currentGlasses = todayEntry?.glasses || 0
  const currentGoal = todayEntry?.goalGlasses || defaultGoal
  const progress = Math.min(100, (currentGlasses / currentGoal) * 100)

  const weekStats = useMemo(() => {
    if (!weekEntries.length) return { avgGlasses: 0, daysHitGoal: 0 }

    const totalGlasses = weekEntries.reduce((sum, e) => sum + e.glasses, 0)
    const daysHitGoal = weekEntries.filter(e => e.glasses >= e.goalGlasses).length

    return {
      avgGlasses: Math.round(totalGlasses / weekEntries.length * 10) / 10,
      daysHitGoal,
    }
  }, [weekEntries])

  const handleAddGlass = async () => {
    await onUpdateWater(currentGlasses + 1, currentGoal)
  }

  const handleRemoveGlass = async () => {
    if (currentGlasses > 0) {
      await onUpdateWater(currentGlasses - 1, currentGoal)
    }
  }

  const handleSaveGoal = async () => {
    const newGoal = parseInt(goalInput) || defaultGoal
    await onUpdateWater(currentGlasses, newGoal)
    setIsSettingsOpen(false)
  }

  // Generate glass icons
  const glassIcons = Array.from({ length: Math.max(currentGoal, currentGlasses) }, (_, i) => {
    const isFilled = i < currentGlasses
    const isOverGoal = i >= currentGoal
    return (
      <div
        key={i}
        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all ${
          isFilled
            ? isOverGoal
              ? 'bg-blue-300 text-blue-700'
              : 'bg-blue-500 text-white'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <Droplets className="h-3 w-3 sm:h-4 sm:w-4" />
      </div>
    )
  })

  return (
    <>
      <Card className="glass-card shadow-modern">
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
                <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                {t('water.title')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('water.description')}
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsSettingsOpen(true)}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0 space-y-4">
          {/* Today's Progress */}
          <div className="text-center">
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-blue-500 mb-1">
              {currentGlasses}
              <span className="text-lg sm:text-xl md:text-2xl text-muted-foreground">/{currentGoal}</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('water.glassesToday')}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className={progress >= 100 ? 'text-green-500 font-medium' : ''}>
                {progress >= 100 ? t('water.goalReached') : `${Math.round(progress)}%`}
              </span>
              <span>{currentGoal}</span>
            </div>
          </div>

          {/* Glass Icons */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {glassIcons}
          </div>

          {/* Add/Remove Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={handleRemoveGlass}
              variant="outline"
              size="icon"
              disabled={currentGlasses === 0}
              className="h-12 w-12 rounded-full"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleAddGlass}
              size="icon"
              className="h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="h-6 w-6" />
            </Button>
            <Button
              onClick={handleRemoveGlass}
              variant="outline"
              size="icon"
              disabled={currentGlasses === 0}
              className="h-12 w-12 rounded-full invisible"
            >
              <Minus className="h-5 w-5" />
            </Button>
          </div>

          {/* Week Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <div className="text-center p-2 bg-blue-500/10 rounded-lg">
              <div className="text-lg sm:text-xl font-bold text-blue-600">
                {weekStats.avgGlasses}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                {t('water.weeklyAvg')}
              </div>
            </div>
            <div className="text-center p-2 bg-green-500/10 rounded-lg">
              <div className="text-lg sm:text-xl font-bold text-green-600">
                {weekStats.daysHitGoal}/7
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                {t('water.daysHitGoal')}
              </div>
            </div>
          </div>

          {/* This Week's Daily Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-foreground">{t('water.thisWeek')}</h4>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date()
                date.setDate(date.getDate() - date.getDay() + i)
                const dateKey = date.toISOString().split('T')[0]
                const entry = weekEntries.find(e => {
                  const entryDate = e.date instanceof Date ? e.date : new Date(e.date)
                  return entryDate.toISOString().split('T')[0] === dateKey
                })
                const isToday = date.toDateString() === new Date().toDateString()
                const hitGoal = entry && entry.glasses >= entry.goalGlasses

                return (
                  <div key={i} className="text-center">
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground mb-0.5">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]}
                    </div>
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto rounded-full flex items-center justify-center text-[9px] sm:text-xs font-medium ${
                        isToday ? 'ring-2 ring-primary ring-offset-1' : ''
                      } ${
                        hitGoal
                          ? 'bg-green-500 text-white'
                          : entry
                          ? 'bg-blue-200 text-blue-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {entry ? entry.glasses : '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              {t('water.settingsTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('water.settingsDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="water-goal">{t('water.dailyGoal')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="water-goal"
                  type="number"
                  min="1"
                  max="20"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="text-center text-lg"
                />
                <span className="text-sm text-muted-foreground">{t('water.glasses')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('water.glassSize')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleSaveGoal}>
              {t('water.saveGoal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
