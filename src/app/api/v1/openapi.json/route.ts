import { NextResponse } from 'next/server'
import { buildOpenApiDocument } from '@/lib/api/openapi'

/** GET /api/v1/openapi.json — machine-readable API description (no auth: contains no data). */
export function GET(request: Request) {
  const origin = new URL(request.url).origin
  return NextResponse.json(buildOpenApiDocument(origin), {
    headers: { 'Cache-Control': 'public, max-age=300' }
  })
}
