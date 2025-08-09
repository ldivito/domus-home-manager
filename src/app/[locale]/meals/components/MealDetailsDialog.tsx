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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Edit3, Trash2, X, ShoppingCart, Plus } from "lucide-react"
import { db, Meal, SavedGroceryItem } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from "sonner"

interface MealDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meal: Meal | null
  onMealUpdated?: () => void
  onMealDeleted?: () => void
}

export function MealDetailsDialog({ open, onOpenChange, meal, onMealUpdated, onMealDeleted }: MealDetailsDialogProps) {
  const t = useTranslations('meals')
  const tGrocery = useTranslations('grocery.defaultCategories')
  
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editMealType, setEditMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner')
  const [editDate, setEditDate] = useState('')
  const [editIngredientIds, setEditIngredientIds] = useState<number[]>([])
  const [newIngredient, setNewIngredient] = useState('')
  const [newIngredientAmount, setNewIngredientAmount] = useState('')
  const [newIngredientCategory, setNewIngredientCategory] = useState('')
  const [newIngredientImportance, setNewIngredientImportance] = useState<'low' | 'medium' | 'high'>('medium')

  const savedGroceryItems = useLiveQuery(
    () => db.savedGroceryItems.toArray(),
    []
  ) || []

  const groceryCategories = useLiveQuery(
    () => db.groceryCategories.orderBy('name').toArray(),
    []
  ) || []

  const mealTypeColors = {
    breakfast: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    lunch: 'bg-blue-100 text-blue-800 border-blue-200',
    dinner: 'bg-purple-100 text-purple-800 border-purple-200',
    snack: 'bg-green-100 text-green-800 border-green-200'
  }

  const getMealIngredients = () => {
    if (!meal?.ingredientIds) return []
    return meal.ingredientIds
      .map(id => savedGroceryItems.find(item => item.id === id))
      .filter(Boolean) as SavedGroceryItem[]
  }

  const translateGroceryCategoryName = (categoryName: string) => {
    if (categoryName.startsWith('defaultCategories.')) {
      const key = categoryName.replace('defaultCategories.', '')
      const categoryMap: Record<string, string> = {
        'produce': tGrocery('produce'),
        'dairy': tGrocery('dairy'),
        'meatFish': tGrocery('meatFish'),
        'bakery': tGrocery('bakery'),
        'pantry': tGrocery('pantry'),
        'frozen': tGrocery('frozen'),
        'beverages': tGrocery('beverages'),
        'snacks': tGrocery('snacks'),
        'healthBeauty': tGrocery('healthBeauty'),
        'household': tGrocery('household')
      }
      return categoryMap[key] || categoryName
    }
    return categoryName
  }

  const handleEdit = () => {
    if (!meal) return
    setIsEditing(true)
    setEditName(meal.title)
    setEditDescription(meal.description || '')
    setEditMealType(meal.mealType)
    // Format date for input
    const date = new Date(meal.date)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    setEditDate(`${year}-${month}-${day}`)
    setEditIngredientIds([...(meal.ingredientIds || [])])
  }

  const handleSaveEdit = async () => {
    if (!meal || !editName.trim() || editIngredientIds.length === 0) return

    try {
      await db.meals.update(meal.id!, {
        title: editName.trim(),
        description: editDescription.trim() || undefined,
        mealType: editMealType,
        date: new Date(editDate + 'T12:00:00'),
        ingredientIds: editIngredientIds
      })
      setIsEditing(false)
      onMealUpdated?.()
    } catch (error) {
      console.error('Error updating meal:', error)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName('')
    setEditDescription('')
    setEditMealType('dinner')
    setEditDate('')
    setEditIngredientIds([])
    setNewIngredient('')
    setNewIngredientAmount('')
    setNewIngredientCategory('')
    setNewIngredientImportance('medium')
  }

  const handleDelete = async () => {
    if (!meal) return
    try {
      await db.meals.delete(meal.id!)
      onMealDeleted?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error deleting meal:', error)
    }
  }

  const handleAddIngredientsToGrocery = async () => {
    if (!meal?.ingredientIds) return
    
    try {
      let addedCount = 0
      for (const ingredientId of meal.ingredientIds) {
        const savedItem = await db.savedGroceryItems.get(ingredientId)
        if (!savedItem) continue

        await db.groceryItems.add({
          name: savedItem.name,
          category: savedItem.category,
          amount: savedItem.amount || '',
          importance: savedItem.importance || 'medium',
          createdAt: new Date()
        })

        await db.savedGroceryItems.update(ingredientId, {
          timesUsed: savedItem.timesUsed + 1,
          lastUsed: new Date()
        })
        
        addedCount++
      }
      
      // Show success notification
      toast.success(
        addedCount === 1 
          ? t('notifications.addedToGroceryList') 
          : t('notifications.addedMultipleToGroceryList', { count: addedCount }),
        {
          description: t('notifications.ingredientsAddedDescription'),
          action: {
            label: t('notifications.viewList'),
            onClick: () => {
              // Could navigate to grocery page here
              console.log('Navigate to grocery list')
            }
          }
        }
      )
    } catch (error) {
      console.error('Error adding ingredients to grocery list:', error)
      toast.error(t('notifications.errorAddingToGrocery'))
    }
  }

  const handleAddIngredient = (savedItemId: number) => {
    if (savedItemId && !editIngredientIds.includes(savedItemId)) {
      setEditIngredientIds([...editIngredientIds, savedItemId])
    }
  }

  const handleRemoveIngredient = (ingredientIdToRemove: number) => {
    setEditIngredientIds(editIngredientIds.filter(id => id !== ingredientIdToRemove))
  }

  const handleAddNewIngredient = async () => {
    if (newIngredient.trim()) {
      try {
        const savedItemId = await db.savedGroceryItems.add({
          name: newIngredient.trim(),
          category: newIngredientCategory || 'defaultCategories.pantry',
          amount: newIngredientAmount.trim() || '',
          importance: newIngredientImportance,
          timesUsed: 1,
          lastUsed: new Date(),
          createdAt: new Date()
        })
        
        handleAddIngredient(savedItemId)
      } catch (error) {
        console.error('Error saving ingredient:', error)
      }

      setNewIngredient('')
      setNewIngredientAmount('')
      setNewIngredientCategory('')
      setNewIngredientImportance('medium')
    }
  }

  if (!meal) return null

  const ingredients = getMealIngredients()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center space-x-3">
            <Badge className={`${mealTypeColors[meal.mealType]} border`}>
              {t(`mealTypes.${meal.mealType}`)}
            </Badge>
            <span>{isEditing ? t('editMeal') : meal.title}</span>
          </DialogTitle>
        </DialogHeader>
        
        {isEditing ? (
          // Edit Mode
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">{t('form.name')} *</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-date">{t('form.date')} *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">{t('form.description')}</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('form.descriptionPlaceholder')}
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-mealtype">{t('form.mealType')} *</Label>
              <Select value={editMealType} onValueChange={(value: 'breakfast' | 'lunch' | 'dinner' | 'snack') => setEditMealType(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">{t('mealTypes.breakfast')}</SelectItem>
                  <SelectItem value="lunch">{t('mealTypes.lunch')}</SelectItem>
                  <SelectItem value="dinner">{t('mealTypes.dinner')}</SelectItem>
                  <SelectItem value="snack">{t('mealTypes.snack')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ingredients Management */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('form.ingredients')} *</Label>
              
              {/* Add from existing */}
              <div>
                <Label className="text-xs text-gray-600">Add from saved items</Label>
                <Select onValueChange={(value) => handleAddIngredient(parseInt(value))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedGroceryItems
                      .filter(item => !editIngredientIds.includes(item.id!))
                      .map((item) => (
                      <SelectItem key={item.id} value={item.id!.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Create new ingredient */}
              <div className="border rounded-lg p-3 bg-gray-50">
                <Label className="text-xs text-gray-600 mb-2 block">Create new ingredient</Label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Input
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    placeholder="Ingredient name"
                    className="text-sm"
                  />
                  <Input
                    value={newIngredientAmount}
                    onChange={(e) => setNewIngredientAmount(e.target.value)}
                    placeholder="Amount"
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Select value={newIngredientCategory} onValueChange={setNewIngredientCategory}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {groceryCategories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <span>{translateGroceryCategoryName(category.name)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newIngredientImportance}
                    onValueChange={(value: 'low' | 'medium' | 'high') => setNewIngredientImportance(value)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddNewIngredient} size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Ingredient
                </Button>
              </div>

              {/* Selected ingredients */}
              {editIngredientIds.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-600">Selected ingredients ({editIngredientIds.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editIngredientIds.map((ingredientId) => {
                      const ingredient = savedGroceryItems.find(item => item.id === ingredientId)
                      return ingredient ? (
                        <Badge key={ingredientId} variant="secondary" className="text-xs">
                          {ingredient.name}
                          <button
                            onClick={() => handleRemoveIngredient(ingredientId)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // View Mode
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{meal.title}</h3>
                    {meal.description && (
                      <p className="text-gray-600 mt-1">{meal.description}</p>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>📅 {new Date(meal.date).toLocaleDateString()}</span>
                      <span>🍽️ {t(`mealTypes.${meal.mealType}`)}</span>
                    </div>
                  </div>

                  {ingredients.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2 text-sm">{t('ingredients')} ({ingredients.length}):</h4>
                      <div className="flex flex-wrap gap-1">
                        {ingredients.map((ingredient) => (
                          <span key={ingredient.id} className="px-2 py-1 bg-gray-100 rounded-md text-xs">
                            {ingredient.name}
                            {ingredient.amount && ` (${ingredient.amount})`}
                          </span>
                        ))}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-3"
                        onClick={handleAddIngredientsToGrocery}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {t('addToGrocery')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="mr-2 h-4 w-4" />
                {t('form.cancel')}
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={!editName.trim() || editIngredientIds.length === 0}
              >
                {t('form.save')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
              <div className="space-x-2">
                <Button variant="outline" onClick={handleEdit}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  {t('edit')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('delete')}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}