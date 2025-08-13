import Dexie, { Table } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'

export interface User {
  id?: string // Changed to string for cloud compatibility
  name: string
  email?: string // For cloud authentication
  avatar?: string
  color: string
  type: 'resident' | 'guest'
  householdId?: string // Link to household
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
  ingredientIds?: string[] // Array of SavedGroceryItem IDs
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
  ingredientIds: string[] // Array of SavedGroceryItem IDs
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
  id?: string // Cloud ID for household
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
  id?: string // Changed to string for cloud compatibility
  householdId?: string // Link to household
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

  constructor() {
    super('DomusDatabase', { addons: [dexieCloud] })
    
    // Configure Dexie Cloud
    this.cloud.configure({
      databaseUrl: process.env.NEXT_PUBLIC_DEXIE_CLOUD_URL || 'https://zjuoc6zhr.dexie.cloud',
      tryUseServiceWorker: process.env.NEXT_PUBLIC_DEXIE_USE_SERVICE_WORKER === 'true' || false, // Disable for Next.js compatibility
      requireAuth: process.env.NEXT_PUBLIC_DEXIE_REQUIRE_AUTH !== 'false', // Require authentication for all operations
      unsyncedTables: process.env.NEXT_PUBLIC_DEXIE_UNSYNCED_TABLES?.split(',').filter(Boolean) || [], // All tables are synced by default
      customLoginGui: process.env.NEXT_PUBLIC_DEXIE_CUSTOM_LOGIN_GUI !== 'false' // Disable default login GUI - we handle it ourselves
    })

    // v11: Add Dexie Cloud support with household management
    this.version(11).stores({
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
      homeSettings: 'id, householdId, homeName, lastUpdated, createdAt'
    })
    
    // Migration from local storage to cloud (v11 upgrade)
    this.version(11).upgrade(async () => {
      // This migration will handle transitioning from local-only to cloud-enabled
      // Users will need to authenticate and create/join households
      console.log('Database upgraded to v11 with Dexie Cloud support')
    })
    
    // v10: Add home settings for personalization (legacy version)
    this.version(10).stores({
      users: '++id, name, color, type',
      chores: '++id, title, assignedUserId, frequency, nextDue, isCompleted',
      groceryItems: '++id, name, category, importance, addedBy, createdAt',
      groceryCategories: '++id, name, isDefault, locale, createdAt',
      savedGroceryItems: '++id, name, category, importance, timesUsed, lastUsed, createdAt',
      tasks: '++id, title, assignedUserId, dueDate, priority, isCompleted, createdAt',
      homeImprovements: '++id, title, status, assignedUserId, priority, createdAt',
      meals: '++id, title, date, mealType, assignedUserId',
      mealCategories: '++id, name, isDefault, locale, createdAt',
      savedMeals: '++id, name, category, timesUsed, lastUsed, createdAt',
      reminders: '++id, title, reminderTime, isCompleted, userId, type',
      // Index by date and type for efficient filtering
      calendarEvents: '++id, title, date, type',
      homeSettings: '++id, homeName, lastUpdated, createdAt'
    })

    // v9: Add multi-user support and time for calendar events
    this.version(9).stores({
      users: '++id, name, color, type',
      chores: '++id, title, assignedUserId, frequency, nextDue, isCompleted',
      groceryItems: '++id, name, category, importance, addedBy, createdAt',
      groceryCategories: '++id, name, isDefault, locale, createdAt',
      savedGroceryItems: '++id, name, category, importance, timesUsed, lastUsed, createdAt',
      tasks: '++id, title, assignedUserId, dueDate, priority, isCompleted, createdAt',
      homeImprovements: '++id, title, status, assignedUserId, priority, createdAt',
      meals: '++id, title, date, mealType, assignedUserId',
      mealCategories: '++id, name, isDefault, locale, createdAt',
      savedMeals: '++id, name, category, timesUsed, lastUsed, createdAt',
      reminders: '++id, title, reminderTime, isCompleted, userId, type',
      // Index by date and type for efficient filtering
      calendarEvents: '++id, title, date, type'
    })

    // Upgrade existing calendar events to new structure
    this.version(9).upgrade(async (tx) => {
      type LegacyEvent = CalendarEvent & { userId?: number; userIds?: number[]; createdAt?: Date }
      const events = await tx.table('calendarEvents').toArray() as LegacyEvent[]
      for (const evt of events) {
        const updates: Partial<CalendarEvent> = {}
        if (evt.userId && !evt.userIds) {
          updates.userIds = [String(evt.userId)]
        }
        if (!evt.createdAt) {
          updates.createdAt = new Date()
        }
        if (Object.keys(updates).length > 0) {
          await tx.table('calendarEvents').update(evt.id, updates)
        }
      }
    })

    // Add createdAt to existing home improvements (version 8 upgrade)
    this.version(8).upgrade(async (tx) => {
      const homeImprovements = await tx.table('homeImprovements').toArray()
      
      // Add createdAt to home improvements that don't have it
      for (const project of homeImprovements) {
        if (!project.createdAt) {
          await tx.table('homeImprovements').update(project.id, { createdAt: new Date() })
        }
      }
    })

    // Add createdAt to existing tasks (version 7 upgrade)
    this.version(7).upgrade(async (tx) => {
      const tasks = await tx.table('tasks').toArray()
      
      // Add createdAt to tasks that don't have it
      for (const task of tasks) {
        if (!task.createdAt) {
          await tx.table('tasks').update(task.id, { createdAt: new Date() })
        }
      }
    })

    // Fix invalid meal categories that use meal types instead of categories
    this.version(6).upgrade(async (tx) => {
      const savedMeals = await tx.table('savedMeals').toArray()
      const validMealCategories = [
        'defaultMealCategories.meat', 'defaultMealCategories.vegetarian', 'defaultMealCategories.seafood',
        'defaultMealCategories.pasta', 'defaultMealCategories.salad', 'defaultMealCategories.soup',
        'defaultMealCategories.dessert', 'defaultMealCategories.healthy', 'defaultMealCategories.comfort',
        'defaultMealCategories.international'
      ]

      // Fix saved meals with invalid categories (especially breakfast/snack which are meal types)
      for (const savedMeal of savedMeals) {
        if (!validMealCategories.includes(savedMeal.category)) {
          // Default to meat category if category is invalid
          await tx.table('savedMeals').update(savedMeal.id, { category: 'defaultMealCategories.meat' })
        }
      }
    })

    // Migrate existing categories to use translation keys
    this.version(3).upgrade(async (tx) => {
      const categories = await tx.table('groceryCategories').toArray()
      
      // Migration mapping for old bilingual names to translation keys
      const migrationMap: Record<string, string> = {
        'Produce / Productos': 'defaultCategories.produce',
        'Dairy / Lácteos': 'defaultCategories.dairy',
        'Meat & Fish / Carnes y Pescado': 'defaultCategories.meatFish',
        'Bakery / Panadería': 'defaultCategories.bakery',
        'Pantry / Despensa': 'defaultCategories.pantry',
        'Frozen / Congelados': 'defaultCategories.frozen',
        'Beverages / Bebidas': 'defaultCategories.beverages',
        'Snacks / Aperitivos': 'defaultCategories.snacks',
        'Health & Beauty / Salud y Belleza': 'defaultCategories.healthBeauty',
        'Household / Hogar': 'defaultCategories.household'
      }

      // Update existing categories
      for (const category of categories) {
        const newName = migrationMap[category.name]
        if (newName) {
          await tx.table('groceryCategories').update(category.id, { name: newName })
          
          // Also update grocery items that use this category
          const itemsWithCategory = await tx.table('groceryItems')
            .where('category').equals(category.name).toArray()
          
          for (const item of itemsWithCategory) {
            await tx.table('groceryItems').update(item.id, { category: newName })
          }
        }
      }
    })

    // Initialize cloud connection and sync
    this.on('ready', async () => {
      console.log('Database ready with Dexie Cloud support')
      
      try {
        // Ensure cloud sync is enabled
        const url = this.cloud?.options?.databaseUrl
        if (url && !url.includes('localhost')) {
          console.log('Connecting to Dexie Cloud:', url)
        }
      } catch (error) {
        console.warn('Dexie Cloud connection issue:', error)
      }
    })
  }

