import { db, ActivityLog, ActivityAction, EntityType } from './db'
import { generateId } from './utils'

interface LogActivityParams {
  userId?: string
  action: ActivityAction
  entityType: EntityType
  entityId?: string
  entityTitle: string
  details?: Record<string, unknown>
  householdId?: string
}

/**
 * Log an activity to the activity log
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const now = new Date()

  const activity: ActivityLog = {
    id: generateId('act'),
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityTitle: params.entityTitle,
    details: params.details,
    timestamp: now,
    householdId: params.householdId,
    createdAt: now
  }

  await db.activityLogs.add(activity)
}

/**
 * Convenience object with methods for logging common activity types
 */
export const ActivityLogger = {
  // Chores
  choreCreated: (choreId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'chore_created', entityType: 'chore', entityId: choreId, entityTitle: title, userId, householdId }),

  choreCompleted: (choreId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'chore_completed', entityType: 'chore', entityId: choreId, entityTitle: title, userId, householdId }),

  choreUpdated: (choreId: string, title: string, userId?: string, householdId?: string, details?: Record<string, unknown>) =>
    logActivity({ action: 'chore_updated', entityType: 'chore', entityId: choreId, entityTitle: title, userId, householdId, details }),

  choreDeleted: (choreId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'chore_deleted', entityType: 'chore', entityId: choreId, entityTitle: title, userId, householdId }),

  choreAssigned: (choreId: string, title: string, assignedToUserId: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'chore_assigned', entityType: 'chore', entityId: choreId, entityTitle: title, userId, householdId, details: { assignedToUserId } }),

  // Tasks
  taskCreated: (taskId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'task_created', entityType: 'task', entityId: taskId, entityTitle: title, userId, householdId }),

  taskCompleted: (taskId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'task_completed', entityType: 'task', entityId: taskId, entityTitle: title, userId, householdId }),

  taskUpdated: (taskId: string, title: string, userId?: string, householdId?: string, details?: Record<string, unknown>) =>
    logActivity({ action: 'task_updated', entityType: 'task', entityId: taskId, entityTitle: title, userId, householdId, details }),

  taskDeleted: (taskId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'task_deleted', entityType: 'task', entityId: taskId, entityTitle: title, userId, householdId }),

  taskAssigned: (taskId: string, title: string, assignedToUserId: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'task_assigned', entityType: 'task', entityId: taskId, entityTitle: title, userId, householdId, details: { assignedToUserId } }),

  // Grocery
  groceryItemAdded: (itemId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'grocery_item_added', entityType: 'groceryItem', entityId: itemId, entityTitle: name, userId, householdId }),

  groceryItemPurchased: (itemId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'grocery_item_purchased', entityType: 'groceryItem', entityId: itemId, entityTitle: name, userId, householdId }),

  groceryItemDeleted: (itemId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'grocery_item_deleted', entityType: 'groceryItem', entityId: itemId, entityTitle: name, userId, householdId }),

  // Meals
  mealPlanned: (mealId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'meal_planned', entityType: 'meal', entityId: mealId, entityTitle: title, userId, householdId }),

  mealUpdated: (mealId: string, title: string, userId?: string, householdId?: string, details?: Record<string, unknown>) =>
    logActivity({ action: 'meal_updated', entityType: 'meal', entityId: mealId, entityTitle: title, userId, householdId, details }),

  mealDeleted: (mealId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'meal_deleted', entityType: 'meal', entityId: mealId, entityTitle: title, userId, householdId }),

  mealAssigned: (mealId: string, title: string, assignedToUserId: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'meal_assigned', entityType: 'meal', entityId: mealId, entityTitle: title, userId, householdId, details: { assignedToUserId } }),

  // Projects (Home Improvements)
  projectCreated: (projectId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'project_created', entityType: 'homeImprovement', entityId: projectId, entityTitle: title, userId, householdId }),

  projectStatusChanged: (projectId: string, title: string, newStatus: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'project_status_changed', entityType: 'homeImprovement', entityId: projectId, entityTitle: title, userId, householdId, details: { newStatus } }),

  projectDeleted: (projectId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'project_deleted', entityType: 'homeImprovement', entityId: projectId, entityTitle: title, userId, householdId }),

  projectAssigned: (projectId: string, title: string, assignedToUserId: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'project_assigned', entityType: 'homeImprovement', entityId: projectId, entityTitle: title, userId, householdId, details: { assignedToUserId } }),

  // Reminders
  reminderCreated: (reminderId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'reminder_created', entityType: 'reminder', entityId: reminderId, entityTitle: title, userId, householdId }),

  reminderDismissed: (reminderId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'reminder_dismissed', entityType: 'reminder', entityId: reminderId, entityTitle: title, userId, householdId }),

  reminderDeleted: (reminderId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'reminder_deleted', entityType: 'reminder', entityId: reminderId, entityTitle: title, userId, householdId }),

  // Keto
  weightEntryAdded: (entryId: string, weight: number, unit: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'weight_entry_added', entityType: 'ketoWeight', entityId: entryId, entityTitle: `${weight} ${unit}`, userId, householdId }),

  symptomLogged: (entryId: string, symptom: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'symptom_logged', entityType: 'ketoSymptom', entityId: entryId, entityTitle: symptom, userId, householdId }),

  waterIntakeLogged: (entryId: string, amount: number, unit: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'water_intake_logged', entityType: 'ketoWater', entityId: entryId, entityTitle: `${amount} ${unit}`, userId, householdId }),

  // Finance
  incomeAdded: (incomeId: string, description: string, amount: number, currency: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'income_added', entityType: 'income', entityId: incomeId, entityTitle: description, userId, householdId, details: { amount, currency } }),

  expenseAdded: (expenseId: string, name: string, amount: number, currency: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'expense_added', entityType: 'expense', entityId: expenseId, entityTitle: name, userId, householdId, details: { amount, currency } }),

  paymentMade: (paymentId: string, expenseName: string, amount: number, currency: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'payment_made', entityType: 'expense', entityId: paymentId, entityTitle: expenseName, userId, householdId, details: { amount, currency } }),

  // Subscriptions
  subscriptionCreated: (subscriptionId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'subscription_created', entityType: 'subscription', entityId: subscriptionId, entityTitle: name, userId, householdId }),

  subscriptionPaymentRecorded: (paymentId: string, subscriptionName: string, amount: number, currency: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'subscription_payment_recorded', entityType: 'subscription', entityId: paymentId, entityTitle: subscriptionName, userId, householdId, details: { amount, currency } }),

  subscriptionCancelled: (subscriptionId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'subscription_cancelled', entityType: 'subscription', entityId: subscriptionId, entityTitle: name, userId, householdId }),

  // Pets
  petFeedingLogged: (feedingId: string, petName: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'pet_feeding_logged', entityType: 'petFeeding', entityId: feedingId, entityTitle: petName, userId, householdId }),

  petMedicationGiven: (medicationId: string, petName: string, medicationName: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'pet_medication_given', entityType: 'petMedication', entityId: medicationId, entityTitle: `${petName}: ${medicationName}`, userId, householdId }),

  vetVisitLogged: (visitId: string, petName: string, reason: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'vet_visit_logged', entityType: 'pet', entityId: visitId, entityTitle: `${petName}: ${reason}`, userId, householdId }),

  // Maintenance
  maintenanceCompleted: (logId: string, taskName: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'maintenance_completed', entityType: 'maintenance', entityId: logId, entityTitle: taskName, userId, householdId }),

  maintenanceAssigned: (taskId: string, taskName: string, assignedToUserId: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'maintenance_assigned', entityType: 'maintenance', entityId: taskId, entityTitle: taskName, userId, householdId, details: { assignedToUserId } }),

  // Documents
  documentUploaded: (documentId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'document_uploaded', entityType: 'document', entityId: documentId, entityTitle: name, userId, householdId }),

  documentDeleted: (documentId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'document_deleted', entityType: 'document', entityId: documentId, entityTitle: name, userId, householdId }),

  // Savings
  contributionMade: (contributionId: string, campaignName: string, amount: number, currency: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'contribution_made', entityType: 'savings', entityId: contributionId, entityTitle: campaignName, userId, householdId, details: { amount, currency } }),

  milestoneReached: (milestoneId: string, campaignName: string, milestoneName: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'milestone_reached', entityType: 'savings', entityId: milestoneId, entityTitle: `${campaignName}: ${milestoneName}`, userId, householdId }),

  campaignCreated: (campaignId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'campaign_created', entityType: 'savings', entityId: campaignId, entityTitle: name, userId, householdId }),

  // Users
  userCreated: (newUserId: string, name: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'user_created', entityType: 'user', entityId: newUserId, entityTitle: name, userId, householdId }),

  userUpdated: (updatedUserId: string, name: string, userId?: string, householdId?: string, details?: Record<string, unknown>) =>
    logActivity({ action: 'user_updated', entityType: 'user', entityId: updatedUserId, entityTitle: name, userId, householdId, details }),

  // Calendar Events
  eventCreated: (eventId: string, title: string, userId?: string, householdId?: string) =>
    logActivity({ action: 'event_created', entityType: 'calendarEvent', entityId: eventId, entityTitle: title, userId, householdId }),

  eventUpdated: (eventId: string, title: string, userId?: string, householdId?: string, details?: Record<string, unknown>) =>
    logActivity({ action: 'event_updated', entityType: 'calendarEvent', entityId: eventId, entityTitle: title, userId, householdId, details })
}
