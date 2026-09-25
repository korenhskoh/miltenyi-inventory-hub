import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';

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
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { parts } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'parts array is required' });
    }

    // Postgres rejects a single INSERT ... ON CONFLICT DO UPDATE whose VALUES
    // list touches the same conflict key twice ("cannot affect row a second
    // time"), and the whole statement aborts. These price lists routinely
    // repeat a material number — a second line for another pack size, or a
    // copy-paste — and one such line used to lose the entire upload. Collapse
    // duplicates first, last line winning, the way a repeated row would behave
    // if the file were imported line by line.
    const byMaterial = new Map();
    let skipped = 0;
    for (const part of parts) {
      const snakePart = camelToSnake(part);
      const materialNo = String(snakePart.material_no ?? '').trim();
      if (!materialNo) {
        skipped++;
        continue;
      }
      byMaterial.set(materialNo, { ...snakePart, material_no: materialNo });
    }
    const duplicates = parts.length - skipped - byMaterial.size;

    if (byMaterial.size === 0) {
      return res.status(400).json({ error: 'No rows carried a material number' });
    }

    // A price of 0 is a real price; `|| null` used to discard it.
    const price = (v) => (v === undefined || v === null || v === '' ? null : v);

    // Postgres caps a statement at 65535 bound parameters; at 7 per row a large
    // price list would have blown that as one statement. Chunk it, and run the
    // chunks in one transaction so a failure part-way cannot leave the catalog
    // half updated.
    const rows = [...byMaterial.values()];
    const CHUNK = 5000;
    await withTransaction(async (client) => {
      for (let start = 0; start < rows.length; start += CHUNK) {
        const chunk = rows.slice(start, start + CHUNK);
        const values = [];
        const valueClauses = [];
        let paramIndex = 1;
        for (const snakePart of chunk) {
          valueClauses.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
          );
          values.push(
            snakePart.material_no,
            snakePart.description || null,
            snakePart.category || null,
            price(snakePart.sg_price),
            price(snakePart.dist_price),
            price(snakePart.transfer_price),
            price(snakePart.rsp_eur),
          );
        }
        await client.query(
          `INSERT INTO parts_catalog (material_no, description, category, sg_price, dist_price, transfer_price, rsp_eur)
           VALUES ${valueClauses.join(', ')}
           ON CONFLICT (material_no) DO UPDATE SET
             description = EXCLUDED.description,
             category = EXCLUDED.category,
             sg_price = EXCLUDED.sg_price,
             dist_price = EXCLUDED.dist_price,
             transfer_price = EXCLUDED.transfer_price,
             rsp_eur = EXCLUDED.rsp_eur`,
          values,
        );
      }
    });

    res.json({ success: true, count: byMaterial.size, duplicatesMerged: duplicates, skippedNoMaterialNo: skipped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE / - truncate parts_catalog table
router.delete('/', requireAdmin, async (req, res) => {
  try {
    await query('TRUNCATE TABLE parts_catalog');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /lookup — bulk price lookup by material numbers
router.post(
  '/lookup',
  asyncHandler(async (req, res) => {
    const { materialNos } = req.body;
    if (!Array.isArray(materialNos) || materialNos.length === 0) {
      return res.status(400).json({ error: 'materialNos array is required' });
    }
    const limited = materialNos.slice(0, 500);
    const placeholders = limited.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(`SELECT * FROM parts_catalog WHERE material_no IN (${placeholders})`, limited);
    const found = result.rows.map(snakeToCamel);
    const foundSet = new Set(result.rows.map((r) => r.material_no));
    const notFound = limited.filter((mn) => !foundSet.has(mn));
    res.json({ found, notFound });
  }),
);

export default router;
