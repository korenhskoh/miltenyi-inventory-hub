import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { paginate, envelope, limitClause } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { instantForZonedTime } from '../appDates.js';

const router = Router();

// GET / - list audit log entries with optional filters
router.get(
  '/',
  requirePermission('auditTrail'),
  asyncHandler(async (req, res) => {
    const { user, action, entityType, from, to } = req.query;
    const { page, pageSize } = paginate(req.query);
    const conditions = [];
    const params = [];
    let idx = 1;

    if (user) {
      conditions.push(`user_name ILIKE $${idx++}`);
      params.push(`%${user}%`);
    }
    if (action) {
      conditions.push(`action = $${idx++}`);
      params.push(action);
    }
    if (entityType) {
      conditions.push(`entity_type = $${idx++}`);
      params.push(entityType);
    }
    // created_at is a naive TIMESTAMP filled by NOW(), i.e. the database's
    // clock (UTC), while the operator types a date off the business calendar.
    // Comparing the two directly shifted every day's window by the UTC offset:
    // filtering "today" in Singapore returned 08:00 today through 07:59
    // tomorrow, so the whole early shift was invisible and the next morning's
    // actions were wrongly included. Resolve the typed dates to instants first.
    const dayParam = (v) => {
      const raw = Array.isArray(v) ? v[0] : v;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw).trim());
      return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
    };
    const fromDay = from ? dayParam(from) : null;
    const toDay = to ? dayParam(to) : null;
    if (fromDay) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(new Date(instantForZonedTime(fromDay.year, fromDay.month, fromDay.day, 0, 0)).toISOString());
    }
    if (toDay) {
      // Exclusive upper bound at the start of the next day, so 23:59:59.7 is
      // not silently dropped the way a `<= 23:59:59` bound dropped it.
      conditions.push(`created_at < $${idx++}`);
      params.push(new Date(instantForZonedTime(toDay.year, toDay.month, toDay.day + 1, 0, 0)).toISOString());
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM audit_log${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const lim = limitClause(req, idx);
    const dataResult = await query(
      `SELECT * FROM audit_log${whereClause} ORDER BY created_at DESC, id DESC${lim.clause}`,
      [...params, ...lim.params],
    );
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, lim.clause ? page : 1, lim.clause ? pageSize : rows.length));
  }),
);

// POST / - create audit log entry
router.post('/', async (req, res) => {
  try {
    const b = camelToSnake(req.body);
    const sql = `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    // Identity is taken from the authenticated session — a body-supplied
    // userId/userName let anyone forge entries blaming another account.
    const result = await query(sql, [
      req.user?.id || null,
      req.user?.username || null,
      b.action,
      b.entity_type || null,
      b.entity_id || null,
      b.details ? JSON.stringify(b.details) : null,
      req.ip || req.headers['x-forwarded-for'] || null,
    ]);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE / - clear all audit logs (admin)
router.delete('/', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM audit_log');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
