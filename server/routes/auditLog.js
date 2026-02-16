import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET / - list audit log entries with optional filters
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { user, action, entityType, from, to } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
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
    if (from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(to + 'T23:59:59');
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM audit_log${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await query(
      `SELECT * FROM audit_log${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset],
    );
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, page, pageSize));
  }),
);

// POST / - create audit log entry
router.post('/', async (req, res) => {
  try {
    const b = camelToSnake(req.body);
    const sql = `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    const result = await query(sql, [
      b.user_id || null,
      b.user_name || null,
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
router.delete('/', async (req, res) => {
  try {
    await query('DELETE FROM audit_log');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
