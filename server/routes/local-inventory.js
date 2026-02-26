import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const INVENTORY_FIELDS = ['material_no', 'description', 'lots_number', 'category', 'quantity'];

// GET /summary — dashboard counts
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const r = await query(`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(quantity), 0)::int AS total_quantity,
        COUNT(*) FILTER (WHERE quantity <= 0)::int AS low_stock,
        COUNT(DISTINCT category) FILTER (WHERE category IS NOT NULL AND category != '')::int AS categories
      FROM local_inventory
    `);
    const row = r.rows[0] || {};
    res.json({
      total: row.total || 0,
      totalQuantity: row.total_quantity || 0,
      lowStock: row.low_stock || 0,
      categories: row.categories || 0,
    });
  }),
);

// GET /transactions — all recent transactions (with optional filters)
router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const { type, materialNo } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const conditions = [];
    const params = [];
    let pi = 1;

    if (type) {
      conditions.push(`type = $${pi++}`);
      params.push(type);
    }
    if (materialNo) {
      conditions.push(`material_no = $${pi++}`);
      params.push(materialNo);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM inventory_transactions${where}`, params);
    const total = parseInt(countResult.rows[0].count);
    const dataResult = await query(
      `SELECT * FROM inventory_transactions${where} ORDER BY created_at DESC LIMIT $${pi++} OFFSET $${pi++}`,
      [...params, pageSize, offset],
    );
    res.json(envelope(dataResult.rows.map(snakeToCamel), total, page, pageSize));
  }),
);

// GET /:id/transactions — transaction history for one item
router.get(
  '/:id/transactions',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM inventory_transactions WHERE inventory_id = $1 ORDER BY created_at DESC',
      [id],
    );
    res.json(result.rows.map(snakeToCamel));
  }),
);

// GET / — list with search/filter/pagination
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, category } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const conditions = [];
    const params = [];
    let pi = 1;

    if (search) {
      conditions.push(`(material_no ILIKE $${pi} OR description ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }
    if (category && category !== 'All') {
      conditions.push(`category = $${pi++}`);
      params.push(category);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM local_inventory${where}`, params);
    const total = parseInt(countResult.rows[0].count);
    const dataResult = await query(
      `SELECT * FROM local_inventory${where} ORDER BY updated_at DESC LIMIT $${pi++} OFFSET $${pi++}`,
      [...params, pageSize, offset],
    );
    res.json(envelope(dataResult.rows.map(snakeToCamel), total, page, pageSize));
  }),
);

// POST / — add single inventory item (upsert on material_no + lots_number)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = pickAllowed(camelToSnake(req.body), INVENTORY_FIELDS);
    if (!b.material_no) return res.status(400).json({ error: 'material_no required' });

    const lotsKey = b.lots_number || null;
    const result = await query(
      `INSERT INTO local_inventory (material_no, description, lots_number, category, quantity)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (material_no, COALESCE(lots_number, '__none__'))
       DO UPDATE SET description = COALESCE(EXCLUDED.description, local_inventory.description),
                     category = COALESCE(EXCLUDED.category, local_inventory.category),
                     quantity = EXCLUDED.quantity,
                     updated_at = NOW()
       RETURNING *`,
      [b.material_no, b.description || null, lotsKey, b.category || null, b.quantity || 0],
    );
    res.status(201).json(snakeToCamel(result.rows[0]));
  }),
);

// POST /bulk — bulk import inventory items
router.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });

    const inserted = [];
    const updated = [];
    const errors = [];

    await query('BEGIN');
    try {
      for (const [idx, item] of items.entries()) {
        try {
          const b = pickAllowed(camelToSnake(item), INVENTORY_FIELDS);
          if (!b.material_no) {
            errors.push({ row: idx + 1, error: 'material_no required' });
            continue;
          }
          const lotsKey = b.lots_number || null;
          const qty = parseInt(b.quantity) || 0;

          const result = await query(
            `INSERT INTO local_inventory (material_no, description, lots_number, category, quantity)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (material_no, COALESCE(lots_number, '__none__'))
             DO UPDATE SET description = COALESCE(EXCLUDED.description, local_inventory.description),
                           category = COALESCE(EXCLUDED.category, local_inventory.category),
                           quantity = EXCLUDED.quantity,
                           updated_at = NOW()
             RETURNING *, (xmax = 0) AS is_insert`,
            [b.material_no, b.description || null, lotsKey, b.category || null, qty],
          );

          const row = result.rows[0];
          const wasInsert = row.is_insert;

          // Log the import transaction
          await query(
            `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
             VALUES ($1, $2, $3, $4, $5, 'import', $6, $7, $8)`,
            [
              row.id,
              b.material_no,
              lotsKey,
              qty,
              qty,
              req.user?.id || null,
              req.user?.username || null,
              `Bulk import row ${idx + 1}`,
            ],
          );

          if (wasInsert) inserted.push(snakeToCamel(row));
          else updated.push(snakeToCamel(row));
        } catch (e) {
          errors.push({ row: idx + 1, error: e.message });
        }
      }
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK');
      return res.status(500).json({ error: e.message });
    }

    res
      .status(201)
      .json({ inserted: inserted.length, updated: updated.length, errors, items: [...inserted, ...updated] });
  }),
);

// POST /charge-out — charge out parts (single or bulk)
router.post(
  '/charge-out',
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });

    const processed = [];
    const errors = [];

    await query('BEGIN');
    try {
      for (const [idx, item] of items.entries()) {
        try {
          const materialNo = item.materialNo || item.material_no;
          const lotsNumber = item.lotsNumber || item.lots_number || null;
          const qty = Math.abs(parseInt(item.quantity) || 1);
          const notes = item.notes || '';

          if (!materialNo) {
            errors.push({ row: idx + 1, error: 'materialNo required' });
            continue;
          }

          // Atomic check-and-update
          const lotsCondition = lotsNumber ? `lots_number = $2` : `(lots_number IS NULL OR lots_number = '')`;
          const params = lotsNumber ? [materialNo, lotsNumber, qty] : [materialNo, qty];
          const qtyParam = lotsNumber ? '$3' : '$2';

          const result = await query(
            `UPDATE local_inventory
             SET quantity = quantity - ${qtyParam}, updated_at = NOW()
             WHERE material_no = $1 AND ${lotsCondition} AND quantity >= ${qtyParam}
             RETURNING *`,
            params,
          );

          if (result.rows.length === 0) {
            errors.push({ row: idx + 1, materialNo, error: 'Insufficient quantity or item not found' });
            continue;
          }

          const row = result.rows[0];

          // Log charge-out transaction
          await query(
            `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
             VALUES ($1, $2, $3, $4, $5, 'charge_out', $6, $7, $8)`,
            [
              row.id,
              materialNo,
              lotsNumber,
              -qty,
              row.quantity,
              req.user?.id || null,
              req.user?.username || null,
              notes,
            ],
          );

          processed.push(snakeToCamel(row));
        } catch (e) {
          errors.push({ row: idx + 1, error: e.message });
        }
      }
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK');
      return res.status(500).json({ error: e.message });
    }

    res.json({ success: true, processed: processed.length, errors, items: processed });
  }),
);

// POST /adjust — admin quantity adjustment (bulk)
router.post(
  '/adjust',
  asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });

    const processed = [];
    const errors = [];

    await query('BEGIN');
    try {
      for (const [idx, item] of items.entries()) {
        try {
          const materialNo = item.materialNo || item.material_no;
          const lotsNumber = item.lotsNumber || item.lots_number || null;
          const qtyDelta = parseInt(item.quantity) || 0;

          if (!materialNo) {
            errors.push({ row: idx + 1, error: 'materialNo required' });
            continue;
          }
          if (qtyDelta === 0) {
            errors.push({ row: idx + 1, error: 'quantity must be non-zero' });
            continue;
          }

          const lotsCondition = lotsNumber ? `lots_number = $2` : `(lots_number IS NULL OR lots_number = '')`;
          const params = lotsNumber ? [materialNo, lotsNumber, qtyDelta] : [materialNo, qtyDelta];
          const deltaParam = lotsNumber ? '$3' : '$2';

          const result = await query(
            `UPDATE local_inventory
             SET quantity = GREATEST(0, quantity + ${deltaParam}), updated_at = NOW()
             WHERE material_no = $1 AND ${lotsCondition}
             RETURNING *`,
            params,
          );

          if (result.rows.length === 0) {
            errors.push({ row: idx + 1, materialNo, error: 'Item not found' });
            continue;
          }

          const row = result.rows[0];

          await query(
            `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
             VALUES ($1, $2, $3, $4, $5, 'adjustment', $6, $7, $8)`,
            [
              row.id,
              materialNo,
              lotsNumber,
              qtyDelta,
              row.quantity,
              req.user?.id || null,
              req.user?.username || null,
              `Admin adjustment`,
            ],
          );

          processed.push(snakeToCamel(row));
        } catch (e) {
          errors.push({ row: idx + 1, error: e.message });
        }
      }
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK');
      return res.status(500).json({ error: e.message });
    }

    res.json({ success: true, processed: processed.length, errors, items: processed });
  }),
);

// PUT /:id — update inventory item metadata
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const b = pickAllowed(camelToSnake(req.body), INVENTORY_FIELDS);
    b.updated_at = new Date().toISOString();
    const keys = Object.keys(b);
    const vals = Object.values(b);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const sql = `UPDATE local_inventory SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...vals, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(snakeToCamel(result.rows[0]));
  }),
);

// DELETE /:id — delete inventory item
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query('DELETE FROM local_inventory WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  }),
);

export default router;
