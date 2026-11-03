/**
 * OpenAPI 3.1 description of the agent data API, generated from the table
 * metadata registry (served at GET /api/v1/openapi.json).
 */
import { SYNC_TABLE_NAMES } from '@/lib/sync-tables'
import { MAX_BULK_RECORDS } from './records'
import { allFields, TABLE_METADATA, type FieldSpec } from './table-metadata'

type Schema = Record<string, unknown>

function fieldSchema(spec: FieldSpec): Schema {
  const schema: Schema = {}
  switch (spec.type) {
    case 'date':
      schema.type = 'string'
      schema.format = 'date-time'
      break
    case 'array':
      schema.type = 'array'
      break
    case 'object':
      schema.type = 'object'
      break
    default:
      schema.type = spec.type
  }
  if (spec.enum) schema.enum = [...spec.enum]
  if (spec.default !== undefined && typeof spec.default !== 'string') schema.default = spec.default
  else if (typeof spec.default === 'string' && !spec.default.startsWith('$')) schema.default = spec.default
  const notes = [spec.description, spec.ref ? `References ${spec.ref}.` : undefined].filter(Boolean)
  if (notes.length) schema.description = notes.join(' ')
  return schema
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } }
})

export function buildOpenApiDocument(serverUrl?: string): Schema {
  const schemas: Record<string, Schema> = {
    Error: {
      type: 'object',
      properties: {
        error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: {}
          },
          required: ['code', 'message']
        }
      }
    },
    RecordResult: {
      type: 'object',
      properties: {
        index: { type: 'integer' },
        id: { type: 'string' },
        status: { type: 'string', enum: ['created', 'updated', 'skipped', 'error'] },
        reason: { type: 'string' },
        error: { type: 'string' },
        warnings: { type: 'array', items: { type: 'string' } }
      },
      required: ['index', 'status']
    }
  }

  for (const table of SYNC_TABLE_NAMES) {
    const fields = allFields(table)
    schemas[table] = {
      type: 'object',
      description: `${TABLE_METADATA[table].description} Id prefix: "${TABLE_METADATA[table].idPrefix}_".`,
      properties: Object.fromEntries(Object.entries(fields).map(([name, spec]) => [name, fieldSchema(spec)])),
      required: Object.entries(fields).filter(([, spec]) => spec.required).map(([name]) => name),
      additionalProperties: true
    }
  }

  const tableParam = {
    name: 'table',
    in: 'path',
    required: true,
    schema: { type: 'string', enum: [...SYNC_TABLE_NAMES] }
  }
  const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', maxLength: 200 } }
  const anyRecord = { oneOf: SYNC_TABLE_NAMES.map(ref) }
  const commonErrors = {
    '401': errorResponse('Missing, invalid or revoked API key'),
    '403': errorResponse('Key lacks the required scope or owner left the household'),
    '404': errorResponse('Unknown table or record'),
    '429': errorResponse('Rate limited')
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Domus data API',
      version: '1.0.0',
      description:
        'API-key authenticated access to household data. Writes are stored in the sync log and reach every device on its next sync. See docs/API.md.'
    },
    ...(serverUrl ? { servers: [{ url: serverUrl }] } : {}),
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key: domus_sk_...' }
      },
      schemas
    },
    paths: {
      '/api/v1/tables': {
        get: {
          summary: 'List tables with id prefixes and fields',
          responses: { '200': { description: 'Tables' }, ...commonErrors }
        }
      },
      '/api/v1/{table}': {
        get: {
          summary: 'List the latest non-deleted records of a table',
          parameters: [
            tableParam,
            { name: 'updatedSince', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Only records received by the server after this time (use serverTime from a previous response)' },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'nextCursor from the previous page' }
          ],
          responses: {
            '200': {
              description: 'Page of records',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      table: { type: 'string' },
                      data: { type: 'array', items: anyRecord },
                      count: { type: 'integer' },
                      hasMore: { type: 'boolean' },
                      nextCursor: { type: ['string', 'null'] },
                      serverTime: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            },
            ...commonErrors
          }
        }
      },
      '/api/v1/{table}/bulk': {
        post: {
          summary: `Upsert up to ${MAX_BULK_RECORDS} records (per-record results)`,
          parameters: [
            tableParam,
            { name: 'mode', in: 'query', schema: { type: 'string', enum: ['replace', 'merge'], default: 'replace' }, description: 'replace: records are written as given; merge: fields are merged onto the existing record' }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { records: { type: 'array', maxItems: MAX_BULK_RECORDS, items: anyRecord } },
                  required: ['records']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Per-record results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      table: { type: 'string' },
                      summary: {
                        type: 'object',
                        properties: {
                          created: { type: 'integer' },
                          updated: { type: 'integer' },
                          skipped: { type: 'integer' },
                          error: { type: 'integer' }
                        }
                      },
                      results: { type: 'array', items: ref('RecordResult') }
                    }
                  }
                }
              }
            },
            '400': errorResponse('Malformed body'),
            '413': errorResponse('Too many records or body too large'),
            ...commonErrors
          }
        }
      },
      '/api/v1/{table}/{id}': {
        get: {
          summary: 'Get one record',
          parameters: [tableParam, idParam],
          responses: { '200': { description: 'Record' }, ...commonErrors }
        },
        patch: {
          summary: 'Partially update a record (null clears a field)',
          parameters: [tableParam, idParam],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Updated record' }, '422': errorResponse('Validation failed'), ...commonErrors }
        },
        delete: {
          summary: 'Delete a record (writes a sync tombstone)',
          parameters: [tableParam, idParam],
          responses: { '200': { description: 'Deleted' }, ...commonErrors }
        }
      }
    }
  }
}
