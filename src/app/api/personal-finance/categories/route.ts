import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { generateCategoryId } from '@/lib/utils/finance/helpers'
import { validateCategory } from '@/lib/utils/finance/validators'

interface CategoryRow {
  id: string
  name: string
  type: string
  color: string
  icon: string
  isActive: number
  isDefault: number
  createdAt: string
  updatedAt: string
}

export async function GET(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const typeFilter = url.searchParams.get('type')

    let query = `
      SELECT
        sm.recordId as id,
        json_extract(sm.data, '$.name') as name,
        json_extract(sm.data, '$.type') as type,
        json_extract(sm.data, '$.color') as color,
        json_extract(sm.data, '$.icon') as icon,
        json_extract(sm.data, '$.isActive') as isActive,
        json_extract(sm.data, '$.isDefault') as isDefault,
        sm.createdAt,
        sm.updatedAt
      FROM sync_metadata sm
      WHERE sm.tableName = 'personalCategories'
      AND sm.userId = ?
      AND sm.deletedAt IS NULL
    `

    const params: unknown[] = [session.userId]

    if (typeFilter) {
      query += ` AND json_extract(sm.data, '$.type') = ?`
      params.push(typeFilter)
    }

    query += `
      ORDER BY
        json_extract(sm.data, '$.isDefault') DESC,
        json_extract(sm.data, '$.name')
    `

    const categories = await db
      .prepare(query)
      .bind(...params)
      .all()

    return NextResponse.json({
      success: true,
      categories: (categories.results as CategoryRow[]) || []
    })
  } catch (error) {
    logger.error('Get personal categories error:', error)
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

    const body = await request.json()

    // Validate input
    const validation = validateCategory(body)
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 })
    }

    const categoryId = generateCategoryId()
    const now = new Date().toISOString()

    const categoryData = {
      id: categoryId,
      userId: session.userId,
      name: body.name.trim(),
      type: body.type,
      color: body.color,
      icon: body.icon,
      isActive: true,
      isDefault: false,
      createdAt: now,
      updatedAt: now
    }

    await db
      .prepare(`
        INSERT INTO sync_metadata (
          id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, 'personalCategories', ?, 'insert', ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        session.userId,
        session.householdId || null,
        categoryId,
        JSON.stringify(categoryData),
        now,
        now
      )
      .run()

    return NextResponse.json({
      success: true,
      category: categoryData
    })
  } catch (error) {
    logger.error('Create personal category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
