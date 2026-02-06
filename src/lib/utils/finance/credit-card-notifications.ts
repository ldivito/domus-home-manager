// Credit Card Notification System - Manage due date notifications and alerts

import { db } from '@/lib/db'
import { 
  CurrencyType 
} from '@/types/personal-finance'
import { getUpcomingDueDates, getCurrentStatement } from './credit-card-statements'
import { formatCurrency } from './formatters'

export interface CreditCardNotification {
  id: string
  walletId: string
  walletName: string
  statementId: string
  type: 'due_soon' | 'overdue' | 'closing_soon' | 'minimum_payment_alert'
  title: string
  message: string
  dueDate: Date
  amount: number
  currency: CurrencyType
  daysUntilDue: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: Date
}

/**
 * Generate notifications for upcoming due dates
 */
export async function generateDueNotifications(
  userId: string,
  daysAhead: number = 7
): Promise<CreditCardNotification[]> {
  const notifications: CreditCardNotification[] = []
  
  try {
    const upcomingDues = await getUpcomingDueDates(userId, daysAhead)

    for (const { wallet, statement, daysUntilDue, isOverdue } of upcomingDues) {
      const remainingBalance = statement.currentBalance - statement.paidAmount

      // Skip if already paid
      if (remainingBalance <= 0) continue

      let notification: CreditCardNotification

      if (isOverdue) {
        // Overdue notification
        notification = {
          id: `overdue_${wallet.id}_${statement.id}`,
          walletId: wallet.id!,
          walletName: wallet.name,
          statementId: statement.id!,
          type: 'overdue',
          title: '🚨 Credit Card Payment Overdue',
          message: `Payment for ${wallet.name} is ${Math.abs(daysUntilDue)} days overdue. Balance: ${formatCurrency(remainingBalance, statement.currency)}`,
          dueDate: statement.dueDate,
          amount: remainingBalance,
          currency: wallet.currency,
          daysUntilDue,
          priority: 'critical',
          createdAt: new Date()
        }
      } else if (daysUntilDue <= 1) {
        // Due tomorrow or today
        notification = {
          id: `due_today_${wallet.id}_${statement.id}`,
          walletId: wallet.id!,
          walletName: wallet.name,
          statementId: statement.id!,
          type: 'due_soon',
          title: '⚡ Credit Card Payment Due Soon',
          message: `${wallet.name} payment is due ${daysUntilDue === 0 ? 'today' : 'tomorrow'}. Balance: ${formatCurrency(remainingBalance, statement.currency)}`,
          dueDate: statement.dueDate,
          amount: remainingBalance,
          currency: wallet.currency,
          daysUntilDue,
          priority: 'high',
          createdAt: new Date()
        }
      } else if (daysUntilDue <= 3) {
        // Due in 2-3 days
        notification = {
          id: `due_soon_${wallet.id}_${statement.id}`,
          walletId: wallet.id!,
          walletName: wallet.name,
          statementId: statement.id!,
          type: 'due_soon',
          title: '⏰ Credit Card Payment Due Soon',
          message: `${wallet.name} payment due in ${daysUntilDue} days. Balance: ${formatCurrency(remainingBalance, statement.currency)}`,
          dueDate: statement.dueDate,
          amount: remainingBalance,
          currency: wallet.currency,
          daysUntilDue,
          priority: 'medium',
          createdAt: new Date()
        }
      } else {
        // Due in 4-7 days
        notification = {
          id: `due_reminder_${wallet.id}_${statement.id}`,
          walletId: wallet.id!,
          walletName: wallet.name,
          statementId: statement.id!,
          type: 'due_soon',
          title: '📅 Credit Card Payment Reminder',
          message: `${wallet.name} payment due in ${daysUntilDue} days. Balance: ${formatCurrency(remainingBalance, statement.currency)}`,
          dueDate: statement.dueDate,
          amount: remainingBalance,
          currency: wallet.currency,
          daysUntilDue,
          priority: 'low',
          createdAt: new Date()
        }
      }

      notifications.push(notification)
    }

    return notifications.sort((a, b) => {
      // Sort by priority, then by due date
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      
      if (priorityDiff !== 0) return priorityDiff
      
      return a.dueDate.getTime() - b.dueDate.getTime()
    })

  } catch (error) {
    console.error('Error generating due notifications:', error)
    return []
  }
}

