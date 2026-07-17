import { z } from 'zod'

/**
 * Per-table payload validation for the sync push channel.
 *
 * Design: every field is optional (older clients may push records created
 * before a field existed) but must have the right type when present — this
 * blocks type-poisoning (e.g. a string amount that would NaN every balance
 * on other devices) without rejecting legitimate legacy rows. Objects are
 * loose so new fields added by future schema versions still sync.
 *
 * Tables without an entry here are accepted as-is (they already passed the
 * whitelist + plain-object + id checks in the push route).
 */

// Dates arrive JSON-serialized as ISO strings; tolerate epoch numbers too
const isoDate = z.union([z.string().max(64), z.number(), z.date()])
const currency = z.enum(['ARS', 'USD'])
const finiteNumber = z.number().finite()
const boundedString = z.string().max(500)

const baseRecord = {
  id: boundedString.optional(),
  householdId: boundedString.optional(),
  createdAt: isoDate.optional(),
  updatedAt: isoDate.optional()
}

const tableSchemas: Record<string, z.ZodType> = {
  users: z.looseObject({
    ...baseRecord,
    name: z.string().max(200).optional(),
    email: z.string().max(320).optional(),
    color: z.string().max(50).optional(),
    type: z.enum(['resident', 'guest']).optional()
  }),

  households: z.looseObject({
    ...baseRecord,
    name: z.string().max(200).optional(),
    inviteCode: z.string().max(50).optional()
  }),

  householdMembers: z.looseObject({
    ...baseRecord,
    userId: boundedString.optional(),
    role: z.enum(['owner', 'admin', 'member']).optional()
  }),

  monthlyIncomes: z.looseObject({
    ...baseRecord,
    userId: boundedString.optional(),
    amount: finiteNumber.optional(),
    currency: currency.optional(),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2200).optional(),
    source: z.string().max(300).optional()
  }),

  monthlyExchangeRates: z.looseObject({
    ...baseRecord,
    rate: finiteNumber.positive().optional(),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2200).optional()
  }),

  recurringExpenses: z.looseObject({
    ...baseRecord,
    name: z.string().max(300).optional(),
    amount: finiteNumber.optional(),
    currency: currency.optional(),
    dueDay: z.number().int().min(1).max(31).optional(),
    isActive: z.boolean().optional()
  }),

  expenseCategories: z.looseObject({
    ...baseRecord,
    name: z.string().max(300).optional(),
    icon: z.string().max(100).optional(),
    color: z.string().max(50).optional()
  }),

  expensePayments: z.looseObject({
    ...baseRecord,
    recurringExpenseId: boundedString.optional(),
    amount: finiteNumber.optional(),
    currency: currency.optional(),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2200).optional(),
    status: z.enum(['pending', 'paid', 'overdue']).optional(),
    paidByUserId: boundedString.optional(),
    dueDate: isoDate.optional(),
    paidDate: isoDate.nullable().optional()
  }),

  settlementPayments: z.looseObject({
    ...baseRecord,
    fromUserId: boundedString.optional(),
    toUserId: boundedString.optional(),
    amount: finiteNumber.optional(),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2200).optional()
  }),

  personalWallets: z.looseObject({
    ...baseRecord,
    userId: boundedString.optional(),
    name: z.string().max(300).optional(),
    type: z.string().max(50).optional(),
    balance: finiteNumber.optional(),
    currency: currency.optional(),
    creditLimit: finiteNumber.optional(),
    isActive: z.boolean().optional()
  }),

  personalCategories: z.looseObject({
    ...baseRecord,
    userId: boundedString.optional(),
    name: z.string().max(300).optional(),
    type: z.enum(['income', 'expense']).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional()
  }),

  personalTransactions: z.looseObject({
    ...baseRecord,
    userId: boundedString.optional(),
    walletId: boundedString.optional(),
    targetWalletId: boundedString.optional(),
    categoryId: boundedString.optional(),
    type: z.enum(['income', 'expense', 'transfer']).optional(),
    amount: finiteNumber.optional(),
    currency: currency.optional(),
    exchangeRate: finiteNumber.positive().nullable().optional(),
    status: z.string().max(50).optional(),
    date: isoDate.optional()
  }),

  creditCardStatements: z.looseObject({
    ...baseRecord,
    walletId: boundedString.optional(),
    totalAmount: finiteNumber.optional(),
    minimumPayment: finiteNumber.optional(),
    dueDate: isoDate.optional()
  }),

  creditCardPayments: z.looseObject({
    ...baseRecord,
    walletId: boundedString.optional(),
    amount: finiteNumber.optional(),
    paymentDate: isoDate.optional()
  }),

  personalScheduledPayments: z.looseObject({
    ...baseRecord,
    userId: boundedString.optional(),
    walletId: boundedString.optional(),
    sourceWalletId: boundedString.optional(),
    paymentType: z.enum(['minimum', 'full', 'fixed']).optional(),
    fixedAmount: finiteNumber.positive().optional(),
    daysBefore: z.number().int().min(0).max(28).optional(),
    isActive: z.boolean().optional()
  })
}

export function validateSyncPayload(
  table: string,
  data: unknown
): { ok: true } | { ok: false; error: string } {
  const schema = tableSchemas[table]
  if (!schema) return { ok: true }

  const result = schema.safeParse(data)
  if (result.success) return { ok: true }

  const error = result.error.issues
    .slice(0, 3)
    .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
  return { ok: false, error }
}
