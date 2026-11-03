# Domus data API (v1)

An API-key authenticated HTTP API for bulk-loading and editing household data
from external clients, in particular other AI agents. Everything the app syncs
is available: household finance, personal finance, meals, grocery, tasks,
chores, reminders, keto, pets, maintenance, subscriptions, savings, documents
metadata, and more.

**How it fits the app.** Domus is offline-first: every device keeps its own
IndexedDB copy and syncs through a server-side log (`sync_metadata`). This API
reads from and writes to that same log, using the same rules as device sync
(last-writer-wins on `updatedAt`). Records you write show up on every device
after its next sync. Records edited on devices show up here once that device
has synced.

- Base URL: your Domus deployment, e.g. `https://domus.example.com`
- Machine-readable description: `GET /api/v1/openapi.json` (OpenAPI 3.1, no auth needed)
- Live table/field list: `GET /api/v1/tables`

> **Deployment:** the API needs the `api_keys` table. To create it on an
> existing D1 database, run
> `wrangler d1 migrations apply domus-db --remote`
> (or `wrangler d1 execute domus-db --remote --file=migrations/0001_api_keys.sql`).
> New databases created from `schema.sql` already have it.

---

## 1. Authentication

### Creating a key

Signed-in users create keys in **Settings → API keys**, or with the session
cookie:

```http
POST /api/api-keys
Content-Type: application/json

{ "name": "Claude finance agent", "scopes": ["read", "write"] }
```

The response contains the plaintext key **once** (`secret`). Domus stores only
a SHA-256 hash and a short visible prefix (`domus_sk_XXXXXXXX`), so a lost key
cannot be recovered. Create a new one and revoke the old one instead.

| Endpoint (session cookie) | Purpose |
|---|---|
| `POST /api/api-keys` `{ name, scopes? }` | Create. `scopes` defaults to `["read","write"]`. Max 20 active keys per user. |
| `GET /api/api-keys` | List your keys (id, name, prefix, scopes, createdAt, lastUsedAt, revokedAt). |
| `DELETE /api/api-keys/{id}` | Revoke. The key stops working immediately. |

### Using a key

```http
Authorization: Bearer domus_sk_...
```

- **Scopes.** `read` covers GET endpoints. `write` covers bulk, PATCH, DELETE,
  wallet recalculation and import-batch deletion. A key with only `write`
  cannot list or read records. `GET /api/v1/me` works with any valid key.
- **Data scope.** A key is bound to the household its creator belonged to when
  it was created. It reads and writes that household's data only. Without a
  household, it is bound to the creator's personal data. The creator's household
  membership is checked on every request, so a key stops working as soon as its
  owner leaves or is removed from the household.
- **Same powers as a member's device.** Like device sync, a key can write any
  syncable record in its household, including other members' personal-finance
  records.

### Errors

Every error has this shape:

```json
{ "error": { "code": "insufficient_scope", "message": "This API key lacks the \"write\" scope." } }
```

| HTTP | code | When |
|---|---|---|
| 400 | `invalid_request` | Malformed body, query or id |
| 401 | `unauthorized` | Missing, malformed, unknown or revoked key |
| 403 | `insufficient_scope` / `forbidden` | Missing scope / owner left the household |
| 404 | `not_found` | Unknown table or record |
| 413 | `payload_too_large` | More than 500 records, or a body over 10 MB |
| 422 | `validation_failed` | PATCH produced an invalid record, or an invalid recalculate body |
| 429 | `rate_limited` | See below. Honour `Retry-After`. |

### Rate limits

- 120 requests per minute per key
- 600 requests per minute per IP
- 20 failed authentications per 15 minutes per IP

Counters are kept per server instance, so treat these numbers as upper bounds.
For large loads, send fewer, bigger bulk requests (up to 500 records each)
rather than many small ones.

---

## 2. Conventions

- **Tables.** The table names match the app's IndexedDB tables, e.g.
  `personalTransactions` or `groceryItems`. Only syncable tables are accepted.
  The full list is at `GET /api/v1/tables`.
- **IDs.** Strings of at most 200 characters. If you omit `id` on create, the
  server assigns `<prefix>_<uuid>` using the table's prefix, e.g.
  `pt_3f0c...` for a personal transaction. To make a load idempotent, supply
  your own ids with the table prefix, e.g. `pt_import-2026-11-001`. Re-running
  the load then updates those records instead of duplicating them.
- **Dates.** Use ISO 8601 strings. Every date field is stored as a full UTC
  timestamp (`2026-11-03T15:00:00.000Z`), which is the format devices convert
  back into dates.
  - A date-only value such as `"2026-11-03"` is stored as **12:00 UTC** on that
    day. That keeps the same calendar day in every timezone from UTC-11 to
    UTC+11. Use date-only values for transaction dates, meal dates and due dates.
  - Datetimes need a `Z` or an offset (`2026-11-03T09:30:00-03:00`).
  - Epoch milliseconds are accepted.
