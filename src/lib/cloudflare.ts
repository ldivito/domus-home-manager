/**
 * Cloudflare bindings utilities
 *
 * Provides access to D1 database and KV namespace.
 * For local development (npm run dev), falls back to in-memory storage.
 * For production (Cloudflare Pages), uses actual D1/KV bindings.
 */

import { logger } from '@/lib/logger'

export interface CloudflareEnv {
  domus_db?: D1Database
  KV?: KVNamespace
}

// Type definitions for Cloudflare bindings
interface D1Database {
  prepare(query: string): D1PreparedStatement
  exec(query: string): Promise<D1ExecResult>
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
}

interface D1Result<T = unknown> {
  success: boolean
  results?: T[]
  error?: string
  meta?: {
    duration: number
    size_after: number
    rows_read: number
    rows_written: number
  }
}

interface D1ExecResult {
  count: number
  duration: number
}

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

// In-memory fallbacks for local development
class InMemoryD1 implements D1Database {
  private data = new Map<string, Map<string, Record<string, unknown>>>()

  prepare(query: string): D1PreparedStatement {
    return new InMemoryD1Statement(query, this.data)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exec(_query: string): Promise<D1ExecResult> {
    // Simple exec implementation for CREATE TABLE, etc.
    return { count: 0, duration: 0 }
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = []
    for (const stmt of statements) {
      const result = await stmt.run()
      results.push(result as D1Result<T>)
    }
    return results
  }
}

class InMemoryD1Statement implements D1PreparedStatement {
  private values: unknown[] = []

  constructor(
    private query: string,
    private data: Map<string, Map<string, Record<string, unknown>>>
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values
    return this
  }

  async first<T = unknown>(): Promise<T | null> {
    const result = await this.all<T>()
    return result.results?.[0] || null
  }

  async run(): Promise<D1Result> {
    // Parse query type
    const queryLower = this.query.toLowerCase().trim()
    
    if (queryLower.startsWith('insert') || queryLower.startsWith('replace')) {
      // Extract table name
      const match = this.query.match(/into\s+(\w+)/i)
      const tableName = match?.[1] || 'unknown'
      
      if (!this.data.has(tableName)) {
        this.data.set(tableName, new Map())
      }
      
      const table = this.data.get(tableName)!
      const id = this.values[0] as string
      const record: Record<string, unknown> = {}
      
      // Store all bound values as a record
      this.values.forEach((val, idx) => {
        record[`col${idx}`] = val
      })
      
      table.set(id, record)
      
      return {
        success: true,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 1
        }
      }
    }
    
    return { success: true }
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const queryLower = this.query.toLowerCase().trim()
    
    if (queryLower.startsWith('select')) {
      // Extract table name
      const match = this.query.match(/from\s+(\w+)/i)
      const tableName = match?.[1] || 'unknown'
      
      if (!this.data.has(tableName)) {
        return { success: true, results: [] }
      }
      
      const table = this.data.get(tableName)!
      const results = Array.from(table.values()) as T[]
      
      return { success: true, results }
    }
    
    return { success: true, results: [] }
  }
}

class InMemoryKV implements KVNamespace {
  private data = new Map<string, string>()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(key: string, _options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null> {
    return this.data.get(key) || null
  }

  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key)
  }
}

// Cloudflare REST API clients for localhost development
class CloudflareD1REST implements D1Database {
  constructor(
    private accountId: string,
    private databaseId: string,
    private apiToken: string
  ) {}

  prepare(query: string): D1PreparedStatement {
    return new CloudflareD1RESTStatement(query, this.accountId, this.databaseId, this.apiToken)
  }

  async exec(query: string): Promise<D1ExecResult> {
    await this.prepare(query).run()
    return { count: 0, duration: 0 }
  }

  /**
   * Execute multiple statements in a single batch using D1's native batch API.
   * This is much faster than sequential execution as it sends all statements
   * in a single HTTP request.
   */
  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    if (statements.length === 0) {
      return []
    }

    // Convert statements to SQL objects with params
    const sqlStatements = statements.map(stmt => {
      const restStmt = stmt as CloudflareD1RESTStatement
      return {
        sql: restStmt.getQuery(),
        params: restStmt.getParams()
      }
    })

    // D1 batch API accepts up to ~100 statements per request
    // Process in sub-batches of 50 to stay well within limits
    const BATCH_SIZE = 50
    const results: D1Result<T>[] = []

    for (let i = 0; i < sqlStatements.length; i += BATCH_SIZE) {
      const batch = sqlStatements.slice(i, i + BATCH_SIZE)
      const batchResults = await this.executeBatch<T>(batch)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Execute a batch of SQL statements using D1's REST API
   */
  private async executeBatch<T>(
    statements: Array<{ sql: string; params: unknown[] }>
  ): Promise<D1Result<T>[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // D1 batch timeout

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(statements),
          signal: controller.signal
        }
      )

      clearTimeout(timeout)

      const data = await response.json() as {
        success: boolean
        result?: Array<{ results: T[], success: boolean, meta: D1Result['meta'] }>
        errors?: Array<{ message: string }>
      }

      if (!data.success || !data.result) {
        const errorMsg = data.errors?.[0]?.message || 'Batch execution failed'
        logger.error('[Cloudflare D1] Batch failed:', errorMsg)
        return statements.map(() => ({
          success: false,
          error: errorMsg
        }))
      }

      return data.result.map(r => ({
        success: r.success,
        results: r.results,
        meta: r.meta
      }))
    } catch (error) {
      clearTimeout(timeout)
      const errorMsg = error instanceof Error ? error.message : 'Unknown batch error'
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[Cloudflare D1] Batch timeout after 30s')
      } else {
        logger.error('[Cloudflare D1] Batch error:', errorMsg)
      }
      return statements.map(() => ({
        success: false,
        error: errorMsg
      }))
    }
  }
}

