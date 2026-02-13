'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PersonalCategory } from '@/types/personal-finance'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export default function CategoriesPage() {
  const t = useTranslations('personalFinance')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const { toast } = useToast()

  // Current user (TODO: Get from auth context)
  const userId = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a'

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reactive data loading via useLiveQuery
  const categories = useLiveQuery(
    () => db.personalCategories
      .where({ userId, isActive: 1 })
      .toArray()
      .then(cats => cats.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1
        if (!a.isDefault && b.isDefault) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })),
    [userId]
  )

  const loading = categories === undefined

  const handleEditCategory = async (categoryId: string, updatedData: Partial<PersonalCategory>) => {
    try {
      await db.personalCategories.update(categoryId, {
        ...updatedData,
        updatedAt: new Date()
      })

      toast({
        title: t('categories.updatedTitle'),
        description: t('categories.updatedMessage'),
      })
    } catch (error) {
      console.error('Error updating category:', error)
      toast({
        title: t('common.error'),
        description: t('categoryForm.errorMessage', { action: 'update' }),
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
        title: t('categories.cannotDeleteTitle'),
        description: t('categories.cannotDeleteMessage', { count: transactionCount }),
        variant: 'destructive',
      })
      return
    }

    setCategoryToDelete(categoryId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!categoryToDelete) return

    try {
      await db.personalCategories.update(categoryToDelete, {
        isActive: false,
        updatedAt: new Date()
      })

      toast({
        title: t('categories.deletedTitle'),
        description: t('categories.deletedMessage'),
      })
    } catch (error) {
      console.error('Error deleting category:', error)
      toast({
        title: t('common.error'),
        description: t('categoryForm.errorMessage', { action: 'delete' }),
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    }
  }

  const handleRestoreDefaults = async () => {
    setRestoreDialogOpen(false)
    try {
      toast({
        title: t('categories.defaultsRestoredTitle'),
        description: t('categories.defaultsRestoredMessage'),
      })
    } catch (error) {
      console.error('Error restoring defaults:', error)
      toast({
        title: t('common.error'),
        description: t('categoryForm.errorMessage', { action: 'restore' }),
        variant: 'destructive',
      })
    }
  }

  // Filter categories
  const filteredCategories = useMemo(() => {
    if (!categories) return []
    return categories.filter(category => {
      const matchesSearch = category.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      const matchesType = category.type === activeTab
      return matchesSearch && matchesType
    })
  }, [categories, debouncedSearch, activeTab])

  // Calculate stats
  const incomeCategories = useMemo(() =>
    categories?.filter(c => c.type === 'income') ?? [],
    [categories]
  )
  const expenseCategories = useMemo(() =>
    categories?.filter(c => c.type === 'expense') ?? [],
    [categories]
  )

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
            <div key={i} className="h-16 bg-muted rounded"></div>
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
              onClick={() => setRestoreDialogOpen(true)}
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
            />
          </div>
        </div>

        {/* Stats overview */}
        {categories && categories.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-muted-foreground">{t('categories.incomeCategories')}</span>
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
                  <span className="text-sm font-medium text-muted-foreground">{t('categories.expenseCategories')}</span>
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
                  <span className="text-sm font-medium text-muted-foreground">{t('categories.totalCategories')}</span>
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
                {t('categories.filterSearch')} {searchTerm}
                <button
                  onClick={() => setSearchTerm('')}
                  className="ml-1 hover:bg-gray-500 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                >
                  x
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
            {t('categories.expensesCount', { count: expenseCategories.length })}
          </TabsTrigger>
          <TabsTrigger value="income" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('categories.incomeCount', { count: incomeCategories.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="mt-6">
          {filteredCategories.length === 0 && expenseCategories.length > 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{t('categories.noMatch')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('categories.noMatchHint')}
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
              emptyDescription={t('categories.noExpenseCategoriesHint')}
            />
          )}
        </TabsContent>

        <TabsContent value="income" className="mt-6">
          {filteredCategories.length === 0 && incomeCategories.length > 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{t('categories.noMatch')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('categories.noMatchHint')}
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
              emptyDescription={t('categories.noIncomeCategoriesHint')}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Results count */}
      {filteredCategories.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {t('categories.showingCount', { count: filteredCategories.length, type: activeTab })}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.deleteCategoryMessage')} {t('deleteConfirm.cannotBeUndone')}
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

      {/* Restore Defaults Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('categories.restoreDefaults')}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore default categories. Your custom categories will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDefaults}>
              {t('categories.restoreDefaults')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
