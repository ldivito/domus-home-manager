'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
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

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Get sync status from Dexie Cloud
  const syncState = useLiveQuery(async () => {
    try {
      return {
        isConnected: db.cloud.isOnline,
        currentUser: await db.cloud.currentUser,
        schema: db.cloud.schema
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync error')
      return null
    }
  })

  const handleForceSync = async () => {
    try {
      setSyncError(null)
      await db.cloud.sync({ wait: true })
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
    }
  }

  const getSyncIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />
    if (syncError) return <AlertTriangle className="h-4 w-4" />
    if (!syncState?.isConnected) return <CloudOff className="h-4 w-4" />
    return <Cloud className="h-4 w-4" />
  }

  const getSyncStatus = () => {
    if (!isOnline) return 'offline'
    if (syncError) return 'error'
    if (!syncState?.isConnected) return 'disconnected'
    return 'synced'
  }

  const getStatusText = () => {
    const status = getSyncStatus()
    switch (status) {
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
            <h4 className="font-semibold">Sync Status</h4>
            {syncState?.isConnected && (
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

            {syncState?.currentUser && (
              <div className="flex items-center justify-between">
                <span>Signed in as</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">
                  {syncState.currentUser.email}
                </span>
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