# Domus — Home Management App

Domus is a tablet-first, offline-first home management app built with Next.js. Every household member's data lives in the browser (IndexedDB) and syncs between devices and household members through a small server API backed by Cloudflare D1.

## Modules

| Area | Module | Route |
|---|---|---|
| Home | Dashboard, activity feed | `/`, `/activity` |
| Household | Chores, tasks (with categories), home projects (kanban), reminders, planner/calendar | `/chores`, `/tasks`, `/projects`, `/reminders`, `/planner` |
| Food | Grocery list, meal planner, saved meals, AI meal prep planner | `/grocery`, `/meals`, `/meals/meal-prep` |
| Money | Household finance (incomes, recurring expenses with per-month values, settlements), personal finance (wallets, categories, transactions, credit cards, analytics), savings campaigns, subscriptions | `/finance`, `/personal-finance`, `/savings`, `/subscriptions` |
| Health | Keto tracker (per person: days, weight, measurements, water, symptoms) | `/keto` |
| Home care | Maintenance scheduler, pets (feeding, meds, vet visits, vaccines), document vault | `/maintenance`, `/pets`, `/documents` |
| Admin | Users, households and invites, settings, login | `/users`, `/settings`, `/auth` |

UI is available in English and Spanish (`messages/en`, `messages/es`, via `next-intl`).

## Tech stack

- **Next.js 15** (App Router) + **React 19** + TypeScript
- **Tailwind CSS** + shadcn/ui (Radix) + Lucide icons
- **Dexie** (IndexedDB) for local, offline-first storage
- **Cloudflare D1** (sync store, users, households) and **KV** (sessions, rate limits)
- **zod** for server-side payload validation
- **vitest** + fake-indexeddb + Testing Library for tests

## Getting started

```bash
npm install
# optional: create .env.local with the variables in docs/DEPLOYMENT.md
npm run dev
```

Without Cloudflare credentials the API falls back to an in-memory D1/KV, so the app runs fully locally (sync data is lost when the server restarts).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | All tests (vitest) |
| `npm run test:finance` | Finance utility tests only |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next config) |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data model, offline storage, how sync works, conflict rules, adding a module
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Cloudflare D1/KV setup, environment variables, deploying, local dev against real D1
- [docs/API.md](docs/API.md) — API-key data API for bulk loading and editing data (e.g. from other agents)
- [docs/PERSONAL_FINANCE.md](docs/PERSONAL_FINANCE.md) — personal finance module: data model, credit card logic, file map
- [docs/history/](docs/history/) — past design specs and implementation plans

## Project structure

```
src/
├── app/
│   ├── [locale]/          # One folder per module (pages + module components)
│   └── api/               # auth, households, sync (push/pull), finance, meal-prep
├── components/            # Shared components; ui/ holds shadcn primitives
├── contexts/              # Auth, sync and other React contexts
├── hooks/
├── lib/
│   ├── db.ts              # Dexie schema, interfaces, default seeds, sync hooks
│   ├── sync.ts            # Client sync engine (push, pull, apply)
│   ├── dedupe.ts          # Merges duplicated records after sync
│   ├── auth.ts            # JWT sessions
│   ├── cloudflare.ts      # D1/KV access (binding, REST API or in-memory)
│   └── utils/finance/     # Balance, credit card and monthly value logic
└── test/                  # Test setup and mocks
messages/                  # i18n strings (en, es)
schema.sql                 # D1 schema
```

## Design principles

- **Tablet-first**: built for 10–12" touchscreens, touch targets of at least 44px
- **Offline-first**: every read and write hits IndexedDB; the network is only used to sync
- **Household sharing**: members of a household see and edit the same data