- **System fields.** The server manages these fields:
  - `householdId` is always set to the key's household. Any value you send is
    overwritten.
  - `createdAt` defaults to now.
  - `updatedAt` defaults to now.
  - `importBatchId` (optional, any table) labels the load a record came
    from. Bulk `?importBatchId=...` stamps it on every record of the request.
    See [import batches](#import-batches).
- **Last-writer-wins.** Each stored version carries `updatedAt`, the edit
  time. On bulk, if you send `updatedAt`, the write applies only if it is newer
  than the stored version. Otherwise the result is `skipped`. Omit `updatedAt`
  (the normal case) and the server stamps the current time, so your write wins.
  An `updatedAt` more than 5 minutes in the future is rejected. PATCH and
  DELETE always apply on top of the latest version.
- **Validation.** Each record is checked against the table's fields: types,
  enums, and required fields on create. It also goes through the same
  per-table payload validation that device sync uses. Unknown fields are
  stored as they are and reported in `warnings`, which helps you catch typos.
  - Creates and `mode=replace` validate the whole record.
  - `mode=merge` and PATCH on an existing record validate **only the fields
    you send**. Values already stored (possibly written by an old app
    version) never block an unrelated change: legacy shapes are converted
    (`0`/`1` to booleans, numeric strings to numbers) and anything else is
    kept as it is. Sent fields still may not clear a required field, and
    cross-field rules (for example "transfers need `targetWalletId`") are
    re-checked when you send one of their fields.
  - `0` and `1` sent for a boolean field are converted to `false`/`true`,
    with a warning.
- **Dry runs.** Bulk, PATCH, DELETE, wallet recalculation and import-batch
  deletion accept `?dryRun=true`. The request runs completely (validation,
  name resolution, last-writer-wins decision, exchange-rate fill,
  recalculation) and returns exactly the results a real run would, plus
  `"dryRun": true`, but writes nothing. Use it to check a large load before
  sending it for real.
- **null.** Sending `null` for a field removes it. You cannot clear a required
  field this way.
- **Category references differ by module:**
  - Grocery items, saved grocery items and saved meals refer to categories by
    **name** (`category: "defaultCategories.dairy"` or a custom name).
  - `tasks.category`, `recurringExpenses.category` and
    `personalTransactions.categoryId` refer to categories by **id**.
  - The app's built-in categories store a translation key as their name, e.g.
    `defaultExpenseCategories.utilities` or `defaultCategories.produce`. List
    the category table first to see the real names and ids.
- **Automatic exchange rate.** A `personalTransactions` write with
  `currency: "USD"` and no `exchangeRate` gets the `rate` of the
  `monthlyExchangeRates` record for the transaction's month and year (UTC). A
  warning names the rate and record used. When there is no rate for that
  month, the transaction is still written, without `exchangeRate`, and a
  warning says so. Send `exchangeRate` yourself to use another rate.
- **No cascades and few derived updates.** The API does not run the app's
  business logic:
  - Writing personal transactions does **not** change the stored `balance` of
    a wallet by itself. Call
    [`POST /api/v1/personalWallets/{id}/recalculate`](#post-apiv1personalwalletsidrecalculate-write),
    or add `?recalculateBalances=true` to the transactions bulk request.
  - Statement totals are never derived from transactions: statements created
    through the API default to `manualTotals: true`, and you send the bank's
    totals.
  - Deleting a wallet does not delete its transactions.
  - Writing an expense payment does not touch its recurring expense.

---

## 3. Endpoints

### `GET /api/v1/me` (any valid key)

Describes the calling key. Useful to check which household a key writes to
before a load.

```json
{ "keyId": "...", "name": "Claude finance agent", "prefix": "domus_sk_AbCdEfGh",
  "scopes": ["read", "write"], "userId": "...", "householdId": "...",
  "createdAt": "2026-11-01 10:00:00", "lastUsedAt": "2026-11-03T15:00:00.000Z" }
```

### `GET /api/v1/tables` (read)

Lists every table with its module, description, id prefix, main date field
(`dateField`, used by `dateFrom`/`dateTo`) and fields: type, required, enum,
default and references.

### `GET /api/v1/{table}` (read)

Lists the latest version of each non-deleted record.

| Query | Meaning |
|---|---|
| `limit` | 1 to 500 records per page. Default 100. |
| `cursor` | The `nextCursor` value from the previous page. |
| `updatedSince` | Only records the server received after this ISO time. For incremental fetches, pass the `serverTime` from a previous response. |
| `dateFrom`, `dateTo` | Inclusive range on the table's main date field (see below). A date-only value covers the whole UTC day. |
| `<field>=<value>` | Equality filter on any field of the table, e.g. `walletId=pw_visa`, `type=expense`, `creditCardStatementId=ccs_...`, `categoryId=pc_food`, `status=completed`, `importBatchId=visa-2026-10`, `isActive=true`. |

Field filters:
- The field must exist in the table (`GET /api/v1/tables`), otherwise 400.
- Values are converted to the field type: numbers, `true`/`false` (or
  `1`/`0`) and dates. Enum values are checked. Stored legacy values compare
  by meaning, so a stored `isActive: 1` matches `isActive=true`.
- Repeat a parameter to match any of several values:
  `?type=expense&type=refund`.
- An empty value (`?creditCardStatementId=`) matches records where the field
  is missing or empty.
- Array and object fields cannot be filtered.
- Filters combine with AND, and `limit`, `cursor` and `hasMore` apply to the
  filtered result: page with `nextCursor` as usual.

Main date fields: `personalTransactions.date`,
`creditCardStatements.periodEnd`, `creditCardPayments.paymentDate`,
`expensePayments.dueDate`, `settlementPayments.paidDate`, `meals.date`,
`tasks.dueDate`, `chores.nextDue`, `calendarEvents.date`,
`reminders.reminderTime`, `subscriptions.nextBillingDate`,
`subscriptionPayments.paymentDate`, the keto entries' `date`, and more (see
`dateField` in `GET /api/v1/tables`). Tables without one answer `dateFrom`
and `dateTo` with 400.

```json
{ "table": "tasks", "data": [ { "id": "tsk_...", "title": "..." } ], "count": 1,
  "hasMore": false, "nextCursor": null, "serverTime": "2026-11-03T15:00:00.000Z" }
```

### `GET /api/v1/{table}/{id}` (read)

Returns `{ "table": "...", "data": { ... } }`, or 404 if the record does not
exist or was deleted.

### `POST /api/v1/{table}/bulk` (write)

Upserts 1–500 records. The body is `{ "records": [ ... ] }` (a bare JSON array
also works). The batch never fails as a whole: each record gets its own result.

| Query | Meaning |
|---|---|
| `mode=replace` (default) | Each record is written exactly as sent, as a full replacement. Defaults fill in missing fields, and required fields must be present. When an existing record is replaced, its original `createdAt` is kept. |
| `mode=merge` | Each record's fields are merged onto the existing record, and only the sent fields are validated. Useful for partial updates of many records. A record that does not exist yet is created (and fully validated). |
| `dryRun=true` | Validate and report, write nothing. The response has `"dryRun": true`. |
| `importBatchId=<id>` | Stamp `importBatchId` on every record (up to 200 characters). Overrides an `importBatchId` inside the records. |
| `recalculateBalances=true` | `personalTransactions` only. After writing, recalculate every wallet the batch touched (as `walletId` or `targetWalletId`, including the previous wallet of a moved transaction) and report them in `balances`. With `dryRun=true`, reports the balances the batch would produce. |

Records in the `personalTransactions` table also accept `categoryName`,
`walletName` and `targetWalletName` in place of the matching ids. Matching
ignores case and only considers the owner's categories and wallets. When a
category name exists for both income and expense, the one matching the
transaction `type` is used. An ambiguous or unknown name gives a per-record
error.

```json
{
  "table": "personalTransactions",
  "summary": { "created": 2, "updated": 0, "skipped": 0, "error": 1 },
  "results": [
    { "index": 0, "id": "pt_...", "status": "created" },
    { "index": 1, "id": "pt_...", "status": "created", "warnings": ["unknown field \"memo\" stored as-is"] },
    { "index": 2, "status": "error", "error": "amount: expected finite number" }
  ]
}
```

The `status` of each result is one of:
- `created`
- `updated`
- `skipped`: a newer version is already stored (see `reason`)
- `error`: nothing was written for this record

With `recalculateBalances=true` the response also has:

```json
"balances": [
  { "walletId": "pw_visa", "previousBalance": 0, "balance": -412530.5,
    "transactionsCounted": 380, "skippedCurrency": 12 }
]
```

### `PATCH /api/v1/{table}/{id}` (write)

Merges the JSON body onto the latest stored version and returns the full
record. Only the sent fields are validated (see Validation). `id` and
`updatedAt` in the body are ignored. If the body's `id` differs from the URL,
the request fails with 400. Accepts `?dryRun=true`.

### `DELETE /api/v1/{table}/{id}` (write)

Writes a delete tombstone, exactly as a device deletion does. Devices remove
the record on their next sync. A later bulk write whose `updatedAt` is older
than the deletion cannot bring the record back. Accepts `?dryRun=true` (still
404 when the record does not exist).

### `POST /api/v1/personalWallets/{id}/recalculate` (write)

Recalculates a wallet's balance from its stored transactions and writes it to
the wallet's `balance`. The math is the app's own:

- balance = `openingBalance` (0 when unset) + every **completed** transaction
  dated on or after `openingBalanceDate` (all of them when unset)
- the wallet's own transactions count by type: `income` and `refund` add,
  `expense` and `transfer` subtract
- incoming transfers (`targetWalletId` = this wallet) add their amount,
  times `exchangeRate` when the two wallets have different currencies
- `pending` and `cancelled` transactions are ignored
- a transaction whose `currency` differs from the wallet's is converted
  with its `exchangeRate`, or **left out** when it has none (counted in
  `skippedCurrency`). A USD charge on an ARS card belongs to the
  statement's USD fields, not to the ARS balance.

The body is optional. `openingBalance` and `openingBalanceDate`, when given,
are stored on the wallet first (`null` clears them):

```http
POST /api/v1/personalWallets/pw_visa/recalculate
{ "openingBalance": 0, "openingBalanceDate": "2026-06-26" }
```

```json
{ "walletId": "pw_visa", "previousBalance": 0, "balance": -412530.5,
  "transactionsCounted": 380, "skippedCurrency": 12,
  "openingBalance": 0, "openingBalanceDate": "2026-06-26T12:00:00.000Z" }
```

Accepts `?dryRun=true`. Other tables answer 404.

### Import batches

Stamp a load with bulk `?importBatchId=visa-2026-10` (or an `importBatchId`
field in each record). Then:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/import-batches/{batchId}` (read) | `{ "batchId", "tables": { "personalTransactions": 380, ... }, "total" }`: live records per table carrying that id. 404 when there are none. |
| `DELETE /api/v1/import-batches/{batchId}` (write) | Undo the load: writes a tombstone for every live record with that id, in every table. Returns `{ "batchId", "deleted": { table: count }, "total" }`. Accepts `?dryRun=true`, and `?recalculateBalances=true` to recalculate the wallets of the batch's transactions afterwards (reported in `balances`). |

A record whose latest version no longer carries the id (for example after a
PATCH with `"importBatchId": null`) is not part of the batch any more.

---

## 4. Record shapes for the main tables

These tables are generated from the server's metadata registry
(`src/lib/api/table-metadata.ts`). `GET /api/v1/tables` is always the
authoritative list and covers every table.

Every record also has the system fields `id`, `householdId`, `createdAt` and
`updatedAt`, and can carry the optional `importBatchId`.

### Household finance

#### `monthlyIncomes` (id prefix `inc_`)

Monthly income per household person (shared-finance module).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | string | yes |  | → `users.id` |
| `amount` | number | yes |  |  |
| `currency` | `ARS` \| `USD` |  | `"ARS"` |  |
| `source` | string | yes |  | e.g. "Salary" |
| `month` | integer | yes |  | 1-12 |
| `year` | integer | yes |  | e.g. 2026 |

#### `monthlyExchangeRates` (id prefix `exr_`)

USD to ARS exchange rate per month.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `rate` | number | yes |  | ARS per 1 USD |
| `month` | integer | yes |  | 1-12 |
| `year` | integer | yes |  | e.g. 2026 |

#### `expenseCategories` (id prefix `ecat_`)

Household expense categories. Default ones use translation keys as name (e.g. "defaultExpenseCategories.utilities").

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `icon` | string |  |  | Lucide icon name |
| `color` | string |  |  |  |
| `isDefault` | boolean |  | `false` |  |

#### `recurringExpenses` (id prefix `exp_`)

Recurring household services/expenses (rent, utilities...).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `description` | string |  |  |  |
| `amount` | number | yes |  | Default/estimated amount; per-month values live in expensePayments |
| `currency` | `ARS` \| `USD` |  | `"ARS"` |  |
| `category` | string | yes |  | Expense category ID → `expenseCategories.id` |
| `frequency` | `monthly` \| `bimonthly` \| `quarterly` \| `yearly` |  | `"monthly"` |  |
| `dueDay` | integer | yes |  | Day of month 1-31 |
| `isActive` | boolean |  | `true` |  |

#### `expensePayments` (id prefix `pay_`)

Per-month value and payment status of a recurring expense.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `recurringExpenseId` | string | yes |  | → `recurringExpenses.id` |
| `amount` | number | yes |  |  |
| `currency` | `ARS` \| `USD` |  | `"ARS"` |  |
| `month` | integer | yes |  | 1-12 |
| `year` | integer | yes |  | e.g. 2026 |
| `dueDate` | date | yes |  |  |
| `paidDate` | date |  |  |  |
| `paidByUserId` | string |  |  | → `users.id` |
| `status` | `pending` \| `paid` \| `overdue` |  | `"pending"` |  |
| `notes` | string |  |  |  |

### Personal finance

#### `personalWallets` (id prefix `pw_`)

Personal wallets: cash, bank accounts and credit cards.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | string |  | key owner | Owner (auth user id); defaults to the API key owner |
| `name` | string | yes |  |  |
| `type` | `physical` \| `bank` \| `credit_card` | yes |  |  |
| `currency` | `ARS` \| `USD` |  | `"ARS"` |  |
| `balance` | number |  | `0` | Stored balance. Not updated by transaction writes: call `POST /api/v1/personalWallets/{id}/recalculate` (or bulk `?recalculateBalances=true`) after loading transactions. |
| `openingBalance` | number |  |  | Balance at `openingBalanceDate`; recalculation = openingBalance + completed transactions since then |
| `openingBalanceDate` | date |  |  | Transactions dated before this are ignored by recalculation |
| `creditLimit` | number |  |  |  |
| `closingDay` | integer |  |  | Credit cards: day of month 1-31 |
| `dueDay` | integer |  |  | Credit cards: days after closing |
| `accountNumber` | string |  |  | Masked, e.g. ****1234 |
| `bankName` | string |  |  |  |
| `color` | string |  | `"#3b82f6"` |  |
| `icon` | string |  | `"Wallet"` |  |
| `isActive` | boolean |  | `true` |  |
| `notes` | string |  |  |  |

#### `personalCategories` (id prefix `pc_`)

Personal income/expense categories.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | string |  | key owner |  |
| `name` | string | yes |  |  |
| `type` | `income` \| `expense` | yes |  |  |
| `color` | string |  | `"#6b7280"` |  |
| `icon` | string |  | `"Tag"` |  |
| `isActive` | boolean |  | `true` |  |
| `isDefault` | boolean |  | `false` |  |

#### `personalTransactions` (id prefix `pt_`)

Personal income/expense/transfer transactions. Accepts categoryName/walletName/targetWalletName instead of ids on write.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | string |  | key owner |  |
| `type` | `income` \| `expense` \| `transfer` \| `refund` | yes |  | `refund` = money back (returns, tax credits like RG 5617): adds to the wallet and reduces a card statement's charges; uses an expense category |
| `amount` | number | yes |  | Always positive; direction comes from type (use type `refund` for credits, never a negative amount) |
| `currency` | `ARS` \| `USD` |  | `"ARS"` |  |
| `walletId` | string | yes |  | Or pass walletName → `personalWallets.id` |
| `targetWalletId` | string |  |  | Required for transfers. Or pass targetWalletName → `personalWallets.id` |
| `categoryId` | string |  |  | Required unless type is transfer (transfers use ""). Or pass categoryName → `personalCategories.id` |
| `description` | string | yes |  |  |
| `exchangeRate` | number |  |  | ARS per USD. Filled from `monthlyExchangeRates` for USD transactions when omitted |
| `date` | date | yes |  | Main date field (`dateFrom`/`dateTo`) |
| `creditCardStatementId` | string |  |  | → `creditCardStatements.id` |
| `isFromCreditCard` | boolean |  | `false` |  |
| `sharedWithHousehold` | boolean |  | `false` |  |
| `householdContribution` | number |  |  |  |
| `status` | `pending` \| `completed` \| `cancelled` |  | `"completed"` | Only completed transactions count toward balances |
| `notes` | string |  |  |  |
| `refundOfTransactionId` | string |  |  | Refunds: the purchase being refunded (optional) → `personalTransactions.id` |
| `installmentNumber` | integer |  |  | Installments ("cuotas"): this is installment n (1-based)... |
| `installmentCount` | integer |  |  | ...of N |
| `installmentGroupId` | string |  |  | Same value on every installment of one purchase |
| `originalPurchaseDate` | date |  |  | Date of the original purchase |
| `originalTotalAmount` | number |  |  | Total of the original purchase (all installments) |

For an installment, `amount` is the installment charged on this statement and
`date` is the date it appears on the statement. Keep the purchase itself in
`originalPurchaseDate` and `originalTotalAmount`, and give every installment
of one purchase the same `installmentGroupId`.

#### `creditCardStatements` (id prefix `ccs_`)

Credit card statements (billing periods).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | string |  | key owner |  |
| `walletId` | string | yes |  | → `personalWallets.id` |
| `periodStart` | date | yes |  |  |
| `periodEnd` | date | yes |  | Closing date. Main date field (`dateFrom`/`dateTo`) |
| `dueDate` | date | yes |  |  |
| `totalCharges` | number |  | `0` |  |
| `totalPayments` | number |  | `0` |  |
| `currentBalance` | number |  | `0` |  |
| `minimumPayment` | number |  | `0` |  |
| `currency` | `ARS` \| `USD` |  | `"ARS"` |  |
| `paidAmount` | number |  | `0` |  |
| `paidDate` | date |  |  |  |
| `status` | `open` \| `closed` \| `paid` \| `overdue` |  | `"open"` |  |
| `totalChargesUSD` | number |  |  | USD part of an ARS card statement |
| `totalPaymentsUSD` | number |  |  |  |
| `currentBalanceUSD` | number |  |  |  |
| `minimumPaymentUSD` | number |  |  |  |
| `paidAmountUSD` | number |  |  |  |
| `notes` | string |  |  |  |
| `manualTotals` | boolean |  | `true` | Totals come from the bank's statement; the app never recomputes them. Defaults to true for statements created through the API |

Argentine cards bill ARS and USD on one statement: the main totals are in
`currency`, the `*USD` fields always hold the USD part. Take
`periodStart`, `periodEnd` (closing date) and `dueDate` from **each real
statement**. Banks move closing dates around holidays and weekends, so don't
derive them from the wallet's `closingDay`/`dueDay`.

#### `creditCardPayments` (id prefix `ccp_`)

Payments made towards credit card statements.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | string |  | key owner |  |
| `statementId` | string | yes |  | → `creditCardStatements.id` |
| `fromWalletId` | string | yes |  | → `personalWallets.id` |
| `amount` | number | yes |  |  |
| `currency` | `ARS` \| `USD` |  | `"ARS"` |  |
| `paymentDate` | date | yes |  |  |
| `notes` | string |  |  |  |

#### `personalScheduledPayments` (id prefix `psp_`)

Automatic credit card payment rules.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | string |  | key owner |  |
| `walletId` | string | yes |  | Credit card wallet to pay → `personalWallets.id` |
| `sourceWalletId` | string | yes |  | → `personalWallets.id` |
| `paymentType` | `minimum` \| `full` \| `fixed` | yes |  |  |
| `fixedAmount` | number |  |  | Required when paymentType is 'fixed' |
| `daysBefore` | integer |  | `0` | 0-28 |
| `isActive` | boolean |  | `true` |  |
| `lastProcessedStatementId` | string |  |  |  |

### Meals

#### `meals` (id prefix `mea_`)

Planned meals (meal planner entries).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `title` | string | yes |  |  |
| `description` | string |  |  |  |
| `date` | date | yes |  |  |
| `mealType` | `breakfast` \| `lunch` \| `dinner` \| `snack` | yes |  |  |
| `assignedUserId` | string |  |  | → `users.id` |
| `ingredients` | array |  |  | MealIngredient[]: { id?: "ing_...", savedGroceryItemId: string, amount?: string, usageNotes?: string } |

#### `savedMeals` (id prefix `smea_`)

Meal recipes/templates library.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `description` | string |  |  |  |
| `category` | string | yes |  | Category NAME (not id) → `mealCategories.name` |
| `ingredients` | array |  | `[]` | MealIngredient[] |
| `timesUsed` | integer |  | `0` |  |
| `lastUsed` | date |  |  |  |

#### `mealCategories` (id prefix `mcat_`)

Meal categories (referenced by name from saved meals).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `color` | string |  |  |  |
| `isDefault` | boolean |  | `false` |  |
| `locale` | string |  |  |  |

### Grocery

#### `groceryItems` (id prefix `gri_`)

Current shopping list items.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `category` | string | yes |  | Category NAME (not id). Default categories use translation keys, e.g. "defaultCategories.produce". → `groceryCategories.name` |
| `amount` | string |  | `""` | Free text quantity, e.g. "2 kg" |
| `importance` | `low` \| `medium` \| `high` |  | `"medium"` |  |
| `addedBy` | string |  |  | → `users.id` |

#### `savedGroceryItems` (id prefix `sgi_`)

Grocery item catalogue used for quick-add and meal ingredients.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `category` | string | yes |  | Category NAME (not id) → `groceryCategories.name` |
| `amount` | string |  |  |  |
| `importance` | `low` \| `medium` \| `high` |  |  |  |
| `addedBy` | string |  |  | → `users.id` |
| `timesUsed` | integer |  | `0` |  |
| `lastUsed` | date |  |  |  |

#### `groceryCategories` (id prefix `gcat_`)

Grocery categories (referenced by name from grocery items).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `color` | string |  |  |  |
| `isDefault` | boolean |  | `false` |  |
| `locale` | string |  |  |  |

### Tasks

#### `tasks` (id prefix `tsk_`)

To-do tasks.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `title` | string | yes |  |  |
| `description` | string |  |  |  |
| `assignedUserId` | string |  |  | → `users.id` |
| `dueDate` | date |  |  |  |
| `priority` | `low` \| `medium` \| `high` |  | `"medium"` |  |
| `isCompleted` | boolean |  | `false` |  |
| `category` | string |  |  | Task category ID → `taskCategories.id` |
| `linkedProjectId` | string |  |  | → `homeImprovements.id` |
| `estimatedTime` | object |  |  | { hours: number, minutes: number } |
| `blockedByTaskId` | string |  |  | → `tasks.id` |

#### `taskCategories` (id prefix `tcat_`)

Task categories (referenced by id from tasks.category).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | yes |  |  |
| `color` | string |  |  |  |
| `icon` | string |  |  | Lucide icon name |
| `isDefault` | boolean |  | `false` |  |
| `locale` | string |  |  |  |

### Meal prep

The meal prep planner groups batch cooking around a **plan**. Every other
meal-prep table points back to its plan through `mealPrepPlanId`. Use
`GET /api/v1/tables` for the full field list.

| Table (prefix) | Purpose | Required on create |
|---|---|---|
| `mealPrepPlans` (`mpp_`) | One cooking day covering meals from `startDate` to `endDate`. `status`: `planning` \| `shopping` \| `cooking` \| `completed` (default `planning`). | `name`, `cookingDate`, `startDate`, `endDate`, `numberOfMeals` |
| `mealPrepItems` (`mpi_`) | A meal cooked in the plan. `assignedDays` is a list of ISO dates and `mealTypes` a list of `breakfast` / `lunch` / `dinner` / `snack`. | `mealPrepPlanId`, `mealName` |
| `mealPrepIngredients` (`mpig_`) | Aggregated shopping ingredients for the plan. | `mealPrepPlanId`, `name`, `amount` |
| `mealPrepComponents` (`comp_`) | Modular components (`type`: `protein` \| `carb` \| `vegetable`). | `mealPrepPlanId`, `name`, `type` |
| `mealPrepCombinations` (`mpc_`) | Which components make up each meal slot (`dayIndex` is 0-based). | `mealPrepPlanId`, `dayIndex`, `date`, `mealType` |
| `mealPrepSteps` (`step_`) | Ordered cooking checklist. | `mealPrepPlanId`, `mealPrepItemId`, `stepNumber`, `instruction` |
| `mealPrepContainers` (`cont_`) | Stored portions and when they expire. | `mealPrepPlanId`, `mealPrepItemId`, `containerNumber`, `label`, `expiresAt` |
| `mealPrepSessions` (`mps_`) | Timer/checklist session. | `mealPrepPlanId` |
| `mealPrepSchedules` (`mpsch_`) | AI-optimized cooking order and timeline. | `mealPrepPlanId` |
| `mealPrepRecipes` (`mpr_`) | Recipe details for a saved meal. | `savedMealId`, `instructions` |
| `savedMealComponents` (`smc_`) | Library of reusable components. | `name`, `type` |

The example below loads a plan and its meals in two calls. It gives the plan
an explicit id so the items can reference it:

```bash
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/mealPrepPlans/bulk" -d '{
  "records": [ { "id": "mpp_week45", "name": "Week 45 prep", "cookingDate": "2026-11-08",
                 "startDate": "2026-11-09", "endDate": "2026-11-13", "numberOfMeals": 10, "servingsPerMeal": 2 } ]
}'
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/mealPrepItems/bulk" -d '{
  "records": [
    { "mealPrepPlanId": "mpp_week45", "mealName": "Chicken and rice", "quantity": 6,
      "assignedDays": ["2026-11-09", "2026-11-10", "2026-11-11"], "mealTypes": ["lunch"], "storageType": "refrigerator", "storageDays": 4 },
    { "mealPrepPlanId": "mpp_week45", "mealName": "Lentil stew", "quantity": 4,
      "assignedDays": ["2026-11-12", "2026-11-13"], "mealTypes": ["dinner"], "storageType": "freezer" }
  ]
}'
```

---

## 5. Id prefixes (all tables)

| Module | Tables → id prefix |
|---|---|
| core | `users` → `usr_`, `households` → `household_`, `householdMembers` → `hm_` |
| chores | `chores` → `chr_` |
| grocery | `groceryItems` → `gri_`, `groceryCategories` → `gcat_`, `savedGroceryItems` → `sgi_` |
| tasks | `tasks` → `tsk_`, `taskCategories` → `tcat_` |
| projects | `homeImprovements` → `prj_` |
| meals | `meals` → `mea_`, `mealCategories` → `mcat_`, `savedMeals` → `smea_` |
| reminders | `reminders` → `rem_` |
| planner | `calendarEvents` → `evt_` |
| settings | `homeSettings` → `hst_` |
| keto | `ketoSettings` → `keto_settings_`, `ketoDays` → `keto_`, `ketoWeightEntries` → `weight_`, `ketoBodyMeasurements` → `measurement_`, `ketoWaterEntries` → `water_`, `ketoSymptomEntries` → `symptom_` |
| finance | `monthlyIncomes` → `inc_`, `monthlyExchangeRates` → `exr_`, `recurringExpenses` → `exp_`, `expenseCategories` → `ecat_`, `expensePayments` → `pay_`, `settlementPayments` → `sett_` |
| personalFinance | `personalWallets` → `pw_`, `personalCategories` → `pc_`, `personalTransactions` → `pt_`, `creditCardStatements` → `ccs_`, `creditCardPayments` → `ccp_`, `personalScheduledPayments` → `psp_` |
| documents | `documents` → `doc_`, `documentFolders` → `dfld_`, `documentTags` → `dtag_` |
| maintenance | `maintenanceItems` → `maint_`, `maintenanceTasks` → `task_`, `maintenanceLogs` → `log_` |
| subscriptions | `subscriptions` → `sub_`, `subscriptionPayments` → `sp_` |
| pets | `pets` → `pet_`, `petFeedingSchedules` → `feed_`, `petFeedingLogs` → `feedlog_`, `petMedications` → `med_`, `petMedicationLogs` → `medlog_`, `petVetVisits` → `vet_`, `petVaccinations` → `vax_` |
| savings | `savingsCampaigns` → `sav_`, `savingsMilestones` → `sml_`, `savingsParticipants` → `spt_`, `savingsContributions` → `scn_` |
| mealPrep | `mealPrepPlans` → `mpp_`, `mealPrepItems` → `mpi_`, `mealPrepIngredients` → `mpig_`, `mealPrepRecipes` → `mpr_`, `mealPrepSessions` → `mps_`, `mealPrepSteps` → `step_`, `mealPrepContainers` → `cont_`, `mealPrepSchedules` → `mpsch_`, `mealPrepComponents` → `comp_`, `mealPrepCombinations` → `mpc_`, `savedMealComponents` → `smc_` |
| activity | `activityLogs` → `act_` |

---

## 6. Examples

```bash
export DOMUS=https://domus.example.com
export KEY=domus_sk_...            # from Settings → API keys
H=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json")
```

### Discover tables and existing categories

```bash
curl -s "${H[@]}" "$DOMUS/api/v1/tables" | jq '.tables[] | {name, idPrefix}'
curl -s "${H[@]}" "$DOMUS/api/v1/expenseCategories" | jq '.data[] | {id, name}'
curl -s "${H[@]}" "$DOMUS/api/v1/personalCategories?limit=500" | jq '.data[] | {id, name, type}'
```

### Household finance: exchange rate, services and monthly values

```bash
# USD→ARS rate for November 2026
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/monthlyExchangeRates/bulk" -d '{
  "records": [ { "id": "exr_2026_11", "rate": 1450, "month": 11, "year": 2026 } ]
}'

