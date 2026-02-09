import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';

const router = Router();

// Allowed columns for ORDER BY (prevents SQL injection)
const ALLOWED_ORDER_COLUMNS = new Set([
  'id', 'material_no', 'description', 'quantity', 'list_price', 'total_cost',
  'order_date', 'order_by', 'remark', 'arrival_date', 'qty_received',
  'back_order', 'engineer', 'status', 'approval_status', 'month', 'year', 'created_at'
]);

// GET / - list all orders, optional query params: status, month, orderBy
router.get('/', async (req, res) => {
  try {
    const { status, month, orderBy } = req.query;
    let sql = 'SELECT * FROM orders';
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

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    if (orderBy) {
      // Convert camelCase to snake_case safely
      const snakeCol = orderBy.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
      if (ALLOWED_ORDER_COLUMNS.has(snakeCol)) {
        sql += ` ORDER BY ${snakeCol}`;
      } else {
        sql += ' ORDER BY id DESC';
      }
    } else {
      sql += ' ORDER BY id DESC';
    }

    const result = await query(sql, params);
    const rows = result.rows.map(snakeToCamel);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / - create order
router.post('/', async (req, res) => {
  try {
    const snakeBody = camelToSnake(req.body);
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
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
    const sql = `UPDATE orders SET status = $1 WHERE id IN (${placeholders}) RETURNING *`;
    const result = await query(sql, [status, ...ids]);
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
    const snakeBody = camelToSnake(req.body);
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
