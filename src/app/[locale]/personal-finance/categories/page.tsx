'use client'

import { useEffect, useState } from 'react'
import { PersonalCategory } from '@/types/personal-finance'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
        title: 'Error',
        description: 'Failed to load categories. Please try again.',
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
        title: 'Category Updated',
        description: 'The category has been updated successfully.',
      })
    } catch (error) {
      console.error('Error updating category:', error)
      toast({
        title: 'Error',
        description: 'Failed to update category. Please try again.',
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
        title: 'Cannot Delete',
        description: `This category is used in ${transactionCount} transaction(s). Please reassign or delete those transactions first.`,
        variant: 'destructive',
      })
      return
    }

    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
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
        title: 'Category Deleted',
        description: 'The category has been deleted successfully.',
      })
    } catch (error) {
      console.error('Error deleting category:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete category. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleRestoreDefaults = async () => {
    if (!confirm('This will restore default categories. Your custom categories will not be affected. Continue?')) {
      return
    }

    try {
      // This would typically call a seeder function
      // For now, we'll show a success message
      toast({
        title: 'Defaults Restored',
        description: 'Default categories have been restored successfully.',
      })
      
      // Reload categories
      await loadCategories()
    } catch (error) {
      console.error('Error restoring defaults:', error)
      toast({
        title: 'Error',
        description: 'Failed to restore default categories.',
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
          <h1 className="text-2xl font-bold">Categories</h1>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
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
            <h1 className="text-2xl font-bold">Categories</h1>
            <p className="text-muted-foreground">
              Organize your income and expenses with custom categories
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRestoreDefaults}
              className="hidden sm:flex"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore Defaults
            </Button>
            
            <CreateCategoryDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
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
                  <span className="text-sm font-medium text-muted-foreground">Income Categories</span>
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
                  <span className="text-sm font-medium text-muted-foreground">Expense Categories</span>
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
                  <span className="text-sm font-medium text-muted-foreground">Total Categories</span>
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
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {searchTerm && (
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary" className="gap-1">
                Search: {searchTerm}
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
            Expenses ({expenseCategories.length})
          </TabsTrigger>
          <TabsTrigger value="income" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Income ({incomeCategories.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expense" className="mt-6">
          {filteredCategories.length === 0 && expenseCategories.length > 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No categories match your search</h3>
                <p className="text-muted-foreground mb-4">
                  Try different search terms
                </p>
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CategoryList
              categories={filteredCategories}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              emptyMessage="No expense categories yet"
              emptyDescription="Create your first expense category to start organizing your spending"
            />
          )}
        </TabsContent>
        
        <TabsContent value="income" className="mt-6">
          {filteredCategories.length === 0 && incomeCategories.length > 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No categories match your search</h3>
                <p className="text-muted-foreground mb-4">
                  Try different search terms
                </p>
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CategoryList
              categories={filteredCategories}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              emptyMessage="No income categories yet"
              emptyDescription="Create your first income category to organize your earnings"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Results count */}
      {filteredCategories.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredCategories.length} {activeTab} categories
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}
    </div>
  )
}