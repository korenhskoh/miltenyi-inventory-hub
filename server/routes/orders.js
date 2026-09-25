import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, requireFields, sanitizeDates } from '../validation.js';
import { paginate, envelope, limitClause } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import logger from '../logger.js';
import { notifyEvent } from '../notify.js';
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
export function isApprovalDecision(body) {
  return APPROVAL_STATUSES.has(lower(body.approval_status)) || APPROVAL_STATUSES.has(lower(body.status));
}

// Does this write PULL BACK an existing approval? Kept separate from
// isApprovalDecision because a new order is legitimately born 'pending' — it is
// only un-approving something that needs the permission. Without this, anyone
// could send an approved order back to Pending Approval.
export function isApprovalReset(body) {
  return lower(body.approval_status) === 'pending' || lower(body.status) === 'pending approval';
}

// Does this write close an order out as delivered? Allowed for anyone doing
// part arrival, but only once the order has actually been approved.
//
// The test is a RECEIVED QUANTITY GREATER THAN ZERO, not the mere presence of
// the field. The New Order form sends `qtyReceived: 0` on every create — it is
// how the column is initialised — and pickAllowed keeps a literal 0, so the old
// check treated every new order as a delivery close-out and refused it unless
// the person held the approvals permission. Admins were unaffected, because the
// permission check short-circuits on their role, so the app looked healthy to
// whoever set it up while nobody else could raise an order at all.
/**
 * Fields that belong to part-arrival work rather than to editing an order.
 *
 * Ownership governs ordinary edits — quantity, price, material. Recording a
 * delivery is a different job, done by whoever is on goods-in, routinely on
 * orders somebody else raised. That is what the `delivery` permission is for,
 * so an arrival-only write is judged on that instead of on who owns the order.
 */
const ARRIVAL_FIELDS = new Set(['qty_received', 'back_order', 'arrival_date', 'arrival_checked_by', 'status']);

function isArrivalOnlyWrite(body) {
  const keys = Object.keys(body);
  if (keys.length === 0) return false;
  if (!keys.every((k) => ARRIVAL_FIELDS.has(k))) return false;
  // `status` is in the set only so a close-out can carry it; any other status
  // change is an ordinary edit and stays subject to ownership.
  if ('status' in body && lower(body.status) !== 'received') return false;
  return true;
}

export function isCloseOut(body) {
  return Number(body.qty_received) > 0 || lower(body.status) === 'received';
}

/**
 * Fields that belong to an approval decision rather than to editing an order.
 *
 * Deciding an approval is a different job from editing, done by definition on
 * orders somebody else raised — that is what the `approvals` permission is for.
 * But ownership was still being enforced over the top of it, and `approvals`
 * and `editAllOrders` are both off by default, so an approver who held exactly
 * the permission the job needs was refused with "You can only edit your own
 * orders".
 *
 * That failed in the worst possible way. The client updates the approval record
 * first — which succeeds, because that endpoint only checks `approvals` — and
 * then updates the order, which was refused. The request leaves the queue, the
 * order stays Pending Approval, and there is no longer a button anywhere to try
 * again; only an admin can rescue it. It looked fine to whoever set the system
 * up, because an admin's permission check short-circuits.
 *
 * So an approval-only write is judged on `approvals`, exactly as an arrival-only
 * write is judged on `delivery`. Anything beyond these fields is an ordinary
 * edit and stays subject to ownership.
 */
const APPROVAL_FIELDS = new Set(['status', 'approval_status', 'approval_sent_date']);

export function isApprovalOnlyWrite(body) {
  const keys = Object.keys(body || {});
  if (keys.length === 0) return false;
  if (!keys.every((k) => APPROVAL_FIELDS.has(k))) return false;
  return isApprovalDecision(body) || isApprovalReset(body);
}

