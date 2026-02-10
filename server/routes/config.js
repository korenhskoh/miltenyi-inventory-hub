import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// Keys that are shared globally (not per-user)
const GLOBAL_KEYS = new Set(['aiBotConfig', 'waAutoReply']);

function effectiveUserId(key, reqUser) {
  return GLOBAL_KEYS.has(key) ? '__global__' : reqUser.id;
}

// GET / - list all config entries as { [key]: value } object
// Returns per-user values when they exist, falling back to __global__ defaults
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT DISTINCT ON (key) key, value
       FROM app_config
       WHERE user_id = $1 OR user_id = '__global__'
       ORDER BY key, CASE WHEN user_id = $1 THEN 0 ELSE 1 END`,
      [userId]
    );
    const configObj = {};
    for (const row of result.rows) {
      configObj[row.key] = row.value;
    }
    res.json(configObj);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:key - get single config entry value
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const userId = effectiveUserId(key, req.user);
    const result = await query(
      'SELECT * FROM app_config WHERE key = $1 AND user_id = $2',
      [key, userId]
    );

    // Fallback to global if per-user not found
    if (result.rows.length === 0 && userId !== '__global__') {
      const fallback = await query(
        'SELECT * FROM app_config WHERE key = $1 AND user_id = \'__global__\'',
        [key]
      );
      if (fallback.rows.length === 0) {
        return res.status(404).json({ error: 'Config key not found' });
      }
      return res.json(fallback.rows[0].value);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Config key not found' });
    }

    res.json(result.rows[0].value);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:key - upsert config entry (per-user or global)
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Only admins can modify global keys
    if (GLOBAL_KEYS.has(key) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required for global settings' });
    }

    const userId = effectiveUserId(key, req.user);

    const sql = `
      INSERT INTO app_config (key, user_id, value, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key, user_id) DO UPDATE SET value = $3, updated_at = NOW()
      RETURNING *
    `;
    const result = await query(sql, [key, userId, JSON.stringify(value)]);
    res.json({ key: result.rows[0].key, value: result.rows[0].value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
