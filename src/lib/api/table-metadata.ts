/**
 * Single source of truth describing every syncable table for the agent data
 * API: id prefix, description, and field list. GET /api/v1/tables, the
 * OpenAPI document, date normalization, defaults and required-field checks
 * are all derived from this registry.
 *
 * Each `fields` map is type-checked against the Dexie interface in
 * src/lib/db.ts: it must list every field of the interface (except the
 * system fields id/householdId/createdAt/updatedAt) and nothing else, so the
 * compiler flags drift when a field is added or removed.
 */
import type {
  ActivityLog, CalendarEvent, Chore, CreditCardPayment, CreditCardStatement, Document, DocumentFolder,
  DocumentTag, ExpenseCategory, ExpensePayment, GroceryCategory, GroceryItem, HomeImprovement, HomeSettings,
  Household, HouseholdMember, KetoBodyMeasurement, KetoDay, KetoSettings, KetoSymptomEntry, KetoWaterEntry,
  KetoWeightEntry, MaintenanceItem, MaintenanceLog, MaintenanceTask, Meal, MealCategory, MonthlyExchangeRate,
  MonthlyIncome, PersonalCategory, PersonalScheduledPayment, PersonalTransaction, PersonalWallet, Pet,
  PetFeedingLog, PetFeedingSchedule, PetMedication, PetMedicationLog, PetVaccination, PetVetVisit,
  RecurringExpense, Reminder, SavedGroceryItem, SavedMeal, SavingsCampaign, SavingsContribution,
  SavingsMilestone, SavingsParticipant, SettlementPayment, Subscription, SubscriptionPayment, Task,
  TaskCategory, User
} from '@/lib/db'
import type { SyncTableName } from '@/lib/sync-tables'

export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'array' | 'object'

/** Special default: fill with the API key owner's user id. */
export const KEY_OWNER = '$keyOwner' as const

export interface FieldSpec {
  type: FieldType
  /** Must be present when a record is created through the API. */
  required?: boolean
  enum?: readonly (string | number)[]
  /** Value used when the field is missing on create. */
  default?: unknown
  /** `table.field` this field references. */
  ref?: string
  description?: string
}

export interface TableMeta {
  module: string
  description: string
  idPrefix: string
  fields: Record<string, FieldSpec>
}

type SystemField = 'id' | 'householdId' | 'createdAt' | 'updatedAt'
type FieldMap<T> = { [K in Exclude<keyof T, SystemField> & string]-?: FieldSpec }

function define<T>(meta: Omit<TableMeta, 'fields'> & { fields: FieldMap<T> }): TableMeta {
  return meta
}

/** Fields every record carries; filled by the API when missing. */
export const SYSTEM_FIELDS: Record<SystemField, FieldSpec> = {
  id: { type: 'string', description: 'Record id. Assigned by the server (with the table prefix) when omitted.' },
  householdId: { type: 'string', description: "Filled with the API key's household; any other value is overwritten." },
  createdAt: { type: 'date', description: 'Set to the current time when omitted on create.' },
  updatedAt: { type: 'date', description: 'Last edit time (last-writer-wins). Set to the current time when omitted.' }
}

const CURRENCY = ['ARS', 'USD'] as const
const PRIORITY = ['low', 'medium', 'high'] as const

const s = (extra: Partial<FieldSpec> = {}): FieldSpec => ({ type: 'string', ...extra })
const n = (extra: Partial<FieldSpec> = {}): FieldSpec => ({ type: 'number', ...extra })
const int = (extra: Partial<FieldSpec> = {}): FieldSpec => ({ type: 'integer', ...extra })
const b = (extra: Partial<FieldSpec> = {}): FieldSpec => ({ type: 'boolean', ...extra })
const d = (extra: Partial<FieldSpec> = {}): FieldSpec => ({ type: 'date', ...extra })
const arr = (extra: Partial<FieldSpec> = {}): FieldSpec => ({ type: 'array', ...extra })
const obj = (extra: Partial<FieldSpec> = {}): FieldSpec => ({ type: 'object', ...extra })
const e = (values: readonly (string | number)[], extra: Partial<FieldSpec> = {}): FieldSpec => ({
  type: typeof values[0] === 'number' ? 'integer' : 'string',
  enum: values,
  ...extra
})
const currency = (extra: Partial<FieldSpec> = {}) => e(CURRENCY, extra)
const month = (extra: Partial<FieldSpec> = {}) => int({ description: '1-12', ...extra })
const year = (extra: Partial<FieldSpec> = {}) => int({ description: 'e.g. 2026', ...extra })

