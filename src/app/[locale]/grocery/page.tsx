'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Plus, Settings2, List, Grid3X3, Trash2, Archive, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, GroceryItem, SavedGroceryItem, deleteWithSync } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddItemDialog } from './components/AddItemDialog'
import { ManageCategoriesDialog } from './components/ManageCategoriesDialog'
import { ManageSavedItemsDialog } from './components/ManageSavedItemsDialog'
import { logger } from '@/lib/logger'

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

  const handleBought = async (itemId: string) => {
    await deleteWithSync(db.groceryItems, 'groceryItems', itemId)
  }

  const handleAddSavedItem = async (savedItem: SavedGroceryItem) => {
    try {
      // Always add to current grocery list (allow duplicates)
    await db.groceryItems.add({
      id: generateId('gri'),
        name: savedItem.name,
        category: savedItem.category,
        amount: savedItem.amount || '',
        importance: savedItem.importance || 'medium',
        createdAt: new Date()
      })

      // Update usage count in saved items
      await db.savedGroceryItems.update(savedItem.id!, {
        timesUsed: savedItem.timesUsed + 1,
        lastUsed: new Date(),
        updatedAt: new Date()
      })
    } catch (error) {
      logger.error('Error adding saved item:', error)
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
      <div className="space-y-2 sm:space-y-3">
        {sortedItems.map((item) => {
          const badge = getImportanceBadge(item.importance || 'medium')
          const isSavedItem = viewType === 'saved'
          const savedItem = item as SavedGroceryItem

          return (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center p-3 sm:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all gap-3 sm:gap-0"
            >
              <div className="flex-1 min-w-0">
                {/* Header row with name and badges */}
                <div className="flex items-start sm:items-center justify-between gap-2">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <Badge variant={badge.variant} className="text-xs sm:text-sm">{badge.text}</Badge>
                    {isSavedItem && (
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                        {tSaved('usedTimes', { count: savedItem.timesUsed })}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap items-center mt-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  <span
                    className="px-2 py-0.5 sm:py-1 rounded text-white font-medium text-xs sm:text-sm"
                    style={{ backgroundColor: getCategoryColor(item.category) }}
                  >
                    {translateCategoryName(item.category)}
                  </span>
                  {item.amount && <span className="truncate max-w-[100px] sm:max-w-none">{item.amount}</span>}
                  <span className="hidden sm:inline">
                    {isSavedItem
                      ? tSaved('lastUsed', { date: savedItem.lastUsed ? new Date(savedItem.lastUsed).toLocaleDateString() : tSaved('never') })
                      : new Date(item.createdAt).toLocaleDateString()
                    }
                  </span>
                  {isSavedItem && (
                    <span className="sm:hidden text-xs">
                      {savedItem.timesUsed}x {tSaved('used')}
                    </span>
                  )}
                </div>
              </div>

              {/* Action button - full width on mobile */}
              <Button
                onClick={() => isSavedItem ? handleAddSavedItem(savedItem) : handleBought(item.id!)}
                variant="outline"
                size="default"
                className={`w-full sm:w-auto sm:ml-4 h-10 sm:h-12 px-4 sm:px-6 ${
                  isSavedItem
                    ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:border-blue-800 dark:text-blue-300'
                    : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-800 dark:text-green-300'
                }`}
              >
                {isSavedItem ? (
                  <>
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    {tSaved('addToList')}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {groceryCategories
          .filter(category => itemsByCategory[category.name]?.length > 0)
          .map((category) => (
            <Card key={category.id} className="h-fit">
              <CardHeader className="p-3 sm:pb-3 sm:p-6">
                <CardTitle
                  className="text-base sm:text-lg flex items-center text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded"
                  style={{ backgroundColor: category.color }}
                >
                  <span className="truncate">{translateCategoryName(category.name)}</span>
                  <Badge variant="secondary" className="ml-auto bg-white/20 text-white text-xs sm:text-sm flex-shrink-0">
                    {itemsByCategory[category.name]?.length || 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 p-3 pt-0 sm:p-6 sm:pt-0">
                {itemsByCategory[category.name]?.map((item) => {
                  const badge = getImportanceBadge(item.importance || 'medium')
                  const isSavedItem = viewType === 'saved'
                  const savedItem = item as SavedGroceryItem

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600"
                    >
                      <div className="flex items-start sm:items-center justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">{item.name}</h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant={badge.variant} className="text-xs">{badge.text}</Badge>
                          {isSavedItem && (
                            <Badge variant="outline" className="text-xs">
                              {savedItem.timesUsed}x
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{item.amount || '\u00A0'}</span>
                        <Button
                          onClick={() => isSavedItem ? handleAddSavedItem(savedItem) : handleBought(item.id!)}
                          size="sm"
                          variant="outline"
                          className={`w-full sm:w-auto h-9 ${isSavedItem
                            ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:border-blue-800 dark:text-blue-300'
                            : 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-800 dark:text-green-300'
                          }`}
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header - stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
              {t('title')}
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>

          {/* Action buttons - grid on mobile, flex on larger screens */}
          <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 lg:gap-4">
            {viewType === 'saved' && (
              <Button
                onClick={() => setViewType('current')}
                variant="outline"
                size="default"
                className="h-11 sm:h-12 lg:h-14 px-3 sm:px-4 lg:px-6 text-sm sm:text-base lg:text-lg"
              >
                <ArrowLeft className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{tSaved('backToList')}</span>
                <span className="sm:hidden">{t('back')}</span>
              </Button>
            )}

            <Button
              onClick={() => setViewType(viewType === 'current' ? 'saved' : 'current')}
              variant="outline"
              size="default"
              className="h-11 sm:h-12 lg:h-14 px-3 sm:px-4 lg:px-6 text-sm sm:text-base lg:text-lg"
            >
              <Archive className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{viewType === 'current' ? tSaved('savedItemsButton') : tSaved('currentListButton')}</span>
              <span className="sm:hidden">{viewType === 'current' ? tSaved('saved') : tSaved('current')}</span>
            </Button>

            {viewType === 'saved' && (
              <Button
                onClick={() => setShowSavedItemsDialog(true)}
                variant="outline"
                size="default"
                className="h-11 sm:h-12 lg:h-14 px-3 sm:px-4 lg:px-6 text-sm sm:text-base lg:text-lg"
              >
                <Settings2 className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{tSaved('manageSaved')}</span>
                <span className="sm:hidden">{t('manage')}</span>
              </Button>
            )}

            <Button
              onClick={() => setShowCategoriesDialog(true)}
              variant="outline"
              size="default"
              className="h-11 sm:h-12 lg:h-14 px-3 sm:px-4 lg:px-6 text-sm sm:text-base lg:text-lg"
            >
              <Settings2 className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('categories')}</span>
              <span className="sm:hidden">{t('categoriesShort')}</span>
            </Button>

            {viewType === 'current' && (
              <Button
                onClick={() => setShowAddDialog(true)}
                size="default"
                className="h-11 sm:h-12 lg:h-14 px-4 sm:px-6 lg:px-8 text-sm sm:text-base lg:text-lg col-span-2 sm:col-span-1"
              >
                <Plus className="mr-1.5 sm:mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                {t('addItem')}
              </Button>
            )}
          </div>
        </div>

        {/* Controls - responsive layout */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* View mode toggle */}
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('view')}:</label>
              <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-2 sm:px-3"
                >
                  <List className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('viewModes.list')}</span>
                </Button>
                <Button
                  variant={viewMode === 'categories' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('categories')}
                  className="h-8 px-2 sm:px-3"
                >
                  <Grid3X3 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('viewModes.categories')}</span>
                </Button>
              </div>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('sortBy')}:</label>
              <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                <SelectTrigger className="w-36 sm:w-48">
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

          {/* Item count */}
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-right">
            {t('itemsTotal', { count: viewType === 'current' ? groceryItems.length : savedGroceryItems.length })}
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center text-lg sm:text-xl lg:text-2xl">
              {viewType === 'saved' ? (
                <Archive className="mr-2 sm:mr-3 h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 flex-shrink-0" />
              ) : (
                <ShoppingCart className="mr-2 sm:mr-3 h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 flex-shrink-0" />
              )}
              <span className="truncate">
                {viewType === 'saved'
                  ? `${tSaved('title')} - ${viewMode === 'list' ? t('viewModes.list') : t('viewModes.categories')}`
                  : (viewMode === 'list' ? t('listView') : t('categoryView'))
                }
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {(viewType === 'current' ? groceryItems.length : savedGroceryItems.length) === 0 ? (
              <div className="text-center py-8 sm:py-12">
                {viewType === 'saved' ? (
                  <Archive className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-400 mb-3 sm:mb-4" />
                ) : (
                  <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-400 mb-3 sm:mb-4" />
                )}
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {viewType === 'saved' ? tSaved('noSavedItems') : t('noItems')}
                </h3>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4 px-4">
                  {viewType === 'saved'
                    ? tSaved('noSavedItemsDescription')
                    : t('noItemsDescription')
                  }
                </p>
                {viewType === 'current' && (
                  <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
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