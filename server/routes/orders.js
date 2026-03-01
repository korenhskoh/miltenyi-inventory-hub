import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields, sanitizeDates } from '../validation.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Allowed fields for order create/update (prevents mass assignment)
const ORDER_FIELDS = [
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
];
const ORDER_REQUIRED = ['id', 'description', 'quantity'];

const ORDER_DATE_FIELDS = ['order_date', 'arrival_date', 'approval_sent_date'];

// Allowed columns for ORDER BY (prevents SQL injection)
const ALLOWED_ORDER_COLUMNS = new Set([...ORDER_FIELDS, 'created_at']);

// GET / - list all orders, optional query params: status, month, orderBy, page, limit
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, month, orderBy } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(month);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    let orderClause = ' ORDER BY id DESC';
    if (orderBy) {
      const snakeCol = orderBy.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      if (ALLOWED_ORDER_COLUMNS.has(snakeCol)) {
        orderClause = ` ORDER BY ${snakeCol}`;
      }
    }

    const countResult = await query(`SELECT COUNT(*) FROM orders${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await query(
      `SELECT * FROM orders${whereClause}${orderClause} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset],
    );
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, page, pageSize));
  }),
);

// POST / - create order
router.post('/', async (req, res) => {
  try {
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), ORDER_FIELDS), ORDER_DATE_FIELDS);
    const err = requireFields(snakeBody, ORDER_REQUIRED);
    if (err) return res.status(400).json({ error: err });

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO orders (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /bulk-status - update status of multiple orders
router.put('/bulk-status', async (req, res) => {
  try {
    const { ids, status, approvalStatus } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const placeholders = ids.map((_, i) => `$${i + (approvalStatus ? 3 : 2)}`).join(', ');
    const sql = approvalStatus
      ? `UPDATE orders SET status = $1, approval_status = $2 WHERE id IN (${placeholders}) RETURNING *`
      : `UPDATE orders SET status = $1 WHERE id IN (${placeholders}) RETURNING *`;
    const params = approvalStatus ? [status, approvalStatus, ...ids] : [status, ...ids];
    const result = await query(sql, params);
    const rows = result.rows.map(snakeToCamel);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - update order by id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), ORDER_FIELDS), ORDER_DATE_FIELDS);

    // Enforce approval before allowing part arrival updates
    // Skip check if this request is also setting approval_status to 'approved'
    if (snakeBody.qty_received !== undefined && snakeBody.approval_status !== 'approved') {
      const check = await query('SELECT approval_status FROM orders WHERE id = $1', [id]);
      if (check.rows.length && check.rows[0].approval_status !== 'approved') {
        return res.status(403).json({ error: 'Order must be approved before recording part arrival' });
      }
    }

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const sql = `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /all - delete all orders
router.delete('/all', async (req, res) => {
  try {
    await query('DELETE FROM orders');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete order by id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
