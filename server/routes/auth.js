import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { generateToken, JWT_SECRET } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();

// POST /login - authenticate user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account not approved or inactive' });
    }

    // Generate JWT token and return with user data
    const { password_hash, ...userWithoutPassword } = user;
    const userData = snakeToCamel(userWithoutPassword);
    const token = generateToken(userData);
    res.json({ user: userData, token });
  } catch (e) {
    logger.error({ err: e }, 'Login error');
    res.status(500).json({ error: 'Server error — database may not be connected' });
  }
});

// POST /register - register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email, phone } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existing = await query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // users.id is a VARCHAR primary key with no default — it must be generated here.
    const id = `U-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const sql = `
      INSERT INTO users (id, username, password_hash, name, email, phone, role, status, permissions)
      VALUES ($1, $2, $3, $4, $5, $6, 'user', 'pending', '{}')
      RETURNING id, username, name, email, phone, role, status, created
    `;
    const result = await query(sql, [
      id,
      username,
      passwordHash,
      (name && String(name).trim()) || username, // name column is NOT NULL
      email || null,
      phone || null,
    ]);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    logger.error({ err: e }, 'Register error');
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /me - validate token and return latest user data from DB
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const result = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account not active' });
    }

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: snakeToCamel(userWithoutPassword) });
  } catch (e) {
    logger.error({ err: e }, 'Auth/me error');
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
