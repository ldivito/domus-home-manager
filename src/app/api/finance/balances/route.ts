import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

interface UserBalance {
  userId: string
  userName: string
  balance: number
  currency: string
}

interface Debt {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
  currency: string
}

interface HouseholdMember {
  userId: string
  name: string
}

interface ExpensePayment {
  paidBy: string
  amount: string
  dueDate: string
  status: string
  expenseId: string
}

interface Settlement {
  fromUser: string
  toUser: string
  amount: string
  settlementMonth: number
  settlementYear: number
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

    const url = new URL(request.url)
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(url.searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // Get household members
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
      return NextResponse.json({ success: true, balances: [], debts: [] })
    }

    // Get all expense payments for the period
    const payments = await db
      .prepare(`
        SELECT 
          json_extract(sm.data, '$.paidByUserId') as paidBy,
          json_extract(sm.data, '$.amount') as amount,
          json_extract(sm.data, '$.dueDate') as dueDate,
          json_extract(sm.data, '$.status') as status,
          json_extract(sm.data, '$.recurringExpenseId') as expenseId
        FROM sync_metadata sm
        WHERE sm.tableName = 'expensePayments' 
        AND sm.householdId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.status') = 'paid'
        AND substr(json_extract(sm.data, '$.dueDate'), 1, 7) = ?
      `)
      .bind(session.householdId, `${year}-${month.toString().padStart(2, '0')}`)
      .all()

    // Get settlements for the period
    const settlements = await db
      .prepare(`
        SELECT 
          json_extract(sm.data, '$.fromUserId') as fromUser,
          json_extract(sm.data, '$.toUserId') as toUser,
          json_extract(sm.data, '$.amount') as amount,
          json_extract(sm.data, '$.month') as settlementMonth,
          json_extract(sm.data, '$.year') as settlementYear
        FROM sync_metadata sm
        WHERE sm.tableName = 'settlementPayments' 
        AND sm.householdId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.month') = ?
        AND json_extract(sm.data, '$.year') = ?
      `)
      .bind(session.householdId, month, year)
      .all()

    // Calculate balances
    const memberMap = new Map()
    const balances: Record<string, number> = {}
    
    // Initialize balances for all members
    (members.results as HouseholdMember[])?.forEach(member => {
      memberMap.set(member.userId, member.name)
      balances[member.userId] = 0
    })

    // Add payments (money spent by each person)
    (payments.results as ExpensePayment[])?.forEach(payment => {
      const userId = payment.paidBy
      const amount = parseFloat(payment.amount)
      if (userId && !isNaN(amount)) {
        balances[userId] += amount
      }
    })

    // Calculate average expense per person
    const totalExpenses = Object.values(balances).reduce((sum, balance) => sum + balance, 0)
    const averagePerPerson = totalExpenses / (members.results as HouseholdMember[]).length

    // Calculate who owes what (negative = owes money, positive = owed money)
    Object.keys(balances).forEach(userId => {
      balances[userId] -= averagePerPerson
    })

    // Apply settlements (reduce debts)
    (settlements.results as Settlement[])?.forEach(settlement => {
      const amount = parseFloat(settlement.amount)
      if (!isNaN(amount)) {
        balances[settlement.fromUser] += amount // Person who paid reduces their debt
        balances[settlement.toUser] -= amount   // Person who received increases their debt
      }
    })

    // Create debt relationships
    const debts: Debt[] = []
    
    // Simple debt resolution: match creditors with debtors
    Object.entries(balances).forEach(([creditorId, creditorBalance]) => {
      if (creditorBalance > 0.01) { // Someone owes them money
        Object.entries(balances).forEach(([debtorId, debtorBalance]) => {
          if (debtorBalance < -0.01 && creditorId !== debtorId) { // They owe money to someone
            const debtAmount = Math.min(creditorBalance, Math.abs(debtorBalance))
            if (debtAmount > 0.01) {
              debts.push({
                fromUserId: debtorId,
                fromUserName: memberMap.get(debtorId) || 'Unknown',
                toUserId: creditorId,
                toUserName: memberMap.get(creditorId) || 'Unknown',
                amount: Math.round(debtAmount * 100) / 100,
                currency: 'ARS'
              })
            }
          }
        })
      }
    })

    // Format balances for response
    const userBalances: UserBalance[] = Object.entries(balances).map(([userId, balance]) => ({
      userId,
      userName: memberMap.get(userId) || 'Unknown',
      balance: Math.round(balance * 100) / 100,
      currency: 'ARS'
    }))

    return NextResponse.json({
      success: true,
      period: { year, month },
      balances: userBalances,
      debts,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      averagePerPerson: Math.round(averagePerPerson * 100) / 100
    })
  } catch (error) {
    logger.error('Get balances error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}