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
import { Badge } from "@/components/ui/badge"
import { Plus, X } from "lucide-react"
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { TemplateSelectionDialog } from './TemplateSelectionDialog'

interface AddMealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMealCreated?: () => void
  preSelectedDate?: string
  preSelectedTemplate?: {
    name: string
    description?: string
    category: string
    ingredients: string[]
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
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<number[]>([])
  const [newIngredient, setNewIngredient] = useState('')
  const [newIngredientAmount, setNewIngredientAmount] = useState('')
  const [newIngredientCategory, setNewIngredientCategory] = useState('')
  const [newIngredientImportance, setNewIngredientImportance] = useState<'low' | 'medium' | 'high'>('medium')
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
        // Convert ingredient names to IDs by finding them in savedGroceryItems
        const findIngredientIds = async () => {
          const ids: number[] = []
          for (const ingredientName of preSelectedTemplate.ingredients) {
            const savedItem = await db.savedGroceryItems.where('name').equals(ingredientName).first()
            if (savedItem?.id) {
              ids.push(savedItem.id)
            }
          }
          setSelectedIngredientIds(ids)
        }
        findIngredientIds()
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
      setSelectedIngredientIds([])
      setNewIngredient('')
      setNewIngredientAmount('')
      setNewIngredientCategory('')
      setNewIngredientImportance('medium')
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


  const handleAddIngredient = (savedItemId: number) => {
    if (savedItemId && !selectedIngredientIds.includes(savedItemId)) {
      setSelectedIngredientIds([...selectedIngredientIds, savedItemId])
    }
  }

  const handleRemoveIngredient = (ingredientIdToRemove: number) => {
    setSelectedIngredientIds(selectedIngredientIds.filter(id => id !== ingredientIdToRemove))
  }

  const handleAddNewIngredient = async () => {
    if (newIngredient.trim()) {
      try {
        // Save ingredient to savedGroceryItems and get the ID
        const savedItemId = await db.savedGroceryItems.add({
          name: newIngredient.trim(),
          category: newIngredientCategory || 'defaultCategories.pantry',
          amount: newIngredientAmount.trim() || '',
          importance: newIngredientImportance,
          timesUsed: 1,
          lastUsed: new Date(),
          createdAt: new Date()
        })
        
        // Add the saved item ID to the current meal
        handleAddIngredient(savedItemId)
      } catch (error) {
        console.error('Error saving ingredient to grocery items:', error)
      }

      setNewIngredient('')
      setNewIngredientAmount('')
      setNewIngredientCategory('')
      setNewIngredientImportance('medium')
    }
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
      console.error('Error creating category:', error)
    }
  }

  const handleLoadTemplate = async (templateId: string) => {
    if (!templateId) return
    
    const template = savedMeals.find(meal => meal.id?.toString() === templateId)
    if (template) {
      setName(template.name)
      setDescription(template.description || '')
      setCategory(template.category)
      // Use the ingredient IDs directly
      setSelectedIngredientIds([...template.ingredientIds])
      
      // Update usage stats
      try {
        await db.savedMeals.update(template.id!, {
          timesUsed: template.timesUsed + 1,
          lastUsed: new Date()
        })
      } catch (error) {
        console.error('Error updating template usage:', error)
      }
    }
  }



  const handleSave = async () => {
    if (!name.trim() || selectedIngredientIds.length === 0) {
      return
    }

    try {
      // Create the scheduled meal
      await db.meals.add({
        title: name.trim(),
        description: description.trim() || undefined,
        date: new Date(mealDate + 'T12:00:00'), // Set to noon to avoid timezone issues
        mealType,
        ingredientIds: selectedIngredientIds,
        createdAt: new Date()
      })

      // Also save as template if requested
      if (saveAsTemplate) {
        await db.savedMeals.add({
          name: name.trim(),
          description: description.trim() || undefined,
          category: category || 'defaultMealCategories.meat', // Default category if none selected
          ingredientIds: selectedIngredientIds,
          timesUsed: 0,
          createdAt: new Date()
        })
      }

      onMealCreated?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving meal:', error)
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
                <Select onValueChange={(value) => handleAddIngredient(parseInt(value))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('form.selectIngredient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {groceryItems
                      .filter(item => !selectedIngredientIds.includes(item.id!))
                      .map((item) => (
                      <SelectItem key={item.id} value={item.id!.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Add custom ingredient */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.newIngredient')}</Label>
                
                <div className="space-y-3 mt-2 p-4 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">{t('form.name')} *</Label>
                      <Input
                        value={newIngredient}
                        onChange={(e) => setNewIngredient(e.target.value)}
                        placeholder={t('form.ingredientPlaceholder')}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{t('form.amount')}</Label>
                      <Input
                        value={newIngredientAmount}
                        onChange={(e) => setNewIngredientAmount(e.target.value)}
                        placeholder={t('form.amountPlaceholder')}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
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
              {selectedIngredientIds.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">{t('form.selectedIngredients')}</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedIngredientIds.map((ingredientId) => {
                      const ingredient = groceryItems.find(item => item.id === ingredientId)
                      return ingredient ? (
                        <Badge key={ingredientId} variant="secondary" className="text-sm">
                          {ingredient.name}
                          <button
                            onClick={() => handleRemoveIngredient(ingredientId)}
                            className="ml-2 hover:text-red-500"
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
            disabled={!name.trim() || selectedIngredientIds.length === 0}
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