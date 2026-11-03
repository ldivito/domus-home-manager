/**
 * API key primitives (no I/O): generation, hashing, constant-time comparison.
 *
 * Format: `domus_sk_<43 base64url chars>` (32 random bytes). Only the SHA-256
 * hash is persisted; `keyPrefix` (`domus_sk_` + first 8 random chars) is a
 * non-secret identifier used for lookup and for display in the UI.
 * The plaintext key is returned exactly once, on creation.
 */

export const API_KEY_PREFIX = 'domus_sk_'
const RANDOM_BYTES = 32
const RANDOM_CHARS = 43 // base64url length of 32 bytes, without padding
const VISIBLE_RANDOM_CHARS = 8

export const API_KEY_PATTERN = new RegExp(`^${API_KEY_PREFIX}[A-Za-z0-9_-]{${RANDOM_CHARS}}$`)

export const API_SCOPES = ['read', 'write'] as const
export type ApiScope = typeof API_SCOPES[number]

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function isWellFormedApiKey(value: unknown): value is string {
  return typeof value === 'string' && API_KEY_PATTERN.test(value)
}

/** Non-secret display/lookup prefix of a key. */
export function apiKeyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX.length + VISIBLE_RANDOM_CHARS)
}

/** SHA-256 of the key as lowercase hex. */
export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return toHex(digest)
}

export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_BYTES))
  const key = `${API_KEY_PREFIX}${toBase64Url(bytes)}`
  return { key, prefix: apiKeyPrefix(key), hash: await hashApiKey(key) }
}

/**
 * Constant-time string comparison (time depends only on the length of the
 * inputs, which for SHA-256 hex digests is always 64).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/** Check a presented key against a stored hash in constant time. */
export async function verifyApiKey(key: string, storedHash: string): Promise<boolean> {
  return timingSafeEqual(await hashApiKey(key), storedHash)
}

/** Parse the comma-separated scopes column, dropping unknown values. */
export function parseScopes(value: string | null | undefined): ApiScope[] {
  if (!value) return []
  const allowed = new Set<string>(API_SCOPES)
  return Array.from(new Set(value.split(',').map(s => s.trim()).filter(s => allowed.has(s)))) as ApiScope[]
}

/** Extract the bearer token from an Authorization header. */
export function parseBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header)
  return match ? match[1] : null
}
