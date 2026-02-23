import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const NOTIF_FIELDS = ['id', 'type', 'recipient', 'subject', 'date', 'status'];

// Map frontend field 'to' → DB column 'recipient'
function mapNotifInput(body) {
  const mapped = { ...body };
  if (mapped.to !== undefined) {
    mapped.recipient = mapped.to;
    delete mapped.to;
  }
  return mapped;
}

// Map DB column 'recipient' → frontend field 'to'
function mapNotifOutput(row) {
  const mapped = snakeToCamel(row);
  if (mapped.recipient !== undefined) {
    mapped.to = mapped.recipient;
    delete mapped.recipient;
  }
  return mapped;
}

// GET / - list all notification logs
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginate(req.query);
    const countResult = await query('SELECT COUNT(*) FROM notif_log');
    const total = parseInt(countResult.rows[0].count);
    const dataResult = await query('SELECT * FROM notif_log ORDER BY id DESC LIMIT $1 OFFSET $2', [pageSize, offset]);
    const rows = dataResult.rows.map(mapNotifOutput);
    res.json(envelope(rows, total, page, pageSize));
  }),
);

// POST / - create notification log entry
router.post('/', async (req, res) => {
  try {
    const snakeBody = pickAllowed(camelToSnake(mapNotifInput(req.body)), NOTIF_FIELDS);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO notif_log (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(mapNotifOutput(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete notification log entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM notif_log WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE / - delete all notification logs (admin only)
router.delete('/', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM notif_log');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
