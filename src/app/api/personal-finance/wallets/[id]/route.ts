import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

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

    const wallet = await db
      .prepare(`
        SELECT
          sm.recordId as id,
          sm.data,
          sm.updatedAt,
          sm.createdAt
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalWallets'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ id: string; data: string; updatedAt: string; createdAt: string }>()

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    const data = typeof wallet.data === 'string' ? JSON.parse(wallet.data) : wallet.data

    return NextResponse.json({ success: true, data: { ...data, id: wallet.id } })
  } catch (error) {
    logger.error('Get personal wallet error:', error)
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

    // Verify ownership
    const existing = await db
      .prepare(`
        SELECT recordId, data FROM sync_metadata
        WHERE tableName = 'personalWallets'
        AND recordId = ?
        AND userId = ?
        AND deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ recordId: string; data: string }>()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
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
        WHERE tableName = 'personalWallets'
        AND recordId = ?
        AND userId = ?
      `)
      .bind(JSON.stringify(updatedData), now, id, session.userId)
      .run()

    return NextResponse.json({ success: true, data: updatedData })
  } catch (error) {
    logger.error('Update personal wallet error:', error)
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
        WHERE tableName = 'personalWallets'
        AND recordId = ?
        AND userId = ?
        AND deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ recordId: string }>()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    await db
      .prepare(`
        UPDATE sync_metadata
        SET deletedAt = ?, operation = 'delete', updatedAt = ?
        WHERE tableName = 'personalWallets'
        AND recordId = ?
        AND userId = ?
      `)
      .bind(now, now, id, session.userId)
      .run()

    // Also soft-delete related transactions
    await db
      .prepare(`
        UPDATE sync_metadata
        SET deletedAt = ?, operation = 'delete', updatedAt = ?
        WHERE tableName = 'personalTransactions'
        AND userId = ?
        AND json_extract(data, '$.walletId') = ?
        AND deletedAt IS NULL
      `)
      .bind(now, now, session.userId, id)
      .run()

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    logger.error('Delete personal wallet error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