  // Helper methods for household management
  async getCurrentUserHouseholdId(): Promise<string | null> {
    try {
      const currentUser = this.cloud.currentUser.value
      if (!currentUser?.userId) return null
      
      const user = await this.users.get(`usr_${currentUser.userId}`)
      return user?.householdId || null
    } catch (error) {
      console.error('Error getting current user household:', error)
      return null
    }
  }

  async createHousehold(name: string, description?: string): Promise<string> {
    const currentUser = this.cloud.currentUser.value
    if (!currentUser?.userId) {
      throw new Error('User must be authenticated to create household')
    }

    const householdId = `hsh_${crypto.randomUUID()}`
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()
    const now = new Date()

    // Create household
    await this.households.add({
      id: householdId,
      name,
      description,
      owner: currentUser.userId,
      members: [currentUser.userId],
      inviteCode,
      createdAt: now,
      updatedAt: now
    })

    // Add user as household owner
    await this.householdMembers.add({
      id: `hmbr_${crypto.randomUUID()}`,
      householdId,
      userId: currentUser.userId,
      role: 'owner',
      joinedAt: now,
      permissions: {
        canManageMembers: true,
        canManageSettings: true,
        canDeleteItems: true
      }
    })

    // Update user's household ID
    await this.users.update(`usr_${currentUser.userId}`, { householdId })

    // Create default categories for this household
    await this.seedDefaultCategories(householdId)

    return householdId
  }

