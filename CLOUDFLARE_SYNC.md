# Cloudflare Sync Architecture

## Overview
Domus uses a hybrid local-first + Cloudflare sync approach. All data is stored locally in IndexedDB and optionally synced to Cloudflare for multi-device access.

## Architecture Components

### 1. Local Storage (IndexedDB via Dexie)
- Primary data store
- All operations happen locally first
- Instant performance, works offline
- Tracks last sync timestamp per table

### 2. Cloudflare Services

#### Cloudflare D1 (SQLite Database)
- Stores synced data from all users
- Schema mirrors IndexedDB structure
- Includes metadata: `userId`, `householdId`, `updatedAt`, `deletedAt`

#### Cloudflare Workers (via Next.js API Routes)
- `/api/auth/login` - Email/password authentication
- `/api/auth/register` - User registration
- `/api/sync/push` - Push local changes to cloud
- `/api/sync/pull` - Pull cloud changes to local
- `/api/sync/full` - Bi-directional sync

#### Cloudflare KV
- Session tokens (JWT)
- User metadata
- Rate limiting

## Data Flow

### Sync Process
1. **Local Changes**: User makes changes → saved to IndexedDB immediately
2. **Manual Sync**: User clicks sync button
3. **Push Phase**:
   - Collect all records modified since last sync
   - Send delta to `/api/sync/push`
   - Server validates and stores in D1
4. **Pull Phase**:
   - Request changes from server since last sync
   - Merge into local IndexedDB
   - Resolve conflicts (last-write-wins)
5. **Update Sync Timestamp**: Record successful sync time

### Conflict Resolution
- **Strategy**: Last-write-wins based on `updatedAt` timestamp
- **Deleted Records**: Soft deletes with `deletedAt` field
- **Field-level**: If needed, we can implement per-field timestamps

## Security

### Authentication
- Email/password with bcrypt hashing
- JWT tokens stored in Cloudflare KV
- HTTP-only cookies for session management

### Authorization
- Users only access their household data
- Row-level security via `householdId` filtering
- API validates user permissions on every request

## Database Schema

### Cloud Schema Additions
Every synced table includes:
- `id` - Primary key (matches local ID)
- `householdId` - Tenant isolation
- `userId` - Record owner (for user-specific tables)
- `createdAt` - Creation timestamp
- `updatedAt` - Last modification timestamp
- `deletedAt` - Soft delete timestamp (NULL if not deleted)
- `syncedAt` - Last successful sync timestamp

### Sync Metadata Table
```sql
CREATE TABLE sync_metadata (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  householdId TEXT NOT NULL,
  tableName TEXT NOT NULL,
  lastPullAt DATETIME,
  lastPushAt DATETIME,
  lastSyncAt DATETIME,
  conflictCount INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Phases

### Phase 1: Authentication
- User registration and login
- Session management
- JWT token handling

### Phase 2: Sync Infrastructure
- API routes for push/pull
- D1 schema creation
- Sync service layer

### Phase 3: UI Components
- Sync status indicator
- Manual sync button
- Sync settings

### Phase 4: Optimization
- Background sync
- Conflict detection UI
- Sync progress indicators

## Environment Variables

```bash
# Cloudflare D1 Database
DATABASE_ID=your_d1_database_id

# Cloudflare KV Namespace
KV_NAMESPACE_ID=your_kv_namespace_id

# Authentication
JWT_SECRET=your_jwt_secret_key
SESSION_DURATION=7d

# API Configuration
API_BASE_URL=https://your-app.pages.dev
```

## Deployment

### Prerequisites
1. Cloudflare account with Pages and D1 enabled
2. Wrangler CLI installed
3. D1 database created
4. KV namespace created

### Deployment Steps
```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create domus-db

# Create KV namespace
wrangler kv:namespace create domus-kv

# Deploy to Cloudflare Pages
npm run build
wrangler pages deploy
```
