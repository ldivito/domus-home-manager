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
    const memberMap = new Map<string, string>()
    const balances = {} as Record<string, number>
    
    // Initialize balances for all members
    const membersList = members.results as HouseholdMember[]
    if (membersList && Array.isArray(membersList)) {
      membersList.forEach(member => {
        memberMap.set(member.userId, member.name)
        balances[member.userId] = 0
      })
    }

    // Add payments (money spent by each person)
    // Only count payments made by current household members: paidBy can reference
    // a removed member (or an orphaned id) and undefined + amount would poison
    // every balance with NaN
    const paymentsList = payments.results as ExpensePayment[]
    if (paymentsList && Array.isArray(paymentsList)) {
      paymentsList.forEach(payment => {
        const userId = payment.paidBy
        const amount = parseFloat(payment.amount)
        if (userId && userId in balances && !isNaN(amount)) {
          balances[userId] += amount
        }
      })
    }

    // Calculate average expense per person
    const totalExpenses = Object.values(balances).reduce((sum, balance) => sum + balance, 0)
    const averagePerPerson = membersList ? totalExpenses / membersList.length : 0

    // Calculate who owes what (negative = owes money, positive = owed money)
    Object.keys(balances).forEach(userId => {
      balances[userId] -= averagePerPerson
    })

    // Apply settlements (reduce debts)
    const settlementsList = settlements.results as Settlement[]
    if (settlementsList && Array.isArray(settlementsList)) {
      settlementsList.forEach(settlement => {
        const amount = parseFloat(settlement.amount)
        if (isNaN(amount)) return
        // Guard against settlements referencing users no longer in the household
        if (settlement.fromUser in balances) {
          balances[settlement.fromUser] += amount // Person who paid reduces their debt
        }
        if (settlement.toUser in balances) {
          balances[settlement.toUser] -= amount   // Person who received increases their debt
        }
      })
    }

    // Create debt relationships
    // Greedy two-pointer resolution over mutable copies (mirrors BalanceTab):
    // each assignment decrements the remaining balances so debts are never
    // double-counted when there are multiple debtors and creditors.
    // Note: this endpoint splits expenses equally (averagePerPerson) while the
    // BalanceTab UI splits proportionally to income, so amounts can differ.
    const debts: Debt[] = []

    const debtors = Object.entries(balances)
      .filter(([, balance]) => balance < -0.01)
      .map(([userId, balance]) => ({ userId, balance }))
      .sort((a, b) => a.balance - b.balance)
    const creditors = Object.entries(balances)
      .filter(([, balance]) => balance > 0.01)
      .map(([userId, balance]) => ({ userId, balance }))
      .sort((a, b) => b.balance - a.balance)

    let debtorIdx = 0
    let creditorIdx = 0
    while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
      const debtor = debtors[debtorIdx]
      const creditor = creditors[creditorIdx]
      const debtAmount = Math.min(Math.abs(debtor.balance), creditor.balance)

      if (debtAmount > 0.01) {
        debts.push({
          fromUserId: debtor.userId,
          fromUserName: memberMap.get(debtor.userId) || 'Unknown',
          toUserId: creditor.userId,
          toUserName: memberMap.get(creditor.userId) || 'Unknown',
          amount: Math.round(debtAmount * 100) / 100,
          currency: 'ARS'
        })
      }

      debtor.balance += debtAmount
      creditor.balance -= debtAmount

      if (Math.abs(debtor.balance) < 0.01) debtorIdx++
      if (creditor.balance < 0.01) creditorIdx++
    }

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