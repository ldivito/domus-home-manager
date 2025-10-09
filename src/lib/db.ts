import Dexie, { Table } from 'dexie'
import { generateId } from './utils'
import { checkMigrationNeeded, performMigration, importMigratedData, isMigrationCompleted } from './migration'

export interface User {
  id?: string
  name: string
  email?: string
  avatar?: string
  color: string
  type: 'resident' | 'guest'
  householdId?: string
  createdAt: Date
}

export interface Chore {
  id?: string
  title: string
  description?: string
  householdId?: string
  assignedUserId?: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  customFrequency?: {
    type: 'times_per_day' | 'times_per_week' | 'times_per_month' | 'days_interval'
    value: number
    specificDays?: number[] // For weekly: 0=Sunday, 1=Monday, etc.
  }
  scheduledTime?: string // HH:MM format
  lastCompleted?: Date
  lastCompletedBy?: string // User ID who completed it
  nextDue: Date
  isCompleted: boolean
  completedAt?: Date // Timestamp when marked complete
  createdAt: Date
}

export interface GroceryItem {
  id?: string
  name: string
  category: string
  amount: string
  importance: 'low' | 'medium' | 'high'
  householdId?: string
  addedBy?: string
  createdAt: Date
}

export interface GroceryCategory {
  id?: string
  name: string
  color?: string
  isDefault: boolean
  householdId?: string
  locale?: string // For user-created categories, store the language they were created in
  createdAt: Date
}

export interface SavedGroceryItem {
  id?: string
  name: string
  category: string
  amount?: string
  importance?: 'low' | 'medium' | 'high'
  householdId?: string
  addedBy?: string
  timesUsed: number
  lastUsed?: Date
  createdAt: Date
}

export interface MealIngredient {
  id?: string
  savedGroceryItemId: string
  amount?: string
  usageNotes?: string
}

export interface Task {
  id?: string
  title: string
  description?: string
  householdId?: string
  assignedUserId?: string
  dueDate?: Date
  priority: 'low' | 'medium' | 'high'
  isCompleted: boolean
  createdAt: Date
}

export interface HomeImprovement {
  id?: string
  title: string
  description?: string
  status: 'todo' | 'in-progress' | 'done'
  householdId?: string
  assignedUserId?: string
  estimatedCost?: number
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
}

export interface Meal {
  id?: string
  title: string
  description?: string
  date: Date
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  householdId?: string
  assignedUserId?: string
  ingredients?: MealIngredient[]
  createdAt: Date
}

export interface MealCategory {
  id?: string
  name: string
  color?: string
  isDefault: boolean
  householdId?: string
  locale?: string
  createdAt: Date
}

export interface SavedMeal {
  id?: string
  name: string
  description?: string
  category: string
  householdId?: string
  ingredients: MealIngredient[]
  timesUsed: number
  lastUsed?: Date
  createdAt: Date
}

export interface Reminder {
  id?: string
  title: string
  description?: string
  reminderTime: Date
  isCompleted: boolean
  householdId?: string
  userId?: string
  type: 'general' | 'chore' | 'task' | 'meal'
  createdAt: Date
}

export interface CalendarEvent {
  id?: string
  title: string
  description?: string
  // Calendar date of the event (date component). Time is stored separately in `time` to avoid TZ issues
  date: Date
  // Optional 24h time string HH:MM
  time?: string
  type: 'task' | 'meal' | 'reminder' | 'general'
  householdId?: string
  relatedId?: string
  // Multiple users can be assigned to an event
  userIds?: string[]
  createdAt: Date
}

export interface Household {
  id?: string
  name: string
  description?: string
  owner?: string // User ID of the household owner
  members?: string[] // Array of user IDs who are members
  inviteCode?: string // Code for inviting new members
  createdAt: Date
  updatedAt: Date
}

export interface HouseholdMember {
  id?: string
  householdId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: Date
  permissions?: {
    canManageMembers?: boolean
    canManageSettings?: boolean
    canDeleteItems?: boolean
  }
}

