'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PersonalWallet } from '@/types/personal-finance'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
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
import { WalletCard } from './components/WalletCard'
import { CreateWalletDialog } from './components/CreateWalletDialog'
import { EditWalletDialog } from './components/EditWalletDialog'
import {
  Plus,
  Search,
  Filter,
  Wallet
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatBalance, calculateTotalBalance } from '@/lib/utils/finance'

export default function WalletsPage() {
  const t = useTranslations('personalFinance')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCurrency, setFilterCurrency] = useState<string>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [walletToDelete, setWalletToDelete] = useState<PersonalWallet | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [walletToEdit, setWalletToEdit] = useState<PersonalWallet | null>(null)
  const { toast } = useToast()

  // Current user (TODO: Get from auth context)
  const userId = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a'

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reactive data loading via useLiveQuery
  const wallets = useLiveQuery(
    () => db.personalWallets
      .where({ userId, isActive: 1 })
      .toArray()
      .then(w => w.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )),
    [userId]
  )

  const loading = wallets === undefined

  const handleEditWallet = (wallet: PersonalWallet) => {
    setWalletToEdit(wallet)
    setEditDialogOpen(true)
  }

  const handleDeleteWallet = (walletId: string) => {
    const wallet = wallets?.find(w => w.id === walletId)
    if (wallet) {
      setWalletToDelete(wallet)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = async () => {
    if (!walletToDelete?.id) return

    try {
      await db.personalWallets.update(walletToDelete.id, {
        isActive: false,
        updatedAt: new Date()
      })

      toast({
        title: t('deleteConfirm.deleteWalletTitle'),
        description: t('deleteConfirm.deleteWalletMessage'),
      })
    } catch (error) {
      console.error('Error deleting wallet:', error)
      toast({
        title: t('common.error'),
        description: t('walletForm.errorMessage'),
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setWalletToDelete(null)
    }
  }

  // Filter wallets based on search and filters
  const filteredWallets = useMemo(() => {
    if (!wallets) return []
    return wallets.filter(wallet => {
      const matchesSearch = wallet.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      const matchesType = filterType === 'all' || wallet.type === filterType
      const matchesCurrency = filterCurrency === 'all' || wallet.currency === filterCurrency
      return matchesSearch && matchesType && matchesCurrency
    })
  }, [wallets, debouncedSearch, filterType, filterCurrency])

  // Calculate totals
  const totalBalances = useMemo(() =>
    wallets ? calculateTotalBalance(wallets) : { ARS: 0, USD: 0 },
    [wallets]
  )

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
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-muted rounded flex-1"></div>
                  <div className="h-8 bg-muted rounded flex-1"></div>
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
          />
        </div>

        {/* Balance overview */}
        {wallets && wallets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{t('wallets.totalARS')}</span>
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
                  <span className="text-sm font-medium text-muted-foreground">{t('wallets.totalUSD')}</span>
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
                  <span className="text-sm font-medium text-muted-foreground">{t('wallets.activeWallets')}</span>
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
      {wallets && wallets.length > 0 && (
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
                    <SelectValue placeholder={t('walletForm.type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('wallets.allTypes')}</SelectItem>
                    <SelectItem value="physical">{t('wallets.physical')}</SelectItem>
                    <SelectItem value="bank">{t('wallets.bank')}</SelectItem>
                    <SelectItem value="credit_card">{t('wallets.creditCard')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder={t('walletForm.currency')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('wallets.allCurrency')}</SelectItem>
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
                    {t('wallets.filterSearch')} {searchTerm}
                    <button
                      onClick={() => setSearchTerm('')}
                      className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                    >
                      x
                    </button>
                  </Badge>
                )}
                {filterType !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('wallets.filterType')} {filterType.replace('_', ' ')}
                    <button
                      onClick={() => setFilterType('all')}
                      className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                    >
                      x
                    </button>
                  </Badge>
                )}
                {filterCurrency !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    {t('wallets.filterCurrency')} {filterCurrency}
                    <button
                      onClick={() => setFilterCurrency('all')}
                      className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                    >
                      x
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Wallets grid */}
      {filteredWallets.length === 0 && wallets && wallets.length > 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">{t('wallets.noMatch')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('wallets.noMatchHint')}
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
            <h3 className="font-semibold mb-2">{t('wallets.noWallets')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('wallets.noWalletsHint')}
            </p>
            <CreateWalletDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('wallets.createFirst')}
                </Button>
              }
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
      {filteredWallets.length > 0 && wallets && (
        <div className="text-center text-sm text-muted-foreground">
          {t('wallets.showingCount', { count: filteredWallets.length, total: wallets.length })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.deleteWalletMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              {t('deleteConfirm.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Wallet Dialog */}
      <EditWalletDialog
        wallet={walletToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
