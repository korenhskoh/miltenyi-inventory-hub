import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, sanitizeDates } from '../validation.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const APPROVAL_FIELDS = [
  'id',
  'order_id',
  'order_type',
  'description',
  'requested_by',
  'quantity',
  'total_cost',
  'sent_date',
  'status',
  'action_date',
  'order_ids',
];
const APPROVAL_DATE_FIELDS = ['sent_date', 'action_date'];

// GET / - list all pending approvals, optional status filter
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereClause = ` WHERE status = $${paramIndex++}`;
      params.push(status);
    }

    const countResult = await query(`SELECT COUNT(*) FROM pending_approvals${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await query(
      `SELECT * FROM pending_approvals${whereClause} ORDER BY id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset],
    );
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, page, pageSize));
  }),
);

// POST / - create pending approval
router.post('/', async (req, res) => {
  try {
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), APPROVAL_FIELDS), APPROVAL_DATE_FIELDS);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO pending_approvals (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - update approval (status, action_date)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), APPROVAL_FIELDS), APPROVAL_DATE_FIELDS);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const sql = `UPDATE pending_approvals SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE / - delete all approvals
router.delete('/', async (req, res) => {
  try {
    await query('DELETE FROM pending_approvals');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
