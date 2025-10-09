import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { type CloudflareEnv } from '@/lib/cloudflare'

export async function GET(request: Request) {
  try {
    // Get Cloudflare bindings (or use in-memory fallback)
    const env = (request as unknown as { env?: CloudflareEnv }).env
    const session = await getUserFromRequest(request, env)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: {
        userId: session.userId,
        email: session.email,
        householdId: session.householdId
      }
    })
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
