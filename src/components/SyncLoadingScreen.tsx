'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Check, AlertCircle, Cloud, Upload, Download, Database, CheckCircle2 } from 'lucide-react'
import { performSync, SyncProgress } from '@/lib/sync'

interface SyncLoadingScreenProps {
  onComplete: (success: boolean) => void
  action: 'login' | 'logout'
}

export default function SyncLoadingScreen({ onComplete, action }: SyncLoadingScreenProps) {
  const t = useTranslations('syncScreen')
  const [status, setStatus] = useState<'syncing' | 'success' | 'error'>('syncing')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState<SyncProgress>({
    step: 'migration',
    message: '',
    percent: 0
  })

  useEffect(() => {
    const performSyncOperation = async () => {
      setStatus('syncing')

      try {
        const result = await performSync(false, (p) => {
          setProgress(p)
        })

        if (result.success) {
          setStatus('success')
          setMessage(t('syncSuccess', { pushed: result.pushed, pulled: result.pulled }))

          // Wait a bit to show success message before completing
          setTimeout(() => {
            onComplete(true)
          }, 1000)
        } else {
          setStatus('error')
          setMessage(result.error || t('syncError'))

          // Even on error, complete the action after a delay
          setTimeout(() => {
            onComplete(false)
          }, 2000)
        }
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : t('syncError'))

        // Even on error, complete the action after a delay
        setTimeout(() => {
          onComplete(false)
        }, 2000)
      }
    }

    performSyncOperation()
  }, [onComplete, t])

  const getIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="h-16 w-16 text-primary animate-spin" />
      case 'success':
        return <Check className="h-16 w-16 text-green-500" />
      case 'error':
        return <AlertCircle className="h-16 w-16 text-destructive" />
    }
  }

  const getTitle = () => {
    if (status === 'syncing') {
      return action === 'login' ? t('syncingLogin') : t('syncingLogout')
    }
    if (status === 'success') {
      return t('syncComplete')
    }
    return t('syncFailed')
  }

  const getStepIcon = () => {
    switch (progress.step) {
      case 'migration':
        return <Database className="h-4 w-4" />
      case 'collecting':
        return <Database className="h-4 w-4" />
      case 'pushing':
        return <Upload className="h-4 w-4" />
      case 'pulling':
        return <Download className="h-4 w-4" />
      case 'applying':
        return <Database className="h-4 w-4" />
      case 'complete':
        return <CheckCircle2 className="h-4 w-4" />
      default:
        return <Cloud className="h-4 w-4" />
    }
  }

  const getStepMessage = () => {
    switch (progress.step) {
      case 'migration':
        return t('stepMigration')
      case 'collecting':
        return t('stepCollecting')
      case 'pushing':
        return t('stepPushing')
      case 'pulling':
        return t('stepPulling')
      case 'applying':
        return t('stepApplying')
      case 'complete':
        return t('syncComplete')
      default:
        return progress.message
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="flex flex-col items-center justify-center max-w-md p-8 space-y-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-24 h-24 rounded-full bg-card/80 backdrop-blur-xl border border-border/50 shadow-modern">
          {getIcon()}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground text-center">
          {getTitle()}
        </h1>

        {/* Progress details - only show while syncing */}
        {status === 'syncing' && (
          <div className="w-full space-y-4">
            {/* Current step */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              {getStepIcon()}
              <span className="text-sm font-medium">{getStepMessage()}</span>
            </div>

            {/* Item count - show if we have counts */}
            {progress.current !== undefined && progress.total !== undefined && progress.total > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {t('itemsProgress', { current: progress.current, total: progress.total })}
              </p>
            )}

            {/* Progress bar */}
            <div className="w-64 mx-auto space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progress.percent || 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {progress.percent || 0}%
              </p>
            </div>
          </div>
        )}

        {/* Message - show when not syncing */}
        {status !== 'syncing' && (
          <div className="flex items-center gap-2 text-muted-foreground text-center">
            <Cloud className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
