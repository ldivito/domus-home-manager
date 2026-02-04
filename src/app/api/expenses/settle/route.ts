import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

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
    const { fromUser, toUser, amount, currency, notes } = body

    if (!fromUser || !toUser || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (fromUser === toUser) {
      return NextResponse.json({ error: 'Cannot settle debt with yourself' }, { status: 400 })
    }

    // Verify both users are members of the household
    const members = await db
      .prepare(`
        SELECT userId FROM household_members 
        WHERE householdId = ? AND userId IN (?, ?)
      `)
      .bind(session.householdId, fromUser, toUser)
      .all()

    if (!members.results || members.results.length !== 2) {
      return NextResponse.json({ error: 'Invalid users' }, { status: 400 })
    }

    const settlementId = uuidv4()
    
    await db
      .prepare(`
        INSERT INTO debt_settlements (
          id, householdId, fromUser, toUser, amount, currency, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        settlementId,
        session.householdId,
        fromUser,
        toUser,
        amount,
        currency || 'ARS',
        notes || null
      )
      .run()

    const newSettlement = await db
      .prepare(`
        SELECT 
          ds.*,
          u1.name as fromUserName,
          u2.name as toUserName
        FROM debt_settlements ds
        LEFT JOIN users u1 ON ds.fromUser = u1.id
        LEFT JOIN users u2 ON ds.toUser = u2.id
        WHERE ds.id = ?
      `)
      .bind(settlementId)
      .first()

    return NextResponse.json({
      success: true,
      settlement: newSettlement
    })
  } catch (error) {
    logger.error('Settle debt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}