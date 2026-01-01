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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Ruler, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { KetoBodyMeasurement } from "@/lib/db"

interface BodyMeasurementsCardProps {
  measurements: KetoBodyMeasurement[]
  measurementUnit: 'cm' | 'in'
  onAddMeasurement: (data: Omit<KetoBodyMeasurement, 'id' | 'householdId' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>
}

export default function BodyMeasurementsCard({
  measurements,
  measurementUnit,
  onAddMeasurement,
}: BodyMeasurementsCardProps) {
  const t = useTranslations('keto')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    waist: '',
    hips: '',
    chest: '',
    arms: '',
    thighs: '',
    neck: '',
    unit: measurementUnit,
    notes: '',
  })

  const stats = useMemo(() => {
    if (!measurements.length) {
      return { current: null, first: null, changes: {} as Record<string, number | null> }
    }

    const sorted = [...measurements].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateA.getTime() - dateB.getTime()
    })

    const first = sorted[0]
    const current = sorted[sorted.length - 1]

    const calculateChange = (field: keyof KetoBodyMeasurement): number | null => {
      const firstVal = first[field] as number | undefined
      const currentVal = current[field] as number | undefined
      if (firstVal && currentVal) {
        return currentVal - firstVal
      }
      return null
    }

    return {
      current,
      first,
      changes: {
        waist: calculateChange('waist'),
        hips: calculateChange('hips'),
        chest: calculateChange('chest'),
        arms: calculateChange('arms'),
        thighs: calculateChange('thighs'),
        neck: calculateChange('neck'),
      } as Record<string, number | null>
    }
  }, [measurements])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onAddMeasurement({
        date: new Date(formData.date + "T00:00:00.000Z"),
        waist: formData.waist ? parseFloat(formData.waist) : undefined,
        hips: formData.hips ? parseFloat(formData.hips) : undefined,
        chest: formData.chest ? parseFloat(formData.chest) : undefined,
        arms: formData.arms ? parseFloat(formData.arms) : undefined,
        thighs: formData.thighs ? parseFloat(formData.thighs) : undefined,
        neck: formData.neck ? parseFloat(formData.neck) : undefined,
        unit: formData.unit as 'cm' | 'in',
        notes: formData.notes || undefined,
      })
      setIsDialogOpen(false)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        waist: '',
        hips: '',
        chest: '',
        arms: '',
        thighs: '',
        neck: '',
        unit: measurementUnit,
        notes: '',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const formatChange = (change: number | null) => {
    if (change === null) return null
    const prefix = change > 0 ? '+' : ''
    return `${prefix}${change.toFixed(1)}`
  }

  const getTrendIcon = (change: number | null) => {
    if (change === null) return null
    if (change < -0.5) return <TrendingDown className="h-3 w-3 text-green-500" />
    if (change > 0.5) return <TrendingUp className="h-3 w-3 text-red-500" />
    return <Minus className="h-3 w-3 text-yellow-500" />
  }

  const measurementFields = [
    { key: 'waist', label: t('measurements.waist') },
    { key: 'hips', label: t('measurements.hips') },
    { key: 'chest', label: t('measurements.chest') },
    { key: 'arms', label: t('measurements.arms') },
    { key: 'thighs', label: t('measurements.thighs') },
    { key: 'neck', label: t('measurements.neck') },
  ] as const

  return (
    <>
      <Card className="glass-card shadow-modern">
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
                <Ruler className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('measurements.title')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('measurements.description')}
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t('measurements.add')}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          {!measurements.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Ruler className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('measurements.noEntries')}
              </p>
              <Button onClick={() => setIsDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('measurements.addFirst')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Measurements Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {measurementFields.map(({ key, label }) => {
                  const current = stats.current?.[key] as number | undefined
                  const change = stats.changes[key] ?? null

                  if (!current) return null

                  return (
                    <div
                      key={key}
                      className="p-2 sm:p-3 bg-muted/50 rounded-lg text-center"
                    >
                      <div className="text-lg sm:text-xl font-bold text-foreground">
                        {current.toFixed(1)} {stats.current?.unit}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        {label}
                      </div>
                      {change !== null && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {getTrendIcon(change)}
                          <span className={`text-[10px] sm:text-xs ${
                            change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {formatChange(change)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Total Change Summary */}
              {Object.values(stats.changes).some(c => c !== null) && (
                <div className="p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                  <h4 className="text-xs font-medium text-foreground mb-2">
                    {t('measurements.totalChange')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {measurementFields.map(({ key, label }) => {
                      const change = stats.changes[key] ?? null
                      if (change === null) return null
                      return (
                        <span
                          key={key}
                          className={`text-xs px-2 py-0.5 rounded ${
                            change < 0
                              ? 'bg-green-500/20 text-green-600'
                              : change > 0
                              ? 'bg-red-500/20 text-red-600'
                              : 'bg-yellow-500/20 text-yellow-600'
                          }`}
                        >
                          {label}: {formatChange(change)} {stats.current?.unit}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recent Entries Table */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('measurements.history')}</h4>
                <div className="max-h-32 overflow-y-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">{t('measurements.date')}</th>
                        <th className="text-right p-2">{t('measurements.waist')}</th>
                        <th className="text-right p-2 hidden sm:table-cell">{t('measurements.hips')}</th>
                        <th className="text-right p-2 hidden sm:table-cell">{t('measurements.chest')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...measurements]
                        .sort((a, b) => {
                          const dateA = a.date instanceof Date ? a.date : new Date(a.date)
                          const dateB = b.date instanceof Date ? b.date : new Date(b.date)
                          return dateB.getTime() - dateA.getTime()
                        })
                        .slice(0, 5)
                        .map((entry) => {
                          const date = entry.date instanceof Date ? entry.date : new Date(entry.date)
                          return (
                            <tr key={entry.id} className="border-t hover:bg-muted/30">
                              <td className="p-2">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                              <td className="p-2 text-right">{entry.waist ? `${entry.waist} ${entry.unit}` : '-'}</td>
                              <td className="p-2 text-right hidden sm:table-cell">{entry.hips ? `${entry.hips} ${entry.unit}` : '-'}</td>
                              <td className="p-2 text-right hidden sm:table-cell">{entry.chest ? `${entry.chest} ${entry.unit}` : '-'}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Measurement Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              {t('measurements.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('measurements.addDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="measurement-date">{t('measurements.date')}</Label>
                <Input
                  id="measurement-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="measurement-unit">{t('measurements.unit')}</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v as 'cm' | 'in' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cm">{t('measurements.centimeters')}</SelectItem>
                    <SelectItem value="in">{t('measurements.inches')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {measurementFields.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`measurement-${key}`}>{label} ({formData.unit})</Label>
                  <Input
                    id={`measurement-${key}`}
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData[key]}
                    onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="0.0"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="measurement-notes">{t('measurements.notes')}</Label>
              <Input
                id="measurement-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('measurements.notesPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? '...' : t('measurements.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
