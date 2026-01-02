'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  ChefHat,
  Calendar,
  Users,
  ShoppingCart,
  UtensilsCrossed,
  Package,
  Clock,
  Thermometer,
  AlertCircle,
  Check,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Download,
  Loader2,
  Settings,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  SkipForward,
  Timer,
  Copy,
  AlertTriangle,
  Utensils,
  Layers,
  Bookmark,
  BookmarkPlus,
  CircleCheckBig,
  Beef,
  Wheat,
  Salad
} from "lucide-react"
import {
  db,
  SavedMeal,
  MealIngredient,
  MealPrepPlan,
  MealPrepItem,
  MealPrepIngredient,
  DietaryRestriction,
  PrepStepStatus,
  MealComponentType
} from '@/lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { generateId } from '@/lib/utils'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

type WizardStep = 'setup' | 'meals' | 'calculate' | 'review' | 'prep'

// All dietary restrictions available
const ALL_DIETARY_RESTRICTIONS: DietaryRestriction[] = [
  'vegetarian', 'vegan', 'keto', 'low-carb', 'paleo',
  'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher',
  'low-sodium', 'low-fat', 'high-protein', 'pescatarian'
]

interface SelectedMeal {
  id: string
  name: string
  description?: string
  category?: string
  servings: number
  ingredients: MealIngredient[]
  isCustom?: boolean
  assignedDays: string[]
  mealTypes: ('breakfast' | 'lunch' | 'dinner' | 'snack')[]
}

interface CalculatedIngredient {
  name: string
  category: string
  amount: string
  unit: string
  originalAmount: string
  isConsolidated: boolean
  addedToGrocery: boolean
}

interface MealInstruction {
  mealName: string
  prepTime: number
  cookTime: number
  totalTime: number
  instructions: string
  tips: string
  storageType: 'refrigerator' | 'freezer' | 'pantry'
  storageDays: number
  storageInstructions: string
  reheatingInstructions: string
  containerSize: string
  containerCount: number
  nutritionEstimate?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

interface ContainerPlan {
  mealName: string
  containerSize: string
  containerCount: number
  portionSize: string
  labelSuggestion: string
}

interface SmartScheduleData {
  optimizedOrder: string[]
  parallelTasks?: { group: number; meals: string[]; reason: string }[]
  equipmentNeeded?: string[]
  timelineSteps?: { time: string; action: string; meal: string }[]
  totalEstimatedTime: number
  efficiencyTips: string[]
}

interface PrepStep {
  id: string
  mealName: string
  stepNumber: number
  instruction: string
  estimatedTime?: number
  status: PrepStepStatus
  startedAt?: Date
  completedAt?: Date
}

interface TrackedContainer {
  id: string
  mealName: string
  containerNumber: number
  label: string
  storageType: 'refrigerator' | 'freezer' | 'pantry'
  storedAt: Date
  expiresAt: Date
  isConsumed: boolean
  isExpired: boolean
}

// Component-based meal prep interfaces
interface SelectedComponent {
  id: string
  name: string
  type: MealComponentType
  servings: number
  description?: string
  isCustom?: boolean
}

interface ComponentCombination {
  day: number
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  protein?: string
  carb?: string
  vegetable?: string
  description?: string
}

export default function MealPrepPage() {
  const t = useTranslations('mealPrep')
  const tMeals = useTranslations('meals')
  const router = useRouter()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('setup')
  const [isCalculating, setIsCalculating] = useState(false)

  // Setup state
  const [planName, setPlanName] = useState('')
  const [cookingDate, setCookingDate] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [numberOfPeople, setNumberOfPeople] = useState(2)
  const [openAIKey, setOpenAIKey] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)

  // Meals state
  const [selectedMeals, setSelectedMeals] = useState<SelectedMeal[]>([])
  const [customMealName, setCustomMealName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Component-based mode state
  const [useComponentMode, setUseComponentMode] = useState(false)
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([])
  const [componentCombinations, setComponentCombinations] = useState<ComponentCombination[]>([])
  const [customComponentName, setCustomComponentName] = useState('')
  const [activeComponentType, setActiveComponentType] = useState<MealComponentType>('protein')
  const [mealsPerDay, setMealsPerDay] = useState(2) // Number of main meals per day (lunch + dinner)

  // Calculated results state
  const [calculatedIngredients, setCalculatedIngredients] = useState<CalculatedIngredient[]>([])
  const [mealInstructions, setMealInstructions] = useState<MealInstruction[]>([])
  const [prepOrder, setPrepOrder] = useState<string[]>([])
  const [generalTips, setGeneralTips] = useState<string[]>([])
  const [containerPlan, setContainerPlan] = useState<ContainerPlan[]>([])
  const [organizationTips, setOrganizationTips] = useState<string[]>([])

  // Expanded sections in prep view
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set())

  // Saved plan ID (for editing)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null)

  // Dietary restrictions
  const [dietaryRestrictions, setDietaryRestrictions] = useState<DietaryRestriction[]>([])

  // Templates
  const [showTemplates, setShowTemplates] = useState(false)

  // Smart scheduling data
  const [smartSchedule, setSmartSchedule] = useState<SmartScheduleData | null>(null)

  // Timer/Checklist mode
  const [isTimerMode, setIsTimerMode] = useState(false)
  const [prepSteps, setPrepSteps] = useState<PrepStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Portion tracking
  const [trackedContainers, setTrackedContainers] = useState<TrackedContainer[]>([])
  const [showPortionTracking, setShowPortionTracking] = useState(false)

  // Load saved meals and grocery items
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

  // Load saved templates (meal prep plans marked as templates)
  const savedTemplates = useLiveQuery(
    () => db.mealPrepPlans.filter(p => p.isTemplate === true).toArray(),
    []
  ) || []

