import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';

const router = Router();

const APPROVAL_FIELDS = ['id', 'order_id', 'order_type', 'description', 'requested_by', 'quantity', 'total_cost', 'sent_date', 'status', 'order_ids'];

// GET / - list all pending approvals, optional status filter
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM pending_approvals';
    const params = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY id DESC';

    const result = await query(sql, params);
    const rows = result.rows.map(snakeToCamel);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / - create pending approval
router.post('/', async (req, res) => {
  try {
    const snakeBody = pickAllowed(camelToSnake(req.body), APPROVAL_FIELDS);
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
    const snakeBody = pickAllowed(camelToSnake(req.body), APPROVAL_FIELDS);
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

export default router;
