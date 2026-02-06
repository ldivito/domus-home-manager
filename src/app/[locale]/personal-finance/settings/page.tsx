'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Settings, 
  Home, 
  Palette, 
  Accessibility, 
  Bell, 
  Shield, 
  Download,
  ChevronRight,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Mock user preferences - in real app, load from auth context
interface UserPreferences {
  // General Settings
  defaultCurrency: 'ARS' | 'USD'
  startOfWeek: 'monday' | 'sunday'
  dateFormat: 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd'
  
  // Household Integration
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
  
  // UI/UX Preferences
  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
  showBalanceOnCards: boolean
  colorScheme: 'default' | 'colorblind' | 'high-contrast'
  
  // Notifications
  notifications: {
    creditCardDueDates: boolean
    lowBalance: boolean
    monthlyReports: boolean
    householdSharing: boolean
    daysBeforeDue: number
    lowBalanceThreshold: number
  }
  
  // Privacy & Security
  privacy: {
    showBalancesInNotifications: boolean
    requireConfirmationForLargeTransactions: boolean
    largeTransactionThreshold: number
    dataRetentionMonths: number
  }
  
  // Data Export
  export: {
    includeNotes: boolean
    includeCategories: boolean
    includeWallets: boolean
    defaultFormat: 'csv' | 'json'
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
    shareThreshold: 10000, // ARS
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
  
  export: {
    includeNotes: true,
    includeCategories: true,
    includeWallets: true,
    defaultFormat: 'csv'
  }
}

export default function PersonalFinanceSettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    setLoading(true)
    try {
      // TODO: Load from actual API/localStorage
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate loading
      // For now, use defaults
      setPreferences(DEFAULT_PREFERENCES)
    } catch (error) {
      toast({
        title: 'Error loading preferences',
        description: 'Failed to load your settings. Using defaults.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      // TODO: Save to actual API/localStorage
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate saving
      
      toast({
        title: 'Settings saved',
        description: 'Your preferences have been updated successfully.'
      })
    } catch (error) {
      toast({
        title: 'Error saving settings',
        description: 'Failed to save your preferences. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (path: string, value: any) => {
    setPreferences(prev => {
      const newPrefs = { ...prev }
      const keys = path.split('.')
      let current = newPrefs as any
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
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
            Personal Finance Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your personal finance preferences and household integration
          </p>
        </div>
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="household">Household</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure basic preferences for your personal finance module
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="default-currency">Default Currency</Label>
                  <Select
                    value={preferences.defaultCurrency}
                    onValueChange={(value) => updatePreference('defaultCurrency', value)}
                  >
                    <SelectTrigger id="default-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">Argentine Peso (ARS)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-format">Date Format</Label>
                  <Select
                    value={preferences.dateFormat}
                    onValueChange={(value) => updatePreference('dateFormat', value)}
                  >
                    <SelectTrigger id="date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-of-week">Start of Week</Label>
                  <Select
                    value={preferences.startOfWeek}
                    onValueChange={(value) => updatePreference('startOfWeek', value)}
                  >
                    <SelectTrigger id="start-of-week">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
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
                Household Integration
              </CardTitle>
              <CardDescription>
                Configure how your personal income integrates with household expenses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Household Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow sharing personal income with household common pool
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
                      <Label>Auto-share Income</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically suggest sharing new income based on category rules
                      </p>
                    </div>
                    <Switch
                      checked={preferences.householdIntegration.autoShareIncome}
                      onCheckedChange={(checked) => updatePreference('householdIntegration.autoShareIncome', checked)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="default-share-percentage">Default Share Percentage</Label>
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
                      <Label htmlFor="share-threshold">Share Threshold</Label>
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
                        Only suggest sharing for income above this amount
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Category-specific Rules</Label>
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
                Appearance Settings
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your personal finance module
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={preferences.theme}
                    onValueChange={(value) => updatePreference('theme', value)}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-scheme">Color Scheme</Label>
                  <Select
                    value={preferences.colorScheme}
                    onValueChange={(value) => updatePreference('colorScheme', value)}
                  >
                    <SelectTrigger id="color-scheme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="colorblind">Colorblind Friendly</SelectItem>
                      <SelectItem value="high-contrast">High Contrast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Show more content in less space
                    </p>
                  </div>
                  <Switch
                    checked={preferences.compactMode}
                    onCheckedChange={(checked) => updatePreference('compactMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Balances on Cards</Label>
                    <p className="text-sm text-muted-foreground">
                      Display wallet balances on overview cards
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
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure when and how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Credit Card Due Dates</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify before credit card payments are due
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.creditCardDueDates}
                    onCheckedChange={(checked) => updatePreference('notifications.creditCardDueDates', checked)}
                  />
                </div>

                {preferences.notifications.creditCardDueDates && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="days-before-due">Days before due date</Label>
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
                    <Label>Low Balance Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when wallet balance is low
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.lowBalance}
                    onCheckedChange={(checked) => updatePreference('notifications.lowBalance', checked)}
                  />
                </div>

                {preferences.notifications.lowBalance && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="low-balance-threshold">Low balance threshold</Label>
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
                    <Label>Monthly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive monthly financial summaries
                    </p>
                  </div>
                  <Switch
                    checked={preferences.notifications.monthlyReports}
                    onCheckedChange={(checked) => updatePreference('notifications.monthlyReports', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Household Sharing</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when income sharing opportunities are available
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
                Privacy & Security
              </CardTitle>
              <CardDescription>
                Control how your financial data is handled and displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Balances in Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Include actual amounts in push notifications
                    </p>
                  </div>
                  <Switch
                    checked={preferences.privacy.showBalancesInNotifications}
                    onCheckedChange={(checked) => updatePreference('privacy.showBalancesInNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Confirm Large Transactions</Label>
                    <p className="text-sm text-muted-foreground">
                      Require additional confirmation for large amounts
                    </p>
                  </div>
                  <Switch
                    checked={preferences.privacy.requireConfirmationForLargeTransactions}
                    onCheckedChange={(checked) => updatePreference('privacy.requireConfirmationForLargeTransactions', checked)}
                  />
                </div>

                {preferences.privacy.requireConfirmationForLargeTransactions && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="large-transaction-threshold">Large transaction threshold</Label>
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
                  <Label htmlFor="data-retention">Data Retention Period</Label>
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
                    <span className="text-sm text-muted-foreground">months</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How long to keep your financial data before auto-deletion
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