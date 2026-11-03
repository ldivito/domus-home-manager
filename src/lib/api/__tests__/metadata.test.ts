import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SYNC_TABLE_NAMES } from '@/lib/sync-tables'
import { describeTable, TABLE_METADATA } from '../table-metadata'
import { buildOpenApiDocument } from '../openapi'
import { normalizeDate } from '../records'

describe('sync table whitelist', () => {
  it('matches the client SYNC_TABLES list in src/lib/sync.ts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/sync.ts'), 'utf8')
    const block = /const SYNC_TABLES = \[([\s\S]*?)\] as const/.exec(source)
    expect(block).not.toBeNull()
    const clientTables = Array.from(block![1].matchAll(/'([A-Za-z]+)'/g)).map(m => m[1])
    expect([...clientTables].sort()).toEqual([...SYNC_TABLE_NAMES].sort())
  })

  it('has metadata with a unique id prefix for every table', () => {
    expect(Object.keys(TABLE_METADATA).sort()).toEqual([...SYNC_TABLE_NAMES].sort())
    const prefixes = SYNC_TABLE_NAMES.map(t => TABLE_METADATA[t].idPrefix)
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })

  it('describes tables with system fields first', () => {
    const description = describeTable('personalTransactions')
    expect(description.idPrefix).toBe('pt')
    expect(description.fields.slice(0, 4).map(f => f.name)).toEqual(['id', 'householdId', 'createdAt', 'updatedAt'])
    expect(description.fields.find(f => f.name === 'type')?.enum).toEqual(['income', 'expense', 'transfer'])
  })

  it('builds an OpenAPI document covering every table', () => {
    const doc = buildOpenApiDocument('https://example.test') as {
      paths: Record<string, unknown>
      components: { schemas: Record<string, { required?: string[] }> }
    }
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/api/v1/tables', '/api/v1/{table}', '/api/v1/{table}/bulk', '/api/v1/{table}/{id}'])
    )
    for (const table of SYNC_TABLE_NAMES) expect(doc.components.schemas[table]).toBeDefined()
    expect(doc.components.schemas.meals.required).toEqual(expect.arrayContaining(['title', 'date', 'mealType']))
  })
})

describe('normalizeDate', () => {
  it('produces full ISO strings the client revives into Dates', () => {
    expect(normalizeDate('2026-11-03')).toBe('2026-11-03T12:00:00.000Z')
    expect(normalizeDate('2026-11-03T10:00:00-03:00')).toBe('2026-11-03T13:00:00.000Z')
    expect(normalizeDate(0)).toBe('1970-01-01T00:00:00.000Z')
    expect(normalizeDate('not a date')).toBeNull()
    expect(normalizeDate('')).toBeNull()
    expect(normalizeDate(true)).toBeNull()
  })
})
