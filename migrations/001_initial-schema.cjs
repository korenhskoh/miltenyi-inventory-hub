/**
 * Initial schema migration — captures the full database schema as of Feb 2026.
 *
 * This migration is intended to be marked as "already applied" on existing
 * production databases (the tables already exist). For new environments,
 * running this migration will create all tables from scratch.
 */

exports.up = (pgm) => {
  // ── Users ──
  pgm.createTable('users', {
    id: { type: 'varchar(50)', primaryKey: true },
    username: { type: 'varchar(50)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    name: { type: 'varchar(100)', notNull: true },
    email: { type: 'varchar(255)' },
    phone: { type: 'varchar(30)' },
    role: { type: 'varchar(20)', default: "'user'" },
    status: { type: 'varchar(20)', default: "'active'" },
    permissions: { type: 'jsonb', default: "'{}'" },
    created: { type: 'date', default: pgm.func('CURRENT_DATE') },
  }, { ifNotExists: true });

  // ── Orders ──
  pgm.createTable('orders', {
    id: { type: 'varchar(50)', primaryKey: true },
    material_no: { type: 'varchar(30)' },
    description: { type: 'text' },
    quantity: { type: 'integer', default: 1 },
    list_price: { type: 'numeric(12,2)', default: 0 },
    total_cost: { type: 'numeric(12,2)', default: 0 },
    order_date: { type: 'date' },
    order_by: { type: 'varchar(100)' },
    remark: { type: 'text' },
    arrival_date: { type: 'date' },
    qty_received: { type: 'integer', default: 0 },
    back_order: { type: 'integer', default: 0 },
    engineer: { type: 'varchar(100)' },
    email_full: { type: 'text', default: "''" },
    email_back: { type: 'text', default: "''" },
    status: { type: 'varchar(30)', default: "'Pending'" },
    approval_status: { type: 'varchar(20)', default: "'pending'" },
    approval_sent_date: { type: 'date' },
    month: { type: 'varchar(30)' },
    year: { type: 'varchar(4)' },
    bulk_group_id: { type: 'varchar(50)' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('orders', 'status', { ifNotExists: true });
  pgm.createIndex('orders', 'month', { ifNotExists: true });
  pgm.createIndex('orders', 'order_by', { ifNotExists: true });
  pgm.createIndex('orders', 'bulk_group_id', { ifNotExists: true });

  // ── Bulk Groups ──
  pgm.createTable('bulk_groups', {
    id: { type: 'varchar(50)', primaryKey: true },
    month: { type: 'varchar(30)' },
    created_by: { type: 'varchar(100)' },
    items: { type: 'integer', default: 0 },
    total_cost: { type: 'numeric(12,2)', default: 0 },
    status: { type: 'varchar(30)', default: "'Pending'" },
    date: { type: 'date', default: pgm.func('CURRENT_DATE') },
  }, { ifNotExists: true });

  // ── Stock Checks ──
  pgm.createTable('stock_checks', {
    id: { type: 'varchar(50)', primaryKey: true },
    date: { type: 'date' },
    checked_by: { type: 'varchar(100)' },
    items: { type: 'integer', default: 0 },
    disc: { type: 'integer', default: 0 },
    status: { type: 'varchar(30)', default: "'In Progress'" },
    notes: { type: 'text' },
  }, { ifNotExists: true });

  // ── Notification Log ──
  pgm.createTable('notif_log', {
    id: { type: 'varchar(50)', primaryKey: true },
    type: { type: 'varchar(20)' },
    recipient: { type: 'varchar(255)' },
    subject: { type: 'text' },
    date: { type: 'date', default: pgm.func('CURRENT_DATE') },
    status: { type: 'varchar(30)' },
  }, { ifNotExists: true });

  // ── Pending Approvals ──
  pgm.createTable('pending_approvals', {
    id: { type: 'varchar(50)', primaryKey: true },
    order_id: { type: 'varchar(50)' },
    order_type: { type: 'varchar(20)' },
    description: { type: 'text' },
    requested_by: { type: 'varchar(100)' },
    quantity: { type: 'integer' },
    total_cost: { type: 'numeric(12,2)' },
    sent_date: { type: 'date' },
    status: { type: 'varchar(20)', default: "'pending'" },
    action_date: { type: 'date' },
    order_ids: { type: 'jsonb' },
  }, { ifNotExists: true });

  pgm.createIndex('pending_approvals', 'status', { ifNotExists: true });

  // ── Parts Catalog ──
  pgm.createTable('parts_catalog', {
    material_no: { type: 'varchar(30)', primaryKey: true },
    description: { type: 'text' },
    category: { type: 'varchar(100)' },
    sg_price: { type: 'numeric(12,2)', default: 0 },
    dist_price: { type: 'numeric(12,2)', default: 0 },
    transfer_price: { type: 'numeric(12,2)', default: 0 },
    rsp_eur: { type: 'numeric(12,2)', default: 0 },
  }, { ifNotExists: true });

  // ── App Config ──
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS app_config (
      key VARCHAR(50) NOT NULL,
      user_id VARCHAR(20) NOT NULL DEFAULT '__global__',
      value JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (key, user_id)
    )
  `);

  // ── WhatsApp Auth ──
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS wa_auth (
      key_type VARCHAR(50) NOT NULL,
      key_id VARCHAR(100) NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (key_type, key_id)
    )
  `);

  // ── Audit Log ──
  pgm.createTable('audit_log', {
    id: { type: 'serial', primaryKey: true },
    user_id: { type: 'varchar(20)' },
    user_name: { type: 'varchar(100)' },
    action: { type: 'varchar(50)', notNull: true },
    entity_type: { type: 'varchar(30)' },
    entity_id: { type: 'varchar(30)' },
    details: { type: 'jsonb' },
    ip_address: { type: 'varchar(45)' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('audit_log', 'user_id', { ifNotExists: true });
  pgm.createIndex('audit_log', 'action', { ifNotExists: true });
  pgm.createIndex('audit_log', 'created_at', { ifNotExists: true });

  // ── Machines ──
  pgm.createTable('machines', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(100)', notNull: true },
    modality: { type: 'varchar(100)', notNull: true },
    location: { type: 'varchar(100)' },
    install_date: { type: 'date' },
    status: { type: 'varchar(30)', default: "'Active'" },
    notes: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
  }, { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('machines', { ifExists: true, cascade: true });
  pgm.dropTable('audit_log', { ifExists: true, cascade: true });
  pgm.dropTable('wa_auth', { ifExists: true, cascade: true });
  pgm.dropTable('app_config', { ifExists: true, cascade: true });
  pgm.dropTable('parts_catalog', { ifExists: true, cascade: true });
  pgm.dropTable('pending_approvals', { ifExists: true, cascade: true });
  pgm.dropTable('notif_log', { ifExists: true, cascade: true });
  pgm.dropTable('stock_checks', { ifExists: true, cascade: true });
  pgm.dropTable('bulk_groups', { ifExists: true, cascade: true });
  pgm.dropTable('orders', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });
};
