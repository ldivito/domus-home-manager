"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle, Circle, Zap, Flame, Brain, Heart, Trophy, Lock, Info } from "lucide-react"

interface KetoStage {
  id: string
  name: string
  description: string
  daysRequired: number
  icon: React.ReactNode
  color: string
  colorClass: string
  benefits: string[]
}

interface KetoStagesCardProps {
  daysOnKeto: number
  startDate?: Date
  fastingDays: number
}

export default function KetoStagesCard({
  daysOnKeto,
  startDate,
  fastingDays,
}: KetoStagesCardProps) {
  const t = useTranslations('keto')
  const [selectedStage, setSelectedStage] = useState<KetoStage | null>(null)
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(0)

  const stages: KetoStage[] = useMemo(() => [
    {
      id: 'glycogen',
      name: t('stages.glycogen.name'),
      description: t('stages.glycogen.description'),
      daysRequired: 0,
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-yellow-500',
      colorClass: 'yellow',
      benefits: [
        t('stages.glycogen.benefit1'),
        t('stages.glycogen.benefit2'),
      ],
    },
    {
      id: 'transition',
      name: t('stages.transition.name'),
      description: t('stages.transition.description'),
      daysRequired: 2,
      icon: <Flame className="h-5 w-5" />,
      color: 'bg-orange-500',
      colorClass: 'orange',
      benefits: [
        t('stages.transition.benefit1'),
        t('stages.transition.benefit2'),
        t('stages.transition.benefit3'),
      ],
    },
    {
      id: 'ketosis',
      name: t('stages.ketosis.name'),
      description: t('stages.ketosis.description'),
      daysRequired: 7,
      icon: <Brain className="h-5 w-5" />,
      color: 'bg-blue-500',
      colorClass: 'blue',
      benefits: [
        t('stages.ketosis.benefit1'),
        t('stages.ketosis.benefit2'),
        t('stages.ketosis.benefit3'),
      ],
    },
    {
      id: 'adaptation',
      name: t('stages.adaptation.name'),
      description: t('stages.adaptation.description'),
      daysRequired: 21,
      icon: <Heart className="h-5 w-5" />,
      color: 'bg-purple-500',
      colorClass: 'purple',
      benefits: [
        t('stages.adaptation.benefit1'),
        t('stages.adaptation.benefit2'),
        t('stages.adaptation.benefit3'),
      ],
    },
    {
      id: 'mastery',
      name: t('stages.mastery.name'),
      description: t('stages.mastery.description'),
      daysRequired: 90,
      icon: <Trophy className="h-5 w-5" />,
      color: 'bg-green-500',
      colorClass: 'green',
      benefits: [
        t('stages.mastery.benefit1'),
        t('stages.mastery.benefit2'),
        t('stages.mastery.benefit3'),
      ],
    },
  ], [t])

  const currentStage = useMemo(() => {
    // Consider fasting days as "bonus" days for stage calculation
    const effectiveDays = daysOnKeto + Math.floor(fastingDays * 0.5)

    for (let i = stages.length - 1; i >= 0; i--) {
      if (effectiveDays >= stages[i].daysRequired) {
        return {
          stage: stages[i],
          index: i,
          nextStage: stages[i + 1] || null,
          daysToNext: stages[i + 1] ? stages[i + 1].daysRequired - effectiveDays : null,
          effectiveDays,
        }
      }
    }

    return {
      stage: stages[0],
      index: 0,
      nextStage: stages[1],
      daysToNext: stages[1].daysRequired - effectiveDays,
      effectiveDays,
    }
  }, [daysOnKeto, fastingDays, stages])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const handleStageClick = (stage: KetoStage, index: number) => {
    setSelectedStage(stage)
    setSelectedStageIndex(index)
  }

  const isStageReached = (index: number) => index <= currentStage.index

  if (!startDate) {
    return (
      <Card className="glass-card shadow-modern">
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
          <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
            <Flame className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('stages.title')}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t('stages.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
            <Flame className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              {t('stages.noData')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="glass-card shadow-modern">
        <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3 md:pb-4">
          <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
            <Flame className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('stages.title')}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t('stages.startedOn', { date: formatDate(startDate) })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0 space-y-4 sm:space-y-6">
          {/* Current Stage Highlight - Clickable */}
          <button
            onClick={() => handleStageClick(currentStage.stage, currentStage.index)}
            className={`w-full text-left p-4 sm:p-6 rounded-xl ${currentStage.stage.color}/10 border-2 border-dashed ${currentStage.stage.color.replace('bg-', 'border-')}/30 hover:${currentStage.stage.color}/20 transition-colors cursor-pointer group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${currentStage.stage.color} text-white`}>
                  {currentStage.stage.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg sm:text-xl text-foreground">
                    {currentStage.stage.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('stages.currentStage')}
                  </p>
                </div>
              </div>
              <Info className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {currentStage.stage.description}
            </p>
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-foreground">{t('stages.benefits')}:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {currentStage.stage.benefits.slice(0, 2).map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{benefit}</span>
                  </li>
                ))}
                {currentStage.stage.benefits.length > 2 && (
                  <li className="text-xs text-muted-foreground/70">
                    +{currentStage.stage.benefits.length - 2} {t('stages.more')}
                  </li>
                )}
              </ul>
            </div>

            {currentStage.nextStage && currentStage.daysToNext !== null && (
              <div className="mt-4 p-3 bg-background/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  {t('stages.nextStage')}: <span className="font-medium text-foreground">{currentStage.nextStage.name}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('stages.daysRemaining', { days: Math.max(0, currentStage.daysToNext) })}
                </p>
                {/* Progress bar to next stage */}
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${currentStage.nextStage.color} rounded-full transition-all duration-500`}
                    style={{
                      width: `${Math.min(100, Math.max(0, (currentStage.effectiveDays - currentStage.stage.daysRequired) / (currentStage.nextStage.daysRequired - currentStage.stage.daysRequired) * 100))}%`
                    }}
                  />
                </div>
              </div>
            )}
          </button>

          {/* All Stages Timeline - Interactive */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              {t('stages.timeline')}
              <span className="text-xs text-muted-foreground font-normal">({t('stages.clickToLearn')})</span>
            </h4>
            <div className="space-y-0">
              {stages.map((stage, index) => {
                const isCompleted = index < currentStage.index
                const isCurrent = index === currentStage.index
                const isNext = index === currentStage.index + 1
                const reached = isStageReached(index)

                return (
                  <button
                    key={stage.id}
                    onClick={() => handleStageClick(stage, index)}
                    className="w-full flex items-start gap-3 relative text-left hover:bg-muted/50 rounded-lg p-1.5 -ml-1.5 transition-colors group"
                  >
                    {/* Vertical line */}
                    {index < stages.length - 1 && (
                      <div className={`absolute left-[14px] top-8 w-0.5 h-[calc(100%-16px)] ${
                        isCompleted ? stage.color : 'bg-muted'
                      }`} />
                    )}

                    {/* Icon */}
                    <div className={`relative z-10 p-1.5 rounded-full ${
                      isCompleted ? stage.color + ' text-white' :
                      isCurrent ? stage.color + ' text-white ring-2 ring-offset-2 ring-offset-background ' + stage.color.replace('bg-', 'ring-') :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {reached ? (
                        isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pb-4 ${!reached ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'} group-hover:text-foreground transition-colors`}>
                          {stage.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('stages.dayLabel', { days: stage.daysRequired })}
                        </span>
                        {isCurrent && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${stage.color} text-white`}>
                            {t('stages.current')}
                          </span>
                        )}
                        {isNext && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {t('stages.next')}
                          </span>
                        )}
                        <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                      </div>
                      {isCurrent && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {stage.description}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Details Modal */}
      <Dialog open={selectedStage !== null} onOpenChange={(open) => !open && setSelectedStage(null)}>
        <DialogContent className="sm:max-w-[450px]">
          {selectedStage && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${selectedStage.color} text-white`}>
                    {selectedStage.icon}
                  </div>
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {selectedStage.name}
                      {selectedStageIndex <= currentStage.index && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </DialogTitle>
                    <DialogDescription>
                      {t('stages.dayLabel', { days: selectedStage.daysRequired })}
                      {selectedStageIndex === currentStage.index && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${selectedStage.color} text-white`}>
                          {t('stages.currentStage')}
                        </span>
                      )}
                      {selectedStageIndex > currentStage.index && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          <Lock className="h-3 w-3 inline mr-1" />
                          {t('stages.notReached')}
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">{t('stages.about')}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedStage.description}
                  </p>
                </div>

                {/* Benefits */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">{t('stages.benefits')}</h4>
                  <ul className="space-y-2">
                    {selectedStage.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${
                          selectedStageIndex <= currentStage.index ? 'text-green-500' : 'text-muted-foreground'
                        }`} />
                        <span className={selectedStageIndex > currentStage.index ? 'text-muted-foreground' : ''}>
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Progress Info */}
                {selectedStageIndex > currentStage.index && (
                  <div className={`p-3 rounded-lg ${selectedStage.color}/10 border border-dashed ${selectedStage.color.replace('bg-', 'border-')}/30`}>
                    <p className="text-sm text-muted-foreground">
                      {t('stages.daysToReach', { days: selectedStage.daysRequired - currentStage.effectiveDays })}
                    </p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${selectedStage.color} rounded-full transition-all duration-500`}
                        style={{
                          width: `${Math.min(100, Math.max(0, (currentStage.effectiveDays / selectedStage.daysRequired) * 100))}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((currentStage.effectiveDays / selectedStage.daysRequired) * 100)}% {t('stages.complete')}
                    </p>
                  </div>
                )}

                {/* Stage completed */}
                {selectedStageIndex < currentStage.index && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {t('stages.stageCompleted')}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
