'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Palette, Download, Upload, Trash2, Moon, Sun, Monitor, Globe, Bell, Database, Info, Languages, HardDrive, Shield, Home, MapPin, Phone, Save, X, Edit3, Calendar, Users, Copy, RefreshCw, UserMinus, Check, LogIn, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { db, HomeSettings } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

interface HouseholdInfo {
  id: string
  name: string
  description: string | null
  ownerId: string
  inviteCode: string
  createdAt: string
  isOwner: boolean
}

interface HouseholdMember {
  id: string
  userId: string
  name: string
  email: string
  role: string
  joinedAt: string
  permissions: {
    canManageMembers: boolean
    canManageSettings: boolean
    canDeleteItems: boolean
  }
}

export default function SettingsPage() {
  const t = useTranslations('settings')
  const th = useTranslations('household')
  const { theme, setTheme } = useTheme()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [dbStats, setDbStats] = useState({ totalRecords: 0, storageSize: 'N/A' })
  const [notifications, setNotifications] = useState({
    sound: true,
    visual: true,
    dailySummary: true,
    choreReminders: true,
    taskReminders: true
  })
  const [homeSettings, setHomeSettings] = useState<Partial<HomeSettings>>({})
  const [isEditingHome, setIsEditingHome] = useState(false)

  // Household management state
  const [householdInfo, setHouseholdInfo] = useState<HouseholdInfo | null>(null)
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [isEditingHousehold, setIsEditingHousehold] = useState(false)
  const [editedHouseholdName, setEditedHouseholdName] = useState('')
  const [editedHouseholdDescription, setEditedHouseholdDescription] = useState('')
  const [isLoadingHousehold, setIsLoadingHousehold] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  // Create household state
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [newHouseholdDescription, setNewHouseholdDescription] = useState('')
  // Join household state
  const [isJoiningHousehold, setIsJoiningHousehold] = useState(false)
  const [joinInviteCode, setJoinInviteCode] = useState('')
  const [joinHouseholdPreview, setJoinHouseholdPreview] = useState<{ id: string; name: string; description: string | null; memberCount: number } | null>(null)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadDatabaseStats()
    loadNotificationSettings()
    loadHomeSettings()
    loadHouseholdInfo()
  }, [])

  const loadDatabaseStats = async () => {
    try {
      const [users, chores, tasks, groceryItems, meals, projects, homeSettings] = await Promise.all([
        db.users.count(),
        db.chores.count(),
        db.tasks.count(),
        db.groceryItems.count(),
        db.meals.count(),
        db.homeImprovements.count(),
        db.homeSettings.count()
      ])
      
      const totalRecords = users + chores + tasks + groceryItems + meals + projects + homeSettings
      setDbStats({ totalRecords, storageSize: 'Local' })
    } catch (error) {
      console.error('Error loading database stats:', error)
    }
  }

  const loadNotificationSettings = () => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem('domus-notifications')
    if (saved) {
      setNotifications(JSON.parse(saved))
    }
  }

  const saveNotificationSettings = (newSettings: typeof notifications) => {
    setNotifications(newSettings)
    localStorage.setItem('domus-notifications', JSON.stringify(newSettings))
    toast.success(t('saved'))
  }

  const loadHomeSettings = async () => {
    try {
      const settings = await db.homeSettings.toArray()
      if (settings.length > 0) {
        setHomeSettings(settings[0])
      }
    } catch (error) {
      console.error('Error loading home settings:', error)
    }
  }

  const saveHomeSettings = async (settings: Partial<HomeSettings>) => {
    try {
      const now = new Date()
      const settingsToSave: HomeSettings = {
        ...settings,
        lastUpdated: now,
        updatedAt: now,
        createdAt: homeSettings.createdAt || now
      } as HomeSettings

      if (homeSettings.id) {
        await db.homeSettings.update(homeSettings.id, settingsToSave)
      } else {
        await db.homeSettings.add({ ...settingsToSave, id: generateId('hst') })
      }
      
      setHomeSettings(settingsToSave)
      setIsEditingHome(false)
      toast.success(t('homeSettings.saved'))
    } catch (error) {
      console.error('Error saving home settings:', error)
      toast.error(t('homeSettings.saveError'))
    }
  }

  const handleLanguageChange = (newLocale: string) => {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPathname)
  }

  const exportData = async () => {
    try {
      const [users, chores, tasks, groceryItems, savedGroceryItems, groceryCategories, meals, savedMeals, mealCategories, projects, homeSettingsRaw] = await Promise.all([
        db.users.toArray(),
        db.chores.toArray(),
        db.tasks.toArray(),
        db.groceryItems.toArray(),
        db.savedGroceryItems.toArray(),
        db.groceryCategories.toArray(),
        db.meals.toArray(),
        db.savedMeals.toArray(),
        db.mealCategories.toArray(),
        db.homeImprovements.toArray(),
        db.homeSettings.toArray()
      ])

      // Remove private info from home settings for export (security)
      const homeSettings = homeSettingsRaw.map(settings => ({
        ...settings,
        privateInfo: undefined // Never export sensitive information
      }))

      const exportData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          users,
          chores,
          tasks,
          groceryItems,
          savedGroceryItems,
          groceryCategories,
          meals,
          savedMeals,
          mealCategories,
          homeImprovements: projects,
          homeSettings
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `domus-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success(t('dataExported'))
    } catch (error) {
      console.error('Export error:', error)
      toast.error(t('exportError'))
    }
  }

  const importData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const importData = JSON.parse(text)
        
        if (!importData.data) {
          throw new Error('Invalid backup file format')
        }

        // Clear existing data and import
        await db.transaction('rw', [db.users, db.chores, db.tasks, db.groceryItems, db.savedGroceryItems, db.groceryCategories, db.meals, db.savedMeals, db.mealCategories, db.homeImprovements, db.homeSettings], async () => {
          await db.users.clear()
          await db.chores.clear()
          await db.tasks.clear()
          await db.groceryItems.clear()
          await db.savedGroceryItems.clear()
          await db.groceryCategories.clear()
          await db.meals.clear()
          await db.savedMeals.clear()
          await db.mealCategories.clear()
          await db.homeImprovements.clear()
          await db.homeSettings.clear()

          if (importData.data.users) await db.users.bulkAdd(importData.data.users)
          if (importData.data.chores) await db.chores.bulkAdd(importData.data.chores)
          if (importData.data.tasks) await db.tasks.bulkAdd(importData.data.tasks)
          if (importData.data.groceryItems) await db.groceryItems.bulkAdd(importData.data.groceryItems)
          if (importData.data.savedGroceryItems) await db.savedGroceryItems.bulkAdd(importData.data.savedGroceryItems)
          if (importData.data.groceryCategories) await db.groceryCategories.bulkAdd(importData.data.groceryCategories)
          if (importData.data.meals) await db.meals.bulkAdd(importData.data.meals)
          if (importData.data.savedMeals) await db.savedMeals.bulkAdd(importData.data.savedMeals)
          if (importData.data.mealCategories) await db.mealCategories.bulkAdd(importData.data.mealCategories)
          if (importData.data.homeImprovements) await db.homeImprovements.bulkAdd(importData.data.homeImprovements)
          if (importData.data.homeSettings) await db.homeSettings.bulkAdd(importData.data.homeSettings)
        })

        await loadDatabaseStats()
        toast.success(t('dataImported'))
      } catch (error) {
        console.error('Import error:', error)
        toast.error(t('importError'))
      }
    }
    input.click()
  }

  const resetAllData = async () => {
    if (!confirm(t('confirmReset'))) return

    try {
      await db.transaction('rw', [db.users, db.chores, db.tasks, db.groceryItems, db.savedGroceryItems, db.groceryCategories, db.meals, db.savedMeals, db.mealCategories, db.homeImprovements, db.homeSettings], async () => {
        await db.users.clear()
        await db.chores.clear()
        await db.tasks.clear()
        await db.groceryItems.clear()
        await db.savedGroceryItems.clear()
        await db.groceryCategories.clear()
        await db.meals.clear()
        await db.savedMeals.clear()
        await db.mealCategories.clear()
        await db.homeImprovements.clear()
        await db.homeSettings.clear()
      })

      await loadDatabaseStats()
      toast.success(t('dataReset'))
    } catch (error) {
      console.error('Reset error:', error)
      toast.error(t('resetError'))
    }
  }

  // Household management functions
  const loadHouseholdInfo = async () => {
    setIsLoadingHousehold(true)
    try {
      const response = await fetch('/api/households/info')
      if (response.ok) {
        const data = await response.json()
        setHouseholdInfo(data.household)
        setHouseholdMembers(data.members || [])
        setEditedHouseholdName(data.household.name)
        setEditedHouseholdDescription(data.household.description || '')
      } else if (response.status === 404) {
        // No household found - this is fine, user can create one
        setHouseholdInfo(null)
        setHouseholdMembers([])
      }
    } catch (error) {
      // Silently handle errors - user might not be logged in or household API might not be available
      console.log('Household info not available:', error)
      setHouseholdInfo(null)
      setHouseholdMembers([])
    } finally {
      setIsLoadingHousehold(false)
    }
  }

  const handleUpdateHousehold = async () => {
    if (!householdInfo) return

    try {
      const response = await fetch('/api/households/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedHouseholdName,
          description: editedHouseholdDescription
        })
      })

      if (response.ok) {
        toast.success(th('householdUpdated'))
        setIsEditingHousehold(false)
        await loadHouseholdInfo()
      } else {
        const data = await response.json()
        toast.error(data.error || th('insufficientPermissions'))
      }
    } catch (error) {
      console.error('Error updating household:', error)
      toast.error(th('insufficientPermissions'))
    }
  }

  const handleCopyInviteCode = async () => {
    if (!householdInfo) return

    try {
      await navigator.clipboard.writeText(householdInfo.inviteCode)
      setCopiedCode(true)
      toast.success(th('inviteCodeCopied'))
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (error) {
      console.error('Error copying invite code:', error)
    }
  }

  const handleRegenerateInviteCode = async () => {
    if (!householdInfo || !confirm(th('regenerateCodeConfirm'))) return

    try {
      const response = await fetch('/api/households/regenerate-code', {
        method: 'POST'
      })

      if (response.ok) {
        toast.success(th('codeRegenerated'))
        await loadHouseholdInfo()
      } else {
        const data = await response.json()
        toast.error(data.error || th('insufficientPermissions'))
      }
    } catch (error) {
      console.error('Error regenerating invite code:', error)
      toast.error(th('insufficientPermissions'))
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(th('removeMemberConfirm'))) return

    try {
      const response = await fetch('/api/households/remove-member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (response.ok) {
        toast.success(th('memberRemoved'))
        await loadHouseholdInfo()
      } else {
        const data = await response.json()
        toast.error(data.error || th('insufficientPermissions'))
      }
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error(th('insufficientPermissions'))
    }
  }

  const handleCreateHousehold = async () => {
    if (!newHouseholdName.trim()) {
      toast.error(th('householdNameRequired') || 'Household name is required')
      return
    }

    setIsCreatingHousehold(true)

    try {
      const response = await fetch('/api/households/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHouseholdName,
          description: newHouseholdDescription
        })
      })

      if (response.ok) {
        toast.success(th('householdCreated'))
        // Force page reload to ensure new session cookie is applied
        window.location.reload()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to create household')
        setIsCreatingHousehold(false)
      }
    } catch (error) {
      console.error('Error creating household:', error)
      toast.error('Failed to create household')
      setIsCreatingHousehold(false)
    }
  }

  const handleVerifyInviteCode = async () => {
    if (!joinInviteCode.trim()) {
      toast.error(th('inviteCodeRequired') || 'Invite code is required')
      return
    }

    setIsVerifyingCode(true)
    setJoinHouseholdPreview(null)

    try {
      const response = await fetch('/api/households/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinInviteCode.trim() })
      })

      if (response.ok) {
        const data = await response.json()
        setJoinHouseholdPreview(data.household)
      } else {
        const data = await response.json()
        toast.error(data.error || th('invalidInviteCode') || 'Invalid invite code')
      }
    } catch (error) {
      console.error('Error verifying invite code:', error)
      toast.error(th('invalidInviteCode') || 'Invalid invite code')
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleJoinHousehold = async () => {
    if (!joinInviteCode.trim()) {
      toast.error(th('inviteCodeRequired') || 'Invite code is required')
      return
    }

    setIsJoiningHousehold(true)

    try {
      const response = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinInviteCode.trim() })
      })

      if (response.ok) {
        toast.success(th('householdJoined') || 'Successfully joined household!')
        // Force page reload to ensure new session cookie is applied
        window.location.reload()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to join household')
        setIsJoiningHousehold(false)
      }
    } catch (error) {
      console.error('Error joining household:', error)
      toast.error('Failed to join household')
      setIsJoiningHousehold(false)
    }
  }

  const handleCancelJoin = () => {
    setJoinInviteCode('')
    setJoinHouseholdPreview(null)
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="space-y-1 md:space-y-2">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        
        <div className="space-y-4 md:space-y-6 lg:space-y-8">
          {/* Home Information */}
          <Card className="glass-card shadow-modern">
            <CardHeader className="pb-4 md:pb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl md:text-2xl flex items-center">
                    <Home className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
                    {t('homeSettings.title')}
                  </CardTitle>
                  <CardDescription className="text-sm">{t('homeSettings.description')}</CardDescription>
                </div>
                <Button
                  variant={isEditingHome ? "default" : "outline"}
                  onClick={() => {
                    if (isEditingHome) {
                      saveHomeSettings(homeSettings)
                    } else {
                      setIsEditingHome(true)
                    }
                  }}
                  className="shrink-0 w-full sm:w-auto"
                >
                  {isEditingHome ? (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {t('homeSettings.save')}
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4 mr-2" />
                      {t('homeSettings.edit')}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 md:space-y-8">
              {/* Basic Home Information */}
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <Home className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <Label className="text-base md:text-lg font-semibold">{t('homeSettings.sections.basicInfo')}</Label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pl-0 md:pl-8">
                  <div className="space-y-2">
                    <Label htmlFor="homeName">{t('homeSettings.fields.homeName')}</Label>
                    {isEditingHome ? (
                      <Input
                        id="homeName"
                        value={homeSettings.homeName || ''}
                        onChange={(e) => setHomeSettings({ ...homeSettings, homeName: e.target.value })}
                        placeholder={t('homeSettings.placeholders.homeName')}
                      />
                    ) : (
                      <p className="text-muted-foreground">{homeSettings.homeName || t('homeSettings.notSet')}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="homeType">{t('homeSettings.fields.homeType')}</Label>
                    {isEditingHome ? (
                      <Select
                        value={homeSettings.homeType || ''}
                        onValueChange={(value: string) => 
                          setHomeSettings({ ...homeSettings, homeType: value as HomeSettings['homeType'] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('homeSettings.placeholders.homeType')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="house">{t('homeSettings.homeTypes.house')}</SelectItem>
                          <SelectItem value="apartment">{t('homeSettings.homeTypes.apartment')}</SelectItem>
                          <SelectItem value="condo">{t('homeSettings.homeTypes.condo')}</SelectItem>
                          <SelectItem value="townhouse">{t('homeSettings.homeTypes.townhouse')}</SelectItem>
                          <SelectItem value="other">{t('homeSettings.homeTypes.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-muted-foreground">{homeSettings.homeType ? t(`homeSettings.homeTypes.${homeSettings.homeType}`) : t('homeSettings.notSet')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">{t('homeSettings.fields.bedrooms')}</Label>
                    {isEditingHome ? (
                      <Input
                        id="bedrooms"
                        type="number"
                        min="0"
                        max="20"
                        value={homeSettings.bedrooms || ''}
                        onChange={(e) => setHomeSettings({ ...homeSettings, bedrooms: parseInt(e.target.value) || undefined })}
                      />
                    ) : (
                      <p className="text-muted-foreground">{homeSettings.bedrooms || t('homeSettings.notSet')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">{t('homeSettings.fields.bathrooms')}</Label>
                    {isEditingHome ? (
                      <Input
                        id="bathrooms"
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={homeSettings.bathrooms || ''}
                        onChange={(e) => setHomeSettings({ ...homeSettings, bathrooms: parseFloat(e.target.value) || undefined })}
                      />
                    ) : (
                      <p className="text-muted-foreground">{homeSettings.bathrooms || t('homeSettings.notSet')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="border-t border-border pt-4 md:pt-6">
                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-center gap-2 md:gap-3">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <Label className="text-base md:text-lg font-semibold">{t('homeSettings.sections.address')}</Label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pl-0 md:pl-8">
                    <div className="space-y-2">
                      <Label htmlFor="street">{t('homeSettings.fields.street')}</Label>
                      {isEditingHome ? (
                        <Input
                          id="street"
                          value={homeSettings.address?.street || ''}
                          onChange={(e) => setHomeSettings({ 
                            ...homeSettings, 
                            address: { ...homeSettings.address, street: e.target.value }
                          })}
                          placeholder={t('homeSettings.placeholders.street')}
                        />
                      ) : (
                        <p className="text-muted-foreground">{homeSettings.address?.street || t('homeSettings.notSet')}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">{t('homeSettings.fields.city')}</Label>
                        {isEditingHome ? (
                          <Input
                            id="city"
                            value={homeSettings.address?.city || ''}
                            onChange={(e) => setHomeSettings({ 
                              ...homeSettings, 
                              address: { ...homeSettings.address, city: e.target.value }
                            })}
                            placeholder={t('homeSettings.placeholders.city')}
                          />
                        ) : (
                          <p className="text-muted-foreground">{homeSettings.address?.city || t('homeSettings.notSet')}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="stateProvince">{t('homeSettings.fields.stateProvince')}</Label>
                        {isEditingHome ? (
                          <Input
                            id="stateProvince"
                            value={homeSettings.address?.stateProvince || ''}
                            onChange={(e) => setHomeSettings({ 
                              ...homeSettings, 
                              address: { ...homeSettings.address, stateProvince: e.target.value }
                            })}
                            placeholder={t('homeSettings.placeholders.stateProvince')}
                          />
                        ) : (
                          <p className="text-muted-foreground">{homeSettings.address?.stateProvince || t('homeSettings.notSet')}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">{t('homeSettings.fields.postalCode')}</Label>
                        {isEditingHome ? (
                          <Input
                            id="postalCode"
                            value={homeSettings.address?.postalCode || ''}
                            onChange={(e) => setHomeSettings({ 
                              ...homeSettings, 
                              address: { ...homeSettings.address, postalCode: e.target.value }
                            })}
                            placeholder={t('homeSettings.placeholders.postalCode')}
                          />
                        ) : (
                          <p className="text-muted-foreground">{homeSettings.address?.postalCode || t('homeSettings.notSet')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="border-t border-border pt-4 md:pt-6">
                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Phone className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <Label className="text-base md:text-lg font-semibold">{t('homeSettings.sections.emergency')}</Label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pl-0 md:pl-8">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyName">{t('homeSettings.fields.emergencyName')}</Label>
                      {isEditingHome ? (
                        <Input
                          id="emergencyName"
                          value={homeSettings.emergencyContact?.name || ''}
                          onChange={(e) => setHomeSettings({ 
                            ...homeSettings, 
                            emergencyContact: { ...homeSettings.emergencyContact, name: e.target.value }
                          })}
                          placeholder={t('homeSettings.placeholders.emergencyName')}
                        />
                      ) : (
                        <p className="text-muted-foreground">{homeSettings.emergencyContact?.name || t('homeSettings.notSet')}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="emergencyPhone">{t('homeSettings.fields.emergencyPhone')}</Label>
                      {isEditingHome ? (
                        <Input
                          id="emergencyPhone"
                          type="tel"
                          value={homeSettings.emergencyContact?.phone || ''}
                          onChange={(e) => setHomeSettings({ 
                            ...homeSettings, 
                            emergencyContact: { ...homeSettings.emergencyContact, phone: e.target.value }
                          })}
                          placeholder={t('homeSettings.placeholders.emergencyPhone')}
                        />
                      ) : (
                        <p className="text-muted-foreground">{homeSettings.emergencyContact?.phone || t('homeSettings.notSet')}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="emergencyRelationship">{t('homeSettings.fields.emergencyRelationship')}</Label>
                      {isEditingHome ? (
                        <Input
                          id="emergencyRelationship"
                          value={homeSettings.emergencyContact?.relationship || ''}
                          onChange={(e) => setHomeSettings({ 
                            ...homeSettings, 
                            emergencyContact: { ...homeSettings.emergencyContact, relationship: e.target.value }
                          })}
                          placeholder={t('homeSettings.placeholders.emergencyRelationship')}
                        />
                      ) : (
                        <p className="text-muted-foreground">{homeSettings.emergencyContact?.relationship || t('homeSettings.notSet')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="border-t border-border pt-4 md:pt-6">
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Edit3 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <Label className="text-base md:text-lg font-semibold">{t('homeSettings.sections.notes')}</Label>
                  </div>

                  <div className="pl-0 md:pl-8">
                    {isEditingHome ? (
                      <Textarea
                        value={homeSettings.notes || ''}
                        onChange={(e) => setHomeSettings({ ...homeSettings, notes: e.target.value })}
                        placeholder={t('homeSettings.placeholders.notes')}
                        rows={3}
                        className="resize-none"
                      />
                    ) : (
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {homeSettings.notes || t('homeSettings.noNotes')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Cancel Button in Edit Mode */}
              {isEditingHome && (
                <div className="border-t border-border pt-4 md:pt-6">
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingHome(false)
                        loadHomeSettings() // Reset to saved values
                      }}
                      className="w-full sm:w-auto"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t('homeSettings.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Household Management */}
          <Card className="glass-card shadow-modern">
            <CardHeader className="pb-4 md:pb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl md:text-2xl flex items-center">
                    <Users className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
                    {th('title')}
                  </CardTitle>
                  <CardDescription className="text-sm">{th('description')}</CardDescription>
                </div>
                {householdInfo && (householdInfo.isOwner || householdMembers.find(m => m.userId === householdInfo.ownerId)?.permissions?.canManageSettings) && (
                  <Button
                    variant={isEditingHousehold ? "default" : "outline"}
                    onClick={() => {
                      if (isEditingHousehold) {
                        handleUpdateHousehold()
                      } else {
                        setIsEditingHousehold(true)
                      }
                    }}
                    className="shrink-0 w-full sm:w-auto"
                  >
                    {isEditingHousehold ? (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {t('homeSettings.save')}
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-4 w-4 mr-2" />
                        {t('homeSettings.edit')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 md:space-y-8">
              {isLoadingHousehold ? (
                <div className="text-center py-6 md:py-8 text-muted-foreground">
                  {th('loading')}...
                </div>
              ) : householdInfo ? (
                <>
                  {/* Household Information */}
                  <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Home className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      <Label className="text-base md:text-lg font-semibold">{th('householdInfo')}</Label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:gap-6 pl-0 md:pl-8">
                      <div className="space-y-2">
                        <Label htmlFor="householdName">{th('householdName')}</Label>
                        {isEditingHousehold ? (
                          <Input
                            id="householdName"
                            value={editedHouseholdName}
                            onChange={(e) => setEditedHouseholdName(e.target.value)}
                            placeholder={th('householdNamePlaceholder')}
                          />
                        ) : (
                          <p className="text-muted-foreground">{householdInfo.name}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="householdDescription">{th('householdDescription')}</Label>
                        {isEditingHousehold ? (
                          <Textarea
                            id="householdDescription"
                            value={editedHouseholdDescription}
                            onChange={(e) => setEditedHouseholdDescription(e.target.value)}
                            placeholder={th('householdDescriptionPlaceholder')}
                            rows={3}
                            className="resize-none"
                          />
                        ) : (
                          <p className="text-muted-foreground">{householdInfo.description || th('noDescription')}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Invite Code Section */}
                  <div className="border-t border-border pt-4 md:pt-6">
                    <div className="space-y-4 md:space-y-6">
                      <div className="flex items-center gap-2 md:gap-3">
                        <Copy className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        <Label className="text-base md:text-lg font-semibold">{th('inviteCode')}</Label>
                      </div>

                      <div className="pl-0 md:pl-8 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 w-full sm:max-w-md">
                            <div className="flex items-center gap-2">
                              <code className="flex-1 px-3 md:px-4 py-2.5 md:py-3 bg-muted rounded-lg font-mono text-base md:text-lg tracking-wider border border-border text-center sm:text-left">
                                {householdInfo.inviteCode}
                              </code>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={handleCopyInviteCode}
                                className="h-10 w-10 md:h-11 md:w-11 shrink-0"
                              >
                                {copiedCode ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {th('inviteCodeDescription')}
                            </p>
                          </div>
                        </div>

                        {householdInfo.isOwner && (
                          <Button
                            variant="outline"
                            onClick={handleRegenerateInviteCode}
                            className="gap-2 w-full sm:w-auto"
                          >
                            <RefreshCw className="h-4 w-4" />
                            {th('regenerateCode')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="border-t border-border pt-4 md:pt-6">
                    <div className="space-y-4 md:space-y-6">
                      <div className="flex items-center gap-2 md:gap-3">
                        <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        <Label className="text-base md:text-lg font-semibold">{th('members')} ({householdMembers.length})</Label>
                      </div>

                      <div className="pl-0 md:pl-8 space-y-3">
                        {householdMembers.map((member) => {
                          const currentUserMember = householdMembers.find(m => m.userId === householdInfo.ownerId)
                          const canRemove = currentUserMember && (
                            currentUserMember.role === 'owner' ||
                            (currentUserMember.permissions.canManageMembers && member.role !== 'admin' && member.role !== 'owner')
                          )

                          return (
                            <div
                              key={member.id}
                              className="flex items-start sm:items-center justify-between p-3 md:p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <p className="font-medium text-foreground text-sm md:text-base">{member.name}</p>
                                  <Badge variant={member.role === 'owner' ? 'default' : member.role === 'admin' ? 'secondary' : 'outline'} className="text-xs">
                                    {th(member.role)}
                                  </Badge>
                                </div>
                                <p className="text-xs md:text-sm text-muted-foreground truncate">{member.email}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {th('joinedOn')} {new Date(member.joinedAt).toLocaleDateString(locale)}
                                </p>
                              </div>

                              {canRemove && member.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveMember(member.userId)}
                                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Cancel Button in Edit Mode */}
                  {isEditingHousehold && (
                    <div className="border-t border-border pt-4 md:pt-6">
                      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingHousehold(false)
                            setEditedHouseholdName(householdInfo.name)
                            setEditedHouseholdDescription(householdInfo.description || '')
                          }}
                          className="w-full sm:w-auto"
                        >
                          <X className="h-4 w-4 mr-2" />
                          {t('homeSettings.cancel')}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  <div className="text-center py-4">
                    <Users className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3 md:mb-4" />
                    <h3 className="text-base md:text-lg font-semibold text-foreground mb-2">{th('noHousehold')}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground mb-4 md:mb-6 px-2">{th('noHouseholdDescription') || 'Create a new household or join an existing one with an invite code'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto">
                    {/* Create Household Section */}
                    <div className="space-y-4 p-4 md:p-6 border border-border rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
                        <Plus className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        <h4 className="font-semibold text-foreground text-sm md:text-base">{th('createNewHousehold') || 'Create New Household'}</h4>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newHouseholdName" className="text-sm">{th('householdName')}</Label>
                        <Input
                          id="newHouseholdName"
                          value={newHouseholdName}
                          onChange={(e) => setNewHouseholdName(e.target.value)}
                          placeholder={th('householdNamePlaceholder')}
                          disabled={isCreatingHousehold}
                          className="h-10 md:h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newHouseholdDescription" className="text-sm">{th('householdDescription')} {t('homeSettings.fields.optional') || '(Optional)'}</Label>
                        <Textarea
                          id="newHouseholdDescription"
                          value={newHouseholdDescription}
                          onChange={(e) => setNewHouseholdDescription(e.target.value)}
                          placeholder={th('householdDescriptionPlaceholder')}
                          disabled={isCreatingHousehold}
                          rows={3}
                          className="resize-none"
                        />
                      </div>

                      <Button
                        onClick={handleCreateHousehold}
                        disabled={isCreatingHousehold || !newHouseholdName.trim()}
                        className="w-full h-10 md:h-11 shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        {isCreatingHousehold && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        <Plus className="mr-2 h-4 w-4" />
                        {th('createHousehold') || 'Create Household'}
                      </Button>
                    </div>

                    {/* Join Household Section */}
                    <div className="space-y-4 p-4 md:p-6 border border-border rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
                        <LogIn className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        <h4 className="font-semibold text-foreground text-sm md:text-base">{th('joinExistingHousehold') || 'Join Existing Household'}</h4>
                      </div>

                      {!joinHouseholdPreview ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="joinInviteCode" className="text-sm">{th('enterInviteCode') || 'Invite Code'}</Label>
                            <Input
                              id="joinInviteCode"
                              value={joinInviteCode}
                              onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                              placeholder={th('inviteCodePlaceholder') || 'Enter 8-character code'}
                              disabled={isVerifyingCode}
                              className="h-10 md:h-11 font-mono tracking-wider"
                              maxLength={8}
                            />
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {th('inviteCodeHelp') || 'Ask a household member to share their invite code with you'}
                          </p>

                          <Button
                            onClick={handleVerifyInviteCode}
                            disabled={isVerifyingCode || !joinInviteCode.trim()}
                            variant="outline"
                            className="w-full h-10 md:h-11"
                          >
                            {isVerifyingCode && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            {th('verifyCode') || 'Verify Code'}
                          </Button>
                        </>
                      ) : (
                        <>
                          {/* Household Preview */}
                          <div className="p-3 md:p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                            <p className="text-xs md:text-sm text-muted-foreground">{th('joiningHousehold') || 'You are joining:'}</p>
                            <p className="font-semibold text-foreground text-base md:text-lg">{joinHouseholdPreview.name}</p>
                            {joinHouseholdPreview.description && (
                              <p className="text-xs md:text-sm text-muted-foreground">{joinHouseholdPreview.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {joinHouseholdPreview.memberCount} {joinHouseholdPreview.memberCount === 1 ? th('memberSingular') || 'member' : th('membersPlural') || 'members'}
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              onClick={handleCancelJoin}
                              variant="outline"
                              className="flex-1 h-10 md:h-11"
                              disabled={isJoiningHousehold}
                            >
                              <X className="mr-2 h-4 w-4" />
                              {t('homeSettings.cancel') || 'Cancel'}
                            </Button>
                            <Button
                              onClick={handleJoinHousehold}
                              disabled={isJoiningHousehold}
                              className="flex-1 h-10 md:h-11"
                            >
                              {isJoiningHousehold && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                              <LogIn className="mr-2 h-4 w-4" />
                              {th('joinHousehold') || 'Join'}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Language & Appearance */}
          <Card className="glass-card shadow-modern">
            <CardHeader className="pb-4 md:pb-6">
              <CardTitle className="text-xl md:text-2xl flex items-center">
                <Globe className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
                {t('languageAppearance.title')}
              </CardTitle>
              <CardDescription className="text-sm">{t('languageAppearance.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 md:space-y-8">
              {/* Language Selector */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <Languages className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <Label className="text-sm md:text-base font-medium">{t('languageAppearance.language')}</Label>
                </div>
                <Select value={locale} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-full sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border"></div>

              {/* Theme Selector */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <Palette className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <Label className="text-sm md:text-base font-medium">{t('languageAppearance.theme')}</Label>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-full sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        {t('languageAppearance.light')}
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        {t('languageAppearance.dark')}
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        {t('languageAppearance.system')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Settings */}
          <Card className="glass-card shadow-modern">
            <CardHeader className="pb-4 md:pb-6">
              <CardTitle className="text-xl md:text-2xl flex items-center">
                <Calendar className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
                {t('calendar.title')}
              </CardTitle>
              <CardDescription className="text-sm">{t('calendar.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <Label className="text-sm md:text-base font-medium">{t('calendar.startOfWeek')}</Label>
                </div>
                <div className="space-y-2">
                  <p className="text-xs md:text-sm text-muted-foreground">{t('calendar.startOfWeekDescription')}</p>
                  <Select
                    value={homeSettings.preferences?.startOfWeek || 'sunday'}
                    onValueChange={(value: 'sunday' | 'monday') => {
                      setHomeSettings({
                        ...homeSettings,
                        preferences: {
                          ...homeSettings.preferences,
                          startOfWeek: value
                        }
                      })
                      saveHomeSettings({
                        ...homeSettings,
                        preferences: {
                          ...homeSettings.preferences,
                          startOfWeek: value
                        }
                      })
                    }}
                  >
                    <SelectTrigger className="w-full sm:max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sunday">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {t('calendar.sunday')}
                        </div>
                      </SelectItem>
                      <SelectItem value="monday">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {t('calendar.monday')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Notification Preferences */}
          <Card className="glass-card shadow-modern">
            <CardHeader className="pb-4 md:pb-6">
              <CardTitle className="text-xl md:text-2xl flex items-center">
                <Bell className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
                {t('notifications.title')}
              </CardTitle>
              <CardDescription className="text-sm">{t('notifications.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5 md:space-y-1 flex-1">
                  <Label className="text-sm md:text-base font-medium">{t('notifications.choreReminders')}</Label>
                  <p className="text-xs md:text-sm text-muted-foreground">{t('notifications.choreRemindersDesc')}</p>
                </div>
                <Switch
                  checked={notifications.choreReminders}
                  onCheckedChange={(checked) => saveNotificationSettings({ ...notifications, choreReminders: checked })}
                  className="shrink-0"
                />
              </div>

              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5 md:space-y-1 flex-1">
                  <Label className="text-sm md:text-base font-medium">{t('notifications.taskReminders')}</Label>
                  <p className="text-xs md:text-sm text-muted-foreground">{t('notifications.taskRemindersDesc')}</p>
                </div>
                <Switch
                  checked={notifications.taskReminders}
                  onCheckedChange={(checked) => saveNotificationSettings({ ...notifications, taskReminders: checked })}
                  className="shrink-0"
                />
              </div>

              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5 md:space-y-1 flex-1">
                  <Label className="text-sm md:text-base font-medium">{t('notifications.dailySummary')}</Label>
                  <p className="text-xs md:text-sm text-muted-foreground">{t('notifications.dailySummaryDesc')}</p>
                </div>
                <Switch
                  checked={notifications.dailySummary}
                  onCheckedChange={(checked) => saveNotificationSettings({ ...notifications, dailySummary: checked })}
                  className="shrink-0"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Data Management */}
          <Card className="glass-card shadow-modern">
            <CardHeader className="pb-4 md:pb-6">
              <CardTitle className="text-xl md:text-2xl flex items-center">
                <Database className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
                {t('dataManagement.title')}
              </CardTitle>
              <CardDescription className="text-sm">{t('dataManagement.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              {/* Database Stats */}
              <div className="bg-muted/50 border border-border rounded-lg p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                    <span className="text-sm md:text-base">{t('dataManagement.totalRecords')}: <strong>{dbStats.totalRecords}</strong></span>
                    <Badge variant="secondary" className="text-xs">{t('dataManagement.localStorage')}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 md:h-14 text-sm md:text-base shadow-modern hover:shadow-modern-lg transition-all duration-200"
                  onClick={exportData}
                >
                  <Download className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                  {t('dataManagement.exportData')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 md:h-14 text-sm md:text-base shadow-modern hover:shadow-modern-lg transition-all duration-200"
                  onClick={importData}
                >
                  <Upload className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                  {t('dataManagement.importData')}
                </Button>
              </div>

              <div className="border-t border-border"></div>

              {/* Danger Zone */}
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 md:p-6 space-y-3 md:space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
                  <h4 className="font-semibold text-destructive text-sm md:text-base">{t('dataManagement.dangerZone')}</h4>
                </div>
                <p className="text-xs md:text-sm text-destructive/80">
                  {t('dataManagement.resetWarning')}
                </p>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-10 md:h-12 text-sm md:text-base w-full sm:w-auto"
                  onClick={resetAllData}
                >
                  <Trash2 className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                  {t('dataManagement.resetAllData')}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* About */}
          <Card className="glass-card shadow-modern">
            <CardHeader className="pb-4 md:pb-6">
              <CardTitle className="text-xl md:text-2xl flex items-center">
                <Info className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 text-primary" />
                {t('about.title')}
              </CardTitle>
              <CardDescription className="text-sm">{t('about.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-8">
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm md:text-base mb-1 md:mb-2">{t('about.version')}</h4>
                    <p className="text-muted-foreground text-sm">1.0.0</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm md:text-base mb-1 md:mb-2">{t('about.platform')}</h4>
                    <p className="text-muted-foreground text-sm">{t('about.webApp')}</p>
                  </div>
                </div>
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm md:text-base mb-1 md:mb-2">{t('about.storage')}</h4>
                    <p className="text-muted-foreground text-sm">{t('about.indexedDB')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm md:text-base mb-1 md:mb-2">{t('about.lastUpdated')}</h4>
                    <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString(locale)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border"></div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 md:p-4">
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  {t('about.description')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}