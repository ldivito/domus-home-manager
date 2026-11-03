import { NextResponse } from 'next/server'
import type { CloudflareEnv } from '@/lib/cloudflare'

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'insufficient_scope'
  | 'not_found'
  | 'invalid_request'
  | 'validation_failed'
  | 'payload_too_large'
  | 'rate_limited'
  | 'internal_error'

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  insufficient_scope: 403,
  not_found: 404,
  invalid_request: 400,
  validation_failed: 422,
  payload_too_large: 413,
  rate_limited: 429,
  internal_error: 500
}

/** Uniform JSON error body: `{ error: { code, message, details? } }`. */
export function apiError(
  code: ApiErrorCode,
  message: string,
  extra?: { details?: unknown; headers?: Record<string, string> }
): NextResponse {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', ...extra?.headers }
  if (code === 'unauthorized') headers['WWW-Authenticate'] = 'Bearer realm="domus"'
  return NextResponse.json(
    { error: { code, message, ...(extra?.details !== undefined ? { details: extra.details } : {}) } },
    { status: STATUS[code], headers }
  )
}

export function apiJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Cloudflare bindings attached to the request (undefined in local dev). */
export function getRequestEnv(request: Request): CloudflareEnv | undefined {
  return (request as unknown as { env?: CloudflareEnv }).env
}

/** Parse a JSON body; returns undefined when the body is not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}
