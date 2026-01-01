/**
 * OpenAI API integration for Meal Prep Planner
 * Uses ChatGPT to calculate ingredients, generate prep instructions, and storage guidance
 */

import { logger } from './logger'

export interface MealPrepRequest {
  meals: {
    name: string
    description?: string
    category?: string
    servings: number
    existingIngredients?: {
      name: string
      amount?: string
    }[]
  }[]
  totalServings: number
  numberOfPeople: number
  daysOfPrep: number
}

export interface IngredientCalculation {
  name: string
  category: string
  amount: string
  unit: string
  originalAmount: string
  isConsolidated: boolean  // If same ingredient from multiple meals was combined
}

export interface MealPrepInstructions {
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
  containerSize: 'small' | 'medium' | 'large' | 'extra-large'
  containerCount: number
  nutritionEstimate?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

export interface MealPrepResponse {
  ingredients: IngredientCalculation[]
  mealInstructions: MealPrepInstructions[]
  shoppingList: {
    category: string
    items: {
      name: string
      amount: string
    }[]
  }[]
  prepOrder: string[]  // Suggested order to prepare meals for efficiency
  generalTips: string[]
}

export interface OpenAIConfig {
  apiKey: string
  model?: string
}

const DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * Call OpenAI API with a prompt
 */
async function callOpenAI(
  apiKey: string,
  prompt: string,
  systemPrompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

/**
 * Calculate scaled ingredients for meal prep
 */
export async function calculateMealPrepIngredients(
  config: OpenAIConfig,
  request: MealPrepRequest
): Promise<{ ingredients: IngredientCalculation[]; error?: string }> {
  const systemPrompt = `You are a professional meal prep chef and nutritionist.
Your task is to calculate ingredient amounts for meal prepping.
You must respond ONLY with valid JSON, no additional text.
Be precise with measurements and always consolidate same ingredients from different meals.
Use standard cooking measurements (cups, tbsp, tsp, oz, lb, grams, etc.).`

  const prompt = `Calculate the total ingredients needed for the following meal prep:

Number of people: ${request.numberOfPeople}
Days of meals: ${request.daysOfPrep}
Total servings needed: ${request.totalServings}

Meals to prepare:
${request.meals.map((meal, i) => `
${i + 1}. ${meal.name}${meal.description ? ` - ${meal.description}` : ''}
   Category: ${meal.category || 'General'}
   Servings needed: ${meal.servings}
   ${meal.existingIngredients?.length ? `Known ingredients: ${meal.existingIngredients.map(ing => `${ing.name}${ing.amount ? ` (${ing.amount})` : ''}`).join(', ')}` : ''}
`).join('\n')}

Respond with a JSON object in this exact format:
{
  "ingredients": [
    {
      "name": "ingredient name",
      "category": "Produce|Dairy|Meat/Fish|Bakery|Pantry|Frozen|Beverages|Snacks|Health & Beauty|Household",
      "amount": "total amount needed (e.g., '2 lbs', '3 cups')",
      "unit": "the unit (e.g., 'lb', 'cup', 'piece')",
      "originalAmount": "amount per serving",
      "isConsolidated": true/false
    }
  ]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return { ingredients: parsed.ingredients }
  } catch (error) {
    logger.error('Error calculating meal prep ingredients:', error)
    return {
      ingredients: [],
      error: error instanceof Error ? error.message : 'Failed to calculate ingredients'
    }
  }
}

/**
 * Generate meal prep instructions for all meals
 */
export async function generateMealPrepInstructions(
  config: OpenAIConfig,
  meals: { name: string; description?: string; servings: number; category?: string }[]
): Promise<{ instructions: MealPrepInstructions[]; prepOrder: string[]; generalTips: string[]; error?: string }> {
  const systemPrompt = `You are a professional meal prep chef.
Your task is to provide detailed meal prep instructions, storage guidance, and reheating instructions.
You must respond ONLY with valid JSON, no additional text.
Be practical and focus on meal prep best practices for food safety and quality.`

  const prompt = `Generate meal prep instructions for the following meals:

${meals.map((meal, i) => `
${i + 1}. ${meal.name}${meal.description ? ` - ${meal.description}` : ''}
   Category: ${meal.category || 'General'}
   Servings to prepare: ${meal.servings}
`).join('\n')}

For each meal, provide:
1. Prep and cook times
2. Step-by-step instructions optimized for batch cooking
3. How to store (refrigerator/freezer, container size)
4. How long it keeps
5. Reheating instructions
6. Container needs

Also suggest the optimal order to prepare these meals for efficiency.

Respond with a JSON object in this exact format:
{
  "mealInstructions": [
    {
      "mealName": "name of the meal",
      "prepTime": number (minutes),
      "cookTime": number (minutes),
      "totalTime": number (minutes),
      "instructions": "Step-by-step instructions for meal prep batch cooking",
      "tips": "Meal prep specific tips for this dish",
      "storageType": "refrigerator" | "freezer" | "pantry",
      "storageDays": number,
      "storageInstructions": "How to properly store",
      "reheatingInstructions": "How to reheat for best results",
      "containerSize": "small" | "medium" | "large" | "extra-large",
      "containerCount": number,
      "nutritionEstimate": {
        "calories": number,
        "protein": number (grams),
        "carbs": number (grams),
        "fat": number (grams)
      }
    }
  ],
  "prepOrder": ["meal name in order to prepare for efficiency"],
  "generalTips": ["general meal prep tips applicable to this batch"]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    // Parse JSON from response
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return {
      instructions: parsed.mealInstructions,
      prepOrder: parsed.prepOrder,
      generalTips: parsed.generalTips
    }
  } catch (error) {
    logger.error('Error generating meal prep instructions:', error)
    return {
      instructions: [],
      prepOrder: [],
      generalTips: [],
      error: error instanceof Error ? error.message : 'Failed to generate instructions'
    }
  }
}

/**
 * Generate a complete meal from just a name
 */
export async function generateMealDetails(
  config: OpenAIConfig,
  mealName: string,
  servings: number
): Promise<{
  description: string
  category: string
  ingredients: { name: string; amount: string; category: string }[]
  instructions: string
  prepTime: number
  cookTime: number
  error?: string
}> {
  const systemPrompt = `You are a professional chef and recipe developer.
Your task is to create detailed meal information from a meal name.
You must respond ONLY with valid JSON, no additional text.
Provide realistic ingredients with proper amounts for the specified servings.`

  const prompt = `Create a complete meal recipe for: "${mealName}"
Servings: ${servings}

Provide:
1. A brief description
2. Category (Meat, Vegetarian, Seafood, Pasta, Salad, Soup, Dessert, Healthy, Comfort Food, or International)
3. Complete ingredient list with amounts
4. Prep and cook times

Respond with a JSON object in this exact format:
{
  "description": "Brief description of the dish",
  "category": "category name",
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": "amount for ${servings} servings (e.g., '2 cups', '1 lb')",
      "category": "Produce|Dairy|Meat/Fish|Bakery|Pantry|Frozen|Beverages"
    }
  ],
  "instructions": "Step-by-step cooking instructions",
  "prepTime": number (minutes),
  "cookTime": number (minutes)
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    // Parse JSON from response
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return parsed
  } catch (error) {
    logger.error('Error generating meal details:', error)
    return {
      description: '',
      category: 'General',
      ingredients: [],
      instructions: '',
      prepTime: 0,
      cookTime: 0,
      error: error instanceof Error ? error.message : 'Failed to generate meal details'
    }
  }
}

/**
 * Get container sorting and portioning guidance
 */
export async function getContainerGuidance(
  config: OpenAIConfig,
  meals: { name: string; servings: number; category?: string }[],
  numberOfPeople: number,
  daysOfPrep: number
): Promise<{
  containerPlan: {
    mealName: string
    containerSize: string
    containerCount: number
    portionSize: string
    labelSuggestion: string
  }[]
  organizationTips: string[]
  error?: string
}> {
  const systemPrompt = `You are a meal prep organization expert.
Your task is to provide container and portioning guidance.
You must respond ONLY with valid JSON, no additional text.
Focus on practical container sizes and efficient organization.`

  const prompt = `Provide container and portioning guidance for this meal prep:

Number of people per meal: ${numberOfPeople}
Days of meals: ${daysOfPrep}

Meals:
${meals.map((meal, i) => `${i + 1}. ${meal.name} - ${meal.servings} servings (${meal.category || 'General'})`).join('\n')}

For each meal, recommend:
1. Container size (small ~1 cup, medium ~2 cups, large ~4 cups, extra-large ~6+ cups)
2. Number of containers needed
3. Portion size per container
4. Label suggestion (what to write on the container)

Also provide organization tips for storing in refrigerator/freezer.

Respond with a JSON object in this exact format:
{
  "containerPlan": [
    {
      "mealName": "meal name",
      "containerSize": "small|medium|large|extra-large",
      "containerCount": number,
      "portionSize": "description of portion per container",
      "labelSuggestion": "what to write on the label"
    }
  ],
  "organizationTips": ["tips for organizing containers in fridge/freezer"]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return {
      containerPlan: parsed.containerPlan,
      organizationTips: parsed.organizationTips
    }
  } catch (error) {
    logger.error('Error getting container guidance:', error)
    return {
      containerPlan: [],
      organizationTips: [],
      error: error instanceof Error ? error.message : 'Failed to get container guidance'
    }
  }
}
