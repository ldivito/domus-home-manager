import {
  API_KEY_PATTERN,
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
  isWellFormedApiKey,
  parseBearerToken,
  parseScopes,
  timingSafeEqual,
  verifyApiKey
} from '../keys'

describe('API key primitives', () => {
  it('generates well-formed, unique keys with a matching prefix and hash', async () => {
    const a = await generateApiKey()
    const b = await generateApiKey()

    expect(a.key).toMatch(API_KEY_PATTERN)
    expect(a.key.startsWith('domus_sk_')).toBe(true)
    expect(a.key).not.toBe(b.key)
    expect(a.prefix).toBe(a.key.slice(0, 'domus_sk_'.length + 8))
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(a.hash).toBe(await hashApiKey(a.key))
    // The prefix alone must not reveal the key
    expect(a.prefix.length).toBeLessThan(a.key.length - 30)
  })

  it('hashes with SHA-256 (known vector)', async () => {
    expect(await hashApiKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('verifies the right key and rejects others', async () => {
    const { key, hash } = await generateApiKey()
    const other = await generateApiKey()

    expect(await verifyApiKey(key, hash)).toBe(true)
    expect(await verifyApiKey(other.key, hash)).toBe(false)
    // Same prefix, different secret part
    const tampered = key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A')
    expect(apiKeyPrefix(tampered)).toBe(apiKeyPrefix(key))
    expect(await verifyApiKey(tampered, hash)).toBe(false)
  })

  it('compares in constant time semantics (equality only)', () => {
    expect(timingSafeEqual('abcd', 'abcd')).toBe(true)
    expect(timingSafeEqual('abcd', 'abce')).toBe(false)
    expect(timingSafeEqual('abcd', 'abc')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
    expect(timingSafeEqual('a', '')).toBe(false)
  })

  it('validates the key format', () => {
    expect(isWellFormedApiKey('domus_sk_short')).toBe(false)
    expect(isWellFormedApiKey(`domus_sk_${'a'.repeat(43)}`)).toBe(true)
    expect(isWellFormedApiKey(`other_sk_${'a'.repeat(43)}`)).toBe(false)
    expect(isWellFormedApiKey(`domus_sk_${'a'.repeat(42)}!`)).toBe(false)
    expect(isWellFormedApiKey(undefined)).toBe(false)
  })

  it('parses bearer tokens and scopes', () => {
    expect(parseBearerToken('Bearer abc')).toBe('abc')
    expect(parseBearerToken('bearer   abc  ')).toBe('abc')
    expect(parseBearerToken('Basic abc')).toBeNull()
    expect(parseBearerToken(null)).toBeNull()
    expect(parseBearerToken('Bearer a b')).toBeNull()

    expect(parseScopes('read,write')).toEqual(['read', 'write'])
    expect(parseScopes('read, admin ,read')).toEqual(['read'])
    expect(parseScopes('')).toEqual([])
    expect(parseScopes(null)).toEqual([])
  })
})
