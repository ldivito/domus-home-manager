import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

interface Debt {
  fromUser: string
  fromUserName: string
  toUser: string
  toUserName: string
  amount: number
  currency: string
}

export async function GET(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.householdId) {
      return NextResponse.json({ error: 'No household' }, { status: 404 })
    }

    // Get all household members
    const members = await db
      .prepare(`
        SELECT hm.userId, u.name 
        FROM household_members hm 
        JOIN users u ON hm.userId = u.id 
        WHERE hm.householdId = ?
      `)
      .bind(session.householdId)
      .all()

    if (!members.results || members.results.length === 0) {
      return NextResponse.json({ success: true, debts: [] })
    }

    // Get all expenses for the household
    const expenses = await db
      .prepare(`
        SELECT 
          paidBy,
          amount,
          currency,
          splitBetween,
          splitType,
          splitData
        FROM expenses 
        WHERE householdId = ?
      `)
      .bind(session.householdId)
      .all()

    // Get all debt settlements
    const settlements = await db
      .prepare(`
        SELECT fromUser, toUser, amount, currency
        FROM debt_settlements
        WHERE householdId = ?
      `)
      .bind(session.householdId)
      .all()

    // Calculate balances
    const balances: Record<string, number> = {}
    
    // Initialize balances
    members.results?.forEach(member => {
      balances[member.userId] = 0
    })

    // Process expenses
    expenses.results?.forEach(expense => {
      const splitBetween = JSON.parse(expense.splitBetween)
      const splitType = expense.splitType || 'equal'
      let splitData = null
      
      if (expense.splitData) {
        try {
          splitData = JSON.parse(expense.splitData)
        } catch (e) {
          // Ignore invalid JSON
        }
      }

      // The person who paid gets the full amount added to their balance
      balances[expense.paidBy] += expense.amount

      // Calculate how much each person owes
      if (splitType === 'equal') {
        const amountPerPerson = expense.amount / splitBetween.length
        splitBetween.forEach((userId: string) => {
          balances[userId] -= amountPerPerson
        })
      } else if (splitType === 'percentage' && splitData) {
        splitBetween.forEach((userId: string) => {
          const percentage = splitData[userId] || 0
          const owedAmount = (expense.amount * percentage) / 100
          balances[userId] -= owedAmount
        })
      } else if (splitType === 'amount' && splitData) {
        splitBetween.forEach((userId: string) => {
          const owedAmount = splitData[userId] || 0
          balances[userId] -= owedAmount
        })
      }
    })

    // Apply settlements
    settlements.results?.forEach(settlement => {
      balances[settlement.fromUser] += settlement.amount
      balances[settlement.toUser] -= settlement.amount
    })

    // Calculate debts between users
    const debts: Debt[] = []
    const memberMap = new Map()
    members.results?.forEach(member => {
      memberMap.set(member.userId, member.name)
    })

    // Create debt relationships
    Object.entries(balances).forEach(([creditorId, creditorBalance]) => {
      if (creditorBalance > 0.01) { // Creditor (someone owes them)
        Object.entries(balances).forEach(([debtorId, debtorBalance]) => {
          if (debtorBalance < -0.01 && creditorId !== debtorId) { // Debtor (they owe someone)
            const debtAmount = Math.min(creditorBalance, Math.abs(debtorBalance))
            if (debtAmount > 0.01) {
              debts.push({
                fromUser: debtorId,
                fromUserName: memberMap.get(debtorId) || 'Unknown',
                toUser: creditorId,
                toUserName: memberMap.get(creditorId) || 'Unknown',
                amount: Math.round(debtAmount * 100) / 100,
                currency: 'ARS' // TODO: Handle multiple currencies
              })
            }
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      debts: debts,
      balances: Object.fromEntries(
        Object.entries(balances).map(([userId, balance]) => [
          userId,
          {
            balance: Math.round(balance * 100) / 100,
            name: memberMap.get(userId) || 'Unknown'
          }
        ])
      )
    })
  } catch (error) {
    logger.error('Get debts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}