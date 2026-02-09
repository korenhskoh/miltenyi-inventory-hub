import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';

const router = Router();

// GET / - list all users (EXCLUDE password_hash)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, name, email, phone, role, status, created FROM users ORDER BY id'
    );
    const rows = result.rows.map(snakeToCamel);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / - create user (hash password with bcryptjs)
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.password) {
      body.passwordHash = await bcrypt.hash(body.password, 10);
      delete body.password;
    }

    const snakeBody = camelToSnake(body);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id, username, name, email, phone, role, status, created`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - update user (hash password if provided, otherwise skip password_hash)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.password) {
      body.passwordHash = await bcrypt.hash(body.password, 10);
      delete body.password;
    }

    const snakeBody = camelToSnake(body);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING id, username, name, email, phone, role, status, created`;
    const result = await query(sql, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
