import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';
import { paginate, envelope, limitClause } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { APP_TIMEZONE } from '../appDates.js';

const router = Router();

const INVENTORY_FIELDS = ['material_no', 'description', 'lots_number', 'category', 'quantity'];
// Metadata-only fields for PUT: quantity changes must go through /adjust so they are logged.
const INVENTORY_META_FIELDS = ['material_no', 'description', 'lots_number', 'category'];

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

/**
 * GET /consumption — the demand history a forecast should actually use.
 *
 * The forecasting page was built on ORDER history, which is a lumpy proxy for
 * demand: thirty pump heads bought once and drawn down over a year look like a
 * single enormous month followed by eleven empty ones. What the team wants to
 * predict is consumption, and that is recorded here — `charge_out` rows carry a
 * real timestamp, so the month axis needs no guessing, and the type column
 * keeps corrections and arrivals out of the series.
 *
 * Returns one row per material per month, plus the stock on hand now and the
 * part's own observed lead time, because a forecast without those two is a
 * chart rather than a reorder decision.
 */
router.get(
  '/consumption',
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(parseInt(req.query.months, 10) || 36, 1), 120);

    const [series, stock, lead] = await Promise.all([
      query(
        `SELECT material_no,
                to_char(date_trunc('month', created_at AT TIME ZONE $2), 'YYYY-MM') AS month,
                SUM(-quantity_change)::int AS qty
           FROM inventory_transactions
          WHERE type = 'charge_out'
            AND created_at >= date_trunc('month', NOW()) - ($1 || ' months')::interval
          GROUP BY 1, 2
         HAVING SUM(-quantity_change) > 0
          ORDER BY 1, 2`,
        [String(months), APP_TIMEZONE],
      ),
      query(
        `SELECT material_no,
                SUM(quantity)::int AS quantity,
                MIN(description) FILTER (WHERE description IS NOT NULL AND description <> '') AS description
           FROM local_inventory
          GROUP BY material_no`,
      ),
      // Lead time from the orders themselves: how long this part actually took
      // to arrive, per part rather than averaged across all of them.
      query(
        `SELECT material_no,
                ROUND(AVG(arrival_date - order_date))::int AS avg_days,
                MAX(arrival_date - order_date)::int AS max_days,
                COUNT(*)::int AS samples
           FROM orders
          WHERE material_no IS NOT NULL
            AND order_date IS NOT NULL
            AND arrival_date IS NOT NULL
            AND arrival_date >= order_date
            AND arrival_date - order_date <= 365
          GROUP BY material_no`,
      ),
    ]);

    res.json({
      months,
      timezone: APP_TIMEZONE,
      series: series.rows,
      stock: stock.rows,
      leadTimes: lead.rows,
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
    const { page, pageSize } = paginate(req.query);
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
    const lim = limitClause(req, pi);
    const dataResult = await query(`SELECT * FROM local_inventory${where} ORDER BY updated_at DESC${lim.clause}`, [
      ...params,
      ...lim.params,
    ]);
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, lim.clause ? page : 1, lim.clause ? pageSize : rows.length));
  }),
);

