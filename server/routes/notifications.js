import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';

const router = Router();

// GET / - list all notification logs
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM notif_log ORDER BY id DESC');
    const rows = result.rows.map(snakeToCamel);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / - create notification log entry
router.post('/', async (req, res) => {
  try {
    const snakeBody = camelToSnake(req.body);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO notif_log (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