/**
 * Generate notifications for closing dates (when statements close)
 */
export async function generateClosingNotifications(
  userId: string,
  daysAhead: number = 3
): Promise<CreditCardNotification[]> {
  const notifications: CreditCardNotification[] = []
  const now = new Date()
  const futureDate = new Date(now)
  futureDate.setDate(futureDate.getDate() + daysAhead)

  try {
    // Get all active credit cards for user
    const creditCards = await db.personalWallets
      .where('userId')
      .equals(userId)
      .and(w => w.type === 'credit_card' && w.isActive)
      .toArray()

    for (const wallet of creditCards) {
      try {
        const statement = await getCurrentStatement(wallet.id!)
        
        const daysUntilClosing = Math.ceil(
          (statement.periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Only notify if closing is within the specified days
        if (daysUntilClosing > 0 && daysUntilClosing <= daysAhead) {
          const notification: CreditCardNotification = {
            id: `closing_${wallet.id}_${statement.id}`,
            walletId: wallet.id!,
            walletName: wallet.name,
            statementId: statement.id!,
            type: 'closing_soon',
            title: '📊 Credit Card Statement Closing',
            message: `${wallet.name} statement closes in ${daysUntilClosing} day${daysUntilClosing === 1 ? '' : 's'}. Current balance: ${formatCurrency(Math.abs(wallet.balance), wallet.currency)}`,
            dueDate: statement.periodEnd,
            amount: Math.abs(wallet.balance),
            currency: wallet.currency,
            daysUntilDue: daysUntilClosing,
            priority: daysUntilClosing === 1 ? 'medium' : 'low',
            createdAt: new Date()
          }

          notifications.push(notification)
        }
      } catch (error) {
        console.error(`Error checking closing date for wallet ${wallet.id}:`, error)
      }
    }

    return notifications

  } catch (error) {
    console.error('Error generating closing notifications:', error)
    return []
  }
}

/**
 * Generate notifications for high credit usage
 */
export async function generateCreditUsageNotifications(
  userId: string,
  warningThreshold: number = 70,
  criticalThreshold: number = 90
): Promise<CreditCardNotification[]> {
  const notifications: CreditCardNotification[] = []

  try {
    // Get all active credit cards for user
    const creditCards = await db.personalWallets
      .where('userId')
      .equals(userId)
      .and(w => w.type === 'credit_card' && w.isActive && Boolean(w.creditLimit))
      .toArray()

    for (const wallet of creditCards) {
      if (!wallet.creditLimit) continue

      const usedCredit = Math.abs(wallet.balance)
      const usagePercentage = (usedCredit / wallet.creditLimit) * 100

      let notification: CreditCardNotification | null = null

      if (usagePercentage >= criticalThreshold) {
        notification = {
          id: `credit_critical_${wallet.id}`,
          walletId: wallet.id!,
          walletName: wallet.name,
          statementId: '', // Not tied to specific statement
          type: 'minimum_payment_alert',
          title: '🚨 Credit Limit Critical',
          message: `${wallet.name} is at ${usagePercentage.toFixed(1)}% of credit limit (${formatCurrency(usedCredit, wallet.currency)} / ${formatCurrency(wallet.creditLimit, wallet.currency)})`,
          dueDate: new Date(), // Immediate attention needed
          amount: usedCredit,
          currency: wallet.currency,
          daysUntilDue: 0,
          priority: 'critical',
          createdAt: new Date()
        }
      } else if (usagePercentage >= warningThreshold) {
        notification = {
          id: `credit_warning_${wallet.id}`,
          walletId: wallet.id!,
          walletName: wallet.name,
          statementId: '',
          type: 'minimum_payment_alert',
          title: '⚠️ High Credit Usage',
          message: `${wallet.name} is at ${usagePercentage.toFixed(1)}% of credit limit. Consider paying down the balance.`,
          dueDate: new Date(),
          amount: usedCredit,
          currency: wallet.currency,
          daysUntilDue: 0,
          priority: 'medium',
          createdAt: new Date()
        }
      }

      if (notification) {
        notifications.push(notification)
      }
    }

    return notifications

  } catch (error) {
    console.error('Error generating credit usage notifications:', error)
    return []
  }
}

/**
 * Get all notifications for a user
 */
export async function getAllCreditCardNotifications(
  userId: string,
  options: {
    includeDue?: boolean
    includeClosing?: boolean
    includeUsage?: boolean
    daysAhead?: number
    usageThreshold?: number
  } = {}
): Promise<CreditCardNotification[]> {
  const {
    includeDue = true,
    includeClosing = true,
    includeUsage = true,
    daysAhead = 7,
    usageThreshold = 70
  } = options

  const allNotifications: CreditCardNotification[] = []

  try {
    if (includeDue) {
      const dueNotifications = await generateDueNotifications(userId, daysAhead)
      allNotifications.push(...dueNotifications)
    }

    if (includeClosing) {
      const closingNotifications = await generateClosingNotifications(userId, 3)
      allNotifications.push(...closingNotifications)
    }

    if (includeUsage) {
      const usageNotifications = await generateCreditUsageNotifications(userId, usageThreshold, 90)
      allNotifications.push(...usageNotifications)
    }

    // Remove duplicates based on ID and sort by priority
    const uniqueNotifications = Array.from(
      new Map(allNotifications.map(n => [n.id, n])).values()
    )

    return uniqueNotifications.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      
      if (priorityDiff !== 0) return priorityDiff
      
      return a.dueDate.getTime() - b.dueDate.getTime()
    })

  } catch (error) {
    console.error('Error getting all credit card notifications:', error)
    return []
  }
}

