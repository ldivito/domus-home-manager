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

  const handleClick = async () => {
    if (!isAuth) {
      router.push('/auth')
      return
    }
    await handleSync()
  }

  const handleSync = async () => {

    setIsSyncing(true)
    setError(null)

    try {
      const result = await performSync()

      if (result.success) {
        setLastSyncAt(new Date())
        toast.success(`Synced! Pushed ${result.pushed}, pulled ${result.pulled}`)
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

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isSyncing}
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
      onClick={handleClick}
      disabled={isSyncing}
      className="gap-2"
    >
      {getIcon()}
      <span className="text-xs">{getStatusText()}</span>
    </Button>
  )
}
