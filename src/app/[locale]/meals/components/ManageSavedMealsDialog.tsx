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
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, Edit3, X, Plus } from "lucide-react"
import { db, SavedMeal, MealCategory, MealIngredient } from '@/lib/db'
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
  const tGrocery = useTranslations('grocery.defaultCategories')
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editIngredients, setEditIngredients] = useState<MealIngredient[]>([])
  const [newIngredient, setNewIngredient] = useState<MealIngredient>({
    name: '',
    category: '',
    amount: '',
    importance: 'medium'
  })
  const [showIngredientForm, setShowIngredientForm] = useState(false)

  const savedMeals = useLiveQuery(
    () => db.savedMeals.toArray(),
    []
  ) || []

  const groceryCategories = useLiveQuery(
    () => db.groceryCategories.orderBy('name').toArray(),
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

  const translateGroceryCategoryName = (categoryName: string | undefined | null) => {
    if (typeof categoryName !== 'string') return '';
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

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName)
    return category?.color || '#6b7280'
  }

  const handleEdit = (meal: SavedMeal) => {
    setEditingMeal(meal)
    setEditName(meal.name)
    setEditDescription(meal.description || '')
    setEditCategory(meal.category)
    setEditIngredients([...meal.ingredients])
    setShowIngredientForm(false)
  }

  const handleSaveEdit = async () => {
    if (!editingMeal || !editName.trim() || editIngredients.length === 0) return

    try {
      await db.savedMeals.update(editingMeal.id!, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory,
        ingredients: editIngredients
      })
      setEditingMeal(null)
      setEditName('')
      setEditDescription('')
      setEditCategory('')
      setEditIngredients([])
    } catch (error) {
      console.error('Error updating saved meal:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingMeal(null)
    setEditName('')
    setEditDescription('')
    setEditCategory('')
    setEditIngredients([])
    setNewIngredient({
      name: '',
      category: '',
      amount: '',
      importance: 'medium'
    })
    setShowIngredientForm(false)
  }

  const handleDelete = async (mealId: number) => {
    try {
      await db.savedMeals.delete(mealId)
    } catch (error) {
      console.error('Error deleting saved meal:', error)
    }
  }

  const handleAddIngredient = () => {
    if (newIngredient.name.trim() && newIngredient.category && 
        !editIngredients.some(ing => ing.name === newIngredient.name.trim())) {
      setEditIngredients([...editIngredients, {
        ...newIngredient,
        name: newIngredient.name.trim()
      }])
      setNewIngredient({
        name: '',
        category: '',
        amount: '',
        importance: 'medium'
      })
      setShowIngredientForm(false)
    }
  }

  const handleRemoveIngredient = (ingredientName: string) => {
    setEditIngredients(editIngredients.filter(ing => ing.name !== ingredientName))
  }

  const getImportanceBadge = (importance: 'low' | 'medium' | 'high') => {
    const variants = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800', 
      low: 'bg-green-100 text-green-800'
    }
    return variants[importance]
  }

  const getGroceryCategoryColor = (categoryName: string) => {
    const category = groceryCategories.find(cat => cat.name === categoryName)
    return category?.color || '#6b7280'
  }

  const handleAddMealFromTemplate = async (meal: SavedMeal) => {
    // Update usage stats
    try {
      await db.savedMeals.update(meal.id!, {
        timesUsed: meal.timesUsed + 1,
        lastUsed: new Date()
      })
    } catch (error) {
      console.error('Error updating template usage:', error)
    }

    // Prepare template data for AddMealDialog
    const template: TemplateData = {
      name: meal.name,
      description: meal.description,
      category: meal.category,
      ingredients: meal.ingredients.map(ingredient => ingredient.name)
    }

    onAddMealWithTemplate?.(template)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[80vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('manage')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {savedMeals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No saved meals yet</h3>
              <p className="text-sm">{t('noSavedMeals')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {savedMeals.map((meal) => (
                <Card key={meal.id} className="hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-6">
                  {editingMeal?.id === meal.id ? (
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
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-description">{t('form.description')}</Label>
                        <Textarea
                          id="edit-description"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder={t('form.descriptionPlaceholder')}
                          rows={2}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label>{t('form.ingredients')}</Label>
                          <Button 
                            onClick={() => setShowIngredientForm(!showIngredientForm)} 
                            size="sm" 
                            variant="outline"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {t('form.addIngredient')}
                          </Button>
                        </div>
                        
                        {showIngredientForm && (
                          <Card className="mt-2 p-4 bg-gray-50">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor="ingredient-name">Name</Label>
                                  <Input
                                    id="ingredient-name"
                                    value={newIngredient.name}
                                    onChange={(e) => setNewIngredient({...newIngredient, name: e.target.value})}
                                    placeholder="Ingredient name"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="ingredient-amount">Amount</Label>
                                  <Input
                                    id="ingredient-amount"
                                    value={newIngredient.amount}
                                    onChange={(e) => setNewIngredient({...newIngredient, amount: e.target.value})}
                                    placeholder="2 cups, 1 lb, etc."
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor="ingredient-category">Category</Label>
                                  <Select 
                                    value={newIngredient.category} 
                                    onValueChange={(value) => setNewIngredient({...newIngredient, category: value})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select category" />
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
                                  <Label htmlFor="ingredient-importance">Importance</Label>
                                  <Select 
                                    value={newIngredient.importance} 
                                    onValueChange={(value) => setNewIngredient({...newIngredient, importance: value as 'low' | 'medium' | 'high'})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <div className="flex justify-end space-x-2">
                                <Button variant="outline" size="sm" onClick={() => setShowIngredientForm(false)}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={handleAddIngredient}>
                                  Add Ingredient
                                </Button>
                              </div>
                            </div>
                          </Card>
                        )}
                        
                        <div className="space-y-2 mt-3">
                          {editIngredients.map((ingredient, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-medium">{ingredient.name}</span>
                                  {ingredient.amount && (
                                    <span className="text-sm text-gray-500">({ingredient.amount})</span>
                                  )}
                                  <span 
                                    className="px-2 py-1 rounded text-white text-xs font-medium"
                                    style={{ backgroundColor: getGroceryCategoryColor(ingredient.category) }}
                                  >
                                    {translateGroceryCategoryName(ingredient.category)}
                                  </span>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getImportanceBadge(ingredient.importance)}`}>
                                    {ingredient.importance}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveIngredient(ingredient.name)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {editIngredients.length === 0 && (
                            <p className="text-gray-500 text-sm py-2">No ingredients added yet</p>
                          )}
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
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-xl font-semibold text-gray-900">{meal.name}</h3>
                            <span 
                              className="px-3 py-1 rounded-full text-white text-sm font-medium"
                              style={{ backgroundColor: getCategoryColor(meal.category) }}
                            >
                              {translateCategoryName(meal.category)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{t('usedTimes', { count: meal.timesUsed })}</span>
                            <span>•</span>
                            <span>{t('lastUsed', { 
                              date: meal.lastUsed 
                                ? new Date(meal.lastUsed).toLocaleDateString() 
                                : t('never') 
                            })}</span>
                            <span>•</span>
                            <span>{meal.ingredients.length} ingredients</span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {meal.description && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-gray-700 text-sm italic">&ldquo;{meal.description}&rdquo;</p>
                        </div>
                      )}
                      
                      {/* Ingredients */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Ingredients ({meal.ingredients.length})</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {meal.ingredients.map((ingredient, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <span className="font-medium text-gray-900">{ingredient.name}</span>
                                {ingredient.amount && (
                                  <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded">({ingredient.amount})</span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <span 
                                  className="px-2 py-1 rounded text-white text-xs font-medium"
                                  style={{ backgroundColor: getGroceryCategoryColor(ingredient.category) }}
                                >
                                  {translateGroceryCategoryName(ingredient.category)}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getImportanceBadge(ingredient.importance)}`}>
                                  {ingredient.importance}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex space-x-3 pt-2 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAddMealFromTemplate(meal)}
                          className="flex-1"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t('addMeal')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(meal)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          {t('edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(meal.id!)}
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
              ))}
            </div>
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