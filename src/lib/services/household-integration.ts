/**
 * Household Integration Service
 * Handles sharing personal income with household common pool
 */

import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export interface HouseholdContribution {
  id: string
  personalTransactionId: string
  householdId: string
  userId: string
  amount: number
  currency: string
  percentage: number
  contributedAt: Date
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

export interface SharedIncomeEntry {
  id: string
  contributionId: string
  description: string
  amount: number
  currency: string
  category: string
  addedBy: string
  householdId: string
  date: Date
  createdAt: Date
}

/**
 * Share income from personal transaction with household
 */
export async function shareIncomeWithHousehold(
  transactionId: string,
  contributionAmount: number,
  sharePercentage: number,
  householdId?: string
): Promise<{ contribution: HouseholdContribution; sharedEntry?: SharedIncomeEntry }> {
  // Get the personal transaction
  const transaction = await db.personalTransactions.get(transactionId)
  if (!transaction) {
    throw new Error('Transaction not found')
  }

  if (transaction.type !== 'income') {
    throw new Error('Only income transactions can be shared with household')
  }

  if (contributionAmount > transaction.amount) {
    throw new Error('Contribution amount cannot exceed transaction amount')
  }

  // TODO: Get current user and household from auth context
  const userId = 'current-user-id' // Replace with actual auth
  const currentHouseholdId = householdId || 'current-household-id' // Replace with actual auth

  const now = new Date()
  const contributionId = uuidv4()

  // Create contribution record
  const contribution: HouseholdContribution = {
    id: contributionId,
    personalTransactionId: transactionId,
    householdId: currentHouseholdId,
    userId,
    amount: contributionAmount,
    currency: transaction.currency,
    percentage: sharePercentage,
    contributedAt: now,
    status: 'confirmed',
    createdAt: now,
    updatedAt: now
  }

  // Store contribution in IndexedDB (local storage)
  // TODO: Implement householdContributions table in future version
  // await (db as any).householdContributions?.add?.(contribution)

  // Update the personal transaction to mark it as shared
  await db.personalTransactions.update(transactionId, {
    sharedWithHousehold: true,
    householdContribution: contributionAmount,
    updatedAt: now
  })

  // Create entry in household finance system
  let sharedEntry: SharedIncomeEntry | undefined

  try {
    // This would integrate with the existing household finance API
    const response = await fetch('/api/finance/shared-income', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contributionId,
        description: `Personal income: ${transaction.description}`,
        amount: contributionAmount,
        currency: transaction.currency,
        category: 'shared-income',
        date: transaction.date.toISOString()
      })
    })

    if (response.ok) {
      const result = await response.json()
      sharedEntry = result.entry
    } else {
      console.error('Failed to add to household finance system:', await response.text())
      // Don't throw error - the contribution is still recorded locally
    }
  } catch (error) {
    console.error('Error integrating with household finance system:', error)
    // Don't throw error - the contribution is still recorded locally
  }

  return { contribution, sharedEntry }
}

/**
 * Get household contributions for a user
 */
export async function getHouseholdContributions(userId?: string): Promise<HouseholdContribution[]> {
  // TODO: Filter by actual user ID from auth context
  const currentUserId = userId || 'current-user-id'

  try {
    // For now, return empty array since we don't have the table set up yet
    // In future: return await db.householdContributions.where('userId').equals(currentUserId).toArray()
    return []
  } catch (error) {
    console.error('Error getting household contributions:', error)
    return []
  }
}

/**
 * Cancel a household contribution
 */
export async function cancelHouseholdContribution(contributionId: string): Promise<void> {
  try {
    // TODO: Implement cancellation logic
    // 1. Update contribution status to 'cancelled'
    // 2. Remove from household finance system
    // 3. Update personal transaction to remove shared status
    console.log('Cancelling contribution:', contributionId)
    
    // For now, just log - implement when we have the full system
  } catch (error) {
    console.error('Error cancelling household contribution:', error)
    throw new Error('Failed to cancel contribution')
  }
}

/**
 * Get summary of user's household contributions
 */
export async function getHouseholdContributionSummary(userId?: string) {
  const contributions = await getHouseholdContributions(userId)
  
  const summary = {
    totalContributions: contributions.length,
    totalAmountARS: 0,
    totalAmountUSD: 0,
    thisMonth: {
      count: 0,
      amountARS: 0,
      amountUSD: 0
    }
  }

  const currentMonth = new Date()
  currentMonth.setDate(1)
  currentMonth.setHours(0, 0, 0, 0)

  contributions.forEach(contribution => {
    if (contribution.status === 'confirmed') {
      if (contribution.currency === 'ARS') {
        summary.totalAmountARS += contribution.amount
      } else if (contribution.currency === 'USD') {
        summary.totalAmountUSD += contribution.amount
      }

      // Check if this month
      if (contribution.contributedAt >= currentMonth) {
        summary.thisMonth.count += 1
        if (contribution.currency === 'ARS') {
          summary.thisMonth.amountARS += contribution.amount
        } else if (contribution.currency === 'USD') {
          summary.thisMonth.amountUSD += contribution.amount
        }
      }
    }
  })

  return summary
}

/**
 * Check if a transaction has been shared with household
 */
export async function isTransactionSharedWithHousehold(transactionId: string): Promise<boolean> {
  const transaction = await db.personalTransactions.get(transactionId)
  return transaction?.sharedWithHousehold || false
}

/**
 * Get household sharing settings for a user
 */
export async function getHouseholdSharingSettings(userId?: string) {
  // TODO: Implement user settings for household sharing
  // For now, return default settings
  return {
    autoShareIncome: false,
    defaultSharePercentage: 50,
    shareThreshold: 0, // Minimum amount to suggest sharing
    categories: {
      salary: { autoShare: false, percentage: 50 },
      freelance: { autoShare: false, percentage: 30 },
      bonus: { autoShare: true, percentage: 70 },
      other: { autoShare: false, percentage: 50 }
    }
  }
}

type HouseholdSharingSettings = {
  autoShareIncome?: boolean
  defaultSharePercentage?: number
  shareThreshold?: number
  categories?: Record<string, {
    autoShare: boolean
    percentage: number
  }>
}

/**
 * Update household sharing settings
 */
export async function updateHouseholdSharingSettings(
  settings: HouseholdSharingSettings,
  userId?: string
): Promise<void> {
  // TODO: Implement settings storage
  console.log('Updating household sharing settings:', settings)
}