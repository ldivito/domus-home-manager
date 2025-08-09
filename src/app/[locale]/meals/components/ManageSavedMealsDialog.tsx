'use client'

import React, { useState } from 'react'
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, Plus, Edit3, X, Search } from "lucide-react"
import { db, SavedMeal, MealCategory } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

interface TemplateData {
  name: string
  description?: string
  category: string
  ingredients: string[]
}

interface ManageSavedMealsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: MealCategory[]
  onAddMealWithTemplate?: (template: TemplateData) => void
}

export function ManageSavedMealsDialog({ open, onOpenChange, categories, onAddMealWithTemplate }: ManageSavedMealsDialogProps) {
  const t = useTranslations('meals.savedMeals')
  const tCat = useTranslations('meals.defaultCategories')
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const savedMeals = useLiveQuery(
    () => db.savedMeals.toArray(),
    []
  ) || []

  const savedGroceryItems = useLiveQuery(
    () => db.savedGroceryItems.toArray(),
    []
  ) || []

  const translateCategoryName = (categoryName: string) => {
    if (categoryName.startsWith('defaultMealCategories.')) {
      const key = categoryName.replace('defaultMealCategories.', '')
      const categoryMap: Record<string, string> = {
        'meat': tCat('meat'),
        'vegetarian': tCat('vegetarian'),
        'seafood': tCat('seafood'),
        'pasta': tCat('pasta'),
        'salad': tCat('salad'),
        'soup': tCat('soup'),
        'dessert': tCat('dessert'),
        'healthy': tCat('healthy'),
        'comfort': tCat('comfort'),
        'international': tCat('international')
      }
      return categoryMap[key] || categoryName
    }
    return categoryName
  }

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName)
    return category?.color || '#6b7280'
  }

  const handleDelete = async (mealId: number) => {
    try {
      await db.savedMeals.delete(mealId)
    } catch (error) {
      console.error('Error deleting saved meal:', error)
    }
  }

  const handleEdit = (meal: SavedMeal) => {
    setEditingMeal(meal)
    setEditName(meal.name)
    setEditDescription(meal.description || '')
    setEditCategory(meal.category)
  }

  const handleSaveEdit = async () => {
    if (!editingMeal || !editName.trim()) return

    try {
      await db.savedMeals.update(editingMeal.id!, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory
      })
      setEditingMeal(null)
    } catch (error) {
      console.error('Error updating saved meal:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingMeal(null)
    setEditName('')
    setEditDescription('')
    setEditCategory('')
  }

  const handleAddMealFromTemplate = (meal: SavedMeal) => {
    // Update usage stats
    db.savedMeals.update(meal.id!, {
      timesUsed: meal.timesUsed + 1,
      lastUsed: new Date()
    })

    // Convert to template format
    const template: TemplateData = {
      name: meal.name,
      description: meal.description,
      category: meal.category,
      ingredients: savedGroceryItems.filter(item => (meal.ingredientIds || []).includes(item.id!)).map(item => item.name)
    }

    onAddMealWithTemplate?.(template)
  }

  const getMealIngredients = (meal: SavedMeal) => {
    return (meal.ingredientIds || [])
      .map(id => savedGroceryItems.find(item => item.id === id))
      .filter(Boolean) as NonNullable<typeof savedGroceryItems[0]>[]
  }

  const filteredMeals = savedMeals.filter(meal => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    const name = meal.name.toLowerCase()
    const description = (meal.description || '').toLowerCase()
    const ingredients = getMealIngredients(meal).map(ing => ing.name.toLowerCase()).join(' ')
    
    return name.includes(query) || description.includes(query) || ingredients.includes(query)
  })


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[90vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('manage')}</DialogTitle>
        </DialogHeader>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="pl-10"
          />
        </div>
        
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {savedMeals.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              <p>{t('noSavedMeals')}</p>
            </div>
          ) : filteredMeals.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              <p>{t('noSearchResults')}</p>
            </div>
          ) : (
            filteredMeals.map((meal) => {
              const ingredients = getMealIngredients(meal)
              
              return (
                <Card key={meal.id} className="h-fit">
                  <CardContent className="p-4">
                    {editingMeal?.id === meal.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="edit-name">{t('form.name')}</Label>
                          <Input
                            id="edit-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t('form.namePlaceholder')}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-description">{t('form.description')}</Label>
                          <Textarea
                            id="edit-description"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder={t('form.descriptionPlaceholder')}
                            rows={3}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-category">{t('form.category')}</Label>
                          <Select value={editCategory} onValueChange={setEditCategory}>
                            <SelectTrigger className="mt-1">
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
                        <div className="flex justify-end space-x-2 pt-2">
                          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                            <X className="h-4 w-4 mr-1" />
                            {t('form.cancel')}
                          </Button>
                          <Button size="sm" onClick={handleSaveEdit}>
                            {t('form.save')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{meal.name}</h3>
                            <span 
                              className="px-2 py-1 rounded text-white text-xs font-medium ml-2 flex-shrink-0"
                              style={{ backgroundColor: getCategoryColor(meal.category) }}
                            >
                              {translateCategoryName(meal.category)}
                            </span>
                          </div>
                          {meal.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{meal.description}</p>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex justify-between">
                            <span>{t('usedTimes', { count: meal.timesUsed })}</span>
                            <span>{(meal.ingredientIds || []).length} ingredients</span>
                          </div>
                          <div>{t('lastUsed', { 
                            date: meal.lastUsed 
                              ? new Date(meal.lastUsed).toLocaleDateString() 
                              : t('never') 
                          })}</div>
                        </div>
                        
                        {/* Ingredients Preview */}
                        {ingredients.length > 0 && (
                          <div>
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                              {ingredients.slice(0, 3).map((ingredient) => (
                                <span key={ingredient.id} className="px-2 py-1 bg-gray-100 rounded text-xs">
                                  {ingredient.name}
                                </span>
                              ))}
                              {ingredients.length > 3 && (
                                <span className="px-2 py-1 bg-gray-200 rounded text-xs text-gray-600">
                                  +{ingredients.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Actions */}
                        <div className="flex space-x-2 pt-2 border-t">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAddMealFromTemplate(meal)}
                            className="flex-1"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {t('useMeal')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(meal)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(meal.id!)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
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