"use client"

import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Activity,
  Brain,
  Cookie,
  Moon,
  Smile,
  Zap,
  AlertCircle,
  Battery,
  ThermometerSun,
  Plus,
  MoreHorizontal
} from "lucide-react"
import { KetoSymptomEntry, KetoSymptomType } from "@/lib/db"

interface SymptomJournalCardProps {
  todayEntries: KetoSymptomEntry[]
  weekEntries: KetoSymptomEntry[]
  onAddSymptom: (symptom: KetoSymptomType, severity: 1 | 2 | 3 | 4 | 5, notes?: string) => Promise<void>
  onRemoveSymptom: (id: string) => Promise<void>
}

const SYMPTOM_ICONS: Record<KetoSymptomType, React.ComponentType<{ className?: string }>> = {
  energy: Zap,
  mental_clarity: Brain,
  hunger: Cookie,
  cravings: Cookie,
  sleep: Moon,
  mood: Smile,
  headache: AlertCircle,
  fatigue: Battery,
  nausea: ThermometerSun,
  other: MoreHorizontal,
}

const SYMPTOM_COLORS: Record<KetoSymptomType, string> = {
  energy: 'text-yellow-500',
  mental_clarity: 'text-purple-500',
  hunger: 'text-orange-500',
  cravings: 'text-red-500',
  sleep: 'text-indigo-500',
  mood: 'text-pink-500',
  headache: 'text-red-600',
  fatigue: 'text-gray-500',
  nausea: 'text-green-500',
  other: 'text-slate-500',
}

const SEVERITY_LABELS = ['', 'Minimal', 'Mild', 'Moderate', 'Strong', 'Intense']
const SEVERITY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

