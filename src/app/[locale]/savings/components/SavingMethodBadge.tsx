'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { SavingMethod } from '@/lib/db'
import {
  Calendar,
  Wallet,
  ArrowUpCircle,
  CalendarDays,
  CalendarRange,
  Settings
} from 'lucide-react'

interface SavingMethodBadgeProps {
  method: SavingMethod
  showLabel?: boolean
}

const methodConfig: Record<SavingMethod, { icon: React.ElementType; colorClass: string }> = {
  '52_week_challenge': {
    icon: Calendar,
    colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  },
  'envelope_method': {
    icon: Wallet,
    colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  },
  'round_up': {
    icon: ArrowUpCircle,
    colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  },
  'fixed_monthly': {
    icon: CalendarDays,
    colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  },
  'bi_weekly': {
    icon: CalendarRange,
    colorClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
  },
  'custom': {
    icon: Settings,
    colorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

export function SavingMethodBadge({ method, showLabel = false }: SavingMethodBadgeProps) {
  const t = useTranslations('savings.methods')

  const config = methodConfig[method] || methodConfig.custom
  const Icon = config.icon

  return (
    <Badge variant="secondary" className={`${config.colorClass} border-0 gap-1`}>
      <Icon className="h-3 w-3" />
      {showLabel && <span>{t(`${method}.name`)}</span>}
    </Badge>
  )
}
