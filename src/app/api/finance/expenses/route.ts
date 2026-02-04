import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

interface RecurringExpense {
  id: string
  name: string
  description: string
  amount: string
  currency: string
  category: string
  frequency: string
  dueDay: number
  isActive: boolean
  updatedAt: string
  createdAt: string
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

    // Get recurring expenses from sync metadata
    const expenses = await db
      .prepare(`
        SELECT 
          sm.recordId as id,
          json_extract(sm.data, '$.name') as name,
          json_extract(sm.data, '$.description') as description,
          json_extract(sm.data, '$.amount') as amount,
          json_extract(sm.data, '$.currency') as currency,
          json_extract(sm.data, '$.category') as category,
          json_extract(sm.data, '$.frequency') as frequency,
          json_extract(sm.data, '$.dueDay') as dueDay,
          json_extract(sm.data, '$.isActive') as isActive,
          sm.updatedAt,
          sm.createdAt
        FROM sync_metadata sm
        WHERE sm.tableName = 'recurringExpenses' 
        AND sm.householdId = ?
        AND sm.deletedAt IS NULL
        ORDER BY json_extract(sm.data, '$.name')
      `)
      .bind(session.householdId)
      .all()

    return NextResponse.json({
      success: true,
      expenses: (expenses.results as RecurringExpense[]) || []
    })
  } catch (error) {
    logger.error('Get recurring expenses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    const body = await request.json()
    const { name, description, amount, currency, category, frequency, dueDay } = body

    if (!name || !amount || !category || !frequency || !dueDay) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const expenseId = uuidv4()
    const now = new Date().toISOString()

    const expenseData = {
      id: expenseId,
      name,
      description,
      amount,
      currency: currency || 'ARS',
      category,
      frequency,
      dueDay,
      isActive: true,
      householdId: session.householdId,
      createdAt: now,
      updatedAt: now
    }

    // Insert into sync metadata
    await db
      .prepare(`
        INSERT INTO sync_metadata (
          id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        uuidv4(),
        session.userId,
        session.householdId,
        'recurringExpenses',
        expenseId,
        'insert',
        JSON.stringify(expenseData),
        now,
        now
      )
      .run()

    return NextResponse.json({
      success: true,
      expense: expenseData
    })
  } catch (error) {
    logger.error('Create recurring expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}