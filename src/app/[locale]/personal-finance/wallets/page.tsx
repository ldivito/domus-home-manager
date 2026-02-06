'use client'

import { useEffect, useState } from 'react'
import { PersonalWallet } from '@/types/personal-finance'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Wallet,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatBalance, calculateTotalBalance } from '@/lib/utils/finance'

export default function WalletsPage() {
  const [wallets, setWallets] = useState<PersonalWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCurrency, setFilterCurrency] = useState<string>('all')
  const { toast } = useToast()

  // Current user (TODO: Get from auth context)
  const userId = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a'

  const loadWallets = async () => {
    try {
      setLoading(true)
      const fetchedWallets = await db.personalWallets
        .where({ userId, isActive: 1 })
        .toArray()
      
      // Sort by creation date (newest first)
      const sortedWallets = fetchedWallets.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      setWallets(sortedWallets)
    } catch (error) {
      console.error('Error loading wallets:', error)
      toast({
        title: 'Error',
        description: 'Failed to load wallets. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWallets()
  }, [])

  const handleWalletCreated = (newWallet: PersonalWallet) => {
    setWallets(prev => [newWallet, ...prev])
  }

  const handleEditWallet = (wallet: PersonalWallet) => {
    // TODO: Implement edit functionality
    toast({
      title: 'Edit Wallet',
      description: 'Edit functionality coming soon!',
    })
  }

  const handleDeleteWallet = async (walletId: string) => {
    if (!confirm('Are you sure you want to delete this wallet? This action cannot be undone.')) {
      return
    }

    try {
      // Soft delete: mark as inactive instead of removing
      await db.personalWallets.update(walletId, { 
        isActive: false, 
        updatedAt: new Date() 
      })
      
      setWallets(prev => prev.filter(w => w.id !== walletId))
      
      toast({
        title: 'Wallet Deleted',
        description: 'The wallet has been deleted successfully.',
      })
    } catch (error) {
      console.error('Error deleting wallet:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete wallet. Please try again.',
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
          <h1 className="text-2xl font-bold">Your Wallets</h1>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Wallet
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
            <h1 className="text-2xl font-bold">Your Wallets</h1>
            <p className="text-muted-foreground">
              Manage your accounts and track your finances
            </p>
          </div>
          
          <CreateWalletDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Wallet
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
                  <span className="text-sm font-medium text-muted-foreground">Total ARS</span>
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
                  <span className="text-sm font-medium text-muted-foreground">Total USD</span>
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
                  <span className="text-sm font-medium text-muted-foreground">Active Wallets</span>
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
                  placeholder="Search wallets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Currency</SelectItem>
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
                    Search: {searchTerm}
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
                    Type: {filterType.replace('_', ' ')}
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
                    Currency: {filterCurrency}
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
            <h3 className="font-semibold mb-2">No wallets match your filters</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search terms or filters
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('')
                setFilterType('all')
                setFilterCurrency('all')
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : filteredWallets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No wallets yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first wallet to start tracking your finances
            </p>
            <CreateWalletDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Wallet
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
          Showing {filteredWallets.length} of {wallets.length} wallets
        </div>
      )}
    </div>
  )
}