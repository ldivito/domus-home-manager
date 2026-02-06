import Dexie, { Table } from 'dexie'
import { generateId } from './utils'
import { checkMigrationNeeded, performMigration, importMigratedData, isMigrationCompleted } from './migration'
import { dbLogger } from './logger'

export interface User {
  id?: string
  name: string
  email?: string
  avatar?: string
  color: string
  type: 'resident' | 'guest'
  householdId?: string
  createdAt: Date
  updatedAt?: Date
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
  updatedAt?: Date
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
  updatedAt?: Date
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
  updatedAt?: Date
}

export interface MealIngredient {
  id?: string
  savedGroceryItemId: string
  amount?: string
  usageNotes?: string
}

// Task Category
export interface TaskCategory {
  id?: string
  name: string
  color?: string
  icon?: string
  isDefault: boolean
  householdId?: string
  locale?: string
  createdAt: Date
  updatedAt?: Date
}

// Estimated time for tasks
export interface TaskEstimatedTime {
  hours: number
  minutes: number
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
  // Category
  category?: string             // TaskCategory ID
  // New fields
  linkedProjectId?: string      // Links to HomeImprovement project
  estimatedTime?: TaskEstimatedTime  // How long the task will take
  blockedByTaskId?: string      // Task that must be completed first
  createdAt: Date
  updatedAt?: Date
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
  updatedAt?: Date
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
  updatedAt?: Date
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
  // Goal tracking
  goalWeight?: number // Target weight in kg or lb
  weightUnit?: 'kg' | 'lb' // Weight unit preference
  targetDate?: Date // Target date to reach goal weight
  createdAt: Date
  updatedAt: Date
}

export interface KetoWeightEntry {
  id?: string
  householdId?: string
  userId: string // User who owns this entry
  date: Date // Date of the weight entry
  weight: number // Weight value
  unit: 'kg' | 'lb' // Unit of measurement
  notes?: string // Optional notes
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

export interface KetoBodyMeasurement {
  id?: string
  householdId?: string
  userId: string // User who owns this entry
  date: Date // Date of the measurement
  waist?: number // Waist circumference
  hips?: number // Hip circumference
  chest?: number // Chest circumference
  arms?: number // Arm circumference
  thighs?: number // Thigh circumference
  neck?: number // Neck circumference
  unit: 'cm' | 'in' // Measurement unit
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface KetoWaterEntry {
  id?: string
  householdId?: string
  userId: string // User who owns this entry
  date: Date // Date of the water tracking
  glasses: number // Number of glasses (250ml/8oz each)
  goalGlasses: number // Daily goal in glasses
  createdAt: Date
  updatedAt: Date
}

export type KetoSymptomType = 'energy' | 'mental_clarity' | 'hunger' | 'cravings' | 'sleep' | 'mood' | 'headache' | 'fatigue' | 'nausea' | 'other'

export interface KetoSymptomEntry {
  id?: string
  householdId?: string
  userId: string // User who owns this entry
  date: Date // Date of the symptom entry
  symptom: KetoSymptomType
  severity: 1 | 2 | 3 | 4 | 5 // 1 = very low, 5 = very high
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// Finance Module interfaces
export interface MonthlyIncome {
  id?: string
  userId: string              // Reference to User
  amount: number              // Income amount
  currency: 'ARS' | 'USD'     // Currency of the income
  source: string              // Source of the income (e.g., "Salary", "Freelance")
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

// Personal Finance Module interfaces
export interface PersonalWallet {
  id?: string
  userId: string               // Owner
  name: string                 // "Billetera Personal", "Santander Cuenta Corriente"
  type: 'physical' | 'bank' | 'credit_card'
  currency: 'ARS' | 'USD'
  
  // Balance tracking
  balance: number              // Current balance (not for credit cards)
  
  // Credit Card Specific
  creditLimit?: number         // Total credit limit
  closingDay?: number         // Day of month (1-31) 
  dueDay?: number            // Days after closing (typically 15-20)
  
  // Bank Specific
  accountNumber?: string      // Masked: "****1234"
  bankName?: string          // "Banco Santander", "BBVA", etc
  
