import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const billId = params.id
    const body = await request.json()
    const { name, description, amount, currency, category, dueDate, isRecurring, recurringPeriod, status } = body

    // Verify bill exists and belongs to household
    const existingBill = await db
      .prepare('SELECT * FROM bills WHERE id = ? AND householdId = ?')
      .bind(billId, session.householdId)
      .first()

    if (!existingBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    await db
      .prepare(`
        UPDATE bills SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          amount = COALESCE(?, amount),
          currency = COALESCE(?, currency),
          category = COALESCE(?, category),
          dueDate = COALESCE(?, dueDate),
          isRecurring = COALESCE(?, isRecurring),
          recurringPeriod = COALESCE(?, recurringPeriod),
          status = COALESCE(?, status),
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        name || null,
        description !== undefined ? description : null,
        amount || null,
        currency || null,
        category || null,
        dueDate || null,
        isRecurring !== undefined ? (isRecurring ? 1 : 0) : null,
        recurringPeriod || null,
        status || null,
        billId
      )
      .run()

    const updatedBill = await db
      .prepare('SELECT * FROM bills WHERE id = ?')
      .bind(billId)
      .first()

    return NextResponse.json({
      success: true,
      bill: updatedBill
    })
  } catch (error) {
    logger.error('Update bill error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const billId = params.id

    // Verify bill exists and belongs to household
    const existingBill = await db
      .prepare('SELECT * FROM bills WHERE id = ? AND householdId = ?')
      .bind(billId, session.householdId)
      .first()

    if (!existingBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Delete associated payments first
    await db
      .prepare('DELETE FROM payments WHERE billId = ?')
      .bind(billId)
      .run()

    // Delete the bill
    await db
      .prepare('DELETE FROM bills WHERE id = ?')
      .bind(billId)
      .run()

    return NextResponse.json({
      success: true,
      message: 'Bill deleted successfully'
    })
  } catch (error) {
    logger.error('Delete bill error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}