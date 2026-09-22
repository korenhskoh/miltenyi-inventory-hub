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
  arrival_checked_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrival_checked_by VARCHAR(100);
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
-- app_config.user_id must be able to hold a users.id (VARCHAR(50))
ALTER TABLE app_config ALTER COLUMN user_id TYPE VARCHAR(50);
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

-- Migration: Split instruments into local vs overseas with region-specific fields
ALTER TABLE machines ADD COLUMN IF NOT EXISTS region VARCHAR(20) DEFAULT 'local';
ALTER TABLE machines ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS warranty_start DATE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS warranty_end DATE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS pm_spare_part TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS sap_code VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS proposed_service_contract TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS iqoq VARCHAR(20);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS iqoq_date DATE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS iqoq_price NUMERIC(12,2);
CREATE INDEX IF NOT EXISTS idx_machines_region ON machines(region);

-- Migration: Instrument model (ties an instrument to an FCA family e.g. Prodigy, MACSQUANT 10)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS model VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_machines_model ON machines(model);

-- Migration: Widen string columns to TEXT so imports can't be rejected for
-- exceeding VARCHAR(N) caps. Running multiple times is a no-op in Postgres.
ALTER TABLE machines ALTER COLUMN name TYPE TEXT;
ALTER TABLE machines ALTER COLUMN modality TYPE TEXT;
ALTER TABLE machines ALTER COLUMN location TYPE TEXT;
ALTER TABLE machines ALTER COLUMN status TYPE TEXT;
ALTER TABLE machines ALTER COLUMN serial_number TYPE TEXT;
ALTER TABLE machines ALTER COLUMN customer_name TYPE TEXT;
ALTER TABLE machines ALTER COLUMN customer_contact TYPE TEXT;
ALTER TABLE machines ALTER COLUMN customer_email TYPE TEXT;
ALTER TABLE machines ALTER COLUMN contract_type TYPE TEXT;
ALTER TABLE machines ALTER COLUMN country TYPE TEXT;
ALTER TABLE machines ALTER COLUMN sap_code TYPE TEXT;
ALTER TABLE machines ALTER COLUMN iqoq TYPE TEXT;
ALTER TABLE machines ALTER COLUMN model TYPE TEXT;

-- FCA (Field Change Action) master list — one row per FCA
CREATE TABLE IF NOT EXISTS fca_definitions (
  id SERIAL PRIMARY KEY,
  fca_number INTEGER NOT NULL,
  instrument_model VARCHAR(100) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  pdf_blob BYTEA,
  pdf_filename VARCHAR(255),
  pdf_size_bytes INTEGER,
  released_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fca_number_model ON fca_definitions(fca_number, instrument_model);
CREATE INDEX IF NOT EXISTS idx_fca_instrument_model ON fca_definitions(instrument_model);

-- Per-instrument application status for each FCA
CREATE TABLE IF NOT EXISTS fca_status (
  id SERIAL PRIMARY KEY,
  fca_id INTEGER NOT NULL REFERENCES fca_definitions(id) ON DELETE CASCADE,
  machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  completed_date DATE,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(50)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fca_status_unique ON fca_status(fca_id, machine_id);
CREATE INDEX IF NOT EXISTS idx_fca_status_machine ON fca_status(machine_id);
CREATE INDEX IF NOT EXISTS idx_fca_status_status ON fca_status(status);

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

-- Wishlist: saved items users can quickly pick when creating orders
CREATE TABLE IF NOT EXISTS wishlist (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  material_no VARCHAR(30),
  description TEXT,
  list_price NUMERIC(12, 2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

-- Migration: pending_approvals.order_id held a comma-joined list of order ids.
-- Each id is 22 characters, so three orders overflowed VARCHAR(50) and the
-- INSERT failed with 22001 — the approval was emailed and shown in the UI but
-- never stored, so it vanished on the next refresh and the approver never saw
-- it. order_ids (JSONB) already carries the same list properly.
ALTER TABLE pending_approvals
ALTER COLUMN order_id TYPE TEXT;

-- Migration: stock_checks had nowhere to keep the per-material counts, so the
-- physical count for every line was dropped by the field allow-list and the
-- detail behind a completed check could not be re-derived or re-exported.
ALTER TABLE stock_checks
ADD COLUMN IF NOT EXISTS inventory JSONB;

-- local_inventory.material_no was VARCHAR(30); catalog codes can be longer, and
-- an over-length code aborted the whole arrival batch.
ALTER TABLE local_inventory
ALTER COLUMN material_no TYPE TEXT;

-- Migration: flags an account whose password was set by the seeder rather than
-- chosen by a person. Login answers with mustChangePassword so the client can
-- force a change before anything else happens.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- ── AI usage log ────────────────────────────────────────────────────────────
-- One row per model call, successful or not. This is what makes spend visible:
-- without it the only evidence a provider bill exists is the provider's own
-- dashboard, and nobody can tell which surface or which person caused it.
CREATE TABLE IF NOT EXISTS ai_usage (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 'assistant' | 'whatsapp' | 'routing' | 'embedding' | 'test'
  surface TEXT NOT NULL,
  user_id TEXT,
  session_key TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  -- Priced at call time from the rate table, so a later price change does not
  -- silently rewrite history.
  cost_usd NUMERIC(12, 6) DEFAULT 0,
  latency_ms INTEGER,
  ok BOOLEAN DEFAULT TRUE,
  error_code TEXT,
  used_fallback BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage(user_id, created_at DESC);

-- ── Knowledge base ──────────────────────────────────────────────────────────
-- Documents the assistant may quote from. The text lives here rather than on
-- disk because the app runs on ephemeral containers: a file written beside the
-- process is gone at the next deploy.
CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT,
  mime TEXT,
  bytes INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  -- 'ready' once chunked; 'embedded' once vectors exist; 'error' with a reason.
  status TEXT DEFAULT 'ready',
  error TEXT,
  embedding_model TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks are what retrieval actually scores. The embedding is a plain REAL[]
-- rather than a pgvector column: pgvector is not guaranteed on a managed
-- Postgres, and at this corpus size scoring in Node is milliseconds. A chunk
-- with no embedding still ranks through the lexical path, so the knowledge base
-- works before — and without — any embedding provider.
CREATE TABLE IF NOT EXISTS kb_chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER DEFAULT 0,
  embedding REAL[],
  embedding_dim INTEGER
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks(doc_id, ordinal);
