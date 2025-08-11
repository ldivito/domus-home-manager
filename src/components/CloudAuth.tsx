'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, User, Home, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'

interface CloudAuthProps {
  onAuthSuccess?: () => void
}

export default function CloudAuth({ onAuthSuccess }: CloudAuthProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [authStep, setAuthStep] = useState<'login' | 'setup'>('login')

  // Check current authentication state
  const currentUser = useLiveQuery(async () => {
    try {
      return await db.cloud.currentUser
    } catch (error) {
      console.error('Error getting current user:', error)
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

  // If user is fully set up, call success callback
  useEffect(() => {
    if (currentUser && userProfile && userHousehold && onAuthSuccess) {
      onAuthSuccess()
    }
  }, [currentUser, userProfile, userHousehold, onAuthSuccess])

  const handleLogin = async () => {
    if (!email) return

    setIsLoading(true)
    setError(null)

    try {
      await db.cloud.login({ email })
      
      // Check if user needs to set up profile
      const user = await db.cloud.currentUser
      if (user) {
        const profile = await db.users.get(user.userId)
        if (!profile) {
          setAuthStep('setup')
        } else if (!profile.householdId) {
          setAuthStep('setup')
        }
      }
      
      toast.success('Successfully logged in!')
    } catch (error: unknown) {
      console.error('Login error:', error)
      setError(error instanceof Error ? error.message : 'Failed to log in')
      toast.error('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProfile = async () => {
    if (!name || !currentUser?.userId) return

    setIsLoading(true)
    setError(null)

    try {
      const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', 
        '#84cc16', '#22c55e', '#10b981', '#14b8a6',
        '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
        '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
      ]
      const randomColor = colors[Math.floor(Math.random() * colors.length)]

      await db.users.add({
        id: currentUser.userId,
        name,
        email: currentUser.email,
        color: randomColor,
        type: 'resident',
        createdAt: new Date()
      })

      toast.success('Profile created!')
    } catch (error: unknown) {
      console.error('Profile creation error:', error)
      setError(error instanceof Error ? error.message : 'Failed to create profile')
      toast.error('Failed to create profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateHousehold = async () => {
    if (!householdName || !currentUser?.userId) return

    setIsLoading(true)
    setError(null)

    try {
      await db.createHousehold(householdName)
      toast.success('Household created!')
    } catch (error: unknown) {
      console.error('Household creation error:', error)
      setError(error instanceof Error ? error.message : 'Failed to create household')
      toast.error('Failed to create household')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinHousehold = async () => {
    if (!inviteCode || !currentUser?.userId) return

    setIsLoading(true)
    setError(null)

    try {
      // Find household by invite code
      const households = await db.households.where('inviteCode').equals(inviteCode).toArray()
      const household = households[0]
      
      if (!household) {
        setError('Invalid invite code')
        return
      }

      // Add user to household members
      await db.householdMembers.add({
        id: crypto.randomUUID(),
        householdId: household.id!,
        userId: currentUser.userId,
        role: 'member',
        joinedAt: new Date(),
        permissions: {
          canManageMembers: false,
          canManageSettings: false,
          canDeleteItems: false
        }
      })

      // Update user's household ID
      await db.users.update(currentUser.userId, { 
        householdId: household.id 
      })

      toast.success('Joined household!')
    } catch (error: unknown) {
      console.error('Join household error:', error)
      setError(error instanceof Error ? error.message : 'Failed to join household')
      toast.error('Failed to join household')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await db.cloud.logout()
      toast.success('Logged out')
    } catch (error: unknown) {
      console.error('Logout error:', error)
      toast.error('Failed to log out')
    }
  }

  // Show setup screen if user is authenticated but needs setup
  if (currentUser && authStep === 'setup') {
    return (
      <div className="max-w-md mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Complete Your Setup
            </CardTitle>
            <CardDescription>
              Let&apos;s set up your profile and household
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="household" disabled={!userProfile}>Household</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create Your Profile</CardTitle>
                <CardDescription>
                  Tell us a bit about yourself
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <Button 
                  onClick={handleCreateProfile} 
                  disabled={!name || isLoading}
                  className="w-full"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="household" className="space-y-4">
            <Tabs defaultValue="create" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">
                  <Home className="mr-2 h-4 w-4" />
                  Create
                </TabsTrigger>
                <TabsTrigger value="join">
                  <Users className="mr-2 h-4 w-4" />
                  Join
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create">
                <Card>
                  <CardHeader>
                    <CardTitle>Create Household</CardTitle>
                    <CardDescription>
                      Start a new household for your family
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="household-name">Household Name</Label>
                      <Input
                        id="household-name"
                        value={householdName}
                        onChange={(e) => setHouseholdName(e.target.value)}
                        placeholder="e.g., The Smith Family"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateHousehold}
                      disabled={!householdName || isLoading}
                      className="w-full"
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Household
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="join">
                <Card>
                  <CardHeader>
                    <CardTitle>Join Household</CardTitle>
                    <CardDescription>
                      Enter an invite code to join an existing household
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-code">Invite Code</Label>
                      <Input
                        id="invite-code"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="Enter invite code"
                      />
                    </div>
                    <Button 
                      onClick={handleJoinHousehold}
                      disabled={!inviteCode || isLoading}
                      className="w-full"
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Join Household
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!currentUser) {
    return (
      <div className="max-w-sm mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Domus</CardTitle>
            <CardDescription>
              Sign in to sync your data across devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={!email || isLoading}
              className="w-full"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show authenticated state
  return (
    <div className="max-w-sm mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Signed In</CardTitle>
          <CardDescription>
            {userProfile?.name} • {userHousehold?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogout} variant="outline" className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}