export default function SymptomJournalCard({
  todayEntries,
  weekEntries,
  onAddSymptom,
  onRemoveSymptom,
}: SymptomJournalCardProps) {
  const t = useTranslations('keto')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedSymptom, setSelectedSymptom] = useState<KetoSymptomType>('energy')
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [notes, setNotes] = useState('')

  // Calculate weekly patterns
  const weeklyPatterns = useMemo(() => {
    const patterns: Record<KetoSymptomType, { count: number; avgSeverity: number }> = {} as Record<KetoSymptomType, { count: number; avgSeverity: number }>

    for (const entry of weekEntries) {
      if (!patterns[entry.symptom]) {
        patterns[entry.symptom] = { count: 0, avgSeverity: 0 }
      }
      patterns[entry.symptom].count++
      patterns[entry.symptom].avgSeverity += entry.severity
    }

    // Calculate averages
    for (const symptom of Object.keys(patterns) as KetoSymptomType[]) {
      patterns[symptom].avgSeverity = Math.round(patterns[symptom].avgSeverity / patterns[symptom].count * 10) / 10
    }

    return patterns
  }, [weekEntries])

  // Get most common symptoms this week
  const topSymptoms = useMemo(() => {
    return Object.entries(weeklyPatterns)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
  }, [weeklyPatterns])

  const handleAddSymptom = async () => {
    await onAddSymptom(selectedSymptom, severity, notes || undefined)
    setIsAddOpen(false)
    setSelectedSymptom('energy')
    setSeverity(3)
    setNotes('')
  }

  const handleRemoveSymptom = async (id: string) => {
    await onRemoveSymptom(id)
  }

  const symptomTypes: KetoSymptomType[] = [
    'energy', 'mental_clarity', 'hunger', 'cravings',
    'sleep', 'mood', 'headache', 'fatigue', 'nausea', 'other'
  ]

  return (
    <>
      <Card className="glass-card shadow-modern">
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                {t('symptoms.title')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('symptoms.description')}
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddOpen(true)}
              size="sm"
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('symptoms.log')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0 space-y-4">
          {/* Today's Logged Symptoms */}
          {todayEntries.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-foreground">{t('symptoms.today')}</h4>
              <div className="flex flex-wrap gap-2">
                {todayEntries.map((entry) => {
                  const Icon = SYMPTOM_ICONS[entry.symptom]
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 group"
                    >
                      <Icon className={`h-4 w-4 ${SYMPTOM_COLORS[entry.symptom]}`} />
                      <span className="text-sm capitalize">
                        {t(`symptoms.types.${entry.symptom}`)}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`w-1.5 h-3 rounded-full ${
                              level <= entry.severity
                                ? SEVERITY_COLORS[entry.severity]
                                : 'bg-muted-foreground/20'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleRemoveSymptom(entry.id!)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {t('symptoms.noEntriesToday')}
            </div>
          )}

          {/* Quick Add Buttons */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-foreground">{t('symptoms.quickAdd')}</h4>
            <div className="grid grid-cols-5 gap-1.5">
              {symptomTypes.slice(0, 5).map((symptom) => {
                const Icon = SYMPTOM_ICONS[symptom]
                const isLogged = todayEntries.some(e => e.symptom === symptom)
                return (
                  <button
                    key={symptom}
                    onClick={() => {
                      setSelectedSymptom(symptom)
                      setIsAddOpen(true)
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      isLogged
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isLogged ? SYMPTOM_COLORS[symptom] : ''}`} />
                    <span className="text-[9px] sm:text-[10px] capitalize leading-tight text-center">
                      {t(`symptoms.types.${symptom}`)}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {symptomTypes.slice(5).map((symptom) => {
                const Icon = SYMPTOM_ICONS[symptom]
                const isLogged = todayEntries.some(e => e.symptom === symptom)
                return (
                  <button
                    key={symptom}
                    onClick={() => {
                      setSelectedSymptom(symptom)
                      setIsAddOpen(true)
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      isLogged
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isLogged ? SYMPTOM_COLORS[symptom] : ''}`} />
                    <span className="text-[9px] sm:text-[10px] capitalize leading-tight text-center">
                      {t(`symptoms.types.${symptom}`)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Weekly Patterns */}
          {topSymptoms.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-medium text-foreground">{t('symptoms.weeklyPatterns')}</h4>
              <div className="space-y-2">
                {topSymptoms.map(([symptom, data]) => {
                  const Icon = SYMPTOM_ICONS[symptom as KetoSymptomType]
                  return (
                    <div key={symptom} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${SYMPTOM_COLORS[symptom as KetoSymptomType]}`} />
                        <span className="capitalize">{t(`symptoms.types.${symptom}`)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{data.count}× {t('symptoms.thisWeek')}</span>
                        <div className="flex items-center gap-1">
                          <span>{t('symptoms.avg')}:</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`w-1 h-2 rounded-full ${
                                  level <= Math.round(data.avgSeverity)
                                    ? SEVERITY_COLORS[Math.round(data.avgSeverity)]
                                    : 'bg-muted-foreground/20'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Symptom Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              {t('symptoms.logTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('symptoms.logDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Symptom Type */}
            <div className="space-y-2">
              <Label>{t('symptoms.symptomType')}</Label>
              <Select value={selectedSymptom} onValueChange={(v) => setSelectedSymptom(v as KetoSymptomType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {symptomTypes.map((symptom) => {
                    const Icon = SYMPTOM_ICONS[symptom]
                    return (
                      <SelectItem key={symptom} value={symptom}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${SYMPTOM_COLORS[symptom]}`} />
                          <span className="capitalize">{t(`symptoms.types.${symptom}`)}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label>{t('symptoms.severity')}</Label>
              <div className="flex items-center gap-2">
                {([1, 2, 3, 4, 5] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSeverity(level)}
                    className={`flex-1 h-10 rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5 ${
                      severity === level
                        ? `${SEVERITY_COLORS[level]} text-white`
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <span className="text-sm font-medium">{level}</span>
                    <span className="text-[8px] opacity-80">{SEVERITY_LABELS[level]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="symptom-notes">
                {t('symptoms.notes')} <span className="text-muted-foreground">({t('weight.optional')})</span>
              </Label>
              <Textarea
                id="symptom-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('symptoms.notesPlaceholder')}
                className="h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleAddSymptom}>
              {t('symptoms.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
