/**
 * Real-SQL D1 stand-in for route tests, backed by Node's built-in SQLite
 * (node:sqlite, Node >= 22.5). Loads schema.sql so queries run against the
 * production schema. Use `hasNodeSqlite` to skip suites on older runtimes.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CloudflareEnv } from '@/lib/cloudflare'

type SqliteModule = typeof import('node:sqlite')
type D1 = NonNullable<CloudflareEnv['domus_db']>
type KV = NonNullable<CloudflareEnv['KV']>

function loadSqlite(): SqliteModule | null {
  try {
    // getBuiltinModule bypasses Vite's bundler, which doesn't know node:sqlite
    const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule
    return (getBuiltin?.('node:sqlite') as SqliteModule) ?? null
  } catch {
    return null
  }
}

const sqlite = loadSqlite()
export const hasNodeSqlite = sqlite !== null

function toSqlValue(value: unknown): string | number | bigint | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') return value
  return String(value)
}

export interface TestD1 extends D1 {
  /** Direct synchronous access for assertions. */
  raw: InstanceType<SqliteModule['DatabaseSync']>
}

export function createTestD1(): TestD1 {
  if (!sqlite) throw new Error('node:sqlite is not available in this Node version')
  const raw = new sqlite.DatabaseSync(':memory:')
  raw.exec(readFileSync(resolve(process.cwd(), 'schema.sql'), 'utf8'))

  const makeStatement = (query: string, values: unknown[] = []) => {
    const statement = {
      bind: (...next: unknown[]) => makeStatement(query, next),
      async all<T>() {
        const results = raw.prepare(query).all(...values.map(toSqlValue)) as T[]
        return { success: true, results }
      },
      async first<T>() {
        const row = raw.prepare(query).get(...values.map(toSqlValue)) as T | undefined
        return row ?? null
      },
      async run() {
        const info = raw.prepare(query).run(...values.map(toSqlValue))
        return {
          success: true,
          meta: { duration: 0, size_after: 0, rows_read: 0, rows_written: Number(info.changes) }
        }
      }
    }
    return statement
  }

  const db = {
    raw,
    prepare: (query: string) => makeStatement(query),
    async exec(query: string) {
      raw.exec(query)
      return { count: 0, duration: 0 }
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const results = []
      raw.exec('BEGIN')
      try {
        for (const stmt of statements) results.push(await stmt.run())
        raw.exec('COMMIT')
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      }
      return results
    }
  }
  return db as unknown as TestD1
}

export function createTestKV(): KV {
  const store = new Map<string, string>()
  return {
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    }
  }
}
