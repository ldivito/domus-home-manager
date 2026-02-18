'use client'

import { useEffect, useState } from 'react'
import { PersonalCategory } from '@/types/personal-finance'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoryList } from './components/CategoryList'
import { CreateCategoryDialog } from './components/CreateCategoryDialog'
import { 
  Plus, 
  Search, 
  Tag,
  TrendingUp,
  TrendingDown,
  RotateCcw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

export default function CategoriesPage() {
  const t = useTranslations('personalFinance')
  const [categories, setCategories] = useState<PersonalCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense')
  const { toast } = useToast()

  // Current user (TODO: Get from auth context)
  const userId = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a'

  const loadCategories = async () => {
    try {
      setLoading(true)
      const fetchedCategories = await db.personalCategories
        .where({ userId, isActive: 1 })
        .toArray()
      
      // Sort by creation date (newest first), but put default categories first
      const sortedCategories = fetchedCategories.sort((a, b) => {
        // Default categories first
        if (a.isDefault && !b.isDefault) return -1
        if (!a.isDefault && b.isDefault) return 1
        
        // Then by creation date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      
      setCategories(sortedCategories)
    } catch (error) {
      console.error('Error loading categories:', error)
      toast({
        title: t('common.error'),
        description: t('categories.errorLoading'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleCategoryCreated = (newCategory: PersonalCategory) => {
    setCategories(prev => [newCategory, ...prev])
  }

  const handleEditCategory = async (categoryId: string, updatedData: Partial<PersonalCategory>) => {
    try {
      await db.personalCategories.update(categoryId, {
        ...updatedData,
        updatedAt: new Date()
      })
      
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, ...updatedData } : cat
      ))
      
      toast({
        title: t('categories.categoryUpdated'),
        description: t('categories.categoryUpdatedDesc'),
      })
    } catch (error) {
      console.error('Error updating category:', error)
      toast({
        title: t('common.error'),
        description: t('categories.errorUpdating'),
        variant: 'destructive',
      })
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    // Check if category is being used in transactions
    const transactionCount = await db.personalTransactions
      .where('categoryId')
      .equals(categoryId)
      .count()

    if (transactionCount > 0) {
      toast({
        title: t('categories.cannotDelete'),
        description: t('categories.cannotDeleteDesc', { count: transactionCount }),
        variant: 'destructive',
      })
      return
    }

    if (!confirm(t('categories.confirmDelete'))) {
      return
    }

    try {
      // Soft delete: mark as inactive
      await db.personalCategories.update(categoryId, { 
        isActive: false, 
        updatedAt: new Date() 
      })
      
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      
      toast({
        title: t('categories.categoryDeleted'),
        description: t('categories.categoryDeletedDesc'),
      })
    } catch (error) {
      console.error('Error deleting category:', error)
      toast({
        title: t('common.error'),
        description: t('categories.errorDeleting'),
        variant: 'destructive',
      })
    }
  }

  const handleRestoreDefaults = async () => {
    if (!confirm(t('categories.confirmRestoreDefaults'))) {
      return
    }

    try {
      // This would typically call a seeder function
      // For now, we'll show a success message
      toast({
        title: t('categories.defaultsRestored'),
        description: t('categories.defaultsRestoredDesc'),
      })
      
      // Reload categories
      await loadCategories()
    } catch (error) {
      console.error('Error restoring defaults:', error)
      toast({
        title: t('common.error'),
        description: t('categories.errorRestoringDefaults'),
        variant: 'destructive',
      })
    }
  }

  // Filter categories
  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = category.type === activeTab
    
    return matchesSearch && matchesType
  })

  // Calculate stats
  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('categories.title')}</h1>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            {t('categories.addCategory')}
          </Button>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('categories.title')}</h1>
            <p className="text-muted-foreground">
              {t('categories.subtitle')}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRestoreDefaults}
              className="hidden sm:flex"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('categories.restoreDefaults')}
            </Button>
            
            <CreateCategoryDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('categories.addCategory')}
                </Button>
              }
              onCategoryCreated={handleCategoryCreated}
            />
          </div>
        </div>

        {/* Stats overview */}
        {categories.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('categories.incomeCategories')}
                  </span>
                </div>
                <div className="text-2xl font-bold mt-1 text-green-600">
                  {incomeCategories.length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('categories.expenseCategories')}
                  </span>
                </div>
                <div className="text-2xl font-bold mt-1 text-red-600">
                  {expenseCategories.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('categories.totalCategories')}
                  </span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {categories.length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('categories.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {searchTerm && (
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary" className="gap-1">
                {t('categories.searchBadge', { term: searchTerm })}
                <button 
                  onClick={() => setSearchTerm('')}
                  className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'income' | 'expense')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expense" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            {t('categories.expenseCategories')} ({expenseCategories.length})
          </TabsTrigger>
          <TabsTrigger value="income" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('categories.incomeCategories')} ({incomeCategories.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expense" className="mt-6">
          {filteredCategories.length === 0 && expenseCategories.length > 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{t('categories.noMatchSearch')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('categories.noMatchSearchDesc')}
                </p>
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  {t('categories.clearSearch')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CategoryList
              categories={filteredCategories}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              emptyMessage={t('categories.noExpenseCategories')}
              emptyDescription={t('categories.noExpenseCategoriesDesc')}
            />
          )}
        </TabsContent>
        
        <TabsContent value="income" className="mt-6">
          {filteredCategories.length === 0 && incomeCategories.length > 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{t('categories.noMatchSearch')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('categories.noMatchSearchDesc')}
                </p>
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  {t('categories.clearSearch')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CategoryList
              categories={filteredCategories}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              emptyMessage={t('categories.noIncomeCategories')}
              emptyDescription={t('categories.noIncomeCategoriesDesc')}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Results count */}
      {filteredCategories.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {searchTerm
            ? t('categories.showingCountSearch', { 
                count: filteredCategories.length, 
                type: activeTab,
                search: searchTerm 
              })
            : t('categories.showingCount', { 
                count: filteredCategories.length, 
                type: activeTab 
              })
          }
        </div>
      )}
    </div>
  )
}
