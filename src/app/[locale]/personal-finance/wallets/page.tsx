'use client'

import { useEffect, useState, useCallback } from 'react'
import { PersonalWallet } from '@/types/personal-finance'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WalletCard } from './components/WalletCard'
import { CreateWalletDialog } from './components/CreateWalletDialog'
import { 
  Plus, 
  Search, 
  Filter,
  Wallet
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'
import { formatBalance, calculateTotalBalance } from '@/lib/utils/finance'

export default function WalletsPage() {
  const t = useTranslations('personalFinance')
  const [wallets, setWallets] = useState<PersonalWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCurrency, setFilterCurrency] = useState<string>('all')
  const { toast } = useToast()

  const loadWallets = useCallback(async () => {
    try {
      setLoading(true)
      const fetchedWallets = await db.personalWallets
        .where('isActive')
        .equals(1)
        .toArray()

      const sortedWallets = fetchedWallets.sort((a, b) =>
        new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
      )
      setWallets(sortedWallets)
    } catch (error) {
      console.error('Error loading wallets:', error)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // t and toast are stable UI functions — excluding them stops infinite re-render loop

  useEffect(() => {
    loadWallets()
  }, [loadWallets])

  const handleWalletCreated = (newWallet: PersonalWallet) => {
    setWallets(prev => [newWallet, ...prev])
  }

  const handleEditWallet = (wallet: PersonalWallet) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // TODO: Implement edit functionality
    toast({
      title: t('wallets.editTitle'),
      description: t('wallets.editComingSoon'),
    })
  }

  const handleDeleteWallet = async (walletId: string) => {
    if (!confirm(t('wallets.confirmDelete'))) {
      return
    }

    try {
      await db.personalWallets.update(walletId, {
        isActive: false,
        updatedAt: new Date(),
      })
      
      setWallets(prev => prev.filter(w => w.id !== walletId))
      
      toast({
        title: t('wallets.deleteSuccess'),
        description: t('wallets.deleteSuccessDesc'),
      })
    } catch (error) {
      console.error('Error deleting wallet:', error)
      toast({
        title: t('common.error'),
        description: t('wallets.deleteError'),
        variant: 'destructive',
      })
    }
  }

  // Filter wallets based on search and filters
  const filteredWallets = wallets.filter(wallet => {
    const matchesSearch = wallet.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || wallet.type === filterType
    const matchesCurrency = filterCurrency === 'all' || wallet.currency === filterCurrency
    
    return matchesSearch && matchesType && matchesCurrency
  })

  // Calculate totals
  const totalBalances = calculateTotalBalance(wallets)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('wallets.title')}</h1>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            {t('wallets.addWallet')}
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-gray-200 rounded flex-1"></div>
                  <div className="h-8 bg-gray-200 rounded flex-1"></div>
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
      {/* Header with totals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('wallets.title')}</h1>
            <p className="text-muted-foreground">
              {t('wallets.subtitle')}
            </p>
          </div>
          
          <CreateWalletDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('wallets.addWallet')}
              </Button>
            }
            onWalletCreated={handleWalletCreated}
          />
        </div>

        {/* Balance overview */}
        {wallets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('dashboard.totalCurrency', { currency: 'ARS' })}
                  </span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatBalance(totalBalances.ARS, 'ARS').formatted}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('dashboard.totalCurrency', { currency: 'USD' })}
                  </span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatBalance(totalBalances.USD, 'USD').formatted}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('wallets.activeWallets')}
                  </span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {wallets.length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Filters and search */}
      {wallets.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('wallets.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t('wallets.allTypes')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('wallets.allTypes')}</SelectItem>
                    <SelectItem value="physical">{t('wallets.typePhysical')}</SelectItem>
                    <SelectItem value="bank">{t('wallets.typeBank')}</SelectItem>
                    <SelectItem value="credit_card">{t('wallets.typeCreditCard')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder={t('wallets.allCurrencies')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('wallets.allCurrencies')}</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Active filters display */}
            {(searchTerm || filterType !== 'all' || filterCurrency !== 'all') && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {searchTerm && (
                  <Badge variant="secondary" className="gap-1">
                    {t('wallets.filterSearchLabel', { term: searchTerm })}
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filterType !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('wallets.filterTypeLabel', { type: filterType.replace('_', ' ') })}
                    <button 
                      onClick={() => setFilterType('all')}
                      className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filterCurrency !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('wallets.filterCurrencyLabel', { currency: filterCurrency })}
                    <button 
                      onClick={() => setFilterCurrency('all')}
                      className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Wallets grid */}
      {filteredWallets.length === 0 && wallets.length > 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">{t('wallets.noWalletsFiltered')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('wallets.noWalletsFilteredDesc')}
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('')
                setFilterType('all')
                setFilterCurrency('all')
              }}
            >
              {t('wallets.clearFilters')}
            </Button>
          </CardContent>
        </Card>
      ) : filteredWallets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">{t('wallets.noWalletsYet')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('wallets.createFirstWalletDesc')}
            </p>
            <CreateWalletDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('wallets.createFirstWallet')}
                </Button>
              }
              onWalletCreated={handleWalletCreated}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredWallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              onEdit={handleEditWallet}
              onDelete={handleDeleteWallet}
            />
          ))}
        </div>
      )}

      {/* Results count */}
      {filteredWallets.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {t('wallets.showingCount', { showing: filteredWallets.length, total: wallets.length })}
        </div>
      )}
    </div>
  )
}
