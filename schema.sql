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
  operation TEXT NOT NULL,
  data TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt DATETIME
);

-- Indexes for performance
CREATE INDEX idx_sync_user ON sync_metadata(userId);
CREATE INDEX idx_sync_household ON sync_metadata(householdId);
CREATE INDEX idx_sync_updated ON sync_metadata(updatedAt);