const CLOUDFLARE_API_TIMEOUT = 15000 // 15 seconds

class CloudflareD1RESTStatement implements D1PreparedStatement {
  private values: unknown[] = []

  constructor(
    private query: string,
    private accountId: string,
    private databaseId: string,
    private apiToken: string
  ) {}

  // Getter methods for batch execution
  getQuery(): string { return this.query }
  getParams(): unknown[] { return this.values }

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values
    return this
  }

  async first<T = unknown>(): Promise<T | null> {
    const result = await this.all<T>()
    return result.results?.[0] || null
  }

  async run(): Promise<D1Result> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_API_TIMEOUT)

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: this.query,
            params: this.values
          }),
          signal: controller.signal
        }
      )

      clearTimeout(timeout)

      const data = await response.json() as {
        success: boolean
        result?: Array<{ results: unknown[], success: boolean, meta: D1Result['meta'] }>
        errors?: Array<{ message: string }>
      }

      if (!data.success || !data.result?.[0]) {
        return {
          success: false,
          error: data.errors?.[0]?.message || 'Unknown error'
        }
      }

      return {
        success: data.result[0].success,
        results: data.result[0].results,
        meta: data.result[0].meta
      }
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[Cloudflare D1] Request timeout after', CLOUDFLARE_API_TIMEOUT, 'ms')
        return {
          success: false,
          error: 'Cloudflare D1 API timeout'
        }
      }
      throw error
    }
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const result = await this.run()
    return result as D1Result<T>
  }
}

class CloudflareKVREST implements KVNamespace {
  constructor(
    private accountId: string,
    private namespaceId: string,
    private apiToken: string
  ) {}

  async get(key: string): Promise<string | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_API_TIMEOUT)

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}/values/${key}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          },
          signal: controller.signal
        }
      )

      clearTimeout(timeout)

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`KV GET failed: ${response.statusText}`)
      }

      return await response.text()
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[Cloudflare KV] GET timeout after', CLOUDFLARE_API_TIMEOUT, 'ms')
        throw new Error('Cloudflare KV API timeout')
      }
      throw error
    }
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_API_TIMEOUT)

    try {
      const url = new URL(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}/values/${key}`
      )

      if (options?.expirationTtl) {
        url.searchParams.set('expiration_ttl', options.expirationTtl.toString())
      }

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'text/plain'
        },
        body: value,
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`KV PUT failed: ${response.statusText}`)
      }
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[Cloudflare KV] PUT timeout after', CLOUDFLARE_API_TIMEOUT, 'ms')
        throw new Error('Cloudflare KV API timeout')
      }
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_API_TIMEOUT)

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}/values/${key}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          },
          signal: controller.signal
        }
      )

      clearTimeout(timeout)

      if (!response.ok && response.status !== 404) {
        throw new Error(`KV DELETE failed: ${response.statusText}`)
      }
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('[Cloudflare KV] DELETE timeout after', CLOUDFLARE_API_TIMEOUT, 'ms')
        throw new Error('Cloudflare KV API timeout')
      }
      throw error
    }
  }
}

// Global instances
let inMemoryDB: D1Database | null = null
let inMemoryKV: KVNamespace | null = null
let cloudflareRESTDB: D1Database | null = null
let cloudflareRESTKV: KVNamespace | null = null

/**
 * Get D1 database instance
 * Priority:
 * 1. Cloudflare Pages binding (production)
 * 2. Cloudflare REST API (localhost with credentials)
 * 3. In-memory fallback (localhost without credentials)
 */
export function getDB(env?: CloudflareEnv): D1Database {
  // 1. Use native binding if available (Cloudflare Pages)
  if (env?.domus_db) {
    return env.domus_db
  }

  // 2. Use REST API if credentials are available (localhost)
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const databaseId = process.env.DATABASE_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (accountId && databaseId && apiToken) {
    if (!cloudflareRESTDB) {
      logger.debug('[Cloudflare] Using D1 REST API for localhost')
      cloudflareRESTDB = new CloudflareD1REST(accountId, databaseId, apiToken)
    }
    return cloudflareRESTDB
  }

  // 3. Fallback to in-memory for local development
  if (!inMemoryDB) {
    logger.debug('[Cloudflare] Using in-memory D1 fallback')
    inMemoryDB = new InMemoryD1()
  }
  return inMemoryDB
}

/**
 * Get KV namespace instance
 * Priority:
 * 1. Cloudflare Pages binding (production)
 * 2. Cloudflare REST API (localhost with credentials)
 * 3. In-memory fallback (localhost without credentials)
 */
export function getKV(env?: CloudflareEnv): KVNamespace {
  // 1. Use native binding if available (Cloudflare Pages)
  if (env?.KV) {
    return env.KV
  }

  // 2. Use REST API if credentials are available (localhost)
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const namespaceId = process.env.KV_NAMESPACE_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (accountId && namespaceId && apiToken) {
    if (!cloudflareRESTKV) {
      logger.debug('[Cloudflare] Using KV REST API for localhost')
      cloudflareRESTKV = new CloudflareKVREST(accountId, namespaceId, apiToken)
    }
    return cloudflareRESTKV
  }

  // 3. Fallback to in-memory for local development
  if (!inMemoryKV) {
    logger.debug('[Cloudflare] Using in-memory KV fallback')
    inMemoryKV = new InMemoryKV()
  }
  return inMemoryKV
}

/**
 * Check if we're running in Cloudflare environment
 */
export function isCloudflare(env?: CloudflareEnv): boolean {
  return !!(env?.domus_db && env?.KV)
}
