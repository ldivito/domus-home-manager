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
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, Edit3, X, Plus } from "lucide-react"
import { db, MealCategory } from '@/lib/db'

interface ManageMealCategoriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: MealCategory[]
}

export function ManageMealCategoriesDialog({ open, onOpenChange, categories }: ManageMealCategoriesDialogProps) {
  const t = useTranslations('meals.categories')
  const tCat = useTranslations('meals.defaultCategories')
  const [editingCategory, setEditingCategory] = useState<MealCategory | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#6b7280')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6b7280')

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

  const handleEdit = (category: MealCategory) => {
    if (category.isDefault) return // Don't allow editing default categories
    setEditingCategory(category)
    setEditName(category.name)
    setEditColor(category.color || '#6b7280')
  }

  const handleSaveEdit = async () => {
    if (!editingCategory || !editName.trim()) return

    try {
      await db.mealCategories.update(editingCategory.id!, {
        name: editName.trim(),
        color: editColor
      })
      setEditingCategory(null)
      setEditName('')
      setEditColor('#6b7280')
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditName('')
    setEditColor('#6b7280')
  }

  const handleDelete = async (categoryId: number, isDefault: boolean) => {
    if (isDefault) return // Don't allow deleting default categories

    try {
      await db.mealCategories.delete(categoryId)
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return

    try {
      await db.mealCategories.add({
        name: newName.trim(),
        color: newColor,
        isDefault: false,
        createdAt: new Date()
      })
      
      setNewName('')
      setNewColor('#6b7280')
      setIsCreating(false)
    } catch (error) {
      console.error('Error creating category:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('manage')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addNew')}
            </Button>
          </div>

          {isCreating && (
            <Card className="border-2 border-dashed border-blue-300">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new-name">{t('name')}</Label>
                      <Input
                        id="new-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t('namePlaceholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-color">{t('color')}</Label>
                      <Input
                        id="new-color"
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="w-full h-10"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreating(false)
                        setNewName('')
                        setNewColor('#6b7280')
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t('cancel')}
                    </Button>
                    <Button onClick={handleCreate}>
                      {t('create')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="p-4">
                {editingCategory?.id === category.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-name">{t('name')}</Label>
                        <Input
                          id="edit-name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder={t('namePlaceholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-color">{t('color')}</Label>
                        <Input
                          id="edit-color"
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-full h-10"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 mr-2" />
                        {t('cancel')}
                      </Button>
                      <Button onClick={handleSaveEdit}>
                        {t('save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: category.color || '#6b7280' }}
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {translateCategoryName(category.name)}
                        </h3>
                        {category.isDefault && (
                          <p className="text-xs text-gray-500">{t('defaultCategory')}</p>
                        )}
                      </div>
                    </div>
                    
                    {!category.isDefault && (
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          {t('edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(category.id!, category.isDefault)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('delete')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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