'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, Subscription, SubscriptionCategory, SubscriptionStatus, deleteWithSync, bulkDeleteWithSync } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  CreditCard,
  Calendar,
  DollarSign,
  Filter,
  History,
  Pause,
  Play
} from 'lucide-react'
import { toast } from 'sonner'
import { SubscriptionFormDialog } from './components/SubscriptionFormDialog'
import { RecordPaymentDialog } from './components/RecordPaymentDialog'
import { SubscriptionDetailDialog } from './components/SubscriptionDetailDialog'
import { logger } from '@/lib/logger'

// Stable empty arrays to avoid useMemo dependency issues
const EMPTY_SUBSCRIPTIONS: Subscription[] = []

const CATEGORY_COLORS: Record<SubscriptionCategory, string> = {
  streaming: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  software: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  gaming: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  music: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  cloud_storage: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  news: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  fitness: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  utilities: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  insurance: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  membership: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
}

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  trial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
}

export default function SubscriptionsPage() {
  const t = useTranslations('subscriptions')
  const tCommon = useTranslations('common')

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<SubscriptionCategory | 'all'>('all')
  const [selectedStatus] = useState<SubscriptionStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState('active')

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Selected items
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)

  // Data queries
  const subscriptions = useLiveQuery(() => db.subscriptions.orderBy('nextBillingDate').toArray()) ?? EMPTY_SUBSCRIPTIONS
  const payments = useLiveQuery(() => db.subscriptionPayments.orderBy('paymentDate').reverse().toArray()) ?? []

  // Get exchange rate from Finance module (current month or last available)
  const exchangeRate = useLiveQuery(async () => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Try current month first
    let rate = await db.monthlyExchangeRates
      .where({ month: currentMonth, year: currentYear })
      .first()

    // If not found, get the most recent one
    if (!rate) {
      const rates = await db.monthlyExchangeRates
        .orderBy('[year+month]')
        .reverse()
        .first()
      rate = rates
    }

    return rate
  }, [])

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.providerName?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || sub.category === selectedCategory
      const matchesStatus = selectedStatus === 'all' || sub.status === selectedStatus
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [subscriptions, searchQuery, selectedCategory, selectedStatus])

  // Calculate stats
  const stats = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active')
    const usdRate = exchangeRate?.rate || 1000 // Fallback rate if not set

    const monthlyTotal = active.reduce((sum, s) => {
      let monthlyAmountARS = 0

      // Calculate monthly amount from ARS
      if (s.amountARS) {
        let amount = s.amountARS
        if (s.billingCycle === 'yearly') amount /= 12
        else if (s.billingCycle === 'quarterly') amount /= 3
        else if (s.billingCycle === 'biannually') amount /= 6
        else if (s.billingCycle === 'weekly') amount *= 4
        monthlyAmountARS += amount
      }

      // Calculate monthly amount from USD (convert to ARS)
      if (s.amountUSD) {
        let amount = s.amountUSD
        if (s.billingCycle === 'yearly') amount /= 12
        else if (s.billingCycle === 'quarterly') amount /= 3
        else if (s.billingCycle === 'biannually') amount /= 6
        else if (s.billingCycle === 'weekly') amount *= 4
        monthlyAmountARS += amount * usdRate
      }

      // Fallback to legacy fields if new fields not set
      if (!s.amountARS && !s.amountUSD) {
        let amount = s.amount
        if (s.billingCycle === 'yearly') amount /= 12
        else if (s.billingCycle === 'quarterly') amount /= 3
        else if (s.billingCycle === 'biannually') amount /= 6
        else if (s.billingCycle === 'weekly') amount *= 4
        if (s.currency === 'USD') amount *= usdRate
        monthlyAmountARS += amount
      }

      return sum + monthlyAmountARS
    }, 0)

    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dueThisWeek = active.filter(s => {
      const nextBilling = new Date(s.nextBillingDate)
      return nextBilling >= now && nextBilling <= weekFromNow
    })

    return {
      total: subscriptions.length,
      active: active.length,
      paused: subscriptions.filter(s => s.status === 'paused').length,
      monthlyTotal,
      dueThisWeek: dueThisWeek.length
    }
  }, [subscriptions, exchangeRate])

  // Get active subscriptions for the "active" tab
  const activeSubscriptions = useMemo(() => {
    return filteredSubscriptions.filter(s => s.status === 'active' || s.status === 'trial')
  }, [filteredSubscriptions])

  // Get inactive subscriptions (paused/cancelled)
  const inactiveSubscriptions = useMemo(() => {
    return filteredSubscriptions.filter(s => s.status === 'paused' || s.status === 'cancelled')
  }, [filteredSubscriptions])

  // Helper functions
  const formatDate = (date: Date) => new Date(date).toLocaleDateString()
  const formatCurrency = (amount: number, currency: 'ARS' | 'USD') => {
    return `${currency} ${amount.toLocaleString()}`
  }

  // Format subscription amounts for display
  const formatSubscriptionAmount = (subscription: Subscription) => {
    const parts: string[] = []
    if (subscription.amountARS) {
      parts.push(`ARS ${subscription.amountARS.toLocaleString()}`)
    }
    if (subscription.amountUSD) {
      parts.push(`USD ${subscription.amountUSD.toLocaleString()}`)
    }
    // Fallback to legacy fields if new fields are not set
    if (parts.length === 0) {
      parts.push(formatCurrency(subscription.amount, subscription.currency))
    }
    return parts
  }

  const isDueSoon = (date: Date) => {
    const now = new Date()
    const dueDate = new Date(date)
    const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff <= 7 && daysDiff >= 0
  }

  // Action handlers
  const handleDelete = async () => {
    if (!selectedSubscription?.id) return
    try {
      // Get IDs of associated payments for sync tracking
      const relatedPayments = await db.subscriptionPayments.where('subscriptionId').equals(selectedSubscription.id).toArray()
      // Delete associated payments with sync tracking
      await bulkDeleteWithSync(db.subscriptionPayments, 'subscriptionPayments', relatedPayments.map(p => p.id!))
      await deleteWithSync(db.subscriptions, 'subscriptions', selectedSubscription.id)
      toast.success(t('messages.deleted'))
      setDeleteDialogOpen(false)
      setSelectedSubscription(null)
    } catch (error) {
      logger.error('Error deleting subscription:', error)
      toast.error(t('messages.deleteError'))
    }
  }

  const handlePauseResume = async (subscription: Subscription) => {
    if (!subscription.id) return
    try {
      const newStatus = subscription.status === 'paused' ? 'active' : 'paused'
      await db.subscriptions.update(subscription.id, {
        status: newStatus,
        updatedAt: new Date()
      })
      toast.success(newStatus === 'paused' ? t('messages.paused') : t('messages.resumed'))
    } catch (error) {
      logger.error('Error updating subscription:', error)
      toast.error(t('messages.updateError'))
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('description')}</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('actions.add')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                  <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.active')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">ARS {Math.round(stats.monthlyTotal).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.monthlyTotal')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                  <Calendar className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.dueThisWeek}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.dueThisWeek')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900">
                  <Pause className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.paused}</p>
                  <p className="text-sm text-muted-foreground">{t('stats.paused')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            {t('tabs.active')}
            <Badge variant="secondary" className="ml-1">
              {activeSubscriptions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex items-center gap-2">
            <Pause className="h-4 w-4" />
            {t('tabs.inactive')}
            {inactiveSubscriptions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {inactiveSubscriptions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('tabs.history')}
          </TabsTrigger>
        </TabsList>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {selectedCategory === 'all' ? t('filter.allCategories') : t(`categories.${selectedCategory}`)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedCategory('all')}>
                {t('filter.allCategories')}
              </DropdownMenuItem>
              {Object.keys(CATEGORY_COLORS).map((cat) => (
                <DropdownMenuItem key={cat} onClick={() => setSelectedCategory(cat as SubscriptionCategory)}>
                  {t(`categories.${cat}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Subscriptions Tab */}
        <TabsContent value="active">
          {activeSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('empty.active.title')}</h3>
                <p className="text-muted-foreground mb-4">{t('empty.active.description')}</p>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('actions.add')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSubscriptions.map((subscription) => (
                <Card
                  key={subscription.id}
                  className={`cursor-pointer hover:shadow-lg transition-shadow ${
                    isDueSoon(subscription.nextBillingDate) ? 'border-yellow-500' : ''
                  }`}
                  onClick={() => {
                    setSelectedSubscription(subscription)
                    setDetailDialogOpen(true)
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{subscription.name}</CardTitle>
                        <CardDescription className="truncate">
                          {subscription.providerName || t(`categories.${subscription.category}`)}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSubscription(subscription)
                            setRecordPaymentOpen(true)
                          }}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            {t('actions.recordPayment')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSubscription(subscription)
                            setEditDialogOpen(true)
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            handlePauseResume(subscription)
                          }}>
                            <Pause className="h-4 w-4 mr-2" />
                            {t('actions.pause')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSubscription(subscription)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {tCommon('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={CATEGORY_COLORS[subscription.category]}>
                        {t(`categories.${subscription.category}`)}
                      </Badge>
                      <Badge className={STATUS_COLORS[subscription.status]}>
                        {t(`status.${subscription.status}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        {formatSubscriptionAmount(subscription).map((amount, idx) => (
                          <div key={idx} className={idx === 0 ? "text-2xl font-bold" : "text-lg font-semibold text-muted-foreground"}>
                            {amount}
                          </div>
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        /{t(`cycles.${subscription.billingCycle}`)}
                      </div>
                    </div>
                    <div className={`text-sm mt-2 flex items-center gap-1 ${
                      isDueSoon(subscription.nextBillingDate) ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 'text-muted-foreground'
                    }`}>
                      <Calendar className="h-3.5 w-3.5" />
                      {t('nextBilling')}: {formatDate(subscription.nextBillingDate)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Inactive Subscriptions Tab */}
        <TabsContent value="inactive">
          {inactiveSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Pause className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('empty.inactive.title')}</h3>
                <p className="text-muted-foreground">{t('empty.inactive.description')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveSubscriptions.map((subscription) => (
                <Card key={subscription.id} className="opacity-75">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{subscription.name}</CardTitle>
                        <CardDescription className="truncate">
                          {subscription.providerName || t(`categories.${subscription.category}`)}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {subscription.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handlePauseResume(subscription)}>
                              <Play className="h-4 w-4 mr-2" />
                              {t('actions.resume')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            setSelectedSubscription(subscription)
                            setEditDialogOpen(true)
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedSubscription(subscription)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {tCommon('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={CATEGORY_COLORS[subscription.category]}>
                        {t(`categories.${subscription.category}`)}
                      </Badge>
                      <Badge className={STATUS_COLORS[subscription.status]}>
                        {t(`status.${subscription.status}`)}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {formatSubscriptionAmount(subscription).map((amount, idx) => (
                        <span key={idx} className={idx === 0 ? "text-lg font-medium" : "text-sm ml-2"}>
                          {amount}
                        </span>
                      ))}
                      <span className="text-sm">/{t(`cycles.${subscription.billingCycle}`)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Payment History Tab */}
        <TabsContent value="history">
          {payments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('empty.history.title')}</h3>
                <p className="text-muted-foreground">{t('empty.history.description')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {payments.slice(0, 20).map((payment) => {
                const subscription = subscriptions.find(s => s.id === payment.subscriptionId)
                return (
                  <Card key={payment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{subscription?.name || 'Unknown'}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(payment.paymentDate)}
                            </span>
                            {payment.paymentMethod && <span>{payment.paymentMethod}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(payment.amount, payment.currency)}</p>
                          <Badge variant={payment.status === 'paid' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'}>
                            {t(`paymentStatus.${payment.status}`)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {/* Add Subscription Dialog */}
      <SubscriptionFormDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Edit Subscription Dialog */}
      <SubscriptionFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        subscription={selectedSubscription}
      />
      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        subscription={selectedSubscription}
      />
      <SubscriptionDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        subscription={selectedSubscription}
        onEdit={() => {
          setDetailDialogOpen(false)
          setEditDialogOpen(true)
        }}
        onRecordPayment={() => {
          setDetailDialogOpen(false)
          setRecordPaymentOpen(true)
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.delete.description', { name: selectedSubscription?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
