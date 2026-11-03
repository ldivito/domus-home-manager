/**
 * Server-side whitelist of tables accepted through the sync channel
 * (/api/sync/push) and the agent data API (/api/v1/*).
 *
 * Keep in sync with SYNC_TABLES in src/lib/sync.ts (client). A unit test
 * (src/lib/api/__tests__/sync-tables.test.ts) fails when the two drift.
 */
export const SYNC_TABLE_NAMES = [
  // Core tables
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
  // Keto module
  'ketoSettings',
  'ketoDays',
  'ketoWeightEntries',
  'ketoBodyMeasurements',
  'ketoWaterEntries',
  'ketoSymptomEntries',
  // Finance module
  'monthlyIncomes',
  'monthlyExchangeRates',
  'recurringExpenses',
  'expenseCategories',
  'expensePayments',
  'settlementPayments',
  // Personal Finance module
  'personalWallets',
  'personalCategories',
  'personalTransactions',
  'creditCardStatements',
  'creditCardPayments',
  'personalScheduledPayments',
  // Document Vault module
  'documents',
  'documentFolders',
  'documentTags',
  // Maintenance Scheduler module
  'maintenanceItems',
  'maintenanceTasks',
  'maintenanceLogs',
  // Subscription Manager module
  'subscriptions',
  'subscriptionPayments',
  // Pet Management module
  'pets',
  'petFeedingSchedules',
  'petFeedingLogs',
  'petMedications',
  'petMedicationLogs',
  'petVetVisits',
  'petVaccinations',
  // Savings module
  'savingsCampaigns',
  'savingsMilestones',
  'savingsParticipants',
  'savingsContributions',
  // Meal Prep Planner module
  'mealPrepPlans',
  'mealPrepItems',
  'mealPrepIngredients',
  'mealPrepRecipes',
  'mealPrepSessions',
  'mealPrepSteps',
  'mealPrepContainers',
  'mealPrepSchedules',
  'mealPrepComponents',
  'mealPrepCombinations',
  'savedMealComponents',
  // Activity tracking
  'activityLogs'
] as const

export type SyncTableName = typeof SYNC_TABLE_NAMES[number]

export const ALLOWED_SYNC_TABLES: ReadonlySet<string> = new Set<string>(SYNC_TABLE_NAMES)

export function isSyncTable(value: unknown): value is SyncTableName {
  return typeof value === 'string' && ALLOWED_SYNC_TABLES.has(value)
}

/** Maximum accepted record id length (shared by push and the data API). */
export const MAX_RECORD_ID_LENGTH = 200

export function isValidRecordId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_RECORD_ID_LENGTH
}
