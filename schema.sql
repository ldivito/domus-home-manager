-- Households table
CREATE TABLE households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  ownerId TEXT NOT NULL,
  inviteCode TEXT UNIQUE NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  householdId TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (householdId) REFERENCES households(id)
);

-- Household members table
CREATE TABLE household_members (
  id TEXT PRIMARY KEY,
  householdId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
  joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  canManageMembers INTEGER DEFAULT 0,
  canManageSettings INTEGER DEFAULT 0,
  canDeleteItems INTEGER DEFAULT 1,
  FOREIGN KEY (householdId) REFERENCES households(id),
  FOREIGN KEY (userId) REFERENCES users(id),
  UNIQUE(householdId, userId)
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
CREATE INDEX idx_households_invite ON households(inviteCode);
CREATE INDEX idx_households_owner ON households(ownerId);
CREATE INDEX idx_users_household ON users(householdId);
CREATE INDEX idx_household_members_household ON household_members(householdId);
CREATE INDEX idx_household_members_user ON household_members(userId);
CREATE INDEX idx_sync_user ON sync_metadata(userId);
CREATE INDEX idx_sync_household ON sync_metadata(householdId);
CREATE INDEX idx_sync_updated ON sync_metadata(updatedAt);