// GET /stats - server-side aggregates for the dashboard (never subject to paging)
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    // `effective_total` mirrors getEffectiveTotal() in src/lib/pricing.js: the
    // price stored on the order wins when it is > 0 (it is what was costed and
    // approved), and the catalog price is a fallback for orders saved before a
    // catalog existed. Summing raw total_cost here made the dashboard report
    // S$0 for those orders while All Orders and the approval emails showed a
    // real figure for the very same rows.
    const totals = await query(`
      WITH priced AS (
        SELECT
          o.*,
          CASE
            -- Every branch requires a real quantity, to match getEffectiveTotal
            -- in src/lib/pricing.js: multiplying a price by a quantity of zero
            -- wrote an imported row's recorded total down to nothing.
            WHEN COALESCE(o.quantity, 0) <= 0 THEN COALESCE(o.total_cost, 0)
            WHEN COALESCE(o.list_price, 0) > 0 THEN o.list_price * o.quantity
            WHEN COALESCE(c.sg_price, 0) > 0 THEN c.sg_price * o.quantity
            WHEN COALESCE(c.transfer_price, 0) > 0 THEN c.transfer_price * o.quantity
            WHEN COALESCE(c.dist_price, 0) > 0 THEN c.dist_price * o.quantity
            ELSE COALESCE(o.total_cost, 0)
          END AS effective_total
        FROM orders o
        LEFT JOIN parts_catalog c ON c.material_no = o.material_no
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Pending Approval')::int AS pending_approval,
        COUNT(*) FILTER (WHERE status = 'Approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'Received')::int AS received,
        COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected,
        -- A back order is a delivery that arrived SHORT — which is what the
        -- Part Arrival page and the back-order report have always meant.
        -- This used to be back_order < 0, a field every order carries from
        -- creation and which is never reset on rejection, so the tile counted
        -- orders that had never even been approved, let alone shipped.
        -- What makes it a back order is that SOMETHING arrived and it was not
        -- everything — not whether an arrival date was typed in. Requiring the
        -- date hid every imported short delivery, because these workbooks
        -- routinely fill the received count and leave the date column blank.
        -- Matches arrivalCondition() in src/lib/arrival.js.
        COUNT(*) FILTER (
          WHERE COALESCE(qty_received, 0) > 0
            AND COALESCE(qty_received, 0) < COALESCE(quantity, 0)
            AND COALESCE(status, '') <> 'Rejected'
        )::int AS back_orders,
        COALESCE(SUM(effective_total), 0)::float AS total_value,
        COALESCE(SUM(effective_total) FILTER (WHERE status = 'Received'), 0)::float AS received_value
      FROM priced
    `);
    const byMonth = await query(`
      SELECT
        to_char(date_trunc('month', o.order_date), 'YYYY-MM') AS ym,
        COUNT(*)::int AS orders,
        COALESCE(SUM(o.quantity), 0)::int AS items,
        COALESCE(SUM(
          CASE
            -- Every branch requires a real quantity, to match getEffectiveTotal
            -- in src/lib/pricing.js: multiplying a price by a quantity of zero
            -- wrote an imported row's recorded total down to nothing.
            WHEN COALESCE(o.quantity, 0) <= 0 THEN COALESCE(o.total_cost, 0)
            WHEN COALESCE(o.list_price, 0) > 0 THEN o.list_price * o.quantity
            WHEN COALESCE(c.sg_price, 0) > 0 THEN c.sg_price * o.quantity
            WHEN COALESCE(c.transfer_price, 0) > 0 THEN c.transfer_price * o.quantity
            WHEN COALESCE(c.dist_price, 0) > 0 THEN c.dist_price * o.quantity
            ELSE COALESCE(o.total_cost, 0)
          END
        ), 0)::float AS value
      FROM orders o
      LEFT JOIN parts_catalog c ON c.material_no = o.material_no
      WHERE o.order_date IS NOT NULL
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
    //
    // Importing history is the one legitimate exception, and it was silently
    // broken: every row of a historical workbook that had already arrived
    // carries status 'Received' and a received quantity, which is exactly what
    // both guards refuse. Anyone but an admin importing two years of orders got
    // "700 of 800 rejected" with no explanation — and a partially-received row
    // was refused too, on the qty_received arm alone.
    //
    // So the import says what it is, with ?historical=1, and is allowed for
    // whoever can reach the importer. It lives on the Settings page, so
    // `settings` is the permission that already gates it; `approvals` is
    // accepted as well for the people who grant it instead. Ordinary order
    // creation never sends the flag and is unchanged.
    const historical = req.query.historical === '1';
    const mayBackfill =
      historical &&
      ((await userHasPermission(req.user, 'settings')) || (await userHasPermission(req.user, 'approvals')));
    if ((isApprovalDecision(snakeBody) || isCloseOut(snakeBody)) && !mayBackfill) {
      if (!(await userHasPermission(req.user, 'approvals'))) {
        return res.status(403).json({
          error: historical
            ? 'Permission required: settings or approvals (importing historical orders)'
            : 'Permission required: approvals',
        });
      }
    }

    const keys = Object.keys(snakeBody);
    const values = Object.values(snakeBody);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO orders (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await query(sql, values);
    const created = snakeToCamel(result.rows[0]);
    res.status(201).json(created);

    // "New order created → Notify team", moved here from the browser.
    //
    // It used to fire only from the SPA, so an order raised through the
    // WhatsApp bot or the API notified nobody however the rule was set. It also
    // reused the approval-request template, which expects an order count, a
    // total quantity and a table this caller has never had — so the message
    // went out with blank fields, no mention of the part actually ordered, and
    // an unsolicited "Reply APPROVE or REJECT" on what is only a notice. The
    // bot treats those words as commands, so it invited replies to a question
    // nobody asked.
    //
    // Two exclusions. A historical import creates hundreds of rows at once and
    // must not message anyone about orders from last year; and an order that
    // belongs to a batch is announced once by the batch, not once per line.
    if (!historical && !created.bulkGroupId) {
      void notifyEvent(
        'orderCreated',
        {
          orderId: created.id,
          description: created.description || '',
          materialNo: created.materialNo || '',
          quantity: created.quantity,
          total: created.totalCost,
          orderBy: created.orderBy || '',
          date: created.orderDate || new Date().toISOString().slice(0, 10),
        },
        { subject: `New order: ${created.description || created.id}` },
      );
    }
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
    if ((isApprovalDecision(bulkBody) || isApprovalReset(bulkBody)) && !canApprove) {
      return res.status(403).json({ error: 'Permission required: approvals' });
    }
    // Closing orders out as received without the 'approvals' permission is fine
    // for part-arrival work, but it must not become a way around the approval
    // gate: restrict the update to orders that are already approved.
    const approvedOnly = isCloseOut(bulkBody) && !canApprove;

    const params = approvalStatus ? [status, approvalStatus] : [status];
    const placeholders = ids.map((_, i) => `$${i + params.length + 1}`).join(', ');
    const setClause = approvalStatus ? 'status = $1, approval_status = $2' : 'status = $1';
    // Ownership, exactly as the single-order endpoint enforces it. Without this
    // the bulk route was a way around a check sitting two functions away: any
    // logged-in person could rewrite the status of every order in the system.
    const bulkArrivalOnly =
      isArrivalOnlyWrite({ status, ...(approvalStatus ? { approval_status: approvalStatus } : {}) }) &&
      (await userHasPermission(req.user, 'delivery'));
    const bulkApprovalOnly =
      isApprovalOnlyWrite({ status, ...(approvalStatus ? { approval_status: approvalStatus } : {}) }) && canApprove;
    if (!bulkArrivalOnly && !bulkApprovalOnly && !(await userHasPermission(req.user, 'editAllOrders'))) {
      // order_by holds a DISPLAY NAME, so ownership has to be resolved against
      // the users table rather than compared to the token. An order with no
      // owner recorded counts as somebody else's, not as yours.
      const notMine = await query(
        `SELECT o.id
           FROM orders o
          WHERE o.id = ANY($1::text[])
            AND NOT EXISTS (
              SELECT 1 FROM users u
               WHERE u.id = $2
                 AND o.order_by IS NOT NULL
                 AND TRIM(o.order_by) <> ''
                 AND (LOWER(TRIM(o.order_by)) = LOWER(TRIM(u.name))
                   OR LOWER(TRIM(o.order_by)) = LOWER(TRIM(u.username)))
            )`,
        [ids, req.user?.id || null],
      );
      if (notMine.rows.length) {
        return res.status(403).json({
          error: `You can only change your own orders — ${notMine.rows.length} of ${ids.length} belong to someone else.`,
        });
      }
    }

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

// POST /:id/arrival — record a part arrival atomically.
//
// This replaces a client-side sequence that could not be made safe: the SPA
// computed the newly-arrived quantity from ITS OWN copy of qty_received, sent
// an absolute value to PUT /:id, and separately fired POST
// /local-inventory/arrival without waiting for either result. Two consequences,
// both seen in practice:
//
//   * Two people (or one double-click) confirming the same 5-unit delivery each
//     computed delta = 5 - 0 and the order landed on qty_received = 5 either
//     way, so nothing looked wrong — but stock was raised twice.
//   * If the order update was rejected (not approved, say) the stock had
//     already been added, leaving phantom units with no order behind them.
//
// Here the delta is computed from the row under lock, and the order update and
// the stock movement share one transaction: both happen or neither does.
router.post(
  '/:id/arrival',
  requirePermission('delivery'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requested = Math.round(Number(req.body?.qtyReceived));
    if (!Number.isFinite(requested) || requested < 0) {
      return res.status(400).json({ error: 'qtyReceived must be a non-negative number' });
    }

    const result = await withTransaction(async (tx) => {
      const found = await tx.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      if (found.rows.length === 0) return { status: 404, body: { error: 'Order not found' } };
      const order = found.rows[0];

      if (order.approval_status !== 'approved') {
        return { status: 403, body: { error: 'Order must be approved before recording part arrival' } };
      }

      const ordered = Number(order.quantity) || 0;
      if (requested > ordered) {
        return { status: 400, body: { error: `Cannot receive ${requested}; only ${ordered} were ordered.` } };
      }

      const already = Number(order.qty_received) || 0;
      const delta = requested - already;
      if (delta < 0) {
        return { status: 400, body: { error: `Already received ${already}; use an adjustment to reduce it.` } };
      }
      if (delta === 0) {
        // Idempotent: a repeated confirmation of the same figure changes
        // nothing rather than booking the stock in a second time.
        return { status: 200, body: { order: snakeToCamel(order), delta: 0, alreadyRecorded: true } };
      }

      const status = requested >= ordered ? 'Received' : order.status;
      const updated = await tx.query(
        `UPDATE orders
         SET qty_received = $1, back_order = $2, status = $3, arrival_date = $4, arrival_checked_by = $5
         WHERE id = $6 RETURNING *`,
        [requested, requested - ordered, status, req.body?.arrivalDate || null, req.body?.arrivalCheckedBy || null, id],
      );

      let inventory = null;
      if (order.material_no) {
        const existing = await tx.query(
          `SELECT * FROM local_inventory
           WHERE material_no = $1 AND (lots_number IS NULL OR lots_number = '')
           FOR UPDATE`,
          [order.material_no],
        );
        let row;
        if (existing.rows.length) {
          const bumped = await tx.query(
            'UPDATE local_inventory SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [delta, existing.rows[0].id],
          );
          row = bumped.rows[0];
        } else {
          // ON CONFLICT, because FOR UPDATE can only lock a row that exists.
          // Two arrivals confirmed at once for a material that has never been
          // stocked — routine when a batch holds the same spare twice and
          // goods-in presses Batch Confirm — both fell through to the INSERT,
          // and the second died on the unique index with a raw 500.
          const created = await tx.query(
            `INSERT INTO local_inventory (material_no, description, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (material_no, COALESCE(lots_number, '__none__'))
             DO UPDATE SET quantity = local_inventory.quantity + EXCLUDED.quantity, updated_at = NOW()
             RETURNING *`,
            [order.material_no, order.description || '', delta],
          );
          row = created.rows[0];
        }
        await tx.query(
          `INSERT INTO inventory_transactions (inventory_id, material_no, quantity_change, quantity_after, type, user_id, user_name, notes)
           VALUES ($1, $2, $3, $4, 'arrival', $5, $6, $7)`,
          [
            row.id,
            order.material_no,
            delta,
            row.quantity,
            req.user?.id || null,
            req.user?.username || null,
            `Part arrival for ${id}`,
          ],
        );
        inventory = snakeToCamel(row);
      }

      return { status: 200, body: { order: snakeToCamel(updated.rows[0]), delta, inventory } };
    });

    res.status(result.status).json(result.body);

    // Fires on the arrival itself, so it happens whether the arrival came from
    // the Part Arrival page, the WhatsApp bot or the API. Deliberately after
    // the response and not awaited: a notification must never delay or fail the
    // operation that triggered it.
    if (result.status === 200 && result.body.delta > 0) {
      const o = result.body.order;
      const shortBy = (Number(o.quantity) || 0) - (Number(o.qtyReceived) || 0);
      void notifyEvent(
        shortBy > 0 ? 'backOrderUpdate' : 'partArrivalDone',
        {
          orderId: o.id,
          description: o.description || '',
          materialNo: o.materialNo || '',
          quantity: o.quantity,
          qtyReceived: o.qtyReceived,
          backOrders: shortBy > 0 ? shortBy : 0,
          received: shortBy > 0 ? 0 : 1,
          totalItems: 1,
          verifiedBy: o.arrivalCheckedBy || '',
          date: o.arrivalDate || new Date().toISOString().slice(0, 10),
          month: o.month || '',
          itemsList: `\u2022 ${(o.description || '').slice(0, 35)}: ${o.qtyReceived}/${o.quantity}`,
        },
        {
          // No templateKey override: it used to point at 'deliveryArrival',
          // whose text reads itemCount and totalValue — fields this caller has
          // never supplied — so every short-delivery message went out saying
          // "Items Delivered: undefined". Defaulting to the rule's own key also
          // means a template customised in Settings is the one that gets used.
          templateKey: shortBy > 0 ? 'backOrderUpdate' : 'partArrivalDone',
          subject: `Part arrival: ${o.description || o.id}`,
          // "Notify requester" means the person who raised the order, not the
          // whole company. A short delivery still goes to the team, because a
          // back order is everyone's problem — which is what that rule says.
          to: shortBy > 0 ? null : o.orderBy || null,
        },
      );

      // "Delivery arrival → Notify assigned engineer" was a switch with nothing
      // behind it: no code read the rule, so the message never fired however it
      // was set. The engineer is recorded on the order and is the person
      // actually waiting for the part, so they are told separately from the
      // requester — and only when they are somebody else, to avoid sending the
      // same person two messages about one delivery.
      const engineer = (o.engineer || '').trim();
      if (
        engineer &&
        engineer.toLowerCase() !==
          String(o.orderBy || '')
            .trim()
            .toLowerCase()
      ) {
        void notifyEvent(
          'deliveryArrival',
          {
            orderId: o.id,
            description: o.description || '',
            materialNo: o.materialNo || '',
            month: o.month || '',
            itemCount: o.qtyReceived,
            quantity: o.quantity,
            qtyReceived: o.qtyReceived,
            totalValue: o.totalCost,
            engineer,
            date: o.arrivalDate || new Date().toISOString().slice(0, 10),
          },
          { subject: `Delivery for ${engineer}: ${o.description || o.id}`, to: engineer },
        );
      }
    }
  }),
);

// PUT /:id - update order by id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snakeBody = sanitizeDates(pickAllowed(camelToSnake(req.body), ORDER_FIELDS), ORDER_DATE_FIELDS);

    if (
      (isApprovalDecision(snakeBody) || isApprovalReset(snakeBody)) &&
      !(await userHasPermission(req.user, 'approvals'))
    ) {
      return res.status(403).json({ error: 'Permission required: approvals' });
    }

    // The SPA only lets you edit your own orders unless you hold editAllOrders,
    // but the server enforced nothing: any authenticated user could rewrite any
    // order's quantity and price, including one already approved by someone
    // else. Mirror the client rule here.
    const arrivalOnly = isArrivalOnlyWrite(snakeBody) && (await userHasPermission(req.user, 'delivery'));
    const approvalOnly = isApprovalOnlyWrite(snakeBody) && (await userHasPermission(req.user, 'approvals'));
    if (!arrivalOnly && !approvalOnly && !(await userHasPermission(req.user, 'editAllOrders'))) {
      // orders.order_by holds the user's DISPLAY NAME, while the token carries
      // only id/username — so the owner check has to resolve the name from the
      // users table rather than comparing against the token.
      const owner = await query(
        `SELECT o.order_by, u.name AS my_name, u.username AS my_username
         FROM orders o LEFT JOIN users u ON u.id = $2
         WHERE o.id = $1`,
        [id, req.user?.id || null],
      );
      if (owner.rows.length) {
        const { order_by: orderBy, my_name: myName, my_username: myUsername } = owner.rows[0];
        const norm = (v) =>
          String(v ?? '')
            .trim()
            .toLowerCase();
        // A blank order_by used to skip the check entirely, so an order created
        // without one — which the WhatsApp bot and history imports both
        // produce — was editable by anyone. Unowned is not the same as yours.
        const mine = orderBy && (norm(orderBy) === norm(myName) || norm(orderBy) === norm(myUsername));
        if (!mine) {
          return res.status(403).json({ error: 'You can only edit your own orders' });
        }
      }
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
