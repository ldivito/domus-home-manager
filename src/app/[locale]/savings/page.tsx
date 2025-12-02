'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PiggyBank,
  Plus,
  Search,
  Target,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'
import { formatARS } from '@/lib/utils'
import { CampaignCard } from './components/CampaignCard'
import { AddCampaignDialog } from './components/AddCampaignDialog'

type FilterStatus = 'all' | 'active' | 'completed'

export default function SavingsPage() {
  const t = useTranslations('savings')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Load data
  const campaignsData = useLiveQuery(() => db.savingsCampaigns.orderBy('createdAt').reverse().toArray())
  const campaigns = useMemo(() => campaignsData || [], [campaignsData])
  const users = useLiveQuery(() => db.users.toArray()) || []
  const participants = useLiveQuery(() => db.savingsParticipants.toArray()) || []

  // Calculate campaign stats
  const stats = useMemo(() => {
    const total = campaigns.length
    const active = campaigns.filter(c => c.isActive && !c.isCompleted).length
    const completed = campaigns.filter(c => c.isCompleted).length

    // Calculate total saved across all campaigns (in ARS for simplicity)
    const totalSaved = campaigns.reduce((sum, c) => sum + (c.currentAmount || 0), 0)

    return { total, active, completed, totalSaved }
  }, [campaigns])

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (campaign.description?.toLowerCase().includes(searchQuery.toLowerCase()))

      // Status filter
      let matchesStatus = true
      if (filterStatus === 'active') {
        matchesStatus = campaign.isActive && !campaign.isCompleted
      } else if (filterStatus === 'completed') {
        matchesStatus = campaign.isCompleted
      }

      return matchesSearch && matchesStatus
    })
  }, [campaigns, searchQuery, filterStatus])

  // Get participants for a campaign
  const getCampaignParticipants = (campaignId: string) => {
    const campaignParticipants = participants.filter(p => p.campaignId === campaignId)
    return campaignParticipants.map(p => users.find(u => u.id === p.userId)).filter(Boolean)
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {t('title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('addCampaign')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                  <PiggyBank className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    {t('stats.totalCampaigns')}
                  </p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                    {stats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {t('stats.activeCampaigns')}
                  </p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {stats.active}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    {t('stats.completedCampaigns')}
                  </p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">
                    {stats.completed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                  <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {t('stats.totalSaved')}
                  </p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    $ {formatARS(stats.totalSaved)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={(value: FilterStatus) => setFilterStatus(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="active">{t('filter.active')}</SelectItem>
              <SelectItem value="completed">{t('filter.completed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campaigns Grid */}
        {filteredCampaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                <PiggyBank className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('empty.title')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
                {t('empty.description')}
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('empty.action')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                participants={getCampaignParticipants(campaign.id!)}
              />
            ))}
          </div>
        )}

        {/* Add Campaign Dialog */}
        <AddCampaignDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          users={users}
        />
      </div>
    </div>
  )
}
