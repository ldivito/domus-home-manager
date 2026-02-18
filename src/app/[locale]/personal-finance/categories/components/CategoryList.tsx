'use client'

import { PersonalCategory } from '@/types/personal-finance'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  MoreHorizontal, 
  Pencil,
  Trash2,
  Tag,
  Crown
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { CreateCategoryDialog } from './CreateCategoryDialog'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface CategoryListProps {
  categories: PersonalCategory[]
  onEdit: (categoryId: string, data: Partial<PersonalCategory>) => void
  onDelete: (categoryId: string) => void
  emptyMessage?: string
  emptyDescription?: string
}

export function CategoryList({
  categories,
  onEdit,
  onDelete,
  emptyMessage,
  emptyDescription
}: CategoryListProps) {
  const t = useTranslations('personalFinance')
  const [editingCategory, setEditingCategory] = useState<PersonalCategory | null>(null)

  const resolvedEmptyMessage = emptyMessage ?? t('categories.noExpenseCategories')
  const resolvedEmptyDescription = emptyDescription ?? t('categories.noExpenseCategoriesDesc')

  const handleEditClick = (category: PersonalCategory) => {
    setEditingCategory(category)
  }

  const handleCategoryUpdated = (updatedCategory: PersonalCategory) => {
    if (editingCategory?.id) {
      onEdit(editingCategory.id, updatedCategory)
    }
    setEditingCategory(null)
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{resolvedEmptyMessage}</h3>
          <p className="text-muted-foreground">
            {resolvedEmptyDescription}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        {categories.map((category) => (
          <Card key={category.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Color indicator and icon */}
                  <div 
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{ 
                      backgroundColor: `${category.color}20`, 
                      color: category.color 
                    }}
                  >
                    <Tag className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">
                        {category.name}
                      </h3>
                      {category.isDefault && (
                        <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="outline" 
                        style={{ 
                          borderColor: category.color,
                          color: category.color 
                        }}
                        className="text-xs"
                      >
                        {category.type === 'income' 
                          ? t('categories.card.income') 
                          : t('categories.card.expense')
                        }
                      </Badge>
                      {category.isDefault && (
                        <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-800">
                          {t('categories.card.systemDefault')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Color preview */}
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                    title={`Color: ${category.color}`}
                  />
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleEditClick(category)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t('categories.card.editCategory')}
                      </DropdownMenuItem>
                      {!category.isDefault && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => onDelete(category.id!)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('categories.card.deleteCategory')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <CreateCategoryDialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        onCategoryCreated={handleCategoryUpdated}
        defaultValues={editingCategory ? {
          name: editingCategory.name,
          type: editingCategory.type,
          color: editingCategory.color,
          icon: editingCategory.icon,
        } : undefined}
        isEditing={true}
      />
    </>
  )
}
