'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Palette, Download, Upload, Trash2, Moon, Sun, Monitor, Globe, Bell, Database, Info, Languages, HardDrive, Shield, Home, MapPin, Phone, Save, X, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { db, HomeSettings } from '@/lib/db'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

export default function SettingsPage() {
  const t = useTranslations('settings')
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

  useEffect(() => {
    setMounted(true)
    loadDatabaseStats()
    loadNotificationSettings()
    loadHomeSettings()
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
        createdAt: homeSettings.createdAt || now
      } as HomeSettings

      if (homeSettings.id) {
        await db.homeSettings.update(homeSettings.id, settingsToSave)
      } else {
        await db.homeSettings.add(settingsToSave)
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

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-xl text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        
        <div className="space-y-8">
          {/* Home Information */}
          <Card className="glass-card shadow-modern">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center">
                    <Home className="mr-3 h-6 w-6 text-primary" />
                    {t('homeSettings.title')}
                  </CardTitle>
                  <CardDescription>{t('homeSettings.description')}</CardDescription>
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
                  className="shrink-0"
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
            <CardContent className="space-y-8">
              {/* Basic Home Information */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-primary" />
                  <Label className="text-lg font-semibold">{t('homeSettings.sections.basicInfo')}</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-8">
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
                        onValueChange={(value: HomeSettings['homeType']) => 
                          setHomeSettings({ ...homeSettings, homeType: value })
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
              <div className="border-t border-border pt-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <Label className="text-lg font-semibold">{t('homeSettings.sections.address')}</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 pl-8">
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="border-t border-border pt-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <Label className="text-lg font-semibold">{t('homeSettings.sections.emergency')}</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8">
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
              <div className="border-t border-border pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Edit3 className="h-5 w-5 text-primary" />
                    <Label className="text-lg font-semibold">{t('homeSettings.sections.notes')}</Label>
                  </div>
                  
                  <div className="pl-8">
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
                <div className="border-t border-border pt-6">
                  <div className="flex justify-end gap-4">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsEditingHome(false)
                        loadHomeSettings() // Reset to saved values
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t('homeSettings.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Language & Appearance */}
          <Card className="glass-card shadow-modern">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Globe className="mr-3 h-6 w-6 text-primary" />
                {t('languageAppearance.title')}
              </CardTitle>
              <CardDescription>{t('languageAppearance.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Language Selector */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Languages className="h-5 w-5 text-primary" />
                  <Label className="text-base font-medium">{t('languageAppearance.language')}</Label>
                </div>
                <Select value={locale} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="max-w-xs">
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
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-primary" />
                  <Label className="text-base font-medium">{t('languageAppearance.theme')}</Label>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="max-w-xs">
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
          
          {/* Notification Preferences */}
          <Card className="glass-card shadow-modern">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Bell className="mr-3 h-6 w-6 text-primary" />
                {t('notifications.title')}
              </CardTitle>
              <CardDescription>{t('notifications.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">{t('notifications.choreReminders')}</Label>
                  <p className="text-sm text-muted-foreground">{t('notifications.choreRemindersDesc')}</p>
                </div>
                <Switch 
                  checked={notifications.choreReminders}
                  onCheckedChange={(checked) => saveNotificationSettings({ ...notifications, choreReminders: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">{t('notifications.taskReminders')}</Label>
                  <p className="text-sm text-muted-foreground">{t('notifications.taskRemindersDesc')}</p>
                </div>
                <Switch 
                  checked={notifications.taskReminders}
                  onCheckedChange={(checked) => saveNotificationSettings({ ...notifications, taskReminders: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">{t('notifications.dailySummary')}</Label>
                  <p className="text-sm text-muted-foreground">{t('notifications.dailySummaryDesc')}</p>
                </div>
                <Switch 
                  checked={notifications.dailySummary}
                  onCheckedChange={(checked) => saveNotificationSettings({ ...notifications, dailySummary: checked })}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Data Management */}
          <Card className="glass-card shadow-modern">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Database className="mr-3 h-6 w-6 text-primary" />
                {t('dataManagement.title')}
              </CardTitle>
              <CardDescription>{t('dataManagement.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Database Stats */}
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center justify-between w-full">
                    <span>{t('dataManagement.totalRecords')}: <strong>{dbStats.totalRecords}</strong></span>
                    <Badge variant="secondary">{t('dataManagement.localStorage')}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-14 text-base shadow-modern hover:shadow-modern-lg transition-all duration-200"
                  onClick={exportData}
                >
                  <Download className="mr-2 h-5 w-5" />
                  {t('dataManagement.exportData')}
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-14 text-base shadow-modern hover:shadow-modern-lg transition-all duration-200"
                  onClick={importData}
                >
                  <Upload className="mr-2 h-5 w-5" />
                  {t('dataManagement.importData')}
                </Button>
              </div>
              
              <div className="border-t border-border"></div>
              
              {/* Danger Zone */}
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  <h4 className="font-semibold text-destructive">{t('dataManagement.dangerZone')}</h4>
                </div>
                <p className="text-sm text-destructive/80">
                  {t('dataManagement.resetWarning')}
                </p>
                <Button 
                  variant="destructive" 
                  size="lg" 
                  className="h-12 text-base"
                  onClick={resetAllData}
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  {t('dataManagement.resetAllData')}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* About */}
          <Card className="glass-card shadow-modern">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Info className="mr-3 h-6 w-6 text-primary" />
                {t('about.title')}
              </CardTitle>
              <CardDescription>{t('about.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">{t('about.version')}</h4>
                    <p className="text-muted-foreground">1.0.0</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">{t('about.platform')}</h4>
                    <p className="text-muted-foreground">{t('about.webApp')}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">{t('about.storage')}</h4>
                    <p className="text-muted-foreground">{t('about.indexedDB')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">{t('about.lastUpdated')}</h4>
                    <p className="text-muted-foreground">{new Date().toLocaleDateString(locale)}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-border"></div>
              
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
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