  async seedDefaultCategories(householdId: string): Promise<void> {
    const now = new Date()
    
    // Add default grocery categories
    await this.groceryCategories.bulkAdd([
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.produce', color: '#10b981', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.dairy', color: '#3b82f6', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.meatFish', color: '#ef4444', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.bakery', color: '#f59e0b', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.pantry', color: '#8b5cf6', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.frozen', color: '#06b6d4', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.beverages', color: '#84cc16', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.snacks', color: '#f97316', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.healthBeauty', color: '#ec4899', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `gcat_${crypto.randomUUID()}`, name: 'defaultCategories.household', color: '#6b7280', isDefault: true, householdId, locale: undefined, createdAt: now }
    ])

    // Add default meal categories
    await this.mealCategories.bulkAdd([
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.meat', color: '#dc2626', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.vegetarian', color: '#16a34a', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.seafood', color: '#06b6d4', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.pasta', color: '#f59e0b', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.salad', color: '#10b981', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.soup', color: '#ef4444', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.dessert', color: '#ec4899', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.healthy', color: '#84cc16', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.comfort', color: '#8b5cf6', isDefault: true, householdId, locale: undefined, createdAt: now },
      { id: `mcat_${crypto.randomUUID()}`, name: 'defaultMealCategories.international', color: '#6b7280', isDefault: true, householdId, locale: undefined, createdAt: now }
    ])
  }
}

// Local-only database (no cloud addon). Used when in offline mode.
export class LocalDomusDatabase extends Dexie {
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

  constructor() {
    super('DomusLocalDatabase')

    // Use same v11 schema but without cloud
    this.version(11).stores({
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
      homeSettings: 'id, householdId, homeName, lastUpdated, createdAt'
    })

    this.on('ready', async () => {
      try {
        // Optional: seed nothing by default; users can create their own
        // console.log('Local database ready')
      } catch (err) {
        console.warn('Local DB init error:', err)
      }
    })
  }
}

function getInitialMode(): 'cloud' | 'offline' {
  if (typeof window === 'undefined') return 'cloud'
  const mode = localStorage.getItem('domusMode')
  return mode === 'offline' ? 'offline' : 'cloud'
}

let currentMode: 'cloud' | 'offline' = getInitialMode()
let currentDb: DomusDatabase | LocalDomusDatabase =
  currentMode === 'offline' ? new LocalDomusDatabase() : new DomusDatabase()

// Proxy so `db.*` always routes to the active database instance
export const db = new Proxy({} as DomusDatabase & LocalDomusDatabase, {
  get(_target, prop) {
    return (currentDb as unknown as Record<string | symbol, unknown>)[prop as string]
  },
  set(_target, prop, value) {
    ;(currentDb as unknown as Record<string | symbol, unknown>)[prop as string] = value
    return true
  },
})

export function switchDbMode(mode: 'cloud' | 'offline') {
  if (mode === currentMode) return
  try { localStorage.setItem('domusMode', mode) } catch {}
  try {
    // Close previous instance to free resources
    ;(currentDb as unknown as { close?: () => void }).close?.()
  } catch {}
  currentDb = mode === 'offline' ? new LocalDomusDatabase() : new DomusDatabase()
  currentMode = mode
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('domus:db-switched', { detail: { mode } }))
  }
}

export function getDbMode() {
  return currentMode
}