  // Load meal prep items for templates
  const templateItems = useLiveQuery(
    async () => {
      const templates = await db.mealPrepPlans.filter(p => p.isTemplate === true).toArray()
      const templateIds = templates.map(t => t.id).filter(Boolean) as string[]
      if (templateIds.length === 0) return []
      return db.mealPrepItems.filter(i => templateIds.includes(i.mealPrepPlanId)).toArray()
    },
    []
  ) || []

  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('openai_api_key')
      if (savedKey) {
        setOpenAIKey(savedKey)
      }
    }
  }, [])

  // Set default dates
  useEffect(() => {
    const today = new Date()
    const nextSunday = new Date(today)
    nextSunday.setDate(today.getDate() + (7 - today.getDay()))

    // Default cooking date is next Sunday
    setCookingDate(nextSunday.toISOString().split('T')[0])

    // Start date is the day after cooking
    const start = new Date(nextSunday)
    start.setDate(start.getDate() + 1)
    setStartDate(start.toISOString().split('T')[0])

    // End date is 6 days after start (full week)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    setEndDate(end.toISOString().split('T')[0])

    // Default plan name
    setPlanName(t('defaultPlanName', { date: nextSunday.toLocaleDateString() }))
  }, [t])

  // Calculate number of days
  const daysOfPrep = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 7

  // Timer effect for prep mode
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning])

  // Format time display (seconds to MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Toggle dietary restriction
  const toggleDietaryRestriction = (restriction: DietaryRestriction) => {
    setDietaryRestrictions(prev =>
      prev.includes(restriction)
        ? prev.filter(r => r !== restriction)
        : [...prev, restriction]
    )
  }

  // Load template
  const loadTemplate = async (template: MealPrepPlan) => {
    const items = templateItems.filter(i => i.mealPrepPlanId === template.id)

    // Set dietary restrictions from template
    if (template.dietaryRestrictions) {
      setDietaryRestrictions(template.dietaryRestrictions)
    }

    // Load meals from template
    const loadedMeals: SelectedMeal[] = []
    for (const item of items) {
      const savedMeal = item.savedMealId
        ? await db.savedMeals.get(item.savedMealId)
        : null

      loadedMeals.push({
        id: item.savedMealId || generateId('custom'),
        name: item.mealName,
        description: item.mealDescription,
        category: item.category,
        servings: item.quantity,
        ingredients: savedMeal?.ingredients || [],
        isCustom: !item.savedMealId,
        assignedDays: item.assignedDays || [],
        mealTypes: item.mealTypes || ['dinner']
      })
    }

    setSelectedMeals(loadedMeals)
    setPlanName(`${template.templateName || template.name} - ${new Date().toLocaleDateString()}`)
    setShowTemplates(false)
    toast.success(t('notifications.templateLoaded'))
  }

  // Save current plan as template
  const saveAsTemplate = async () => {
    if (!planName) {
      toast.error(t('errors.templateNameRequired'))
      return
    }

    try {
      const now = new Date()
      const templateId = generateId('mpp')

      const template: MealPrepPlan = {
        id: templateId,
        name: planName,
        templateName: planName,
        cookingDate: new Date(cookingDate),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        servingsPerMeal: numberOfPeople,
        numberOfMeals: selectedMeals.length,
        status: 'planning',
        dietaryRestrictions,
        isTemplate: true,
        createdAt: now,
        updatedAt: now
      }

      await db.mealPrepPlans.add(template)

      // Save template items
      for (const meal of selectedMeals) {
        await db.mealPrepItems.add({
          id: generateId('mpi'),
          mealPrepPlanId: templateId,
          savedMealId: meal.isCustom ? undefined : meal.id,
          mealName: meal.name,
          mealDescription: meal.description,
          category: meal.category,
          quantity: meal.servings,
          assignedDays: meal.assignedDays,
          mealTypes: meal.mealTypes,
          createdAt: now,
          updatedAt: now
        })
      }

      toast.success(t('notifications.templateSaved'))
    } catch (error) {
      logger.error('Error saving template:', error)
      toast.error(t('errors.templateSaveFailed'))
    }
  }

  // Timer controls
  const startTimer = () => {
    if (!sessionStartTime) {
      setSessionStartTime(new Date())
    }
    setTimerRunning(true)
  }

  const pauseTimer = () => {
    setTimerRunning(false)
  }

  const resetTimer = () => {
    setTimerRunning(false)
    setElapsedTime(0)
    setSessionStartTime(null)
    setCurrentStepIndex(0)
    setPrepSteps(prev => prev.map(s => ({ ...s, status: 'pending' as PrepStepStatus, startedAt: undefined, completedAt: undefined })))
  }

  // Step management
  const markStepComplete = (stepId: string) => {
    setPrepSteps(prev => prev.map(s =>
      s.id === stepId
        ? { ...s, status: 'completed' as PrepStepStatus, completedAt: new Date() }
        : s
    ))

    // Auto-advance to next step
    const nextIndex = prepSteps.findIndex(s => s.id === stepId) + 1
    if (nextIndex < prepSteps.length) {
      setCurrentStepIndex(nextIndex)
      setPrepSteps(prev => prev.map((s, i) =>
        i === nextIndex
          ? { ...s, status: 'in_progress' as PrepStepStatus, startedAt: new Date() }
          : s
      ))
    }
  }

  const skipStep = (stepId: string) => {
    setPrepSteps(prev => prev.map(s =>
      s.id === stepId
        ? { ...s, status: 'skipped' as PrepStepStatus }
        : s
    ))

    const nextIndex = prepSteps.findIndex(s => s.id === stepId) + 1
    if (nextIndex < prepSteps.length) {
      setCurrentStepIndex(nextIndex)
    }
  }

  // Initialize prep steps when entering timer mode
  const initializePrepSteps = async () => {
    const steps: PrepStep[] = []
    let stepNum = 0

    for (const instruction of mealInstructions) {
      // Parse instructions into individual steps
      const instructionLines = instruction.instructions.split('\n').filter(l => l.trim())

      for (const line of instructionLines) {
        stepNum++
        steps.push({
          id: generateId('step'),
          mealName: instruction.mealName,
          stepNumber: stepNum,
          instruction: line.trim().replace(/^\d+[\.\)]\s*/, ''), // Remove leading numbers
          estimatedTime: Math.round(instruction.totalTime / Math.max(instructionLines.length, 1)),
          status: stepNum === 1 ? 'in_progress' : 'pending'
        })
      }
    }

    setPrepSteps(steps)
    setCurrentStepIndex(0)
  }

  // Container/portion tracking
  const initializeContainers = () => {
    const containers: TrackedContainer[] = []
    const now = new Date()

    for (const instruction of mealInstructions) {
      const container = containerPlan.find(c => c.mealName === instruction.mealName)
      const containerCount = container?.containerCount || instruction.containerCount || 1

      for (let i = 0; i < containerCount; i++) {
        const expiresAt = new Date(now)
        expiresAt.setDate(expiresAt.getDate() + instruction.storageDays)

        containers.push({
          id: generateId('cont'),
          mealName: instruction.mealName,
          containerNumber: i + 1,
          label: container?.labelSuggestion || `${instruction.mealName} #${i + 1}`,
          storageType: instruction.storageType,
          storedAt: now,
          expiresAt,
          isConsumed: false,
          isExpired: expiresAt < now
        })
      }
    }

    setTrackedContainers(containers)
    setShowPortionTracking(true)
  }

  const markContainerConsumed = (containerId: string) => {
    setTrackedContainers(prev => prev.map(c =>
      c.id === containerId
        ? { ...c, isConsumed: true }
        : c
    ))
  }

  const getContainerStats = () => {
    const total = trackedContainers.length
    const consumed = trackedContainers.filter(c => c.isConsumed).length
    const expired = trackedContainers.filter(c => c.isExpired && !c.isConsumed).length
    const remaining = total - consumed - expired
    const expiringToday = trackedContainers.filter(c => {
      if (c.isConsumed) return false
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return c.expiresAt >= today && c.expiresAt < tomorrow
    }).length

    return { total, consumed, expired, remaining, expiringToday }
  }

  // Filter saved meals by search
  const filteredSavedMeals = savedMeals.filter(meal =>
    meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (meal.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Get category name
  const getCategoryName = (categoryId: string) => {
    const category = mealCategories.find(c => c.id === categoryId)
    if (!category) return categoryId

    // Handle translation keys
    if (category.name.startsWith('defaultMealCategories.')) {
      return tMeals(category.name as Parameters<typeof tMeals>[0])
    }
    return category.name
  }

  // Add a saved meal to selection
  const addSavedMeal = (meal: SavedMeal) => {
    if (!meal.id) return

    const existingIndex = selectedMeals.findIndex(m => m.id === meal.id)
    if (existingIndex >= 0) {
      // Increase servings
      setSelectedMeals(prev => prev.map((m, i) =>
        i === existingIndex ? { ...m, servings: m.servings + numberOfPeople } : m
      ))
    } else {
      setSelectedMeals(prev => [...prev, {
        id: meal.id!,
        name: meal.name,
        description: meal.description,
        category: meal.category,
        servings: numberOfPeople,
        ingredients: meal.ingredients || [],
        assignedDays: [],
        mealTypes: ['dinner']
      }])
    }
  }

  // Add a custom meal (will be generated by AI)
  const addCustomMeal = () => {
    if (!customMealName.trim()) return

    setSelectedMeals(prev => [...prev, {
      id: generateId('custom'),
      name: customMealName.trim(),
      servings: numberOfPeople,
      ingredients: [],
      isCustom: true,
      assignedDays: [],
      mealTypes: ['dinner']
    }])
    setCustomMealName('')
  }

  // Update meal servings
  const updateMealServings = (mealId: string, delta: number) => {
    setSelectedMeals(prev => prev.map(m =>
      m.id === mealId
        ? { ...m, servings: Math.max(1, m.servings + delta) }
        : m
    ))
  }

  // Remove meal from selection
  const removeMeal = (mealId: string) => {
    setSelectedMeals(prev => prev.filter(m => m.id !== mealId))
  }

  // Component-based mode functions
  const getComponentsByType = (type: MealComponentType) =>
    selectedComponents.filter(c => c.type === type)

  // Total meals = days × meals per day (e.g., 7 days × 2 meals = 14 meals)
  const totalMeals = daysOfPrep * mealsPerDay

  // Auto-update component servings when totalMeals changes
  useEffect(() => {
    if (selectedComponents.length > 0) {
      setSelectedComponents(prev => prev.map(comp => ({
        ...comp,
        servings: totalMeals // Update to cover all meals by default
      })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMeals]) // Only run when totalMeals changes, not when components change

  const addComponent = (type: MealComponentType) => {
    if (!customComponentName.trim()) return

    // Component servings = number of meals this component covers (default: all meals)
    // Total portions will be calculated as: servings × numberOfPeople
    setSelectedComponents(prev => [...prev, {
      id: generateId('comp'),
      name: customComponentName.trim(),
      type,
      servings: totalMeals, // Default to covering all meals
      isCustom: true
    }])
    setCustomComponentName('')
  }

  const removeComponent = (componentId: string) => {
    setSelectedComponents(prev => prev.filter(c => c.id !== componentId))
  }

  const updateComponentServings = (componentId: string, delta: number) => {
    setSelectedComponents(prev => prev.map(c =>
      c.id === componentId
        ? { ...c, servings: Math.max(1, c.servings + delta) }
        : c
    ))
  }

  // Suggest combinations using AI
  const suggestCombinations = async () => {
    if (!openAIKey) {
      toast.error(t('errors.noApiKey'))
      setShowApiKeyInput(true)
      return
    }

    const proteins = getComponentsByType('protein')
    const carbs = getComponentsByType('carb')
    const vegetables = getComponentsByType('vegetable')

    if (proteins.length === 0 || carbs.length === 0 || vegetables.length === 0) {
      toast.error(t('components.noComponents'))
      return
    }

    try {
      toast.loading(t('calculating.schedule'))
      const response = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest-component-combinations',
          apiKey: openAIKey,
          data: {
            proteins: proteins.map(p => ({ id: p.id, name: p.name, type: p.type, servings: p.servings })),
            carbs: carbs.map(c => ({ id: c.id, name: c.name, type: c.type, servings: c.servings })),
            vegetables: vegetables.map(v => ({ id: v.id, name: v.name, type: v.type, servings: v.servings })),
            daysOfPrep,
            mealsPerDay,
            dietaryRestrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to suggest combinations')
      }

      const data = await response.json()
      setComponentCombinations(data.combinations || [])
      toast.dismiss()
      toast.success(t('calculating.complete'))
    } catch (error) {
      toast.dismiss()
      logger.error('Error suggesting combinations:', error)
      toast.error(error instanceof Error ? error.message : t('errors.calculationFailed'))
    }
  }

  // Toggle meal type for a selected meal
  const toggleMealType = (mealId: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setSelectedMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      const types = m.mealTypes.includes(mealType)
        ? m.mealTypes.filter(t => t !== mealType)
        : [...m.mealTypes, mealType]
      return { ...m, mealTypes: types.length > 0 ? types : ['dinner'] }
    }))
  }

  // Calculate total servings
  const totalServings = selectedMeals.reduce((sum, m) => sum + m.servings, 0)

  // Distribute meals across days
  const distributeMeals = useCallback(() => {
    if (!startDate || !endDate || selectedMeals.length === 0) return

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days: string[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0])
    }

    // Distribute meals evenly across days
    const mealsPerDay: { [day: string]: { [type: string]: string[] } } = {}
    days.forEach(day => {
      mealsPerDay[day] = { breakfast: [], lunch: [], dinner: [], snack: [] }
    })

    // Sort meals by number of servings (more servings = more frequent)
    const sortedMeals = [...selectedMeals].sort((a, b) => b.servings - a.servings)

    sortedMeals.forEach(meal => {
      const servingsNeeded = meal.servings
      let assigned = 0
      let dayIndex = 0

      while (assigned < servingsNeeded && dayIndex < days.length * 2) {
        const day = days[dayIndex % days.length]
        const mealType = meal.mealTypes[0] || 'dinner'

        // Check if this day/type slot is available
        if (mealsPerDay[day][mealType].length < 2) { // Allow up to 2 meals per type per day
          mealsPerDay[day][mealType].push(meal.id)
          assigned += numberOfPeople
        }
        dayIndex++
      }
    })

    // Update selected meals with assigned days
    setSelectedMeals(prev => prev.map(meal => {
      const assignedDays: string[] = []
      Object.entries(mealsPerDay).forEach(([day, types]) => {
        Object.values(types).forEach(mealIds => {
          if (mealIds.includes(meal.id)) {
            assignedDays.push(day)
          }
        })
      })
      return { ...meal, assignedDays: [...new Set(assignedDays)] }
    }))
  }, [startDate, endDate, selectedMeals, numberOfPeople])

  // Call AI to calculate ingredients and instructions
  const calculateWithAI = async () => {
    if (!openAIKey) {
      toast.error(t('errors.noApiKey'))
      setShowApiKeyInput(true)
      return
    }

    setIsCalculating(true)

    try {
      // Prepare meals data for API
      const mealsData = selectedMeals.map(meal => ({
        name: meal.name,
        description: meal.description,
        category: meal.category ? getCategoryName(meal.category) : undefined,
        servings: meal.servings,
        existingIngredients: meal.ingredients.map(ing => {
          const item = savedGroceryItems.find(i => i.id === ing.savedGroceryItemId)
          return item ? { name: item.name, amount: ing.amount } : null
        }).filter(Boolean) as { name: string; amount?: string }[]
      }))

      // Step 1: Calculate ingredients
      toast.loading(t('calculating.ingredients'))
      const ingredientsResponse = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate-ingredients',
          apiKey: openAIKey,
          data: {
            meals: mealsData,
            totalServings,
            numberOfPeople,
            daysOfPrep
          }
        })
      })

      if (!ingredientsResponse.ok) {
        const error = await ingredientsResponse.json()
        throw new Error(error.error || 'Failed to calculate ingredients')
      }

      const ingredientsData = await ingredientsResponse.json()
      setCalculatedIngredients(ingredientsData.ingredients.map((ing: CalculatedIngredient) => ({
        ...ing,
        addedToGrocery: false
      })))

      // Step 2: Generate instructions
      toast.loading(t('calculating.instructions'))
      const instructionsResponse = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-instructions',
          apiKey: openAIKey,
          data: { meals: mealsData }
        })
      })

      if (!instructionsResponse.ok) {
        const error = await instructionsResponse.json()
        throw new Error(error.error || 'Failed to generate instructions')
      }

      const instructionsData = await instructionsResponse.json()
      setMealInstructions(instructionsData.instructions)
      setPrepOrder(instructionsData.prepOrder)
      setGeneralTips(instructionsData.generalTips)

      // Step 3: Get container guidance
      toast.loading(t('calculating.containers'))
      const containerResponse = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'container-guidance',
          apiKey: openAIKey,
          data: {
            meals: mealsData,
            numberOfPeople,
            daysOfPrep
          }
        })
      })

      if (!containerResponse.ok) {
        const error = await containerResponse.json()
        throw new Error(error.error || 'Failed to get container guidance')
      }

      const containerData = await containerResponse.json()
      setContainerPlan(containerData.containerPlan)
      setOrganizationTips(containerData.organizationTips)

      // Step 4: Generate smart schedule
      toast.loading(t('calculating.schedule'))
      const scheduleResponse = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'smart-schedule',
          apiKey: openAIKey,
          data: {
            meals: mealsData.map(m => ({
              name: m.name,
              prepTime: instructionsData.instructions.find((i: MealInstruction) => i.mealName === m.name)?.prepTime,
              cookTime: instructionsData.instructions.find((i: MealInstruction) => i.mealName === m.name)?.cookTime,
              category: m.category
            }))
          }
        })
      })

      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json()
        setSmartSchedule({
          optimizedOrder: scheduleData.optimizedOrder || [],
          parallelTasks: scheduleData.parallelTasks,
          equipmentNeeded: scheduleData.equipmentNeeded,
          timelineSteps: scheduleData.timelineSteps,
          totalEstimatedTime: scheduleData.totalEstimatedTime || 0,
          efficiencyTips: scheduleData.efficiencyTips || []
        })
        // Update prep order with optimized order
        if (scheduleData.optimizedOrder?.length > 0) {
          setPrepOrder(scheduleData.optimizedOrder)
        }
      }

      toast.dismiss()
      toast.success(t('calculating.complete'))
      setCurrentStep('review')

    } catch (error) {
      toast.dismiss()
      logger.error('Error calculating meal prep:', error)
      toast.error(error instanceof Error ? error.message : t('errors.calculationFailed'))
    } finally {
      setIsCalculating(false)
    }
  }

  // Calculate with component-based AI
  const calculateWithComponentsAI = async () => {
    if (!openAIKey) {
      toast.error(t('errors.noApiKey'))
      setShowApiKeyInput(true)
      return
    }

    const proteins = getComponentsByType('protein')
    const carbs = getComponentsByType('carb')
    const vegetables = getComponentsByType('vegetable')

    if (proteins.length === 0 || carbs.length === 0 || vegetables.length === 0) {
      toast.error(t('components.noComponents'))
      return
    }

    setIsCalculating(true)

    try {
      const allComponents = [...proteins, ...carbs, ...vegetables].map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        servings: c.servings
      }))

      // Step 1: Calculate component ingredients
      toast.loading(t('calculating.ingredients'))
      const ingredientsResponse = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate-component-ingredients',
          apiKey: openAIKey,
          data: {
            components: allComponents,
            servingsPerMeal: numberOfPeople,
            numberOfMeals: totalMeals // daysOfPrep × mealsPerDay
          }
        })
      })

      if (!ingredientsResponse.ok) {
        const error = await ingredientsResponse.json()
        throw new Error(error.error || 'Failed to calculate ingredients')
      }

      const ingredientsData = await ingredientsResponse.json()
      setCalculatedIngredients(ingredientsData.ingredients.map((ing: CalculatedIngredient) => ({
        ...ing,
        addedToGrocery: false
      })))

      // Step 2: Generate component instructions
      toast.loading(t('calculating.instructions'))
      const instructionsResponse = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-component-instructions',
          apiKey: openAIKey,
          data: { components: allComponents }
        })
      })

      if (!instructionsResponse.ok) {
        const error = await instructionsResponse.json()
        throw new Error(error.error || 'Failed to generate instructions')
      }

      const instructionsData = await instructionsResponse.json()

      // Convert component instructions to meal instructions format
      const componentInstructions: MealInstruction[] = instructionsData.instructions?.map((inst: { componentName: string; prepInstructions: string; cookingTime?: number; storageType?: string; storageDays?: number; nutritionEstimate?: { calories: number; protein: number; carbs: number; fat: number } }) => ({
        mealName: inst.componentName,
        prepTime: 0,
        cookTime: inst.cookingTime || 0,
        totalTime: inst.cookingTime || 0,
        instructions: inst.prepInstructions,
        tips: '',
        storageType: inst.storageType || 'refrigerator',
        storageDays: inst.storageDays || 4,
        storageInstructions: '',
        reheatingInstructions: '',
        containerSize: 'medium',
        containerCount: Math.ceil((proteins.length + carbs.length + vegetables.length) / 3),
        nutritionEstimate: inst.nutritionEstimate
      })) || []

      setMealInstructions(componentInstructions)
      setPrepOrder(instructionsData.prepOrder || allComponents.map(c => c.name))
      setGeneralTips(instructionsData.generalTips || [])

      // Step 3: Get container guidance (reuse existing)
      toast.loading(t('calculating.containers'))
      const containerResponse = await fetch('/api/meal-prep/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'container-guidance',
          apiKey: openAIKey,
          data: {
            meals: allComponents.map(c => ({ name: c.name, servings: c.servings })),
            numberOfPeople,
            daysOfPrep
          }
        })
      })

      if (containerResponse.ok) {
        const containerData = await containerResponse.json()
        setContainerPlan(containerData.containerPlan || [])
        setOrganizationTips(containerData.organizationTips || [])
      }

      // Step 4: Suggest combinations if not already done
      if (componentCombinations.length === 0) {
        await suggestCombinations()
      }

      toast.dismiss()
      toast.success(t('calculating.complete'))
      setCurrentStep('review')

    } catch (error) {
      toast.dismiss()
      logger.error('Error calculating component meal prep:', error)
      toast.error(error instanceof Error ? error.message : t('errors.calculationFailed'))
    } finally {
      setIsCalculating(false)
    }
  }

  // Add ingredients to grocery list
  const addIngredientsToGrocery = async () => {
    try {
      for (const ingredient of calculatedIngredients) {
        if (ingredient.addedToGrocery) continue

        // Check if ingredient exists in saved items
        let savedItem = savedGroceryItems.find(
          i => i.name.toLowerCase() === ingredient.name.toLowerCase()
        )

        // Create new saved item if not exists
        if (!savedItem) {
          const newItemId = generateId('sgi')
          await db.savedGroceryItems.add({
            id: newItemId,
            name: ingredient.name,
            category: ingredient.category || 'Pantry',
            amount: ingredient.amount,
            importance: 'medium',
            timesUsed: 0,
            createdAt: new Date()
          })
          savedItem = await db.savedGroceryItems.get(newItemId)
        }

        // Add to grocery list
        await db.groceryItems.add({
          id: generateId('gi'),
          name: ingredient.name,
          category: ingredient.category || 'Pantry',
          amount: ingredient.amount,
          importance: 'medium',
          createdAt: new Date()
        })
      }

      // Mark all as added
      setCalculatedIngredients(prev => prev.map(ing => ({ ...ing, addedToGrocery: true })))
      toast.success(t('notifications.addedToGrocery'))
    } catch (error) {
      logger.error('Error adding ingredients to grocery:', error)
      toast.error(t('errors.addToGroceryFailed'))
    }
  }

  // Save the meal prep plan
  const savePlan = async () => {
    try {
      const now = new Date()
      const planId = savedPlanId || generateId('mpp')

      // Save the plan
      const plan: MealPrepPlan = {
        id: planId,
        name: planName || t('defaultPlanName', { date: cookingDate }),
        cookingDate: new Date(cookingDate),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        servingsPerMeal: numberOfPeople,
        numberOfMeals: selectedMeals.length,
        status: 'planning',
        dietaryRestrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
        createdAt: now,
        updatedAt: now
      }

      if (savedPlanId) {
        await db.mealPrepPlans.update(savedPlanId, plan)
      } else {
        await db.mealPrepPlans.add(plan)
      }

      // Save meal items
      for (const meal of selectedMeals) {
        const instruction = mealInstructions.find(i => i.mealName === meal.name)
        const container = containerPlan.find(c => c.mealName === meal.name)

        const itemId = generateId('mpi')
        const item: MealPrepItem = {
          id: itemId,
          mealPrepPlanId: planId,
          savedMealId: meal.isCustom ? undefined : meal.id,
          mealName: meal.name,
          mealDescription: meal.description,
          category: meal.category,
          quantity: meal.servings,
          assignedDays: meal.assignedDays,
          mealTypes: meal.mealTypes,
          prepInstructions: instruction?.instructions,
          cookingTime: instruction?.cookTime,
          storageInstructions: instruction?.storageInstructions,
          storageType: instruction?.storageType,
          storageDays: instruction?.storageDays,
          containerSize: container?.containerSize as 'small' | 'medium' | 'large' | 'extra-large',
          containerCount: container?.containerCount,
          reheatingInstructions: instruction?.reheatingInstructions,
          createdAt: now,
          updatedAt: now
        }

        await db.mealPrepItems.add(item)

        // If it's a custom meal, create a saved meal for future use
        if (meal.isCustom) {
          const savedMealId = generateId('smea')
          await db.savedMeals.add({
            id: savedMealId,
            name: meal.name,
            description: meal.description,
            category: meal.category || 'defaultMealCategories.comfort',
            ingredients: [],
            timesUsed: 1,
            lastUsed: now,
            createdAt: now
          })
        }
      }

      // Save ingredients
      for (const ingredient of calculatedIngredients) {
        const ingredientId = generateId('mpig')

        // Check if ingredient exists in saved items
        const savedItem = savedGroceryItems.find(
          i => i.name.toLowerCase() === ingredient.name.toLowerCase()
        )

        const prepIngredient: MealPrepIngredient = {
          id: ingredientId,
          mealPrepPlanId: planId,
          savedGroceryItemId: savedItem?.id,
          name: ingredient.name,
          category: ingredient.category,
          amount: ingredient.amount,
          originalAmount: ingredient.originalAmount,
          unit: ingredient.unit,
          isNewIngredient: !savedItem,
          addedToGroceryList: ingredient.addedToGrocery,
          createdAt: now
        }

        await db.mealPrepIngredients.add(prepIngredient)

        // Create saved grocery item if new
        if (!savedItem) {
          await db.savedGroceryItems.add({
            id: generateId('sgi'),
            name: ingredient.name,
            category: ingredient.category || 'Pantry',
            amount: ingredient.amount,
            importance: 'medium',
            timesUsed: 1,
            lastUsed: now,
            createdAt: now
          })
        }
      }

      setSavedPlanId(planId)
      toast.success(t('notifications.planSaved'))

    } catch (error) {
      logger.error('Error saving meal prep plan:', error)
      toast.error(t('errors.saveFailed'))
    }
  }

  // Create calendar meals from the prep plan and save to savedMeals
  const createCalendarMeals = async () => {
    try {
      const now = new Date()

      // Handle component mode separately
      if (useComponentMode && componentCombinations.length > 0) {
        // Calculate the dates for each day
        const start = new Date(startDate)

        for (const combo of componentCombinations) {
          // Calculate the date for this combination
          const mealDate = new Date(start)
          mealDate.setDate(start.getDate() + (combo.day - 1))

          // Build meal title from components
          const components = [combo.protein, combo.carb, combo.vegetable].filter(Boolean)
          const mealTitle = components.join(' + ') || 'Meal Prep'

          // Build description from combination suggestion
          const mealDescription = combo.description || components.join(', ')

          await db.meals.add({
            id: generateId('mea'),
            title: mealTitle,
            description: mealDescription,
            date: mealDate,
            mealType: combo.mealType,
            createdAt: now
          })
        }

        toast.success(t('notifications.mealsCreated'))
        return
      }

      // Regular mode - use selectedMeals
      for (const meal of selectedMeals) {
        // Get meal instructions from AI calculations
        const instruction = mealInstructions.find(i => i.mealName === meal.name)

        // If this is a custom meal (AI-generated), save it to savedMeals first
        if (meal.isCustom) {
          // Find or create category
          let categoryId = meal.category
          if (meal.category) {
            const existingCategory = mealCategories.find(
              c => c.name.toLowerCase() === meal.category?.toLowerCase()
            )
            if (existingCategory) {
              categoryId = existingCategory.id
            } else {
              // Create the category
              const newCategoryId = generateId('mcat')
              await db.mealCategories.add({
                id: newCategoryId,
                name: meal.category,
                color: '#3B82F6',
                isDefault: false,
                createdAt: now
              })
              categoryId = newCategoryId
            }
          }

          // Save the meal with AI-generated content
          const savedMealId = generateId('smea')
          await db.savedMeals.add({
            id: savedMealId,
            name: meal.name,
            description: meal.description || instruction?.instructions?.substring(0, 200),
            category: categoryId || 'General',
            ingredients: meal.ingredients,
            timesUsed: 1,
            lastUsed: now,
            createdAt: now
          })

          // Update meal with saved ID
          meal.id = savedMealId
          meal.isCustom = false
        }

        // Create calendar meals for each assigned day
        for (const day of meal.assignedDays) {
          for (const mealType of meal.mealTypes) {
            // Build description with instructions if available
            const mealDescription = instruction?.instructions
              ? `${meal.description || ''}\n\n${instruction.instructions}`.trim()
              : meal.description

            await db.meals.add({
              id: generateId('mea'),
              title: meal.name,
              description: mealDescription,
              date: new Date(day),
              mealType,
              createdAt: now
            })
          }
        }
      }

      toast.success(t('notifications.mealsCreated'))
    } catch (error) {
      logger.error('Error creating calendar meals:', error)
      toast.error(t('errors.createMealsFailed'))
    }
  }

  // Save API key
  const saveApiKey = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('openai_api_key', openAIKey)
      toast.success(t('notifications.apiKeySaved'))
      setShowApiKeyInput(false)
    }
  }

  // Toggle expanded meal in prep view
  const toggleMealExpanded = (mealName: string) => {
    setExpandedMeals(prev => {
      const newSet = new Set(prev)
      if (newSet.has(mealName)) {
        newSet.delete(mealName)
      } else {
        newSet.add(mealName)
      }
      return newSet
    })
  }

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 'setup':
        return cookingDate && startDate && endDate && numberOfPeople > 0
      case 'meals':
        if (useComponentMode) {
          // Need at least one of each component type
          return getComponentsByType('protein').length > 0 &&
                 getComponentsByType('carb').length > 0 &&
                 getComponentsByType('vegetable').length > 0
        }
        return selectedMeals.length > 0
      case 'calculate':
        return calculatedIngredients.length > 0
      case 'review':
        return true
      default:
        return true
    }
  }

  const goBack = () => {
    const steps: WizardStep[] = ['setup', 'meals', 'calculate', 'review', 'prep']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }

  const goNext = () => {
    const steps: WizardStep[] = ['setup', 'meals', 'calculate', 'review', 'prep']
    const currentIndex = steps.indexOf(currentStep)
    if (currentStep === 'meals') {
      if (useComponentMode) {
        calculateWithComponentsAI()
      } else {
        distributeMeals()
        calculateWithAI()
      }
    } else if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }

  const stepProgress = () => {
    const steps: WizardStep[] = ['setup', 'meals', 'calculate', 'review', 'prep']
    return ((steps.indexOf(currentStep) + 1) / steps.length) * 100
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/meals')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ChefHat className="h-7 w-7" />
                {t('title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {t('settings')}
          </Button>
        </div>

        {/* API Key Input */}
        {showApiKeyInput && (
          <Card className="mb-6 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    {t('apiKeyRequired')}
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    {t('apiKeyDescription')}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={openAIKey}
                      onChange={(e) => setOpenAIKey(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={saveApiKey}>
                      {t('saveApiKey')}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Bar */}
        <div className="mb-6">
          <Progress value={stepProgress()} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className={currentStep === 'setup' ? 'text-blue-600 font-medium' : ''}>{t('steps.setup')}</span>
            <span className={currentStep === 'meals' ? 'text-blue-600 font-medium' : ''}>{t('steps.meals')}</span>
            <span className={currentStep === 'calculate' ? 'text-blue-600 font-medium' : ''}>{t('steps.calculate')}</span>
            <span className={currentStep === 'review' ? 'text-blue-600 font-medium' : ''}>{t('steps.review')}</span>
            <span className={currentStep === 'prep' ? 'text-blue-600 font-medium' : ''}>{t('steps.prep')}</span>
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-6">
          {/* SETUP STEP */}
          {currentStep === 'setup' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('setup.title')}
                </CardTitle>
                <CardDescription>{t('setup.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="planName">{t('setup.planName')}</Label>
                  <Input
                    id="planName"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder={t('setup.planNamePlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="cookingDate">{t('setup.cookingDate')}</Label>
                    <Input
                      id="cookingDate"
                      type="date"
                      value={cookingDate}
                      onChange={(e) => setCookingDate(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('setup.cookingDateHint')}</p>
                  </div>
                  <div>
                    <Label htmlFor="startDate">{t('setup.startDate')}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">{t('setup.endDate')}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>{t('setup.numberOfPeople')}</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-gray-500" />
                      <span className="text-2xl font-bold w-12 text-center">{numberOfPeople}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setNumberOfPeople(numberOfPeople + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Meals per Day - only show in component mode */}
                {useComponentMode && (
                  <div>
                    <Label>{t('setup.mealsPerDay')}</Label>
                    <p className="text-xs text-gray-500 mb-2">{t('setup.mealsPerDayHint')}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setMealsPerDay(Math.max(1, mealsPerDay - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-gray-500" />
                        <span className="text-2xl font-bold w-12 text-center">{mealsPerDay}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setMealsPerDay(Math.min(4, mealsPerDay + 1))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Dietary Restrictions */}
                <div>
                  <Label className="mb-2 block">{t('setup.dietaryRestrictions')}</Label>
                  <p className="text-xs text-gray-500 mb-3">{t('setup.dietaryRestrictionsHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DIETARY_RESTRICTIONS.map(restriction => (
                      <Badge
                        key={restriction}
                        variant={dietaryRestrictions.includes(restriction) ? 'default' : 'outline'}
                        className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        onClick={() => toggleDietaryRestriction(restriction)}
                      >
                        {t(`dietaryRestrictions.${restriction}`)}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Component Mode Toggle */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <Beef className="h-5 w-5 text-red-500" />
                        <Wheat className="h-5 w-5 text-amber-500" />
                        <Salad className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{t('components.modeToggle')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('components.modeDescription')}</p>
                      </div>
                    </div>
                    <Switch
                      checked={useComponentMode}
                      onCheckedChange={setUseComponentMode}
                    />
                  </div>
                </div>

                {/* Templates Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label>{t('templates.title')}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplates(!showTemplates)}
                    >
                      <Bookmark className="h-4 w-4 mr-2" />
                      {showTemplates ? t('templates.hide') : t('templates.show')}
                    </Button>
                  </div>

                  {showTemplates && (
                    <div className="space-y-2">
                      {savedTemplates.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {t('templates.noTemplates')}
                        </p>
                      ) : (
                        savedTemplates.map(template => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <div>
                              <p className="font-medium">{template.templateName || template.name}</p>
                              <p className="text-xs text-gray-500">
                                {template.numberOfMeals} {t('templates.meals')} • {template.servingsPerMeal} {t('setup.numberOfPeople').toLowerCase()}
                                {template.dietaryRestrictions?.length ? (
                                  <span className="ml-2">
                                    ({template.dietaryRestrictions.slice(0, 2).map(r => t(`dietaryRestrictions.${r}`)).join(', ')})
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadTemplate(template)}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              {t('templates.load')}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">{t('setup.summary')}</h4>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    {t('setup.summaryText', { days: daysOfPrep, people: numberOfPeople })}
                  </p>
                  {dietaryRestrictions.length > 0 && (
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                      {t('setup.dietLabel')}: {dietaryRestrictions.map(r => t(`dietaryRestrictions.${r}`)).join(', ')}
                    </p>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* MEALS STEP */}
          {currentStep === 'meals' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {useComponentMode ? (
                    <>
                      <div className="flex gap-0.5">
                        <Beef className="h-5 w-5 text-red-500" />
                        <Wheat className="h-5 w-5 text-amber-500" />
                        <Salad className="h-5 w-5 text-green-500" />
                      </div>
                      {t('components.title')}
                    </>
                  ) : (
                    <>
                      <UtensilsCrossed className="h-5 w-5" />
                      {t('meals.title')}
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {useComponentMode ? t('components.description') : t('meals.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* COMPONENT MODE */}
                {useComponentMode ? (
                  <div className="space-y-6">
                    {/* Component Type Tabs */}
                    <Tabs value={activeComponentType} onValueChange={(v) => setActiveComponentType(v as MealComponentType)} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="protein" className="gap-2">
                          <Beef className="h-4 w-4" />
                          {t('components.proteins')}
                        </TabsTrigger>
                        <TabsTrigger value="carb" className="gap-2">
                          <Wheat className="h-4 w-4" />
                          {t('components.sides')}
                        </TabsTrigger>
                        <TabsTrigger value="vegetable" className="gap-2">
                          <Salad className="h-4 w-4" />
                          {t('components.vegetables')}
                        </TabsTrigger>
                      </TabsList>

                      {/* Add Component Input */}
                      <div className="flex gap-2 mb-4">
                        <Input
                          placeholder={t('components.customPlaceholder')}
                          value={customComponentName}
                          onChange={(e) => setCustomComponentName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addComponent(activeComponentType)}
                        />
                        <Button onClick={() => addComponent(activeComponentType)}>
                          <Plus className="h-4 w-4 mr-2" />
                          {activeComponentType === 'protein' && t('components.addProtein')}
                          {activeComponentType === 'carb' && t('components.addSide')}
                          {activeComponentType === 'vegetable' && t('components.addVegetable')}
                        </Button>
                      </div>

                      {/* Examples hint */}
                      <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {activeComponentType === 'protein' && t('components.proteinExamples')}
                        {activeComponentType === 'carb' && t('components.sideExamples')}
                        {activeComponentType === 'vegetable' && t('components.vegetableExamples')}
                      </p>

                      {/* Selected Components by Type */}
                      <TabsContent value="protein" className="mt-0">
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {getComponentsByType('protein').map(comp => (
                              <div key={comp.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-900/20">
                                <div className="flex items-center gap-2">
                                  <Beef className="h-4 w-4 text-red-500" />
                                  <span className="font-medium">{comp.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateComponentServings(comp.id, -1)}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-10 text-center text-sm">{comp.servings}</span>
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateComponentServings(comp.id, 1)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeComponent(comp.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {getComponentsByType('protein').length === 0 && (
                              <p className="text-center text-gray-500 py-4 text-sm">{t('components.proteinExamples')}</p>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="carb" className="mt-0">
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {getComponentsByType('carb').map(comp => (
                              <div key={comp.id} className="flex items-center justify-between p-3 border rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                <div className="flex items-center gap-2">
                                  <Wheat className="h-4 w-4 text-amber-500" />
                                  <span className="font-medium">{comp.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateComponentServings(comp.id, -1)}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-10 text-center text-sm">{comp.servings}</span>
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateComponentServings(comp.id, 1)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeComponent(comp.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {getComponentsByType('carb').length === 0 && (
                              <p className="text-center text-gray-500 py-4 text-sm">{t('components.sideExamples')}</p>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="vegetable" className="mt-0">
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {getComponentsByType('vegetable').map(comp => (
                              <div key={comp.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
                                <div className="flex items-center gap-2">
                                  <Salad className="h-4 w-4 text-green-500" />
                                  <span className="font-medium">{comp.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateComponentServings(comp.id, -1)}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-10 text-center text-sm">{comp.servings}</span>
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateComponentServings(comp.id, 1)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeComponent(comp.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {getComponentsByType('vegetable').length === 0 && (
                              <p className="text-center text-gray-500 py-4 text-sm">{t('components.vegetableExamples')}</p>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>

                    {/* Selected Components Summary */}
                    {selectedComponents.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">{t('components.selectedComponents')}</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                            <Beef className="h-5 w-5 mx-auto text-red-500 mb-1" />
                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{getComponentsByType('protein').length}</p>
                            <p className="text-xs text-red-600 dark:text-red-400">{t('components.proteinLabel')}</p>
                          </div>
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                            <Wheat className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{getComponentsByType('carb').length}</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">{t('components.sideLabel')}</p>
                          </div>
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <Salad className="h-5 w-5 mx-auto text-green-500 mb-1" />
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{getComponentsByType('vegetable').length}</p>
                            <p className="text-xs text-green-600 dark:text-green-400">{t('components.vegetableLabel')}</p>
                          </div>
                        </div>

                        {/* Suggest Combinations Button */}
                        {getComponentsByType('protein').length > 0 &&
                         getComponentsByType('carb').length > 0 &&
                         getComponentsByType('vegetable').length > 0 && (
                          <Button
                            onClick={suggestCombinations}
                            className="w-full mt-4"
                            variant="outline"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {t('components.suggestCombinations')}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Suggested Combinations */}
                    {componentCombinations.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">{t('components.combinations')}</h4>
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {componentCombinations.map((combo, idx) => (
                              <div key={idx} className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="secondary">
                                    Day {combo.day} - {tMeals(`mealTypes.${combo.mealType}`)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="flex items-center gap-1">
                                    <Beef className="h-3 w-3 text-red-500" />
                                    {combo.protein}
                                  </span>
                                  <span className="text-gray-400">+</span>
                                  <span className="flex items-center gap-1">
                                    <Wheat className="h-3 w-3 text-amber-500" />
                                    {combo.carb}
                                  </span>
                                  <span className="text-gray-400">+</span>
                                  <span className="flex items-center gap-1">
                                    <Salad className="h-3 w-3 text-green-500" />
                                    {combo.vegetable}
                                  </span>
                                </div>
                                {combo.description && (
                                  <p className="text-xs text-gray-500 mt-1">{combo.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                ) : (
                  /* STANDARD MEAL MODE */
                  <>
                    <Tabs defaultValue="saved" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="saved">{t('meals.savedMeals')}</TabsTrigger>
                        <TabsTrigger value="custom">{t('meals.customMeal')}</TabsTrigger>
                      </TabsList>

                      <TabsContent value="saved">
                        <Input
                          placeholder={t('meals.searchPlaceholder')}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="mb-4"
                        />
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {filteredSavedMeals.length === 0 ? (
                              <p className="text-center text-gray-500 py-4">
                                {t('meals.noSavedMeals')}
                              </p>
                            ) : (
                              filteredSavedMeals.map(meal => (
                                <div
                                  key={meal.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                  onClick={() => addSavedMeal(meal)}
                                >
                                  <div>
                                    <p className="font-medium">{meal.name}</p>
                                    {meal.description && (
                                      <p className="text-sm text-gray-500 truncate max-w-xs">{meal.description}</p>
                                    )}
                                    <Badge variant="outline" className="mt-1">
                                      {getCategoryName(meal.category)}
                                    </Badge>
                                  </div>
                                  <Button variant="ghost" size="icon">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="custom">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('meals.customPlaceholder')}
                            value={customMealName}
                            onChange={(e) => setCustomMealName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCustomMeal()}
                          />
                          <Button onClick={addCustomMeal}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('meals.add')}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {t('meals.aiWillGenerate')}
                        </p>
                      </TabsContent>
                    </Tabs>

                    {/* Selected Meals */}
                    {selectedMeals.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-medium mb-3 flex items-center justify-between">
                          <span>{t('meals.selected')} ({selectedMeals.length})</span>
                          <span className="text-sm text-gray-500">
                            {t('meals.totalServings', { count: totalServings })}
                          </span>
                        </h4>
                        <div className="space-y-3">
                          {selectedMeals.map(meal => (
                            <div
                              key={meal.id}
                              className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{meal.name}</p>
                                  {meal.isCustom && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      {t('meals.ai')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-1 mt-1">
                                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(type => (
                                    <Badge
                                      key={type}
                                      variant={meal.mealTypes.includes(type) ? 'default' : 'outline'}
                                      className="text-xs cursor-pointer"
                                      onClick={() => toggleMealType(meal.id, type)}
                                    >
                                      {tMeals(`mealTypes.${type}`)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateMealServings(meal.id, -numberOfPeople)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-12 text-center font-medium">
                                  {meal.servings}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateMealServings(meal.id, numberOfPeople)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => removeMeal(meal.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </>
          )}

          {/* CALCULATE STEP (Loading State) */}
          {currentStep === 'calculate' && isCalculating && (
            <CardContent className="py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('calculating.title')}</h3>
              <p className="text-gray-500">{t('calculating.description')}</p>
            </CardContent>
          )}

          {/* REVIEW STEP */}
          {currentStep === 'review' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {t('review.title')}
                </CardTitle>
                <CardDescription>{t('review.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="ingredients" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="ingredients">{t('review.ingredients')}</TabsTrigger>
                    <TabsTrigger value="schedule">{t('review.schedule')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="ingredients">
                    <div className="space-y-4">
                      {/* Group ingredients by category */}
                      {Object.entries(
                        calculatedIngredients.reduce((acc, ing) => {
                          const cat = ing.category || 'Other'
                          if (!acc[cat]) acc[cat] = []
                          acc[cat].push(ing)
                          return acc
                        }, {} as Record<string, CalculatedIngredient[]>)
                      ).map(([category, items]) => (
                        <div key={category}>
                          <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {category}
                          </h4>
                          <div className="space-y-1">
                            {items.map((ing, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  {ing.addedToGrocery && (
                                    <Check className="h-4 w-4 text-green-500" />
                                  )}
                                  <span>{ing.name}</span>
                                  {ing.isConsolidated && (
                                    <Badge variant="outline" className="text-xs">
                                      {t('review.consolidated')}
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-medium">{ing.amount}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <Button
                        onClick={addIngredientsToGrocery}
                        className="w-full mt-4"
                        disabled={calculatedIngredients.every(i => i.addedToGrocery)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {calculatedIngredients.every(i => i.addedToGrocery)
                          ? t('review.allAdded')
                          : t('review.addToGrocery')}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="schedule">
                    <div className="space-y-4">
                      {/* Component Mode: Show combinations by day */}
                      {useComponentMode && componentCombinations.length > 0 ? (
                        <>
                          {/* Group combinations by day */}
                          {Array.from(new Set(componentCombinations.map(c => c.day))).sort((a, b) => a - b).map(day => {
                            const start = new Date(startDate)
                            const mealDate = new Date(start)
                            mealDate.setDate(start.getDate() + (day - 1))
                            const dayCombos = componentCombinations.filter(c => c.day === day)

                            return (
                              <div key={day} className="border rounded-lg p-4">
                                <div className="font-medium mb-3 flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-blue-500" />
                                  {mealDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                </div>
                                <div className="space-y-2">
                                  {dayCombos.map((combo, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                      <Badge variant="outline">{tMeals(`mealTypes.${combo.mealType}`)}</Badge>
                                      <div className="flex items-center gap-1">
                                        {combo.protein && (
                                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                                            {combo.protein}
                                          </span>
                                        )}
                                        {combo.carb && (
                                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs">
                                            {combo.carb}
                                          </span>
                                        )}
                                        {combo.vegetable && (
                                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                                            {combo.vegetable}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </>
                      ) : (
                        /* Regular Mode: Show selected meals */
                        selectedMeals.map(meal => (
                          <div key={meal.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{meal.name}</h4>
                              <Badge>{meal.servings} {t('review.servings')}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {meal.mealTypes.map(type => (
                                <Badge key={type} variant="outline">
                                  {tMeals(`mealTypes.${type}`)}
                                </Badge>
                              ))}
                            </div>
                            {meal.assignedDays.length > 0 && (
                              <div className="mt-2 text-sm text-gray-500">
                                {t('review.assignedDays')}: {meal.assignedDays.map(d =>
                                  new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                                ).join(', ')}
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      <Button onClick={createCalendarMeals} variant="outline" className="w-full">
                        <Calendar className="h-4 w-4 mr-2" />
                        {t('review.addToCalendar')}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}

          {/* PREP STEP */}
          {currentStep === 'prep' && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5" />
                  {t('prep.title')}
                </CardTitle>
                <CardDescription>{t('prep.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Timer Mode Toggle */}
                <div className="flex items-center justify-between mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <p className="font-medium text-purple-800 dark:text-purple-200">{t('timer.title')}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">{t('timer.description')}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isTimerMode}
                    onCheckedChange={(checked) => {
                      setIsTimerMode(checked)
                      if (checked && prepSteps.length === 0) {
                        initializePrepSteps()
                      }
                    }}
                  />
                </div>

                {/* Timer Mode View */}
                {isTimerMode ? (
                  <div className="space-y-4">
                    {/* Timer Display */}
                    <div className="text-center p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <p className="text-5xl font-mono font-bold mb-4">{formatTime(elapsedTime)}</p>
                      <div className="flex justify-center gap-2">
                        {!timerRunning ? (
                          <Button onClick={startTimer} className="gap-2">
                            <Play className="h-4 w-4" />
                            {t('timer.start')}
                          </Button>
                        ) : (
                          <Button onClick={pauseTimer} variant="outline" className="gap-2">
                            <Pause className="h-4 w-4" />
                            {t('timer.pause')}
                          </Button>
                        )}
                        <Button onClick={resetTimer} variant="outline" className="gap-2">
                          <RefreshCw className="h-4 w-4" />
                          {t('timer.reset')}
                        </Button>
                      </div>
                      <div className="mt-4 text-sm text-gray-500">
                        <Progress value={(prepSteps.filter(s => s.status === 'completed').length / Math.max(prepSteps.length, 1)) * 100} className="h-2" />
                        <p className="mt-2">
                          {prepSteps.filter(s => s.status === 'completed').length} / {prepSteps.length} {t('timer.stepsCompleted')}
                        </p>
                      </div>
                    </div>

                    {/* Current Step */}
                    {prepSteps[currentStepIndex] && (
                      <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="default" className="bg-blue-500">
                            {t('timer.currentStep')}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {prepSteps[currentStepIndex].mealName}
                          </span>
                        </div>
                        <p className="text-lg font-medium mb-4">
                          {prepSteps[currentStepIndex].instruction}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => markStepComplete(prepSteps[currentStepIndex].id)}
                            className="flex-1 gap-2"
                          >
                            <Check className="h-4 w-4" />
                            {t('timer.markComplete')}
                          </Button>
                          <Button
                            onClick={() => skipStep(prepSteps[currentStepIndex].id)}
                            variant="outline"
                            className="gap-2"
                          >
                            <SkipForward className="h-4 w-4" />
                            {t('timer.skip')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Steps Checklist */}
                    <ScrollArea className="h-64">
                      <div className="space-y-2 pr-4">
                        {prepSteps.map((step, idx) => (
                          <div
                            key={step.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              idx === currentStepIndex
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : step.status === 'completed'
                                ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                                : step.status === 'skipped'
                                ? 'border-gray-300 bg-gray-50 dark:bg-gray-900/20 opacity-50'
                                : 'border-gray-200'
                            }`}
                          >
                            <Checkbox
                              checked={step.status === 'completed'}
                              onCheckedChange={() => {
                                if (step.status !== 'completed') {
                                  markStepComplete(step.id)
                                }
                              }}
                            />
                            <div className="flex-1">
                              <p className={`text-sm ${step.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                {step.instruction}
                              </p>
                              <p className="text-xs text-gray-400">{step.mealName}</p>
                            </div>
                            {step.status === 'completed' && (
                              <CircleCheckBig className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  /* Normal View */
                  <Tabs defaultValue="order" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-4">
                      <TabsTrigger value="order">{t('prep.order')}</TabsTrigger>
                      <TabsTrigger value="schedule">{t('prep.smartSchedule')}</TabsTrigger>
                      <TabsTrigger value="instructions">{t('prep.instructions')}</TabsTrigger>
                      <TabsTrigger value="storage">{t('prep.storage')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="order">
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500 mb-4">{t('prep.orderDescription')}</p>
                        {prepOrder.map((mealName, idx) => {
                          const instruction = mealInstructions.find(i => i.mealName === mealName)
                          return (
                            <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{mealName}</p>
                                {instruction && (
                                  <p className="text-sm text-gray-500">
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    {t('prep.time', { time: instruction.totalTime })}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {generalTips.length > 0 && (
                          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                              {t('prep.tips')}
                            </h4>
                            <ul className="list-disc list-inside text-sm text-green-600 dark:text-green-300 space-y-1">
                              {generalTips.map((tip, idx) => (
                                <li key={idx}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Smart Schedule Tab */}
                    <TabsContent value="schedule">
                      {smartSchedule ? (
                        <div className="space-y-4">
                          {/* Total Time */}
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                            <Clock className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                              {smartSchedule.totalEstimatedTime} {t('prep.minutes')}
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-400">{t('prep.totalEstimatedTime')}</p>
                          </div>

                          {/* Parallel Tasks */}
                          {smartSchedule.parallelTasks && smartSchedule.parallelTasks.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                {t('prep.parallelTasks')}
                              </h4>
                              <div className="space-y-2">
                                {smartSchedule.parallelTasks.map((group, idx) => (
                                  <div key={idx} className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="secondary">{t('prep.group')} {group.group}</Badge>
                                      <span className="text-sm text-gray-500">{group.reason}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {group.meals.map((meal, i) => (
                                        <Badge key={i} variant="outline">{meal}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Timeline */}
                          {smartSchedule.timelineSteps && smartSchedule.timelineSteps.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {t('prep.timeline')}
                              </h4>
                              <div className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-4">
                                {smartSchedule.timelineSteps.map((step, idx) => (
                                  <div key={idx} className="relative">
                                    <div className="absolute -left-[21px] w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-gray-900" />
                                    <div className="ml-4">
                                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{step.time}</p>
                                      <p className="font-medium">{step.action}</p>
                                      <p className="text-sm text-gray-500">{step.meal}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Equipment Needed */}
                          {smartSchedule.equipmentNeeded && smartSchedule.equipmentNeeded.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Utensils className="h-4 w-4" />
                                {t('prep.equipmentNeeded')}
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {smartSchedule.equipmentNeeded.map((equip, idx) => (
                                  <Badge key={idx} variant="outline">{equip}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Efficiency Tips */}
                          {smartSchedule.efficiencyTips.length > 0 && (
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                                {t('prep.efficiencyTips')}
                              </h4>
                              <ul className="list-disc list-inside text-sm text-green-600 dark:text-green-300 space-y-1">
                                {smartSchedule.efficiencyTips.map((tip, idx) => (
                                  <li key={idx}>{tip}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">{t('prep.noScheduleData')}</p>
                      )}
                    </TabsContent>

                  <TabsContent value="instructions">
                    <ScrollArea className="h-96">
                      <div className="space-y-4 pr-4">
                        {mealInstructions.map((instruction, idx) => (
                          <div key={idx} className="border rounded-lg">
                            <button
                              className="w-full p-4 flex items-center justify-between text-left"
                              onClick={() => toggleMealExpanded(instruction.mealName)}
                            >
                              <div>
                                <h4 className="font-medium">{instruction.mealName}</h4>
                                <p className="text-sm text-gray-500">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {t('prep.prepTime', { time: instruction.prepTime })} |
                                  {t('prep.cookTime', { time: instruction.cookTime })}
                                </p>
                              </div>
                              {expandedMeals.has(instruction.mealName) ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </button>
                            {expandedMeals.has(instruction.mealName) && (
                              <div className="p-4 pt-0 border-t">
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <h5 className="text-sm font-medium mt-2">{t('prep.steps')}</h5>
                                  <p className="whitespace-pre-wrap text-sm">{instruction.instructions}</p>

                                  {instruction.tips && (
                                    <>
                                      <h5 className="text-sm font-medium mt-4">{t('prep.mealTips')}</h5>
                                      <p className="text-sm text-gray-600 dark:text-gray-400">{instruction.tips}</p>
                                    </>
                                  )}

                                  {instruction.nutritionEstimate && (
                                    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                        <p className="text-xs text-gray-500">{t('prep.calories')}</p>
                                        <p className="font-medium">{instruction.nutritionEstimate.calories}</p>
                                      </div>
                                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                        <p className="text-xs text-gray-500">{t('prep.protein')}</p>
                                        <p className="font-medium">{instruction.nutritionEstimate.protein}g</p>
                                      </div>
                                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                        <p className="text-xs text-gray-500">{t('prep.carbs')}</p>
                                        <p className="font-medium">{instruction.nutritionEstimate.carbs}g</p>
                                      </div>
                                      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                        <p className="text-xs text-gray-500">{t('prep.fat')}</p>
                                        <p className="font-medium">{instruction.nutritionEstimate.fat}g</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="storage">
                    <div className="space-y-4">
                      {/* Container Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {['small', 'medium', 'large', 'extra-large'].map(size => {
                          const count = containerPlan
                            .filter(c => c.containerSize === size)
                            .reduce((sum, c) => sum + c.containerCount, 0)
                          return count > 0 ? (
                            <div key={size} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
                              <Package className="h-6 w-6 mx-auto text-gray-500 mb-1" />
                              <p className="text-2xl font-bold">{count}</p>
                              <p className="text-xs text-gray-500">{t(`prep.container.${size}`)}</p>
                            </div>
                          ) : null
                        })}
                      </div>

                      {/* Detailed Container Plan */}
                      <div className="space-y-3">
                        {mealInstructions.map((instruction, idx) => {
                          const container = containerPlan.find(c => c.mealName === instruction.mealName)
                          return (
                            <div key={idx} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium">{instruction.mealName}</h4>
                                <div className="flex items-center gap-2">
                                  <Thermometer className="h-4 w-4" />
                                  <Badge variant={
                                    instruction.storageType === 'freezer' ? 'destructive' :
                                    instruction.storageType === 'refrigerator' ? 'default' : 'secondary'
                                  }>
                                    {t(`prep.storageType.${instruction.storageType}`)}
                                  </Badge>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">{t('prep.storageDuration')}</p>
                                  <p className="font-medium">{t('prep.days', { count: instruction.storageDays })}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">{t('prep.containers')}</p>
                                  <p className="font-medium">
                                    {container?.containerCount || instruction.containerCount} x {container?.containerSize || instruction.containerSize}
                                  </p>
                                </div>
                              </div>

                              {container?.labelSuggestion && (
                                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                                    {t('prep.label')}:
                                  </span> {container.labelSuggestion}
                                </div>
                              )}

                              {instruction.reheatingInstructions && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-500">{t('prep.reheating')}</p>
                                  <p className="text-sm">{instruction.reheatingInstructions}</p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {organizationTips.length > 0 && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                            {t('prep.organizationTips')}
                          </h4>
                          <ul className="list-disc list-inside text-sm text-blue-600 dark:text-blue-300 space-y-1">
                            {organizationTips.map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Portion Tracking Section */}
                      <div className="mt-6 border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {t('portions.title')}
                          </h4>
                          {!showPortionTracking ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={initializeContainers}
                            >
                              {t('portions.startTracking')}
                            </Button>
                          ) : (
                            <Badge variant="secondary">
                              {getContainerStats().remaining} {t('portions.remaining')}
                            </Badge>
                          )}
                        </div>

                        {showPortionTracking && (
                          <div className="space-y-4">
                            {/* Stats Overview */}
                            <div className="grid grid-cols-4 gap-2">
                              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded text-center">
                                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                                  {getContainerStats().consumed}
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400">{t('portions.consumed')}</p>
                              </div>
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-center">
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                  {getContainerStats().remaining}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">{t('portions.remaining')}</p>
                              </div>
                              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded text-center">
                                <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
                                  {getContainerStats().expiringToday}
                                </p>
                                <p className="text-xs text-orange-600 dark:text-orange-400">{t('portions.expiringToday')}</p>
                              </div>
                              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded text-center">
                                <p className="text-xl font-bold text-red-700 dark:text-red-300">
                                  {getContainerStats().expired}
                                </p>
                                <p className="text-xs text-red-600 dark:text-red-400">{t('portions.expired')}</p>
                              </div>
                            </div>

                            {/* Expiring Soon Warning */}
                            {getContainerStats().expiringToday > 0 && (
                              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                <p className="text-sm text-orange-700 dark:text-orange-300">
                                  {t('portions.expiringWarning', { count: getContainerStats().expiringToday })}
                                </p>
                              </div>
                            )}

                            {/* Container List */}
                            <ScrollArea className="h-48">
                              <div className="space-y-2 pr-4">
                                {trackedContainers
                                  .filter(c => !c.isConsumed)
                                  .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
                                  .map(container => {
                                    const daysUntilExpiry = Math.ceil(
                                      (container.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                                    )
                                    return (
                                      <div
                                        key={container.id}
                                        className={`flex items-center justify-between p-3 rounded-lg border ${
                                          daysUntilExpiry <= 0
                                            ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                                            : daysUntilExpiry <= 1
                                            ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20'
                                            : 'border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <Package className={`h-5 w-5 ${
                                            daysUntilExpiry <= 0 ? 'text-red-500' :
                                            daysUntilExpiry <= 1 ? 'text-orange-500' : 'text-gray-400'
                                          }`} />
                                          <div>
                                            <p className="font-medium">{container.label}</p>
                                            <p className="text-xs text-gray-500">
                                              {container.mealName} • {t(`prep.storageType.${container.storageType}`)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="text-right">
                                            <p className={`text-sm font-medium ${
                                              daysUntilExpiry <= 0 ? 'text-red-600' :
                                              daysUntilExpiry <= 1 ? 'text-orange-600' : 'text-gray-600'
                                            }`}>
                                              {daysUntilExpiry <= 0
                                                ? t('portions.expired')
                                                : daysUntilExpiry === 1
                                                ? t('portions.expiresInDay', { count: 1 })
                                                : t('portions.expiresInDays', { count: daysUntilExpiry })}
                                            </p>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => markContainerConsumed(container.id)}
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )
                                  })}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 'setup'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>

          <div className="flex gap-2">
            {currentStep === 'prep' && (
              <>
                <Button onClick={saveAsTemplate} variant="outline">
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  {t('templates.saveAsTemplate')}
                </Button>
                <Button onClick={savePlan} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  {t('savePlan')}
                </Button>
              </>
            )}

            {currentStep !== 'prep' && (
              <Button
                onClick={goNext}
                disabled={!canProceed() || isCalculating}
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('calculating.button')}
                  </>
                ) : currentStep === 'meals' ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('calculateWithAI')}
                  </>
                ) : (
                  <>
                    {t('next')}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
