CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(20) PRIMARY KEY,
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
  id VARCHAR(20) PRIMARY KEY,
  material_no VARCHAR(30),
  description TEXT,
  quantity INTEGER DEFAULT 1,
  list_price NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
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
  bulk_group_id VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulk_groups (
  id VARCHAR(20) PRIMARY KEY,
  month VARCHAR(30),
  created_by VARCHAR(100),
  items INTEGER DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Pending',
  date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS stock_checks (
  id VARCHAR(20) PRIMARY KEY,
  date DATE,
  checked_by VARCHAR(100),
  items INTEGER DEFAULT 0,
  disc INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'In Progress',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS notif_log (
  id VARCHAR(20) PRIMARY KEY,
  type VARCHAR(20),
  recipient VARCHAR(255),
  subject TEXT,
  date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS pending_approvals (
  id VARCHAR(30) PRIMARY KEY,
  order_id VARCHAR(20),
  order_type VARCHAR(20),
  description TEXT,
  requested_by VARCHAR(100),
  quantity INTEGER,
  total_cost NUMERIC(12,2),
  sent_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  action_date DATE,
  order_ids JSONB
);

CREATE TABLE IF NOT EXISTS parts_catalog (
  material_no VARCHAR(30) PRIMARY KEY,
  description TEXT,
  category VARCHAR(100),
  sg_price NUMERIC(12,2) DEFAULT 0,
  dist_price NUMERIC(12,2) DEFAULT 0,
  transfer_price NUMERIC(12,2) DEFAULT 0,
  rsp_eur NUMERIC(12,2) DEFAULT 0
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS user_id VARCHAR(20) DEFAULT '__global__';
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='app_config' AND constraint_type='PRIMARY KEY' AND constraint_name='app_config_pkey'
  ) THEN
    IF (SELECT COUNT(*) FROM information_schema.key_column_usage
        WHERE table_name='app_config' AND constraint_name='app_config_pkey') = 1 THEN
      ALTER TABLE app_config DROP CONSTRAINT app_config_pkey;
      ALTER TABLE app_config ADD PRIMARY KEY (key, user_id);
    END IF;
  END IF;
END $$;

-- Migration: Add bulk_group_id for explicit bulk group linking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bulk_group_id VARCHAR(20);
-- Backfill: Link existing orders to bulk groups by matching month field
UPDATE orders o SET bulk_group_id = bg.id
FROM bulk_groups bg
WHERE REPLACE(COALESCE(o.month,''), '_', ' ') = REPLACE(COALESCE(bg.month,''), '_', ' ')
  AND o.bulk_group_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_bulk_group_id ON orders(bulk_group_id);