  // UI/UX
  color: string             // Hex color for identification
  icon: string              // Icon identifier
  
  // Status & Metadata
  isActive: boolean         // Active/Inactive
  
  // Audit
  createdAt: Date
  updatedAt: Date
  notes?: string          // User notes about this wallet
}

export interface PersonalCategory {
  id?: string
  userId: string            
  name: string              // "Comida", "Transporte", "Salud"
  type: 'income' | 'expense'
  
  // UI/UX
  color: string
  icon: string
  
  // Status
  isActive: boolean
  isDefault: boolean       // System default category
  
  // Audit
  createdAt: Date
  updatedAt: Date
}

export interface PersonalTransaction {
  id?: string
  userId: string
  
  // Core transaction data
  type: 'income' | 'expense' | 'transfer'
  amount: number            // Always positive, use type for direction
  currency: 'ARS' | 'USD'
  
  // Account relationships
  walletId: string          // Source/destination wallet
  targetWalletId?: string   // For transfers
  categoryId: string
  
  // Transaction details
  description: string
  
  // Exchange rate (for currency conversions)
  exchangeRate?: number
  
  // Timing
  date: Date               // Transaction date
  
  // Credit Card Integration
  creditCardStatementId?: string
  isFromCreditCard: boolean
  
  // Household Integration
  sharedWithHousehold: boolean
  householdContribution?: number
  
  // Status and workflow
  status: 'pending' | 'completed' | 'cancelled'
  
  // Metadata
  notes?: string
  
  // Audit
  createdAt: Date
  updatedAt: Date
}

export interface CreditCardStatement {
  id?: string
  userId: string
  walletId: string          // Credit card wallet
  
  // Period definition
  periodStart: Date
  periodEnd: Date           // Closing date
  dueDate: Date            // Payment due date
  
  // Financial summary
  totalCharges: number     // New charges this period
  totalPayments: number    // Payments received
  currentBalance: number   // Total amount due
  minimumPayment: number   // Minimum payment required
  currency: 'ARS' | 'USD'  // Statement currency
  
  // Payment tracking
  paidAmount: number
  paidDate?: Date
  
  // Status workflow
  status: 'open' | 'closed' | 'paid' | 'overdue'
  
  createdAt: Date
  updatedAt: Date
}

export interface CreditCardPayment {
  id?: string
  userId: string            // Owner of the payment
  statementId: string       // Reference to CreditCardStatement
  fromWalletId: string      // Wallet used to make the payment
  
  amount: number            // Payment amount
  currency: 'ARS' | 'USD'   // Payment currency
  paymentDate: Date         // When the payment was made
  
  notes?: string           // Optional payment notes
  