export const TABLE_METADATA: Record<SyncTableName, TableMeta> = {
  // ---------------------------------------------------------------- Core
  users: define<User>({
    module: 'core',
    description: 'Household people (residents/guests) shown across modules. Referenced by assignedUserId/userId fields of household modules.',
    idPrefix: 'usr',
    fields: {
      name: s({ required: true }),
      email: s(),
      avatar: s(),
      color: s({ default: '#3b82f6', description: 'Hex color' }),
      type: e(['resident', 'guest'], { default: 'resident' })
    }
  }),
  households: define<Household>({
    module: 'core',
    description: 'Household profile as stored on devices. Membership is managed by the app, not by this table.',
    idPrefix: 'household',
    fields: {
      name: s({ required: true }),
      description: s(),
      owner: s({ ref: 'users.id' }),
      members: arr({ description: 'User ids' }),
      inviteCode: s()
    }
  }),
  householdMembers: define<HouseholdMember>({
    module: 'core',
    description: 'Household membership mirror on devices (managed by the app).',
    idPrefix: 'hm',
    fields: {
      userId: s({ required: true }),
      role: e(['owner', 'admin', 'member'], { default: 'member' }),
      joinedAt: d(),
      permissions: obj()
    }
  }),
  chores: define<Chore>({
    module: 'chores',
    description: 'Recurring household chores.',
    idPrefix: 'chr',
    fields: {
      title: s({ required: true }),
      description: s(),
      assignedUserId: s({ ref: 'users.id' }),
      frequency: e(['daily', 'weekly', 'monthly', 'custom'], { default: 'weekly' }),
      customFrequency: obj({ description: '{ type: times_per_day|times_per_week|times_per_month|days_interval, value: number, specificDays?: number[] }' }),
      scheduledTime: s({ description: 'HH:MM' }),
      lastCompleted: d(),
      lastCompletedBy: s({ ref: 'users.id' }),
      nextDue: d({ required: true }),
      isCompleted: b({ default: false }),
      completedAt: d()
    }
  }),
  groceryItems: define<GroceryItem>({
    module: 'grocery',
    description: 'Current shopping list items.',
    idPrefix: 'gri',
    fields: {
      name: s({ required: true }),
      category: s({ required: true, ref: 'groceryCategories.name', description: 'Category NAME (not id). Default categories use translation keys, e.g. "defaultCategories.produce".' }),
      amount: s({ default: '', description: 'Free text quantity, e.g. "2 kg"' }),
      importance: e(PRIORITY, { default: 'medium' }),
      addedBy: s({ ref: 'users.id' })
    }
  }),
  groceryCategories: define<GroceryCategory>({
    module: 'grocery',
    description: 'Grocery categories (referenced by name from grocery items).',
    idPrefix: 'gcat',
    fields: {
      name: s({ required: true }),
      color: s(),
      isDefault: b({ default: false }),
      locale: s()
    }
  }),
  savedGroceryItems: define<SavedGroceryItem>({
    module: 'grocery',
    description: 'Grocery item catalogue used for quick-add and meal ingredients.',
    idPrefix: 'sgi',
    fields: {
      name: s({ required: true }),
      category: s({ required: true, ref: 'groceryCategories.name', description: 'Category NAME (not id)' }),
      amount: s(),
      importance: e(PRIORITY),
      addedBy: s({ ref: 'users.id' }),
      timesUsed: int({ default: 0 }),
      lastUsed: d()
    }
  }),
  tasks: define<Task>({
    module: 'tasks',
    description: 'To-do tasks.',
    idPrefix: 'tsk',
    fields: {
      title: s({ required: true }),
      description: s(),
      assignedUserId: s({ ref: 'users.id' }),
      dueDate: d(),
      priority: e(PRIORITY, { default: 'medium' }),
      isCompleted: b({ default: false }),
      category: s({ ref: 'taskCategories.id', description: 'Task category ID' }),
      linkedProjectId: s({ ref: 'homeImprovements.id' }),
      estimatedTime: obj({ description: '{ hours: number, minutes: number }' }),
      blockedByTaskId: s({ ref: 'tasks.id' })
    }
  }),
  taskCategories: define<TaskCategory>({
    module: 'tasks',
    description: 'Task categories (referenced by id from tasks.category).',
    idPrefix: 'tcat',
    fields: {
      name: s({ required: true }),
      color: s(),
      icon: s({ description: 'Lucide icon name' }),
      isDefault: b({ default: false }),
      locale: s()
    }
  }),
  homeImprovements: define<HomeImprovement>({
    module: 'projects',
    description: 'Home improvement projects.',
    idPrefix: 'prj',
    fields: {
      title: s({ required: true }),
      description: s(),
      status: e(['todo', 'in-progress', 'done'], { default: 'todo' }),
      assignedUserId: s({ ref: 'users.id' }),
      estimatedCost: n(),
      priority: e(PRIORITY, { default: 'medium' })
    }
  }),
  meals: define<Meal>({
    module: 'meals',
    description: 'Planned meals (meal planner entries).',
    idPrefix: 'mea',
    fields: {
      title: s({ required: true }),
      description: s(),
      date: d({ required: true }),
      mealType: e(['breakfast', 'lunch', 'dinner', 'snack'], { required: true }),
      assignedUserId: s({ ref: 'users.id' }),
      ingredients: arr({ description: 'MealIngredient[]: { id?: "ing_...", savedGroceryItemId: string, amount?: string, usageNotes?: string }' })
    }
  }),
  mealCategories: define<MealCategory>({
    module: 'meals',
    description: 'Meal categories (referenced by name from saved meals).',
    idPrefix: 'mcat',
    fields: {
      name: s({ required: true }),
      color: s(),
      isDefault: b({ default: false }),
      locale: s()
    }
  }),
  savedMeals: define<SavedMeal>({
    module: 'meals',
    description: 'Meal recipes/templates library.',
    idPrefix: 'smea',
    fields: {
      name: s({ required: true }),
      description: s(),
      category: s({ required: true, ref: 'mealCategories.name', description: 'Category NAME (not id)' }),
      ingredients: arr({ default: [], description: 'MealIngredient[]' }),
      timesUsed: int({ default: 0 }),
      lastUsed: d()
    }
  }),
  reminders: define<Reminder>({
    module: 'reminders',
    description: 'Reminders.',
    idPrefix: 'rem',
    fields: {
      title: s({ required: true }),
      description: s(),
      reminderTime: d({ required: true }),
      isCompleted: b({ default: false }),
      userId: s({ ref: 'users.id' }),
      type: e(['general', 'chore', 'task', 'meal'], { default: 'general' })
    }
  }),
  calendarEvents: define<CalendarEvent>({
    module: 'planner',
    description: 'Planner/calendar events.',
    idPrefix: 'evt',
    fields: {
      title: s({ required: true }),
      description: s(),
      date: d({ required: true, description: 'Calendar date of the event' }),
      time: s({ description: 'HH:MM (24h)' }),
      type: e(['task', 'meal', 'reminder', 'general'], { default: 'general' }),
      relatedId: s(),
      userIds: arr({ description: 'Assigned user ids' })
    }
  }),
  homeSettings: define<HomeSettings>({
    module: 'settings',
    description: 'Home information (address, contacts, preferences). Usually a single record per household.',
    idPrefix: 'hst',
    fields: {
      homeName: s(),
      homeType: e(['house', 'apartment', 'condo', 'townhouse', 'other']),
      address: obj(),
      bedrooms: n(),
      bathrooms: n(),
      squareFootage: n(),
      yearBuilt: n(),
      emergencyContact: obj(),
      propertyManager: obj(),
      serviceContacts: arr(),
      preferences: obj(),
      privateInfo: obj({ description: 'Sensitive; prefer leaving untouched' }),
      importantDates: arr(),
      notes: s(),
      lastUpdated: d({ default: '$now' })
    }
  }),

  // ---------------------------------------------------------------- Keto
  ketoSettings: define<KetoSettings>({
    module: 'keto',
    description: 'Keto plan settings per person.',
    idPrefix: 'keto_settings',
    fields: {
      userId: s({ required: true, ref: 'users.id' }),
      startDate: d({ required: true }),
      goalWeight: n(),
      weightUnit: e(['kg', 'lb']),
      targetDate: d()
    }
  }),
  ketoDays: define<KetoDay>({
    module: 'keto',
    description: 'Daily keto status.',
    idPrefix: 'keto',
    fields: {
      userId: s({ required: true, ref: 'users.id' }),
      date: d({ required: true }),
      status: e(['success', 'fasting', 'cheat'], { required: true })
    }
  }),
  ketoWeightEntries: define<KetoWeightEntry>({
    module: 'keto',
    description: 'Weight log.',
    idPrefix: 'weight',
    fields: {
      userId: s({ required: true, ref: 'users.id' }),
      date: d({ required: true }),
      weight: n({ required: true }),
      unit: e(['kg', 'lb'], { default: 'kg' }),
      notes: s()
    }
  }),
  ketoBodyMeasurements: define<KetoBodyMeasurement>({
    module: 'keto',
    description: 'Body measurements log.',
    idPrefix: 'measurement',
    fields: {
      userId: s({ required: true, ref: 'users.id' }),
      date: d({ required: true }),
      waist: n(), hips: n(), chest: n(), arms: n(), thighs: n(), neck: n(),
      unit: e(['cm', 'in'], { default: 'cm' }),
      notes: s()
    }
  }),
  ketoWaterEntries: define<KetoWaterEntry>({
    module: 'keto',
    description: 'Daily water intake.',
    idPrefix: 'water',
    fields: {
      userId: s({ required: true, ref: 'users.id' }),
      date: d({ required: true }),
      glasses: int({ required: true }),
      goalGlasses: int({ default: 8 })
    }
  }),
  ketoSymptomEntries: define<KetoSymptomEntry>({
    module: 'keto',
    description: 'Symptom log.',
    idPrefix: 'symptom',
    fields: {
      userId: s({ required: true, ref: 'users.id' }),
      date: d({ required: true }),
      symptom: e(['energy', 'mental_clarity', 'hunger', 'cravings', 'sleep', 'mood', 'headache', 'fatigue', 'nausea', 'other'], { required: true }),
      severity: e([1, 2, 3, 4, 5], { required: true }),
      notes: s()
    }
  }),

  // ---------------------------------------------------------------- Household finance
  monthlyIncomes: define<MonthlyIncome>({
    module: 'finance',
    description: 'Monthly income per household person (shared-finance module).',
    idPrefix: 'inc',
    fields: {
      userId: s({ required: true, ref: 'users.id' }),
      amount: n({ required: true }),
      currency: currency({ default: 'ARS' }),
      source: s({ required: true, description: 'e.g. "Salary"' }),
      month: month({ required: true }),
      year: year({ required: true })
    }
  }),
  monthlyExchangeRates: define<MonthlyExchangeRate>({
    module: 'finance',
    description: 'USD to ARS exchange rate per month.',
    idPrefix: 'exr',
    fields: {
      rate: n({ required: true, description: 'ARS per 1 USD' }),
      month: month({ required: true }),
      year: year({ required: true })
    }
  }),
  recurringExpenses: define<RecurringExpense>({
    module: 'finance',
    description: 'Recurring household services/expenses (rent, utilities...).',
    idPrefix: 'exp',
    fields: {
      name: s({ required: true }),
      description: s(),
      amount: n({ required: true, description: 'Default/estimated amount; per-month values live in expensePayments' }),
      currency: currency({ default: 'ARS' }),
      category: s({ required: true, ref: 'expenseCategories.id', description: 'Expense category ID' }),
      frequency: e(['monthly', 'bimonthly', 'quarterly', 'yearly'], { default: 'monthly' }),
      dueDay: int({ required: true, description: 'Day of month 1-31' }),
      isActive: b({ default: true })
    }
  }),
  expenseCategories: define<ExpenseCategory>({
    module: 'finance',
    description: 'Household expense categories. Default ones use translation keys as name (e.g. "defaultExpenseCategories.utilities").',
    idPrefix: 'ecat',
    fields: {
      name: s({ required: true }),
      icon: s({ description: 'Lucide icon name' }),
      color: s(),
      isDefault: b({ default: false })
    }
  }),
  expensePayments: define<ExpensePayment>({
    module: 'finance',
    description: 'Per-month value and payment status of a recurring expense.',
    idPrefix: 'pay',
    fields: {
      recurringExpenseId: s({ required: true, ref: 'recurringExpenses.id' }),
      amount: n({ required: true }),
      currency: currency({ default: 'ARS' }),
      month: month({ required: true }),
      year: year({ required: true }),
      dueDate: d({ required: true }),
      paidDate: d(),
      paidByUserId: s({ ref: 'users.id' }),
      status: e(['pending', 'paid', 'overdue'], { default: 'pending' }),
      notes: s()
    }
  }),
  settlementPayments: define<SettlementPayment>({
    module: 'finance',
    description: 'Settlements between household members.',
    idPrefix: 'sett',
    fields: {
      fromUserId: s({ required: true, ref: 'users.id' }),
      toUserId: s({ required: true, ref: 'users.id' }),
      amount: n({ required: true, description: 'Amount in ARS' }),
      month: month({ required: true }),
      year: year({ required: true }),
      paidDate: d({ required: true }),
      notes: s()
    }
  }),

  // ---------------------------------------------------------------- Personal finance
  personalWallets: define<PersonalWallet>({
    module: 'personalFinance',
    description: 'Personal wallets: cash, bank accounts and credit cards.',
    idPrefix: 'pw',
    fields: {
      userId: s({ default: KEY_OWNER, description: 'Owner (auth user id); defaults to the API key owner' }),
      name: s({ required: true }),
      type: e(['physical', 'bank', 'credit_card'], { required: true }),
      currency: currency({ default: 'ARS' }),
      balance: n({ default: 0, description: 'Stored balance. NOT recalculated when transactions are written through the API.' }),
      creditLimit: n(),
      closingDay: int({ description: 'Credit cards: day of month 1-31' }),
      dueDay: int({ description: 'Credit cards: days after closing' }),
      accountNumber: s({ description: 'Masked, e.g. ****1234' }),
      bankName: s(),
      color: s({ default: '#3b82f6' }),
      icon: s({ default: 'Wallet' }),
      isActive: b({ default: true }),
      notes: s()
    }
  }),
  personalCategories: define<PersonalCategory>({
    module: 'personalFinance',
    description: 'Personal income/expense categories.',
    idPrefix: 'pc',
    fields: {
      userId: s({ default: KEY_OWNER }),
      name: s({ required: true }),
      type: e(['income', 'expense'], { required: true }),
      color: s({ default: '#6b7280' }),
      icon: s({ default: 'Tag' }),
      isActive: b({ default: true }),
      isDefault: b({ default: false })
    }
  }),
  personalTransactions: define<PersonalTransaction>({
    module: 'personalFinance',
    description: 'Personal income/expense/transfer transactions. Accepts categoryName/walletName/targetWalletName instead of ids on write.',
    idPrefix: 'pt',
    fields: {
      userId: s({ default: KEY_OWNER }),
      type: e(['income', 'expense', 'transfer'], { required: true }),
      amount: n({ required: true, description: 'Always positive; direction comes from type' }),
      currency: currency({ default: 'ARS' }),
      walletId: s({ required: true, ref: 'personalWallets.id', description: 'Or pass walletName' }),
      targetWalletId: s({ ref: 'personalWallets.id', description: 'Transfers only. Or pass targetWalletName' }),
      categoryId: s({ required: true, ref: 'personalCategories.id', description: 'Or pass categoryName' }),
      description: s({ required: true }),
      exchangeRate: n(),
      date: d({ required: true }),
      creditCardStatementId: s({ ref: 'creditCardStatements.id' }),
      isFromCreditCard: b({ default: false }),
      sharedWithHousehold: b({ default: false }),
      householdContribution: n(),
      status: e(['pending', 'completed', 'cancelled'], { default: 'completed' }),
      notes: s()
    }
  }),
  creditCardStatements: define<CreditCardStatement>({
    module: 'personalFinance',
    description: 'Credit card statements (billing periods).',
    idPrefix: 'ccs',
    fields: {
      userId: s({ default: KEY_OWNER }),
      walletId: s({ required: true, ref: 'personalWallets.id' }),
      periodStart: d({ required: true }),
      periodEnd: d({ required: true, description: 'Closing date' }),
      dueDate: d({ required: true }),
      totalCharges: n({ default: 0 }),
      totalPayments: n({ default: 0 }),
      currentBalance: n({ default: 0 }),
      minimumPayment: n({ default: 0 }),
      currency: currency({ default: 'ARS' }),
      paidAmount: n({ default: 0 }),
      paidDate: d(),
      status: e(['open', 'closed', 'paid', 'overdue'], { default: 'open' })
    }
  }),
  creditCardPayments: define<CreditCardPayment>({
    module: 'personalFinance',
    description: 'Payments made towards credit card statements.',
    idPrefix: 'ccp',
    fields: {
      userId: s({ default: KEY_OWNER }),
      statementId: s({ required: true, ref: 'creditCardStatements.id' }),
      fromWalletId: s({ required: true, ref: 'personalWallets.id' }),
      amount: n({ required: true }),
      currency: currency({ default: 'ARS' }),
      paymentDate: d({ required: true }),
      notes: s()
    }
  }),
  personalScheduledPayments: define<PersonalScheduledPayment>({
    module: 'personalFinance',
    description: 'Automatic credit card payment rules.',
    idPrefix: 'psp',
    fields: {
      userId: s({ default: KEY_OWNER }),
      walletId: s({ required: true, ref: 'personalWallets.id', description: 'Credit card wallet to pay' }),
      sourceWalletId: s({ required: true, ref: 'personalWallets.id' }),
      paymentType: e(['minimum', 'full', 'fixed'], { required: true }),
      fixedAmount: n({ description: "Required when paymentType is 'fixed'" }),
      daysBefore: int({ default: 0, description: '0-28' }),
      isActive: b({ default: true }),
      lastProcessedStatementId: s()
    }
  }),

  // ---------------------------------------------------------------- Documents
  documents: define<Document>({
    module: 'documents',
    description: 'Document vault entries (metadata; fileData holds base64 content and should normally be omitted).',
    idPrefix: 'doc',
    fields: {
      name: s({ required: true }),
      description: s(),
      category: e(['warranty', 'manual', 'receipt', 'contract', 'insurance', 'medical', 'legal', 'financial', 'vehicle', 'property', 'pet', 'other'], { default: 'other' }),
      fileType: s({ default: '', description: 'MIME type' }),
      fileName: s({ default: '' }),
      fileSize: int({ default: 0 }),
      fileData: s({ description: 'Base64 file content (large; avoid)' }),
      tags: arr(),
      expirationDate: d(),
      reminderEnabled: b({ default: false }),
      reminderDaysBefore: int(),
      linkedApplianceId: s(),
      linkedVehicleId: s(),
      linkedPetId: s({ ref: 'pets.id' }),
      linkedSubscriptionId: s({ ref: 'subscriptions.id' }),
      linkedMaintenanceItemId: s({ ref: 'maintenanceItems.id' }),
      purchaseDate: d(),
      purchasePrice: n(),
      purchaseCurrency: currency(),
      vendor: s(),
      notes: s(),
      uploadedByUserId: s()
    }
  }),
  documentFolders: define<DocumentFolder>({
    module: 'documents',
    description: 'Document folders.',
    idPrefix: 'dfld',
    fields: {
      name: s({ required: true }),
      parentFolderId: s({ ref: 'documentFolders.id' }),
      color: s(),
      icon: s()
    }
  }),
  documentTags: define<DocumentTag>({
    module: 'documents',
    description: 'Document tags.',
    idPrefix: 'dtag',
    fields: {
      name: s({ required: true }),
      color: s()
    }
  }),

  // ---------------------------------------------------------------- Maintenance
  maintenanceItems: define<MaintenanceItem>({
    module: 'maintenance',
    description: 'Things that need maintenance (appliances, vehicle, HVAC...).',
    idPrefix: 'maint',
    fields: {
      name: s({ required: true }),
      description: s(),
      type: e(['appliance', 'hvac', 'plumbing', 'electrical', 'vehicle', 'roof', 'exterior', 'landscaping', 'pool', 'security', 'other'], { default: 'other' }),
      location: s(),
      brand: s(),
      model: s(),
      serialNumber: s(),
      purchaseDate: d(),
      warrantyExpirationDate: d(),
      linkedDocumentIds: arr(),
      notes: s(),
      imageData: s({ description: 'Base64 photo (large; avoid)' })
    }
  }),
  maintenanceTasks: define<MaintenanceTask>({
    module: 'maintenance',
    description: 'Scheduled maintenance tasks for an item.',
    idPrefix: 'task',
    fields: {
      maintenanceItemId: s({ required: true, ref: 'maintenanceItems.id' }),
      name: s({ required: true }),
      description: s(),
      frequency: e(['once', 'weekly', 'monthly', 'quarterly', 'biannually', 'yearly', 'custom'], { default: 'yearly' }),
      customFrequencyDays: int(),
      lastCompleted: d(),
      nextDue: d({ required: true }),
      reminderEnabled: b({ default: true }),
      reminderDaysBefore: int(),
      estimatedCostMin: n(),
      estimatedCostMax: n(),
      estimatedCurrency: currency(),
      estimatedDurationMinutes: int(),
      priority: e(['low', 'medium', 'high', 'critical'], { default: 'medium' }),
      assignedUserId: s({ ref: 'users.id' }),
      preferredProvider: s(),
      providerPhone: s(),
      providerEmail: s(),
      notes: s()
    }
  }),
  maintenanceLogs: define<MaintenanceLog>({
    module: 'maintenance',
    description: 'Completed maintenance history.',
    idPrefix: 'log',
    fields: {
      maintenanceItemId: s({ required: true, ref: 'maintenanceItems.id' }),
      maintenanceTaskId: s({ ref: 'maintenanceTasks.id' }),
      title: s({ required: true }),
      description: s(),
      completedDate: d({ required: true }),
      completedByUserId: s({ ref: 'users.id' }),
      actualCost: n(),
      costCurrency: currency(),
      serviceProvider: s(),
      isExternalService: b({ default: false }),
      linkedDocumentIds: arr(),
      notes: s()
    }
  }),

  // ---------------------------------------------------------------- Subscriptions
  subscriptions: define<Subscription>({
    module: 'subscriptions',
    description: 'Recurring subscriptions (streaming, software...).',
    idPrefix: 'sub',
    fields: {
      name: s({ required: true }),
      description: s(),
      category: e(['streaming', 'software', 'gaming', 'music', 'cloud_storage', 'news', 'fitness', 'utilities', 'insurance', 'membership', 'other'], { default: 'other' }),
      amount: n({ required: true }),
      currency: currency({ default: 'ARS' }),
      amountARS: n(),
      amountUSD: n(),
      billingCycle: e(['weekly', 'monthly', 'quarterly', 'biannually', 'yearly'], { default: 'monthly' }),
      billingDay: int({ required: true }),
      nextBillingDate: d({ required: true }),
      status: e(['active', 'paused', 'cancelled', 'trial'], { default: 'active' }),
      trialEndDate: d(),
      cancelledDate: d(),
      autoRenew: b({ default: true }),
      reminderEnabled: b({ default: false }),
      reminderDaysBefore: int(),
      providerName: s(),
      providerWebsite: s(),
      providerEmail: s(),
      providerPhone: s(),
      accountEmail: s(),
      accountUsername: s(),
      linkedExpenseId: s({ ref: 'recurringExpenses.id' }),
      linkedDocumentIds: arr(),
      notes: s()
    }
  }),
  subscriptionPayments: define<SubscriptionPayment>({
    module: 'subscriptions',
    description: 'Payments recorded for subscriptions.',
    idPrefix: 'sp',
    fields: {
      subscriptionId: s({ required: true, ref: 'subscriptions.id' }),
      amount: n({ required: true }),
      currency: currency({ default: 'ARS' }),
      paymentDate: d({ required: true }),
      paymentMethod: s(),
      status: e(['paid', 'failed', 'pending', 'refunded'], { default: 'paid' }),
      transactionId: s(),
      notes: s()
    }
  }),

  // ---------------------------------------------------------------- Pets
  pets: define<Pet>({
    module: 'pets',
    description: 'Pets.',
    idPrefix: 'pet',
    fields: {
      name: s({ required: true }),
      type: e(['dog', 'cat', 'bird', 'fish', 'reptile', 'small_mammal', 'other'], { required: true }),
      breed: s(),
      gender: e(['male', 'female', 'unknown'], { default: 'unknown' }),
      birthDate: d(),
      weight: n(),
      weightUnit: e(['kg', 'lb'], { default: 'kg' }),
      microchipId: s(),
      isNeutered: b(),
      allergies: arr(),
      veterinarianName: s(),
      veterinarianPhone: s(),
      veterinarianAddress: s(),
      emergencyVetName: s(),
      emergencyVetPhone: s(),
      insuranceProvider: s(),
      insurancePolicyNumber: s(),
      insuranceExpiration: d(),
      photo: s({ description: 'Base64 photo (large; avoid)' }),
      primaryCaretakerId: s({ ref: 'users.id' }),
      notes: s()
    }
  }),
  petFeedingSchedules: define<PetFeedingSchedule>({
    module: 'pets',
    description: 'Feeding schedules.',
    idPrefix: 'feed',
    fields: {
      petId: s({ required: true, ref: 'pets.id' }),
      name: s({ required: true }),
      foodType: s({ required: true }),
      foodBrand: s(),
      amount: s({ required: true }),
      scheduledTime: s({ required: true, description: 'HH:MM' }),
      frequency: e(['daily', 'specific_days'], { default: 'daily' }),
      specificDays: arr({ description: '0=Sunday ... 6=Saturday' }),
      assignedUserId: s({ ref: 'users.id' }),
      notes: s(),
      isActive: b({ default: true })
    }
  }),
  petFeedingLogs: define<PetFeedingLog>({
    module: 'pets',
    description: 'Feeding log.',
    idPrefix: 'feedlog',
    fields: {
      feedingScheduleId: s({ ref: 'petFeedingSchedules.id' }),
      petId: s({ required: true, ref: 'pets.id' }),
      fedDate: d({ required: true }),
      fedByUserId: s({ ref: 'users.id' }),
      foodType: s(),
      amount: s(),
      notes: s()
    }
  }),
  petMedications: define<PetMedication>({
    module: 'pets',
    description: 'Medications.',
    idPrefix: 'med',
    fields: {
      petId: s({ required: true, ref: 'pets.id' }),
      name: s({ required: true }),
      dosage: s({ required: true }),
      frequency: e(['once', 'daily', 'twice_daily', 'weekly', 'monthly', 'as_needed'], { default: 'daily' }),
      startDate: d({ required: true }),
      endDate: d(),
      nextDose: d(),
      prescribedBy: s(),
      pharmacy: s(),
      refillsRemaining: int(),
      reminderEnabled: b({ default: false }),
      reminderTime: s({ description: 'HH:MM' }),
      notes: s(),
      isActive: b({ default: true })
    }
  }),
  petMedicationLogs: define<PetMedicationLog>({
    module: 'pets',
    description: 'Medication administration log.',
    idPrefix: 'medlog',
    fields: {
      medicationId: s({ required: true, ref: 'petMedications.id' }),
      petId: s({ required: true, ref: 'pets.id' }),
      givenDate: d({ required: true }),
      givenByUserId: s({ ref: 'users.id' }),
      dosageGiven: s(),
      skipped: b({ default: false }),
      skipReason: s(),
      notes: s()
    }
  }),
  petVetVisits: define<PetVetVisit>({
    module: 'pets',
    description: 'Vet visits.',
    idPrefix: 'vet',
    fields: {
      petId: s({ required: true, ref: 'pets.id' }),
      visitDate: d({ required: true }),
      visitType: e(['checkup', 'vaccination', 'illness', 'injury', 'surgery', 'dental', 'grooming', 'emergency', 'other'], { default: 'checkup' }),
      vetName: s(),
      clinicName: s(),
      reason: s({ required: true }),
      diagnosis: s(),
      treatment: s(),
      prescriptions: s(),
      cost: n(),
      currency: currency({ default: 'ARS' }),
      followUpDate: d(),
      followUpNotes: s(),
      linkedDocumentIds: arr(),
      notes: s()
    }
  }),
  petVaccinations: define<PetVaccination>({
    module: 'pets',
    description: 'Vaccinations.',
    idPrefix: 'vax',
    fields: {
      petId: s({ required: true, ref: 'pets.id' }),
      vaccineName: s({ required: true }),
      dateAdministered: d({ required: true }),
      administeredBy: s(),
      clinicName: s(),
      batchNumber: s(),
      expirationDate: d(),
      nextDueDate: d(),
      reminderEnabled: b({ default: true }),
      reminderDaysBefore: int(),
      linkedDocumentId: s({ ref: 'documents.id' }),
      notes: s()
    }
  }),

  // ---------------------------------------------------------------- Savings
  savingsCampaigns: define<SavingsCampaign>({
    module: 'savings',
    description: 'Savings goals/campaigns.',
    idPrefix: 'sav',
    fields: {
      name: s({ required: true }),
      description: s(),
      goalAmount: n({ required: true }),
      currency: currency({ default: 'ARS' }),
      deadline: d({ required: true }),
      savingMethod: e(['52_week_challenge', 'envelope_method', 'round_up', 'fixed_monthly', 'bi_weekly', 'custom'], { default: 'custom' }),
      customMethodDetails: s(),
      distributionMethod: e(['equal', 'percentage'], { default: 'equal' }),
      currentAmount: n({ default: 0, description: 'Cached total of contributions' }),
      isActive: b({ default: true }),
      isCompleted: b({ default: false }),
      completedAt: d(),
      createdByUserId: s({ ref: 'users.id' })
    }
  }),
  savingsMilestones: define<SavingsMilestone>({
    module: 'savings',
    description: 'Campaign milestones.',
    idPrefix: 'sml',
    fields: {
      campaignId: s({ required: true, ref: 'savingsCampaigns.id' }),
      name: s({ required: true }),
      targetAmount: n({ required: true }),
      targetDate: d({ required: true }),
      isReached: b({ default: false }),
      reachedAt: d(),
      order: int({ default: 1 })
    }
  }),
  savingsParticipants: define<SavingsParticipant>({
    module: 'savings',
    description: 'Campaign participants.',
    idPrefix: 'spt',
    fields: {
      campaignId: s({ required: true, ref: 'savingsCampaigns.id' }),
      userId: s({ required: true, ref: 'users.id' }),
      sharePercentage: n(),
      isActive: b({ default: true }),
      joinedAt: d({ default: '$now' })
    }
  }),
  savingsContributions: define<SavingsContribution>({
    module: 'savings',
    description: 'Contributions to a campaign.',
    idPrefix: 'scn',
    fields: {
      campaignId: s({ required: true, ref: 'savingsCampaigns.id' }),
      participantId: s({ required: true, ref: 'savingsParticipants.id' }),
      userId: s({ required: true, ref: 'users.id' }),
      amount: n({ required: true }),
      currency: currency({ default: 'ARS' }),
      contributionDate: d({ required: true }),
      notes: s()
    }
  }),

  // ---------------------------------------------------------------- Activity
  activityLogs: define<ActivityLog>({
    module: 'activity',
    description: 'Activity feed entries (normally written by the app).',
    idPrefix: 'act',
    fields: {
      userId: s({ ref: 'users.id' }),
      action: s({ required: true }),
      entityType: s({ required: true }),
      entityId: s(),
      entityTitle: s({ required: true }),
      details: obj(),
      timestamp: d({ default: '$now' })
    }
  })
}

/** Default value marker resolved to the current time. */
export const NOW = '$now'

export function getTableMeta(table: SyncTableName): TableMeta {
  return TABLE_METADATA[table]
}

/** All fields (system + table) of a table. */
export function allFields(table: SyncTableName): Record<string, FieldSpec> {
  return { ...SYSTEM_FIELDS, ...TABLE_METADATA[table].fields }
}

export interface TableDescription {
  name: SyncTableName
  module: string
  description: string
  idPrefix: string
  fields: Array<{ name: string } & FieldSpec>
}

/** Public, JSON-serializable description of a table (used by GET /api/v1/tables). */
export function describeTable(table: SyncTableName): TableDescription {
  const meta = TABLE_METADATA[table]
  return {
    name: table,
    module: meta.module,
    description: meta.description,
    idPrefix: meta.idPrefix,
    fields: Object.entries(allFields(table)).map(([name, spec]) => ({ name, ...spec }))
  }
}
