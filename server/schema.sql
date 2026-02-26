CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  role VARCHAR(20) DEFAULT 'user',
  status VARCHAR(20) DEFAULT 'active',
  permissions JSONB DEFAULT '{}',
  created DATE DEFAULT CURRENT_DATE
);
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  material_no VARCHAR(30),
  description TEXT,
  quantity INTEGER DEFAULT 1,
  list_price NUMERIC(12, 2) DEFAULT 0,
  total_cost NUMERIC(12, 2) DEFAULT 0,
  order_date DATE,
  order_by VARCHAR(100),
  remark TEXT,
  arrival_date DATE,
  qty_received INTEGER DEFAULT 0,
  back_order INTEGER DEFAULT 0,
  engineer VARCHAR(100),
  email_full TEXT DEFAULT '',
  email_back TEXT DEFAULT '',
  status VARCHAR(30) DEFAULT 'Pending',
  approval_status VARCHAR(20) DEFAULT 'pending',
  approval_sent_date DATE,
  month VARCHAR(30),
  year VARCHAR(4),
  bulk_group_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bulk_groups (
  id VARCHAR(50) PRIMARY KEY,
  month VARCHAR(30),
  created_by VARCHAR(100),
  items INTEGER DEFAULT 0,
  total_cost NUMERIC(12, 2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Pending',
  date DATE DEFAULT CURRENT_DATE
);
CREATE TABLE IF NOT EXISTS stock_checks (
  id VARCHAR(50) PRIMARY KEY,
  date DATE,
  checked_by VARCHAR(100),
  items INTEGER DEFAULT 0,
  disc INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'In Progress',
  notes TEXT
);
CREATE TABLE IF NOT EXISTS notif_log (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20),
  recipient VARCHAR(255),
  subject TEXT,
  date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30)
);
CREATE TABLE IF NOT EXISTS pending_approvals (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50),
  order_type VARCHAR(20),
  description TEXT,
  requested_by VARCHAR(100),
  quantity INTEGER,
  total_cost NUMERIC(12, 2),
  sent_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  action_date DATE,
  order_ids JSONB
);
CREATE TABLE IF NOT EXISTS parts_catalog (
  material_no VARCHAR(30) PRIMARY KEY,
  description TEXT,
  category VARCHAR(100),
  sg_price NUMERIC(12, 2) DEFAULT 0,
  dist_price NUMERIC(12, 2) DEFAULT 0,
  transfer_price NUMERIC(12, 2) DEFAULT 0,
  rsp_eur NUMERIC(12, 2) DEFAULT 0
);
CREATE TABLE IF NOT EXISTS app_config (
  key VARCHAR(50) NOT NULL,
  user_id VARCHAR(20) NOT NULL DEFAULT '__global__',
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (key, user_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_month ON orders(month);
CREATE INDEX IF NOT EXISTS idx_orders_order_by ON orders(order_by);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
CREATE TABLE IF NOT EXISTS wa_auth (
  key_type VARCHAR(50) NOT NULL,
  key_id VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (key_type, key_id)
);
-- Migrations for existing databases
ALTER TABLE users
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE app_config
ADD COLUMN IF NOT EXISTS user_id VARCHAR(20) DEFAULT '__global__';
DO $$ BEGIN IF EXISTS (
  SELECT 1
  FROM information_schema.table_constraints
  WHERE table_name = 'app_config'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'app_config_pkey'
) THEN IF (
  SELECT COUNT(*)
  FROM information_schema.key_column_usage
  WHERE table_name = 'app_config'
    AND constraint_name = 'app_config_pkey'
) = 1 THEN
ALTER TABLE app_config DROP CONSTRAINT app_config_pkey;
ALTER TABLE app_config
ADD PRIMARY KEY (key, user_id);
END IF;
END IF;
END $$;
-- Audit trail for tracking all user actions
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20),
  user_name VARCHAR(100),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30),
  entity_id VARCHAR(30),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
-- Machines table for fleet tracking & forecasting
CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  modality VARCHAR(100) NOT NULL,
  location VARCHAR(100),
  install_date DATE,
  status VARCHAR(30) DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
-- Migration: Add bulk_group_id for explicit bulk group linking
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS bulk_group_id VARCHAR(50);
-- NOTE: Backfill migration removed — it ran on every server start and
-- incorrectly linked single orders to bulk groups by month match.
-- Orders are now linked to bulk groups only via explicit user action.
CREATE INDEX IF NOT EXISTS idx_orders_bulk_group_id ON orders(bulk_group_id);
-- Migration: Widen VARCHAR ID columns for timestamp-based IDs (ORD-<13digits>-<4chars> = 22+ chars)
ALTER TABLE users
ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE orders
ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE orders
ALTER COLUMN bulk_group_id TYPE VARCHAR(50);
ALTER TABLE bulk_groups
ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE stock_checks
ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE notif_log
ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE pending_approvals
ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE pending_approvals
ALTER COLUMN order_id TYPE VARCHAR(50);
-- Migration: Extend machines table for full Service module
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200);
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS customer_contact VARCHAR(200);
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS maintenance_period_months INTEGER DEFAULT 12;
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS last_maintenance_date DATE;
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS next_maintenance_date DATE;
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS contract_start DATE;
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS contract_end DATE;
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(80);
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_machines_modality ON machines(modality);
CREATE INDEX IF NOT EXISTS idx_machines_customer ON machines(customer_name);
CREATE INDEX IF NOT EXISTS idx_machines_next_maint ON machines(next_maintenance_date);
CREATE INDEX IF NOT EXISTS idx_machines_contract_end ON machines(contract_end);

-- Local Inventory table for service spare parts tracking
CREATE TABLE IF NOT EXISTS local_inventory (
  id SERIAL PRIMARY KEY,
  material_no VARCHAR(30) NOT NULL,
  description TEXT,
  lots_number VARCHAR(100),
  category VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_local_inv_unique
  ON local_inventory(material_no, COALESCE(lots_number, '__none__'));
CREATE INDEX IF NOT EXISTS idx_local_inventory_category ON local_inventory(category);

-- Inventory transaction log for tracking all quantity changes
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  inventory_id INTEGER REFERENCES local_inventory(id) ON DELETE CASCADE,
  material_no VARCHAR(30) NOT NULL,
  lots_number VARCHAR(100),
  quantity_change INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('charge_out','import','adjustment','arrival')),
  user_id VARCHAR(50),
  user_name VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_txn_material ON inventory_transactions(material_no);
CREATE INDEX IF NOT EXISTS idx_inv_txn_created ON inventory_transactions(created_at);