# Recurring services (category = expenseCategories id from the listing above)
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/recurringExpenses/bulk" -d '{
  "records": [
    { "id": "exp_rent",  "name": "Rent",        "amount": 650000, "currency": "ARS", "category": "ecat_...", "dueDay": 10 },
    { "id": "exp_power", "name": "Electricity", "amount": 42000,  "currency": "ARS", "category": "ecat_...", "dueDay": 15 }
  ]
}'

# Value/status of each service for a given month
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/expensePayments/bulk" -d '{
  "records": [
    { "id": "pay_rent_2026_11",  "recurringExpenseId": "exp_rent",  "amount": 650000, "currency": "ARS",
      "month": 11, "year": 2026, "dueDate": "2026-11-10", "status": "paid", "paidDate": "2026-11-08" },
    { "id": "pay_power_2026_11", "recurringExpenseId": "exp_power", "amount": 45800, "currency": "ARS",
      "month": 11, "year": 2026, "dueDate": "2026-11-15" }
  ]
}'

# Monthly income per person (userId = a record of the "users" table)
curl -s "${H[@]}" "$DOMUS/api/v1/users" | jq '.data[] | {id, name}'
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/monthlyIncomes/bulk" -d '{
  "records": [
    { "id": "inc_ana_2026_11", "userId": "usr_...", "amount": 1800, "currency": "USD", "source": "Salary", "month": 11, "year": 2026 }
  ]
}'
```

### Personal finance: wallets, categories, expenses and income

```bash
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/personalWallets/bulk" -d '{
  "records": [
    { "id": "pw_cash", "name": "Cash", "type": "physical", "currency": "ARS", "balance": 120000 },
    { "id": "pw_visa", "name": "Visa", "type": "credit_card", "currency": "ARS", "creditLimit": 2000000, "closingDay": 25, "dueDay": 10 }
  ]
}'

