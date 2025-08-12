'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { useDexieCloud } from '@/hooks/useDexieCloud'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Cloud, 
  CloudOff, 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [mode, setMode] = useState<string | null>(null)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    setIsOnline(navigator.onLine)

    const m = localStorage.getItem('domusMode')
    setMode(m)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'domusMode') setMode(e.newValue)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // Get sync status from Dexie Cloud
  const { currentUser, webSocketStatus } = useDexieCloud()
  const syncState = useLiveQuery(async () => {
    try {
      return {
        isConnected: webSocketStatus === 'connected',
        currentUser,
        schema: db.cloud.schema
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync error')
      return null
    }
  }, [currentUser?.userId, webSocketStatus])

  const handleForceSync = async () => {
    try {
      setSyncError(null)
      await db.cloud.sync({ wait: true, purpose: 'pull' })
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
    }
  }

  const handleLogout = async () => {
    try {
      setSyncError(null)
      await db.cloud.logout({ force: true })
      try { localStorage.setItem('domusMode', 'offline') } catch {}
      setMode('offline')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Logout failed')
    }
  }

  const handleShowModeSelection = () => {
    try { localStorage.setItem('domusMode', 'cloud') } catch {}
    window.dispatchEvent(new Event('domus:showMode'))
  }

  const getSyncIcon = () => {
    if (mode === 'offline') return <Wifi className="h-4 w-4" />
    if (!isOnline) return <WifiOff className="h-4 w-4" />
    if (syncError) return <AlertTriangle className="h-4 w-4" />
    if (!syncState?.isConnected) return <CloudOff className="h-4 w-4" />
    return <Cloud className="h-4 w-4" />
  }

  const getSyncStatus = () => {
    if (mode === 'offline') return 'offline-mode'
    if (!isOnline) return 'offline'
    if (syncError) return 'error'
    if (!syncState?.isConnected) return 'disconnected'
    return 'synced'
  }

  const getStatusText = () => {
    const status = getSyncStatus()
    switch (status) {
      case 'offline-mode':
        return 'Offline Only'
      case 'offline':
        return 'Offline'
      case 'error':
        return 'Sync Error'
      case 'disconnected':
        return 'Not Synced'
      case 'synced':
        return 'Synced'
      default:
        return 'Unknown'
    }
  }

  const getStatusVariant = () => {
    const status = getSyncStatus()
    switch (status) {
      case 'offline-mode':
      case 'offline':
      case 'disconnected':
        return 'secondary'
      case 'error':
        return 'destructive'
      case 'synced':
        return 'default'
      default:
        return 'secondary'
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {getSyncIcon()}
          <Badge variant={getStatusVariant()}>
            {getStatusText()}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{mode === 'offline' ? 'Offline Mode' : 'Sync Status'}</h4>
            {mode !== 'offline' && syncState?.isConnected && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleForceSync}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Sync Now
              </Button>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Internet Connection</span>
              <div className="flex items-center gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">Offline</span>
                  </>
                )}
              </div>
            </div>

            {mode !== 'offline' ? (
              <>
                <div className="flex items-center justify-between">
                  <span>Cloud Sync</span>
                  <div className="flex items-center gap-1">
                    {syncState?.isConnected ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-green-500">Connected</span>
                      </>
                    ) : (
                      <>
                        <CloudOff className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-500">Disconnected</span>
                      </>
                    )}
                  </div>
                </div>

                {syncState?.currentUser?.userId && (
                  <div className="flex items-center justify-between">
                    <span>Signed in as</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {syncState.currentUser.email}
                    </span>
                  </div>
                )}

                {syncState?.currentUser?.userId && (
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={handleShowModeSelection}>Switch Mode</Button>
                    <Button size="sm" variant="ghost" onClick={handleLogout}>Sign out</Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  You are using Domus in offline-only mode. To enable sync, switch back to the setup screen.
                </p>
                <Button size="sm" variant="outline" onClick={handleShowModeSelection}>
                  Switch to Setup
                </Button>
              </div>
            )}

            {syncError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                <div className="font-medium">Sync Error:</div>
                {syncError}
              </div>
            )}

            {!isOnline && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs">
                You&apos;re working offline. Changes will sync when you&apos;re back online.
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}