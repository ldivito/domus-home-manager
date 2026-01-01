import { NextResponse } from 'next/server'
import {
  calculateMealPrepIngredients,
  generateMealPrepInstructions,
  generateMealDetails,
  getContainerGuidance,
  type MealPrepRequest
} from '@/lib/openai'
import { logger } from '@/lib/logger'

type ActionType = 'calculate-ingredients' | 'generate-instructions' | 'generate-meal' | 'container-guidance'

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

type RequestBody = CalculateIngredientsBody | GenerateInstructionsBody | GenerateMealBody | ContainerGuidanceBody

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
