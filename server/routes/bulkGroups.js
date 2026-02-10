import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields } from '../validation.js';

const router = Router();

const BULK_GROUP_FIELDS = ['id', 'month', 'created_by', 'items', 'total_cost', 'status', 'date'];
const BULK_GROUP_REQUIRED = ['id', 'month'];

// GET / - list all bulk groups
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM bulk_groups ORDER BY id DESC');
    const rows = result.rows.map(snakeToCamel);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / - create bulk group
router.post('/', async (req, res) => {
  try {
    const snakeBody = pickAllowed(camelToSnake(req.body), BULK_GROUP_FIELDS);
    const err = requireFields(snakeBody, BULK_GROUP_REQUIRED);
    if (err) return res.status(400).json({ error: err });

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO bulk_groups (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - update bulk group
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snakeBody = pickAllowed(camelToSnake(req.body), BULK_GROUP_FIELDS);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const sql = `UPDATE bulk_groups SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk group not found' });
    }

    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete bulk group
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM bulk_groups WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk group not found' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
