/**
 * OpenAI API integration for Meal Prep Planner
 * Uses ChatGPT to calculate ingredients, generate prep instructions, and storage guidance
 * All responses in Spanish with metric system (grams, kilograms, liters)
 *
 * Using GPT-5-mini - Cost-efficient model for text generation
 * See: https://platform.openai.com/docs/models/gpt-5-mini
 * Guide: https://platform.openai.com/docs/guides/text
 */

import { logger } from './logger'

export type DietaryRestriction =
  | 'vegetarian' | 'vegan' | 'keto' | 'low-carb' | 'paleo'
  | 'gluten-free' | 'dairy-free' | 'nut-free' | 'halal' | 'kosher'
  | 'low-sodium' | 'low-fat' | 'high-protein' | 'pescatarian'

// Meal component types for modular meal prep
export type MealComponentType = 'protein' | 'carb' | 'vegetable'

export interface MealComponent {
  id: string
  name: string
  type: MealComponentType
  description?: string
  servings: number
  ingredients?: { name: string; amount?: string }[]
  isCustom?: boolean
}

export interface MealCombination {
  id: string
  dayIndex: number
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  protein?: MealComponent
  carb?: MealComponent
  vegetable?: MealComponent
}

export interface MealPrepRequest {
  // Legacy support for complete meals
  meals?: {
    name: string
    description?: string
    category?: string
    servings: number
    existingIngredients?: {
      name: string
      amount?: string
    }[]
  }[]
  // New component-based system
  components?: MealComponent[]
  combinations?: MealCombination[]
  totalServings: number
  numberOfPeople: number
  daysOfPrep: number
  dietaryRestrictions?: DietaryRestriction[]
  language?: 'es' | 'en'
}

export interface SmartScheduleResult {
  optimizedOrder: string[]
  parallelTasks: {
    group: number
    meals: string[]
    reason: string
  }[]
  equipmentNeeded: string[]
  timelineSteps: {
    time: string
    action: string
    meal: string
  }[]
  totalEstimatedTime: number
  efficiencyTips: string[]
}

export interface IngredientCalculation {
  name: string
  category: string
  amount: string
  unit: string
  originalAmount: string
  isConsolidated: boolean
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
  prepOrder: string[]
  generalTips: string[]
}

export interface OpenAIConfig {
  apiKey: string
  model?: string
  language?: 'es' | 'en'
}

// GPT-5-mini - Cost-efficient model for text generation tasks
// See: https://platform.openai.com/docs/models/gpt-5-mini
// Fallback chain: gpt-5-mini -> gpt-4o-mini
const DEFAULT_MODEL = 'gpt-5-mini'
const FALLBACK_MODEL = 'gpt-4o-mini'
const LEGACY_FALLBACK = 'gpt-4o-mini'

// Spanish category translations for ingredients
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Produce': 'Frutas y Verduras',
  'Dairy': 'Lácteos',
  'Meat/Fish': 'Carnes y Pescados',
  'Meat': 'Carnes',
  'Fish': 'Pescados',
  'Seafood': 'Mariscos',
  'Bakery': 'Panadería',
  'Pantry': 'Despensa',
  'Frozen': 'Congelados',
  'Beverages': 'Bebidas',
  'Snacks': 'Snacks',
  'Health & Beauty': 'Salud y Belleza',
  'Household': 'Hogar',
  'Spices': 'Especias',
  'Condiments': 'Condimentos',
  'Oils': 'Aceites',
  'Grains': 'Granos y Cereales',
  'Pasta': 'Pastas',
  'Canned': 'Enlatados',
  'Sauces': 'Salsas'
}

// Spanish dietary restriction translations
const DIETARY_TRANSLATIONS: Record<DietaryRestriction, string> = {
  'vegetarian': 'vegetariano',
  'vegan': 'vegano',
  'keto': 'cetogénico (keto)',
  'low-carb': 'bajo en carbohidratos',
  'paleo': 'paleo',
  'gluten-free': 'sin gluten',
  'dairy-free': 'sin lácteos',
  'nut-free': 'sin frutos secos',
  'halal': 'halal',
  'kosher': 'kosher',
  'low-sodium': 'bajo en sodio',
  'low-fat': 'bajo en grasa',
  'high-protein': 'alto en proteína',
  'pescatarian': 'pescetariano'
}

