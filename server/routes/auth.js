import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { generateToken } from '../middleware/auth.js';

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
    res.status(500).json({ error: e.message });
  }
});

// POST /register - register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email, phone } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (username, password_hash, name, email, phone, role, status)
      VALUES ($1, $2, $3, $4, $5, 'user', 'pending')
      RETURNING id, username, name, email, phone, role, status, created
    `;
    const result = await query(sql, [username, passwordHash, name || null, email || null, phone || null]);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
