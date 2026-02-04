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

    const bills = await db
      .prepare(`
        SELECT 
          b.*,
          u.name as createdByName,
          COALESCE(SUM(p.amount), 0) as paidAmount
        FROM bills b
        LEFT JOIN users u ON b.createdBy = u.id
        LEFT JOIN payments p ON b.id = p.billId
        WHERE b.householdId = ?
        GROUP BY b.id
        ORDER BY b.dueDate ASC
      `)
      .bind(session.householdId)
      .all()

    return NextResponse.json({
      success: true,
      bills: bills.results || []
    })
  } catch (error) {
    logger.error('Get bills error:', error)
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
    const { name, description, amount, currency, category, dueDate, isRecurring, recurringPeriod } = body

    if (!name || !amount || !category || !dueDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const billId = uuidv4()
    
    await db
      .prepare(`
        INSERT INTO bills (
          id, householdId, name, description, amount, currency, category, 
          dueDate, isRecurring, recurringPeriod, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        billId,
        session.householdId,
        name,
        description || null,
        amount,
        currency || 'ARS',
        category,
        dueDate,
        isRecurring ? 1 : 0,
        recurringPeriod || 'monthly',
        session.userId
      )
      .run()

    const newBill = await db
      .prepare('SELECT * FROM bills WHERE id = ?')
      .bind(billId)
      .first()

    return NextResponse.json({
      success: true,
      bill: newBill
    })
  } catch (error) {
    logger.error('Create bill error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}