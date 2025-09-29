'use client'

import { useState, useEffect } from 'react'
import { db, switchDbMode } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, User, Home, Users, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDexieCloud } from '@/hooks/useDexieCloud'

interface CloudAuthProps {
  onAuthSuccess?: () => void
  onBackToOffline?: () => void
  onBackToModeSelection?: () => void
}

export default function CloudAuth({ onAuthSuccess, onBackToOffline, onBackToModeSelection }: CloudAuthProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [authStep, setAuthStep] = useState<'login' | 'setup'>('login')
  const [activeTab, setActiveTab] = useState<'profile' | 'household'>('profile')
  const [showOtpDialog, setShowOtpDialog] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [postAuthInProgress, setPostAuthInProgress] = useState(false)
  const [resolvingProfile, setResolvingProfile] = useState(false)

  // Reactive current user via Dexie Cloud subjects
  const { currentUser } = useDexieCloud()

  const userProfile = useLiveQuery(async () => {
    if (!currentUser?.userId) return null
    try {
      const withPrefix = await db.users.get(`usr_${currentUser.userId}`)
      if (withPrefix) return withPrefix
      const withoutPrefix = await db.users.get(currentUser.userId)
      return withoutPrefix ?? null
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

  // Determine authentication state
  // For Dexie Cloud: user is fully authenticated when they have userId and email
  const isFullyAuthenticated = !!(currentUser && currentUser.userId && currentUser.email)
  const needsSetup = isFullyAuthenticated && (!userProfile || !userProfile.householdId || userHousehold === null)
  const isSetupComplete = isFullyAuthenticated && !!(userProfile && userProfile.householdId) && userHousehold !== null
  
  // Resolve profile after auth to prevent showing setup if profile exists but hasn't synced into IndexedDB yet
  useEffect(() => {
    if (!isFullyAuthenticated) return
    let cancelled = false
    const resolve = async () => {
      setResolvingProfile(true)
      try {
        // If we already have a profile, decide based on household
        if (userProfile) {
          if (!userProfile.householdId) {
            setAuthStep('setup')
            setActiveTab('household')
          }
          return
        }
        // Otherwise, try a quick pull and recheck before showing setup
        try {
          await (db as unknown as { cloud: { sync: (opts?: unknown) => Promise<void> } }).cloud.sync({ wait: true, purpose: 'pull' })
        } catch {}
        const settledUser = (db as unknown as { cloud: { currentUser: { value: { userId?: string; email?: string } | null } } }).cloud.currentUser.value
        if (!settledUser || !settledUser.userId) return
        const withPrefix = await db.users.get(`usr_${settledUser.userId}`)
        const withoutPrefix = withPrefix || await db.users.get(settledUser.userId)
        const byEmail = withoutPrefix || (settledUser.email ? await db.users.where('email').equals(settledUser.email).first() : null)
        if (cancelled) return
        if (byEmail) {
          if (!byEmail.householdId) {
            setAuthStep('setup')
            setActiveTab('household')
          }
        } else {
          // No profile found after sync: allow setup
          setAuthStep('setup')
        }
      } finally {
        if (!cancelled) setResolvingProfile(false)
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [isFullyAuthenticated, userProfile])

  // If profile exists but household is missing, default setup tab to Household
  useEffect(() => {
    if (isFullyAuthenticated && userProfile && !userProfile.householdId) {
      setActiveTab('household')
    }
  }, [isFullyAuthenticated, userProfile])

  // If user is fully set up, call success callback
  useEffect(() => {
    if (isSetupComplete && onAuthSuccess) {
      try { localStorage.setItem('domusMode', 'cloud') } catch {}
      setPostAuthInProgress(false)
      onAuthSuccess()
    }
  }, [isSetupComplete, onAuthSuccess])

  // Reset authStep when setup is complete
  useEffect(() => {
    if (isSetupComplete) {
      setAuthStep('login')
    }
  }, [isSetupComplete])

  // Hide any Dexie Cloud default UI that might appear
  useEffect(() => {
    // Override any default UI that might appear
    const hideDexieDialogs = () => {
      try {
        const dialogs = document.querySelectorAll('.dxc-login-dlg, .dxc-otp-dlg, .dxc-user-interaction-dlg, [data-dexie-cloud-dialog], dialog[data-dexie-cloud]')
        dialogs.forEach((dialog: Element) => {
          if (dialog instanceof HTMLElement) {
            dialog.style.display = 'none'
            dialog.style.visibility = 'hidden'
            dialog.style.opacity = '0'
          }
        })
      } catch (error) {
        console.warn('Error hiding Dexie dialogs:', error)
      }
    }

    // Initial hide
    hideDexieDialogs()

    // Continuously check for and hide any Dexie Cloud dialogs
    const dialogHideInterval = setInterval(hideDexieDialogs, 200)

    return () => {
      clearInterval(dialogHideInterval)
    }
  }, [])

  const handleLogin = async () => {
    if (!email) return

    setError(null)

    // Ensure cloud API is available (handles case after switching to offline)
    if (!(db as unknown as { cloud?: unknown }).cloud) {
      try { localStorage.setItem('domusMode', 'cloud') } catch {}
      switchDbMode('cloud')
      await Promise.resolve()
    }

    // Normalize and persist email, immediately show OTP form so user can enter code
    const normalizedEmail = email.trim()
    setPendingEmail(normalizedEmail)
    setShowOtpForm(true)
    setIsSendingLink(true)
    toast.success('Check your email for the verification code!')

    // Fire-and-forget: trigger Dexie Cloud to send OTP without blocking the UI
    ;(db as unknown as { cloud: { login: (hints: unknown) => Promise<void> } }).cloud
      .login({ email: normalizedEmail })
      .then(async () => {
        const user = db.cloud.currentUser.value
        if (user) {
          try {
            try { await db.cloud.sync({ wait: true, purpose: 'pull' }) } catch {}
            const profile = await db.users.get(`usr_${user.userId}`) || await db.users.get(user.userId) || (user.email ? await db.users.where('email').equals(user.email).first() : null)
            if (!profile) {
              setAuthStep('setup')
              toast.success("Welcome! Let's set up your profile.")
            } else if (!profile.householdId) {
              setAuthStep('setup')
              toast.success("Welcome back! Let's complete your household setup.")
            } else {
              toast.success('Successfully logged in!')
            }
          } catch (err) {
            console.error('Error checking profile after login:', err)
          }
        }
      })
      .catch((error: unknown) => {
        console.error('Login error (fire-and-forget):', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to log in'
        setError(errorMessage)
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          toast.error('Network error. Please check your connection and try again.')
        } else if (errorMessage.includes('email')) {
          toast.error('Please enter a valid email address.')
        } else {
          // Keep OTP form visible; user might still be able to complete with a valid code
          toast.error('Login failed to send code. You can retry or check your email.')
        }
      })
      .finally(() => {
        setIsSendingLink(false)
      })
  }

  const handleOtpSubmit = async () => {
    if (!otpCode || !pendingEmail || isVerifying) return

    setIsVerifying(true)
    setError(null)

    try {
      // Ensure cloud API available (user may have switched modes)
      if (!(db as unknown as { cloud?: unknown }).cloud) {
        try { localStorage.setItem('domusMode', 'cloud') } catch {}
        switchDbMode('cloud')
        await Promise.resolve()
      }

      // Sanitize OTP input: trim only (codes can be alphanumeric)
      const sanitizedOtp = otpCode.trim()
      if (!sanitizedOtp) {
        throw new Error('Please enter the verification code')
      }

      // If Dexie Cloud is prompting for OTP via userInteraction, submit there
      // Narrow type to OTP prompt when present
      const ui = (db as unknown as { cloud: { userInteraction?: { value?: { type?: string; onSubmit?: (p: { otp: string }) => void } } } }).cloud.userInteraction?.value as {
        type: 'otp'
        onSubmit?: (params: { otp: string }) => void
      } | undefined
      if (ui && ui.type === 'otp' && typeof ui.onSubmit === 'function') {
        // Submit to Dexie Cloud OTP prompt and wait a tick for state to update
        await Promise.resolve(ui.onSubmit({ otp: sanitizedOtp }))
        await new Promise((r) => setTimeout(r, 200))
      } else {
        // Fallback: verify via API directly (resolves on success, rejects on invalid)
        await (db as unknown as { cloud: { login: (hints: { email: string; grant_type: 'otp'; otp: string }) => Promise<void> } }).cloud.login({ email: pendingEmail, grant_type: 'otp', otp: sanitizedOtp })
      }

      // Verify that current user has been authenticated now; poll briefly to avoid race
      let user = (db as unknown as { cloud: { currentUser: { value: { userId?: string; email?: string } | null } } }).cloud.currentUser.value
      for (let i = 0; i < 5 && (!user || !user.userId || !user.email); i++) {
        await new Promise((r) => setTimeout(r, 150))
        user = (db as unknown as { cloud: { currentUser: { value: { userId?: string; email?: string } | null } } }).cloud.currentUser.value
      }
      if (!user || !user.userId || !user.email) throw new Error('Invalid or expired code. Please request a new one.')

      // Ensure we have latest profile from the cloud before deciding to show setup
      try { await db.cloud.sync({ wait: true, purpose: 'pull' }) } catch {}

      // Success: clear any previous error and UI state, then continue with setup if needed
      setError(null)
      setShowOtpForm(false)
      setShowOtpDialog(false)
      setOtpCode('')
      setPendingEmail('')
      toast.success('Successfully verified! Setting up your account...')

      // Check profile and set next step without relying on timers
      try {
        const settledUser = (db as unknown as { cloud: { currentUser: { value: { userId?: string; email?: string } | null } } }).cloud.currentUser.value
        if (settledUser) {
          const profile = await db.users.get(`usr_${settledUser.userId}`) || await db.users.get(settledUser.userId) || (settledUser.email ? await db.users.where('email').equals(settledUser.email).first() : null)
          if (!profile || !profile.householdId) {
            setAuthStep('setup')
            setPostAuthInProgress(false)
          } else {
            setAuthStep('login')
            setPostAuthInProgress(true)
            try { localStorage.setItem('domusMode', 'cloud') } catch {}
            // Notify wrapper to avoid showing Back button and close auth
            try { window.dispatchEvent(new Event('domus:authSuccess')) } catch {}
            onAuthSuccess?.()
          }
        }
      } catch (err) {
        console.error('Error checking profile after verification:', err)
      }
    } catch (error: unknown) {
      console.error('OTP verification error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Invalid verification code'
      setError(errorMessage)

      if (errorMessage.toLowerCase().includes('otp') || errorMessage.toLowerCase().includes('code') || errorMessage.toLowerCase().includes('invalid')) {
        toast.error('Invalid verification code. Please check the code in your email and try again.')
      } else if (errorMessage.toLowerCase().includes('expired')) {
        toast.error('Verification code has expired. Please request a new one.')
      } else {
        toast.error('Verification failed. Please try again.')
      }
    } finally {
      setIsVerifying(false)
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

      const profileData = {
        id: `usr_${currentUser.userId}`,
        name,
        email: currentUser.email,
        color: randomColor,
        type: 'resident' as const,
        createdAt: new Date()
      }
      
      await db.users.add(profileData)
      setActiveTab('household')
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
        id: `hmbr_${crypto.randomUUID()}`,
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
      await db.users.update(`usr_${currentUser.userId}`, { 
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

  // While finishing post-auth (waiting for wrapper or profile to settle), show a small loader
  if (postAuthInProgress || resolvingProfile) {
    return (
      <div className="max-w-sm mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{resolvingProfile ? 'Syncing your profile…' : 'Signing you in…'}</CardTitle>
            <CardDescription>
              {resolvingProfile ? 'Checking for your latest cloud data' : 'Please wait'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show setup screen only when we explicitly decided to show it (authStep === 'setup') and profile is missing
  if (isFullyAuthenticated && authStep === 'setup' && needsSetup) {
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'profile' | 'household')} className="space-y-4">
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

        <div className="mt-6 space-y-2">
          <Button
            variant="ghost"
            onClick={onBackToModeSelection}
            className="w-full"
          >
            Back to Mode Selection
          </Button>
          {onBackToOffline && (
            <Button
              variant="outline"
              onClick={onBackToOffline}
              className="w-full"
            >
              Switch to Offline Mode
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </div>
    )
  }

  // Show OTP form if explicitly requested, regardless of auth state
  if (showOtpForm) {
    return (
      <div className="max-w-sm mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enter Verification Code
            </CardTitle>
            <CardDescription>
              We sent a verification code to your email. Enter it below to complete your sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-sent">Email Sent To:</Label>
              <Input
                id="email-sent"
                type="email"
                value={pendingEmail}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp-code">Verification Code</Label>
              <Input
                id="otp-code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 8-digit code"
                maxLength={8}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otpCode && !isLoading) {
                    handleOtpSubmit()
                  }
                }}
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOtpSubmit(); }} 
                disabled={!otpCode || isVerifying}
                className="flex-1"
              >
                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isVerifying ? 'Verifying...' : 'Verify Code'}
              </Button>
              <Button 
                variant="outline" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation();
                  setShowOtpForm(false)
                  setOtpCode('')
                  setPendingEmail('')
                  setError(null)
                }}
                disabled={isVerifying}
                className="flex-1"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!isFullyAuthenticated) {
    return (
      <div className="max-w-sm mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Domus</CardTitle>
            <CardDescription>
              Enter your email to sign in. We&apos;ll send you a secure login link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && email && !isLoading) {
                    handleLogin()
                  }
                }}
              />
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={!email || isSendingLink}
              className="w-full"
            >
              {isSendingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSendingLink ? 'Sending Login Link...' : 'Send Login Link'}
            </Button>
            
            <div className="text-xs text-muted-foreground text-center">
              No account? No problem! We&apos;ll create one for you automatically.
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {onBackToOffline && (
          <Button
            variant="ghost"
            onClick={onBackToOffline}
            className="w-full"
          >
            Continue in offline mode
          </Button>
        )}


        {/* OTP Dialog */}
        <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Enter Verification Code
              </DialogTitle>
              <DialogDescription>
                We sent a verification code to {pendingEmail}. Please enter it below to complete your sign-in.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 8-digit code"
                  maxLength={8}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otpCode && !isLoading) {
                      handleOtpSubmit()
                    }
                  }}
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-2">
                <Button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOtpSubmit(); }} 
                  disabled={!otpCode || isVerifying}
                  className="flex-1"
                >
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isVerifying ? 'Verifying...' : 'Verify Code'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation();
                    setShowOtpDialog(false)
                    setOtpCode('')
                    setError(null)
                  }}
                  disabled={isVerifying}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // If setup is complete, rely on the useEffect to close this UI; render a tiny loader instead of showing Continue/Back
  if (isSetupComplete) {
    return (
      <div className="max-w-sm mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
            <CardDescription>Preparing your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fallback: show a loader
  return (
    <div className="max-w-sm mx-auto p-6">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  )
}