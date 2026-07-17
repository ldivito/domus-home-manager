import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { categoryId } = await params
    const body = await request.json()

    // Verify ownership and get existing data
    const existing = await db
      .prepare(`
        SELECT sm.data
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalCategories'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(categoryId, session.userId)
      .first<{ data: string }>()

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const existingData = JSON.parse(existing.data)
    const now = new Date().toISOString()

    // Cannot change type after creation
    if (body.type && body.type !== existingData.type) {
      return NextResponse.json(
        { error: 'Cannot change category type after creation' },
        { status: 400 }
      )
    }

    // Merge allowed updates (name, color, icon only)
    const updatedData = {
      ...existingData,
      name: body.name?.trim() ?? existingData.name,
      color: body.color ?? existingData.color,
      icon: body.icon ?? existingData.icon,
      updatedAt: now
    }

    await db
      .prepare(`
        UPDATE sync_metadata
        SET data = ?, operation = 'update', updatedAt = ?
        WHERE tableName = 'personalCategories' AND recordId = ? AND userId = ?
      `)
      .bind(
        JSON.stringify(updatedData),
        now,
        categoryId,
        session.userId
      )
      .run()

    return NextResponse.json({
      success: true,
      category: { id: categoryId, ...updatedData }
    })
  } catch (error) {
    logger.error('Update personal category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { categoryId } = await params

    // Verify ownership and get existing data
    const existing = await db
      .prepare(`
        SELECT sm.data
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalCategories'
        AND sm.recordId = ?
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
      `)
      .bind(categoryId, session.userId)
      .first<{ data: string }>()

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for active transactions using this category
    const activeTransactions = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM sync_metadata sm
        WHERE sm.tableName = 'personalTransactions'
        AND sm.userId = ?
        AND sm.deletedAt IS NULL
        AND json_extract(sm.data, '$.categoryId') = ?
        AND json_extract(sm.data, '$.status') != 'cancelled'
      `)
      .bind(session.userId, categoryId)
      .first<{ count: number }>()

    const hasActiveTransactions = (activeTransactions?.count ?? 0) > 0

    const existingData = JSON.parse(existing.data)
    const now = new Date().toISOString()

    // Soft-delete: set isActive=false in JSON data and set deletedAt on the row
    const updatedData = {
      ...existingData,
      isActive: false,
      updatedAt: now
    }

    await db
      .prepare(`
        UPDATE sync_metadata
        SET data = ?, operation = 'update', updatedAt = ?, deletedAt = ?
        WHERE tableName = 'personalCategories' AND recordId = ? AND userId = ?
      `)
      .bind(
        JSON.stringify(updatedData),
        now,
        now,
        categoryId,
        session.userId
      )
      .run()

    return NextResponse.json({
      success: true,
      ...(hasActiveTransactions && { hasActiveTransactions: true })
    })
  } catch (error) {
    logger.error('Delete personal category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