/**
 * Get the next fallback model in the chain
 */
function getNextFallback(currentModel: string): string | null {
  if (currentModel === DEFAULT_MODEL) return FALLBACK_MODEL
  if (currentModel === FALLBACK_MODEL) return LEGACY_FALLBACK
  return null
}

/**
 * Call OpenAI API with a prompt
 * Uses GPT-5-mini as default with automatic fallback chain
 */
async function callOpenAI(
  apiKey: string,
  prompt: string,
  systemPrompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  try {
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
        max_tokens: 8000 // Increased for GPT-5.2's larger context
      })
    })

    if (!response.ok) {
      const nextModel = getNextFallback(model)
      if (nextModel) {
        logger.warn(`Model ${model} failed, trying fallback ${nextModel}`)
        return callOpenAI(apiKey, prompt, systemPrompt, nextModel)
      }
      const error = await response.text()
      throw new Error(`Error de API OpenAI: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  } catch (error) {
    const nextModel = getNextFallback(model)
    if (nextModel) {
      logger.warn(`Error with ${model}, trying fallback ${nextModel}`, error)
      return callOpenAI(apiKey, prompt, systemPrompt, nextModel)
    }
    throw error
  }
}

/**
 * Translate dietary restrictions to Spanish
 */
function translateDietaryRestrictions(restrictions: DietaryRestriction[]): string {
  return restrictions.map(r => DIETARY_TRANSLATIONS[r] || r).join(', ')
}

/**
 * Calculate scaled ingredients for meal prep - Spanish with metric system
 */
export async function calculateMealPrepIngredients(
  config: OpenAIConfig,
  request: MealPrepRequest
): Promise<{ ingredients: IngredientCalculation[]; error?: string }> {
  const dietaryNote = request.dietaryRestrictions?.length
    ? `\n\nRESTRICCIONES DIETÉTICAS IMPORTANTES: ${translateDietaryRestrictions(request.dietaryRestrictions)}
Asegúrate de que TODOS los ingredientes cumplan con estas restricciones. Sustituye ingredientes no compatibles con alternativas apropiadas.`
    : ''

  const systemPrompt = `Eres un chef profesional de meal prep y nutricionista experto.
Tu tarea es calcular las cantidades de ingredientes para preparación de comidas.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
IMPORTANTE: Usa SIEMPRE el sistema métrico decimal:
- Peso: gramos (g), kilogramos (kg)
- Volumen: mililitros (ml), litros (L)
- Para cantidades pequeñas: cucharadas (15ml), cucharaditas (5ml)
- Unidades: piezas, dientes, ramitas, etc.
Sé preciso con las medidas y siempre consolida ingredientes iguales de diferentes comidas.
Responde SIEMPRE en español.${dietaryNote}`

  const mealsSection = request.meals?.length
    ? `Comidas a preparar:
${request.meals.map((meal, i) => `
${i + 1}. ${meal.name}${meal.description ? ` - ${meal.description}` : ''}
   Categoría: ${meal.category || 'General'}
   Porciones necesarias: ${meal.servings}
   ${meal.existingIngredients?.length ? `Ingredientes conocidos: ${meal.existingIngredients.map(ing => `${ing.name}${ing.amount ? ` (${ing.amount})` : ''}`).join(', ')}` : ''}
`).join('\n')}`
    : 'Sin comidas especificadas'

  const prompt = `Calcula el total de ingredientes necesarios para este meal prep:

Número de personas: ${request.numberOfPeople}
Días de comidas: ${request.daysOfPrep}
Porciones totales necesarias: ${request.totalServings}
${request.dietaryRestrictions?.length ? `Restricciones dietéticas: ${translateDietaryRestrictions(request.dietaryRestrictions)}` : ''}

${mealsSection}

Responde con un objeto JSON en este formato exacto:
{
  "ingredients": [
    {
      "name": "nombre del ingrediente en español",
      "category": "Frutas y Verduras|Lácteos|Carnes y Pescados|Panadería|Despensa|Congelados|Bebidas|Especias|Granos y Cereales",
      "amount": "cantidad total necesaria (ej: '500g', '1kg', '250ml', '2L', '3 piezas')",
      "unit": "la unidad (ej: 'g', 'kg', 'ml', 'L', 'piezas')",
      "originalAmount": "cantidad por porción",
      "isConsolidated": true/false
    }
  ]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return { ingredients: parsed.ingredients }
  } catch (error) {
    logger.error('Error calculando ingredientes de meal prep:', error)
    return {
      ingredients: [],
      error: error instanceof Error ? error.message : 'Error al calcular ingredientes'
    }
  }
}

/**
 * Generate meal prep instructions for all meals - Spanish with metric system
 */
export async function generateMealPrepInstructions(
  config: OpenAIConfig,
  meals: { name: string; description?: string; servings: number; category?: string }[]
): Promise<{ instructions: MealPrepInstructions[]; prepOrder: string[]; generalTips: string[]; error?: string }> {
  const systemPrompt = `Eres un chef profesional experto en meal prep.
Tu tarea es proporcionar instrucciones detalladas de preparación, guía de almacenamiento y recalentamiento.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Sé práctico y enfócate en las mejores prácticas de meal prep para seguridad alimentaria y calidad.
Usa SIEMPRE el sistema métrico (gramos, kilogramos, litros, mililitros).
Responde SIEMPRE en español.`

  const prompt = `Genera instrucciones de meal prep para las siguientes comidas:

${meals.map((meal, i) => `
${i + 1}. ${meal.name}${meal.description ? ` - ${meal.description}` : ''}
   Categoría: ${meal.category || 'General'}
   Porciones a preparar: ${meal.servings}
`).join('\n')}

Para cada comida, proporciona:
1. Tiempos de preparación y cocción
2. Instrucciones paso a paso optimizadas para cocción en lote
3. Cómo almacenar (refrigerador/congelador, tamaño de contenedor)
4. Cuánto tiempo se conserva
5. Instrucciones de recalentamiento
6. Necesidades de contenedores

También sugiere el orden óptimo para preparar estas comidas para máxima eficiencia.

Responde con un objeto JSON en este formato exacto:
{
  "mealInstructions": [
    {
      "mealName": "nombre de la comida",
      "prepTime": número (minutos),
      "cookTime": número (minutos),
      "totalTime": número (minutos),
      "instructions": "Instrucciones paso a paso para cocción en lote de meal prep",
      "tips": "Consejos específicos de meal prep para este plato",
      "storageType": "refrigerator" | "freezer" | "pantry",
      "storageDays": número,
      "storageInstructions": "Cómo almacenar correctamente",
      "reheatingInstructions": "Cómo recalentar para mejores resultados",
      "containerSize": "small" | "medium" | "large" | "extra-large",
      "containerCount": número,
      "nutritionEstimate": {
        "calories": número,
        "protein": número (gramos),
        "carbs": número (gramos),
        "fat": número (gramos)
      }
    }
  ],
  "prepOrder": ["nombre de comida en orden de preparación para eficiencia"],
  "generalTips": ["consejos generales de meal prep aplicables a este lote"]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

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
    logger.error('Error generando instrucciones de meal prep:', error)
    return {
      instructions: [],
      prepOrder: [],
      generalTips: [],
      error: error instanceof Error ? error.message : 'Error al generar instrucciones'
    }
  }
}

/**
 * Generate a complete meal from just a name - Spanish with metric system
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
  const systemPrompt = `Eres un chef profesional y desarrollador de recetas.
Tu tarea es crear información detallada de comidas a partir de un nombre.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Proporciona ingredientes realistas con cantidades apropiadas para las porciones especificadas.
Usa SIEMPRE el sistema métrico (gramos, kilogramos, litros, mililitros).
Responde SIEMPRE en español.`

  const prompt = `Crea una receta completa para: "${mealName}"
Porciones: ${servings}

Proporciona:
1. Una breve descripción
2. Categoría (Carnes, Vegetariano, Mariscos, Pastas, Ensaladas, Sopas, Postres, Saludable, Comfort Food, Internacional)
3. Lista completa de ingredientes con cantidades en sistema métrico
4. Tiempos de preparación y cocción

Responde con un objeto JSON en este formato exacto:
{
  "description": "Breve descripción del plato en español",
  "category": "nombre de categoría",
  "ingredients": [
    {
      "name": "nombre del ingrediente en español",
      "amount": "cantidad para ${servings} porciones (ej: '500g', '1kg', '250ml')",
      "category": "Frutas y Verduras|Lácteos|Carnes y Pescados|Panadería|Despensa|Congelados|Bebidas|Especias"
    }
  ],
  "instructions": "Instrucciones de cocción paso a paso en español",
  "prepTime": número (minutos),
  "cookTime": número (minutos)
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return parsed
  } catch (error) {
    logger.error('Error generando detalles de comida:', error)
    return {
      description: '',
      category: 'General',
      ingredients: [],
      instructions: '',
      prepTime: 0,
      cookTime: 0,
      error: error instanceof Error ? error.message : 'Error al generar detalles de comida'
    }
  }
}

/**
 * Get container sorting and portioning guidance - Spanish with metric system
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
  const systemPrompt = `Eres un experto en organización de meal prep.
Tu tarea es proporcionar guía de contenedores y porciones.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Enfócate en tamaños prácticos de contenedores y organización eficiente.
Usa el sistema métrico (ml, L para volúmenes).
Responde SIEMPRE en español.`

  const prompt = `Proporciona guía de contenedores y porciones para este meal prep:

Número de personas por comida: ${numberOfPeople}
Días de comidas: ${daysOfPrep}

Comidas:
${meals.map((meal, i) => `${i + 1}. ${meal.name} - ${meal.servings} porciones (${meal.category || 'General'})`).join('\n')}

Para cada comida, recomienda:
1. Tamaño de contenedor (pequeño ~250ml, mediano ~500ml, grande ~1L, extra-grande ~1.5L+)
2. Número de contenedores necesarios
3. Tamaño de porción por contenedor
4. Sugerencia de etiqueta (qué escribir en el contenedor)

También proporciona consejos de organización para almacenar en refrigerador/congelador.

Responde con un objeto JSON en este formato exacto:
{
  "containerPlan": [
    {
      "mealName": "nombre de la comida",
      "containerSize": "small|medium|large|extra-large",
      "containerCount": número,
      "portionSize": "descripción de porción por contenedor en español",
      "labelSuggestion": "qué escribir en la etiqueta"
    }
  ],
  "organizationTips": ["consejos en español para organizar contenedores en refrigerador/congelador"]
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
    logger.error('Error obteniendo guía de contenedores:', error)
    return {
      containerPlan: [],
      organizationTips: [],
      error: error instanceof Error ? error.message : 'Error al obtener guía de contenedores'
    }
  }
}

/**
 * Generate smart scheduling optimization for meal prep - Spanish
 */
export async function generateSmartSchedule(
  config: OpenAIConfig,
  meals: { name: string; prepTime?: number; cookTime?: number; category?: string }[]
): Promise<SmartScheduleResult & { error?: string }> {
  const systemPrompt = `Eres un experto profesional en eficiencia de meal prep.
Tu tarea es crear un horario de cocción optimizado que maximice la eficiencia.
Considera tareas paralelas, reutilización de equipos y orden lógico de cocción.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Responde SIEMPRE en español.`

  const prompt = `Crea un horario optimizado de meal prep para estas comidas:

${meals.map((meal, i) => `
${i + 1}. ${meal.name}
   Categoría: ${meal.category || 'General'}
   ${meal.prepTime ? `Tiempo de preparación: ${meal.prepTime} min` : ''}
   ${meal.cookTime ? `Tiempo de cocción: ${meal.cookTime} min` : ''}
`).join('\n')}

Proporciona:
1. Orden óptimo para preparar las comidas
2. Tareas que pueden ejecutarse en paralelo (ej: mientras un plato hornea, preparar otro)
3. Lista de equipos necesarios
4. Cronograma mostrando qué hacer en cada momento
5. Tiempo total estimado
6. Consejos de eficiencia

Responde con un objeto JSON en este formato exacto:
{
  "optimizedOrder": ["nombres de comidas en orden óptimo de preparación"],
  "parallelTasks": [
    {
      "group": 1,
      "meals": ["comidas que pueden hacerse simultáneamente"],
      "reason": "por qué pueden ejecutarse en paralelo"
    }
  ],
  "equipmentNeeded": ["lista de todo el equipo necesario en español"],
  "timelineSteps": [
    {
      "time": "0:00",
      "action": "qué hacer en español",
      "meal": "para qué comida es"
    }
  ],
  "totalEstimatedTime": número (minutos),
  "efficiencyTips": ["consejos en español para máxima eficiencia"]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return {
      optimizedOrder: parsed.optimizedOrder,
      parallelTasks: parsed.parallelTasks,
      equipmentNeeded: parsed.equipmentNeeded,
      timelineSteps: parsed.timelineSteps,
      totalEstimatedTime: parsed.totalEstimatedTime,
      efficiencyTips: parsed.efficiencyTips
    }
  } catch (error) {
    logger.error('Error generando horario inteligente:', error)
    return {
      optimizedOrder: [],
      parallelTasks: [],
      equipmentNeeded: [],
      timelineSteps: [],
      totalEstimatedTime: 0,
      efficiencyTips: [],
      error: error instanceof Error ? error.message : 'Error al generar horario'
    }
  }
}

/**
 * Generate meal suggestions based on dietary restrictions - Spanish
 */
export async function suggestMealsForDiet(
  config: OpenAIConfig,
  dietaryRestrictions: DietaryRestriction[],
  numberOfMeals: number = 5
): Promise<{ meals: { name: string; description: string; category: string }[]; error?: string }> {
  const systemPrompt = `Eres un nutricionista profesional y chef.
Tu tarea es sugerir comidas que cumplan estrictamente con las restricciones dietéticas.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Responde SIEMPRE en español con nombres de comidas en español.`

  const prompt = `Sugiere ${numberOfMeals} comidas aptas para meal prep que cumplan con estas restricciones dietéticas: ${translateDietaryRestrictions(dietaryRestrictions)}

Cada comida debe:
1. Ser fácil de cocinar en lote
2. Conservarse bien por 3-5 días
3. Recalentarse bien
4. Ser nutricionalmente balanceada

Responde con un objeto JSON en este formato exacto:
{
  "meals": [
    {
      "name": "nombre de la comida en español",
      "description": "breve descripción en español",
      "category": "Carnes|Vegetariano|Mariscos|Pastas|Ensaladas|Sopas|Saludable|Comfort Food|Internacional"
    }
  ]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return { meals: parsed.meals }
  } catch (error) {
    logger.error('Error sugiriendo comidas:', error)
    return {
      meals: [],
      error: error instanceof Error ? error.message : 'Error al sugerir comidas'
    }
  }
}

/**
 * Parse instructions into individual steps for checklist - Spanish
 */
export async function parseInstructionsToSteps(
  config: OpenAIConfig,
  mealName: string,
  instructions: string
): Promise<{ steps: { instruction: string; estimatedTime: number }[]; error?: string }> {
  const systemPrompt = `Eres un analizador de instrucciones de cocina.
Tu tarea es dividir las instrucciones de cocina en pasos claros y accionables.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Responde SIEMPRE en español.`

  const prompt = `Divide estas instrucciones de cocina para "${mealName}" en pasos individuales:

${instructions}

Crea pasos claros y accionables con estimaciones de tiempo en minutos.

Responde con un objeto JSON en este formato exacto:
{
  "steps": [
    {
      "instruction": "paso de acción claro en español",
      "estimatedTime": número (minutos, puede ser 0 para pasos rápidos)
    }
  ]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return { steps: parsed.steps }
  } catch (error) {
    logger.error('Error analizando instrucciones:', error)
    return {
      steps: [],
      error: error instanceof Error ? error.message : 'Error al analizar instrucciones'
    }
  }
}

/**
 * Calculate ingredients for component-based meal prep
 * Handles proteins, carbs, and vegetables separately then combines
 */
export async function calculateComponentIngredients(
  config: OpenAIConfig,
  components: MealComponent[],
  servingsPerMeal: number,
  totalMeals: number,
  dietaryRestrictions?: DietaryRestriction[]
): Promise<{ ingredients: IngredientCalculation[]; error?: string }> {
  const dietaryNote = dietaryRestrictions?.length
    ? `\n\nRESTRICCIONES DIETÉTICAS: ${translateDietaryRestrictions(dietaryRestrictions)}`
    : ''

  const componentTypeNames: Record<MealComponentType, string> = {
    'protein': 'Proteína',
    'carb': 'Acompañamiento',
    'vegetable': 'Vegetales/Verduras'
  }

  // Total portions = servingsPerMeal × totalMeals (e.g., 2 people × 14 meals = 28 portions)
  const totalPortions = servingsPerMeal * totalMeals

  const systemPrompt = `Eres un chef profesional de meal prep y nutricionista experto.
Tu tarea es calcular ingredientes para componentes de comida individuales que se combinarán.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
IMPORTANTE:
- Usa SIEMPRE el sistema métrico decimal (g, kg, ml, L).
- Calcula cantidades REALISTAS para porciones normales de una persona.
- Una porción típica de proteína es 150-200g, de carbohidrato 150-200g, de verduras 100-150g.
Responde SIEMPRE en español.${dietaryNote}`

  const prompt = `Calcula el total de ingredientes para estos componentes de meal prep:

INFORMACIÓN IMPORTANTE:
- Personas por comida: ${servingsPerMeal}
- Total de comidas a preparar: ${totalMeals}
- TOTAL MÁXIMO DE PORCIONES: ${totalPortions} (si cada componente cubriera todas las comidas)

TAMAÑOS DE PORCIÓN ESTÁNDAR (por persona):
- Proteínas (pollo, carne, cerdo, pescado): 150-200g crudo por porción
- Acompañamientos (arroz, pasta, papas): 75-100g crudo por porción (150-200g cocido)
- Verduras/ensaladas: 100-150g por porción

COMPONENTES A CALCULAR:
${components.map((comp, i) => {
  const componentPortions = comp.servings * servingsPerMeal
  return `
${i + 1}. ${comp.name} (${componentTypeNames[comp.type]})
   ${comp.description ? `Descripción: ${comp.description}` : ''}
   Comidas que cubre: ${comp.servings} de ${totalMeals} comidas
   PORCIONES A CALCULAR: ${componentPortions} porciones (${comp.servings} comidas × ${servingsPerMeal} personas)
   ${comp.ingredients?.length ? `Ingredientes conocidos: ${comp.ingredients.map(ing => `${ing.name}${ing.amount ? ` (${ing.amount})` : ''}`).join(', ')}` : ''}`
}).join('\n')}

EJEMPLO DE CÁLCULO:
- Pollo para 7 comidas × 2 personas = 14 porciones
- Cantidad = 14 porciones × 175g/porción = 2.45kg de pollo crudo

IMPORTANTE: Calcula cantidades realistas. NO multipliques de más.

Responde con un objeto JSON en este formato exacto:
{
  "ingredients": [
    {
      "name": "nombre del ingrediente en español",
      "category": "Frutas y Verduras|Lácteos|Carnes y Pescados|Panadería|Despensa|Congelados|Especias|Granos y Cereales",
      "amount": "cantidad total (ej: '500g', '1kg', '250ml')",
      "unit": "la unidad (ej: 'g', 'kg', 'ml', 'L', 'piezas')",
      "originalAmount": "cantidad por porción",
      "isConsolidated": true/false
    }
  ]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return { ingredients: parsed.ingredients }
  } catch (error) {
    logger.error('Error calculando ingredientes de componentes:', error)
    return {
      ingredients: [],
      error: error instanceof Error ? error.message : 'Error al calcular ingredientes'
    }
  }
}

/**
 * Generate prep instructions for individual components
 */
export async function generateComponentInstructions(
  config: OpenAIConfig,
  components: MealComponent[]
): Promise<{
  instructions: MealPrepInstructions[]
  prepOrder: string[]
  generalTips: string[]
  error?: string
}> {
  const componentTypeNames: Record<MealComponentType, string> = {
    'protein': 'Proteína',
    'carb': 'Acompañamiento',
    'vegetable': 'Vegetales'
  }

  const systemPrompt = `Eres un chef profesional experto en meal prep.
Tu tarea es proporcionar instrucciones de preparación para cada componente individual.
Los componentes se preparan por separado y se combinarán después.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Usa SIEMPRE el sistema métrico (gramos, kilogramos, litros, mililitros).
Responde SIEMPRE en español.`

  const prompt = `Genera instrucciones de meal prep para estos componentes individuales:

${components.map((comp, i) => `
${i + 1}. ${comp.name} (${componentTypeNames[comp.type]})
   ${comp.description ? `Descripción: ${comp.description}` : ''}
   Porciones a preparar: ${comp.servings}
`).join('\n')}

Cada componente se prepara POR SEPARADO para ser combinado con otros.
Por ejemplo: la proteína (pollo) se prepara aparte, los carbohidratos (arroz) aparte, y las verduras aparte.

Para cada componente, proporciona:
1. Tiempos de preparación y cocción
2. Instrucciones paso a paso para preparación en lote
3. Cómo almacenar (refrigerador/congelador)
4. Cuánto tiempo se conserva
5. Cómo recalentar
6. Contenedores necesarios

También sugiere el orden óptimo para preparar estos componentes.

Responde con un objeto JSON en este formato exacto:
{
  "mealInstructions": [
    {
      "mealName": "nombre del componente",
      "prepTime": número (minutos),
      "cookTime": número (minutos),
      "totalTime": número (minutos),
      "instructions": "Instrucciones paso a paso para preparación en lote",
      "tips": "Consejos específicos para este componente",
      "storageType": "refrigerator" | "freezer" | "pantry",
      "storageDays": número,
      "storageInstructions": "Cómo almacenar correctamente",
      "reheatingInstructions": "Cómo recalentar",
      "containerSize": "small" | "medium" | "large" | "extra-large",
      "containerCount": número,
      "nutritionEstimate": {
        "calories": número,
        "protein": número (gramos),
        "carbs": número (gramos),
        "fat": número (gramos)
      }
    }
  ],
  "prepOrder": ["nombre de componente en orden de preparación"],
  "generalTips": ["consejos generales de meal prep"]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

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
    logger.error('Error generando instrucciones de componentes:', error)
    return {
      instructions: [],
      prepOrder: [],
      generalTips: [],
      error: error instanceof Error ? error.message : 'Error al generar instrucciones'
    }
  }
}

/**
 * Suggest component combinations for meal prep
 */
export async function suggestComponentCombinations(
  config: OpenAIConfig,
  proteins: MealComponent[],
  carbs: MealComponent[],
  vegetables: MealComponent[],
  daysOfPrep: number,
  mealsPerDay: number = 2,
  dietaryRestrictions?: DietaryRestriction[]
): Promise<{
  combinations: {
    day: number
    mealType: string
    protein: string
    carb: string
    vegetable: string
    description: string
  }[]
  error?: string
}> {
  const dietaryNote = dietaryRestrictions?.length
    ? `\nRestricciones dietéticas: ${translateDietaryRestrictions(dietaryRestrictions)}`
    : ''

  const systemPrompt = `Eres un nutricionista y chef experto en meal prep.
Tu tarea es crear combinaciones variadas y balanceadas de componentes de comida.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Responde SIEMPRE en español.`

  const prompt = `Crea combinaciones de comidas para ${daysOfPrep} días con ${mealsPerDay} comidas principales por día.
${dietaryNote}

PROTEÍNAS DISPONIBLES:
${proteins.map(p => `- ${p.name}`).join('\n')}

ACOMPAÑAMIENTOS DISPONIBLES:
${carbs.map(c => `- ${c.name}`).join('\n')}

VEGETALES/VERDURAS DISPONIBLES:
${vegetables.map(v => `- ${v.name}`).join('\n')}

Crea combinaciones variadas que:
1. No repitan la misma proteína en el mismo día
2. Varíen los carbohidratos a lo largo de la semana
3. Incluyan diferentes verduras para variedad nutricional
4. Sean combinaciones que funcionen bien juntas en sabor

Responde con un objeto JSON en este formato exacto:
{
  "combinations": [
    {
      "day": 1,
      "mealType": "lunch" | "dinner",
      "protein": "nombre de la proteína",
      "carb": "nombre del carbohidrato",
      "vegetable": "nombre del vegetal",
      "description": "breve descripción de por qué esta combinación funciona"
    }
  ]
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return { combinations: parsed.combinations }
  } catch (error) {
    logger.error('Error sugiriendo combinaciones:', error)
    return {
      combinations: [],
      error: error instanceof Error ? error.message : 'Error al sugerir combinaciones'
    }
  }
}

/**
 * Generate details for a single component
 */
export async function generateComponentDetails(
  config: OpenAIConfig,
  componentName: string,
  componentType: MealComponentType,
  servings: number
): Promise<{
  description: string
  ingredients: { name: string; amount: string; category: string }[]
  instructions: string
  prepTime: number
  cookTime: number
  error?: string
}> {
  const componentTypeNames: Record<MealComponentType, string> = {
    'protein': 'proteína (carne, pollo, pescado, huevos, legumbres)',
    'carb': 'carbohidrato/acompañamiento (arroz, pasta, patatas, pan)',
    'vegetable': 'vegetales/verduras (ensalada, brócoli, espinacas)'
  }

  const systemPrompt = `Eres un chef profesional y desarrollador de recetas.
Tu tarea es crear información detallada para un componente de comida.
DEBES responder ÚNICAMENTE con JSON válido, sin texto adicional.
Usa SIEMPRE el sistema métrico (gramos, kilogramos, litros, mililitros).
Responde SIEMPRE en español.`

  const prompt = `Crea una receta completa para el componente: "${componentName}"
Tipo de componente: ${componentTypeNames[componentType]}
Porciones: ${servings}

Este componente se preparará por separado para meal prep y se combinará con otros componentes.

Proporciona:
1. Una breve descripción
2. Lista completa de ingredientes con cantidades en sistema métrico
3. Instrucciones de preparación
4. Tiempos de preparación y cocción

Responde con un objeto JSON en este formato exacto:
{
  "description": "Breve descripción del componente en español",
  "ingredients": [
    {
      "name": "nombre del ingrediente en español",
      "amount": "cantidad para ${servings} porciones (ej: '500g', '1kg', '250ml')",
      "category": "Frutas y Verduras|Lácteos|Carnes y Pescados|Despensa|Especias"
    }
  ],
  "instructions": "Instrucciones de preparación paso a paso en español",
  "prepTime": número (minutos),
  "cookTime": número (minutos)
}`

  try {
    const response = await callOpenAI(config.apiKey, prompt, systemPrompt, config.model)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return parsed
  } catch (error) {
    logger.error('Error generando detalles de componente:', error)
    return {
      description: '',
      ingredients: [],
      instructions: '',
      prepTime: 0,
      cookTime: 0,
      error: error instanceof Error ? error.message : 'Error al generar detalles'
    }
  }
}