export interface HomeSettings {
  id?: string
  householdId?: string
  // Basic Home Information
  homeName?: string
  homeType?: 'house' | 'apartment' | 'condo' | 'townhouse' | 'other'
  address?: {
    street?: string
    city?: string
    stateProvince?: string
    postalCode?: string
    country?: string
  }
  // Home Details
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  yearBuilt?: number
  // Emergency Contacts
  emergencyContact?: {
    name?: string
    phone?: string
    relationship?: string
  }
  // Property Information
  propertyManager?: {
    name?: string
    phone?: string
    email?: string
  }
  // Service Contacts
  serviceContacts?: Array<{
    id: string
    type: 'plumber' | 'electrician' | 'hvac' | 'handyman' | 'cleaning' | 'landscaping' | 'other'
    name: string
    phone?: string
    email?: string
    notes?: string
  }>
  // Home Preferences
  preferences?: {
    defaultTemperature?: number
    temperatureUnit?: 'celsius' | 'fahrenheit'
    timezone?: string
    startOfWeek?: 'sunday' | 'monday'
  }
  // Important Information (stored locally only, never exported for security)
  privateInfo?: {
    wifiNetworkName?: string
    wifiPassword?: string
    securityCodes?: Array<{
      id: string
      name: string
      code: string
      notes?: string
    }>
  }
  // Important Dates
  importantDates?: Array<{
    id: string
    name: string
    date: Date
    recurring?: boolean
    reminderDays?: number
    notes?: string
  }>
  // General Notes
  notes?: string
  lastUpdated: Date
  createdAt: Date
}

export interface KetoSettings {
  id?: string
  householdId?: string
  userId: string // User who owns this keto plan
  startDate: Date // When they started the keto diet
  createdAt: Date
  updatedAt: Date
}

export interface KetoDay {
  id?: string
  householdId?: string
  userId: string // User who owns this keto plan
  date: Date // The date for this keto day (date component only)
  status: 'success' | 'fasting' | 'cheat' // ✓ for success, ✓🕐 for fasting, ✗ for cheat day
  createdAt: Date
  updatedAt: Date
}

export class DomusDatabase extends Dexie {
  users!: Table<User>
  households!: Table<Household>
  householdMembers!: Table<HouseholdMember>
  chores!: Table<Chore>
  groceryItems!: Table<GroceryItem>
  groceryCategories!: Table<GroceryCategory>
  savedGroceryItems!: Table<SavedGroceryItem>
  tasks!: Table<Task>
  homeImprovements!: Table<HomeImprovement>
  meals!: Table<Meal>
  mealCategories!: Table<MealCategory>
  savedMeals!: Table<SavedMeal>
  reminders!: Table<Reminder>
  calendarEvents!: Table<CalendarEvent>
  homeSettings!: Table<HomeSettings>
  ketoSettings!: Table<KetoSettings>
  ketoDays!: Table<KetoDay>
  private legacyMealIngredientMigrationComplete = false
  private legacyMealIngredientMigrationPromise?: Promise<void>

