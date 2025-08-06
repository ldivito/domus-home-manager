import Dexie, { Table } from 'dexie'

export interface User {
  id?: number
  name: string
  avatar?: string
  color: string
  type: 'resident' | 'guest'
  createdAt: Date
}

export interface Chore {
  id?: number
  title: string
  description?: string
  assignedUserId?: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  customFrequency?: {
    type: 'times_per_day' | 'times_per_week' | 'times_per_month' | 'days_interval'
    value: number
    specificDays?: number[] // For weekly: 0=Sunday, 1=Monday, etc.
  }
  scheduledTime?: string // HH:MM format
  lastCompleted?: Date
  lastCompletedBy?: number // User ID who completed it
  nextDue: Date
  isCompleted: boolean
  completedAt?: Date // Timestamp when marked complete
  createdAt: Date
}

export interface GroceryItem {
  id?: number
  name: string
  category: string
  amount: string
  importance: 'low' | 'medium' | 'high'
  addedBy?: number
  createdAt: Date
}

export interface GroceryCategory {
  id?: number
  name: string
  color?: string
  isDefault: boolean
  locale?: string // For user-created categories, store the language they were created in
  createdAt: Date
}

export interface SavedGroceryItem {
  id?: number
  name: string
  category: string
  amount?: string
  importance?: 'low' | 'medium' | 'high'
  addedBy?: number
  timesUsed: number
  lastUsed?: Date
  createdAt: Date
}

export interface Task {
  id?: number
  title: string
  description?: string
  assignedUserId?: number
  dueDate?: Date
  priority: 'low' | 'medium' | 'high'
  isCompleted: boolean
  createdAt: Date
}

export interface HomeImprovement {
  id?: number
  title: string
  description?: string
  status: 'todo' | 'in-progress' | 'done'
  assignedUserId?: number
  estimatedCost?: number
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
}

export interface Meal {
  id?: number
  title: string
  description?: string
  date: Date
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  assignedUserId?: number
  ingredients?: string[]
  createdAt: Date
}

export interface Reminder {
  id?: number
  title: string
  description?: string
  reminderTime: Date
  isCompleted: boolean
  userId?: number
  type: 'general' | 'chore' | 'task' | 'meal'
  createdAt: Date
}

export interface CalendarEvent {
  id?: number
  title: string
  description?: string
  date: Date
  type: 'task' | 'meal' | 'reminder' | 'general'
  relatedId?: number
  userId?: number
  createdAt: Date
}

export class DomusDatabase extends Dexie {
  users!: Table<User>
  chores!: Table<Chore>
  groceryItems!: Table<GroceryItem>
  groceryCategories!: Table<GroceryCategory>
  savedGroceryItems!: Table<SavedGroceryItem>
  tasks!: Table<Task>
  homeImprovements!: Table<HomeImprovement>
  meals!: Table<Meal>
  reminders!: Table<Reminder>
  calendarEvents!: Table<CalendarEvent>

  constructor() {
    super('DomusDatabase')
    this.version(4).stores({
      users: '++id, name, color, type',
      chores: '++id, title, assignedUserId, frequency, nextDue, isCompleted',
      groceryItems: '++id, name, category, importance, addedBy, createdAt',
      groceryCategories: '++id, name, isDefault, locale, createdAt',
      savedGroceryItems: '++id, name, category, importance, timesUsed, lastUsed, createdAt',
      tasks: '++id, title, assignedUserId, dueDate, priority, isCompleted',
      homeImprovements: '++id, title, status, assignedUserId, priority',
      meals: '++id, title, date, mealType, assignedUserId',
      reminders: '++id, title, reminderTime, isCompleted, userId, type',
      calendarEvents: '++id, title, date, type, userId'
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

    // Populate default categories
    this.on('ready', async () => {
      const count = await this.groceryCategories.count()
      if (count === 0) {
        await this.groceryCategories.bulkAdd([
          { name: 'defaultCategories.produce', color: '#10b981', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.dairy', color: '#3b82f6', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.meatFish', color: '#ef4444', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.bakery', color: '#f59e0b', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.pantry', color: '#8b5cf6', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.frozen', color: '#06b6d4', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.beverages', color: '#84cc16', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.snacks', color: '#f97316', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.healthBeauty', color: '#ec4899', isDefault: true, locale: undefined, createdAt: new Date() },
          { name: 'defaultCategories.household', color: '#6b7280', isDefault: true, locale: undefined, createdAt: new Date() }
        ])
      }
    })
  }
}

export const db = new DomusDatabase()