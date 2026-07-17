/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Limitation: state is per server instance. In a multi-instance/serverless
 * deployment each instance keeps its own counters, so the effective limit is
 * higher; for a hard global limit move the counters to Cloudflare KV.
 */

const buckets = new Map<string, number[]>()
const MAX_TRACKED_KEYS = 5000

function sweep(cutoff: number): void {
  for (const [key, timestamps] of buckets) {
    const alive = timestamps.filter(t => t > cutoff)
    if (alive.length === 0) buckets.delete(key)
    else buckets.set(key, alive)
  }
}

/**
 * Returns true when `key` exceeded `limit` events within the last `windowMs`.
 * A blocked call does not consume an attempt.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs

  if (buckets.size > MAX_TRACKED_KEYS) sweep(cutoff)

  const recent = (buckets.get(key) ?? []).filter(t => t > cutoff)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return true
  }

  recent.push(now)
  buckets.set(key, recent)
  return false
}

/** Best-effort client IP for rate-limit keys (Cloudflare first, then proxies). */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
