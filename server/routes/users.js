import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields } from '../validation.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Allowed fields for user create/update
const USER_FIELDS = ['id', 'username', 'password_hash', 'name', 'email', 'phone', 'role', 'status', 'permissions'];
const USER_REQUIRED = ['username'];

// GET / - list all users (EXCLUDE password_hash)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginate(req.query);
    const countResult = await query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);
    const dataResult = await query(
      'SELECT id, username, name, email, phone, role, status, permissions, created FROM users ORDER BY id LIMIT $1 OFFSET $2',
      [pageSize, offset],
    );
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, page, pageSize));
  }),
);

// POST / - create user (hash password with bcryptjs)
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.password) {
      body.passwordHash = await bcrypt.hash(body.password, 10);
      delete body.password;
    }

    const snakeBody = pickAllowed(camelToSnake(body), USER_FIELDS);
    if (snakeBody.permissions && typeof snakeBody.permissions === 'object')
      snakeBody.permissions = JSON.stringify(snakeBody.permissions);
    const err = requireFields(snakeBody, USER_REQUIRED);
    if (err) return res.status(400).json({ error: err });

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id, username, name, email, phone, role, status, permissions, created`;
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

    const snakeBody = pickAllowed(camelToSnake(body), USER_FIELDS);
    if (snakeBody.permissions && typeof snakeBody.permissions === 'object')
      snakeBody.permissions = JSON.stringify(snakeBody.permissions);
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING id, username, name, email, phone, role, status, permissions, created`;
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
