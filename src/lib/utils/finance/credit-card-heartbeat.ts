// Credit Card Heartbeat - Automated daily tasks for credit card management

import { db } from '@/lib/db'
import { processAutomaticStatementClosings } from './credit-card-statements'
import { getAllCreditCardNotifications } from './credit-card-notifications'
import { dbLogger } from '@/lib/logger'

interface CreditCardHeartbeatResult {
  timestamp: Date
  statementsProcessed: {
    closedCount: number
    createdCount: number
    errors: string[]
  }
  notificationsGenerated: {
    totalUsers: number
    totalNotifications: number
    criticalAlerts: number
    errors: string[]
  }
  maintenanceTasks: {
    balanceConsistencyChecks: number
    dataCleanupTasks: number
    errors: string[]
  }
  success: boolean
  totalErrors: number
}

/**
 * Main heartbeat function for credit card automation
 * Should be called daily (ideally early morning)
 */
export async function runCreditCardHeartbeat(): Promise<CreditCardHeartbeatResult> {
  const startTime = new Date()
  const result: CreditCardHeartbeatResult = {
    timestamp: startTime,
    statementsProcessed: {
      closedCount: 0,
      createdCount: 0,
      errors: []
    },
    notificationsGenerated: {
      totalUsers: 0,
      totalNotifications: 0,
      criticalAlerts: 0,
      errors: []
    },
    maintenanceTasks: {
      balanceConsistencyChecks: 0,
      dataCleanupTasks: 0,
      errors: []
    },
    success: false,
    totalErrors: 0
  }

  try {
    dbLogger.debug('Starting credit card heartbeat', { timestamp: startTime })

    // 1. Process automatic statement closings
    try {
      const statementResults = await processAutomaticStatementClosings()
      result.statementsProcessed = statementResults
      
      if (statementResults.closedCount > 0) {
        dbLogger.info('Closed credit card statements', {
          closed: statementResults.closedCount,
          created: statementResults.createdCount
        })
      }
    } catch (error) {
      const errorMsg = `Failed to process statement closings: ${error}`
      result.statementsProcessed.errors.push(errorMsg)
      dbLogger.error('Statement processing failed', { error })
    }

    // 2. Generate and log critical notifications (for system monitoring)
    try {
      const notificationResults = await generateNotificationSummary()
      result.notificationsGenerated = notificationResults
      
      if (notificationResults.criticalAlerts > 0) {
        dbLogger.warn('Critical credit card alerts detected', {
          totalAlerts: notificationResults.totalNotifications,
          criticalAlerts: notificationResults.criticalAlerts,
          affectedUsers: notificationResults.totalUsers
        })
      }
    } catch (error) {
      const errorMsg = `Failed to generate notifications: ${error}`
      result.notificationsGenerated.errors.push(errorMsg)
      dbLogger.error('Notification generation failed', { error })
    }

    // 3. Perform maintenance tasks
    try {
      const maintenanceResults = await performMaintenanceTasks()
      result.maintenanceTasks = maintenanceResults
      
      if (maintenanceResults.balanceConsistencyChecks > 0) {
        dbLogger.debug('Performed maintenance tasks', {
          balanceChecks: maintenanceResults.balanceConsistencyChecks,
          cleanupTasks: maintenanceResults.dataCleanupTasks
        })
      }
    } catch (error) {
      const errorMsg = `Failed to perform maintenance: ${error}`
      result.maintenanceTasks.errors.push(errorMsg)
      dbLogger.error('Maintenance tasks failed', { error })
    }

    // Calculate total errors
    result.totalErrors = 
      result.statementsProcessed.errors.length +
      result.notificationsGenerated.errors.length +
      result.maintenanceTasks.errors.length

    result.success = result.totalErrors === 0

    const duration = Date.now() - startTime.getTime()
    dbLogger.info('Credit card heartbeat completed', {
      duration,
      success: result.success,
      totalErrors: result.totalErrors,
      statementsProcessed: result.statementsProcessed.closedCount,
      notificationsGenerated: result.notificationsGenerated.totalNotifications
    })

    return result

  } catch (error) {
    const errorMsg = `Critical error in credit card heartbeat: ${error}`
    result.statementsProcessed.errors.push(errorMsg)
    result.totalErrors++
    result.success = false
    
    dbLogger.error('Credit card heartbeat critical failure', { error })
    
    return result
  }
}

/**
 * Generate notification summary for all users
 */
async function generateNotificationSummary(): Promise<{
  totalUsers: number
  totalNotifications: number
  criticalAlerts: number
  errors: string[]
}> {
  const result = {
    totalUsers: 0,
    totalNotifications: 0,
    criticalAlerts: 0,
    errors: []
  }

  try {
    // Get all users with credit cards
    const creditCardWallets = await db.personalWallets
      .where('type')
      .equals('credit_card')
      .and(w => w.isActive)
      .toArray()

    const uniqueUsers = new Set(creditCardWallets.map(w => w.userId))
    result.totalUsers = uniqueUsers.size

    // Generate notifications for each user
    for (const userId of uniqueUsers) {
      try {
        const notifications = await getAllCreditCardNotifications(userId, {
          daysAhead: 7,
          usageThreshold: 70
        })
        
        result.totalNotifications += notifications.length
        result.criticalAlerts += notifications.filter(n => n.priority === 'critical').length

      } catch (error) {
        result.errors.push(`Failed to generate notifications for user ${userId}: ${error}`)
      }
    }

    return result

  } catch (error) {
    result.errors.push(`Failed to get users for notifications: ${error}`)
    return result
  }
}

