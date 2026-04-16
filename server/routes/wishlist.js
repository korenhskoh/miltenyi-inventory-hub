import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields } from '../validation.js';

const router = Router();

// Fields the client may supply. `id` is deliberately excluded — the server
// generates it to prevent clients from choosing/overwriting PKs (mass-
// assignment / ID collision). `user_id` is also excluded and is always
// overwritten from the auth context below.
const WISHLIST_FIELDS = ['material_no', 'description', 'list_price', 'quantity'];
const WISHLIST_REQUIRED = ['user_id'];

// GET / — list wishlist items for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query('SELECT * FROM wishlist WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(result.rows.map(snakeToCamel));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / — add item to wishlist
router.post('/', async (req, res) => {
  try {
    const snakeBody = pickAllowed(camelToSnake(req.body), WISHLIST_FIELDS);
    snakeBody.user_id = req.user.id; // always use authenticated user
    snakeBody.id = randomUUID(); // server-generated PK
    const err = requireFields(snakeBody, WISHLIST_REQUIRED);
    if (err) return res.status(400).json({ error: err });

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const sql = `INSERT INTO wishlist (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    // 23505 = unique_violation (PK collision — extremely unlikely with UUID v4)
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Wishlist item already exists' });
    }
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id — remove item from wishlist
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM wishlist WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Wishlist item not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
