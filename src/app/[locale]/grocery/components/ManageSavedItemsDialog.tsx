'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, Edit3, X } from "lucide-react"
import { db, SavedGroceryItem, GroceryCategory } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

interface ManageSavedItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: GroceryCategory[]
}

export function ManageSavedItemsDialog({ open, onOpenChange, categories }: ManageSavedItemsDialogProps) {
  const t = useTranslations('grocery.savedItems')
  const tCat = useTranslations('grocery.defaultCategories')
  const [editingItem, setEditingItem] = useState<SavedGroceryItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editImportance, setEditImportance] = useState<'low' | 'medium' | 'high'>('medium')

  const savedItems = useLiveQuery(
    () => db.savedGroceryItems.orderBy('lastUsed').reverse().toArray(),
    []
  ) || []

  const translateCategoryName = (categoryName: string) => {
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
    return categoryName
  }

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName)
    return category?.color || '#6b7280'
  }

  const getImportanceBadge = (importance: string) => {
    const variants = {
      high: { variant: 'destructive' as const, text: t('importance.high') },
      medium: { variant: 'default' as const, text: t('importance.medium') },
      low: { variant: 'secondary' as const, text: t('importance.low') }
    }
    return variants[importance as keyof typeof variants] || variants.medium
  }

  const handleEdit = (item: SavedGroceryItem) => {
    setEditingItem(item)
    setEditName(item.name)
    setEditAmount(item.amount || '')
    setEditCategory(item.category)
    setEditImportance(item.importance || 'medium')
  }

  const handleSaveEdit = async () => {
    if (!editingItem || !editName.trim()) return

    try {
      await db.savedGroceryItems.update(editingItem.id!, {
        name: editName.trim(),
        amount: editAmount.trim(),
        category: editCategory,
        importance: editImportance
      })
      setEditingItem(null)
    } catch (error) {
      console.error('Error updating saved item:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingItem(null)
    setEditName('')
    setEditAmount('')
    setEditCategory('')
    setEditImportance('medium')
  }

  const handleDelete = async (itemId: number) => {
    try {
      await db.savedGroceryItems.delete(itemId)
    } catch (error) {
      console.error('Error deleting saved item:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[90vh] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('manage')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {savedItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('noSavedItems')}</p>
            </div>
          ) : (
            savedItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  {editingItem?.id === item.id ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-name">{t('form.name')}</Label>
                          <Input
                            id="edit-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t('form.namePlaceholder')}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-amount">{t('form.amount')}</Label>
                          <Input
                            id="edit-amount"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            placeholder={t('form.amountPlaceholder')}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-category">{t('form.category')}</Label>
                          <Select value={editCategory} onValueChange={setEditCategory}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('form.selectCategory')} />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.name}>
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: category.color }}
                                    />
                                    <span>{translateCategoryName(category.name)}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="edit-importance">{t('form.importance')}</Label>
                          <Select value={editImportance} onValueChange={(value: 'low' | 'medium' | 'high') => setEditImportance(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">{t('importance.low')}</SelectItem>
                              <SelectItem value="medium">{t('importance.medium')}</SelectItem>
                              <SelectItem value="high">{t('importance.high')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={handleCancelEdit}>
                          <X className="h-4 w-4 mr-2" />
                          {t('form.cancel')}
                        </Button>
                        <Button onClick={handleSaveEdit}>
                          {t('form.save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                          <div className="flex items-center space-x-2">
                            {(() => {
                              const badge = getImportanceBadge(item.importance || 'medium')
                              return <Badge variant={badge.variant}>{badge.text}</Badge>
                            })()}
                            <Badge variant="outline" className="text-xs">
                              {t('usedTimes', { count: item.timesUsed })}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span 
                            className="px-2 py-1 rounded text-white font-medium"
                            style={{ backgroundColor: getCategoryColor(item.category) }}
                          >
                            {translateCategoryName(item.category)}
                          </span>
                          <span>{item.amount}</span>
                          <span>
                            {t('lastUsed', { 
                              date: item.lastUsed 
                                ? new Date(item.lastUsed).toLocaleDateString() 
                                : t('never') 
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          {t('edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item.id!)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('delete')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}