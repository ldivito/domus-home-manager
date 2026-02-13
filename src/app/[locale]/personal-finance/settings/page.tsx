'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Settings,
  Home,
  Palette,
  Bell,
  Shield,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const STORAGE_KEY = 'personalFinancePreferences'

interface UserPreferences {
  defaultCurrency: 'ARS' | 'USD'
  startOfWeek: 'monday' | 'sunday'
  dateFormat: 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd'

  householdIntegration: {
    enabled: boolean
    autoShareIncome: boolean
    defaultSharePercentage: number
    shareThreshold: number
    categories: {
      salary: { autoShare: boolean; percentage: number }
      freelance: { autoShare: boolean; percentage: number }
      bonus: { autoShare: boolean; percentage: number }
      other: { autoShare: boolean; percentage: number }
    }
  }

  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
  showBalanceOnCards: boolean
  colorScheme: 'default' | 'colorblind' | 'high-contrast'

  notifications: {
    creditCardDueDates: boolean
    lowBalance: boolean
    monthlyReports: boolean
    householdSharing: boolean
    daysBeforeDue: number
    lowBalanceThreshold: number
  }

  privacy: {
    showBalancesInNotifications: boolean
    requireConfirmationForLargeTransactions: boolean
    largeTransactionThreshold: number
    dataRetentionMonths: number
  }
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultCurrency: 'ARS',
  startOfWeek: 'monday',
  dateFormat: 'dd/mm/yyyy',

  householdIntegration: {
    enabled: true,
    autoShareIncome: false,
    defaultSharePercentage: 50,
    shareThreshold: 10000,
    categories: {
      salary: { autoShare: true, percentage: 60 },
      freelance: { autoShare: false, percentage: 30 },
      bonus: { autoShare: true, percentage: 80 },
      other: { autoShare: false, percentage: 50 }
    }
  },

  theme: 'system',
  compactMode: false,
  showBalanceOnCards: true,
  colorScheme: 'default',

  notifications: {
    creditCardDueDates: true,
    lowBalance: true,
    monthlyReports: false,
    householdSharing: true,
    daysBeforeDue: 3,
    lowBalanceThreshold: 5000
  },

  privacy: {
    showBalancesInNotifications: false,
    requireConfirmationForLargeTransactions: true,
    largeTransactionThreshold: 50000,
    dataRetentionMonths: 24
  },
}

function loadFromStorage(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors, fall through to defaults
  }
  return DEFAULT_PREFERENCES
}

