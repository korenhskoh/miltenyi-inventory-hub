import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields, sanitizeDates } from '../validation.js';
import { paginate, envelope, limitClause } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import logger from '../logger.js';
import { requirePermission, userHasPermission } from '../middleware/permissions.js';

const router = Router();

// Allowed fields for order create/update (prevents mass assignment)
const ORDER_FIELDS = [
  'id',
  'material_no',
  'description',
  'quantity',
  'list_price',
  'total_cost',
  'order_date',
  'order_by',
  'remark',
  'arrival_date',
  'qty_received',
  'back_order',
  'engineer',
  'email_full',
  'email_back',
  'status',
  'approval_status',
  'approval_sent_date',
  'month',
  'year',
  'bulk_group_id',
  'arrival_checked_by',
];
const ORDER_REQUIRED = ['id', 'description', 'quantity'];

const ORDER_DATE_FIELDS = ['order_date', 'arrival_date', 'approval_sent_date'];

// Allowed columns for ORDER BY (prevents SQL injection)
const ALLOWED_ORDER_COLUMNS = new Set([...ORDER_FIELDS, 'created_at']);

const APPROVAL_STATUSES = new Set(['approved', 'rejected']);
const lower = (v) => String(v ?? '').toLowerCase();

// Does this write record an approval decision? Only users with the 'approvals'
// permission (or admins) may do that. Both fields are compared case
// INSENSITIVELY: a capitalised-only check let `status: 'approved'` through.
function isApprovalDecision(body) {
  return APPROVAL_STATUSES.has(lower(body.approval_status)) || APPROVAL_STATUSES.has(lower(body.status));
}

// Does this write close an order out as delivered? Allowed for anyone doing
// part arrival, but only once the order has actually been approved.
function isCloseOut(body) {
  return body.qty_received !== undefined || lower(body.status) === 'received';
}

// GET /stats - server-side aggregates for the dashboard (never subject to paging)
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const totals = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Pending Approval')::int AS pending_approval,
        COUNT(*) FILTER (WHERE status = 'Approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'Received')::int AS received,
        COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE back_order < 0)::int AS back_orders,
        COALESCE(SUM(total_cost), 0)::float AS total_value,
        COALESCE(SUM(total_cost) FILTER (WHERE status = 'Received'), 0)::float AS received_value
      FROM orders
    `);
    const byMonth = await query(`
      SELECT
        to_char(date_trunc('month', order_date), 'YYYY-MM') AS ym,
        COUNT(*)::int AS orders,
        COALESCE(SUM(quantity), 0)::int AS items,
        COALESCE(SUM(total_cost), 0)::float AS value
      FROM orders
      WHERE order_date IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `);
    const topMaterials = await query(`
      SELECT material_no, MAX(description) AS description, SUM(quantity)::int AS quantity, COUNT(*)::int AS orders
      FROM orders
      WHERE material_no IS NOT NULL AND material_no <> ''
      GROUP BY material_no
      ORDER BY quantity DESC
      LIMIT 10
    `);
    res.json({
      totals: snakeToCamel(totals.rows[0]),
      byMonth: byMonth.rows,
      topMaterials: topMaterials.rows.map(snakeToCamel),
    });
  }),
);

// GET / - list all orders, optional query params: status, month, orderBy, page, limit
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, month, orderBy } = req.query;
    const { page, pageSize } = paginate(req.query);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (month) {
      conditions.push(`month = $${paramIndex++}`);
      params.push(month);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    let orderClause = ' ORDER BY id DESC';
    if (orderBy) {
      const snakeCol = orderBy.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      if (ALLOWED_ORDER_COLUMNS.has(snakeCol)) {
        orderClause = ` ORDER BY ${snakeCol}`;
      }
    }

    const countResult = await query(`SELECT COUNT(*) FROM orders${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const lim = limitClause(req, paramIndex);
    const dataResult = await query(`SELECT * FROM orders${whereClause}${orderClause}${lim.clause}`, [
      ...params,
      ...lim.params,
    ]);
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, lim.clause ? page : 1, lim.clause ? pageSize : rows.length));
  }),
);

// POST / - create order
router.post('/', async (req, res) => {
  try {
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), ORDER_FIELDS), ORDER_DATE_FIELDS);
    const err = requireFields(snakeBody, ORDER_REQUIRED);
    if (err) return res.status(400).json({ error: err });

    // An order may not be born already approved / rejected / received — that
    // would skip the approval workflow entirely.
    if ((isApprovalDecision(snakeBody) || isCloseOut(snakeBody)) && !(await userHasPermission(req.user, 'approvals'))) {
      return res.status(403).json({ error: 'Permission required: approvals' });
    }

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO orders (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /bulk-status - update status of multiple orders
router.put('/bulk-status', async (req, res) => {
  try {
    const { ids, status, approvalStatus } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    const bulkBody = { status, approval_status: approvalStatus };
    const canApprove = await userHasPermission(req.user, 'approvals');
    if (isApprovalDecision(bulkBody) && !canApprove) {
      return res.status(403).json({ error: 'Permission required: approvals' });
    }
    // Closing orders out as received without the 'approvals' permission is fine
    // for part-arrival work, but it must not become a way around the approval
    // gate: restrict the update to orders that are already approved.
    const approvedOnly = isCloseOut(bulkBody) && !canApprove;

    const params = approvalStatus ? [status, approvalStatus] : [status];
    const placeholders = ids.map((_, i) => `$${i + params.length + 1}`).join(', ');
    const setClause = approvalStatus ? 'status = $1, approval_status = $2' : 'status = $1';
    const sql = `UPDATE orders SET ${setClause} WHERE id IN (${placeholders})${
      approvedOnly ? " AND approval_status = 'approved'" : ''
    } RETURNING *`;
    const result = await query(sql, [...params, ...ids]);
    const rows = result.rows.map(snakeToCamel);
    // Keep the array response contract; 207 signals that some ids were skipped
    // because they had not been approved.
    if (approvedOnly && rows.length < ids.length) {
      logger.warn(
        { userId: req.user?.id, requested: ids.length, updated: rows.length },
        'Bulk close-out skipped unapproved orders',
      );
      return res.status(207).json(rows);
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - update order by id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), ORDER_FIELDS), ORDER_DATE_FIELDS);

    if (isApprovalDecision(snakeBody) && !(await userHasPermission(req.user, 'approvals'))) {
      return res.status(403).json({ error: 'Permission required: approvals' });
    }

    // Enforce approval before allowing part arrival / close-out.
    // Skip check if this request is also setting approval_status to 'approved'.
    if (isCloseOut(snakeBody) && lower(snakeBody.approval_status) !== 'approved') {
      const check = await query('SELECT approval_status FROM orders WHERE id = $1', [id]);
      if (check.rows.length && check.rows[0].approval_status !== 'approved') {
        return res.status(403).json({ error: 'Order must be approved before recording part arrival' });
      }
    }

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const sql = `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(snakeToCamel(result.rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /all - delete all orders
router.delete('/all', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM orders');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id - delete order by id
router.delete('/:id', requirePermission('deleteOrders'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
