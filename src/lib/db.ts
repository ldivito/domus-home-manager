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

// Finance Module interfaces
export interface MonthlyIncome {
  id?: string
  userId: string              // Reference to User
  amount: number              // Income amount
  currency: 'ARS' | 'USD'     // Currency of the income
  month: number               // 1-12
  year: number                // e.g., 2024
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface MonthlyExchangeRate {
  id?: string
  rate: number                // USD to ARS exchange rate
  month: number               // 1-12
  year: number                // e.g., 2024
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface RecurringExpense {
  id?: string
  name: string                // e.g., "Rent", "Electricity"
  description?: string
  amount: number              // Fixed amount or estimated
  currency: 'ARS' | 'USD'     // Currency of the expense
  category: string            // Category ID reference
  frequency: 'monthly' | 'bimonthly' | 'quarterly' | 'yearly'
  dueDay: number              // Day of month (1-31)
  isActive: boolean           // Can pause without deleting
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface ExpenseCategory {
  id?: string
  name: string                // Translation key or custom name
  icon?: string               // Lucide icon name
  color?: string
  isDefault: boolean
  householdId?: string
  createdAt: Date
}

export interface ExpensePayment {
  id?: string
  recurringExpenseId: string  // Reference to RecurringExpense
  amount: number              // Actual amount paid
  dueDate: Date               // When it was due
  paidDate?: Date             // When it was actually paid
  paidByUserId?: string       // Who paid it
  status: 'pending' | 'paid' | 'overdue'
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface SettlementPayment {
  id?: string
  fromUserId: string          // User who owes money
  toUserId: string            // User who is owed money
  amount: number              // Amount in ARS
  month: number               // 1-12
  year: number                // e.g., 2024
  paidDate: Date              // When the settlement was made
  notes?: string
  householdId?: string
  createdAt: Date
}

// Document Vault Module interfaces
export type DocumentCategory = 'warranty' | 'manual' | 'receipt' | 'contract' | 'insurance' |
  'medical' | 'legal' | 'financial' | 'vehicle' | 'property' | 'pet' | 'other'

export interface Document {
  id?: string
  name: string
  description?: string
  category: DocumentCategory
  fileType: string            // MIME type (e.g., 'application/pdf', 'image/jpeg')
  fileName: string            // Original file name
  fileSize: number            // Size in bytes
  fileData?: string           // Base64 encoded data for offline storage
  tags?: string[]             // Array of tag names for filtering
  expirationDate?: Date       // For warranties, insurance, etc.
  reminderEnabled: boolean    // Enable reminder before expiration
  reminderDaysBefore?: number // Days before expiration to remind
  // Cross-module linking (for future modules)
  linkedApplianceId?: string
  linkedVehicleId?: string
  linkedPetId?: string
  linkedSubscriptionId?: string
  linkedMaintenanceItemId?: string
  // Purchase/acquisition info
  purchaseDate?: Date
  purchasePrice?: number
  purchaseCurrency?: 'ARS' | 'USD'
  vendor?: string
  notes?: string
  uploadedByUserId?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface DocumentFolder {
  id?: string
  name: string
  parentFolderId?: string     // For nested folders (null = root)
  color?: string
  icon?: string
  householdId?: string
  createdAt: Date
}

export interface DocumentTag {
  id?: string
  name: string
  color?: string
  householdId?: string
  createdAt: Date
}

// Maintenance Scheduler Module interfaces
export type MaintenanceItemType = 'appliance' | 'hvac' | 'plumbing' | 'electrical' |
  'vehicle' | 'roof' | 'exterior' | 'landscaping' | 'pool' | 'security' | 'other'

export type MaintenanceFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' |
  'biannually' | 'yearly' | 'custom'

export interface MaintenanceItem {
  id?: string
  name: string
  description?: string
  type: MaintenanceItemType
  location?: string              // Where in the home (e.g., "Kitchen", "Garage")
  brand?: string
  model?: string
  serialNumber?: string
  purchaseDate?: Date
  warrantyExpirationDate?: Date
  // Cross-module linking
  linkedDocumentIds?: string[]   // Manuals, warranties, receipts
  notes?: string
  imageData?: string             // Base64 encoded photo
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface MaintenanceTask {
  id?: string
  maintenanceItemId: string      // Reference to MaintenanceItem
  name: string
  description?: string
  frequency: MaintenanceFrequency
  customFrequencyDays?: number   // For 'custom' frequency
  lastCompleted?: Date
  nextDue: Date
  reminderEnabled: boolean
  reminderDaysBefore?: number
  estimatedCostMin?: number
  estimatedCostMax?: number
  estimatedCurrency?: 'ARS' | 'USD'
  estimatedDurationMinutes?: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedUserId?: string
  // Service provider info
  preferredProvider?: string
  providerPhone?: string
  providerEmail?: string
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface MaintenanceLog {
  id?: string
  maintenanceItemId: string      // Reference to MaintenanceItem
  maintenanceTaskId?: string     // Optional reference to MaintenanceTask
  title: string                  // What was done
  description?: string
  completedDate: Date
  completedByUserId?: string
  // Cost tracking
  actualCost?: number
  costCurrency?: 'ARS' | 'USD'
  // Service provider
  serviceProvider?: string
  isExternalService: boolean     // DIY vs hired professional
  // Attachments
  linkedDocumentIds?: string[]   // Receipts, invoices
  notes?: string
  householdId?: string
  createdAt: Date
}

// Subscription Manager Module interfaces
export type SubscriptionCategory = 'streaming' | 'software' | 'gaming' | 'music' |
  'cloud_storage' | 'news' | 'fitness' | 'utilities' | 'insurance' | 'membership' | 'other'

export type SubscriptionBillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'yearly'

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial'

export interface Subscription {
  id?: string
  name: string
  description?: string
  category: SubscriptionCategory
  // Billing info
  amount: number
  currency: 'ARS' | 'USD'
  billingCycle: SubscriptionBillingCycle
  billingDay: number            // Day of month/week for billing
  nextBillingDate: Date
  // Status
  status: SubscriptionStatus
  trialEndDate?: Date           // For trial subscriptions
  cancelledDate?: Date
  // Features
  autoRenew: boolean
  reminderEnabled: boolean
  reminderDaysBefore?: number   // Days before billing to remind
  // Provider info
  providerName?: string
  providerWebsite?: string
  providerEmail?: string
  providerPhone?: string
  accountEmail?: string         // Email used for the subscription account
  accountUsername?: string
  // Cross-module linking
  linkedExpenseId?: string      // Manual link to Finance RecurringExpense
  linkedDocumentIds?: string[]  // Contracts, invoices
  // Notes
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface SubscriptionPayment {
  id?: string
  subscriptionId: string        // Reference to Subscription
  amount: number
  currency: 'ARS' | 'USD'
  paymentDate: Date
  paymentMethod?: string        // Credit card, debit, bank transfer, etc.
  status: 'paid' | 'failed' | 'pending' | 'refunded'
  transactionId?: string        // External reference number
  notes?: string
  householdId?: string
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
  ketoSettings!: Table<KetoSettings>
  ketoDays!: Table<KetoDay>
  // Finance tables
  monthlyIncomes!: Table<MonthlyIncome>
  monthlyExchangeRates!: Table<MonthlyExchangeRate>
  recurringExpenses!: Table<RecurringExpense>
  expenseCategories!: Table<ExpenseCategory>
  expensePayments!: Table<ExpensePayment>
  settlementPayments!: Table<SettlementPayment>
  // Document Vault tables
  documents!: Table<Document>
  documentFolders!: Table<DocumentFolder>
  documentTags!: Table<DocumentTag>
  // Maintenance Scheduler tables
  maintenanceItems!: Table<MaintenanceItem>
  maintenanceTasks!: Table<MaintenanceTask>
  maintenanceLogs!: Table<MaintenanceLog>
  // Subscription Manager tables
  subscriptions!: Table<Subscription>
  subscriptionPayments!: Table<SubscriptionPayment>
  private legacyMealIngredientMigrationComplete = false
  private legacyMealIngredientMigrationPromise?: Promise<void>

  constructor() {
    super('DomusDatabase')

    // v21: Add Subscription Manager module tables
    this.version(21).stores({
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
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt',
      // Finance tables
      monthlyIncomes: 'id, userId, [month+year], householdId, createdAt',
      monthlyExchangeRates: 'id, [month+year], householdId, createdAt',
      recurringExpenses: 'id, name, category, frequency, isActive, householdId, createdAt',
      expenseCategories: 'id, name, isDefault, householdId, createdAt',
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt',
      settlementPayments: 'id, fromUserId, toUserId, [month+year], householdId, createdAt',
      // Document Vault tables
      documents: 'id, name, category, expirationDate, uploadedByUserId, householdId, createdAt, *tags',
      documentFolders: 'id, name, parentFolderId, householdId, createdAt',
      documentTags: 'id, name, householdId, createdAt',
      // Maintenance Scheduler tables
      maintenanceItems: 'id, name, type, location, householdId, createdAt',
      maintenanceTasks: 'id, maintenanceItemId, name, nextDue, priority, assignedUserId, householdId, createdAt',
      maintenanceLogs: 'id, maintenanceItemId, maintenanceTaskId, completedDate, completedByUserId, householdId, createdAt',
      // Subscription Manager tables
      subscriptions: 'id, name, category, status, nextBillingDate, billingCycle, householdId, createdAt',
      subscriptionPayments: 'id, subscriptionId, paymentDate, status, householdId, createdAt'
    })

    // v20: Add Maintenance Scheduler module tables
    this.version(20).stores({
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
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt',
      // Finance tables
      monthlyIncomes: 'id, userId, [month+year], householdId, createdAt',
      monthlyExchangeRates: 'id, [month+year], householdId, createdAt',
      recurringExpenses: 'id, name, category, frequency, isActive, householdId, createdAt',
      expenseCategories: 'id, name, isDefault, householdId, createdAt',
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt',
      settlementPayments: 'id, fromUserId, toUserId, [month+year], householdId, createdAt',
      // Document Vault tables
      documents: 'id, name, category, expirationDate, uploadedByUserId, householdId, createdAt, *tags',
      documentFolders: 'id, name, parentFolderId, householdId, createdAt',
      documentTags: 'id, name, householdId, createdAt',
      // Maintenance Scheduler tables
      maintenanceItems: 'id, name, type, location, householdId, createdAt',
      maintenanceTasks: 'id, maintenanceItemId, name, nextDue, priority, assignedUserId, householdId, createdAt',
      maintenanceLogs: 'id, maintenanceItemId, maintenanceTaskId, completedDate, completedByUserId, householdId, createdAt'
    })

    // v19: Add Document Vault module tables
    this.version(19).stores({
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
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt',
      // Finance tables
      monthlyIncomes: 'id, userId, [month+year], householdId, createdAt',
      monthlyExchangeRates: 'id, [month+year], householdId, createdAt',
      recurringExpenses: 'id, name, category, frequency, isActive, householdId, createdAt',
      expenseCategories: 'id, name, isDefault, householdId, createdAt',
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt',
      settlementPayments: 'id, fromUserId, toUserId, [month+year], householdId, createdAt',
      // Document Vault tables
      documents: 'id, name, category, expirationDate, uploadedByUserId, householdId, createdAt, *tags',
      documentFolders: 'id, name, parentFolderId, householdId, createdAt',
      documentTags: 'id, name, householdId, createdAt'
    })

    // v18: Add settlement payments table
    this.version(18).stores({
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
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt',
      // Finance tables
      monthlyIncomes: 'id, userId, [month+year], householdId, createdAt',
      monthlyExchangeRates: 'id, [month+year], householdId, createdAt',
      recurringExpenses: 'id, name, category, frequency, isActive, householdId, createdAt',
      expenseCategories: 'id, name, isDefault, householdId, createdAt',
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt',
      settlementPayments: 'id, fromUserId, toUserId, [month+year], householdId, createdAt'
    })

    // v17: Add currency to expenses
    this.version(17).stores({
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
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt',
      // Finance tables
      monthlyIncomes: 'id, userId, [month+year], householdId, createdAt',
      monthlyExchangeRates: 'id, [month+year], householdId, createdAt',
      recurringExpenses: 'id, name, category, frequency, isActive, householdId, createdAt',
      expenseCategories: 'id, name, isDefault, householdId, createdAt',
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt'
    })

    // v17 upgrade: add default currency to existing expenses
    this.version(17).upgrade(async (tx) => {
      const expenses = await tx.table('recurringExpenses').toArray()
      for (const expense of expenses) {
        if (!expense.currency) {
          await tx.table('recurringExpenses').update(expense.id, {
            currency: 'ARS'
          })
        }
      }
      console.log('Database upgraded to v17 with expense currency support')
    })

    // v16: Add exchange rates and currency to income
    this.version(16).stores({
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
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt',
      // Finance tables
      monthlyIncomes: 'id, userId, [month+year], householdId, createdAt',
      monthlyExchangeRates: 'id, [month+year], householdId, createdAt',
      recurringExpenses: 'id, name, category, frequency, isActive, householdId, createdAt',
      expenseCategories: 'id, name, isDefault, householdId, createdAt',
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt'
    })

    // v16 upgrade: add default currency to existing incomes
    this.version(16).upgrade(async (tx) => {
      const incomes = await tx.table('monthlyIncomes').toArray()
      for (const income of incomes) {
        if (!income.currency) {
          await tx.table('monthlyIncomes').update(income.id, {
            currency: 'ARS'
          })
        }
      }
      console.log('Database upgraded to v16 with currency support')
    })

    // v15: Add Finance module tables
    this.version(15).stores({
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
      ketoDays: 'id, householdId, userId, date, status, createdAt, updatedAt',
      // Finance tables
      monthlyIncomes: 'id, userId, [month+year], householdId, createdAt',
      recurringExpenses: 'id, name, category, frequency, isActive, householdId, createdAt',
      expenseCategories: 'id, name, isDefault, householdId, createdAt',
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt'
    })

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

    // Database ready handler with timeout protection
    this.on('ready', async () => {
      console.log('Database ready - local IndexedDB mode')

      // Helper to wrap async operations with timeout
      const withTimeout = <T>(promise: Promise<T>, ms: number, name: string): Promise<T | null> => {
        return Promise.race([
          promise,
          new Promise<null>((resolve) => {
            setTimeout(() => {
              console.warn(`${name} timed out after ${ms}ms`)
              resolve(null)
            }, ms)
          })
        ])
      }

      try {
        // Check if we have migrated data to import (with 5s timeout)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await withTimeout(importMigratedData(this as any), 5000, 'importMigratedData')
      } catch (error) {
        console.error('Error importing migrated data:', error)
        // Clear potentially corrupted migration data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('domus_migration_data')
        }
      }

      try {
        // Run meal ingredient structure check (with 5s timeout)
        await withTimeout(this.ensureMealIngredientStructure(), 5000, 'ensureMealIngredientStructure')
      } catch (error) {
        console.warn('Meal ingredient migration issue:', error)
      }

      try {
        // Seed default categories if needed (with 5s timeout)
        await withTimeout(this.seedDefaultCategoriesIfNeeded(), 5000, 'seedDefaultCategoriesIfNeeded')
      } catch (error) {
        console.warn('Error seeding default categories:', error)
      }
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
      // Seed expense categories if needed (separate check for existing DBs)
      const expenseCategoryCount = await this.expenseCategories.count()
      if (expenseCategoryCount === 0) {
        const now = new Date()
        await this.expenseCategories.bulkAdd([
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.housing', icon: 'Home', color: '#8B5CF6', isDefault: true, createdAt: now },
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.utilities', icon: 'Zap', color: '#F59E0B', isDefault: true, createdAt: now },
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.internet', icon: 'Wifi', color: '#3B82F6', isDefault: true, createdAt: now },
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.insurance', icon: 'Shield', color: '#10B981', isDefault: true, createdAt: now },
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.taxes', icon: 'FileText', color: '#EF4444', isDefault: true, createdAt: now },
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.subscriptions', icon: 'Tv', color: '#EC4899', isDefault: true, createdAt: now },
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.maintenance', icon: 'Wrench', color: '#6B7280', isDefault: true, createdAt: now },
          { id: `ecat_${crypto.randomUUID()}`, name: 'defaultExpenseCategories.other', icon: 'MoreHorizontal', color: '#9CA3AF', isDefault: true, createdAt: now }
        ])
        console.log('Default expense categories seeded successfully')
      }

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
