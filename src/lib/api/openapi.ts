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
    },
    BalanceResult: {
      type: 'object',
      description: 'Recalculated wallet balance (or an error for that wallet).',
      properties: {
        walletId: { type: 'string' },
        previousBalance: { type: 'number', description: 'Stored balance before recalculation' },
        balance: { type: 'number', description: 'openingBalance + completed transactions on/after openingBalanceDate' },
        transactionsCounted: { type: 'integer', description: 'Transactions that changed the balance' },
        skippedCurrency: { type: 'integer', description: "Transactions in another currency than the wallet's and without exchangeRate (left out; e.g. USD charges on an ARS card belong to the statement's USD fields)" },
        openingBalance: { type: 'number' },
        openingBalanceDate: { type: 'string', format: 'date-time' },
        error: { type: 'string' }
      },
      required: ['walletId']
    },
    BatchCounts: {
      type: 'object',
      description: 'Record count per table',
      additionalProperties: { type: 'integer' }
    }
  }

  for (const table of SYNC_TABLE_NAMES) {
    const fields = allFields(table)
    const { dateField } = TABLE_METADATA[table]
    schemas[table] = {
      type: 'object',
      description: `${TABLE_METADATA[table].description} Id prefix: "${TABLE_METADATA[table].idPrefix}_".` +
        (dateField ? ` dateFrom/dateTo filter on "${dateField}".` : ''),
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
  const dryRunParam = {
    name: 'dryRun',
    in: 'query',
    schema: { type: 'boolean', default: false },
    description: 'Run everything (validation, name resolution, last-writer-wins, exchange-rate fill, recalculation) and return the same results, but write nothing. The response includes "dryRun": true.'
  }
  const recalcParam = {
    name: 'recalculateBalances',
    in: 'query',
    schema: { type: 'boolean', default: false },
    description: 'After writing, recalculate every wallet touched (personalTransactions only) and report them in "balances"'
  }
  const balances = { type: 'array', items: ref('BalanceResult') }
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
      '/api/v1/me': {
        get: {
          summary: 'Describe the calling API key (any valid key, no scope needed)',
          responses: {
            '200': {
              description: 'Key details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      keyId: { type: 'string' },
                      name: { type: 'string' },
                      prefix: { type: 'string' },
                      scopes: { type: 'array', items: { type: 'string', enum: ['read', 'write'] } },
                      userId: { type: 'string' },
                      householdId: { type: ['string', 'null'] },
                      createdAt: { type: ['string', 'null'] },
                      lastUsedAt: { type: ['string', 'null'] }
                    }
                  }
                }
              }
            },
            '401': commonErrors['401'],
            '403': commonErrors['403']
          }
        }
      },
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
            { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'nextCursor from the previous page' },
            { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' }, description: "Inclusive lower bound on the table's main date field (dateField in GET /api/v1/tables, e.g. personalTransactions.date). Date-only values cover the whole UTC day. 400 on tables without one." },
            { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Inclusive upper bound on the main date field' },
            {
              name: 'filters',
              in: 'query',
              style: 'form',
              explode: true,
              schema: { type: 'object', additionalProperties: { type: 'string' } },
              description: 'Equality filters on any field of the table: ?walletId=pw_visa&type=expense. Values are converted to the field type (numbers, true/false, dates); enum values are checked. Repeat a parameter to match any of several values (?type=expense&type=refund). An empty value matches missing/empty fields. Unknown fields are a 400. Pagination (limit/cursor/hasMore) applies to the filtered set.'
            }
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
            { name: 'mode', in: 'query', schema: { type: 'string', enum: ['replace', 'merge'], default: 'replace' }, description: 'replace: records are written as given and fully validated; merge: fields are merged onto the existing record and only the sent fields are validated' },
            dryRunParam,
            recalcParam,
            { name: 'importBatchId', in: 'query', schema: { type: 'string', maxLength: 200 }, description: 'Stamp importBatchId on every record, so the load can be summarized or undone with /api/v1/import-batches/{batchId}' }
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
                      dryRun: { type: 'boolean' },
                      importBatchId: { type: 'string' },
                      balances,
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
          summary: 'Partially update a record (null clears a field). Only the sent fields are validated.',
          parameters: [tableParam, idParam, dryRunParam],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Updated record' }, '422': errorResponse('Validation failed'), ...commonErrors }
        },
        delete: {
          summary: 'Delete a record (writes a sync tombstone)',
          parameters: [tableParam, idParam, dryRunParam],
          responses: { '200': { description: 'Deleted' }, ...commonErrors }
        }
      },
      '/api/v1/personalWallets/{id}/recalculate': {
        post: {
          summary: "Recalculate and store a wallet's balance from its transactions",
          description: 'balance = openingBalance + every completed transaction (as walletId, or as targetWalletId of a transfer) dated on or after openingBalanceDate. Refunds add, cancelled/pending are ignored, foreign-currency amounts use exchangeRate or are left out (skippedCurrency). Write scope.',
          parameters: [idParam, dryRunParam],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    openingBalance: { type: ['number', 'null'], description: 'Stored on the wallet first; null clears it' },
                    openingBalanceDate: { type: ['string', 'null'], format: 'date-time', description: 'Stored on the wallet first; null clears it' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'New balance',
              content: { 'application/json': { schema: { allOf: [ref('BalanceResult'), { type: 'object', properties: { dryRun: { type: 'boolean' } } }] } } }
            },
            '422': errorResponse('Invalid openingBalance/openingBalanceDate'),
            ...commonErrors
          }
        }
      },
      '/api/v1/import-batches/{batchId}': {
        get: {
          summary: 'Count the live records of an import batch per table (read scope)',
          parameters: [{ name: 'batchId', in: 'path', required: true, schema: { type: 'string', maxLength: 200 } }],
          responses: {
            '200': {
              description: 'Batch summary',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { batchId: { type: 'string' }, tables: ref('BatchCounts'), total: { type: 'integer' } } }
                }
              }
            },
            ...commonErrors
          }
        },
        delete: {
          summary: 'Undo an import: tombstone every live record with this importBatchId, across all tables (write scope)',
          parameters: [
            { name: 'batchId', in: 'path', required: true, schema: { type: 'string', maxLength: 200 } },
            dryRunParam,
            { ...recalcParam, description: "Recalculate the wallets of the batch's transactions afterwards and report them in \"balances\"" }
          ],
          responses: {
            '200': {
              description: 'Deleted counts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { dryRun: { type: 'boolean' }, batchId: { type: 'string' }, deleted: ref('BatchCounts'), total: { type: 'integer' }, balances }
                  }
                }
              }
            },
            ...commonErrors
          }
        }
      }
    }
  }
}