function saveToStorage(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export default function PersonalFinanceSettingsPage() {
  const t = useTranslations('personalFinance')
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    try {
      setPreferences(loadFromStorage())
    } catch {
      toast({
        title: t('settings.messages.loadErrorTitle'),
        description: t('settings.messages.loadErrorMessage'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  const savePreferences = () => {
    setSaving(true)
    try {
      saveToStorage(preferences)
      toast({
        title: t('settings.messages.savedTitle'),
        description: t('settings.messages.savedMessage')
      })
    } catch {
      toast({
        title: t('settings.messages.saveErrorTitle'),
        description: t('settings.messages.saveErrorMessage'),
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (path: string, value: string | number | boolean) => {
    setPreferences(prev => {
      const newPrefs = { ...prev }
      const keys = path.split('.')
      let current: Record<string, unknown> = newPrefs as Record<string, unknown>

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]] as Record<string, unknown>
      }

      current[keys[keys.length - 1]] = value
      return newPrefs
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-10 bg-muted rounded animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" />
            {t('settings.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('settings.subtitle')}
          </p>
        </div>
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? t('settings.saving') : t('settings.saveChanges')}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">{t('settings.tabs.general')}</TabsTrigger>
          <TabsTrigger value="household">{t('settings.tabs.household')}</TabsTrigger>
          <TabsTrigger value="appearance">{t('settings.tabs.appearance')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.tabs.notifications')}</TabsTrigger>
          <TabsTrigger value="privacy">{t('settings.tabs.privacy')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.general.title')}</CardTitle>
              <CardDescription>
                {t('settings.general.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="default-currency">{t('settings.general.defaultCurrency')}</Label>
                  <Select
                    value={preferences.defaultCurrency}
                    onValueChange={(value) => updatePreference('defaultCurrency', value)}
                  >
                    <SelectTrigger id="default-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">{t('settings.general.currencyARS')}</SelectItem>
                      <SelectItem value="USD">{t('settings.general.currencyUSD')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-format">{t('settings.general.dateFormat')}</Label>
                  <Select
                    value={preferences.dateFormat}
                    onValueChange={(value) => updatePreference('dateFormat', value)}
                  >
                    <SelectTrigger id="date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/mm/yyyy">{t('settings.general.dateFormatDMY')}</SelectItem>
                      <SelectItem value="mm/dd/yyyy">{t('settings.general.dateFormatMDY')}</SelectItem>
                      <SelectItem value="yyyy-mm-dd">{t('settings.general.dateFormatYMD')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-of-week">{t('settings.general.startOfWeek')}</Label>
                  <Select
                    value={preferences.startOfWeek}
                    onValueChange={(value) => updatePreference('startOfWeek', value)}
                  >
                    <SelectTrigger id="start-of-week">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">{t('settings.general.monday')}</SelectItem>
                      <SelectItem value="sunday">{t('settings.general.sunday')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="household" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                {t('settings.household.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.household.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.household.enableIntegration')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.household.enableIntegrationHint')}
                  </p>
                </div>
                <Switch
                  checked={preferences.householdIntegration.enabled}
                  onCheckedChange={(checked) => updatePreference('householdIntegration.enabled', checked)}
                />
              </div>

              {preferences.householdIntegration.enabled && (
                <div className="space-y-6 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('settings.household.autoShareIncome')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.household.autoShareIncomeHint')}
                      </p>
                    </div>
                    <Switch
                      checked={preferences.householdIntegration.autoShareIncome}
                      onCheckedChange={(checked) => updatePreference('householdIntegration.autoShareIncome', checked)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="default-share-percentage">{t('settings.household.defaultSharePercentage')}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="default-share-percentage"
                          type="number"
                          min="0"
                          max="100"
                          value={preferences.householdIntegration.defaultSharePercentage}
                          onChange={(e) => updatePreference('householdIntegration.defaultSharePercentage', parseInt(e.target.value) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="share-threshold">{t('settings.household.shareThreshold')}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="share-threshold"
                          type="number"
                          min="0"
                          value={preferences.householdIntegration.shareThreshold}
                          onChange={(e) => updatePreference('householdIntegration.shareThreshold', parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">{preferences.defaultCurrency}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.household.shareThresholdHint')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>{t('settings.household.categoryRules')}</Label>
                    <div className="space-y-3">
                      {Object.entries(preferences.householdIntegration.categories).map(([category, settings]) => (
                        <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="capitalize font-medium">{category}</div>
                            <Switch
                              checked={settings.autoShare}
                              onCheckedChange={(checked) =>
                                updatePreference(`householdIntegration.categories.${category}.autoShare`, checked)
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={settings.percentage}
                              onChange={(e) =>
                                updatePreference(`householdIntegration.categories.${category}.percentage`, parseInt(e.target.value) || 0)
                              }
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                {t('settings.appearance.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.appearance.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">{t('settings.appearance.theme')}</Label>
                  <Select
                    value={preferences.theme}
                    onValueChange={(value) => updatePreference('theme', value)}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('settings.appearance.themeLight')}</SelectItem>
                      <SelectItem value="dark">{t('settings.appearance.themeDark')}</SelectItem>
                      <SelectItem value="system">{t('settings.appearance.themeSystem')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-scheme">{t('settings.appearance.colorScheme')}</Label>
                  <Select
                    value={preferences.colorScheme}
                    onValueChange={(value) => updatePreference('colorScheme', value)}
                  >
                    <SelectTrigger id="color-scheme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t('settings.appearance.colorDefault')}</SelectItem>
                      <SelectItem value="colorblind">{t('settings.appearance.colorColorblind')}</SelectItem>
                      <SelectItem value="high-contrast">{t('settings.appearance.colorHighContrast')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.appearance.compactMode')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.appearance.compactModeHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.compactMode}
                    onCheckedChange={(checked) => updatePreference('compactMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.appearance.showBalances')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.appearance.showBalancesHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.showBalanceOnCards}
                    onCheckedChange={(checked) => updatePreference('showBalanceOnCards', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('settings.notifications.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.notifications.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.creditCardDueDates')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.notifications.creditCardDueDatesHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.creditCardDueDates}
                    onCheckedChange={(checked) => updatePreference('notifications.creditCardDueDates', checked)}
                  />
                </div>

                {preferences.notifications.creditCardDueDates && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="days-before-due">{t('settings.notifications.daysBeforeDue')}</Label>
                    <Input
                      id="days-before-due"
                      type="number"
                      min="1"
                      max="30"
                      value={preferences.notifications.daysBeforeDue}
                      onChange={(e) => updatePreference('notifications.daysBeforeDue', parseInt(e.target.value) || 3)}
                      className="w-20"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.lowBalanceAlerts')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.notifications.lowBalanceAlertsHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.lowBalance}
                    onCheckedChange={(checked) => updatePreference('notifications.lowBalance', checked)}
                  />
                </div>

                {preferences.notifications.lowBalance && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="low-balance-threshold">{t('settings.notifications.lowBalanceThreshold')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="low-balance-threshold"
                        type="number"
                        min="0"
                        value={preferences.notifications.lowBalanceThreshold}
                        onChange={(e) => updatePreference('notifications.lowBalanceThreshold', parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">{preferences.defaultCurrency}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.monthlyReports')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.notifications.monthlyReportsHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.monthlyReports}
                    onCheckedChange={(checked) => updatePreference('notifications.monthlyReports', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.householdSharing')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.notifications.householdSharingHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.householdSharing}
                    onCheckedChange={(checked) => updatePreference('notifications.householdSharing', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('settings.privacy.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.privacy.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.privacy.showBalancesInNotifications')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.privacy.showBalancesInNotificationsHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.privacy.showBalancesInNotifications}
                    onCheckedChange={(checked) => updatePreference('privacy.showBalancesInNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.privacy.confirmLargeTransactions')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.privacy.confirmLargeTransactionsHint')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.privacy.requireConfirmationForLargeTransactions}
                    onCheckedChange={(checked) => updatePreference('privacy.requireConfirmationForLargeTransactions', checked)}
                  />
                </div>

                {preferences.privacy.requireConfirmationForLargeTransactions && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="large-transaction-threshold">{t('settings.privacy.largeTransactionThreshold')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="large-transaction-threshold"
                        type="number"
                        min="0"
                        value={preferences.privacy.largeTransactionThreshold}
                        onChange={(e) => updatePreference('privacy.largeTransactionThreshold', parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">{preferences.defaultCurrency}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="data-retention">{t('settings.privacy.dataRetentionPeriod')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="data-retention"
                      type="number"
                      min="3"
                      max="120"
                      value={preferences.privacy.dataRetentionMonths}
                      onChange={(e) => updatePreference('privacy.dataRetentionMonths', parseInt(e.target.value) || 24)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{t('settings.privacy.dataRetentionMonths')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.privacy.dataRetentionHint')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
