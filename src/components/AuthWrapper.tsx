"use client"

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, switchDbMode, getDbMode } from '@/lib/db'
import CloudAuth from './CloudAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Cloud } from 'lucide-react'
import { useDexieCloud } from '@/hooks/useDexieCloud'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [useOfflineMode, setUseOfflineMode] = useState(false)
  const [mode, setMode] = useState<"cloud" | "offline" | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [authJustSucceeded, setAuthJustSucceeded] = useState(false)

  // Persisted mode preference and cross-component switching
  useEffect(() => {
    const storedMode = typeof window !== 'undefined' ? localStorage.getItem('domusMode') : null
    if (storedMode === 'offline') {
      setUseOfflineMode(true)
    }
    if (storedMode === 'cloud' || storedMode === 'offline') {
      setMode(storedMode)
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'domusMode') {
        setUseOfflineMode(e.newValue === 'offline')
        if (e.newValue === 'cloud' || e.newValue === 'offline') {
          setMode(e.newValue)
          // Switch DB immediately so reactive queries use the right instance
          switchDbMode(e.newValue as 'cloud' | 'offline')
        }
      }
    }

    const onShowMode = () => {
      // Switch to initial mode selection screen
      setUseOfflineMode(false)
      setShowAuthModal(false)
      setMode(null)
    }

    window.addEventListener('storage', onStorage)
    const onDbSwitched = () => {
      const active = getDbMode()
      setUseOfflineMode(active === 'offline')
      setMode(active)
    }
    window.addEventListener('domus:db-switched', onDbSwitched as EventListener)
    const onAuthSuccess = () => {
      setAuthJustSucceeded(true)
      // Auto-clear after short delay; wrapper will render app content
      setTimeout(() => setAuthJustSucceeded(false), 3000)
    }
    window.addEventListener('domus:authSuccess', onAuthSuccess as EventListener)
    window.addEventListener('domus:showMode', onShowMode as EventListener)
    setInitializing(false)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('domus:db-switched', onDbSwitched as EventListener)
      window.removeEventListener('domus:authSuccess', onAuthSuccess as EventListener)
      window.removeEventListener('domus:showMode', onShowMode as EventListener)
    }
  }, [])

  // Reactive auth state via Dexie Cloud
  const { currentUser } = useDexieCloud()

  const userProfile = useLiveQuery(async () => {
    if (!currentUser?.userId) return null
    try {
      // Try both with and without 'usr_' prefix to be resilient across data states
      const withPrefix = await db.users.get(`usr_${currentUser.userId}`)
      if (withPrefix) return withPrefix
      const withoutPrefix = await db.users.get(currentUser.userId)
      if (withoutPrefix) return withoutPrefix
      // Fallback: look up by email index if available
      if (currentUser.email) {
        const byEmail = await db.users.where('email').equals(currentUser.email).first()
        if (byEmail) return byEmail
      }
      return null
    } catch (error) {
      console.error('Error getting user profile:', error)
      return null
    }
  }, [currentUser?.userId])

  const userHousehold = useLiveQuery(async () => {
    if (!userProfile?.householdId) return null
    try {
      return await db.households.get(userProfile.householdId)
    } catch (error) {
      console.error('Error getting household:', error)
      return null
    }
  }, [userProfile?.householdId])

  // Avoid flicker of selection screen before mode is resolved on client
  if (initializing) {
    return <div className="min-h-screen bg-background" />
  }

  // If user chooses offline mode, render app without authentication
  if (useOfflineMode || mode === 'offline') {
    // Force remount on mode change so all hooks re-bind to the new DB instance
    return <div key={`app-${mode}`}>{children}</div>
  }

  // Cloud mode: check if user is fully authenticated and set up
  const isFullySetup = currentUser && userProfile && userHousehold
  
  // If cloud mode and not fully set up, show auth
  if (mode === 'cloud' && !isFullySetup && !authJustSucceeded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <CloudAuth 
            onAuthSuccess={() => {
              setShowAuthModal(false)
              setAuthJustSucceeded(true)
            }} 
            onBackToOffline={() => {
              setUseOfflineMode(true)
              setMode('offline')
              setShowAuthModal(false)
            }}
            onBackToModeSelection={() => {
              setMode(null)
              setShowAuthModal(false)
            }}
          />
          {!currentUser && (
            <div className="mt-6">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setMode(null)
                  setShowAuthModal(false)
                }}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // If user is fully authenticated and set up, render the app
  if (mode === 'cloud' && isFullySetup) {
    return <div key={`app-${mode}`}>{children}</div>
  }

  // Show authentication UI
  if (showAuthModal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <CloudAuth 
            onAuthSuccess={() => setShowAuthModal(false)} 
            onBackToOffline={() => {
              setUseOfflineMode(true)
              setMode('offline')
              setShowAuthModal(false)
            }}
            onBackToModeSelection={() => {
              setMode(null)
              setShowAuthModal(false)
            }}
          />
          
          <div className="mt-6">
            <Button 
              variant="ghost" 
              onClick={() => setShowAuthModal(false)}
              className="w-full"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Show mode selection screen only when no mode chosen yet
  if (mode === null) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome to Domus</h1>
          <p className="text-muted-foreground">
            Choose how you&apos;d like to use your home management app
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Cloud Sync Option */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50" 
                onClick={() => {
                  try { localStorage.setItem('domusMode', 'cloud') } catch {}
                  switchDbMode('cloud')
                  setMode('cloud')
                  setShowAuthModal(true)
                }}>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <Cloud className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Sync Across Devices</CardTitle>
              <CardDescription>
                Keep your data synced across all your devices and share with family members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Multi-device synchronization
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Family sharing and collaboration
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Automatic backups
                </div>
              </div>
              <Button className="w-full mt-4">
                Set Up Sync
              </Button>
            </CardContent>
          </Card>

          {/* Offline Mode Option */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
                onClick={() => {
                  try { localStorage.setItem('domusMode', 'offline') } catch {}
                  switchDbMode('offline')
                  setUseOfflineMode(true)
                  setMode('offline')
                }}>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mb-3">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>Use Offline Only</CardTitle>
              <CardDescription>
                Keep all your data stored locally on this device only
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Complete privacy - data stays local
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Works without internet connection
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  No account required
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4">
                Continue Offline
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>You can change this setting later in the app preferences</p>
        </div>
      </div>
    </div>
  )

  // Fallback (should not reach): render children
  return <>{children}</>
}