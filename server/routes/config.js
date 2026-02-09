import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';

const router = Router();

// GET / - list all config entries as { [key]: value } object
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM app_config ORDER BY key');
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
    const result = await query('SELECT * FROM app_config WHERE key = $1', [key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Config key not found' });
    }

    res.json(result.rows[0].value);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:key - upsert config entry
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const sql = `
      INSERT INTO app_config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
      RETURNING *
    `;
    const result = await query(sql, [key, JSON.stringify(value)]);
    res.json({ key: result.rows[0].key, value: result.rows[0].value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
