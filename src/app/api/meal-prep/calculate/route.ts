import { NextResponse } from 'next/server'
import {
  calculateMealPrepIngredients,
  generateMealPrepInstructions,
  generateMealDetails,
  getContainerGuidance,
  generateSmartSchedule,
  suggestMealsForDiet,
  parseInstructionsToSteps,
  // Component-based functions
  calculateComponentIngredients,
  generateComponentInstructions,
  suggestComponentCombinations,
  generateComponentDetails,
  type MealPrepRequest,
  type DietaryRestriction,
  type MealComponent,
  type MealComponentType
} from '@/lib/openai'
import { logger } from '@/lib/logger'

type ActionType =
  | 'calculate-ingredients'
  | 'generate-instructions'
  | 'generate-meal'
  | 'container-guidance'
  | 'smart-schedule'
  | 'suggest-meals'
  | 'parse-steps'
  // Component-based actions
  | 'calculate-component-ingredients'
  | 'generate-component-instructions'
  | 'suggest-component-combinations'
  | 'generate-component-details'

interface CalculateIngredientsBody {
  action: 'calculate-ingredients'
  apiKey: string
  data: MealPrepRequest
}

interface GenerateInstructionsBody {
  action: 'generate-instructions'
  apiKey: string
  data: {
    meals: { name: string; description?: string; servings: number; category?: string }[]
  }
}

interface GenerateMealBody {
  action: 'generate-meal'
  apiKey: string
  data: {
    mealName: string
    servings: number
  }
}

interface ContainerGuidanceBody {
  action: 'container-guidance'
  apiKey: string
  data: {
    meals: { name: string; servings: number; category?: string }[]
    numberOfPeople: number
    daysOfPrep: number
  }
}

interface SmartScheduleBody {
  action: 'smart-schedule'
  apiKey: string
  data: {
    meals: { name: string; prepTime?: number; cookTime?: number; category?: string }[]
  }
}

interface SuggestMealsBody {
  action: 'suggest-meals'
  apiKey: string
  data: {
    dietaryRestrictions: DietaryRestriction[]
    numberOfMeals?: number
  }
}

interface ParseStepsBody {
  action: 'parse-steps'
  apiKey: string
  data: {
    mealName: string
    instructions: string
  }
}

// Component-based request body interfaces
interface CalculateComponentIngredientsBody {
  action: 'calculate-component-ingredients'
  apiKey: string
  data: {
    components: MealComponent[]
    servingsPerMeal: number
    numberOfMeals: number
  }
}

interface GenerateComponentInstructionsBody {
  action: 'generate-component-instructions'
  apiKey: string
  data: {
    components: MealComponent[]
  }
}

interface SuggestComponentCombinationsBody {
  action: 'suggest-component-combinations'
  apiKey: string
  data: {
    proteins: MealComponent[]
    carbs: MealComponent[]
    vegetables: MealComponent[]
    daysOfPrep: number
    mealsPerDay?: number
    dietaryRestrictions?: DietaryRestriction[]
  }
}

interface GenerateComponentDetailsBody {
  action: 'generate-component-details'
  apiKey: string
  data: {
    componentName: string
    componentType: MealComponentType
    servings: number
  }
}

type RequestBody =
  | CalculateIngredientsBody
  | GenerateInstructionsBody
  | GenerateMealBody
  | ContainerGuidanceBody
  | SmartScheduleBody
  | SuggestMealsBody
  | ParseStepsBody
  // Component-based
  | CalculateComponentIngredientsBody
  | GenerateComponentInstructionsBody
  | SuggestComponentCombinationsBody
  | GenerateComponentDetailsBody

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json()
    const { action, apiKey, data } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      )
    }

    if (!action || !data) {
      return NextResponse.json(
        { error: 'Action and data are required' },
        { status: 400 }
      )
    }

    const config = { apiKey }

    switch (action as ActionType) {
      case 'calculate-ingredients': {
        const result = await calculateMealPrepIngredients(config, data as MealPrepRequest)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({ ingredients: result.ingredients })
      }

      case 'generate-instructions': {
        const instructionsData = data as GenerateInstructionsBody['data']
        const result = await generateMealPrepInstructions(config, instructionsData.meals)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({
          instructions: result.instructions,
          prepOrder: result.prepOrder,
          generalTips: result.generalTips
        })
      }

      case 'generate-meal': {
        const mealData = data as GenerateMealBody['data']
        const result = await generateMealDetails(config, mealData.mealName, mealData.servings)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json(result)
      }

      case 'container-guidance': {
        const containerData = data as ContainerGuidanceBody['data']
        const result = await getContainerGuidance(
          config,
          containerData.meals,
          containerData.numberOfPeople,
          containerData.daysOfPrep
        )
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({
          containerPlan: result.containerPlan,
          organizationTips: result.organizationTips
        })
      }

      case 'smart-schedule': {
        const scheduleData = data as SmartScheduleBody['data']
        const result = await generateSmartSchedule(config, scheduleData.meals)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({
          optimizedOrder: result.optimizedOrder,
          parallelTasks: result.parallelTasks,
          equipmentNeeded: result.equipmentNeeded,
          timelineSteps: result.timelineSteps,
          totalEstimatedTime: result.totalEstimatedTime,
          efficiencyTips: result.efficiencyTips
        })
      }

      case 'suggest-meals': {
        const suggestData = data as SuggestMealsBody['data']
        const result = await suggestMealsForDiet(
          config,
          suggestData.dietaryRestrictions,
          suggestData.numberOfMeals
        )
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({ meals: result.meals })
      }

      case 'parse-steps': {
        const stepsData = data as ParseStepsBody['data']
        const result = await parseInstructionsToSteps(
          config,
          stepsData.mealName,
          stepsData.instructions
        )
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({ steps: result.steps })
      }

      // Component-based actions
      case 'calculate-component-ingredients': {
        const componentData = data as CalculateComponentIngredientsBody['data']
        const result = await calculateComponentIngredients(
          config,
          componentData.components,
          componentData.servingsPerMeal,
          componentData.numberOfMeals
        )
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({ ingredients: result.ingredients })
      }

      case 'generate-component-instructions': {
        const componentData = data as GenerateComponentInstructionsBody['data']
        const result = await generateComponentInstructions(config, componentData.components)
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({
          instructions: result.instructions,
          prepOrder: result.prepOrder,
          generalTips: result.generalTips
        })
      }

      case 'suggest-component-combinations': {
        const componentData = data as SuggestComponentCombinationsBody['data']
        const result = await suggestComponentCombinations(
          config,
          componentData.proteins,
          componentData.carbs,
          componentData.vegetables,
          componentData.daysOfPrep,
          componentData.mealsPerDay,
          componentData.dietaryRestrictions
        )
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json({ combinations: result.combinations })
      }

      case 'generate-component-details': {
        const componentData = data as GenerateComponentDetailsBody['data']
        const result = await generateComponentDetails(
          config,
          componentData.componentName,
          componentData.componentType,
          componentData.servings
        )
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Meal prep API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
