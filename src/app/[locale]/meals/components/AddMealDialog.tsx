'use client'

import { useState, useEffect } from 'react'
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
import { Plus, X } from "lucide-react"
import { db, Meal, SavedMeal, SavedGroceryItem, MealIngredient } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { useLiveQuery } from 'dexie-react-hooks'
import { TemplateSelectionDialog } from './TemplateSelectionDialog'
import { logger } from '@/lib/logger'

interface AddMealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMealCreated?: () => void
  preSelectedDate?: string
  preSelectedTemplate?: {
    name: string
    description?: string
    category: string
    ingredients: MealIngredient[]
  }
}

export function AddMealDialog({ open, onOpenChange, onMealCreated, preSelectedDate, preSelectedTemplate }: AddMealDialogProps) {
  const t = useTranslations('meals')
  const tCat = useTranslations('meals.defaultCategories')
  const tGrocery = useTranslations('grocery.defaultCategories')
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [mealDate, setMealDate] = useState(() => {
    // Create today's date string without timezone conversion issues
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner')
  const [selectedIngredients, setSelectedIngredients] = useState<MealIngredient[]>([])
  const [selectedSavedIngredientId, setSelectedSavedIngredientId] = useState('')
  const [selectedIngredientAmount, setSelectedIngredientAmount] = useState('')
  const [selectedIngredientNotes, setSelectedIngredientNotes] = useState('')
  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientRecipeAmount, setNewIngredientRecipeAmount] = useState('')
  const [newIngredientPurchaseAmount, setNewIngredientPurchaseAmount] = useState('')
  const [newIngredientCategory, setNewIngredientCategory] = useState('')
  const [newIngredientImportance, setNewIngredientImportance] = useState<'low' | 'medium' | 'high'>('medium')
  const [newIngredientUsageNotes, setNewIngredientUsageNotes] = useState('')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#6b7280')
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)

  const mealCategories = useLiveQuery(
    () => db.mealCategories.orderBy('name').toArray(),
    []
  ) || []

  const groceryItems = useLiveQuery(
    () => db.savedGroceryItems.orderBy('name').toArray(),
    []
  ) || []

  const groceryCategories = useLiveQuery(
    () => db.groceryCategories.orderBy('name').toArray(),
    []
  ) || []

  const savedMeals = useLiveQuery(
    () => db.savedMeals.orderBy('name').toArray(),
    []
  ) || []

  useEffect(() => {
    db.ensureMealIngredientStructure().catch((error) => {
      logger.error('Failed to ensure meal ingredient structure:', error)
    })
  }, [])

  // Handle pre-selected values when dialog opens
  useEffect(() => {
    if (open) {
      if (preSelectedDate) {
        setMealDate(preSelectedDate)
      }
      if (preSelectedTemplate) {
        setName(preSelectedTemplate.name)
        setDescription(preSelectedTemplate.description || '')
        setCategory(preSelectedTemplate.category)
        setSelectedIngredients(
          preSelectedTemplate.ingredients.map((ingredient) => ({
            ...ingredient,
            id: ingredient.id || generateId('ing')
          }))
        )
      }
    } else {
      // Reset form when dialog closes
      setName('')
      setDescription('')
      setCategory('')
      // Reset to today's date using local date formatting
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      setMealDate(`${year}-${month}-${day}`)
      setMealType('dinner')
      setSelectedIngredients([])
      setSelectedSavedIngredientId('')
      setSelectedIngredientAmount('')
      setSelectedIngredientNotes('')
      setNewIngredientName('')
      setNewIngredientRecipeAmount('')
      setNewIngredientPurchaseAmount('')
      setNewIngredientCategory('')
      setNewIngredientImportance('medium')
      setNewIngredientUsageNotes('')
      setSaveAsTemplate(false)
    }
  }, [open, preSelectedDate, preSelectedTemplate])

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
  const handleAddIngredientEntry = (savedItemId: string, amount?: string, usageNotes?: string) => {
    if (!savedItemId) return

    const cleanedAmount = amount?.trim()
    const cleanedNotes = usageNotes?.trim()

    setSelectedIngredients((prev) => [
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
    setSelectedIngredients((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleIngredientChange = (index: number, updates: Partial<MealIngredient>) => {
    setSelectedIngredients((prev) =>
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
    if (!newIngredientName.trim()) {
      return
    }

    try {
      const saved: SavedGroceryItem = {
        id: generateId('sgi'),
        name: newIngredientName.trim(),
        category: newIngredientCategory || 'defaultCategories.pantry',
        amount: newIngredientPurchaseAmount.trim() || '',
        importance: newIngredientImportance,
        timesUsed: 1,
        lastUsed: new Date(),
        createdAt: new Date()
      }
      const savedItemId = await db.savedGroceryItems.add(saved)

      handleAddIngredientEntry(savedItemId, newIngredientRecipeAmount, newIngredientUsageNotes)
    } catch (error) {
      logger.error('Error saving ingredient to grocery items:', error)
    }

    setNewIngredientName('')
    setNewIngredientRecipeAmount('')
    setNewIngredientPurchaseAmount('')
    setNewIngredientCategory('')
    setNewIngredientImportance('medium')
    setNewIngredientUsageNotes('')
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    try {
      await db.mealCategories.add({
        name: newCategoryName.trim(),
        color: newCategoryColor,
        isDefault: false,
        createdAt: new Date()
      })
      
      setCategory(newCategoryName.trim())
      setIsCreatingCategory(false)
      setNewCategoryName('')
      setNewCategoryColor('#6b7280')
    } catch (error) {
      logger.error('Error creating category:', error)
    }
  }

  const handleLoadTemplate = async (templateId: string) => {
    if (!templateId) return

    const template = savedMeals.find(meal => meal.id?.toString() === templateId)
    if (template) {
      setName(template.name)
      setDescription(template.description || '')
      setCategory(template.category)
      setSelectedIngredients(
        (template.ingredients || []).map((ingredient) => ({
          ...ingredient,
          id: ingredient.id || generateId('ing')
        }))
      )

      // Update usage stats
      try {
        await db.savedMeals.update(template.id!, {
          timesUsed: template.timesUsed + 1,
          lastUsed: new Date()
        })
      } catch (error) {
        logger.error('Error updating template usage:', error)
      }
    }
  }



  const handleSave = async () => {
    if (!name.trim() || selectedIngredients.length === 0) {
      return
    }

    try {
      const ingredients = selectedIngredients.map((ingredient) => ({
        ...ingredient,
        id: ingredient.id || generateId('ing')
      }))

      // Create the scheduled meal
      const meal: Meal = {
        id: generateId('mea'),
        title: name.trim(),
        description: description.trim() || undefined,
        date: new Date(mealDate + 'T12:00:00'), // Set to noon to avoid timezone issues
        mealType,
        ingredients,
        createdAt: new Date()
      }
      await db.meals.add(meal)

      // Also save as template if requested
      if (saveAsTemplate) {
        const savedMeal: SavedMeal = {
          id: generateId('smea'),
          name: name.trim(),
          description: description.trim() || undefined,
          category: category || 'defaultMealCategories.meat', // Default category if none selected
          ingredients,
          timesUsed: 0,
          createdAt: new Date()
        }
        await db.savedMeals.add(savedMeal)
      }

      onMealCreated?.()
      onOpenChange(false)
    } catch (error) {
      logger.error('Error saving meal:', error)
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('addMeal')}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b dark:border-gray-700 pb-2">Basic Information</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="meal-name" className="text-sm font-medium">{t('form.name')} *</Label>
                <Input
                  id="meal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="meal-description" className="text-sm font-medium">{t('form.description')}</Label>
                <Textarea
                  id="meal-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('form.descriptionPlaceholder')}
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meal-date" className="text-sm font-medium">{t('form.date')} *</Label>
                  <Input
                    id="meal-date"
                    type="date"
                    value={mealDate}
                    onChange={(e) => setMealDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="meal-type" className="text-sm font-medium">{t('form.mealType')} *</Label>
                  <Select value={mealType} onValueChange={(value: 'breakfast' | 'lunch' | 'dinner' | 'snack') => setMealType(value)}>
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
              </div>

              <div>
                <Label htmlFor="meal-category" className="text-sm font-medium">{t('form.category')} {t('form.optional')}</Label>
                {isCreatingCategory ? (
                  <div className="space-y-3 mt-1">
                    <div className="flex space-x-2">
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder={t('form.newCategoryPlaceholder')}
                      />
                      <Input
                        type="color"
                        value={newCategoryColor}
                        onChange={(e) => setNewCategoryColor(e.target.value)}
                        className="w-16"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleCreateCategory} size="sm">
                        {t('form.createCategory')}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCreatingCategory(false)}
                        size="sm"
                      >
                        {t('form.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 mt-1">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {mealCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span>{translateCategoryName(cat.name)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCreatingCategory(true)}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('form.newCategory')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Template & Ingredients */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b dark:border-gray-700 pb-2">Template & Ingredients</h3>

            {/* Template Selection */}
            {savedMeals.length > 0 && (
              <div>
                <Label className="text-sm font-medium">{t('form.loadTemplate')} {t('form.optional')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => setShowTemplateDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Browse Meal Templates ({savedMeals.length} available)
                </Button>
                <p className="text-xs text-gray-500 mt-1">Select from your saved meal templates to pre-fill this form</p>
              </div>
            )}
            <Label className="text-sm font-medium">{t('form.ingredients')} *</Label>

            <div className="space-y-4 mt-2">
              {/* Existing grocery items */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.fromGroceries')}</Label>
                <Select value={selectedSavedIngredientId} onValueChange={setSelectedSavedIngredientId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('form.selectIngredient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {groceryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id!.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-sm font-medium">{t('form.recipeAmount')}</Label>
                    <Input
                      value={selectedIngredientAmount}
                      onChange={(e) => setSelectedIngredientAmount(e.target.value)}
                      placeholder={t('form.recipeAmountPlaceholder')}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('form.usageNotes')}</Label>
                    <Input
                      value={selectedIngredientNotes}
                      onChange={(e) => setSelectedIngredientNotes(e.target.value)}
                      placeholder={t('form.usageNotesPlaceholder')}
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddSelectedIngredient}
                  size="sm"
                  className="w-full mt-3"
                  disabled={!selectedSavedIngredientId}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('form.addIngredient')}
                </Button>
              </div>

              {/* Add custom ingredient */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.newIngredient')}</Label>

                <div className="space-y-3 mt-2 p-4 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">{t('form.name')} *</Label>
                      <Input
                        value={newIngredientName}
                        onChange={(e) => setNewIngredientName(e.target.value)}
                        placeholder={t('form.ingredientPlaceholder')}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{t('form.recipeAmount')}</Label>
                      <Input
                        value={newIngredientRecipeAmount}
                        onChange={(e) => setNewIngredientRecipeAmount(e.target.value)}
                        placeholder={t('form.recipeAmountPlaceholder')}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">{t('form.purchaseAmount')}</Label>
                      <Input
                        value={newIngredientPurchaseAmount}
                        onChange={(e) => setNewIngredientPurchaseAmount(e.target.value)}
                        placeholder={t('form.purchaseAmountPlaceholder')}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{t('form.usageNotes')}</Label>
                      <Textarea
                        value={newIngredientUsageNotes}
                        onChange={(e) => setNewIngredientUsageNotes(e.target.value)}
                        placeholder={t('form.usageNotesPlaceholder')}
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">{t('form.groceryCategory')}</Label>
                      <Select value={newIngredientCategory} onValueChange={setNewIngredientCategory}>
                        <SelectTrigger className="mt-1">
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
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{t('form.selectImportance')}</Label>
                      <Select
                        value={newIngredientImportance}
                        onValueChange={(value: 'low' | 'medium' | 'high') => setNewIngredientImportance(value)}
                      >
                        <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('form.selectImportance')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">{t('form.importanceLow')}</SelectItem>
                          <SelectItem value="medium">{t('form.importanceMedium')}</SelectItem>
                          <SelectItem value="high">{t('form.importanceHigh')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={handleAddNewIngredient} size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form.addIngredient')}
                  </Button>
                </div>
              </div>

              {/* Selected ingredients */}
              {selectedIngredients.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">{t('form.selectedIngredients')}</Label>
                  <div className="space-y-3 mt-2">
                    {selectedIngredients.map((ingredient, index) => {
                      const savedItem = groceryItems.find(item => item.id === ingredient.savedGroceryItemId)
                      const key = ingredient.id || `${ingredient.savedGroceryItemId}-${index}`
                      return (
                        <div
                          key={key}
                          className="border dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {savedItem?.name || t('form.unknownIngredient')}
                              </p>
                              {savedItem?.amount && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            <div>
                              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {t('form.recipeAmount')}
                              </Label>
                              <Input
                                value={ingredient.amount || ''}
                                onChange={(e) => handleIngredientChange(index, { amount: e.target.value })}
                                placeholder={t('form.recipeAmountPlaceholder')}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {t('form.usageNotes')}
                              </Label>
                              <Textarea
                                value={ingredient.usageNotes || ''}
                                onChange={(e) => handleIngredientChange(index, { usageNotes: e.target.value })}
                                placeholder={t('form.usageNotesPlaceholder')}
                                className="mt-1"
                                rows={2}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Save as Template Option */}
            <div className="flex items-center space-x-2 border-t pt-4">
              <input
                type="checkbox"
                id="save-as-template"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="save-as-template" className="text-sm">
                {t('form.saveAsTemplate')}
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || selectedIngredients.length === 0}
          >
            {t('form.planMeal')}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      <TemplateSelectionDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onTemplateSelected={handleLoadTemplate}
      />
    </Dialog>
  )
}