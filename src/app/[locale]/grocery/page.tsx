'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Plus, Settings2, List, Grid3X3, Trash2, Archive, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, GroceryItem, SavedGroceryItem } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddItemDialog } from './components/AddItemDialog'
import { ManageCategoriesDialog } from './components/ManageCategoriesDialog'
import { ManageSavedItemsDialog } from './components/ManageSavedItemsDialog'

type ViewMode = 'list' | 'categories'
type ViewType = 'current' | 'saved'
type SortBy = 'importance' | 'category' | 'created' | 'name'

export default function GroceryPage() {
  const t = useTranslations('grocery')
  const tCat = useTranslations('grocery.defaultCategories')
  const tSaved = useTranslations('grocery.savedItems')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [viewType, setViewType] = useState<ViewType>('current')
  const [sortBy, setSortBy] = useState<SortBy>('importance')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false)
  const [showSavedItemsDialog, setShowSavedItemsDialog] = useState(false)

  const groceryItems = useLiveQuery(
    () => db.groceryItems.orderBy('createdAt').reverse().toArray(),
    []
  ) || []

  const savedGroceryItems = useLiveQuery(
    () => db.savedGroceryItems.orderBy('lastUsed').reverse().toArray(),
    []
  ) || []

  const groceryCategories = useLiveQuery(
    () => db.groceryCategories.orderBy('name').toArray(),
    []
  ) || []

  const handleBought = async (itemId: number) => {
    await db.groceryItems.delete(itemId)
  }

  const handleAddSavedItem = async (savedItem: SavedGroceryItem) => {
    try {
      // Always add to current grocery list (allow duplicates)
      await db.groceryItems.add({
        name: savedItem.name,
        category: savedItem.category,
        amount: savedItem.amount || '',
        importance: savedItem.importance || 'medium',
        createdAt: new Date()
      })

      // Update usage count in saved items
      await db.savedGroceryItems.update(savedItem.id!, {
        timesUsed: savedItem.timesUsed + 1,
        lastUsed: new Date()
      })
    } catch (error) {
      console.error('Error adding saved item:', error)
    }
  }

  const getSortedItems = () => {
    const items = viewType === 'current' ? groceryItems : savedGroceryItems
    const sorted = [...items]
    switch (sortBy) {
      case 'importance':
        return sorted.sort((a, b) => {
          const importanceOrder = { high: 3, medium: 2, low: 1 }
          const aImportance = a.importance || 'medium'
          const bImportance = b.importance || 'medium'
          return importanceOrder[bImportance as keyof typeof importanceOrder] - importanceOrder[aImportance as keyof typeof importanceOrder]
        })
      case 'category':
        return sorted.sort((a, b) => a.category.localeCompare(b.category))
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'created':
      default:
        if (viewType === 'saved') {
          return sorted.sort((a, b) => {
            const aDate = (a as SavedGroceryItem).lastUsed || (a as SavedGroceryItem).createdAt
            const bDate = (b as SavedGroceryItem).lastUsed || (b as SavedGroceryItem).createdAt
            return new Date(bDate).getTime() - new Date(aDate).getTime()
          })
        }
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  }

  const getImportanceBadge = (importance: string) => {
    const variants = {
      high: { variant: 'destructive' as const, text: t('importance.high') },
      medium: { variant: 'default' as const, text: t('importance.medium') },
      low: { variant: 'secondary' as const, text: t('importance.low') }
    }
    return variants[importance as keyof typeof variants] || variants.medium
  }

  const translateCategoryName = (categoryName: string) => {
    // Check if it's a default category that needs translation
    if (categoryName.startsWith('defaultCategories.')) {
      const key = categoryName.replace('defaultCategories.', '')
      const categoryMap: Record<string, string> = {
        'produce': tCat('produce'),
        'dairy': tCat('dairy'),
        'meatFish': tCat('meatFish'),
        'bakery': tCat('bakery'),
        'pantry': tCat('pantry'),
        'frozen': tCat('frozen'),
        'beverages': tCat('beverages'),
        'snacks': tCat('snacks'),
        'healthBeauty': tCat('healthBeauty'),
        'household': tCat('household')
      }
      
      return categoryMap[key] || categoryName
    }
    
    // For user-created categories, return as-is
    return categoryName
  }

  const getCategoryColor = (categoryName: string) => {
    const category = groceryCategories.find(cat => cat.name === categoryName)
    return category?.color || '#6b7280'
  }

  const getItemsByCategory = () => {
    const itemsByCategory: Record<string, (GroceryItem | SavedGroceryItem)[]> = {}
    getSortedItems().forEach(item => {
      if (!itemsByCategory[item.category]) {
        itemsByCategory[item.category] = []
      }
      itemsByCategory[item.category].push(item)
    })
    return itemsByCategory
  }

  const renderListView = () => {
    const sortedItems = getSortedItems()
    
    return (
      <div className="space-y-3">
        {sortedItems.map((item) => {
          const badge = getImportanceBadge(item.importance || 'medium')
          const isSavedItem = viewType === 'saved'
          const savedItem = item as SavedGroceryItem
          
          return (
            <div
              key={item.id}
              className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{item.name}</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                    {isSavedItem && (
                      <Badge variant="outline" className="text-xs">
                        {tSaved('usedTimes', { count: savedItem.timesUsed })}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <span 
                    className="px-2 py-1 rounded text-white font-medium"
                    style={{ backgroundColor: getCategoryColor(item.category) }}
                  >
                    {translateCategoryName(item.category)}
                  </span>
                  <span>{item.amount}</span>
                  <span>
                    {isSavedItem 
                      ? tSaved('lastUsed', { date: savedItem.lastUsed ? new Date(savedItem.lastUsed).toLocaleDateString() : tSaved('never') })
                      : new Date(item.createdAt).toLocaleDateString()
                    }
                  </span>
                </div>
              </div>
              <Button
                onClick={() => isSavedItem ? handleAddSavedItem(savedItem) : handleBought(item.id!)}
                variant="outline"
                size="lg"
                className={`ml-4 h-12 px-6 ${
                  isSavedItem 
                    ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                    : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
                }`}
              >
                {isSavedItem ? (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    {tSaved('addToList')}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-5 w-5 mr-2" />
                    {t('bought')}
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </div>
    )
  }

  const renderCategoryView = () => {
    const itemsByCategory = getItemsByCategory()
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groceryCategories
          .filter(category => itemsByCategory[category.name]?.length > 0)
          .map((category) => (
            <Card key={category.id} className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle 
                  className="text-lg flex items-center text-white px-3 py-2 rounded"
                  style={{ backgroundColor: category.color }}
                >
                  {translateCategoryName(category.name)}
                  <Badge variant="secondary" className="ml-auto bg-white/20 text-white">
                    {itemsByCategory[category.name]?.length || 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {itemsByCategory[category.name]?.map((item) => {
                  const badge = getImportanceBadge(item.importance || 'medium')
                  const isSavedItem = viewType === 'saved'
                  const savedItem = item as SavedGroceryItem
                  
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.name}</h4>
                        <div className="flex items-center space-x-1">
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                          {isSavedItem && (
                            <Badge variant="outline" className="text-xs">
                              {savedItem.timesUsed}x
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{item.amount}</span>
                        <Button
                          onClick={() => isSavedItem ? handleAddSavedItem(savedItem) : handleBought(item.id!)}
                          size="sm"
                          variant="outline"
                          className={isSavedItem 
                            ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                            : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
                          }
                        >
                          {isSavedItem ? (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              {tSaved('addToList')}
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('bought')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('title')}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex space-x-4">
            {viewType === 'saved' && (
              <Button 
                onClick={() => setViewType('current')}
                variant="outline" 
                size="lg" 
                className="h-14 px-6 text-lg"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                {tSaved('backToList')}
              </Button>
            )}
            
            <Button 
              onClick={() => setViewType(viewType === 'current' ? 'saved' : 'current')}
              variant="outline" 
              size="lg" 
              className="h-14 px-6 text-lg"
            >
              <Archive className="mr-2 h-5 w-5" />
              {viewType === 'current' ? tSaved('savedItemsButton') : tSaved('currentListButton')}
            </Button>

            {viewType === 'saved' && (
              <Button 
                onClick={() => setShowSavedItemsDialog(true)}
                variant="outline" 
                size="lg" 
                className="h-14 px-6 text-lg"
              >
                <Settings2 className="mr-2 h-5 w-5" />
                {tSaved('manageSaved')}
              </Button>
            )}
            
            <Button 
              onClick={() => setShowCategoriesDialog(true)}
              variant="outline" 
              size="lg" 
              className="h-14 px-6 text-lg"
            >
              <Settings2 className="mr-2 h-5 w-5" />
              {t('categories')}
            </Button>
            
            {viewType === 'current' && (
              <Button 
                onClick={() => setShowAddDialog(true)}
                size="lg" 
                className="h-14 px-8 text-lg"
              >
                <Plus className="mr-2 h-6 w-6" />
                {t('addItem')}
              </Button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('view')}:</label>
              <div className="flex border border-gray-200 rounded-lg p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4 mr-1" />
                  {t('viewModes.list')}
                </Button>
                <Button
                  variant={viewMode === 'categories' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('categories')}
                  className="h-8 px-3"
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  {t('viewModes.categories')}
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('sortBy')}:</label>
              <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="importance">{t('sortOptions.importance')}</SelectItem>
                  <SelectItem value="category">{t('sortOptions.category')}</SelectItem>
                  <SelectItem value="name">{t('sortOptions.name')}</SelectItem>
                  <SelectItem value="created">{t('sortOptions.created')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('itemsTotal', { count: viewType === 'current' ? groceryItems.length : savedGroceryItems.length })}
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              {viewType === 'saved' ? (
                <Archive className="mr-3 h-8 w-8" />
              ) : (
                <ShoppingCart className="mr-3 h-8 w-8" />
              )}
              {viewType === 'saved' 
                ? `${tSaved('title')} - ${viewMode === 'list' ? t('viewModes.list') : t('viewModes.categories')}`
                : (viewMode === 'list' ? t('listView') : t('categoryView'))
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(viewType === 'current' ? groceryItems.length : savedGroceryItems.length) === 0 ? (
              <div className="text-center py-12">
                {viewType === 'saved' ? (
                  <Archive className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                ) : (
                  <ShoppingCart className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                )}
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {viewType === 'saved' ? tSaved('noSavedItems') : t('noItems')}
                </h3>
                <p className="text-gray-500 mb-4">
                  {viewType === 'saved' 
                    ? tSaved('noSavedItemsDescription')
                    : t('noItemsDescription')
                  }
                </p>
                {viewType === 'current' && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addFirstItem')}
                  </Button>
                )}
              </div>
            ) : viewMode === 'list' ? (
              renderListView()
            ) : (
              renderCategoryView()
            )}
          </CardContent>
        </Card>

        <AddItemDialog 
          open={showAddDialog} 
          onOpenChange={setShowAddDialog}
          categories={groceryCategories}
        />
        
        <ManageCategoriesDialog
          open={showCategoriesDialog}
          onOpenChange={setShowCategoriesDialog}
          categories={groceryCategories}
        />
        
        <ManageSavedItemsDialog
          open={showSavedItemsDialog}
          onOpenChange={setShowSavedItemsDialog}
          categories={groceryCategories}
        />
      </div>
    </div>
  )
}