  constructor() {
    super('DomusDatabase')

    // v14: Introduce structured meal ingredients
    this.version(14).stores({
      users: 'id, name, email, color, type, householdId',
      households: 'id, name, owner, createdAt, updatedAt',
      householdMembers: 'id, householdId, userId, role, joinedAt',
      chores: 'id, title, householdId, assignedUserId, frequency, nextDue, isCompleted',
      groceryItems: 'id, name, householdId, category, importance, addedBy, createdAt',
      groceryCategories: 'id, name, householdId, isDefault, locale, createdAt',
      savedGroceryItems: 'id, name, householdId, category, importance, timesUsed, lastUsed, createdAt',
      tasks: 'id, title, householdId, assignedUserId, dueDate, priority, isCompleted, createdAt',
      homeImprovements: 'id, title, householdId, status, assignedUserId, priority, createdAt',
      meals: 'id, title, householdId, date, mealType, assignedUserId',
      mealCategories: 'id, name, householdId, isDefault, locale, createdAt',
      savedMeals: 'id, name, householdId, category, timesUsed, lastUsed, createdAt',
      reminders: 'id, title, householdId, reminderTime, isCompleted, userId, type',
      calendarEvents: 'id, title, householdId, date, type',
      homeSettings: 'id, householdId, homeName, lastUpdated, createdAt',
      ketoSettings: 'id, householdId, userId, startDate, createdAt, updatedAt',
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt'
    })

    this.version(14).upgrade(async (tx) => {
      type LegacyMeal = Meal & { ingredientIds?: string[] }
      type LegacySavedMeal = Omit<SavedMeal, 'ingredients'> & {
        ingredientIds?: string[]
        ingredients?: MealIngredient[]
      }

      const savedItems = await tx.table('savedGroceryItems').toArray()
      const savedItemMap = new Map<string, typeof savedItems[number]>
      for (const item of savedItems) {
        if (item.id) {
          savedItemMap.set(String(item.id), item)
        }
      }

      const convertIngredients = (ids?: string[]) => {
        if (!ids?.length) return undefined
        return ids.map((id) => ({
          id: generateId('ing'),
          savedGroceryItemId: String(id),
          amount: savedItemMap.get(String(id))?.amount || undefined
        }))
      }

      const meals = await tx.table('meals').toArray() as LegacyMeal[]
      for (const meal of meals) {
        if (!meal.id) continue
        if (meal.ingredientIds?.length) {
          const ingredients = convertIngredients(meal.ingredientIds)
          await tx.table('meals').update(meal.id, {
            ingredients
          })
          await tx
            .table('meals')
            .where('id')
            .equals(meal.id)
            .modify((record) => {
              delete (record as LegacyMeal).ingredientIds
            })
        }
      }

      const savedMeals = await tx.table('savedMeals').toArray() as LegacySavedMeal[]
      for (const savedMeal of savedMeals) {
        if (!savedMeal.id) continue
        if (savedMeal.ingredientIds?.length) {
          const ingredients = convertIngredients(savedMeal.ingredientIds)
          await tx.table('savedMeals').update(savedMeal.id, {
            ingredients
          })
          await tx
            .table('savedMeals')
            .where('id')
            .equals(savedMeal.id)
            .modify((record) => {
              delete (record as LegacySavedMeal).ingredientIds
            })
        }
      }
    })

    // v13: Add fasting support to Keto tracking
    this.version(13).stores({
      users: 'id, name, email, color, type, householdId',
      households: 'id, name, owner, createdAt, updatedAt',
      householdMembers: 'id, householdId, userId, role, joinedAt',
      chores: 'id, title, householdId, assignedUserId, frequency, nextDue, isCompleted',
      groceryItems: 'id, name, householdId, category, importance, addedBy, createdAt',
      groceryCategories: 'id, name, householdId, isDefault, locale, createdAt',
      savedGroceryItems: 'id, name, householdId, category, importance, timesUsed, lastUsed, createdAt',
      tasks: 'id, title, householdId, assignedUserId, dueDate, priority, isCompleted, createdAt',
      homeImprovements: 'id, title, householdId, status, assignedUserId, priority, createdAt',
      meals: 'id, title, householdId, date, mealType, assignedUserId',
      mealCategories: 'id, name, householdId, isDefault, locale, createdAt',
      savedMeals: 'id, name, householdId, category, timesUsed, lastUsed, createdAt',
      reminders: 'id, title, householdId, reminderTime, isCompleted, userId, type',
      calendarEvents: 'id, title, householdId, date, type',
      homeSettings: 'id, householdId, homeName, lastUpdated, createdAt',
      ketoSettings: 'id, householdId, userId, startDate, createdAt, updatedAt',
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt'
    })

    // Migration for fasting support in Keto tracking (v13 upgrade)
    this.version(13).upgrade(async () => {
      console.log('Database upgraded to v13 with fasting support in Keto tracking')
    })

    // Database ready handler
    this.on('ready', async () => {
      console.log('Database ready - local IndexedDB mode')

      try {
        // Check if we have migrated data to import
        await importMigratedData(this)
      } catch (error) {
        console.error('Error importing migrated data:', error)
      }

      try {
        await this.ensureMealIngredientStructure()
      } catch (error) {
        console.warn('Meal ingredient migration issue:', error)
      }

      // Seed default categories if needed
      await this.seedDefaultCategoriesIfNeeded()
    })
  }

