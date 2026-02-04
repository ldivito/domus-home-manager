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

    const url = new URL(request.url)
    const billId = url.searchParams.get('billId')

    let query = `
      SELECT 
        p.*,
        u.name as paidByName,
        b.name as billName
      FROM payments p
      LEFT JOIN users u ON p.paidBy = u.id
      LEFT JOIN bills b ON p.billId = b.id
      WHERE p.householdId = ?
    `
    
    const params = [session.householdId]
    
    if (billId) {
      query += ' AND p.billId = ?'
      params.push(billId)
    }
    
    query += ' ORDER BY p.paidAt DESC'

    const payments = await db
      .prepare(query)
      .bind(...params)
      .all()

    return NextResponse.json({
      success: true,
      payments: payments.results || []
    })
  } catch (error) {
    logger.error('Get payments error:', error)
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
    const { billId, amount, currency, paymentMethod, notes, paidBy } = body

    if (!billId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify bill exists and belongs to household
    const bill = await db
      .prepare('SELECT * FROM bills WHERE id = ? AND householdId = ?')
      .bind(billId, session.householdId)
      .first()

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    const paymentId = uuidv4()
    const paidByUserId = paidBy || session.userId

    await db
      .prepare(`
        INSERT INTO payments (
          id, billId, householdId, paidBy, amount, currency, paymentMethod, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        paymentId,
        billId,
        session.householdId,
        paidByUserId,
        amount,
        currency || 'ARS',
        paymentMethod || null,
        notes || null
      )
      .run()

    // Update bill status to paid if total payments >= bill amount
    const totalPaid = await db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE billId = ?')
      .bind(billId)
      .first()

    if (totalPaid && totalPaid.total >= bill.amount) {
      await db
        .prepare('UPDATE bills SET status = ? WHERE id = ?')
        .bind('paid', billId)
        .run()
    }

    const newPayment = await db
      .prepare(`
        SELECT 
          p.*,
          u.name as paidByName,
          b.name as billName
        FROM payments p
        LEFT JOIN users u ON p.paidBy = u.id
        LEFT JOIN bills b ON p.billId = b.id
        WHERE p.id = ?
      `)
      .bind(paymentId)
      .first()

    return NextResponse.json({
      success: true,
      payment: newPayment
    })
  } catch (error) {
    logger.error('Create payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}