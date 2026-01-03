'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react'
import { performSync, isAuthenticated as checkIsAuthenticated, getLastSyncTime, getSyncStatus } from '@/lib/sync'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface SyncContextType {
  isSyncing: boolean
  lastSyncAt: Date | null
  pendingChanges: boolean
  error: string | null
  isAuthenticated: boolean
  triggerSync: (force?: boolean, silent?: boolean) => Promise<void>
}

const SyncContext = createContext<SyncContextType | undefined>(undefined)

// Configuration
const DEBOUNCE_DELAY = 3000 // 3 seconds after last change
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('sync')

  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [pendingChanges, setPendingChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isSyncingRef = useRef(false) // Ref to avoid stale closure issues

  // Sync isSyncing state with ref
  useEffect(() => {
    isSyncingRef.current = isSyncing
  }, [isSyncing])

  // Main sync function
  const triggerSync = useCallback(async (force = false, silent = false) => {
    // Guard conditions
    if (isSyncingRef.current) return
    if (!isAuthenticated) return

    setIsSyncing(true)
    isSyncingRef.current = true
    setPendingChanges(false)
    setError(null)

    try {
      const result = await performSync(force)

      if (result.success) {
        setLastSyncAt(new Date())
        setError(null)
        if (!silent && (result.pushed > 0 || result.pulled > 0)) {
          toast.success(t('syncComplete') || `Synced! Pushed ${result.pushed}, pulled ${result.pulled}`)
        }
      } else {
        setError(result.error || 'Sync failed')
        if (!silent) {
          toast.error(result.error || 'Sync failed')
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      if (!silent) {
        toast.error(`Sync failed: ${errorMessage}`)
      }
    } finally {
      setIsSyncing(false)
      isSyncingRef.current = false
    }
  }, [isAuthenticated, t])

  // Handle sync-needed events from database hooks (debounced)
  const handleSyncNeeded = useCallback(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set pending indicator
    setPendingChanges(true)

    // Start new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (isAuthenticated && !isSyncingRef.current) {
        triggerSync(false, true) // Silent auto-sync
      }
    }, DEBOUNCE_DELAY)
  }, [isAuthenticated, triggerSync])

  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      const authenticated = await checkIsAuthenticated()
      setIsAuthenticated(authenticated)
      return authenticated
    } catch {
      setIsAuthenticated(false)
      return false
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Check auth status
      await checkAuth()

      // Load last sync time
      const savedLastSync = getLastSyncTime()
      if (savedLastSync) {
        setLastSyncAt(savedLastSync)
      }

      // Check if migration is needed
      const status = await getSyncStatus()
      if (status.needsMigration) {
        setError(status.error || 'Migration required')
      }
    }

    init()
  }, [checkAuth])

  // Listen for sync-needed custom events from database hooks
  useEffect(() => {
    const handleEvent = () => handleSyncNeeded()

    window.addEventListener('sync-needed', handleEvent)
    return () => window.removeEventListener('sync-needed', handleEvent)
  }, [handleSyncNeeded])

  // Listen for auth changes (login/logout)
  useEffect(() => {
    const handleAuthChange = () => {
      checkAuth()
    }

    // Listen for custom auth events
    window.addEventListener('auth-changed', handleAuthChange)

    // Also check on storage changes (for cross-tab support)
    window.addEventListener('storage', handleAuthChange)

    return () => {
      window.removeEventListener('auth-changed', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [checkAuth])

  // Set up 5-minute auto-sync interval
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear interval when not authenticated
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current)
        autoSyncIntervalRef.current = null
      }
      return
    }

    // Set up interval for authenticated users
    autoSyncIntervalRef.current = setInterval(() => {
      if (isAuthenticated && !isSyncingRef.current) {
        triggerSync(false, true) // Silent auto-sync
      }
    }, AUTO_SYNC_INTERVAL)

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current)
        autoSyncIntervalRef.current = null
      }
    }
  }, [isAuthenticated, triggerSync])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const value: SyncContextType = {
    isSyncing,
    lastSyncAt,
    pendingChanges,
    error,
    isAuthenticated,
    triggerSync
  }

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSyncContext() {
  const context = useContext(SyncContext)
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider')
  }
  return context
}

// Utility function to emit sync-needed event from anywhere
export function emitSyncNeeded() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-needed'))
  }
}

// Utility function to emit auth-changed event
export function emitAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-changed'))
  }
}