curl -s "${H[@]}" -X POST "$DOMUS/api/v1/personalCategories/bulk" -d '{
  "records": [
    { "id": "pc_food",   "name": "Food",   "type": "expense", "icon": "UtensilsCrossed", "color": "#f97316" },
    { "id": "pc_salary", "name": "Salary", "type": "income",  "icon": "Briefcase",       "color": "#22c55e" }
  ]
}'

# Transactions can reference wallets/categories by name
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/personalTransactions/bulk" -d '{
  "records": [
    { "id": "pt_import_0001", "type": "expense", "amount": 18350, "currency": "ARS", "date": "2026-11-02",
      "walletName": "Cash", "categoryName": "Food", "description": "Supermarket" },
    { "id": "pt_import_0002", "type": "income", "amount": 1800, "currency": "USD", "date": "2026-11-01",
      "walletName": "Cash", "categoryName": "Salary", "description": "November salary" }
  ]
}' | jq '.summary, (.results[] | select(.status == "error"))'

# Bring the stored wallet balances up to date
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/personalWallets/pw_cash/recalculate"
```

### Personal finance: loading a credit card statement

The recommended order for loading a card statement (for example, one PDF
per month):

1. **Wallet.** Create the card once (`type: "credit_card"`). Set
   `openingBalance` and `openingBalanceDate` if you are not loading its full
   history.
2. **Statement.** One `creditCardStatements` record per real statement,
   with the dates printed **on that statement** (`periodStart`, `periodEnd`
   = closing date, `dueDate`) and the bank's totals (`totalCharges`,
   `currentBalance`, `minimumPayment`, plus the `*USD` fields for the USD
   part). `manualTotals` defaults to `true`, so the app keeps the bank's
   figures.
3. **Transactions.** Every line of the statement as a `personalTransactions`
   record with `creditCardStatementId` set to that statement. Use type
   `refund` for credits and bonuses, and the installment fields for
   "cuotas". USD lines keep `currency: "USD"`: with no `exchangeRate` the
   month's `monthlyExchangeRates` rate is filled in, and without one they
   stay out of the ARS balance and belong to the statement's USD totals.
4. **Recalculate** the card's balance: `?recalculateBalances=true` on the
   transactions bulk request, or `POST .../recalculate`.

Send each step with `?dryRun=true` first, then without it. Stamp everything
with one `importBatchId` so a wrong load can be undone in one call.

```bash
BATCH=visa-2026-10

