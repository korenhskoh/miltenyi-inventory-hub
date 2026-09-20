import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields } from '../validation.js';
import { paginate, envelope, limitClause } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { invalidatePermissionCache } from '../middleware/permissions.js';

const router = Router();

// Allowed fields for user create/update
const USER_FIELDS = ['id', 'username', 'password_hash', 'name', 'email', 'phone', 'role', 'status', 'permissions'];
const USER_REQUIRED = ['username'];

/** Is `id` an active admin with no other active admin to fall back on? */
async function isLastActiveAdmin(id) {
  const target = await query('SELECT role, status FROM users WHERE id = $1', [id]);
  const row = target.rows[0];
  if (!row || row.role !== 'admin' || row.status !== 'active') return false;
  const others = await query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND id <> $1", [
    id,
  ]);
  return parseInt(others.rows[0].count, 10) === 0;
}

// GET / - list all users (EXCLUDE password_hash)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginate(req.query);
    const countResult = await query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);
    const lim = limitClause(req, 1);
    const dataResult = await query(
      `SELECT id, username, name, email, phone, role, status, permissions, created FROM users ORDER BY id${lim.clause}`,
      lim.params,
    );
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, lim.clause ? page : 1, lim.clause ? pageSize : rows.length));
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
    if (!snakeBody.id) snakeBody.id = `U-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!snakeBody.name) snakeBody.name = snakeBody.username;
    if (!snakeBody.password_hash) return res.status(400).json({ error: 'password is required' });
    if (snakeBody.role && !['admin', 'user'].includes(snakeBody.role)) {
      return res.status(400).json({ error: 'role must be admin or user' });
    }

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id, username, name, email, phone, role, status, permissions, created`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already exists' });
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
    if (snakeBody.role && !['admin', 'user'].includes(snakeBody.role)) {
      return res.status(400).json({ error: 'role must be admin or user' });
    }
    // Never let the last active admin be demoted or deactivated — by themselves
    // or by another admin.
    if ((snakeBody.role && snakeBody.role !== 'admin') || (snakeBody.status && snakeBody.status !== 'active')) {
      if (await isLastActiveAdmin(id)) {
        return res.status(400).json({ error: 'Cannot demote or deactivate the only active admin' });
      }
    }
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
    invalidatePermissionCache(id);

    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
    if (await isLastActiveAdmin(id)) {
      return res.status(400).json({ error: 'Cannot delete the only active admin' });
    }
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    invalidatePermissionCache(id);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
