'use client'

import { useEffect, useState } from 'react'
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
import { db, Meal, SavedGroceryItem, MealIngredient, deleteWithSync } from '@/lib/db'
import { generateId } from '@/lib/utils'
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
  const [editIngredients, setEditIngredients] = useState<MealIngredient[]>([])
  const [selectedSavedIngredientId, setSelectedSavedIngredientId] = useState('')
  const [selectedIngredientAmount, setSelectedIngredientAmount] = useState('')
  const [selectedIngredientNotes, setSelectedIngredientNotes] = useState('')
  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientRecipeAmount, setNewIngredientRecipeAmount] = useState('')
  const [newIngredientPurchaseAmount, setNewIngredientPurchaseAmount] = useState('')
  const [newIngredientCategory, setNewIngredientCategory] = useState('')
  const [newIngredientImportance, setNewIngredientImportance] = useState<'low' | 'medium' | 'high'>('medium')
  const [newIngredientUsageNotes, setNewIngredientUsageNotes] = useState('')

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

  useEffect(() => {
    db.ensureMealIngredientStructure().catch((error) => {
      console.error('Failed to ensure meal ingredient structure:', error)
    })
  }, [])

  const getMealIngredients = () => {
    if (!meal?.ingredients) return []
    return meal.ingredients
      .map(ingredient => {
        const savedItem = savedGroceryItems.find(item => item.id === ingredient.savedGroceryItemId)
        if (!savedItem) return null
        return { savedItem, ingredient }
      })
      .filter(Boolean) as { savedItem: SavedGroceryItem; ingredient: MealIngredient }[]
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
    setEditIngredients(
      (meal.ingredients || []).map((ingredient) => ({
        ...ingredient,
        id: ingredient.id || ingredient.savedGroceryItemId
      }))
    )
    setSelectedSavedIngredientId('')
    setSelectedIngredientAmount('')
    setSelectedIngredientNotes('')
  }

  const handleSaveEdit = async () => {
    if (!meal || !editName.trim() || editIngredients.length === 0) return

    try {
      const ingredients = editIngredients.map((ingredient) => ({
        ...ingredient,
        id: ingredient.id || ingredient.savedGroceryItemId
      }))

      await db.meals.update(meal.id!, {
        title: editName.trim(),
        description: editDescription.trim() || undefined,
        mealType: editMealType,
        date: new Date(editDate + 'T12:00:00'),
        ingredients
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
    setEditIngredients([])
    setSelectedSavedIngredientId('')
    setSelectedIngredientAmount('')
    setSelectedIngredientNotes('')
    setNewIngredientName('')
    setNewIngredientRecipeAmount('')
    setNewIngredientPurchaseAmount('')
    setNewIngredientCategory('')
    setNewIngredientImportance('medium')
    setNewIngredientUsageNotes('')
  }

  const handleDelete = async () => {
    if (!meal) return
    try {
      await deleteWithSync(db.meals, 'meals', meal.id!)
      onMealDeleted?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error deleting meal:', error)
    }
  }

  const handleAddIngredientsToGrocery = async () => {
    if (!meal?.ingredients) return

    try {
      let addedCount = 0
      for (const ingredient of meal.ingredients) {
        const savedItem = await db.savedGroceryItems.get(ingredient.savedGroceryItemId)
        if (!savedItem) continue

        await db.groceryItems.add({
          name: savedItem.name,
          category: savedItem.category,
          amount: savedItem.amount || '',
          importance: savedItem.importance || 'medium',
          createdAt: new Date()
        })

        if (savedItem.id) {
          await db.savedGroceryItems.update(savedItem.id, {
            timesUsed: savedItem.timesUsed + 1,
            lastUsed: new Date()
          })
        }

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

  const handleAddIngredientEntry = (savedItemId: string, amount?: string, usageNotes?: string) => {
    if (!savedItemId) return

    const cleanedAmount = amount?.trim()
    const cleanedNotes = usageNotes?.trim()

    setEditIngredients((prev) => [
      ...prev,
      {
        id: generateId('ing'),
        savedGroceryItemId: savedItemId,
        amount: cleanedAmount || undefined,
        usageNotes: cleanedNotes || undefined
      }
    ])
  }

  const handleAddSelectedIngredient = () => {
    if (!selectedSavedIngredientId) return
    handleAddIngredientEntry(selectedSavedIngredientId, selectedIngredientAmount, selectedIngredientNotes)
    setSelectedSavedIngredientId('')
    setSelectedIngredientAmount('')
    setSelectedIngredientNotes('')
  }

  const handleRemoveIngredient = (index: number) => {
    setEditIngredients((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleIngredientChange = (index: number, updates: Partial<MealIngredient>) => {
    setEditIngredients((prev) =>
      prev.map((ingredient, idx) =>
        idx === index
          ? {
              ...ingredient,
              ...updates,
              amount: updates.amount !== undefined ? (updates.amount?.trim() ? updates.amount.trim() : undefined) : ingredient.amount,
              usageNotes:
                updates.usageNotes !== undefined
                  ? (updates.usageNotes?.trim() ? updates.usageNotes.trim() : undefined)
                  : ingredient.usageNotes
            }
          : ingredient
      )
    )
  }

  const handleAddNewIngredient = async () => {
    if (!newIngredientName.trim()) return

    try {
      const savedItemId = await db.savedGroceryItems.add({
        id: generateId('sgi'),
        name: newIngredientName.trim(),
        category: newIngredientCategory || 'defaultCategories.pantry',
        amount: newIngredientPurchaseAmount.trim() || '',
        importance: newIngredientImportance,
        timesUsed: 1,
        lastUsed: new Date(),
        createdAt: new Date()
      })

      handleAddIngredientEntry(savedItemId, newIngredientRecipeAmount, newIngredientUsageNotes)
    } catch (error) {
      console.error('Error saving ingredient:', error)
    }

    setNewIngredientName('')
    setNewIngredientRecipeAmount('')
    setNewIngredientPurchaseAmount('')
    setNewIngredientCategory('')
    setNewIngredientImportance('medium')
    setNewIngredientUsageNotes('')
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

              <div>
                <Label className="text-xs text-gray-600">{t('form.fromGroceries')}</Label>
                <Select value={selectedSavedIngredientId} onValueChange={setSelectedSavedIngredientId}>
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue placeholder={t('form.selectIngredient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedGroceryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id!.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <Input
                    value={selectedIngredientAmount}
                    onChange={(e) => setSelectedIngredientAmount(e.target.value)}
                    placeholder={t('form.recipeAmountPlaceholder')}
                    className="text-sm"
                  />
                  <Input
                    value={selectedIngredientNotes}
                    onChange={(e) => setSelectedIngredientNotes(e.target.value)}
                    placeholder={t('form.usageNotesPlaceholder')}
                    className="text-sm"
                  />
                </div>
                <Button
                  onClick={handleAddSelectedIngredient}
                  size="sm"
                  className="w-full mt-2"
                  disabled={!selectedSavedIngredientId}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('form.addIngredient')}
                </Button>
              </div>

              <div className="border rounded-lg p-3 bg-gray-50">
                <Label className="text-xs text-gray-600 mb-2 block">{t('form.newIngredient')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <Input
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    placeholder={t('form.ingredientPlaceholder')}
                    className="text-sm"
                  />
                  <Input
                    value={newIngredientRecipeAmount}
                    onChange={(e) => setNewIngredientRecipeAmount(e.target.value)}
                    placeholder={t('form.recipeAmountPlaceholder')}
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <Input
                    value={newIngredientPurchaseAmount}
                    onChange={(e) => setNewIngredientPurchaseAmount(e.target.value)}
                    placeholder={t('form.purchaseAmountPlaceholder')}
                    className="text-sm"
                  />
                  <Textarea
                    value={newIngredientUsageNotes}
                    onChange={(e) => setNewIngredientUsageNotes(e.target.value)}
                    placeholder={t('form.usageNotesPlaceholder')}
                    className="text-sm"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <Select value={newIngredientCategory} onValueChange={setNewIngredientCategory}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder={t('form.selectGroceryCategory')} />
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
                      <SelectValue placeholder={t('form.selectImportance')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('form.importanceLow')}</SelectItem>
                      <SelectItem value="medium">{t('form.importanceMedium')}</SelectItem>
                      <SelectItem value="high">{t('form.importanceHigh')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddNewIngredient} size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  {t('form.addIngredient')}
                </Button>
              </div>

              {editIngredients.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-600">{t('form.selectedIngredients')} ({editIngredients.length})</Label>
                  <div className="space-y-2 mt-2">
                    {editIngredients.map((ingredient, index) => {
                      const savedItem = savedGroceryItems.find(item => item.id === ingredient.savedGroceryItemId)
                      const key = ingredient.id || `${ingredient.savedGroceryItemId}-${index}`
                      return (
                        <div key={key} className="border rounded-md p-2 bg-white">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {savedItem?.name || t('form.unknownIngredient')}
                              </p>
                              {savedItem?.amount && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {t('form.purchaseAmountLabel', { amount: savedItem.amount })}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveIngredient(index)}
                              aria-label={t('form.removeIngredient')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            <Input
                              value={ingredient.amount || ''}
                              onChange={(e) => handleIngredientChange(index, { amount: e.target.value })}
                              placeholder={t('form.recipeAmountPlaceholder')}
                              className="text-sm"
                            />
                            <Textarea
                              value={ingredient.usageNotes || ''}
                              onChange={(e) => handleIngredientChange(index, { usageNotes: e.target.value })}
                              placeholder={t('form.usageNotesPlaceholder')}
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                        </div>
                      )
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
                        {ingredients.map(({ savedItem, ingredient }, idx) => (
                          <span key={`${savedItem.id}-${ingredient.id ?? idx}`} className="px-2 py-1 bg-gray-100 rounded-md text-xs">
                            {savedItem.name}
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
                disabled={!editName.trim() || editIngredients.length === 0}
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