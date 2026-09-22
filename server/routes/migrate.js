/**
 * One-time import of data that used to live in the browser's localStorage.
 *
 * Admin-only (mounted with requireAdmin), and rewritten after review found
 * three defects that made it dangerous rather than merely rough:
 *
 *   1. It issued BEGIN and COMMIT through the POOL. `query()` is `pool.query`,
 *      so each statement could land on a different connection: the transaction
 *      was imaginary, a failure halfway left the earlier rows committed, and
 *      the connection that received BEGIN went back to the pool still inside an
 *      open transaction, where later unrelated requests could join it.
 *   2. Column names came from the request body's own keys and were pasted into
 *      the statement. Every other write path in this codebase allow-lists its
 *      columns; this one was the exception, and it turned an admin session into
 *      arbitrary SQL.
 *   3. JS arrays and objects were bound straight to JSONB columns, which
 *      node-postgres renders as a Postgres array literal that jsonb rejects —
 *      so any payload carrying permissions or batch approvals aborted the
 *      import, which (because of 1) did not roll back.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { withTransaction } from '../db.js';
import { camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';

const router = Router();

// The columns each table will accept, mirroring the allow-lists the ordinary
// routes use. Anything else in the payload is ignored rather than trusted.
const TABLE_COLUMNS = {
  orders: [
    'id',
    'material_no',
    'description',
    'quantity',
    'list_price',
    'total_cost',
    'order_date',
    'order_by',
    'remark',
    'arrival_date',
    'qty_received',
    'back_order',
    'engineer',
    'email_full',
    'email_back',
    'status',
    'approval_status',
    'approval_sent_date',
    'month',
    'year',
    'bulk_group_id',
    'arrival_checked_by',
  ],
  bulk_groups: ['id', 'month', 'status', 'date', 'total_cost', 'created_by', 'items'],
  users: ['id', 'username', 'password_hash', 'name', 'email', 'role', 'status', 'phone', 'permissions'],
  stock_checks: ['id', 'date', 'checked_by', 'items', 'disc', 'status', 'notes', 'inventory'],
  notif_log: ['id', 'type', 'recipient', 'subject', 'date', 'status'],
  pending_approvals: [
    'id',
    'order_id',
    'order_ids',
    'requested_by',
    'sent_date',
    'action_date',
    'status',
    'order_type',
    'description',
    'quantity',
    'total_cost',
  ],
};

// Columns that are JSONB in the schema and must be serialised before binding.
const JSON_COLUMNS = new Set(['permissions', 'inventory', 'order_ids', 'items']);

/**
 * Insert rows through the transaction's own client.
 *
 * Returns the number inserted. Anything the table does not declare is dropped,
 * and a row left with no usable columns is skipped rather than producing an
 * empty INSERT.
 */
async function insertRows(client, table, rows) {
  const columns = TABLE_COLUMNS[table];
  if (!columns) throw new Error(`Unknown table: ${table}`);
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  let count = 0;
  for (const row of rows) {
    const clean = pickAllowed(camelToSnake(row), columns);
    const keys = Object.keys(clean);
    if (keys.length === 0) continue;

    const values = keys.map((k) => {
      const v = clean[k];
      // `items` is an integer count on bulk_groups but a JSONB payload on
      // stock_checks, so the decision is made per value, not per name.
      if (JSON_COLUMNS.has(k) && v !== null && typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    await client.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`, values);
    count++;
  }
  return count;
}

// POST / — one-time migration from localStorage.
router.post('/', async (req, res) => {
  try {
    const { orders, bulkGroups, users, stockChecks, notifLog, pendingApprovals, config } = req.body;

    // One connection, one transaction: either the whole import lands or none of
    // it does, so a failure can simply be retried.
    const counts = await withTransaction(async (client) => {
      const result = {};

      result.orders = await insertRows(client, 'orders', orders);
      result.bulkGroups = await insertRows(client, 'bulk_groups', bulkGroups);

      if (Array.isArray(users) && users.length > 0) {
        const prepared = [];
        for (const user of users) {
          const userData = { ...user };
          if (userData.password) {
            userData.passwordHash = await bcrypt.hash(userData.password, 10);
            delete userData.password;
          }
          prepared.push(userData);
        }
        result.users = await insertRows(client, 'users', prepared);
      } else {
        result.users = 0;
      }

      result.stockChecks = await insertRows(client, 'stock_checks', stockChecks);
      result.notifLog = await insertRows(client, 'notif_log', notifLog);
      result.pendingApprovals = await insertRows(client, 'pending_approvals', pendingApprovals);

      // Config — upsert key/value pairs, accepting either shape the old client
      // produced: an array of {key, value} or a plain object.
      let configCount = 0;
      if (config && typeof config === 'object') {
        const entries = Array.isArray(config) ? config.map((e) => [e?.key, e?.value]) : Object.entries(config);
        for (const [key, value] of entries) {
          if (!key) continue;
          await client.query(
            `INSERT INTO app_config (key, user_id, value, updated_at)
             VALUES ($1, '__global__', $2, NOW())
             ON CONFLICT (key, user_id) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, JSON.stringify(value ?? null)],
          );
          configCount++;
        }
      }
      result.config = configCount;

      return result;
    });

    res.json({ success: true, counts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
