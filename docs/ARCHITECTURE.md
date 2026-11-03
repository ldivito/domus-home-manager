# Architecture

## Overview

Domus is offline-first. Every page reads and writes a local IndexedDB database (Dexie, `src/lib/db.ts`). The server stores no domain tables of its own. It keeps a per-household log of the latest version of every record (`sync_metadata` in Cloudflare D1), and devices exchange changes through it.

```
 Device A (IndexedDB) ──push──▶  /api/sync/push  ──▶  D1 sync_metadata  ◀──  /api/sync/pull ◀──pull── Device B (IndexedDB)
```

Server-side tables of their own are only `users`, `households`, `household_members` and `sync_metadata` (see `schema.sql`). Sessions and rate-limit counters live in KV.

## Local database (`src/lib/db.ts`)

- One `DomusDatabase` (Dexie) with every module's tables, TypeScript interfaces next to them.
- **Schema versions:** each `this.version(n).stores({...})` block declares only the tables it adds or changes. Re-declaring an existing table without all its indexes drops those indexes. Always add a new, higher version number (the latest is v35, the meal prep tables).
- **IDs** are strings with a module prefix, created with `generateId(prefix)` from `src/lib/utils.ts` (e.g. `gri_…` grocery item, `ptx_…` personal transaction).
- **Default seeds:** grocery, meal, task, expense and personal finance categories are seeded on first open. They use **deterministic ids** (`gcat_default_produce`, `pc_default_<userId>_bills-utilities`) and a fixed 2020 timestamp. Every device therefore seeds the *same* records, and a re-seed never overrides a real edit or deletion.
- **References:** grocery items, saved grocery items and meals reference their category by **name**. Tasks (`category`), recurring expenses (`category`) and personal transactions (`categoryId`) reference by **id**. Meal ingredients reference saved grocery items by `savedGroceryItemId`.

## Sync

Client engine: `src/lib/sync.ts`. Server: `src/app/api/sync/push` and `src/app/api/sync/pull`.

### When it runs
`SyncContext` (`src/contexts/SyncContext.tsx`) syncs:
- 3 seconds after the last local change (Dexie hooks emit `sync-needed`)
- every 5 minutes
- on login / auth change, and manually from the UI

### One sync cycle
1. **Collect:** every record in the syncable tables whose `updatedAt` (or `createdAt`) is newer than the last sync watermark, plus queued deletions from `deletionLog`.
2. **Push** in chunks of 100. The server upserts one row per record (`sync_<scope>_<table>_<recordId>`) and only replaces it when the incoming `updatedAt` is newer (**last-writer-wins**).
3. **Pull** pages of 500 rows whose server receive time (`createdAt`) is newer than the watermark, resumable through a cursor checkpoint.
4. **Apply** with hooks muted, so pulled data isn't re-stamped or re-pushed. A remote record wins only if it is newer than the local copy. A tombstone deletes the local copy unless the local edit is newer than the deletion.
5. **Store the watermark.** This is the time the sync *started*, so edits made during the sync are pushed next time.
6. **Deduplicate** (`src/lib/dedupe.ts`): duplicated categories, saved grocery items, saved meals and home settings are merged. The kept record is chosen deterministically (stable default id, then oldest, then smallest id), so all devices agree. Id references are repointed and the removed copies are tombstoned, so the cleanup propagates.

### Rules for code that writes data
- Delete with `deleteWithSync` / `bulkDeleteWithSync`. A plain `table.delete()` is not propagated to other devices.
- Local edits get `updatedAt` stamped automatically by the `updating` hook.
- A new syncable table must be added in **three** lists: `SYNC_TABLES` (`src/lib/sync.ts`), `SYNCABLE_TABLES` (`src/lib/db.ts`) and the server whitelist in `src/app/api/sync/push/route.ts`. Optionally add a payload schema in `src/app/api/sync/table-schemas.ts`.
- Never seed data with random ids on startup. Use deterministic ids so independent devices converge.

### Scope
Records are scoped to the user's household (or to the user when they have no household). Pull only returns rows of that scope.

## Auth

Email + password accounts (`src/app/api/auth`), JWT sessions in an httpOnly cookie (`src/lib/auth.ts`), with login and registration rate limits. Households have invite codes (`src/app/api/households`).

## Adding a module

1. Interfaces and a new Dexie version in `src/lib/db.ts`.
2. Register the tables for sync (see above).
3. Page under `src/app/[locale]/<module>/`, plus a navigation entry in `src/components/Navigation.tsx`.
4. Strings in `messages/en` and `messages/es` (register the namespace in each `index.ts`).
5. Tests next to the code in `__tests__/`.
