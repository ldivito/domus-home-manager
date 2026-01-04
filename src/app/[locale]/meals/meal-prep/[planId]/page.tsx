'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChefHat,
  Calendar,
  Users,
  ShoppingCart,
  Package,
  Clock,
  Thermometer,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Utensils,
  Layers,
  Lightbulb,
  CheckCircle2,
  Beef,
  Wheat,
  Salad
} from 'lucide-react'
import { db } from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { useLocale } from 'next-intl'

export default function MealPrepPlanDetailPage() {
  const t = useTranslations('mealPrep')
  const tMeals = useTranslations('meals')
  const router = useRouter()
  const params = useParams()
  const planId = params.planId as string
  const locale = useLocale()
  const dateLocale = locale === 'es' ? es : enUS

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Fetch plan data
  const plan = useLiveQuery(
    () => db.mealPrepPlans.get(planId),
    [planId]
  )

  const planItems = useLiveQuery(
    () => db.mealPrepItems.where('mealPrepPlanId').equals(planId).toArray(),
    [planId]
  ) || []

  const planIngredients = useLiveQuery(
    () => db.mealPrepIngredients.where('mealPrepPlanId').equals(planId).toArray(),
    [planId]
  ) || []

  const planComponents = useLiveQuery(
    () => db.mealPrepComponents.where('mealPrepPlanId').equals(planId).toArray(),
    [planId]
  ) || []

  const planCombinations = useLiveQuery(
    () => db.mealPrepCombinations.where('mealPrepPlanId').equals(planId).toArray(),
    [planId]
  ) || []

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  if (!plan) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">{t('savedPlans.noPlans')}</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('back')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate container summary
  const containerSummary = {
    small: 0,
    medium: 0,
    large: 0,
    'extra-large': 0
  }

  const items = plan.useComponents ? planComponents : planItems
  items.forEach(item => {
    const size = item.containerSize || 'medium'
    const count = item.containerCount || 1
    containerSummary[size as keyof typeof containerSummary] += count
  })

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back')}
        </Button>
        <Badge variant={
          plan.status === 'completed' ? 'default' :
          plan.status === 'cooking' ? 'destructive' :
          plan.status === 'shopping' ? 'secondary' : 'outline'
        }>
          {t(`savedPlans.statusLabels.${plan.status}`)}
        </Badge>
      </div>

      {/* Plan Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <ChefHat className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-500 mb-1" />
              <p className="text-sm text-gray-500">{t('savedPlans.cookingDate')}</p>
              <p className="font-medium">{format(new Date(plan.cookingDate), 'PPP', { locale: dateLocale })}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Users className="h-5 w-5 text-gray-500 mb-1" />
              <p className="text-sm text-gray-500">{t('setup.numberOfPeople')}</p>
              <p className="font-medium">{plan.servingsPerMeal}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Utensils className="h-5 w-5 text-gray-500 mb-1" />
              <p className="text-sm text-gray-500">{t('meals.title')}</p>
              <p className="font-medium">{plan.numberOfMeals}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Clock className="h-5 w-5 text-gray-500 mb-1" />
              <p className="text-sm text-gray-500">{t('savedPlans.dateRange')}</p>
              <p className="font-medium text-sm">
                {format(new Date(plan.startDate), 'MMM d', { locale: dateLocale })} - {format(new Date(plan.endDate), 'MMM d', { locale: dateLocale })}
              </p>
            </div>
          </div>

          {/* Dietary Restrictions */}
          {plan.dietaryRestrictions && plan.dietaryRestrictions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">{t('setup.dietaryRestrictions')}</p>
              <div className="flex flex-wrap gap-2">
                {plan.dietaryRestrictions.map(diet => (
                  <Badge key={diet} variant="outline">{t(`dietaryRestrictions.${diet}`)}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="ingredients" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="ingredients">
            <ShoppingCart className="h-4 w-4 mr-2" />
            {t('review.ingredients')}
          </TabsTrigger>
          <TabsTrigger value="meals">
            <Utensils className="h-4 w-4 mr-2" />
            {plan.useComponents ? t('components.combinations') : t('meals.title')}
          </TabsTrigger>
          <TabsTrigger value="instructions">
            <Layers className="h-4 w-4 mr-2" />
            {t('prep.instructions')}
          </TabsTrigger>
          <TabsTrigger value="storage">
            <Package className="h-4 w-4 mr-2" />
            {t('prep.storage')}
          </TabsTrigger>
        </TabsList>

        {/* Ingredients Tab */}
        <TabsContent value="ingredients">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('review.ingredients')}</CardTitle>
              <CardDescription>
                {planIngredients.length} {t('savedPlans.ingredients')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {planIngredients.map((ing, idx) => (
                    <div
                      key={ing.id || idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{ing.name}</p>
                        {ing.category && (
                          <p className="text-sm text-gray-500">{ing.category}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{ing.amount} {ing.unit}</p>
                        {ing.addedToGroceryList && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {t('review.allAdded')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {planIngredients.length === 0 && (
                    <p className="text-center text-gray-500 py-8">{t('meals.noSavedMeals')}</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meals / Combinations Tab */}
        <TabsContent value="meals">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {plan.useComponents ? t('components.combinations') : t('meals.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {plan.useComponents ? (
                  /* Component Combinations */
                  <div className="space-y-3">
                    {planCombinations.map((combo, idx) => {
                      // Lookup component names from their IDs
                      const proteinComp = planComponents.find(c => c.id === combo.proteinComponentId)
                      const carbComp = planComponents.find(c => c.id === combo.carbComponentId)
                      const vegComp = planComponents.find(c => c.id === combo.vegetableComponentId)

                      return (
                        <div
                          key={combo.id || idx}
                          className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/20"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary">
                              Day {combo.dayIndex + 1} - {tMeals(`mealTypes.${combo.mealType}`)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {proteinComp && (
                              <div className="flex items-center gap-2 text-sm">
                                <Beef className="h-4 w-4 text-red-500" />
                                <span>{proteinComp.name}</span>
                              </div>
                            )}
                            {carbComp && (
                              <div className="flex items-center gap-2 text-sm">
                                <Wheat className="h-4 w-4 text-amber-500" />
                                <span>{carbComp.name}</span>
                              </div>
                            )}
                            {vegComp && (
                              <div className="flex items-center gap-2 text-sm">
                                <Salad className="h-4 w-4 text-green-500" />
                                <span>{vegComp.name}</span>
                              </div>
                            )}
                          </div>
                          {combo.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{combo.description}</p>
                          )}
                        </div>
                      )
                    })}
                    {planCombinations.length === 0 && (
                      <p className="text-center text-gray-500 py-8">{t('components.noComponents')}</p>
                    )}
                  </div>
                ) : (
                  /* Regular Meals */
                  <div className="space-y-3">
                    {planItems.map((item, idx) => (
                      <div key={item.id || idx} className="border rounded-lg">
                        <button
                          className="w-full p-4 flex items-center justify-between text-left"
                          onClick={() => toggleItem(item.id || String(idx))}
                        >
                          <div>
                            <p className="font-medium">{item.mealName}</p>
                            <p className="text-sm text-gray-500">
                              {item.quantity} {t('review.servings')}
                              {item.mealTypes && ` • ${item.mealTypes.map(type => tMeals(`mealTypes.${type}`)).join(', ')}`}
                            </p>
                          </div>
                          {expandedItems.has(item.id || String(idx)) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                        {expandedItems.has(item.id || String(idx)) && (
                          <div className="p-4 pt-0 border-t">
                            {item.mealDescription && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{item.mealDescription}</p>
                            )}
                            {item.assignedDays && item.assignedDays.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm font-medium mb-1">{t('review.assignedDays')}</p>
                                <div className="flex flex-wrap gap-2">
                                  {item.assignedDays.map((day, i) => (
                                    <Badge key={i} variant="outline">
                                      {format(new Date(day), 'EEE, MMM d', { locale: dateLocale })}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {item.prepInstructions && (
                              <div>
                                <p className="text-sm font-medium mb-1">{t('prep.instructions')}</p>
                                <p className="text-sm whitespace-pre-wrap">{item.prepInstructions}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructions Tab */}
        <TabsContent value="instructions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('prep.instructions')}</CardTitle>
              <CardDescription>{t('prep.orderDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {(plan.useComponents ? planComponents : planItems).map((item, idx) => (
                    <div key={item.id || idx} className="border rounded-lg">
                      <button
                        className="w-full p-4 flex items-center justify-between text-left"
                        onClick={() => toggleItem(`instr-${item.id || String(idx)}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium">
                              {plan.useComponents ? (item as typeof planComponents[0]).name : (item as typeof planItems[0]).mealName}
                            </p>
                            {item.cookingTime && (
                              <p className="text-sm text-gray-500">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {item.cookingTime} {t('prep.minutes')}
                              </p>
                            )}
                          </div>
                        </div>
                        {expandedItems.has(`instr-${item.id || String(idx)}`) ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                      {expandedItems.has(`instr-${item.id || String(idx)}`) && (
                        <div className="p-4 pt-0 border-t space-y-3">
                          {item.prepInstructions && (
                            <div>
                              <p className="text-sm font-medium mb-1">{t('prep.steps')}</p>
                              <p className="text-sm whitespace-pre-wrap">{item.prepInstructions}</p>
                            </div>
                          )}
                          {item.reheatingInstructions && (
                            <div>
                              <p className="text-sm font-medium mb-1">{t('prep.reheating')}</p>
                              <p className="text-sm">{item.reheatingInstructions}</p>
                            </div>
                          )}
                          {(item as typeof planComponents[0]).nutritionEstimate && (
                            <div className="grid grid-cols-4 gap-2 text-center mt-3">
                              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                <p className="text-xs text-gray-500">{t('prep.calories')}</p>
                                <p className="font-medium">{(item as typeof planComponents[0]).nutritionEstimate?.calories}</p>
                              </div>
                              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                <p className="text-xs text-gray-500">{t('prep.protein')}</p>
                                <p className="font-medium">{(item as typeof planComponents[0]).nutritionEstimate?.protein}g</p>
                              </div>
                              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                <p className="text-xs text-gray-500">{t('prep.carbs')}</p>
                                <p className="font-medium">{(item as typeof planComponents[0]).nutritionEstimate?.carbs}g</p>
                              </div>
                              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                <p className="text-xs text-gray-500">{t('prep.fat')}</p>
                                <p className="font-medium">{(item as typeof planComponents[0]).nutritionEstimate?.fat}g</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('prep.storage')}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Container Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {(['small', 'medium', 'large', 'extra-large'] as const).map(size => {
                  const count = containerSummary[size]
                  return count > 0 ? (
                    <div key={size} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
                      <Package className="h-6 w-6 mx-auto text-gray-500 mb-1" />
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-gray-500">{t(`prep.container.${size}`)}</p>
                    </div>
                  ) : null
                })}
              </div>

              {/* Storage Details */}
              <ScrollArea className="h-72">
                <div className="space-y-3">
                  {(plan.useComponents ? planComponents : planItems).map((item, idx) => (
                    <div key={item.id || idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">
                          {plan.useComponents ? (item as typeof planComponents[0]).name : (item as typeof planItems[0]).mealName}
                        </p>
                        {item.storageType && (
                          <div className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4" />
                            <Badge variant={
                              item.storageType === 'freezer' ? 'destructive' :
                              item.storageType === 'refrigerator' ? 'default' : 'secondary'
                            }>
                              {t(`prep.storageType.${item.storageType}`)}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {item.storageDays && (
                          <div>
                            <p className="text-gray-500">{t('prep.storageDuration')}</p>
                            <p className="font-medium">{t('prep.days', { count: item.storageDays })}</p>
                          </div>
                        )}
                        {item.containerCount && item.containerSize && (
                          <div>
                            <p className="text-gray-500">{t('prep.containers')}</p>
                            <p className="font-medium">
                              {item.containerCount} x {t(`prep.container.${item.containerSize}`)}
                            </p>
                          </div>
                        )}
                      </div>

                      {item.storageInstructions && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                          <Lightbulb className="h-4 w-4 inline mr-1 text-blue-600" />
                          {item.storageInstructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
