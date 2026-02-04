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
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')

    let query = `
      SELECT 
        sm.recordId as id,
        json_extract(sm.data, '$.fromUserId') as fromUserId,
        json_extract(sm.data, '$.toUserId') as toUserId,
        json_extract(sm.data, '$.amount') as amount,
        json_extract(sm.data, '$.month') as month,
        json_extract(sm.data, '$.year') as year,
        json_extract(sm.data, '$.paidDate') as paidDate,
        json_extract(sm.data, '$.notes') as notes,
        u1.name as fromUserName,
        u2.name as toUserName,
        sm.updatedAt,
        sm.createdAt
      FROM sync_metadata sm
      LEFT JOIN users u1 ON json_extract(sm.data, '$.fromUserId') = u1.id
      LEFT JOIN users u2 ON json_extract(sm.data, '$.toUserId') = u2.id
      WHERE sm.tableName = 'settlementPayments' 
      AND sm.householdId = ?
      AND sm.deletedAt IS NULL
    `

    const params = [session.householdId]

    if (year && month) {
      query += ` AND json_extract(sm.data, '$.year') = ? AND json_extract(sm.data, '$.month') = ?`
      params.push(year, month)
    }

    query += ` ORDER BY json_extract(sm.data, '$.paidDate') DESC`

    const settlements = await db
      .prepare(query)
      .bind(...params)
      .all()

    return NextResponse.json({
      success: true,
      settlements: settlements.results || []
    })
  } catch (error) {
    logger.error('Get settlements error:', error)
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
    const { fromUserId, toUserId, amount, notes } = body

    if (!fromUserId || !toUserId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (fromUserId === toUserId) {
      return NextResponse.json({ error: 'Cannot settle debt with yourself' }, { status: 400 })
    }

    // Verify both users are members of the household
    const members = await db
      .prepare(`
        SELECT userId FROM household_members 
        WHERE householdId = ? AND userId IN (?, ?)
      `)
      .bind(session.householdId, fromUserId, toUserId)
      .all()

    if (!members.results || members.results.length !== 2) {
      return NextResponse.json({ error: 'Invalid users' }, { status: 400 })
    }

    const settlementId = uuidv4()
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const settlementData = {
      id: settlementId,
      fromUserId,
      toUserId,
      amount,
      month: currentMonth,
      year: currentYear,
      paidDate: now.toISOString(),
      notes,
      householdId: session.householdId,
      createdAt: now.toISOString()
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
        'settlementPayments',
        settlementId,
        'insert',
        JSON.stringify(settlementData),
        now.toISOString(),
        now.toISOString()
      )
      .run()

    return NextResponse.json({
      success: true,
      settlement: settlementData
    })
  } catch (error) {
    logger.error('Create settlement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}