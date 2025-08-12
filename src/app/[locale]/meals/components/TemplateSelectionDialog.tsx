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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, X, UtensilsCrossed } from "lucide-react"
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

interface TemplateSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTemplateSelected: (templateId: string) => void
}

export function TemplateSelectionDialog({ open, onOpenChange, onTemplateSelected }: TemplateSelectionDialogProps) {
  const tCat = useTranslations('meals.defaultCategories')
  const [searchTerm, setSearchTerm] = useState('')

  const savedMeals = useLiveQuery(
    () => db.savedMeals.orderBy('timesUsed').reverse().toArray(),
    []
  ) || []

  const savedGroceryItems = useLiveQuery(
    () => db.savedGroceryItems.toArray(),
    []
  ) || []

  const mealCategories = useLiveQuery(
    () => db.mealCategories.orderBy('name').toArray(),
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
    const category = mealCategories.find(cat => cat.name === categoryName)
    return category?.color || '#6b7280'
  }

  const filteredMeals = savedMeals.filter(meal => {
    const matchesName = meal.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDescription = meal.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Check if any ingredient names match the search term
    const ingredients = (meal.ingredientIds || [])
      .map(id => savedGroceryItems.find(item => item.id === id))
      .filter(Boolean)
    const matchesIngredient = ingredients.some(ing => 
      ing && ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    return matchesName || matchesDescription || matchesIngredient
  })

  const handleSelectTemplate = (meal: { id?: string }) => {
    if (meal.id) {
      onTemplateSelected(meal.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[80vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center">
            <UtensilsCrossed className="mr-3 h-6 w-6" />
            Select Meal Template
          </DialogTitle>
        </DialogHeader>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search templates by name, description, or ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredMeals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm ? (
                <div>
                  <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                  <p className="text-sm">Try adjusting your search terms</p>
                </div>
              ) : (
                <div>
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No saved templates</h3>
                  <p className="text-sm">Save meals as templates to see them here</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMeals.map((meal) => (
                <Card 
                  key={meal.id} 
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.02] border-2 hover:border-blue-200"
                  onClick={() => handleSelectTemplate(meal)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 truncate">{meal.name}</h3>
                          <span 
                            className="px-2 py-1 rounded-full text-white text-xs font-medium shrink-0 ml-2"
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
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Used {meal.timesUsed} times</span>
                        <span>•</span>
                        <span>{(meal.ingredientIds || []).length} ingredients</span>
                      </div>

                      {/* Ingredients Preview */}
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Ingredients:</p>
                        <div className="flex flex-wrap gap-1">
                          {(meal.ingredientIds || []).slice(0, 4).map((ingredientId) => {
                            const ingredient = savedGroceryItems.find(item => item.id === ingredientId)
                            return ingredient ? (
                              <Badge key={ingredientId} variant="secondary" className="text-xs">
                                {ingredient.name}
                              </Badge>
                            ) : null
                          })}
                          {(meal.ingredientIds || []).length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(meal.ingredientIds || []).length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Last used */}
                      <div className="text-xs text-gray-500 pt-2 border-t">
                        Last used: {meal.lastUsed 
                          ? new Date(meal.lastUsed).toLocaleDateString() 
                          : 'Never'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}