# 1. Card (once)
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/personalWallets/bulk" -d '{
  "records": [ { "id": "pw_visa", "name": "Visa", "type": "credit_card", "currency": "ARS",
                 "creditLimit": 2000000, "closingDay": 23, "dueDay": 10,
                 "openingBalance": 0, "openingBalanceDate": "2026-09-26" } ]
}'

# 2. Statement, with the dates and totals printed on it
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/creditCardStatements/bulk?importBatchId=$BATCH" -d '{
  "records": [ { "id": "ccs_pw_visa_2026-10", "walletId": "pw_visa",
                 "periodStart": "2026-09-26", "periodEnd": "2026-10-23", "dueDate": "2026-11-04",
                 "currency": "ARS", "totalCharges": 412830.5, "currentBalance": 412530.5, "minimumPayment": 41250,
                 "totalChargesUSD": 35.99, "currentBalanceUSD": 35.99, "status": "closed" } ]
}'

# 3. Lines of the statement: dry run first, then for real with recalculation
LINES='{ "records": [
  { "id": "pt_visa_2026-10_001", "type": "expense", "amount": 18350, "date": "2026-10-02",
    "walletId": "pw_visa", "categoryName": "Food", "description": "Supermarket",
    "creditCardStatementId": "ccs_pw_visa_2026-10" },
  { "id": "pt_visa_2026-10_002", "type": "expense", "amount": 50000, "date": "2026-10-05",
    "walletId": "pw_visa", "categoryName": "Home", "description": "Fridge 2/6",
    "installmentNumber": 2, "installmentCount": 6, "installmentGroupId": "fridge-2026-09",
    "originalPurchaseDate": "2026-09-05", "originalTotalAmount": 300000,
    "creditCardStatementId": "ccs_pw_visa_2026-10" },
  { "id": "pt_visa_2026-10_003", "type": "refund", "amount": 300, "date": "2026-10-20",
    "walletId": "pw_visa", "categoryName": "Food", "description": "Promo credit",
    "creditCardStatementId": "ccs_pw_visa_2026-10" },
  { "id": "pt_visa_2026-10_004", "type": "expense", "amount": 35.99, "currency": "USD", "date": "2026-10-12",
    "walletId": "pw_visa", "categoryName": "Subscriptions", "description": "Streaming",
    "creditCardStatementId": "ccs_pw_visa_2026-10" }
] }'
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/personalTransactions/bulk?importBatchId=$BATCH&recalculateBalances=true&dryRun=true" -d "$LINES" \
  | jq '.summary, .balances, (.results[] | select(.status == "error" or .warnings))'
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/personalTransactions/bulk?importBatchId=$BATCH&recalculateBalances=true" -d "$LINES"