  async ensureMealIngredientStructure(): Promise<void> {
    if (this.legacyMealIngredientMigrationComplete) return
    if (this.legacyMealIngredientMigrationPromise) {
      return this.legacyMealIngredientMigrationPromise
    }

    type LegacyIngredientRecord = {
      ingredientIds?: string[]
      ingredients?: MealIngredient[]
    }

    const migration = this.transaction('rw', this.savedGroceryItems, this.meals, this.savedMeals, async () => {
      const savedItems = await this.savedGroceryItems.toArray()
      const savedItemMap = new Map<string, SavedGroceryItem>()

      for (const item of savedItems) {
        if (item.id) {
          savedItemMap.set(String(item.id), item)
        }
      }

      const convertLegacyIngredients = (ids?: string[]) => {
        if (!ids?.length) return []

        return ids.map((id) => ({
          id: generateId('ing'),
          savedGroceryItemId: String(id),
          amount: savedItemMap.get(String(id))?.amount || undefined,
        }))
      }

      const migrateRecords = async <T extends { id?: string }>(table: Table<T, string>) => {
        const records = await table.toArray()

        for (const record of records) {
          const legacyRecord = record as T & LegacyIngredientRecord
          const id = legacyRecord.id
          if (!id) continue
          const recordId = id

          const hasStructuredIngredients = Array.isArray(legacyRecord.ingredients) && legacyRecord.ingredients.length > 0
          const legacyIds = legacyRecord.ingredientIds
          if (!legacyIds?.length) continue

          const converted = !hasStructuredIngredients
            ? convertLegacyIngredients(legacyIds)
            : undefined

          await table
            .where('id')
            .equals(recordId)
            .modify((entry) => {
              const legacyEntry = entry as LegacyIngredientRecord
              if (converted?.length) {
                legacyEntry.ingredients = converted
              }
              delete legacyEntry.ingredientIds
            })
        }
      }

      await migrateRecords(this.meals)
      await migrateRecords(this.savedMeals)
    })

    this.legacyMealIngredientMigrationPromise = migration
      .then(() => {
        this.legacyMealIngredientMigrationComplete = true
      })
      .catch((error) => {
        console.error('Error migrating legacy meal ingredients:', error)
        throw error
      })
      .finally(() => {
        this.legacyMealIngredientMigrationPromise = undefined
      })

    return this.legacyMealIngredientMigrationPromise
  }

  // Helper method to seed default categories for new databases
  async seedDefaultCategoriesIfNeeded(): Promise<void> {
    try {
      const categoryCount = await this.groceryCategories.count()
      if (categoryCount > 0) return // Already seeded

      const now = new Date()

      // Add default grocery categories
      await this.groceryCategories.bulkAdd([
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.produce', color: '#10b981', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.dairy', color: '#3b82f6', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.meatFish', color: '#ef4444', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.bakery', color: '#f59e0b', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.pantry', color: '#8b5cf6', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.frozen', color: '#06b6d4', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.beverages', color: '#84cc16', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.snacks', color: '#f97316', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.healthBeauty', color: '#ec4899', isDefault: true, locale: undefined, createdAt: now },
        { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.household', color: '#6b7280', isDefault: true, locale: undefined, createdAt: now }
      ])

      // Add default meal categories
      await this.mealCategories.bulkAdd([
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.meat', color: '#dc2626', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.vegetarian', color: '#16a34a', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.seafood', color: '#06b6d4', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.pasta', color: '#f59e0b', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.salad', color: '#10b981', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.soup', color: '#ef4444', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.dessert', color: '#ec4899', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.healthy', color: '#84cc16', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.comfort', color: '#8b5cf6', isDefault: true, locale: undefined, createdAt: now },
        { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.international', color: '#6b7280', isDefault: true, locale: undefined, createdAt: now }
      ])

      console.log('Default categories seeded successfully')
    } catch (error) {
      console.error('Error seeding default categories:', error)
    }
  }
}

/**
 * Initialize database with migration check
 */
async function initializeDatabase(): Promise<DomusDatabase> {
  // Check if migration is needed BEFORE opening database
  if (!isMigrationCompleted()) {
    const migrationStatus = await checkMigrationNeeded()
    if (migrationStatus.needsMigration) {
      console.log('Legacy database detected, performing migration...')
      const migrationResult = await performMigration()
      if (!migrationResult.success) {
        console.error('Migration failed:', migrationResult.error)
        // Continue anyway to try opening the database
      } else {
        console.log('Migration successful:', migrationResult)
      }
    }
  }

  // Now create and return the database instance
  return new DomusDatabase()
}

// Export a single database instance (lazily initialized)
let dbInstance: DomusDatabase | null = null
let dbInitPromise: Promise<DomusDatabase> | null = null

export async function getDatabase(): Promise<DomusDatabase> {
  if (dbInstance) return dbInstance

  if (!dbInitPromise) {
    dbInitPromise = initializeDatabase().then(instance => {
      dbInstance = instance
      return instance
    })
  }

  return dbInitPromise
}

// Export synchronous instance for backward compatibility
// NOTE: This will not have migration support, use getDatabase() for full migration support
export const db = new DomusDatabase()
