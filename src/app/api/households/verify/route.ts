import { NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/cloudflare'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { inviteCode } = body

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    // Get Cloudflare bindings (or use in-memory fallback)
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const db = getDB(env)

    // Find household by invite code
    const household = await db
      .prepare('SELECT id, name, description FROM households WHERE inviteCode = ?')
      .bind(inviteCode.toUpperCase())
      .first<{ id: string; name: string; description: string | null }>()

    if (!household) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      )
    }

    // Get member count
    const memberCountResult = await db
      .prepare('SELECT COUNT(*) as count FROM household_members WHERE householdId = ?')
      .bind(household.id)
      .first<{ count: number }>()

    return NextResponse.json({
      success: true,
      household: {
        id: household.id,
        name: household.name,
        description: household.description,
        memberCount: memberCountResult?.count || 0
      }
    })
  } catch (error) {
    console.error('Verify invite code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