# Check what is on the statement
curl -s "${H[@]}" "$DOMUS/api/v1/personalTransactions?creditCardStatementId=ccs_pw_visa_2026-10&limit=500" | jq '.count'

# Wrong load? Undo it completely
curl -s "${H[@]}" "$DOMUS/api/v1/import-batches/$BATCH"
curl -s "${H[@]}" -X DELETE "$DOMUS/api/v1/import-batches/$BATCH?recalculateBalances=true"
```

### Meals: recipes and the weekly plan

```bash
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/savedMeals/bulk" -d '{
  "records": [
    { "id": "smea_lasagna", "name": "Lasagna", "category": "defaultMealCategories.pasta", "ingredients": [] }
  ]
}'

curl -s "${H[@]}" -X POST "$DOMUS/api/v1/meals/bulk" -d '{
  "records": [
    { "title": "Lasagna",       "date": "2026-11-04", "mealType": "dinner" },
    { "title": "Caesar salad",  "date": "2026-11-05", "mealType": "lunch", "description": "No croutons" }
  ]
}'
```

### Grocery list and tasks

```bash
curl -s "${H[@]}" -X POST "$DOMUS/api/v1/groceryItems/bulk" -d '{
  "records": [
    { "name": "Milk", "category": "defaultCategories.dairy", "amount": "2 l", "importance": "high" },
    { "name": "Apples", "category": "defaultCategories.produce", "amount": "1 kg" }
  ]
}'

