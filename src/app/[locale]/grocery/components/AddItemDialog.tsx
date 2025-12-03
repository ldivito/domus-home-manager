'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import { db, GroceryCategory, SavedGroceryItem, GroceryItem } from '@/lib/db'
import { generateId } from '@/lib/utils'

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: GroceryCategory[]
}

export function AddItemDialog({ open, onOpenChange, categories }: AddItemDialogProps) {
  const t = useTranslations('grocery.addItemDialog')
  const tImportance = useTranslations('grocery.importance')
  const tCategories = useTranslations('grocery.defaultCategories')
  const locale = useLocale()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [importance, setImportance] = useState<'low' | 'medium' | 'high'>('medium')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !category.trim() || !amount.trim()) return

    setIsSubmitting(true)
    
    try {
      let finalCategory = category

      // If adding a new category, create it first
      if (category === '_new_category' && newCategoryName.trim()) {
        const categoryColors = [
          '#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', 
          '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'
        ]
        const randomColor = categoryColors[Math.floor(Math.random() * categoryColors.length)]
        
        await db.groceryCategories.add({
          id: generateId('gcat'),
          name: newCategoryName.trim(),
          color: randomColor,
          isDefault: false,
          locale: locale,
          createdAt: new Date()
        })
        
        finalCategory = newCategoryName.trim()
      }

      // Add to current grocery list
      const grocery: GroceryItem = {
        id: generateId('gri'),
        name: name.trim(),
        category: finalCategory,
        amount: amount.trim(),
        importance,
        createdAt: new Date()
      }
      await db.groceryItems.add(grocery)

      // Also add or update in saved grocery items database
      const existingItem = await db.savedGroceryItems
        .where('name')
        .equalsIgnoreCase(name.trim())
        .and(item => item.category === finalCategory)
        .first()

      if (existingItem) {
        // Update existing item
        await db.savedGroceryItems.update(existingItem.id!, {
          amount: amount.trim(),
          importance,
          timesUsed: existingItem.timesUsed + 1,
          lastUsed: new Date(),
          updatedAt: new Date()
        })
      } else {
        // Create new saved item
        const saved: SavedGroceryItem = {
          id: generateId('sgi'),
          name: name.trim(),
          category: finalCategory,
          amount: amount.trim(),
          importance,
          timesUsed: 1,
          lastUsed: new Date(),
          createdAt: new Date()
        }
        await db.savedGroceryItems.add(saved)
      }

      // Reset form
      setName('')
      setCategory('')
      setAmount('')
      setImportance('medium')
      setNewCategoryName('')
      setShowNewCategoryInput(false)
      onOpenChange(false)
    } catch (error) {
      console.error('Error adding item:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCategoryChange = (value: string) => {
    setCategory(value)
    setShowNewCategoryInput(value === '_new_category')
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

  const getImportanceBadge = (imp: string) => {
    const variants = {
      high: { variant: 'destructive' as const, text: tImportance('high') },
      medium: { variant: 'default' as const, text: tImportance('medium') },
      low: { variant: 'secondary' as const, text: tImportance('low') }
    }
    return variants[imp as keyof typeof variants] || variants.medium
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-medium">
              {t('itemName')} *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('itemNamePlaceholder')}
              className="h-12 text-base"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-base font-medium">
              {t('category')} *
            </Label>
            <Select value={category} onValueChange={handleCategoryChange} required>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={t('categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: cat.color }}
                      />
                      {translateCategoryName(cat.name)}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="_new_category">
                  <div className="flex items-center">
                    <Plus className="w-3 h-3 mr-2" />
                    {t('newCategory')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {showNewCategoryInput && (
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('newCategoryPlaceholder')}
                className="h-12 text-base mt-2"
                required
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-base font-medium">
              {t('amount')} *
            </Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('amountPlaceholder')}
              className="h-12 text-base"
              required
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">
              {t('importanceLabel')}
            </Label>
            <div className="flex space-x-2">
              {(['low', 'medium', 'high'] as const).map((imp) => {
                const badge = getImportanceBadge(imp)
                return (
                  <button
                    key={imp}
                    type="button"
                    onClick={() => setImportance(imp)}
                    className={`px-4 py-2 rounded-lg border transition-all ${
                      importance === imp 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter className="flex space-x-3 pt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 text-base"
            >
              {t('cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !name.trim() || !category.trim() || !amount.trim()}
              className="flex-1 h-12 text-base"
            >
              {isSubmitting ? t('adding') : t('addItem')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}