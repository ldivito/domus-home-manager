'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Edit2, Palette } from "lucide-react"
import { db, GroceryCategory } from '@/lib/db'
import { generateId } from '@/lib/utils'

interface ManageCategoriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: GroceryCategory[]
}

const PREDEFINED_COLORS = [
  '#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', 
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280',
  '#14b8a6', '#6366f1', '#f43f5e', '#eab308', '#a855f7',
  '#0ea5e9', '#65a30d', '#ea580c', '#e11d48', '#64748b'
]

export function ManageCategoriesDialog({ open, onOpenChange, categories }: ManageCategoriesDialogProps) {
  const t = useTranslations('grocery.manageCategoriesDialog')
  const tCategories = useTranslations('grocery.defaultCategories')
  const locale = useLocale()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0])
  const [editingCategory, setEditingCategory] = useState<GroceryCategory | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    setIsSubmitting(true)
    try {
      await db.groceryCategories.add({
        id: generateId('gcat'),
        name: newCategoryName.trim(),
        color: selectedColor,
        isDefault: false,
        locale: locale,
        createdAt: new Date()
      })
      
      setNewCategoryName('')
      setSelectedColor(PREDEFINED_COLORS[0])
    } catch (error) {
      console.error('Error adding category:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCategory = async () => {
    if (!editingCategory || !editName.trim()) return

    setIsSubmitting(true)
    try {
      await db.groceryCategories.update(editingCategory.id!, {
        name: editName.trim(),
        color: editColor
      })
      
      setEditingCategory(null)
      setEditName('')
      setEditColor('')
    } catch (error) {
      console.error('Error updating category:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const translateCategoryName = (categoryName: string) => {
    // Check if it's a default category that needs translation
    if (categoryName.startsWith('defaultCategories.')) {
      const key = categoryName.replace('defaultCategories.', '')
      const categoryMap: Record<string, string> = {
        'produce': tCategories('produce'),
        'dairy': tCategories('dairy'),
        'meatFish': tCategories('meatFish'),
        'bakery': tCategories('bakery'),
        'pantry': tCategories('pantry'),
        'frozen': tCategories('frozen'),
        'beverages': tCategories('beverages'),
        'snacks': tCategories('snacks'),
        'healthBeauty': tCategories('healthBeauty'),
        'household': tCategories('household')
      }
      
      return categoryMap[key] || categoryName
    }
    
    // For user-created categories, return as-is
    return categoryName
  }

  const handleDeleteCategory = async (categoryId: string, isDefault: boolean) => {
    if (isDefault) {
      alert(t('cannotDeleteDefault'))
      return
    }

    if (!confirm(t('confirmDelete'))) {
      return
    }

    try {
      await db.groceryCategories.delete(categoryId)
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const startEdit = (category: GroceryCategory) => {
    setEditingCategory(category)
    setEditName(category.name)
    setEditColor(category.color || PREDEFINED_COLORS[0])
  }

  const cancelEdit = () => {
    setEditingCategory(null)
    setEditName('')
    setEditColor('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Add New Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Plus className="mr-2 h-5 w-5" />
                {t('addNewCategory')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryName" className="text-base font-medium">
                    {t('categoryName')}
                  </Label>
                  <Input
                    id="categoryName"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={t('categoryNamePlaceholder')}
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    {t('color')}
                  </Label>
                  <div className="grid grid-cols-10 gap-2">
                    {PREDEFINED_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          selectedColor === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center mt-2">
                    <div 
                      className="w-4 h-4 rounded mr-2"
                      style={{ backgroundColor: selectedColor }}
                    />
                    <span className="text-sm text-gray-600">{t('selectedColor')}</span>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || !newCategoryName.trim()}
                  className="w-full h-12 text-base"
                >
                  {isSubmitting ? t('adding') : t('addCategory')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Palette className="mr-2 h-5 w-5" />
                {t('existingCategories')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                    {editingCategory?.id === category.id ? (
                      <div className="flex-1 flex items-center space-x-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                          placeholder="Category name"
                        />
                        <div className="flex space-x-1">
                          {PREDEFINED_COLORS.slice(0, 6).map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditColor(color)}
                              className={`w-6 h-6 rounded border ${
                                editColor === color ? 'border-gray-900 border-2' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={handleEditCategory} disabled={isSubmitting}>
                            {t('save')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            {t('cancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center flex-1">
                          <div 
                            className="w-4 h-4 rounded mr-3"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="font-medium">{translateCategoryName(category.name)}</span>
                          {category.isDefault && (
                            <Badge variant="secondary" className="ml-2">
                              {t('defaultCategory')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(category)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {!category.isDefault && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteCategory(category.id!, category.isDefault)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button 
            onClick={() => onOpenChange(false)}
            className="h-12 px-8 text-base"
          >
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}