import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getUserFromRequest(request)

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