/**
 * Get notification summary counts
 */
export async function getNotificationSummary(userId: string): Promise<{
  total: number
  critical: number
  high: number
  medium: number
  low: number
  overdue: number
  dueSoon: number
  closingSoon: number
  usageAlerts: number
}> {
  try {
    const notifications = await getAllCreditCardNotifications(userId)

    const summary = {
      total: notifications.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      overdue: 0,
      dueSoon: 0,
      closingSoon: 0,
      usageAlerts: 0
    }

    notifications.forEach(n => {
      // Count by priority
      summary[n.priority]++

      // Count by type
      switch (n.type) {
        case 'overdue':
          summary.overdue++
          break
        case 'due_soon':
          summary.dueSoon++
          break
        case 'closing_soon':
          summary.closingSoon++
          break
        case 'minimum_payment_alert':
          summary.usageAlerts++
          break
      }
    })

    return summary

  } catch (error) {
    console.error('Error getting notification summary:', error)
    return {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      overdue: 0,
      dueSoon: 0,
      closingSoon: 0,
      usageAlerts: 0
    }
  }
}

/**
 * Format notification for display
 */
export function formatNotificationForDisplay(
  notification: CreditCardNotification
): {
  icon: string
  color: string
  urgencyText: string
  actionSuggestion: string
} {
  const baseInfo = {
    icon: '💳',
    color: 'blue',
    urgencyText: '',
    actionSuggestion: ''
  }

  switch (notification.type) {
    case 'overdue':
      return {
        icon: '🚨',
        color: 'red',
        urgencyText: 'OVERDUE',
        actionSuggestion: 'Pay immediately to avoid late fees'
      }

    case 'due_soon':
      if (notification.priority === 'high') {
        return {
          icon: '⚡',
          color: 'orange',
          urgencyText: notification.daysUntilDue === 0 ? 'DUE TODAY' : 'DUE TOMORROW',
          actionSuggestion: 'Make payment now'
        }
      } else {
        return {
          icon: '⏰',
          color: 'yellow',
          urgencyText: `${notification.daysUntilDue} days left`,
          actionSuggestion: 'Schedule payment soon'
        }
      }

    case 'closing_soon':
      return {
        icon: '📊',
        color: 'blue',
        urgencyText: 'Closing soon',
        actionSuggestion: 'Review pending charges'
      }

    case 'minimum_payment_alert':
      return {
        icon: '⚠️',
        color: notification.priority === 'critical' ? 'red' : 'orange',
        urgencyText: notification.priority === 'critical' ? 'NEAR LIMIT' : 'HIGH USAGE',
        actionSuggestion: 'Consider paying down balance'
      }

    default:
      return baseInfo
  }
}