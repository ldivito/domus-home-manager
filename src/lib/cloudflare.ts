/**
 * Cloudflare bindings utilities
 * 
 * Provides access to D1 database and KV namespace.
 * For local development (npm run dev), falls back to in-memory storage.
 * For production (Cloudflare Pages), uses actual D1/KV bindings.
 */

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

// Global instances for in-memory fallback
let inMemoryDB: D1Database | null = null
let inMemoryKV: KVNamespace | null = null

/**
 * Get D1 database instance
 * In production (Cloudflare Pages), returns actual D1 binding
 * In development, returns in-memory fallback
 */
export function getDB(env?: CloudflareEnv): D1Database {
  if (env?.domus_db) {
    return env.domus_db
  }
  
  // Fallback to in-memory for local development
  if (!inMemoryDB) {
    inMemoryDB = new InMemoryD1()
  }
  return inMemoryDB
}

/**
 * Get KV namespace instance
 * In production (Cloudflare Pages), returns actual KV binding
 * In development, returns in-memory fallback
 */
export function getKV(env?: CloudflareEnv): KVNamespace {
  if (env?.KV) {
    return env.KV
  }
  
  // Fallback to in-memory for local development
  if (!inMemoryKV) {
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