curl -s "${H[@]}" -X POST "$DOMUS/api/v1/tasks/bulk" -d '{
  "records": [ { "title": "Renew car insurance", "dueDate": "2026-11-20", "priority": "high" } ]
}'
```

### Edit, delete, and page through everything

```bash
curl -s "${H[@]}" -X PATCH  "$DOMUS/api/v1/tasks/tsk_..." -d '{ "isCompleted": true }'
curl -s "${H[@]}" -X DELETE "$DOMUS/api/v1/groceryItems/gri_..."

# Fetch all transactions, page by page
cursor=""
while :; do
  page=$(curl -s "${H[@]}" "$DOMUS/api/v1/personalTransactions?limit=500${cursor:+&cursor=$cursor}")
  echo "$page" | jq -c '.data[]'
  cursor=$(echo "$page" | jq -r '.nextCursor // empty')
  [ -z "$cursor" ] && break
done
```

---

## 7. Tips for agents

1. Call `GET /api/v1/me` to confirm the household and scopes, then
   `GET /api/v1/tables` once and use it as the schema.
2. List the category and wallet tables before writing records that reference
   them.
3. Use deterministic ids, such as `pt_<source>_<row>`, so a retried load
   updates records instead of duplicating them.
4. Send batches of up to 500 records. Check `summary.error` and fix only the
   failed indexes. A failed record never blocks the rest of the batch.
5. Treat `warnings` about unknown fields as likely typos, and read the
   exchange-rate warnings on USD transactions.
6. Run big loads with `?dryRun=true` first and stamp them with
   `?importBatchId=...`, so a mistake can be undone with one
   `DELETE /api/v1/import-batches/{batchId}`.
7. After loading transactions, recalculate the wallets
   (`?recalculateBalances=true`). Never PATCH a computed balance by hand.
8. Use list filters (`?walletId=...&dateFrom=...`) instead of downloading
   whole tables to check what is already stored.
9. Stay below 120 requests per minute per key. On a 429, wait for
   `Retry-After` seconds before retrying.
