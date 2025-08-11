'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import CloudAuth from './CloudAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Cloud } from 'lucide-react'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [useOfflineMode, setUseOfflineMode] = useState(false)

  // Check authentication state
  const currentUser = useLiveQuery(async () => {
    try {
      return await db.cloud.currentUser
    } catch (error) {
      console.error('Error checking authentication:', error)
      return null
    }
  })

  const userProfile = useLiveQuery(async () => {
    if (!currentUser?.userId) return null
    try {
      return await db.users.get(currentUser.userId)
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

  // If user chooses offline mode, render app without authentication
  if (useOfflineMode) {
    return <>{children}</>
  }

  // If user is fully authenticated and set up, render the app
  if (currentUser && userProfile && userHousehold) {
    return <>{children}</>
  }

  // Show authentication UI
  if (showAuthModal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <CloudAuth onAuthSuccess={() => setShowAuthModal(false)} />
          
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

  // Show mode selection screen
  return (
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
                onClick={() => setShowAuthModal(true)}>
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
                onClick={() => setUseOfflineMode(true)}>
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
}