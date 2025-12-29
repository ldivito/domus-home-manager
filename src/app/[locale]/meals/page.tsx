'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UtensilsCrossed, Plus, Settings2, Calendar, List, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, MealIngredient } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCalendarSettings } from '@/hooks/useCalendarSettings'
import { AddMealDialog } from './components/AddMealDialog'
import { ManageMealCategoriesDialog } from './components/ManageMealCategoriesDialog'
import { ManageSavedMealsDialog } from './components/ManageSavedMealsDialog'
import { MealDetailsDialog } from './components/MealDetailsDialog'
import { logger } from '@/lib/logger'

type ViewType = 'day' | 'week' | 'month'

export default function MealsPage() {
  const t = useTranslations('meals')
  const plannerT = useTranslations('planner')
  const { startOfWeek } = useCalendarSettings()
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>('week')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false)
  const [showSavedMealsDialog, setShowSavedMealsDialog] = useState(false)
  const [showMealDetailsDialog, setShowMealDetailsDialog] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<typeof meals[0] | null>(null)
  const [preSelectedDate, setPreSelectedDate] = useState<string | undefined>(undefined)
  const [preSelectedTemplate, setPreSelectedTemplate] = useState<{
    name: string
    description?: string
    category: string
    ingredients: MealIngredient[]
  } | undefined>(undefined)

  useEffect(() => {
    db.ensureMealIngredientStructure().catch((error) => {
      logger.error('Failed to ensure meal ingredient structure:', error)
    })
  }, [])

  const meals = useLiveQuery(
    () => db.meals.orderBy('date').toArray(),
    []
  ) || []


  const mealCategories = useLiveQuery(
    () => db.mealCategories.orderBy('name').toArray(),
    []
  ) || []

  const savedGroceryItems = useLiveQuery(
    () => db.savedGroceryItems.toArray(),
    []
  ) || []

  // Helper function to get ingredients for a meal
  const getMealIngredients = (meal: typeof meals[0]) => {
    if (!meal.ingredients) return []
    return meal.ingredients
      .map(ingredient => {
        const savedItem = savedGroceryItems.find(item => item.id === ingredient.savedGroceryItemId)
        if (!savedItem) return null
        return { savedItem, ingredient }
      })
      .filter(Boolean) as { savedItem: typeof savedGroceryItems[number]; ingredient: MealIngredient }[]
  }

  const mealTypeColors = {
    breakfast: 'bg-yellow-100 text-yellow-800',
    lunch: 'bg-blue-100 text-blue-800',
    dinner: 'bg-purple-100 text-purple-800',
    snack: 'bg-green-100 text-green-800'
  }


  const getDateRange = () => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)
    
    if (viewType === 'day') {
      // Set start to beginning of day and end to end of day
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    } else if (viewType === 'week') {
      const dayOfWeek = start.getDay() // 0 = Sunday, 1 = Monday, etc.
      let delta: number
      if (startOfWeek === 'monday') {
        // Monday start: Sunday (0) becomes 6, Monday (1) becomes 0
        delta = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      } else {
        // Sunday start: Sunday (0) becomes 0, Monday (1) becomes 1
        delta = dayOfWeek
      }
      start.setDate(start.getDate() - delta)
      start.setHours(0, 0, 0, 0)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    } else { // month
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }

  const getFilteredMeals = () => {
    const { start, end } = getDateRange()
    return meals.filter(meal => {
      const mealDate = new Date(meal.date)
      return mealDate >= start && mealDate <= end
    })
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    
    if (viewType === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else { // month
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    
    setCurrentDate(newDate)
  }

  const formatDateHeader = () => {
    const { start, end } = getDateRange()
    
    if (viewType === 'day') {
      return currentDate.toLocaleDateString()
    } else if (viewType === 'week') {
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
    } else { // month
      return currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })
    }
  }

  const handleAddIngredientsToGrocery = async (ingredients: MealIngredient[]) => {
    try {
      for (const ingredient of ingredients) {
        // Get the saved grocery item
        const savedItem = await db.savedGroceryItems.get(ingredient.savedGroceryItemId)
        if (!savedItem) continue

        // Add to current grocery list
        await db.groceryItems.add({
          name: savedItem.name,
          category: savedItem.category,
          amount: savedItem.amount || '',
          importance: savedItem.importance || 'medium',
          createdAt: new Date()
        })

        // Update usage stats in saved item
        if (savedItem.id) {
          await db.savedGroceryItems.update(savedItem.id, {
            timesUsed: savedItem.timesUsed + 1,
            lastUsed: new Date(),
            updatedAt: new Date()
          })
        }
      }
    } catch (error) {
      logger.error('Error adding ingredients to grocery list:', error)
    }
  }

  const filteredMeals = getFilteredMeals()


  const handleMealClick = (meal: typeof meals[0]) => {
    setSelectedMeal(meal)
    setShowMealDetailsDialog(true)
  }

  const handleAddMealForDate = (date: Date) => {
    // Create a local date string without timezone conversion issues
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}`
    setPreSelectedDate(dateString)
    setPreSelectedTemplate(undefined)
    setShowAddDialog(true)
  }

  const handleAddMealWithTemplate = (template: {
    name: string
    description?: string
    category: string
    ingredients: MealIngredient[]
  }, selectedDate?: string) => {
    setPreSelectedTemplate(template)
    setPreSelectedDate(selectedDate)
    setShowAddDialog(true)
  }

  const renderWeekView = () => {
    const { start } = getDateRange()
    const weekDays = []
    const today = new Date()

    // Create array of 7 days starting from start date
    for (let i = 0; i < 7; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      weekDays.push(day)
    }

    // Create day names array ordered by start of week
    const sundayFirstDayNames = [
      plannerT('days.short.sun'),
      plannerT('days.short.mon'),
      plannerT('days.short.tue'),
      plannerT('days.short.wed'),
      plannerT('days.short.thu'),
      plannerT('days.short.fri'),
      plannerT('days.short.sat')
    ]
    const dayNames = startOfWeek === 'monday'
      ? [...sundayFirstDayNames.slice(1), sundayFirstDayNames[0]] // Move Sunday to the end
      : sundayFirstDayNames

    // Full day names for mobile view
    const fullDayNames = startOfWeek === 'monday'
      ? [
          plannerT('days.full.mon'),
          plannerT('days.full.tue'),
          plannerT('days.full.wed'),
          plannerT('days.full.thu'),
          plannerT('days.full.fri'),
          plannerT('days.full.sat'),
          plannerT('days.full.sun')
        ]
      : [
          plannerT('days.full.sun'),
          plannerT('days.full.mon'),
          plannerT('days.full.tue'),
          plannerT('days.full.wed'),
          plannerT('days.full.thu'),
          plannerT('days.full.fri'),
          plannerT('days.full.sat')
        ]

    return (
      <div className="space-y-4">
        {/* Mobile Week View - Vertical List */}
        <div className="md:hidden space-y-3">
          {weekDays.map((day, index) => {
            const dayMeals = filteredMeals.filter(meal => {
              const mealDate = new Date(meal.date)
              return mealDate.toDateString() === day.toDateString()
            })
            const isToday = day.toDateString() === today.toDateString()

            return (
              <div
                key={index}
                className={`border rounded-lg overflow-hidden ${
                  isToday
                    ? 'border-blue-300 dark:border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900/50'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Day Header */}
                <div className={`flex items-center justify-between p-3 ${
                  isToday
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${
                      isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {day.getDate()}
                    </div>
                    <div>
                      <div className={`font-medium ${
                        isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {fullDayNames[index]}
                      </div>
                      {isToday && (
                        <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">Today</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddMealForDate(day)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isToday
                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    {t('addMeal')}
                  </button>
                </div>

                {/* Day Content */}
                <div className="p-3 bg-white dark:bg-gray-900">
                  {dayMeals.length === 0 ? (
                    <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-2">
                      {t('noMeals')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayMeals.map((meal) => (
                        <div
                          key={meal.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                          onClick={() => handleMealClick(meal)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {meal.title}
                            </div>
                            {meal.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {meal.description}
                              </p>
                            )}
                          </div>
                          <Badge className={`${mealTypeColors[meal.mealType as keyof typeof mealTypeColors]} ml-2 shrink-0`}>
                            {t(`mealTypes.${meal.mealType}`)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop Week View - Grid */}
        <div className="hidden md:block">
          {/* Week Header */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDays.map((day, index) => {
              const isToday = day.toDateString() === today.toDateString()
              return (
                <div key={`header-${index}`} className={`text-center p-2 rounded border ${
                  isToday
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  <div className="text-sm font-medium">{dayNames[index]}</div>
                  <div className="text-lg font-semibold">{day.getDate()}</div>
                </div>
              )
            })}
          </div>

          {/* Week Content */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, index) => {
              const dayMeals = filteredMeals.filter(meal => {
                const mealDate = new Date(meal.date)
                return mealDate.toDateString() === day.toDateString()
              })
              const isToday = day.toDateString() === today.toDateString()

              return (
                <div key={index} className={`border rounded-lg p-2 min-h-[280px] flex flex-col ${
                  isToday
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="flex-1 space-y-1 mb-2">
                    {dayMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="bg-white dark:bg-gray-700 rounded-lg p-2 text-xs border dark:border-gray-600 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => handleMealClick(meal)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm mb-1">
                              {meal.title}
                            </div>
                            <Badge className={`${mealTypeColors[meal.mealType as keyof typeof mealTypeColors]} text-xs py-0 px-2`}>
                              {t(`mealTypes.${meal.mealType}`)}
                            </Badge>
                          </div>
                          <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {dayMeals.length === 0 && (
                      <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-4">
                        <p>{t('noMeals')}</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleAddMealForDate(day)}
                    className={`w-full p-2 border-2 border-dashed rounded text-xs transition-colors ${
                      isToday
                        ? 'border-blue-300 dark:border-blue-600 hover:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Plus className="h-3 w-3 mx-auto mb-1" />
                    <span className="block">{t('addMeal')}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const today = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // Get first day of month and how many days in month
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // Calculate starting day of week based on start of week setting
    const dayOfWeek = firstDay.getDay() // 0 = Sunday, 1 = Monday, etc.
    let startingDayOfWeek: number
    if (startOfWeek === 'monday') {
      // Monday start: Sunday (0) becomes 6, Monday (1) becomes 0
      startingDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    } else {
      // Sunday start: Sunday (0) becomes 0, Monday (1) becomes 1
      startingDayOfWeek = dayOfWeek
    }

    const days = []

    // Create day names array ordered by start of week
    const sundayFirstDayNames = [
      plannerT('days.short.sun'),
      plannerT('days.short.mon'),
      plannerT('days.short.tue'),
      plannerT('days.short.wed'),
      plannerT('days.short.thu'),
      plannerT('days.short.fri'),
      plannerT('days.short.sat')
    ]
    const dayNames = startOfWeek === 'monday'
      ? [...sundayFirstDayNames.slice(1), sundayFirstDayNames[0]] // Move Sunday to the end
      : sundayFirstDayNames

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    // Get days with meals for mobile view (only show days that have meals or are today)
    const daysWithMeals = []
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dayMeals = filteredMeals.filter(meal => {
        const mealDate = new Date(meal.date)
        return mealDate.toDateString() === date.toDateString()
      })
      const isToday = date.toDateString() === today.toDateString()
      if (dayMeals.length > 0 || isToday) {
        daysWithMeals.push({ day, date, meals: dayMeals, isToday })
      }
    }

    return (
      <div className="space-y-4">
        {/* Mobile Month View - List of days with meals */}
        <div className="md:hidden space-y-3">
          {daysWithMeals.length === 0 ? (
            <div className="text-center py-8">
              <UtensilsCrossed className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">{t('noMealsThisMonth')}</p>
              <Button
                onClick={() => handleAddMealForDate(today)}
                className="mt-4"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('planMeal')}
              </Button>
            </div>
          ) : (
            daysWithMeals.map(({ day, date, meals: dayMeals, isToday }) => (
              <div
                key={day}
                className={`border rounded-lg overflow-hidden ${
                  isToday
                    ? 'border-blue-300 dark:border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900/50'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Day Header */}
                <div className={`flex items-center justify-between p-3 ${
                  isToday
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${
                      isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {day}
                    </div>
                    <div>
                      <div className={`font-medium ${
                        isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {date.toLocaleDateString('default', { weekday: 'long' })}
                      </div>
                      {isToday && (
                        <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">Today</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddMealForDate(date)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isToday
                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    {t('addMeal')}
                  </button>
                </div>

                {/* Day Content */}
                <div className="p-3 bg-white dark:bg-gray-900">
                  {dayMeals.length === 0 ? (
                    <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-2">
                      {t('noMeals')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayMeals.map((meal) => (
                        <div
                          key={meal.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                          onClick={() => handleMealClick(meal)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {meal.title}
                            </div>
                            {meal.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {meal.description}
                              </p>
                            )}
                          </div>
                          <Badge className={`${mealTypeColors[meal.mealType as keyof typeof mealTypeColors]} ml-2 shrink-0`}>
                            {t(`mealTypes.${meal.mealType}`)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Month View - Grid */}
        <div className="hidden md:block">
          {/* Month Header */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {dayNames.map(day => (
              <div key={day} className="text-center font-semibold text-gray-700 dark:text-gray-300 p-2 bg-gray-100 dark:bg-gray-700 rounded border dark:border-gray-600">
                {day}
              </div>
            ))}
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-2 auto-rows-min">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={index} className="h-32 bg-gray-50 dark:bg-gray-800 rounded opacity-50"></div>
              }

              const date = new Date(year, month, day)
              const dayMeals = filteredMeals.filter(meal => {
                const mealDate = new Date(meal.date)
                return mealDate.toDateString() === date.toDateString()
              })

              const isToday = date.toDateString() === today.toDateString()

              // Calculate minimum height based on content
              const baseHeight = 8 // Base height for day number and add button (2rem each)
              const mealHeight = dayMeals.length * 2.5 // Each meal ~2.5rem
              const minHeight = Math.max(8, baseHeight + mealHeight) // Minimum 8rem (h-32 equivalent)

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-2 flex flex-col ${
                    isToday
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}>
                  <div style={{ minHeight: `${minHeight}rem` }}>
                  {/* Day Number */}
                  <div className={`text-lg font-semibold mb-1 flex-shrink-0 ${
                    isToday ? 'text-blue-800 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {day}
                  </div>

                  {/* Meals */}
                  <div className="flex-1 space-y-1 mb-2">
                    {dayMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="text-xs bg-gradient-to-r from-white to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md px-2 py-1.5 border dark:border-gray-600 hover:shadow-sm transition-all cursor-pointer group"
                        onClick={() => handleMealClick(meal)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-xs mb-0.5">
                              {meal.title}
                            </div>
                            <div className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${mealTypeColors[meal.mealType as keyof typeof mealTypeColors]}`}>
                              {t(`mealTypes.${meal.mealType}`)}
                            </div>
                          </div>
                          <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Meal Button */}
                  <button
                    onClick={() => handleAddMealForDate(date)}
                    className={`w-full p-1 border-2 border-dashed rounded text-xs transition-colors flex-shrink-0 ${
                      isToday
                        ? 'border-blue-300 dark:border-blue-600 hover:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Plus className="h-3 w-3 mx-auto mb-1" />
                    <span className="block">{t('addMeal')}</span>
                  </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderDayView = () => {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Day Header with Add Meal Button */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-0.5 md:mb-1">
                {currentDate.toLocaleDateString('default', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {filteredMeals.length} {filteredMeals.length === 1 ? t('mealSingular') : t('mealPlural')} {t('planned')}
              </p>
            </div>
            <Button
              onClick={() => handleAddMealForDate(currentDate)}
              size="default"
              className="h-10 md:h-12 px-4 md:px-6 w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              {t('addMeal')}
            </Button>
          </div>
        </div>

        {/* Meals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {filteredMeals.length === 0 ? (
            <div className="col-span-full text-center py-8 md:py-12">
              <UtensilsCrossed className="h-12 w-12 md:h-16 md:w-16 mx-auto text-gray-300 mb-3 md:mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">{t('noMealsToday')}</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs md:text-sm mt-1 md:mt-2">{t('clickToAdd')}</p>
            </div>
          ) : (
            filteredMeals.map((meal) => (
            <Card
              key={meal.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleMealClick(meal)}
            >
              <CardHeader className="p-3 md:p-6 pb-2 md:pb-3">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base md:text-lg">{meal.title}</CardTitle>
                  <Badge className={`${mealTypeColors[meal.mealType as keyof typeof mealTypeColors]} shrink-0`}>
                    {t(`mealTypes.${meal.mealType}`)}
                  </Badge>
                </div>
                {meal.description && (
                  <CardDescription className="text-sm line-clamp-2">{meal.description}</CardDescription>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(meal.date).toLocaleDateString()}
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <div className="space-y-2 md:space-y-3">
                  {(() => {
                    const ingredients = getMealIngredients(meal)
                    return ingredients.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1.5 md:mb-2 text-xs md:text-sm">{t('ingredients')}:</h4>
                        <div className="flex flex-wrap gap-1">
                          {ingredients.slice(0, 5).map(({ savedItem, ingredient }, idx) => (
                            <span
                              key={`${savedItem.id}-${ingredient.id ?? idx}`}
                              className="px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs dark:text-gray-300"
                            >
                              {savedItem.name}
                              {ingredient.amount && ` (${ingredient.amount})`}
                            </span>
                          ))}
                          {ingredients.length > 5 && (
                            <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs dark:text-gray-300">
                              +{ingredients.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  {meal.ingredients && meal.ingredients.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 md:h-9 text-xs md:text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddIngredientsToGrocery(meal.ingredients!)
                      }}
                    >
                      <ShoppingCart className="mr-1.5 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                      {t('addToGrocery')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )))
        }
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 md:mb-2">
              {t('title')}
            </h1>
            <p className="text-base md:text-xl text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 md:flex gap-2 md:gap-4">
            <Button
              onClick={() => setShowSavedMealsDialog(true)}
              variant="outline"
              size="default"
              className="h-11 md:h-14 px-3 md:px-6 text-sm md:text-lg"
            >
              <List className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden sm:inline">{t('manageSaved')}</span>
              <span className="sm:hidden">{t('saved')}</span>
            </Button>

            <Button
              onClick={() => setShowCategoriesDialog(true)}
              variant="outline"
              size="default"
              className="h-11 md:h-14 px-3 md:px-6 text-sm md:text-lg"
            >
              <Settings2 className="mr-1.5 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden sm:inline">{t('manageCategories')}</span>
              <span className="sm:hidden">{t('categoriesShort')}</span>
            </Button>

            <Button
              onClick={() => setShowAddDialog(true)}
              size="default"
              className="h-11 md:h-14 px-4 md:px-8 text-sm md:text-lg col-span-2 md:col-span-1"
            >
              <Plus className="mr-1.5 md:mr-2 h-5 w-5 md:h-6 md:w-6" />
              {t('planMeal')}
            </Button>
          </div>
        </div>
        
        {/* Calendar Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6 p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Navigation and Date - Always visible and centered on mobile */}
          <div className="flex items-center justify-between sm:justify-start sm:order-2 sm:flex-1">
            <Button variant="outline" size="sm" onClick={() => navigateDate('prev')} className="h-9 w-9 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm md:text-lg font-medium min-w-[140px] md:min-w-[200px] text-center px-2">
              {formatDateHeader()}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigateDate('next')} className="h-9 w-9 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* View selector and meals count */}
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:order-1">
            <div className="flex items-center space-x-2">
              <label className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">{t('view')}:</label>
              <Select value={viewType} onValueChange={(value: ViewType) => setViewType(value)}>
                <SelectTrigger className="w-24 md:w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">{t('viewTypes.day')}</SelectItem>
                  <SelectItem value="week">{t('viewTypes.week')}</SelectItem>
                  <SelectItem value="month">{t('viewTypes.month')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 sm:order-3">
              {t('mealsTotal', { count: filteredMeals.length })}
            </div>
          </div>
        </div>

        {/* Meals Display */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center text-lg md:text-2xl">
              <Calendar className="mr-2 md:mr-3 h-5 w-5 md:h-8 md:w-8" />
              {t('plannedMeals')} - {t(`viewTypes.${viewType}`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {viewType === 'day' && renderDayView()}
            {viewType === 'week' && renderWeekView()}
            {viewType === 'month' && renderMonthView()}
          </CardContent>
        </Card>

        <AddMealDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onMealCreated={() => {/* Optional callback */}}
          preSelectedDate={preSelectedDate}
          preSelectedTemplate={preSelectedTemplate}
        />
        
        <ManageMealCategoriesDialog
          open={showCategoriesDialog}
          onOpenChange={setShowCategoriesDialog}
          categories={mealCategories}
        />
        
        <ManageSavedMealsDialog
          open={showSavedMealsDialog}
          onOpenChange={setShowSavedMealsDialog}
          categories={mealCategories}
          onAddMealWithTemplate={(template) => {
            setShowSavedMealsDialog(false)
            handleAddMealWithTemplate(template)
          }}
        />
        
        <MealDetailsDialog
          open={showMealDetailsDialog}
          onOpenChange={setShowMealDetailsDialog}
          meal={selectedMeal}
          onMealUpdated={() => {
            // Meals will refresh automatically via useLiveQuery
          }}
          onMealDeleted={() => {
            setShowMealDetailsDialog(false)
            setSelectedMeal(null)
          }}
        />
      </div>
    </div>
  )
}