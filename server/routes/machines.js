import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';

const router = Router();

const MACHINE_FIELDS = ['name', 'modality', 'location', 'install_date', 'status', 'notes'];

// GET / - list all machines
router.get('/', async (req, res) => {
  try {
    const { modality } = req.query;
    let sql = 'SELECT * FROM machines';
    const params = [];
    if (modality) { sql += ' WHERE modality = $1'; params.push(modality); }
    sql += ' ORDER BY id DESC';
    const result = await query(sql, params);
    const rows = result.rows.map(snakeToCamel);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / - add machine
router.post('/', async (req, res) => {
  try {
    const b = pickAllowed(camelToSnake(req.body), MACHINE_FIELDS);
    if (!b.name || !b.modality) return res.status(400).json({ error: 'name and modality required' });
    const keys = Object.keys(b);
    const vals = Object.values(b);
    const ph = keys.map((_, i) => `$${i + 1}`);
    const sql = `INSERT INTO machines (${keys.join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`;
    const result = await query(sql, vals);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - update machine
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const b = pickAllowed(camelToSnake(req.body), MACHINE_FIELDS);
    const keys = Object.keys(b);
    const vals = Object.values(b);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const sql = `UPDATE machines SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...vals, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Machine not found' });
    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete machine
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM machines WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Machine not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