// POST / — add single inventory item (upsert on material_no + lots_number)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = pickAllowed(camelToSnake(req.body), INVENTORY_FIELDS);
    if (!b.material_no) return res.status(400).json({ error: 'material_no required' });

    const lotsKey = b.lots_number || null;
    const qty = parseInt(b.quantity, 10) || 0;
    // "Add item" must not become an unlogged way to overwrite stock: refuse the
    // conflict and point the user at Adjust Qty, which writes a transaction row.
    const result = await query(
      `INSERT INTO local_inventory (material_no, description, lots_number, category, quantity)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (material_no, COALESCE(lots_number, '__none__')) DO NOTHING
       RETURNING *`,
      [b.material_no, b.description || null, lotsKey, b.category || null, qty],
    );
    if (result.rows.length === 0) {
      return res.status(409).json({
        error: `${b.material_no}${lotsKey ? ` (Lot ${lotsKey})` : ''} already exists — use Adjust Qty to change the quantity.`,
      });
    }
    const created = result.rows[0];
    await query(
      `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
       VALUES ($1, $2, $3, $4, $5, 'import', $6, $7, $8)`,
      [created.id, b.material_no, lotsKey, qty, qty, req.user?.id || null, req.user?.username || null, 'Item created'],
    );
    res.status(201).json(snakeToCamel(created));
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

    try {
      await withTransaction(async (tx) => {
        for (const [idx, item] of items.entries()) {
          // Per-row savepoint: one bad row must not abort the whole transaction
          await tx.query('SAVEPOINT row_sp');
          try {
            const b = pickAllowed(camelToSnake(item), INVENTORY_FIELDS);
            if (!b.material_no) {
              errors.push({ row: idx + 1, error: 'material_no required' });
              continue;
            }
            const lotsKey = b.lots_number || null;
            const qty = parseInt(b.quantity) || 0;

            // Capture the prior quantity first: an upsert's RETURNING clause can
            // only see the new row, and an import SETS the quantity, so the
            // movement we log has to be the difference. (Logging the absolute
            // figure made the history read as if stock had only ever been added.)
            const prior = await tx.query(
              `SELECT quantity FROM local_inventory
               WHERE material_no = $1 AND COALESCE(lots_number, '__none__') = COALESCE($2, '__none__')`,
              [b.material_no, lotsKey],
            );
            const before = prior.rows.length ? Number(prior.rows[0].quantity) || 0 : 0;

            const result = await tx.query(
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
            await tx.query(
              `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
               VALUES ($1, $2, $3, $4, $5, 'import', $6, $7, $8)`,
              [
                row.id,
                b.material_no,
                lotsKey,
                qty - before,
                qty,
                req.user?.id || null,
                req.user?.username || null,
                `Bulk import row ${idx + 1}`,
              ],
            );

            if (wasInsert) inserted.push(snakeToCamel(row));
            else updated.push(snakeToCamel(row));
            await tx.query('RELEASE SAVEPOINT row_sp');
          } catch (e) {
            await tx.query('ROLLBACK TO SAVEPOINT row_sp');
            errors.push({ row: idx + 1, error: e.message });
          }
        }
      });
    } catch (e) {
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

    try {
      await withTransaction(async (tx) => {
        for (const [idx, item] of items.entries()) {
          // Per-row savepoint: one bad row must not abort the whole transaction
          await tx.query('SAVEPOINT row_sp');
          try {
            const materialNo = item.materialNo || item.material_no;
            const lotsNumber = item.lotsNumber || item.lots_number || null;
            // `|| 1` turned a cleared field into a real movement: charging out
            // zero removed one unit and reported success. The arrival handler
            // next door already skips an unusable quantity; match it.
            const qty = Math.abs(parseInt(item.quantity, 10) || 0);
            const notes = item.notes || '';

            if (!materialNo) {
              errors.push({ row: idx + 1, error: 'materialNo required' });
              continue;
            }
            if (!qty) {
              errors.push({ row: idx + 1, materialNo, error: 'Quantity must be at least 1' });
              continue;
            }

            // Atomic check-and-update
            const lotsCondition = lotsNumber ? `lots_number = $2` : `(lots_number IS NULL OR lots_number = '')`;
            const params = lotsNumber ? [materialNo, lotsNumber, qty] : [materialNo, qty];
            const qtyParam = lotsNumber ? '$3' : '$2';

            const result = await tx.query(
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
            await tx.query(
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
            await tx.query('RELEASE SAVEPOINT row_sp');
          } catch (e) {
            await tx.query('ROLLBACK TO SAVEPOINT row_sp');
            errors.push({ row: idx + 1, error: e.message });
          }
        }
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    res.json({ success: true, processed: processed.length, errors, items: processed });
  }),
);

// POST /adjust — admin quantity adjustment (bulk)
router.post(
  '/adjust',
  // Was `req.user?.role !== 'admin'`, i.e. the role claim baked into the token —
  // a demoted account kept admin powers here until its 24h token expired.
  // requireAdmin re-checks against the database.
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });

    const processed = [];
    const errors = [];

    try {
      await withTransaction(async (tx) => {
        for (const [idx, item] of items.entries()) {
          // Per-row savepoint: one bad row must not abort the whole transaction
          await tx.query('SAVEPOINT row_sp');
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

            // Locks the row and carries the pre-update quantity out with the
            // result, so the logged movement can be the change that actually
            // happened rather than the one that was asked for.
            const result = await tx.query(
              `WITH prev AS (
                 SELECT id, quantity FROM local_inventory
                 WHERE material_no = $1 AND ${lotsCondition}
                 FOR UPDATE
               )
               UPDATE local_inventory li
               SET quantity = GREATEST(0, li.quantity + ${deltaParam}), updated_at = NOW()
               FROM prev
               WHERE li.id = prev.id
               RETURNING li.*, prev.quantity AS previous_quantity`,
              params,
            );

            if (result.rows.length === 0) {
              errors.push({ row: idx + 1, materialNo, error: 'Item not found' });
              continue;
            }

            const row = result.rows[0];
            const before = Number(row.previous_quantity) || 0;

            // The UPDATE clamps at 0, so the requested delta and the change that
            // actually happened can differ (2 on hand, -5 requested -> 0). Logging
            // the requested figure left the ledger permanently out of step with the
            // stored quantity; log what really moved.
            const appliedDelta = row.quantity - before;

            await tx.query(
              `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
               VALUES ($1, $2, $3, $4, $5, 'adjustment', $6, $7, $8)`,
              [
                row.id,
                materialNo,
                lotsNumber,
                appliedDelta,
                row.quantity,
                req.user?.id || null,
                req.user?.username || null,
                appliedDelta === qtyDelta
                  ? `Admin adjustment`
                  : `Admin adjustment (requested ${qtyDelta}, clamped at zero)`,
              ],
            );

            processed.push(snakeToCamel(row));
            await tx.query('RELEASE SAVEPOINT row_sp');
          } catch (e) {
            await tx.query('ROLLBACK TO SAVEPOINT row_sp');
            errors.push({ row: idx + 1, error: e.message });
          }
        }
      });
    } catch (e) {
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
    // Quantity changes must go through /adjust so they are logged; silently
    // dropping the field made the SPA report a successful save that did nothing.
    if (camelToSnake(req.body).quantity !== undefined) {
      return res.status(400).json({ error: 'Quantity cannot be changed here — use Adjust Qty.' });
    }
    const b = pickAllowed(camelToSnake(req.body), INVENTORY_META_FIELDS, { keepNull: true });
    if (b.lots_number === '') b.lots_number = null;
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

// POST /arrival — auto-add quantities from confirmed part arrivals
router.post(
  '/arrival',
  // Raises stock levels, so it needs the same permission as the Part Arrival
  // page it serves. Without this any logged-in user could inflate any item's
  // quantity, which made the admin-only /adjust gate cosmetic.
  requirePermission('delivery'),
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });

    const processed = [];
    const skipped = [];

    try {
      await withTransaction(async (tx) => {
        for (const item of items) {
          const materialNo = item.materialNo || item.material_no;
          const qty = Math.abs(parseInt(item.quantity) || 0);
          if (!materialNo || qty === 0) {
            skipped.push({ materialNo, reason: 'missing materialNo or zero quantity' });
            continue;
          }

          const description = item.description || null;
          const lotsNumber = item.lotsNumber || item.lots_number || null;

          // Upsert: if exists add to quantity, if not create new entry
          const result = await tx.query(
            `INSERT INTO local_inventory (material_no, description, lots_number, quantity)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (material_no, COALESCE(lots_number, '__none__'))
             DO UPDATE SET quantity = local_inventory.quantity + $4,
                           description = COALESCE(EXCLUDED.description, local_inventory.description),
                           updated_at = NOW()
             RETURNING *, (xmax = 0) AS is_insert`,
            [materialNo, description, lotsNumber, qty],
          );

          const row = result.rows[0];

          // Log arrival transaction
          await tx.query(
            `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
             VALUES ($1, $2, $3, $4, $5, 'arrival', $6, $7, $8)`,
            [
              row.id,
              materialNo,
              lotsNumber,
              qty,
              row.quantity,
              req.user?.id || null,
              req.user?.username || null,
              `Part arrival confirmed`,
            ],
          );

          processed.push({ materialNo, quantity: qty, newTotal: row.quantity, isNew: row.is_insert });
        }
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    res.json({ success: true, processed: processed.length, skipped, items: processed });
  }),
);

// ── Stock-check reconciliation ────────────────────────────────────────────────
// The team counts stock against a spreadsheet that carries the period's charge
// in / charge out movements and (usually) a counted closing balance. Neither
// "Import" (absolute set) nor "Adjust" (single delta) could express that: one
// of the two movement columns was always lost. This endpoint takes both, plus
// an optional counted figure, and records each movement as its own transaction
// so the history reflects what physically happened.
//
// For every row:
//     net       = chargeIn - chargeOut
//     expected  = current + net
//     target    = counted (when the sheet was counted) else expected
//     variance  = target - expected        // what the count disagreed by
const nonNeg = (v) => Math.max(0, Math.round(Number(v) || 0));

// A physical count must be a real number. `Number('-') || 0` is 0, which would
// read a "not counted" marker as a counted zero and wipe that item's stock, so
// anything unparseable is treated as no count at all.
function countedValue(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function planRow(item, current) {
  const chargeIn = nonNeg(item.chargeIn);
  const chargeOut = nonNeg(item.chargeOut);
  const counted = countedValue(item.countedQty);
  const before = current === null ? 0 : Number(current) || 0;
  const net = chargeIn - chargeOut;
  const expected = before + net;
  const target = counted === null ? expected : counted;
  return { chargeIn, chargeOut, counted, before, net, expected, target, variance: target - expected };
}

router.post(
  '/reconcile',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { items, dryRun = false, reference = '' } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    if (items.length > 5000) return res.status(400).json({ error: 'Too many rows — split the file (max 5000).' });

    const note = `Stock check${reference ? ` ${reference}` : ''}`;
    const rows = [];

    // `forUpdate` locks the row for the rest of the transaction. Without it this
    // was a read-then-absolute-write: a charge-out committing while the reconcile
    // loop was still working through later rows was silently overwritten when the
    // reconcile finally set the row to its pre-computed target, re-creating parts
    // that had genuinely been issued and leaving the ledger permanently at odds
    // with the stock level. The dry run takes no lock — it writes nothing.
    const lookup = async (q, materialNo, lotsNumber, forUpdate = false) => {
      const r = await q(
        `SELECT * FROM local_inventory
         WHERE material_no = $1 AND COALESCE(lots_number, '__none__') = COALESCE($2, '__none__')
         ${forUpdate ? 'FOR UPDATE' : ''}`,
        [materialNo, lotsNumber],
      );
      return r.rows[0] || null;
    };

    // Dry run: compute only, touch nothing.
    if (dryRun) {
      for (const [idx, item] of items.entries()) {
        const materialNo = String(item.materialNo || '').trim();
        const lotsNumber = String(item.lotsNumber || '').trim() || null;
        if (!materialNo) {
          rows.push({ row: idx + 1, status: 'error', error: 'Material number is missing' });
          continue;
        }
        const existing = await lookup(query, materialNo, lotsNumber);
        const plan = planRow(item, existing ? existing.quantity : null);
        const status = plan.target < 0 ? 'error' : existing ? 'ok' : 'new';
        rows.push({
          row: idx + 1,
          materialNo,
          lotsNumber,
          description: existing?.description || item.description || '',
          ...plan,
          status,
          error: plan.target < 0 ? `Result would be ${plan.target} — check the charge out figure` : undefined,
        });
      }
      return res.json({ dryRun: true, applied: 0, rows, errors: rows.filter((r) => r.status === 'error').length });
    }

    try {
      await withTransaction(async (tx) => {
        for (const [idx, item] of items.entries()) {
          await tx.query('SAVEPOINT row_sp');
          try {
            const materialNo = String(item.materialNo || '').trim();
            const lotsNumber = String(item.lotsNumber || '').trim() || null;
            if (!materialNo) {
              rows.push({ row: idx + 1, status: 'error', error: 'Material number is missing' });
              await tx.query('RELEASE SAVEPOINT row_sp');
              continue;
            }

            const existing = await lookup((q, p) => tx.query(q, p), materialNo, lotsNumber, true);
            const plan = planRow(item, existing ? existing.quantity : null);

            if (plan.target < 0) {
              rows.push({
                row: idx + 1,
                materialNo,
                lotsNumber,
                ...plan,
                status: 'error',
                error: `Result would be ${plan.target} — check the charge out figure`,
              });
              await tx.query('RELEASE SAVEPOINT row_sp');
              continue;
            }

            let id = existing?.id;
            if (!existing) {
              const created = await tx.query(
                `INSERT INTO local_inventory (material_no, description, lots_number, category, quantity)
                 VALUES ($1, $2, $3, $4, 0) RETURNING *`,
                [materialNo, item.description || null, lotsNumber, item.category || null],
              );
              id = created.rows[0].id;
            }

            // Record each movement separately so the item history is truthful.
            let running = plan.before;
            const logTxn = async (change, after, type, txnNote) =>
              tx.query(
                `INSERT INTO inventory_transactions (inventory_id, material_no, lots_number, quantity_change, quantity_after, type, user_id, user_name, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  id,
                  materialNo,
                  lotsNumber,
                  change,
                  after,
                  type,
                  req.user?.id || null,
                  req.user?.username || null,
                  txnNote,
                ],
              );

            if (plan.chargeIn > 0) {
              running += plan.chargeIn;
              await logTxn(plan.chargeIn, running, 'arrival', `${note} — charge in`);
            }
            if (plan.chargeOut > 0) {
              running -= plan.chargeOut;
              await logTxn(-plan.chargeOut, running, 'charge_out', `${note} — charge out`);
            }
            if (plan.variance !== 0) {
              running += plan.variance;
              await logTxn(plan.variance, running, 'adjustment', `${note} — count variance`);
            }

            await tx.query('UPDATE local_inventory SET quantity = $1, updated_at = NOW() WHERE id = $2', [
              plan.target,
              id,
            ]);

            rows.push({
              row: idx + 1,
              materialNo,
              lotsNumber,
              description: existing?.description || item.description || '',
              ...plan,
              status: existing ? 'ok' : 'created',
            });
            await tx.query('RELEASE SAVEPOINT row_sp');
          } catch (e) {
            await tx.query('ROLLBACK TO SAVEPOINT row_sp');
            rows.push({ row: idx + 1, status: 'error', error: e.message });
          }
        }
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    const errors = rows.filter((r) => r.status === 'error');
    res.json({
      dryRun: false,
      applied: rows.length - errors.length,
      created: rows.filter((r) => r.status === 'created').length,
      errors: errors.length,
      rows,
    });
  }),
);

// DELETE /:id — delete inventory item (admin only; the SPA hides it for others)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query('DELETE FROM local_inventory WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  }),
);

export default router;
