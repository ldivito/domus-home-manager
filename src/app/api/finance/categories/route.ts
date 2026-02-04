import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

interface ExpenseCategory {
  id: string
  name: string
  icon: string
  color: string
  isDefault: number
  updatedAt?: string
  createdAt?: string
}

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

    // Get expense categories from sync metadata
    const categories = await db
      .prepare(`
        SELECT 
          sm.recordId as id,
          json_extract(sm.data, '$.name') as name,
          json_extract(sm.data, '$.icon') as icon,
          json_extract(sm.data, '$.color') as color,
          json_extract(sm.data, '$.isDefault') as isDefault,
          sm.updatedAt,
          sm.createdAt
        FROM sync_metadata sm
        WHERE sm.tableName = 'expenseCategories' 
        AND sm.householdId = ?
        AND sm.deletedAt IS NULL
        ORDER BY 
          json_extract(sm.data, '$.isDefault') DESC,
          json_extract(sm.data, '$.name')
      `)
      .bind(session.householdId)
      .all()

    // Include default categories if none exist
    let categoriesData = (categories.results as ExpenseCategory[]) || []
    
    if (categoriesData.length === 0) {
      categoriesData = [
        { id: 'utilities', name: 'Utilities', icon: 'Zap', color: '#fbbf24', isDefault: 1 },
        { id: 'rent', name: 'Rent', icon: 'Home', color: '#8b5cf6', isDefault: 1 },
        { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10b981', isDefault: 1 },
        { id: 'transport', name: 'Transport', icon: 'Car', color: '#06b6d4', isDefault: 1 },
        { id: 'entertainment', name: 'Entertainment', icon: 'Film', color: '#f59e0b', isDefault: 1 },
        { id: 'health', name: 'Health', icon: 'Heart', color: '#ef4444', isDefault: 1 },
        { id: 'other', name: 'Other', icon: 'MoreHorizontal', color: '#6b7280', isDefault: 1 }
      ]
    }

    return NextResponse.json({
      success: true,
      categories: categoriesData
    })
  } catch (error) {
    logger.error('Get expense categories error:', error)
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
    const { name, icon, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const categoryId = uuidv4()
    const now = new Date().toISOString()

    const categoryData = {
      id: categoryId,
      name,
      icon: icon || 'Tag',
      color: color || '#6b7280',
      isDefault: false,
      householdId: session.householdId,
      createdAt: now
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
        'expenseCategories',
        categoryId,
        'insert',
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
    logger.error('Create expense category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}