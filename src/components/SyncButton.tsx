'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from './ui/button'
import { Cloud, RefreshCw, Check, AlertCircle, LogIn } from 'lucide-react'
import { useSyncContext } from '@/contexts/SyncContext'

export default function SyncButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('sync')
  const tAuth = useTranslations('auth')
  const router = useRouter()

  // Use global sync context instead of local state
  const {
    isSyncing,
    lastSyncAt,
    pendingChanges,
    error,
    isAuthenticated,
    triggerSync
  } = useSyncContext()

  const handleSync = async () => {
    await triggerSync(false, false) // Not forced, not silent (show toast)
  }

  const getIcon = () => {
    if (isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (error) return <AlertCircle className="h-4 w-4 text-destructive" />
    if (!isAuthenticated) return <LogIn className="h-4 w-4" />
    // Show cloud with pending indicator if there are pending changes
    if (pendingChanges) {
      return (
        <div className="relative">
          <Cloud className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
        </div>
      )
    }
    if (lastSyncAt) return <Check className="h-4 w-4 text-green-500" />
    return <Cloud className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (isSyncing) return t('syncing')
    if (error) return t('error')
    if (!isAuthenticated) return tAuth('signIn')
    if (pendingChanges) return t('pending') || 'Pending...'
    if (lastSyncAt) {
      const now = new Date()
      const diff = now.getTime() - lastSyncAt.getTime()
      const minutes = Math.floor(diff / 60000)
      if (minutes < 1) return t('justNow')
      if (minutes < 60) return t('minutesAgo', { count: minutes })
      const hours = Math.floor(minutes / 60)
      return t('hoursAgo', { count: hours })
    }
    return t('notSynced')
  }

  // When not authenticated, show a simple login button
  if (!isAuthenticated) {
    if (compact) {
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/auth')}
          title={tAuth('signIn')}
        >
          <LogIn className="h-4 w-4" />
        </Button>
      )
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/auth')}
        className="gap-2"
      >
        <LogIn className="h-4 w-4" />
        <span className="text-xs">{tAuth('signIn')}</span>
      </Button>
    )
  }

  // When authenticated, show a simple sync button (click to sync)
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled={isSyncing}
        onClick={handleSync}
        title={getStatusText()}
      >
        {getIcon()}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isSyncing}
      onClick={handleSync}
      className="gap-2"
    >
      {getIcon()}
      <span className="text-xs">{getStatusText()}</span>
    </Button>
  )
}
