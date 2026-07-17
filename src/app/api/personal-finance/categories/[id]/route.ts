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

    const category = await db
      .prepare(`
        SELECT sm.recordId as id, sm.data, sm.updatedAt, sm.createdAt
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalCategories'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ id: string; data: string; updatedAt: string; createdAt: string }>()

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    const data = typeof category.data === 'string' ? JSON.parse(category.data) : category.data

    return NextResponse.json({ success: true, data: { ...data, id: category.id } })
  } catch (error) {
    logger.error('Get personal category error:', error)
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
        WHERE tableName = 'personalCategories'
        AND recordId = ?
        AND userId = ?
        AND deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ recordId: string; data: string }>()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    const currentData = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data
    const body = await request.json() as Record<string, unknown>
    const now = new Date().toISOString()

    // Prevent changing userId or isDefault for default categories
    const { userId: _u, ...safeBody } = body as { userId?: unknown } & Record<string, unknown>
    void _u

    const updatedData = {
      ...currentData,
      ...safeBody,
      id,
      userId: session.userId,
      updatedAt: now
    }

    await db
      .prepare(`
        UPDATE sync_metadata
        SET data = ?, operation = 'update', updatedAt = ?
        WHERE tableName = 'personalCategories'
        AND recordId = ?
        AND userId = ?
      `)
      .bind(JSON.stringify(updatedData), now, id, session.userId)
      .run()

    return NextResponse.json({ success: true, data: updatedData })
  } catch (error) {
    logger.error('Update personal category error:', error)
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
        SELECT recordId, json_extract(data, '$.isDefault') as isDefault
        FROM sync_metadata
        WHERE tableName = 'personalCategories'
        AND recordId = ?
        AND userId = ?
        AND deletedAt IS NULL
      `)
      .bind(id, session.userId)
      .first<{ recordId: string; isDefault: number }>()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    if (existing.isDefault) {
      return NextResponse.json({ success: false, error: 'Cannot delete default categories' }, { status: 400 })
    }

    const now = new Date().toISOString()

    await db
      .prepare(`
        UPDATE sync_metadata
        SET deletedAt = ?, operation = 'delete', updatedAt = ?
        WHERE tableName = 'personalCategories'
        AND recordId = ?
        AND userId = ?
      `)
      .bind(now, now, id, session.userId)
      .run()

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    logger.error('Delete personal category error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
