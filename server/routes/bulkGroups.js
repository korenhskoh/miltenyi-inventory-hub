import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields, sanitizeDates } from '../validation.js';
import { paginate, envelope, limitClause } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission, userHasPermission } from '../middleware/permissions.js';

const router = Router();

const BULK_GROUP_FIELDS = ['id', 'month', 'created_by', 'items', 'total_cost', 'status', 'date'];
const BG_DATE_FIELDS = ['date'];
const BULK_GROUP_REQUIRED = ['id', 'month'];

// Case-insensitive: a capitalised-only check let `status: 'approved'` through.
const DECIDED_STATUSES = new Set(['approved', 'rejected']);
const isDecidedStatus = (v) => DECIDED_STATUSES.has(String(v ?? '').toLowerCase());

// GET / - list all bulk groups
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginate(req.query);
    const countResult = await query('SELECT COUNT(*) FROM bulk_groups');
    const total = parseInt(countResult.rows[0].count);
    const lim = limitClause(req, 1);
    const dataResult = await query(`SELECT * FROM bulk_groups ORDER BY id DESC${lim.clause}`, lim.params);
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, lim.clause ? page : 1, lim.clause ? pageSize : rows.length));
  }),
);

// POST / - create bulk group
router.post('/', async (req, res) => {
  try {
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), BULK_GROUP_FIELDS), BG_DATE_FIELDS);
    const err = requireFields(snakeBody, BULK_GROUP_REQUIRED);
    if (err) return res.status(400).json({ error: err });

    // A group may not be created already approved / rejected.
    if (isDecidedStatus(snakeBody.status) && !(await userHasPermission(req.user, 'approvals'))) {
      return res.status(403).json({ error: 'Permission required: approvals' });
    }

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO bulk_groups (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - update bulk group
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), BULK_GROUP_FIELDS), BG_DATE_FIELDS);
    if (isDecidedStatus(snakeBody.status) && !(await userHasPermission(req.user, 'approvals'))) {
      return res.status(403).json({ error: 'Permission required: approvals' });
    }
    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const sql = `UPDATE bulk_groups SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulk group not found' });
    }

    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Deleting a batch must not strand its orders.
//
// `orders.bulk_group_id` is a plain column with no foreign key, so deleting a
// batch left its orders pointing at a group that no longer existed — and an
// order in that state is invisible almost everywhere: the Orders page filters
// out anything with a bulk group id, and the Part Arrival bulk table iterates
// the groups, which no longer include it. Approved-but-undelivered orders could
// not be received at all, while still counting in every dashboard total. The
// React delete path cascades and removes the orders itself; the WhatsApp bot
// and a direct API call did not.
//
// They are released rather than deleted: clearing the link turns them back into
// ordinary single orders, which are visible and receivable. Destroying real
// order history as a side effect of tidying a batch would be worse than the bug.
async function releaseOrders(client, id) {
  const r = await client.query('UPDATE orders SET bulk_group_id = NULL WHERE bulk_group_id = $1 RETURNING id', [id]);
  return r.rowCount;
}

// DELETE /all - delete all bulk groups
router.delete('/all', requireAdmin, async (req, res) => {
  try {
    const released = await withTransaction(async (client) => {
      const r = await client.query('UPDATE orders SET bulk_group_id = NULL WHERE bulk_group_id IS NOT NULL');
      await client.query('DELETE FROM bulk_groups');
      return r.rowCount;
    });
    res.json({ success: true, ordersReleased: released });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete bulk group
router.delete('/:id', requirePermission('deleteBulkOrders'), async (req, res) => {
  try {
    const { id } = req.params;
    const out = await withTransaction(async (client) => {
      const released = await releaseOrders(client, id);
      const result = await client.query('DELETE FROM bulk_groups WHERE id = $1 RETURNING *', [id]);
      return { found: result.rows.length > 0, released };
    });

    if (!out.found) {
      return res.status(404).json({ error: 'Bulk group not found' });
    }

    res.json({ success: true, ordersReleased: out.released });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
