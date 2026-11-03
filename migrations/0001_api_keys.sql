-- Migration 0001: API keys for the agent data API
-- Apply with: wrangler d1 migrations apply domus-db --remote
-- (or: wrangler d1 execute domus-db --remote --file=migrations/0001_api_keys.sql)

-- API keys for the agent data API (/api/v1). Only a SHA-256 hash of the key
-- is stored; keyPrefix is a short non-secret lookup/display prefix.
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  householdId TEXT,          -- NULL/empty: key is scoped to the user's personal data
  name TEXT NOT NULL,
  keyPrefix TEXT NOT NULL,
  keyHash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,      -- comma-separated: read,write
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastUsedAt DATETIME,
  revokedAt DATETIME,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(keyPrefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(userId);
-- Speeds up per-table reads of the data API
CREATE INDEX IF NOT EXISTS idx_sync_scope_table ON sync_metadata(householdId, tableName, recordId);
CREATE INDEX IF NOT EXISTS idx_sync_user_table ON sync_metadata(userId, tableName, recordId);
