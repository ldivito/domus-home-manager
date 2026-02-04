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
  householdId TEXT,  -- Nullable: users can register without joining a household
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

-- Bills table (servicios del hogar)
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  householdId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  category TEXT NOT NULL,
  dueDate TEXT NOT NULL, -- ISO date string
  isRecurring INTEGER DEFAULT 1,
  recurringPeriod TEXT CHECK(recurringPeriod IN ('monthly', 'weekly', 'yearly')) DEFAULT 'monthly',
  status TEXT NOT NULL CHECK(status IN ('pending', 'paid', 'overdue', 'cancelled')) DEFAULT 'pending',
  createdBy TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (householdId) REFERENCES households(id),
  FOREIGN KEY (createdBy) REFERENCES users(id)
);

-- Payments table (pagos de servicios)
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  billId TEXT NOT NULL,
  householdId TEXT NOT NULL,
  paidBy TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  paidAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  paymentMethod TEXT,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (billId) REFERENCES bills(id),
  FOREIGN KEY (householdId) REFERENCES households(id),
  FOREIGN KEY (paidBy) REFERENCES users(id)
);

-- Expenses table (gastos compartidos)
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  householdId TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  category TEXT NOT NULL,
  paidBy TEXT NOT NULL,
  splitBetween TEXT NOT NULL, -- JSON array of userIds
  splitType TEXT NOT NULL CHECK(splitType IN ('equal', 'percentage', 'amount')) DEFAULT 'equal',
  splitData TEXT, -- JSON object with split details
  date TEXT NOT NULL, -- ISO date string
  notes TEXT,
  createdBy TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (householdId) REFERENCES households(id),
  FOREIGN KEY (paidBy) REFERENCES users(id),
  FOREIGN KEY (createdBy) REFERENCES users(id)
);

-- Debt settlements table (liquidaciones de deudas)
CREATE TABLE debt_settlements (
  id TEXT PRIMARY KEY,
  householdId TEXT NOT NULL,
  fromUser TEXT NOT NULL,
  toUser TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  settledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (householdId) REFERENCES households(id),
  FOREIGN KEY (fromUser) REFERENCES users(id),
  FOREIGN KEY (toUser) REFERENCES users(id)
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

-- Bills indexes
CREATE INDEX idx_bills_household ON bills(householdId);
CREATE INDEX idx_bills_due_date ON bills(dueDate);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_created_by ON bills(createdBy);

-- Payments indexes
CREATE INDEX idx_payments_bill ON payments(billId);
CREATE INDEX idx_payments_household ON payments(householdId);
CREATE INDEX idx_payments_paid_by ON payments(paidBy);
CREATE INDEX idx_payments_paid_at ON payments(paidAt);

-- Expenses indexes
CREATE INDEX idx_expenses_household ON expenses(householdId);
CREATE INDEX idx_expenses_paid_by ON expenses(paidBy);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_created_by ON expenses(createdBy);

-- Debt settlements indexes
CREATE INDEX idx_debt_settlements_household ON debt_settlements(householdId);
CREATE INDEX idx_debt_settlements_from_user ON debt_settlements(fromUser);
CREATE INDEX idx_debt_settlements_to_user ON debt_settlements(toUser);
CREATE INDEX idx_debt_settlements_settled_at ON debt_settlements(settledAt);
