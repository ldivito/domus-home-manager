# Personal finance module

Per-user money tracking, separate from the shared household finance page (`/finance`). Route: `/personal-finance` (dashboard, `wallets`, `categories`, `transactions`, `analytics`, `settings`).

Originally built in six phases (database → wallets/categories → transactions → credit cards → analytics → integration). The phase-by-phase notes were replaced by this document and remain in git history.

## Data model (`src/lib/db.ts`, all synced)

| Table | Key fields | Notes |
|---|---|---|
| `personalWallets` | `userId`, `type` (`physical` \| `bank` \| `credit_card`), `currency` (`ARS` \| `USD`), `balance`, `creditLimit`, `closingDay`, `dueDay` | Credit cards carry no balance of their own; their debt lives in statements |
| `personalCategories` | `userId`, `type` (`income` \| `expense`), `name`, `isDefault`, `isActive` | 15 defaults seeded per user with ids `pc_default_<userId>_<slug>` |
| `personalTransactions` | `userId`, `type` (`income` \| `expense` \| `transfer`), `amount` (always positive), `currency`, `walletId`, `targetWalletId`, `categoryId`, `date`, `status` | Transfers move money between two wallets; `exchangeRate` for cross-currency |
| `creditCardStatements` | `walletId`, `periodStart`, `periodEnd`, `dueDate`, `totalCharges`, `totalPayments`, `currentBalance`, `minimumPayment`, `paidAmount`, `status` (`open` \| `closed` \| `paid` \| `overdue`) | One open statement per card at a time |
| `creditCardPayments` | `statementId`, `fromWalletId`, `amount`, `paymentDate` | Paying a card debits the source wallet |
| `personalScheduledPayments` | `walletId` (card), `sourceWalletId`, `paymentType` (`minimum` \| `full` \| `fixed`), `daysBefore`, `lastProcessedStatementId` | Automatic card payments, at most one per statement |

## Logic (`src/lib/utils/finance/`)

- `balance-operations.ts` — applies and reverts a transaction's effect on wallet balances (create, edit, delete, transfers)
- `credit-card-statements.ts` — opens the current statement, closes it on the card's closing day, computes due date and minimum payment
- `credit-card-payments.ts` — pays a statement (partial or full), updates statement and source wallet
- `credit-card-heartbeat.ts` — daily routine (automatic statement closings, notifications, consistency checks). **Not called anywhere in the app yet**, see limitations
- `credit-card-notifications.ts` — upcoming and overdue due-date alerts
- `monthlyValues.ts` — per-month values for household recurring expenses (used by `/finance`)
- `validators.ts`, `formatters.ts`, `helpers.ts`, `current-user.ts`

Tests: `src/lib/utils/finance/__tests__/` and `src/app/[locale]/personal-finance/__tests__/` (`npm run test:finance`).

## Household integration

The household finance page (`/finance`) and personal finance settings can hide amounts (privacy toggle). Everything supports ARS and USD.

## Known limitations

- Exchange rates are entered manually (`monthlyExchangeRates`); there is no automatic fetching.
- **Statement auto-closing is not wired up.** `runCreditCardHeartbeat` / `processAutomaticStatementClosings` exist and are tested, but no page or context calls them, so statements only change when code paths that use them run.
- **Scheduled card payments are saved but never executed.** `scheduleAutomaticPayment` stores a `personalScheduledPayments` row, but nothing processes it (`lastProcessedStatementId` is never written).
- `ShareIncomeDialog` (share personal income with the household) is implemented but not mounted on any page.
