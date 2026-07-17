import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const tx = await db
      .prepare(`
        SELECT
          sm.recordId as id,
          sm.data,
          sm.updatedAt,
          sm.createdAt
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalTransactions'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ id: string; data: string; updatedAt: string; createdAt: string }>()

    if (!tx) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    const data = typeof tx.data === 'string' ? JSON.parse(tx.data) : tx.data

    return NextResponse.json({ success: true, data: { ...data, id: tx.id } })
  } catch (error) {
    logger.error('Get personal transaction error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await db
      .prepare(`
        SELECT recordId, data FROM sync_metadata
        WHERE tableName = 'personalTransactions'
        AND recordId = ?
        AND userId = ?
        AND deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ recordId: string; data: string }>()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    const currentData = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data
    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()

    const updatedData = {
      ...currentData,
      ...body,
      id,
      userId: session.userId,
      updatedAt: now
    }

    await db
      .prepare(`
        UPDATE sync_metadata
        SET data = ?, operation = 'update', updatedAt = ?
        WHERE tableName = 'personalTransactions'
        AND recordId = ?
        AND userId = ?
      `)
      .bind(JSON.stringify(updatedData), now, id, session.userId)
      .run()

    return NextResponse.json({ success: true, data: updatedData })
  } catch (error) {
    logger.error('Update personal transaction error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await db
      .prepare(`
        SELECT recordId FROM sync_metadata
        WHERE tableName = 'personalTransactions'
        AND recordId = ?
        AND userId = ?
        AND deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ recordId: string }>()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    await db
      .prepare(`
        UPDATE sync_metadata
        SET deletedAt = ?, operation = 'delete', updatedAt = ?
        WHERE tableName = 'personalTransactions'
        AND recordId = ?
        AND userId = ?
      `)
      .bind(now, now, id, session.userId)
      .run()

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    logger.error('Delete personal transaction error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
