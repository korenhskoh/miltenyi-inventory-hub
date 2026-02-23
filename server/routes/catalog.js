import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET / - list all parts from parts_catalog
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginate(req.query);
    const countResult = await query('SELECT COUNT(*) FROM parts_catalog');
    const total = parseInt(countResult.rows[0].count);
    const dataResult = await query('SELECT * FROM parts_catalog ORDER BY material_no LIMIT $1 OFFSET $2', [
      pageSize,
      offset,
    ]);
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, page, pageSize));
  }),
);

// GET /all - fetch entire catalog without pagination (for frontend cache)
router.get(
  '/all',
  asyncHandler(async (req, res) => {
    const dataResult = await query('SELECT * FROM parts_catalog ORDER BY material_no');
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(rows);
  }),
);

// POST / - bulk upsert parts in a single transaction
router.post('/', async (req, res) => {
  try {
    const { parts } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'parts array is required' });
    }

    // Build a single batched query using a transaction
    const values = [];
    const valueClauses = [];
    let paramIndex = 1;

    for (const part of parts) {
      const snakePart = camelToSnake(part);
      valueClauses.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
      );
      values.push(
        snakePart.material_no,
        snakePart.description || null,
        snakePart.category || null,
        snakePart.sg_price || null,
        snakePart.dist_price || null,
        snakePart.transfer_price || null,
        snakePart.rsp_eur || null,
      );
    }

    const sql = `
      INSERT INTO parts_catalog (material_no, description, category, sg_price, dist_price, transfer_price, rsp_eur)
      VALUES ${valueClauses.join(', ')}
      ON CONFLICT (material_no) DO UPDATE SET
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        sg_price = EXCLUDED.sg_price,
        dist_price = EXCLUDED.dist_price,
        transfer_price = EXCLUDED.transfer_price,
        rsp_eur = EXCLUDED.rsp_eur
    `;

    // Wrap in transaction for performance
    await query('BEGIN');
    try {
      await query(sql, values);
      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    res.json({ success: true, count: parts.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE / - truncate parts_catalog table
router.delete('/', async (req, res) => {
  try {
    await query('TRUNCATE TABLE parts_catalog');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
