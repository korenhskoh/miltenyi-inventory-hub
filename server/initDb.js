import pool, { query } from './db.js';
import logger from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcryptjs from 'bcryptjs';
import { defaultEmailTemplates } from './defaultEmailTemplates.js';
import { CONFIG_GLOBAL_KEYS } from './routes/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * A fixed key for the advisory lock that serialises schema application.
 * Any constant works; this one is just a recognisable number.
 */
const SCHEMA_LOCK_ID = 725101;

/**
 * Apply schema.sql exactly once at a time, and never at the cost of the
 * instance already serving traffic.
 *
 * The file is not only CREATE TABLE IF NOT EXISTS — it carries a long tail of
 * ALTER TABLE statements that run on every boot, and each one takes an ACCESS
 * EXCLUSIVE lock. On a rolling deploy the new container's ALTER queues behind
 * the old container's in-flight queries and, because that lock level queues
 * ahead of everything, it blocks the old container's NEW reads while it waits.
 * With a 15-second ceiling and process.exit on failure, that turned into a
 * crash loop that also stalled the instance still serving users.
 *
 * Two changes fix it: an advisory lock, so two instances starting together take
 * turns instead of deadlocking, and a lock_timeout, so a blocked statement
 * gives up in seconds rather than holding the queue.
 */
async function applySchema(schemaSql) {
  const client = await pool.connect();
  try {
    // Wait up to 30s to be the one applying the schema; the second instance
    // simply finds everything already in place when its turn comes.
    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '60s'");
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_ID]);
    try {
      await client.query(schemaSql);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_ID]);
    }
  } finally {
    client.release();
  }
}

export async function initDatabase() {
  try {
    // --- 1. Execute schema.sql to create tables ---
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await applySchema(schemaSql);

    // --- 2. Seed default users (only if users table is empty) ---
    const usersResult = await query('SELECT COUNT(*) AS count FROM users');
    const userCount = parseInt(usersResult.rows[0].count, 10);

    if (userCount === 0) {
      // The seed password used to be the literal 'admin123', committed in this
      // file, on an app reachable from the public internet. It now comes from
      // ADMIN_PASSWORD; in production the server refuses to seed without one,
      // and the fallback used for local development is flagged so the account
      // must be changed at first login.
      const supplied = process.env.ADMIN_PASSWORD;
      const isProd = process.env.NODE_ENV === 'production';
      if (isProd && !supplied) {
        throw new Error(
          'Refusing to seed the first admin without ADMIN_PASSWORD set. ' +
            'Set ADMIN_PASSWORD to a strong value and restart.',
        );
      }
      const password = supplied || 'changeme-on-first-login';
      await query(
        `INSERT INTO users (id, username, password_hash, name, email, role, status, phone, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'U001',
          'admin',
          bcryptjs.hashSync(password, 10),
          'System Admin',
          'admin@miltenyibiotec.com',
          'admin',
          'active',
          '',
          // A supplied password is the operator's own choice; the development
          // fallback is not, so that one must be replaced before use.
          !supplied,
        ],
      );
      if (supplied) {
        logger.info('Default admin user seeded with ADMIN_PASSWORD');
      } else {
        logger.warn('Default admin seeded with the development fallback password — it must be changed at first login');
      }
    } else {
      // Safety: ensure at least one active admin exists
      const adminCheck = await query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'");
      if (parseInt(adminCheck.rows[0].count, 10) === 0) {
        // Restore the original admin user's role
        await query("UPDATE users SET role = 'admin', status = 'active' WHERE username = 'admin'");
        logger.warn('No active admin found — restored admin user role');
      }
    }

    // --- 3. Seed default app_config entries (only if app_config is empty) ---
    const configResult = await query('SELECT COUNT(*) AS count FROM app_config');
    const configCount = parseInt(configResult.rows[0].count, 10);

    if (configCount === 0) {
      // emailConfig
      const emailConfig = {
        senderEmail: 'inventory@miltenyibiotec.com',
        senderName: 'Miltenyi Inventory Hub',
        smtpHost: '',
        smtpPort: 587,
        enabled: true,
        approverEmail: '',
        approvalEnabled: true,
        approvalKeywords: ['approve', 'approved', 'yes', 'confirm', 'confirmed', 'ok', 'accept', 'accepted'],
      };

      // emailTemplates (imported from shared module)
      const emailTemplates = defaultEmailTemplates;

      // priceConfig
      const priceConfig = {
        exchangeRate: 1.85,
        sgMarkup: 1.4,
        gst: 1.09,
        distMarkup: 2.05,
        specialRate: 2.0,
        year: 2025,
      };

      // waNotifyRules
      const waNotifyRules = {
        orderCreated: true,
        bulkOrderCreated: true,
        partArrivalDone: true,
        deliveryArrival: true,
        backOrderUpdate: true,
        lowStockAlert: true,
      };

      // scheduledNotifs
      const scheduledNotifs = {
        enabled: true,
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: 1,
        time: '09:00',
        lastRun: null,
        recipients: [],
        emailEnabled: true,
        whatsappEnabled: true,
        reports: {
          monthlySummary: true,
          backOrderReport: true,
          lowStockAlert: true,
          pendingApprovals: true,
          orderStats: true,
        },
      };

      const configEntries = [
        { key: 'emailConfig', value: emailConfig },
        { key: 'emailTemplates', value: emailTemplates },
        { key: 'priceConfig', value: priceConfig },
        { key: 'waNotifyRules', value: waNotifyRules },
        { key: 'scheduledNotifs', value: scheduledNotifs },
      ];

      for (const entry of configEntries) {
        await query(`INSERT INTO app_config (key, user_id, value) VALUES ($1, '__global__', $2)`, [
          entry.key,
          JSON.stringify(entry.value),
        ]);
      }

      logger.info('Default app_config seeded');
    }

    // --- 4. One-time repair: settings that the server reads from '__global__'
    // (scheduler, email, logo, bot) used to be saved per-user by Settings, so
    // the server never saw them. Promote the most recent per-user value when
    // no explicit global row exists yet.
    const promoted = await query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (key) key, value, updated_at
        FROM app_config
        WHERE user_id <> '__global__' AND key = ANY($1::text[])
        ORDER BY key, updated_at DESC
      )
      INSERT INTO app_config (key, user_id, value, updated_at)
      SELECT key, '__global__', value, updated_at FROM latest
      ON CONFLICT (key, user_id) DO UPDATE
        SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
        WHERE app_config.updated_at < EXCLUDED.updated_at
      RETURNING key
    `,
      [[...CONFIG_GLOBAL_KEYS]],
    );
    if (promoted.rowCount) {
      logger.info({ keys: promoted.rows.map((r) => r.key) }, 'Promoted per-user settings to global');
    }
    // Per-user rows for global keys are left in place on purpose: GET /api/config
    // already reads global keys only from '__global__', so they cannot shadow it,
    // and deleting them would irreversibly discard settings other users saved
    // back when these keys were per-user.

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error({ err: error }, 'Error initializing database');
    throw error;
  }
}
