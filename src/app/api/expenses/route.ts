import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

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

    const expenses = await db
      .prepare(`
        SELECT 
          e.*,
          u1.name as paidByName,
          u2.name as createdByName
        FROM expenses e
        LEFT JOIN users u1 ON e.paidBy = u1.id
        LEFT JOIN users u2 ON e.createdBy = u2.id
        WHERE e.householdId = ?
        ORDER BY e.date DESC
      `)
      .bind(session.householdId)
      .all()

    return NextResponse.json({
      success: true,
      expenses: expenses.results || []
    })
  } catch (error) {
    logger.error('Get expenses error:', error)
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
    const { 
      description, 
      amount, 
      currency, 
      category, 
      paidBy, 
      splitBetween, 
      splitType, 
      splitData, 
      date, 
      notes 
    } = body

    if (!description || !amount || !category || !paidBy || !splitBetween || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const expenseId = uuidv4()
    
    await db
      .prepare(`
        INSERT INTO expenses (
          id, householdId, description, amount, currency, category, 
          paidBy, splitBetween, splitType, splitData, date, notes, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        expenseId,
        session.householdId,
        description,
        amount,
        currency || 'ARS',
        category,
        paidBy,
        JSON.stringify(splitBetween),
        splitType || 'equal',
        splitData ? JSON.stringify(splitData) : null,
        date,
        notes || null,
        session.userId
      )
      .run()

    const newExpense = await db
      .prepare(`
        SELECT 
          e.*,
          u1.name as paidByName,
          u2.name as createdByName
        FROM expenses e
        LEFT JOIN users u1 ON e.paidBy = u1.id
        LEFT JOIN users u2 ON e.createdBy = u2.id
        WHERE e.id = ?
      `)
      .bind(expenseId)
      .first()

    return NextResponse.json({
      success: true,
      expense: newExpense
    })
  } catch (error) {
    logger.error('Create expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}