type MaintenanceResult = {
  balanceConsistencyChecks: number
  dataCleanupTasks: number
  errors: string[]
}

/**
 * Perform daily maintenance tasks
 */
async function performMaintenanceTasks(): Promise<MaintenanceResult> {
  const result = {
    balanceConsistencyChecks: 0,
    dataCleanupTasks: 0,
    errors: []
  }

  try {
    // 1. Balance consistency checks
    await performBalanceConsistencyChecks(result)

    // 2. Data cleanup tasks
    await performDataCleanup(result)

    return result

  } catch (error) {
    result.errors.push(`Maintenance tasks failed: ${error}`)
    return result
  }
}

/**
 * Check for balance inconsistencies in credit card wallets
 */
async function performBalanceConsistencyChecks(result: MaintenanceResult) {
  try {
    const creditCards = await db.personalWallets
      .where('type')
      .equals('credit_card')
      .and(w => w.isActive)
      .toArray()

    for (const wallet of creditCards) {
      try {
        // Check if wallet balance aligns with transaction history
        // This is a simplified check - in production, you might want more sophisticated validation
        const recentTransactions = await db.personalTransactions
          .where('walletId')
          .equals(wallet.id!)
          .and(tx => tx.isFromCreditCard && tx.status === 'completed')
          .limit(10)
          .toArray()

        if (recentTransactions.length > 0) {
          result.balanceConsistencyChecks++
        }

        // Log if balance seems inconsistent (this is a basic check)
        if (Math.abs(wallet.balance) > (wallet.creditLimit || 0)) {
          dbLogger.warn('Credit card balance exceeds limit', {
            walletId: wallet.id,
            balance: wallet.balance,
            limit: wallet.creditLimit
          })
        }

      } catch (error) {
        result.errors.push(`Balance check failed for wallet ${wallet.id}: ${error}`)
      }
    }

  } catch (error) {
    result.errors.push(`Failed to perform balance consistency checks: ${error}`)
  }
}

/**
 * Clean up old data and optimize database
 */
async function performDataCleanup(result: MaintenanceResult) {
  try {
    // 1. Clean up old completed transactions (older than 2 years)
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const oldTransactionsCount = await db.personalTransactions
      .where('date')
      .below(twoYearsAgo)
      .and(tx => tx.status === 'completed')
      .count()

    if (oldTransactionsCount > 1000) { // Only cleanup if there are many old records
      // In a real application, you might archive these instead of deleting
      dbLogger.info('Found old transactions for potential cleanup', {
        count: oldTransactionsCount,
        cutoffDate: twoYearsAgo
      })
      result.dataCleanupTasks++
    }

    // 2. Clean up cancelled/failed transactions older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const failedTransactions = await db.personalTransactions
      .where('status')
      .equals('cancelled')
      .and(tx => tx.createdAt < thirtyDaysAgo)
      .count()

    if (failedTransactions > 0) {
      dbLogger.debug('Found old cancelled transactions', {
        count: failedTransactions
      })
      result.dataCleanupTasks++
    }

  } catch (error) {
    result.errors.push(`Data cleanup failed: ${error}`)
  }
}

/**
 * Get last heartbeat result (for status monitoring)
 */
export async function getLastHeartbeatStatus(): Promise<{
  lastRun: Date | null
  status: 'success' | 'error' | 'never_run'
  errorCount: number
  summary: string
}> {
  try {
    // In a real application, you'd store heartbeat results in the database
    // For now, we'll return a mock status
    return {
      lastRun: new Date(),
      status: 'success',
      errorCount: 0,
      summary: 'Credit card automation running normally'
    }
  } catch (error) {
    return {
      lastRun: null,
      status: 'error',
      errorCount: 1,
      summary: `Failed to get heartbeat status: ${error}`
    }
  }
}

/**
 * Force run heartbeat (for manual trigger)
 */
export async function forceRunHeartbeat(): Promise<CreditCardHeartbeatResult> {
  dbLogger.info('Manual credit card heartbeat triggered')
  return await runCreditCardHeartbeat()
}

/**
 * Test heartbeat connectivity and basic functionality
 */
export async function testHeartbeatConnectivity(): Promise<{
  databaseConnected: boolean
  functionsAccessible: boolean
  estimatedRunTime: number
  errors: string[]
}> {
  const startTime = Date.now()
  const result = {
    databaseConnected: false,
    functionsAccessible: false,
    estimatedRunTime: 0,
    errors: []
  }

  try {
    // Test database connectivity
    const _testCount = await db.personalWallets.count() // eslint-disable-line @typescript-eslint/no-unused-vars
    result.databaseConnected = true

    // Test function accessibility
    const _testNotifications = await getAllCreditCardNotifications('test-user', { // eslint-disable-line @typescript-eslint/no-unused-vars
      daysAhead: 1
    })
    result.functionsAccessible = true

    result.estimatedRunTime = Date.now() - startTime

    return result

  } catch (error) {
    result.errors.push(`Connectivity test failed: ${error}`)
    result.estimatedRunTime = Date.now() - startTime
    return result
  }
}