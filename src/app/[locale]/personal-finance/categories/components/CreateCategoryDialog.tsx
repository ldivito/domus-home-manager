'use client'

import { useState } from 'react'
import { PersonalCategory, CategoryFormData, CategoryType } from '@/types/personal-finance'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus,
  TrendingUp,
  TrendingDown,
  Tag
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { validateCategory, generateCategoryId, generateWalletColor } from '@/lib/utils/finance'
import { db } from '@/lib/db'
import { useToast } from '@/hooks/use-toast'

const CATEGORY_ICONS = [
  { value: 'Tag', label: 'Tag' },
  { value: 'ShoppingBag', label: 'Shopping' },
  { value: 'Car', label: 'Transport' },
  { value: 'Home', label: 'Home' },
  { value: 'UtensilsCrossed', label: 'Food' },
  { value: 'Film', label: 'Entertainment' },
  { value: 'Heart', label: 'Health' },
  { value: 'GraduationCap', label: 'Education' },
  { value: 'Plane', label: 'Travel' },
  { value: 'Briefcase', label: 'Work' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Gamepad2', label: 'Gaming' },
  { value: 'Shirt', label: 'Clothing' },
  { value: 'Fuel', label: 'Fuel' },
  { value: 'Coffee', label: 'Cafe' },
  { value: 'Dumbbell', label: 'Fitness' },
  { value: 'Music', label: 'Music' },
  { value: 'Book', label: 'Books' },
  { value: 'Smartphone', label: 'Phone' },
  { value: 'Zap', label: 'Utilities' }
]

const PREDEFINED_COLORS = [
  '#ef4444', // Red - Food, Emergency
  '#f97316', // Orange - Transport, Travel
  '#f59e0b', // Amber - Bills, Utilities
  '#eab308', // Yellow - Entertainment
  '#84cc16', // Lime - Health, Fitness
  '#22c55e', // Green - Income, Savings
  '#10b981', // Emerald - Education, Work
  '#06b6d4', // Cyan - Shopping
  '#3b82f6', // Blue - Home, Rent
  '#6366f1', // Indigo - Technology
  '#8b5cf6', // Purple - Personal, Beauty
  '#ec4899', // Pink - Gifts, Fashion
  '#f43f5e', // Rose - Entertainment
  '#6b7280', // Gray - Other
]

// Form validation schema
const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(30, 'Name too long'),
  type: z.enum(['income', 'expense'] as const),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  icon: z.string(),
})

type FormData = z.infer<typeof categorySchema>

interface CreateCategoryDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCategoryCreated?: (category: PersonalCategory) => void
  defaultValues?: Partial<CategoryFormData>
  isEditing?: boolean
  category?: PersonalCategory
}

export function CreateCategoryDialog({
  trigger,
  open,
  onOpenChange,
  onCategoryCreated,
  defaultValues,
  isEditing = false,
  category
}: CreateCategoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: 'expense',
      color: generateWalletColor('physical'),
      icon: 'Tag',
      ...defaultValues,
    },
  })

  const selectedType = form.watch('type')
  const selectedColor = form.watch('color')

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }
    
    if (!newOpen) {
      form.reset()
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    
    try {
      // Get current user (in a real app, this would come from auth)
      const userId = 'usr_5ad61fe0-39eb-4097-8a92-94922d0b828a' // TODO: Get from auth context
      
      // Validate the category data
      const validation = validateCategory(data)
      
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0]?.[0] || 'Validation failed'
        toast({
          title: 'Validation Error',
          description: firstError,
          variant: 'destructive',
        })
        return
      }

      // Check for duplicate names within the same type
      const existingCategory = await db.personalCategories
        .where(['userId', 'type', 'name'])
        .equals([userId, data.type, data.name])
        .and(cat => cat.isActive && (!isEditing || cat.id !== defaultValues?.name))
        .first()

      if (existingCategory) {
        toast({
          title: 'Duplicate Category',
          description: `A ${data.type} category with this name already exists.`,
          variant: 'destructive',
        })
        return
      }

      if (isEditing && category) {
        // Update existing category
        const updatedCategory: PersonalCategory = {
          id: category.id,
          userId: category.userId,
          name: data.name,
          type: data.type,
          color: data.color,
          icon: data.icon,
          isActive: category.isActive,
          isDefault: category.isDefault,
          createdAt: category.createdAt,
          updatedAt: new Date(),
        }

        onCategoryCreated?.(updatedCategory)
      } else {
        // Create new category
        const categoryData: PersonalCategory = {
          id: generateCategoryId(),
          userId,
          name: data.name,
          type: data.type,
          color: data.color,
          icon: data.icon,
          isActive: true,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        // Save to database
        await db.personalCategories.add(categoryData)
        onCategoryCreated?.(categoryData)
      }

      toast({
        title: isEditing ? 'Category Updated' : 'Category Created',
        description: `${data.name} has been ${isEditing ? 'updated' : 'created'} successfully.`,
      })

      handleOpenChange(false)
      form.reset()

    } catch (error) {
      console.error('Error saving category:', error)
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} category. Please try again.`,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getCategoryTypeIcon = (type: CategoryType) => {
    return type === 'income' ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  }

  const getCategoryTypeColor = (type: CategoryType) => {
    return type === 'income' ? 'text-green-600' : 'text-red-600'
  }

  return (
    <Dialog open={open ?? isOpen} onOpenChange={handleOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Category' : 'Create New Category'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the category details below.'
              : 'Create a new category to organize your transactions.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. Groceries, Salary, Rent"
                          maxLength={30}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="expense">
                            <div className="flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-red-600" />
                              Expense
                            </div>
                          </SelectItem>
                          <SelectItem value="income">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              Income
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Appearance */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Appearance</h4>
                
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex gap-2 flex-wrap">
                            {PREDEFINED_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-7 h-7 rounded-full border-2 transition-all ${
                                  selectedColor === color 
                                    ? 'border-gray-900 scale-110' 
                                    : 'border-gray-300 hover:scale-105'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => field.onChange(color)}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="w-12 h-8 p-1 border rounded"
                              {...field}
                            />
                            <Input
                              type="text"
                              placeholder="#ef4444"
                              className="flex-1"
                              {...field}
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px]">
                          {CATEGORY_ICONS.map((icon) => (
                            <SelectItem key={icon.value} value={icon.value}>
                              {icon.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Preview */}
              <div className="p-4 border rounded-lg bg-gray-50">
                <h4 className="text-sm font-medium mb-3">Preview</h4>
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ 
                      backgroundColor: `${selectedColor}20`, 
                      color: selectedColor 
                    }}
                  >
                    <Tag className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {form.watch('name') || 'Category Name'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getCategoryTypeColor(selectedType)}`}
                        style={{ 
                          borderColor: selectedColor,
                          color: selectedColor 
                        }}
                      >
                        {getCategoryTypeIcon(selectedType)}
                        {selectedType === 'income' ? 'Income' : 'Expense'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading 
                  ? (isEditing ? 'Updating...' : 'Creating...') 
                  : (isEditing ? 'Update Category' : 'Create Category')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}