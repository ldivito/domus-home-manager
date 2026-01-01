"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Circle, Zap, Flame, Brain, Heart, Trophy } from "lucide-react"

interface KetoStage {
  id: string
  name: string
  description: string
  daysRequired: number
  icon: React.ReactNode
  color: string
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

  const stages: KetoStage[] = useMemo(() => [
    {
      id: 'glycogen',
      name: t('stages.glycogen.name'),
      description: t('stages.glycogen.description'),
      daysRequired: 0,
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-yellow-500',
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
        {/* Current Stage Highlight */}
        <div className={`p-4 sm:p-6 rounded-xl ${currentStage.stage.color}/10 border-2 border-dashed ${currentStage.stage.color.replace('bg-', 'border-')}/30`}>
          <div className="flex items-center gap-3 mb-3">
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
          <p className="text-sm text-muted-foreground mb-3">
            {currentStage.stage.description}
          </p>
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-foreground">{t('stages.benefits')}:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {currentStage.stage.benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                  {benefit}
                </li>
              ))}
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
        </div>

        {/* All Stages Timeline */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">{t('stages.timeline')}</h4>
          <div className="space-y-0">
            {stages.map((stage, index) => {
              const isCompleted = index < currentStage.index
              const isCurrent = index === currentStage.index
              const isNext = index === currentStage.index + 1

              return (
                <div key={stage.id} className="flex items-start gap-3 relative">
                  {/* Vertical line */}
                  {index < stages.length - 1 && (
                    <div className={`absolute left-3 top-6 w-0.5 h-full -ml-0.5 ${
                      isCompleted ? stage.color : 'bg-muted'
                    }`} />
                  )}

                  {/* Icon */}
                  <div className={`relative z-10 p-1.5 rounded-full ${
                    isCompleted ? stage.color + ' text-white' :
                    isCurrent ? stage.color + ' text-white ring-2 ring-offset-2 ring-offset-background ' + stage.color.replace('bg-', 'ring-') :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-4 ${!isCompleted && !isCurrent ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                    </div>
                    {(isCurrent || isNext) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stage.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
