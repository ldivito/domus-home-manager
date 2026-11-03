# Deployment and environment

## How the server reaches its storage

`src/lib/cloudflare.ts` picks a backend at request time:

| Situation | D1 / KV access |
|---|---|
| Running on Cloudflare (bindings `domus_db`, `KV` present) | Native bindings |
| `CLOUDFLARE_ACCOUNT_ID` + `DATABASE_ID` + `CLOUDFLARE_API_TOKEN` set (Vercel, localhost) | Cloudflare REST API |
| None of the above | In-memory fallback: fine for UI work, sync data is lost on restart |

The app can therefore be hosted on Vercel (the repo has `next.config.vercel.ts` and `vercel-check.sh`, and Vercel has opened security PRs against it) or on Cloudflare Pages. In both cases the data lives in the same D1 database.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | **Yes in production** (the server refuses to start without it) | Signs session tokens. Use a long random string. |
| `CLOUDFLARE_ACCOUNT_ID` | When not on Cloudflare | Account for the REST API |
| `DATABASE_ID` | When not on Cloudflare | D1 database id (see `wrangler.toml`) |
| `KV_NAMESPACE_ID` | When not on Cloudflare | KV namespace id (see `wrangler.toml`) |
| `CLOUDFLARE_API_TOKEN` | When not on Cloudflare | Token with **Account → D1 → Edit** and **Account → Workers KV Storage → Edit** |

Put them in `.env.local` for development and in the hosting provider's dashboard for production. Never commit tokens.

The OpenAI key used by the meal prep planner is **not** a server variable. Each user enters their own in the planner UI. It is stored in that browser and relayed per request.

## One-time Cloudflare setup

```bash
npm i -g wrangler && wrangler login

wrangler d1 create domus-db                 # put the id in wrangler.toml → database_id
wrangler kv namespace create KV             # put the id in wrangler.toml → kv_namespaces.id
wrangler d1 execute domus-db --remote --file=schema.sql
```

Apply any later migrations the same way (`--file=<migration>.sql`).

## Deploying

**Vercel:** connect the GitHub repo, set the variables above (including the REST API trio), deploy. Run `./vercel-check.sh` locally first for a stricter pre-flight (strict tsc, zero-warning lint, build).

**Cloudflare Pages:**
```bash
npm run build
npx wrangler pages deploy .next --project-name=domus-app
```
Then set `JWT_SECRET` and `NODE_ENV=production` under *Workers & Pages → domus-app → Settings → Environment variables*.

## Local development against real D1

1. Create an API token with the two permissions above.
2. Add the four Cloudflare variables to `.env.local` and restart `npm run dev`.
3. The server log should say `[Cloudflare] Using D1 REST API for localhost`. If it says `in-memory`, a variable is missing.

Inspect data:
```bash
wrangler d1 execute domus-db --remote --command "SELECT tableName, COUNT(*) FROM sync_metadata GROUP BY tableName"
```

## Cost

A household of 2–4 people stays well within the free tiers of D1 (5 GB, 5M reads/day, 100k writes/day), KV and Pages/Vercel hobby.
