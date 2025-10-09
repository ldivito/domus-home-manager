'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from './ui/button'
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { performSync, isAuthenticated, getSyncStatus } from '@/lib/sync'
import { toast } from 'sonner'

export default function SyncButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('sync')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAuth, setIsAuth] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check auth status and sync status on mount
  useEffect(() => {
    checkAuthStatus()
    const status = getSyncStatus()
    setLastSyncAt(status.lastSyncAt)
  }, [])

  const checkAuthStatus = async () => {
    const authenticated = await isAuthenticated()
    setIsAuth(authenticated)
  }

  const handleSync = async () => {
    if (!isAuth) {
      toast.error('Please log in to sync')
      return
    }

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
    if (!isAuth) return <CloudOff className="h-4 w-4" />
    if (lastSyncAt) return <Check className="h-4 w-4 text-green-500" />
    return <Cloud className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (isSyncing) return t('syncing')
    if (error) return t('error')
    if (!isAuth) return t('notLoggedIn')
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
        onClick={handleSync}
        disabled={isSyncing || !isAuth}
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
      onClick={handleSync}
      disabled={isSyncing || !isAuth}
      className="gap-2"
    >
      {getIcon()}
      <span className="text-xs">{getStatusText()}</span>
    </Button>
  )
}
