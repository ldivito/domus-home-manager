import { NextResponse } from 'next/server'
import { clearSessionCookie, deleteSession } from '@/lib/auth'
import { type CloudflareEnv } from '@/lib/cloudflare'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    // Get Cloudflare bindings (or use in-memory fallback)
    const env = (request as unknown as { env?: CloudflareEnv }).env

    // Get session token from cookie
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const [key, ...v] = c.trim().split('=')
          return [key, v.join('=')]
        })
      )

      const token = cookies['session']
      if (token) {
        // Delete session from KV
        await deleteSession(token, env)
      }
    }

    const response = NextResponse.json({ success: true })
    response.headers.set('Set-Cookie', clearSessionCookie())
    return response
  } catch (error) {
    logger.error('Logout error:', error)
    // Still clear the cookie even if KV deletion fails
    const response = NextResponse.json({ success: true })
    response.headers.set('Set-Cookie', clearSessionCookie())
    return response
  }
}
