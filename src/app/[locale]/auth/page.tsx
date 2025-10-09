'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Home, Loader2 } from 'lucide-react'
import SyncLoadingScreen from '@/components/SyncLoadingScreen'

export default function AuthPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')

  // Join household state
  const [joinName, setJoinName] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [householdInfo, setHouseholdInfo] = useState<{ name: string; memberCount: number } | null>(null)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('loginSuccess'))
        // Trigger auth refresh event for Navigation component
        window.dispatchEvent(new CustomEvent('auth-changed'))

        // Show sync screen before navigating
        setIsLoading(false)
        setIsSyncing(true)
      } else {
        toast.error(data.error || t('loginFailed'))
        setIsLoading(false)
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      toast.error(t('loginFailed'))
      setIsLoading(false)
    }
  }

  const handleSyncComplete = (success: boolean) => {
    setIsSyncing(false)
    if (!success) {
      toast.warning('Sync encountered issues, but you can continue working')
    }
    router.push('/')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          name: registerName
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('registerSuccess'))
        // Trigger auth refresh event for Navigation component
        window.dispatchEvent(new CustomEvent('auth-changed'))

        // Show sync screen before navigating
        setIsLoading(false)
        setIsSyncing(true)
      } else {
        toast.error(data.error || t('registerFailed'))
        setIsLoading(false)
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      toast.error(t('registerFailed'))
      setIsLoading(false)
    }
  }

  const handleVerifyInviteCode = async () => {
    if (!inviteCode || inviteCode.length !== 8) {
      return
    }

    setIsVerifyingCode(true)
    try {
      const response = await fetch('/api/households/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode })
      })

      const data = await response.json()

      if (response.ok) {
        setHouseholdInfo(data.household)
      } else {
        setHouseholdInfo(null)
        toast.error(t('invalidInviteCode'))
      }
    } catch {
      setHouseholdInfo(null)
      toast.error(t('verifyCodeFailed'))
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: joinEmail,
          password: joinPassword,
          name: joinName,
          inviteCode
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('joinSuccess'))
        // Trigger auth refresh event for Navigation component
        window.dispatchEvent(new CustomEvent('auth-changed'))

        // Show sync screen before navigating
        setIsLoading(false)
        setIsSyncing(true)
      } else {
        toast.error(data.error || t('joinFailed'))
        setIsLoading(false)
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      toast.error(t('joinFailed'))
      setIsLoading(false)
    }
  }

  // Show sync screen while syncing
  if (isSyncing) {
    return <SyncLoadingScreen onComplete={handleSyncComplete} action="login" />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Home className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Domus</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-modern">
          <CardHeader>
            <CardTitle className="text-2xl">{t('welcome')}</CardTitle>
            <CardDescription>{t('signInDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 p-1.5 h-14 bg-secondary/30 rounded-xl">
                <TabsTrigger
                  value="login"
                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:text-muted-foreground transition-all duration-200 font-medium text-xs sm:text-sm"
                >
                  {t('signIn')}
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:text-muted-foreground transition-all duration-200 font-medium text-xs sm:text-sm"
                >
                  {t('register')}
                </TabsTrigger>
                <TabsTrigger
                  value="join"
                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:text-muted-foreground transition-all duration-200 font-medium text-xs sm:text-sm"
                >
                  {t('joinHousehold')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">{t('email')}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium">{t('password')}</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder={t('passwordPlaceholder')}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={8}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 shadow-md hover:shadow-lg transition-all duration-200 mt-6"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('signIn')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-sm font-medium">{t('name')}</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder={t('namePlaceholder')}
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm font-medium">{t('email')}</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium">{t('password')}</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder={t('passwordPlaceholder')}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={8}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">{t('passwordRequirement')}</p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 shadow-md hover:shadow-lg transition-all duration-200 mt-6"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('register')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join" className="mt-0">
                <form onSubmit={handleJoinHousehold} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-code" className="text-sm font-medium">{t('inviteCode')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="invite-code"
                        type="text"
                        placeholder={t('inviteCodePlaceholder')}
                        value={inviteCode}
                        onChange={(e) => {
                          const code = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
                          setInviteCode(code)
                          if (code.length !== 8) {
                            setHouseholdInfo(null)
                          }
                        }}
                        onBlur={handleVerifyInviteCode}
                        required
                        disabled={isLoading}
                        maxLength={8}
                        className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20 font-mono text-lg tracking-wider"
                      />
                      {isVerifyingCode && <Loader2 className="h-5 w-5 animate-spin self-center text-muted-foreground" />}
                    </div>
                    {householdInfo && (
                      <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-sm font-medium text-primary">✓ {t('validInviteCode')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('joiningHousehold')}: <strong>{householdInfo.name}</strong>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {householdInfo.memberCount} {t('members')}
                        </p>
                      </div>
                    )}
                  </div>

                  {householdInfo && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="join-name" className="text-sm font-medium">{t('name')}</Label>
                        <Input
                          id="join-name"
                          type="text"
                          placeholder={t('namePlaceholder')}
                          value={joinName}
                          onChange={(e) => setJoinName(e.target.value)}
                          required
                          disabled={isLoading}
                          className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="join-email" className="text-sm font-medium">{t('email')}</Label>
                        <Input
                          id="join-email"
                          type="email"
                          placeholder={t('emailPlaceholder')}
                          value={joinEmail}
                          onChange={(e) => setJoinEmail(e.target.value)}
                          required
                          disabled={isLoading}
                          className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="join-password" className="text-sm font-medium">{t('password')}</Label>
                        <Input
                          id="join-password"
                          type="password"
                          placeholder={t('passwordPlaceholder')}
                          value={joinPassword}
                          onChange={(e) => setJoinPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          minLength={8}
                          className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">{t('passwordRequirement')}</p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 shadow-md hover:shadow-lg transition-all duration-200 mt-6"
                        disabled={isLoading || !householdInfo}
                      >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('joinHousehold')}
                      </Button>
                    </>
                  )}

                  {!householdInfo && inviteCode.length === 8 && !isVerifyingCode && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive">{t('invalidInviteCode')}</p>
                    </div>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
