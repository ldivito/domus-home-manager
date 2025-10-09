# Cloudflare Setup Guide for Domus

This guide walks you through setting up the Cloudflare services needed for Domus sync.

## Prerequisites

1. **Cloudflare Account** (free tier works fine)
   - Sign up at https://dash.cloudflare.com/sign-up

2. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

3. **Login to Cloudflare**
   ```bash
   wrangler login
   # Opens browser for authentication
   ```

---

## Step 1: Create D1 Database

D1 is Cloudflare's SQLite database - this will store your synced data.

```bash
# Create the database
wrangler d1 create domus-db
```

**Save the output!** You'll get something like:
```
✅ Successfully created DB 'domus-db'
database_id = "abc123def456ghi789jkl012"
```

**Copy that `database_id`** - you'll need it later.

### Create the Database Schema

Create a file called `schema.sql`:

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  householdId TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sync metadata table
CREATE TABLE sync_metadata (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  householdId TEXT NOT NULL,
  tableName TEXT NOT NULL,
  recordId TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'insert', 'update', 'delete'
  data TEXT, -- JSON blob of the record
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt DATETIME
);

CREATE INDEX idx_sync_user ON sync_metadata(userId);
CREATE INDEX idx_sync_household ON sync_metadata(householdId);
CREATE INDEX idx_sync_updated ON sync_metadata(updatedAt);
```

Apply the schema:
```bash
wrangler d1 execute domus_db --file=schema.sql
```

---

## Step 2: Create KV Namespace

KV stores session tokens and user metadata.

```bash
# Create the namespace
wrangler kv:namespace create domus-sessions
```

**Save the output!** You'll get:
```
✅ Created namespace with title "domus-sessions"
id = "xyz789abc123def456ghi012"
```

**Copy that `id`** - you'll need it.

---

## Step 3: Configure Wrangler

Create a `wrangler.toml` file in your project root:

```toml
name = "domus-app"
compatibility_date = "2024-01-01"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "domus-db"
database_id = "YOUR_DATABASE_ID_FROM_STEP_1"

# KV Namespace binding
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID_FROM_STEP_2"
```

Replace the placeholder IDs with your actual IDs from steps 1 and 2.

---

## Step 4: Update Environment Variables

Add these to your `.env.local` (already has placeholders):

```bash
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
DATABASE_ID=your_d1_database_id_from_step_1
KV_NAMESPACE_ID=your_kv_id_from_step_2

# JWT Secret (CHANGE THIS!)
JWT_SECRET=generate_a_random_32_character_string_here
```

**To find your Account ID:**
1. Go to https://dash.cloudflare.com
2. Click on "Workers & Pages" in the sidebar
3. Your Account ID is shown in the right sidebar

**To generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 5: Update Code to Use D1/KV

Currently, the API routes use in-memory storage. You'll need to update them to use D1/KV.

### Update `src/app/api/sync/push/route.ts`

Replace the in-memory Map with D1:

```typescript
export async function POST(request: Request) {
  const session = await getUserFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { changes } = await request.json()

  // Get D1 database binding (available in Cloudflare Workers/Pages)
  const db = process.env.DB as any

  // Insert changes into D1
  for (const change of changes) {
    await db.prepare(`
      INSERT OR REPLACE INTO sync_metadata
      (id, userId, householdId, tableName, recordId, operation, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      session.userId,
      session.householdId,
      change.tableName,
      change.id,
      change.operation,
      JSON.stringify(change.data),
      change.updatedAt
    ).run()
  }

  return NextResponse.json({ success: true, count: changes.length })
}
```

Similar updates needed for:
- `src/app/api/sync/pull/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`

---

## Step 6: Deploy to Cloudflare Pages

```bash
# Build your app
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy .next --project-name=domus-app
```

**First time setup:**
- Wrangler will ask you to create a new project
- Name it `domus-app` (or whatever you prefer)
- It will deploy and give you a URL like `https://domus-app.pages.dev`

---

## Step 7: Configure Production Environment Variables

After deployment, set environment variables in Cloudflare Dashboard:

1. Go to https://dash.cloudflare.com
2. Click "Workers & Pages"
3. Find your "domus-app" project
4. Go to "Settings" → "Environment Variables"
5. Add:
   - `JWT_SECRET` = your secure random string
   - `NODE_ENV` = `production`

---

## Testing Your Setup

1. **Local Testing** (currently working):
   ```bash
   npm run dev
   # App runs on http://localhost:3000
   # Uses in-memory storage
   ```

2. **Production Testing** (after deployment):
   - Visit your Cloudflare Pages URL
   - Try registering a user
   - Make changes to data
   - Click the sync button
   - Check Cloudflare D1 dashboard to see synced data

---

## Estimated Costs

With normal household use (2-4 users), everything should stay in free tier:

- **D1**: 5GB storage, 5M reads/day, 100k writes/day (FREE)
- **KV**: 100k reads/day, 1k writes/day (FREE)
- **Pages**: Unlimited requests (FREE)
- **Workers**: 100k requests/day (FREE)

---

## Next Steps

1. Complete Steps 1-4 to get your Cloudflare resources set up
2. Test locally with in-memory storage (current setup)
3. When ready for production:
   - Update API routes to use D1/KV (Step 5)
   - Deploy to Cloudflare Pages (Step 6)
   - Configure environment variables (Step 7)

---

## Need Help?

- **D1 Docs**: https://developers.cloudflare.com/d1
- **KV Docs**: https://developers.cloudflare.com/kv
- **Pages Docs**: https://developers.cloudflare.com/pages
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler
