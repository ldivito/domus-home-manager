'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from './ui/button'
import { Cloud, RefreshCw, Check, AlertCircle, LogIn } from 'lucide-react'
import { performSync, isAuthenticated, getSyncStatus } from '@/lib/sync'
import { toast } from 'sonner'

export default function SyncButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('sync')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAuth, setIsAuth] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check auth status and sync status on mount
  useEffect(() => {
    checkAuthStatus()
    loadSyncStatus()
  }, [])

  const loadSyncStatus = async () => {
    const status = await getSyncStatus()
    setLastSyncAt(status.lastSyncAt)
    if (status.needsMigration) {
      setError(status.error || 'Migration required')
    }
  }

  const checkAuthStatus = async () => {
    const authenticated = await isAuthenticated()
    setIsAuth(authenticated)
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setError(null)

    try {
      const result = await performSync(false)

      if (result.success) {
        setLastSyncAt(new Date())
        toast.success(t('syncComplete') || `Synced! Pushed ${result.pushed}, pulled ${result.pulled}`)
      } else {
        setError(result.error || 'Sync failed')
        toast.error(result.error || 'Sync failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast.error(`Sync failed: ${errorMessage}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const getIcon = () => {
    if (isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (error) return <AlertCircle className="h-4 w-4 text-destructive" />
    if (!isAuth) return <LogIn className="h-4 w-4" />
    if (lastSyncAt) return <Check className="h-4 w-4 text-green-500" />
    return <Cloud className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (isSyncing) return t('syncing')
    if (error) return t('error')
    if (!isAuth) return tAuth('signIn')
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
  if (!isAuth) {
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