  createdAt: Date
  updatedAt: Date
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
  // Billing info - support both currencies
  amount: number                // Legacy field, primary amount
  currency: 'ARS' | 'USD'       // Legacy field, primary currency
  amountARS?: number            // Amount in Argentine Pesos
  amountUSD?: number            // Amount in US Dollars
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

// Pet Management Module interfaces
export type PetType = 'dog' | 'cat' | 'bird' | 'fish' | 'reptile' | 'small_mammal' | 'other'
export type PetGender = 'male' | 'female' | 'unknown'

export interface Pet {
  id?: string
  name: string
  type: PetType
  breed?: string
  gender: PetGender
  birthDate?: Date
  weight?: number
  weightUnit: 'kg' | 'lb'
  microchipId?: string
  isNeutered?: boolean
  allergies?: string[]
  veterinarianName?: string
  veterinarianPhone?: string
  veterinarianAddress?: string
  emergencyVetName?: string
  emergencyVetPhone?: string
  insuranceProvider?: string
  insurancePolicyNumber?: string
  insuranceExpiration?: Date
  photo?: string                // Base64 encoded photo
  primaryCaretakerId?: string   // Reference to User
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export type FeedingFrequency = 'daily' | 'specific_days'

export interface PetFeedingSchedule {
  id?: string
  petId: string                 // Reference to Pet
  name: string                  // e.g., "Morning Meal", "Evening Snack"
  foodType: string              // e.g., "Dry kibble", "Wet food"
  foodBrand?: string
  amount: string                // e.g., "1 cup", "100g"
  scheduledTime: string         // HH:MM format
  frequency: FeedingFrequency
  specificDays?: number[]       // 0=Sunday, 1=Monday, etc. (for 'specific_days')
  assignedUserId?: string       // Who is responsible for this feeding
  notes?: string
  isActive: boolean
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface PetFeedingLog {
  id?: string
  feedingScheduleId?: string    // Reference to PetFeedingSchedule (optional for ad-hoc feedings)
  petId: string                 // Reference to Pet
  fedDate: Date
  fedByUserId?: string          // Who fed the pet
  foodType?: string
  amount?: string
  notes?: string
  householdId?: string
  createdAt: Date
}

export type MedicationFrequency = 'once' | 'daily' | 'twice_daily' | 'weekly' | 'monthly' | 'as_needed'

export interface PetMedication {
  id?: string
  petId: string                 // Reference to Pet
  name: string                  // Medication name
  dosage: string                // e.g., "10mg", "1 tablet"
  frequency: MedicationFrequency
  startDate: Date
  endDate?: Date                // Null for ongoing medications
  nextDose?: Date
  prescribedBy?: string         // Vet name
  pharmacy?: string
  refillsRemaining?: number
  reminderEnabled: boolean
  reminderTime?: string         // HH:MM format
  notes?: string
  isActive: boolean
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface PetMedicationLog {
  id?: string
  medicationId: string          // Reference to PetMedication
  petId: string                 // Reference to Pet
  givenDate: Date
  givenByUserId?: string        // Who gave the medication
  dosageGiven?: string          // Actual dosage given (may differ from prescribed)
  skipped: boolean              // If the dose was skipped
  skipReason?: string
  notes?: string
  householdId?: string
  createdAt: Date
}

export type VetVisitType = 'checkup' | 'vaccination' | 'illness' | 'injury' | 'surgery' | 'dental' | 'grooming' | 'emergency' | 'other'

export interface PetVetVisit {
  id?: string
  petId: string                 // Reference to Pet
  visitDate: Date
  visitType: VetVisitType
  vetName?: string
  clinicName?: string
  reason: string                // Why the visit happened
  diagnosis?: string
  treatment?: string
  prescriptions?: string        // Any medications prescribed
  cost?: number
  currency: 'ARS' | 'USD'
  followUpDate?: Date
  followUpNotes?: string
  linkedDocumentIds?: string[]  // Medical records, receipts
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface PetVaccination {
  id?: string
  petId: string                 // Reference to Pet
  vaccineName: string           // e.g., "Rabies", "Distemper", "Bordetella"
  dateAdministered: Date
  administeredBy?: string       // Vet name
  clinicName?: string
  batchNumber?: string          // Vaccine batch/lot number
  expirationDate?: Date         // Vaccine expiration
  nextDueDate?: Date            // When booster is needed
  reminderEnabled: boolean
  reminderDaysBefore?: number   // Days before next due to remind
  linkedDocumentId?: string     // Certificate/record
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

// Savings Module interfaces
export type SavingMethod = '52_week_challenge' | 'envelope_method' | 'round_up' | 'fixed_monthly' | 'bi_weekly' | 'custom'
export type DistributionMethod = 'equal' | 'percentage'

export interface SavingsCampaign {
  id?: string
  name: string
  description?: string
  goalAmount: number
  currency: 'ARS' | 'USD'
  deadline: Date
  savingMethod: SavingMethod
  customMethodDetails?: string    // For custom methods
  distributionMethod: DistributionMethod
  currentAmount: number           // Cached total contributions
  isActive: boolean
  isCompleted: boolean
  completedAt?: Date
  householdId?: string
  createdByUserId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface SavingsMilestone {
  id?: string
  campaignId: string              // Reference to SavingsCampaign
  name: string
  targetAmount: number
  targetDate: Date
  isReached: boolean
  reachedAt?: Date
  order: number                   // Display order (1, 2, 3...)
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface SavingsParticipant {
  id?: string
  campaignId: string              // Reference to SavingsCampaign
  userId: string                  // Reference to User
  sharePercentage?: number        // For percentage-based distribution (0-100)
  isActive: boolean
  joinedAt: Date
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}

export interface SavingsContribution {
  id?: string
  campaignId: string              // Reference to SavingsCampaign
  participantId: string           // Reference to SavingsParticipant
  userId: string                  // Direct reference for faster queries
  amount: number
  currency: 'ARS' | 'USD'
  contributionDate: Date
  notes?: string
  householdId?: string
  createdAt: Date
}

// Deletion log for sync - tracks deleted records so they can be synced
export interface DeletionLog {
  id?: string
  tableName: string               // Which table the record was deleted from
  recordId: string                // ID of the deleted record
  householdId?: string
  deletedAt: Date
}

// Activity Log - tracks all user actions across all modules
export type ActivityAction =
  // Chores
  | 'chore_created' | 'chore_completed' | 'chore_updated' | 'chore_deleted' | 'chore_assigned'
  // Grocery
  | 'grocery_item_added' | 'grocery_item_purchased' | 'grocery_item_deleted'
  // Tasks
  | 'task_created' | 'task_completed' | 'task_updated' | 'task_deleted' | 'task_assigned'
  // Projects
  | 'project_created' | 'project_status_changed' | 'project_deleted' | 'project_assigned'
  // Meals
  | 'meal_planned' | 'meal_updated' | 'meal_deleted' | 'meal_assigned'
  // Reminders
  | 'reminder_created' | 'reminder_dismissed' | 'reminder_deleted'
  // Keto
  | 'weight_entry_added' | 'symptom_logged' | 'water_intake_logged'
  // Finance
  | 'income_added' | 'expense_added' | 'payment_made'
  // Subscriptions
  | 'subscription_created' | 'subscription_payment_recorded' | 'subscription_cancelled'
  // Pets
  | 'pet_feeding_logged' | 'pet_medication_given' | 'vet_visit_logged'
  // Maintenance
  | 'maintenance_completed' | 'maintenance_assigned'
  // Documents
  | 'document_uploaded' | 'document_deleted'
  // Savings
  | 'contribution_made' | 'milestone_reached' | 'campaign_created'
  // Users & Events
  | 'user_created' | 'user_updated' | 'event_created' | 'event_updated'

export type EntityType =
  | 'chore' | 'groceryItem' | 'task' | 'homeImprovement' | 'meal'
  | 'reminder' | 'ketoWeight' | 'ketoSymptom' | 'ketoWater'
  | 'income' | 'expense' | 'subscription' | 'pet' | 'petFeeding'
  | 'petMedication' | 'maintenance' | 'document' | 'savings' | 'user' | 'calendarEvent'

export interface ActivityLog {
  id?: string
  userId?: string              // Who performed the action
  action: ActivityAction
  entityType: EntityType
  entityId?: string            // ID of affected entity
  entityTitle: string          // Display name
  details?: Record<string, unknown>  // Additional context
  timestamp: Date
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
  taskCategories!: Table<TaskCategory>
  homeImprovements!: Table<HomeImprovement>
  meals!: Table<Meal>
  mealCategories!: Table<MealCategory>
  savedMeals!: Table<SavedMeal>
  reminders!: Table<Reminder>
  calendarEvents!: Table<CalendarEvent>
  homeSettings!: Table<HomeSettings>
  ketoSettings!: Table<KetoSettings>
  ketoDays!: Table<KetoDay>
  ketoWeightEntries!: Table<KetoWeightEntry>
  ketoBodyMeasurements!: Table<KetoBodyMeasurement>
  ketoWaterEntries!: Table<KetoWaterEntry>
  ketoSymptomEntries!: Table<KetoSymptomEntry>
  // Finance tables
  monthlyIncomes!: Table<MonthlyIncome>
  monthlyExchangeRates!: Table<MonthlyExchangeRate>
  recurringExpenses!: Table<RecurringExpense>
  expenseCategories!: Table<ExpenseCategory>
  expensePayments!: Table<ExpensePayment>
  settlementPayments!: Table<SettlementPayment>
  // Personal Finance tables
  personalWallets!: Table<PersonalWallet>
  personalCategories!: Table<PersonalCategory>
  personalTransactions!: Table<PersonalTransaction>
  creditCardStatements!: Table<CreditCardStatement>
  creditCardPayments!: Table<CreditCardPayment>
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
  // Pet Management tables
  pets!: Table<Pet>
  petFeedingSchedules!: Table<PetFeedingSchedule>
  petFeedingLogs!: Table<PetFeedingLog>
  petMedications!: Table<PetMedication>
  petMedicationLogs!: Table<PetMedicationLog>
  petVetVisits!: Table<PetVetVisit>
  petVaccinations!: Table<PetVaccination>
  // Savings Module tables
  savingsCampaigns!: Table<SavingsCampaign>
  savingsMilestones!: Table<SavingsMilestone>
  savingsParticipants!: Table<SavingsParticipant>
  savingsContributions!: Table<SavingsContribution>
  // Sync support
  deletionLog!: Table<DeletionLog>
  // Activity tracking
  activityLogs!: Table<ActivityLog>
  private legacyMealIngredientMigrationComplete = false
  private legacyMealIngredientMigrationPromise?: Promise<void>

  constructor() {
    super('DomusDatabase')

    // v22: Add Pet Management module tables
    this.version(22).stores({
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
      subscriptionPayments: 'id, subscriptionId, paymentDate, status, householdId, createdAt',
      // Pet Management tables
      pets: 'id, name, type, primaryCaretakerId, householdId, createdAt',
      petFeedingSchedules: 'id, petId, scheduledTime, assignedUserId, isActive, householdId, createdAt',
      petFeedingLogs: 'id, feedingScheduleId, petId, fedDate, fedByUserId, householdId, createdAt',
      petMedications: 'id, petId, name, nextDose, isActive, householdId, createdAt',
      petMedicationLogs: 'id, medicationId, petId, givenDate, givenByUserId, householdId, createdAt',
      petVetVisits: 'id, petId, visitDate, visitType, householdId, createdAt',
      petVaccinations: 'id, petId, vaccineName, nextDueDate, householdId, createdAt',
      // Personal Finance tables
      personalWallets: 'id, userId, type, currency, isActive, createdAt',
      personalCategories: 'id, userId, type, isActive, isDefault, createdAt',
      personalTransactions: 'id, userId, walletId, categoryId, type, date, status, createdAt',
      creditCardStatements: 'id, userId, walletId, status, periodEnd, dueDate, createdAt'
    })

    // v26: Add source field to monthly incomes for multiple income entries per user
    this.version(26).stores({
      monthlyIncomes: 'id, userId, [month+year], source, householdId, createdAt'
    })

    // v26 upgrade: add default source to existing incomes
    this.version(26).upgrade(async (tx) => {
      const incomes = await tx.table('monthlyIncomes').toArray()
      for (const income of incomes) {
        if (!income.source) {
          await tx.table('monthlyIncomes').update(income.id, {
            source: 'Salary'
          })
        }
      }
      dbLogger.debug('Database upgraded to v26 with income source field')
    })

    // v32: Add Personal Finance module tables
    this.version(32).stores({
      personalWallets: 'id, userId, type, currency, isActive, createdAt',
      personalCategories: 'id, userId, type, isActive, isDefault, createdAt',
      personalTransactions: 'id, userId, walletId, categoryId, type, date, status, createdAt',
      creditCardStatements: 'id, userId, walletId, status, periodEnd, dueDate, createdAt',
      creditCardPayments: 'id, userId, statementId, fromWalletId, paymentDate, createdAt'
    })

    // v31: Add activity log for tracking all user actions
    this.version(31).stores({
      activityLogs: 'id, userId, action, entityType, entityId, timestamp, householdId, createdAt'
    })

    // v30: Add keto body measurements, water tracking, and symptom journal
    this.version(30).stores({
      ketoBodyMeasurements: 'id, householdId, userId, date, createdAt, updatedAt',
      ketoWaterEntries: 'id, householdId, userId, date, createdAt, updatedAt',
      ketoSymptomEntries: 'id, householdId, userId, date, symptom, createdAt, updatedAt'
    })

    // v29: Add keto weight tracking table and update keto settings
    this.version(29).stores({
      ketoSettings: 'id, householdId, userId, startDate, goalWeight, targetDate, createdAt, updatedAt',
      ketoWeightEntries: 'id, householdId, userId, date, weight, unit, createdAt, updatedAt'
    })

    // v28: Add deletion log for sync support
    this.version(28).stores({
      deletionLog: 'id, tableName, recordId, householdId, deletedAt'
    })

    // v27: Add Savings module tables
    this.version(27).stores({
      savingsCampaigns: 'id, name, deadline, isActive, isCompleted, savingMethod, householdId, createdAt',
      savingsMilestones: 'id, campaignId, targetDate, isReached, order, householdId, createdAt',
      savingsParticipants: 'id, campaignId, userId, isActive, householdId, createdAt',
      savingsContributions: 'id, campaignId, participantId, userId, contributionDate, householdId, createdAt'
    })

    // v25: Add task categories table and category index to tasks
    this.version(25).stores({
      tasks: 'id, title, householdId, assignedUserId, dueDate, priority, isCompleted, category, linkedProjectId, blockedByTaskId, createdAt',
      taskCategories: 'id, name, householdId, isDefault, locale, createdAt'
    })

    // v24: Add linkedProjectId and blockedByTaskId indexes to tasks
    this.version(24).stores({
      tasks: 'id, title, householdId, assignedUserId, dueDate, priority, isCompleted, linkedProjectId, blockedByTaskId, createdAt'
    })

    // v23: Add followUpDate index to petVetVisits
    this.version(23).stores({
      petVetVisits: 'id, petId, visitDate, visitType, followUpDate, householdId, createdAt'
    })

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
      dbLogger.debug('Database upgraded to v17 with expense currency support')
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
      dbLogger.debug('Database upgraded to v16 with currency support')
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
      dbLogger.debug('Database upgraded to v13 with fasting support in Keto tracking')
    })

    // Database ready handler with timeout protection
    this.on('ready', async () => {
      dbLogger.info('Database ready - local IndexedDB mode')

      // Helper to wrap async operations with timeout
      const withTimeout = <T>(promise: Promise<T>, ms: number, name: string): Promise<T | null> => {
        return Promise.race([
          promise,
          new Promise<null>((resolve) => {
            setTimeout(() => {
              dbLogger.warn(`${name} timed out after ${ms}ms`)
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
        dbLogger.error('Error importing migrated data:', error)
        // Clear potentially corrupted migration data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('domus_migration_data')
        }
      }

      try {
        // Run meal ingredient structure check (with 5s timeout)
        await withTimeout(this.ensureMealIngredientStructure(), 5000, 'ensureMealIngredientStructure')
      } catch (error) {
        dbLogger.warn('Meal ingredient migration issue:', error)
      }

      try {
        // Seed default categories if needed (with 5s timeout)
        await withTimeout(this.seedDefaultCategoriesIfNeeded(), 5000, 'seedDefaultCategoriesIfNeeded')
      } catch (error) {
        dbLogger.warn('Error seeding default categories:', error)
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
        dbLogger.error('Error migrating legacy meal ingredients:', error)
        throw error
      })
      .finally(() => {
        this.legacyMealIngredientMigrationPromise = undefined
      })

    return this.legacyMealIngredientMigrationPromise
  }

  // Helper method to seed default Personal Finance categories for a user
  async seedPersonalFinanceCategoriesForUser(userId: string): Promise<void> {
    try {
      // Check if user already has personal categories
      const existingCategories = await this.personalCategories
        .where('userId').equals(userId)
        .count()
      
      if (existingCategories > 0) return // Already seeded

      const now = new Date()

      // Default income categories
      const incomeCategories = [
        { name: 'Salary', icon: 'Briefcase', color: '#22c55e' },
        { name: 'Freelance', icon: 'Laptop', color: '#3b82f6' },
        { name: 'Investment', icon: 'TrendingUp', color: '#8b5cf6' },
        { name: 'Bonus', icon: 'Gift', color: '#f59e0b' },
        { name: 'Other Income', icon: 'Plus', color: '#6b7280' }
      ]

      // Default expense categories
      const expenseCategories = [
        { name: 'Food & Dining', icon: 'UtensilsCrossed', color: '#ef4444' },
        { name: 'Transportation', icon: 'Car', color: '#3b82f6' },
        { name: 'Shopping', icon: 'ShoppingBag', color: '#ec4899' },
        { name: 'Entertainment', icon: 'Film', color: '#8b5cf6' },
        { name: 'Health & Medical', icon: 'Heart', color: '#10b981' },
        { name: 'Bills & Utilities', icon: 'Receipt', color: '#f59e0b' },
        { name: 'Education', icon: 'GraduationCap', color: '#06b6d4' },
        { name: 'Personal Care', icon: 'Scissors', color: '#ec4899' },
        { name: 'Travel', icon: 'Plane', color: '#84cc16' },
        { name: 'Other Expenses', icon: 'MoreHorizontal', color: '#6b7280' }
      ]

      // Create income categories
      const incomeData = incomeCategories.map(cat => ({
        id: `pc_${crypto.randomUUID()}`,
        userId,
        name: cat.name,
        type: 'income' as const,
        color: cat.color,
        icon: cat.icon,
        isActive: true,
        isDefault: true,
        createdAt: now,
        updatedAt: now
      }))

      // Create expense categories
      const expenseData = expenseCategories.map(cat => ({
        id: `pc_${crypto.randomUUID()}`,
        userId,
        name: cat.name,
        type: 'expense' as const,
        color: cat.color,
        icon: cat.icon,
        isActive: true,
        isDefault: true,
        createdAt: now,
        updatedAt: now
      }))

      // Add all categories
      await this.personalCategories.bulkAdd([...incomeData, ...expenseData])

      dbLogger.debug(`Personal Finance categories seeded for user ${userId}`)
    } catch (error) {
      dbLogger.error('Error seeding Personal Finance categories:', error)
    }
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
        dbLogger.debug('Default expense categories seeded successfully')
      }

      // Seed task categories if needed
      const taskCategoryCount = await this.taskCategories.count()
      if (taskCategoryCount === 0) {
        const now = new Date()
        await this.taskCategories.bulkAdd([
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.personal', icon: 'User', color: '#8B5CF6', isDefault: true, createdAt: now },
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.work', icon: 'Briefcase', color: '#3B82F6', isDefault: true, createdAt: now },
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.home', icon: 'Home', color: '#10B981', isDefault: true, createdAt: now },
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.shopping', icon: 'ShoppingCart', color: '#F59E0B', isDefault: true, createdAt: now },
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.health', icon: 'Heart', color: '#EF4444', isDefault: true, createdAt: now },
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.finance', icon: 'DollarSign', color: '#22C55E', isDefault: true, createdAt: now },
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.errands', icon: 'MapPin', color: '#EC4899', isDefault: true, createdAt: now },
          { id: `tcat_${crypto.randomUUID()}`, name: 'defaultTaskCategories.other', icon: 'MoreHorizontal', color: '#6B7280', isDefault: true, createdAt: now }
        ])
        dbLogger.debug('Default task categories seeded successfully')
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

      dbLogger.debug('Default categories seeded successfully')
    } catch (error) {
      dbLogger.error('Error seeding default categories:', error)
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
      dbLogger.info('Legacy database detected, performing migration...')
      const migrationResult = await performMigration()
      if (!migrationResult.success) {
        dbLogger.error('Migration failed:', migrationResult.error)
        // Continue anyway to try opening the database
      } else {
        dbLogger.info('Migration successful:', migrationResult)
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

/**
 * Delete a record and log it for sync
 * Use this instead of direct table.delete() to ensure deletions sync properly
 */
export async function deleteWithSync<T extends { id?: string; householdId?: string }>(
  table: Table<T>,
  tableName: string,
  recordId: string
): Promise<void> {
  // Get the record first to capture householdId
  const record = await table.get(recordId)
  const householdId = record?.householdId

  // Delete the record
  await table.delete(recordId)

  // Log the deletion for sync
  await db.deletionLog.add({
    id: generateId('del'),
    tableName,
    recordId,
    householdId,
    deletedAt: new Date()
  })
}

/**
 * Bulk delete records and log them for sync
 */
export async function bulkDeleteWithSync<T extends { id?: string; householdId?: string }>(
  table: Table<T>,
  tableName: string,
  recordIds: string[]
): Promise<void> {
  if (recordIds.length === 0) return

  // Get records first to capture householdIds
  const records = await table.bulkGet(recordIds)
  const now = new Date()

  // Delete the records
  await table.bulkDelete(recordIds)

  // Log the deletions for sync
  const deletionLogs = recordIds.map((recordId, index) => ({
    id: generateId('del'),
    tableName,
    recordId,
    householdId: records[index]?.householdId,
    deletedAt: now
  }))

  await db.deletionLog.bulkAdd(deletionLogs)
}

// =============================================================================
// AUTO-SYNC HOOKS
// =============================================================================

/**
 * List of tables that should trigger sync when modified
 * Matches SYNC_TABLES in sync.ts
 */
const SYNCABLE_TABLES = [
  'users',
  'households',
  'householdMembers',
  'chores',
  'groceryItems',
  'groceryCategories',
  'savedGroceryItems',
  'tasks',
  'taskCategories',
  'homeImprovements',
  'meals',
  'mealCategories',
  'savedMeals',
  'reminders',
  'calendarEvents',
  'homeSettings',
  'ketoSettings',
  'ketoDays',
  'ketoWeightEntries',
  'ketoBodyMeasurements',
  'ketoWaterEntries',
  'ketoSymptomEntries',
  'monthlyIncomes',
  'monthlyExchangeRates',
  'recurringExpenses',
  'expenseCategories',
  'expensePayments',
  'settlementPayments',
  'documents',
  'documentFolders',
  'documentTags',
  'maintenanceItems',
  'maintenanceTasks',
  'maintenanceLogs',
  'subscriptions',
  'subscriptionPayments',
  'pets',
  'petFeedingSchedules',
  'petFeedingLogs',
  'petMedications',
  'petMedicationLogs',
  'petVetVisits',
  'petVaccinations',
  'savingsCampaigns',
  'savingsMilestones',
  'savingsParticipants',
  'savingsContributions',
  // Personal Finance tables
  'personalWallets',
  'personalCategories',
  'personalTransactions',
  'creditCardStatements',
  'creditCardPayments'
] as const

/**
 * Emit a custom event to notify SyncContext that data has changed
 */
function emitSyncNeeded() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-needed'))
  }
}

/**
 * Set up database hooks to detect changes and trigger auto-sync
 * This is called after database initialization
 */
function setupAutoSyncHooks() {
  // Skip in server-side rendering
  if (typeof window === 'undefined') return

  SYNCABLE_TABLES.forEach(tableName => {
    const table = db[tableName as keyof DomusDatabase]
    if (!table || typeof table !== 'object' || !('hook' in table)) return

    // Type assertion for Dexie Table
    const dexieTable = table as Table<unknown>

    // Hook into creating operations
    dexieTable.hook('creating', function() {
      emitSyncNeeded()
    })

    // Hook into updating operations
    dexieTable.hook('updating', function() {
      emitSyncNeeded()
    })

    // Hook into deleting operations
    dexieTable.hook('deleting', function() {
      emitSyncNeeded()
    })
  })

  dbLogger.debug('Auto-sync hooks initialized for', SYNCABLE_TABLES.length, 'tables')
}

// Initialize hooks when the module loads (client-side only)
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure db is fully initialized
  setTimeout(() => {
    setupAutoSyncHooks()
  }, 0)
}
