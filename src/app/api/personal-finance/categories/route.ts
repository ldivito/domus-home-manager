import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

interface PersonalCategoryRecord {
  id: string
  userId: string
  name: string
  type: 'income' | 'expense'
  color: string
  icon: string
  isActive: boolean
  isDefault: boolean
  updatedAt: string
  createdAt: string
}

export async function GET(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'income' | 'expense'

    const conditions: string[] = [
      "sm.tableName = 'personalCategories'",
      "sm.updatedAt = (SELECT MAX(sm2.updatedAt) FROM sync_metadata sm2 WHERE sm2.recordId = sm.recordId AND sm2.tableName = 'personalCategories')",
      'sm.userId = ?',
      'sm.deletedAt IS NULL'
    ]
    const bindings: string[] = [session.userId]

    if (type === 'income' || type === 'expense') {
      conditions.push("json_extract(sm.data, '$.type') = ?")
      bindings.push(type)
    }

    const query = `
      SELECT
        sm.recordId as id,
        json_extract(sm.data, '$.userId') as userId,
        json_extract(sm.data, '$.name') as name,
        json_extract(sm.data, '$.type') as type,
        json_extract(sm.data, '$.color') as color,
        json_extract(sm.data, '$.icon') as icon,
        json_extract(sm.data, '$.isActive') as isActive,
        json_extract(sm.data, '$.isDefault') as isDefault,
        sm.updatedAt,
        sm.createdAt
      FROM sync_metadata sm
      WHERE ${conditions.join(' AND ')}
      ORDER BY json_extract(sm.data, '$.isDefault') DESC, json_extract(sm.data, '$.name') ASC
    `

    const categories = await db
      .prepare(query)
      .bind(...bindings)
      .all()

    return NextResponse.json({
      success: true,
      data: (categories.results as PersonalCategoryRecord[]) || []
    })
  } catch (error) {
    logger.error('Get personal categories error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    const session = await getUserFromRequest(request, env)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      name?: string
      type?: string
      color?: string
      icon?: string
    }

    const { name, type, color, icon } = body

    if (!name || !type) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name, type' }, { status: 400 })
    }

    const validTypes = ['income', 'expense']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid type. Must be: income or expense' }, { status: 400 })
    }

    const categoryId = uuidv4()
    const now = new Date().toISOString()

    const categoryData = {
      id: categoryId,
      userId: session.userId,
      name,
      type,
      color: color ?? '#6b7280',
      icon: icon ?? 'Tag',
      isActive: true,
      isDefault: false,
      householdId: session.householdId ?? null,
      createdAt: now,
      updatedAt: now
    }

    await db
      .prepare(`
        INSERT INTO sync_metadata (
          id, userId, householdId, tableName, recordId, operation, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        uuidv4(),
        session.userId,
        session.householdId ?? null,
        'personalCategories',
        categoryId,
        'insert',
        JSON.stringify(categoryData),
        now,
        now
      )
      .run()

    return NextResponse.json({ success: true, data: categoryData }, { status: 201 })
  } catch (error) {
    logger.error('Create personal category error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
