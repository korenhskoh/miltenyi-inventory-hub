import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';

const router = Router();

// Helper to insert an array of objects into a table
async function insertRows(table, rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return 0;

  let count = 0;
  for (const row of rows) {
    const snakeRow = camelToSnake(row);
    const keys = Object.keys(snakeRow);
    const values = Object.values(snakeRow);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
    await query(sql, values);
    count++;
  }
  return count;
}

// POST / - one-time migration from localStorage
router.post('/', async (req, res) => {
  try {
    const {
      orders,
      bulkGroups,
      users,
      stockChecks,
      notifLog,
      pendingApprovals,
      config
    } = req.body;

    const counts = {};

    // Wrap in transaction
    await query('BEGIN');

    try {
      // Orders
      counts.orders = await insertRows('orders', orders);

      // Bulk groups
      counts.bulkGroups = await insertRows('bulk_groups', bulkGroups);

      // Users - hash plaintext passwords
      if (users && Array.isArray(users) && users.length > 0) {
        let userCount = 0;
        for (const user of users) {
          const userData = { ...user };
          if (userData.password) {
            userData.passwordHash = await bcrypt.hash(userData.password, 10);
            delete userData.password;
          }
          const snakeRow = camelToSnake(userData);
          const keys = Object.keys(snakeRow);
          const values = Object.values(snakeRow);
          const placeholders = keys.map((_, i) => `$${i + 1}`);

          const sql = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
          await query(sql, values);
          userCount++;
        }
        counts.users = userCount;
      } else {
        counts.users = 0;
      }

      // Stock checks
      counts.stockChecks = await insertRows('stock_checks', stockChecks);

      // Notification log
      counts.notifLog = await insertRows('notif_log', notifLog);

      // Pending approvals
      counts.pendingApprovals = await insertRows('pending_approvals', pendingApprovals);

      // Config - upsert key/value pairs
      if (config && typeof config === 'object') {
        let configCount = 0;
        const entries = Array.isArray(config) ? config : Object.entries(config);

        if (Array.isArray(config)) {
          // Array of { key, value } objects
          for (const entry of config) {
            const sql = `
              INSERT INTO app_config (key, value, updated_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
            `;
            await query(sql, [entry.key, JSON.stringify(entry.value)]);
            configCount++;
          }
        } else {
          // Object of { key: value } pairs
          for (const [key, value] of Object.entries(config)) {
            const sql = `
              INSERT INTO app_config (key, value, updated_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
            `;
            await query(sql, [key, JSON.stringify(value)]);
            configCount++;
          }
        }
        counts.config = configCount;
      } else {
        counts.config = 0;
      }

      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    res.json({ success: true, counts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
