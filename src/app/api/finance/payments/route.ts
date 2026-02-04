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

    // Get expense payments with expense details
    const payments = await db
      .prepare(`
        SELECT 
          ep.recordId as id,
          json_extract(ep.data, '$.recurringExpenseId') as recurringExpenseId,
          json_extract(ep.data, '$.amount') as amount,
          json_extract(ep.data, '$.dueDate') as dueDate,
          json_extract(ep.data, '$.paidDate') as paidDate,
          json_extract(ep.data, '$.paidByUserId') as paidByUserId,
          json_extract(ep.data, '$.status') as status,
          json_extract(ep.data, '$.notes') as notes,
          u.name as paidByName,
          json_extract(re.data, '$.name') as expenseName,
          ep.updatedAt,
          ep.createdAt
        FROM sync_metadata ep
        LEFT JOIN users u ON json_extract(ep.data, '$.paidByUserId') = u.id
        LEFT JOIN sync_metadata re ON 
          json_extract(ep.data, '$.recurringExpenseId') = re.recordId 
          AND re.tableName = 'recurringExpenses'
        WHERE ep.tableName = 'expensePayments' 
        AND ep.householdId = ?
        AND ep.deletedAt IS NULL
        ORDER BY json_extract(ep.data, '$.dueDate') DESC
      `)
      .bind(session.householdId)
      .all()

    return NextResponse.json({
      success: true,
      payments: payments.results || []
    })
  } catch (error) {
    logger.error('Get expense payments error:', error)
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
    const { recurringExpenseId, amount, dueDate, paidDate, paidByUserId, status, notes } = body

    if (!recurringExpenseId || !amount || !dueDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const paymentId = uuidv4()
    const now = new Date().toISOString()

    const paymentData = {
      id: paymentId,
      recurringExpenseId,
      amount,
      dueDate,
      paidDate: paidDate || (status === 'paid' ? now : null),
      paidByUserId: paidByUserId || session.userId,
      status: status || 'pending',
      notes,
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
        'expensePayments',
        paymentId,
        'insert',
        JSON.stringify(paymentData),
        now,
        now
      )
      .run()

    return NextResponse.json({
      success: true,
      payment: paymentData
    })
  } catch (error) {
    logger.error('Create expense payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}