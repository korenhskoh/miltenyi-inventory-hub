// WhatsApp Bot — Command Handlers
import { query, withTransaction } from './db.js';
import logger from './logger.js';
import { userHasPermission } from './middleware/permissions.js';
import { BACK_ORDER_SQL } from './backOrders.js';
import { todayInTz, zonedParts } from './appDates.js';

// ── Permissions ──
// The bot speaks for whichever account owns the sender's phone number. Numbers
// on the allow-list with no account (session.user === null) get read-only access.
const DENIED = (what) => `🚫 You don't have permission to ${what}. Ask an admin if you need access.`;

async function botCan(session, key) {
  if (!session?.user?.id) return false;
  return userHasPermission({ id: session.user.id, role: session.user.role }, key);
}

/**
 * Did this sender raise the order?
 *
 * orders.order_by holds a display name, so it is resolved against the users
 * table rather than compared to whatever the session carries. An order with no
 * owner recorded belongs to nobody, which is not the same as belonging to you.
 */
async function ownsOrder(session, order) {
  const owner = String(order?.order_by ?? '')
    .trim()
    .toLowerCase();
  if (!owner || !session?.user?.id) return false;
  const r = await query('SELECT name, username FROM users WHERE id = $1', [session.user.id]);
  if (!r.rows.length) return false;
  const { name, username } = r.rows[0];
  const norm = (v) =>
    String(v ?? '')
      .trim()
      .toLowerCase();
  return owner === norm(name) || owner === norm(username);
}

// ── Helpers ──
const PAGE_SIZE = 5;
const fmtPrice = (n) => (n != null && Number(n) > 0 ? `S$${Number(n).toFixed(2)}` : '—');

/**
 * The first price that is actually a price.
 *
 * node-postgres hands back NUMERIC as a STRING, so a column sitting at its
 * default of 0.00 arrives as '0.00' — which is truthy. A plain `a || b || c`
 * therefore stopped at the zero and never reached the transfer price, and the
 * order was written at S$0: it went through approval costed at nothing, while
 * the web app showed a real figure because it compares numerically in SQL.
 */
export const firstPrice = (...values) => values.map(Number).find((n) => Number.isFinite(n) && n > 0) ?? 0;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-SG') : '—');
const ALLOWED_STATUSES = ['Pending', 'Pending Approval', 'Approved', 'Received', 'Rejected', 'Cancelled'];

async function logBotAudit(action, entityType, entityId, details) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['BOT', 'WhatsApp Bot', action, entityType, entityId, JSON.stringify(details || {})],
    );
  } catch (e) {
    logger.error({ err: e }, 'Bot audit log error');
  }
}

function paginate(items, session, formatFn) {
  const start = (session.page || 0) * PAGE_SIZE;
  const page = items.slice(start, start + PAGE_SIZE);
  const hasMore = start + PAGE_SIZE < items.length;

  if (page.length === 0) {
    session.state = 'idle';
    return 'No more results.';
  }

  const header = `_Showing ${start + 1}–${start + page.length} of ${items.length}_`;
  const body = page.map(formatFn).join('\n\n');
  const footer = hasMore ? '\n\nReply *more* for next page.' : '';

  if (hasMore) {
    session.state = 'paginating';
    session.lastResults = items;
    session.page = (session.page || 0) + 1;
    session.formatFn = formatFn;
  } else {
    session.state = 'idle';
    session.lastResults = null;
    session.page = 0;
    session.formatFn = null;
  }

  return `${header}\n\n${body}${footer}`;
}

/**
 * The current month label, on the business calendar.
 *
 * This read the process clock, which is UTC on the deploy target. An order
 * placed at 00:30 on the 1st of a month was filed to the PREVIOUS month — it
 * landed in the wrong budget, and the monthly report for the month it was
 * actually placed in never showed it.
 */
function currentMonth() {
  const { year, month } = zonedParts(new Date());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${year}`;
}

// ── Command Handlers ──

async function handleHelp(params) {
  if (params.category === 'orders') {
    return `📋 *Order Commands*\n\n• *price <material-no>* — Check price\n• *order <qty> <material-no>* — Place order\n• *new order* — Interactive order creation\n• *status <order-id>* — Track order\n• *list orders* — View all orders\n• *pending orders* — Pending only\n• *search <keyword>* — Search orders\n• *update <order-id> <status>* — Change status\n• *delete <order-id>* — Remove order\n\nExample: order 2 130-095-005`;
  }
  if (params.category === 'bulk') {
    return `📦 *Bulk Group Commands*\n\n• *list bulk* — View bulk groups\n• *bulk <blk-id>* — Group details & linked orders\n\nExample: bulk BLK-1`;
  }
  if (params.category === 'approvals') {
    return `✅ *Approval Commands*\n\n• *approvals* — List pending approvals\n• *approve <id>* — Approve request\n• *reject <id>* — Reject request\n\nExample: approve APR-001`;
  }
  if (params.category === 'stock' || params.category === 'catalog') {
    return `📊 *Stock & Catalog Commands*\n\n• *stock* — Recent stock checks\n• *stock history* — All stock checks\n• *search part <keyword>* — Search parts catalog\n\nExample: search part reagent`;
  }
  if (params.category === 'reports') {
    return `📈 *Report Commands*\n\n• *report* — Monthly summary\n• *report <month year>* — Specific month\n• *top materials* — Most ordered items\n• *spending* — Cost overview\n\nExample: report Feb 2026`;
  }

  return `🏥 *Miltenyi Inventory Bot*\n\n📋 *ORDERS*\n  price · order · status · list · search · update · delete\n\n📦 *BULK GROUPS*\n  list bulk · bulk <id>\n\n✅ *APPROVALS*\n  approvals · approve · reject\n\n📊 *STOCK & CATALOG*\n  stock · stock history · search part\n\n📈 *REPORTS*\n  report · top materials · spending\n\n🔧 *MACHINES*\n  machines\n\nType *help <category>* for details.\nExample: help orders`;
}

async function handlePriceLookup(params, session) {
  const { materialNo } = params;
  const r = await query('SELECT * FROM parts_catalog WHERE material_no = $1', [materialNo]);
  await logBotAudit('price_lookup', 'parts_catalog', materialNo, { materialNo });
  if (r.rows.length) {
    const p = r.rows[0];
    return `📦 *${p.description}*\nMaterial: ${materialNo}\n\n💰 *Prices:*\n• Unit Price: ${fmtPrice(p.sg_price)}\n• Distributor: ${fmtPrice(p.dist_price)}\n• RSP Price: ${fmtPrice(p.transfer_price)}\n\nTo order: *order <qty> ${materialNo}*`;
  }
  return `❌ Part *${materialNo}* not found in catalog.`;
}

async function handleOrderStatus(params) {
  const { orderId } = params;
  const r = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  await logBotAudit('order_status', 'order', orderId, { orderId });
  if (r.rows.length) {
    const o = r.rows[0];
    return `📋 *Order ${o.id}*\n\n• Item: ${o.description}\n• Material: ${o.material_no || '—'}\n• Qty: ${o.quantity}\n• Total: ${fmtPrice(o.total_cost)}\n• Status: *${o.status}*\n• Approval: ${o.approval_status}\n• Ordered: ${fmtDate(o.order_date)}\n• Received: ${o.qty_received || 0}/${o.quantity}\n• By: ${o.order_by || '—'}`;
  }
  return `❌ Order *${orderId}* not found.`;
}

async function handleCreateOrder(params, session) {
  // Interactive flow
  if (params.interactive) {
    session.state = 'create_order_material';
    session.data = {};
    return `🛒 *New Order*\n\nPlease enter the material number (e.g. 130-095-005):`;
  }

  const { qty, materialNo } = params;
  const r = await query('SELECT * FROM parts_catalog WHERE material_no = $1', [materialNo]);
  if (!r.rows.length) return `❌ Part *${materialNo}* not found in catalog.`;

  const p = r.rows[0];
  const unitPrice = firstPrice(p.sg_price, p.transfer_price, p.dist_price);
  const total = unitPrice * qty;
  session.state = 'order_confirm';
  session.data = { materialNo, description: p.description, qty, price: unitPrice, total };

  return `🛒 *Ready to order:*\n\n• Part: ${p.description}\n• Material: ${materialNo}\n• Qty: ${qty}\n• Unit: ${fmtPrice(unitPrice)}\n• Total: ${fmtPrice(total)}\n\nReply *confirm* to place or *cancel* to abort.`;
}

async function handleCreateOrderMaterial(text, session) {
  const matMatch = text.trim().match(/(\d{3}-\d{3}-\d{3})/);
  if (!matMatch) return `❌ Invalid format. Please enter a material number like 130-095-005:`;

  const materialNo = matMatch[1];
  const r = await query('SELECT * FROM parts_catalog WHERE material_no = $1', [materialNo]);
  if (!r.rows.length) return `❌ Part *${materialNo}* not found. Try another material number:`;

  session.data.materialNo = materialNo;
  session.data.description = r.rows[0].description;
  session.data.price = firstPrice(r.rows[0].sg_price, r.rows[0].transfer_price, r.rows[0].dist_price);
  session.state = 'create_order_qty';

  return `✅ *${r.rows[0].description}*\nUnit price: ${fmtPrice(session.data.price)}\n\nHow many do you need? Enter quantity:`;
}

async function handleCreateOrderQty(text, session) {
  const qty = parseInt(text.trim());
  if (!qty || qty < 1) return `❌ Please enter a valid quantity (number > 0):`;

  const d = session.data;
  d.qty = qty;
  d.total = d.price * qty;
  session.state = 'order_confirm';

  return `🛒 *Ready to order:*\n\n• Part: ${d.description}\n• Material: ${d.materialNo}\n• Qty: ${qty}\n• Unit: ${fmtPrice(d.price)}\n• Total: ${fmtPrice(d.total)}\n\nReply *confirm* to place or *cancel* to abort.`;
}

async function executeOrderConfirm(session) {
  // A linked account is not the same as a permitted one: the REST route requires
  // the orders permission, so the bot does too.
  if (!(await botCan(session, 'orders'))) return DENIED('create orders');
  const d = session.data;
  const now = new Date();
  const today = todayInTz();
  const { year: businessYear } = zonedParts(now);
  const month = currentMonth();
  // Timestamp-based id — COUNT(*)-based ids collide as soon as any order is deleted.
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await query(
    `INSERT INTO orders (id, material_no, description, quantity, list_price, total_cost, order_date, order_by, status, approval_status, month, year, remark)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      orderId,
      d.materialNo,
      d.description,
      d.qty,
      d.price,
      d.total,
      today,
      session.user.name || session.user.username, // attribute to the real person, not "the bot"
      'Pending Approval',
      'pending',
      month,
      String(businessYear),
      `Created via WhatsApp Bot by ${session.user.username}`,
    ],
  );

  await logBotAudit('create_order', 'order', orderId, { materialNo: d.materialNo, qty: d.qty, total: d.total });
  session.state = 'idle';
  session.data = {};

  return `✅ *Order Created!*\n\n• ID: *${orderId}*\n• Item: ${d.description}\n• Qty: ${d.qty}\n• Total: ${fmtPrice(d.total)}\n\nTrack it: *status ${orderId}*`;
}

async function handleListOrders(params, session) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (params.status) {
    conditions.push(`status ILIKE $${idx++}`);
    values.push(`%${params.status}%`);
  }
  if (params.month) {
    conditions.push(`month ILIKE $${idx++}`);
    values.push(`%${params.month}%`);
  }
  if (params.engineer) {
    conditions.push(`(order_by ILIKE $${idx} OR engineer ILIKE $${idx})`);
    values.push(`%${params.engineer}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const r = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, values);
  await logBotAudit('list_orders', 'order', null, params);

  if (!r.rows.length) return `No orders found${params.status ? ` with status "${params.status}"` : ''}.`;

  session.page = 0;
  return paginate(
    r.rows,
    session,
    (o) =>
      `*${o.id}* | ${o.status}\n${o.material_no || ''} | ${o.description || '—'}\nQty: ${o.quantity} | ${fmtPrice(o.total_cost)} | By: ${o.order_by || '—'}`,
  );
}

async function handleSearchOrders(params, session) {
  const q = `%${params.query}%`;
  const r = await query(
    `SELECT * FROM orders WHERE description ILIKE $1 OR material_no ILIKE $1 OR order_by ILIKE $1 ORDER BY created_at DESC`,
    [q],
  );
  await logBotAudit('search_orders', 'order', null, { query: params.query });

  if (!r.rows.length) return `No orders found matching "${params.query}".`;

  session.page = 0;
  return paginate(
    r.rows,
    session,
    (o) =>
      `*${o.id}* | ${o.status}\n${o.material_no || ''} | ${o.description || '—'}\nQty: ${o.quantity} | ${fmtPrice(o.total_cost)}`,
  );
}

async function handleUpdateOrder(params, session) {
  const { orderId, newStatus } = params;

  // Validate status
  const matched = ALLOWED_STATUSES.find((s) => s.toLowerCase() === newStatus.toLowerCase());
  if (!matched) {
    return `❌ Invalid status. Allowed values:\n${ALLOWED_STATUSES.map((s) => `• ${s}`).join('\n')}`;
  }

  const r = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!r.rows.length) return `❌ Order *${orderId}* not found.`;

  // Changing ANY order's status is an edit, and the REST route enforces
  // ownership-or-editAllOrders for exactly this. Checking only the
  // Approved/Rejected cases left the bot as a second door around that control:
  // through /api/ai/ask, any account with the default permissions could cancel
  // somebody else's approved order, or pull it back out of approval.
  if (!(await botCan(session, 'editAllOrders')) && !(await ownsOrder(session, r.rows[0]))) {
    return DENIED('change orders raised by someone else');
  }

  // Approved/Rejected is an approval decision; pulling an order back to Pending
  // Approval un-does one, which needs the same permission. Received closes the
  // order out and is only valid once it has been approved.
  const decided = ['Approved', 'Rejected'].includes(matched);
  const undoesApproval = matched === 'Pending Approval' && r.rows[0].approval_status === 'approved';
  if ((decided || undoesApproval) && !(await botCan(session, 'approvals'))) {
    return DENIED('approve or reject orders');
  }
  if (matched === 'Received' && r.rows[0].approval_status !== 'approved') {
    return `❌ *${orderId}* must be approved before it can be marked Received.`;
  }
  // Marking an order Received here would set the status without booking any
  // stock, and would then make the real arrival endpoint a no-op through its
  // idempotency guard — the units would be permanently missing from inventory.
  if (matched === 'Received') {
    return `To record a delivery, use the Part Arrival page so the quantity is booked into stock.\n\nThis keeps *${orderId}* and the inventory in step.`;
  }

  const extra = decided ? ", approval_status = '" + matched.toLowerCase() + "'" : '';
  await query(`UPDATE orders SET status = $1${extra} WHERE id = $2`, [matched, orderId]);
  await logBotAudit('update_order', 'order', orderId, { oldStatus: r.rows[0].status, newStatus: matched });

  return `✅ *${orderId}* status updated to *${matched}*.`;
}

async function handleDeleteOrder(params, session) {
  if (!(await botCan(session, 'deleteOrders'))) return DENIED('delete orders');
  const { orderId } = params;
  const r = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!r.rows.length) return `❌ Order *${orderId}* not found.`;

  const o = r.rows[0];
  session.state = 'delete_confirm';
  session.data = { type: 'order', id: orderId };

  return `⚠️ *Delete Order ${orderId}?*\n\n• Item: ${o.description}\n• Qty: ${o.quantity}\n• Status: ${o.status}\n• Total: ${fmtPrice(o.total_cost)}\n\nReply *confirm* to delete or *cancel* to abort.`;
}

async function executeDeleteConfirm(session) {
  const { type, id } = session.data;
  const needed = type === 'bulk' ? 'deleteBulkOrders' : 'deleteOrders';
  if (!(await botCan(session, needed))) return DENIED('delete records');
  if (type === 'order') {
    await query('DELETE FROM orders WHERE id = $1', [id]);
    await logBotAudit('delete_order', 'order', id, {});
    session.state = 'idle';
    session.data = {};
    return `🗑️ Order *${id}* deleted.`;
  }
  if (type === 'bulk') {
    // Release the batch's orders instead of leaving them pointing at a group
    // that no longer exists — an order in that state cannot be seen or received
    // anywhere in the app while still counting in every total.
    const released = await query('UPDATE orders SET bulk_group_id = NULL WHERE bulk_group_id = $1', [id]);
    await query('DELETE FROM bulk_groups WHERE id = $1', [id]);
    await logBotAudit('delete_bulk', 'bulk_group', id, { ordersReleased: released.rowCount });
    session.state = 'idle';
    session.data = {};
    return `🗑️ Bulk group *${id}* deleted.${
      released.rowCount ? `\n${released.rowCount} order(s) kept as single orders.` : ''
    }`;
  }
  session.state = 'idle';
  return 'Nothing to delete.';
}

// ── Bulk Groups ──

async function handleListBulk(params, session) {
  const r = await query('SELECT * FROM bulk_groups ORDER BY id DESC');
  await logBotAudit('list_bulk', 'bulk_group', null, {});

  if (!r.rows.length) return 'No bulk groups found.';

  session.page = 0;
  return paginate(
    r.rows,
    session,
    (b) => `*${b.id}* | ${b.month || '—'}\nItems: ${b.items} | ${fmtPrice(b.total_cost)} | Status: ${b.status}`,
  );
}

async function handleBulkDetail(params, session) {
  const { bulkId } = params;
  const br = await query('SELECT * FROM bulk_groups WHERE id = $1', [bulkId]);
  if (!br.rows.length) return `❌ Bulk group *${bulkId}* not found.`;

  const b = br.rows[0];
  const or = await query('SELECT * FROM orders WHERE bulk_group_id = $1 ORDER BY id', [bulkId]);
  await logBotAudit('bulk_detail', 'bulk_group', bulkId, {});

  let text = `📦 *${b.id}* — ${b.month || '—'}\nStatus: ${b.status} | Items: ${b.items} | Total: ${fmtPrice(b.total_cost)}\n\n*Linked Orders:*`;

  if (!or.rows.length) {
    text += '\nNo orders linked to this group.';
  } else {
    session.page = 0;
    const orderList = paginate(
      or.rows,
      session,
      (o) => `  ${o.id}: ${o.description || '—'} (x${o.quantity}) — ${o.status}`,
    );
    text += '\n' + orderList;
  }
  return text;
}

// ── Approvals ──

async function handleListApprovals(params, session) {
  const r = await query("SELECT * FROM pending_approvals WHERE status = 'pending' ORDER BY id DESC");
  await logBotAudit('list_approvals', 'approval', null, {});

  if (!r.rows.length) return '✅ No pending approvals.';

  session.page = 0;
  return paginate(
    r.rows,
    session,
    (a) =>
      `*${a.id}* | ${a.order_type || 'single'}\nOrder: ${a.order_id || '—'} | By: ${a.requested_by || '—'}\nQty: ${a.quantity || 0} | ${fmtPrice(a.total_cost)} | Sent: ${fmtDate(a.sent_date)}`,
  );
}

async function handleApprove(params, session) {
  if (!(await botCan(session, 'approvals'))) return DENIED('approve requests');
  const { approvalId } = params;
  const r = await query('SELECT * FROM pending_approvals WHERE id = $1', [approvalId]);
  if (!r.rows.length) return `❌ Approval *${approvalId}* not found.`;

  const a = r.rows[0];
  if (a.status !== 'pending') return `Approval *${approvalId}* is already ${a.status}.`;

  session.state = 'approve_confirm';
  session.data = { approvalId, orderId: a.order_id };

  return `✅ *Approve ${approvalId}?*\n\nOrder: ${a.order_id}\nBy: ${a.requested_by || '—'}\nQty: ${a.quantity || 0} | ${fmtPrice(a.total_cost)}\n\nReply *confirm* to approve or *cancel* to abort.`;
}

async function handleReject(params, session) {
  if (!(await botCan(session, 'approvals'))) return DENIED('reject requests');
  const { approvalId } = params;
  const r = await query('SELECT * FROM pending_approvals WHERE id = $1', [approvalId]);
  if (!r.rows.length) return `❌ Approval *${approvalId}* not found.`;

  const a = r.rows[0];
  if (a.status !== 'pending') return `Approval *${approvalId}* is already ${a.status}.`;

  session.state = 'reject_confirm';
  session.data = { approvalId, orderId: a.order_id };

  return `❌ *Reject ${approvalId}?*\n\nOrder: ${a.order_id}\nBy: ${a.requested_by || '—'}\n\nReply *confirm* to reject or *cancel* to abort.`;
}

// Resolve every order id covered by an approval (single, bulk or batch)
async function approvalOrderIds(approvalId, fallbackOrderId, client = { query }) {
  const r = await client.query('SELECT order_id, order_ids FROM pending_approvals WHERE id = $1', [approvalId]);
  const row = r.rows[0] || {};
  let ids = row.order_ids;
  if (typeof ids === 'string') {
    try {
      ids = JSON.parse(ids);
    } catch {
      ids = null;
    }
  }
  if (Array.isArray(ids) && ids.length) return ids;
  const single = row.order_id || fallbackOrderId;
  if (!single) return [];
  return String(single)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Settle an approval from the bot's confirm step.
 *
 * Two things were wrong here. The approval's state was read when the user typed
 * `approve PA-7` and never re-read when they typed `confirm`, so someone else
 * rejecting it from the web app in between was silently overwritten — the WHERE
 * clause had no `status = 'pending'` guard. And the two UPDATEs ran outside any
 * transaction, so if the second failed the approval read as settled while its
 * orders stayed pending, leaving it out of the pending queue with no button
 * anywhere to retry it.
 */
async function settleApproval(session, decision) {
  const { approvalId, orderId } = session.data;
  const now = todayInTz();
  const orderStatus = decision === 'approved' ? 'Approved' : 'Rejected';

  const outcome = await withTransaction(async (client) => {
    const cur = await client.query('SELECT status FROM pending_approvals WHERE id = $1 FOR UPDATE', [approvalId]);
    if (cur.rows.length === 0) return { ok: false, reason: 'missing' };
    if (String(cur.rows[0].status || '').toLowerCase() !== 'pending') {
      return { ok: false, reason: 'settled', current: cur.rows[0].status };
    }
    await client.query('UPDATE pending_approvals SET status = $1, action_date = $2 WHERE id = $3', [
      decision,
      now,
      approvalId,
    ]);
    const ids = await approvalOrderIds(approvalId, orderId, client);
    if (ids.length) {
      await client.query('UPDATE orders SET approval_status = $1, status = $2 WHERE id = ANY($3::text[])', [
        decision,
        orderStatus,
        ids,
      ]);
    }
    return { ok: true, count: ids.length };
  });

  session.state = 'idle';
  session.data = {};

  if (!outcome.ok) {
    if (outcome.reason === 'missing') return `⚠️ Approval *${approvalId}* no longer exists.`;
    return `⚠️ Approval *${approvalId}* was already ${outcome.current} by someone else — nothing changed.`;
  }
  await logBotAudit(decision === 'approved' ? 'approve' : 'reject', 'approval', approvalId, { orderId });
  const icon = decision === 'approved' ? '✅' : '❌';
  return `${icon} Approval *${approvalId}* ${decision}.${orderId ? ` Order ${orderId} updated.` : ''}`;
}

async function executeApproveConfirm(session) {
  if (!(await botCan(session, 'approvals'))) return DENIED('approve requests');
  return settleApproval(session, 'approved');
}

async function executeRejectConfirm(session) {
  if (!(await botCan(session, 'approvals'))) return DENIED('reject requests');
  return settleApproval(session, 'rejected');
}

// ── Stock ──

async function handleStock() {
  const r = await query('SELECT * FROM stock_checks ORDER BY date DESC LIMIT 3');
  await logBotAudit('stock_check', 'stock_check', null, {});
  if (r.rows.length) {
    const list = r.rows
      .map(
        (s) =>
          `• *${s.id}*: ${s.items} items, ${s.disc} discrepancies (${s.status})\n  Checked by: ${s.checked_by || '—'} | ${fmtDate(s.date)}`,
      )
      .join('\n');
    return `📊 *Recent Stock Checks:*\n\n${list}`;
  }
  return 'No stock checks recorded yet.';
}

async function handleStockHistory(params, session) {
  const r = await query('SELECT * FROM stock_checks ORDER BY date DESC');
  await logBotAudit('stock_history', 'stock_check', null, {});
  if (!r.rows.length) return 'No stock checks recorded yet.';

  session.page = 0;
  return paginate(
    r.rows,
    session,
    (s) =>
      `*${s.id}* | ${fmtDate(s.date)}\nItems: ${s.items} | Discrepancies: ${s.disc} | ${s.status}\nBy: ${s.checked_by || '—'}`,
  );
}

// ── Catalog Search ──

async function handleSearchCatalog(params, session) {
  const q = `%${params.query}%`;
  const r = await query(
    `SELECT * FROM parts_catalog WHERE description ILIKE $1 OR material_no ILIKE $1 OR category ILIKE $1 ORDER BY material_no LIMIT 20`,
    [q],
  );
  await logBotAudit('search_catalog', 'parts_catalog', null, { query: params.query });

  if (!r.rows.length) return `No parts found matching "${params.query}".`;

  session.page = 0;
  return paginate(
    r.rows,
    session,
    (p) =>
      `*${p.material_no}* | ${p.description}\nCategory: ${p.category || '—'}\nUnit: ${fmtPrice(p.sg_price)} | Dist: ${fmtPrice(p.dist_price)} | RSP Price: ${fmtPrice(p.transfer_price)}`,
  );
}

// ── Reports ──

async function handleReportMonthly(params) {
  const month = params.month || currentMonth();
  const r = await query(
    'SELECT COUNT(*) as total, COALESCE(SUM(total_cost),0) as cost FROM orders WHERE month ILIKE $1',
    [`%${month}%`],
  );
  const received = await query("SELECT COUNT(*) as c FROM orders WHERE month ILIKE $1 AND status = 'Received'", [
    `%${month}%`,
  ]);
  const pending = await query("SELECT COUNT(*) as c FROM orders WHERE month ILIKE $1 AND status ILIKE '%pending%'", [
    `%${month}%`,
  ]);
  // Was `back_order > 0`. That field is (received - ordered), so it is negative
  // on a short delivery and this count was structurally zero every month.
  const backorder = await query(`SELECT COUNT(*) as c FROM orders WHERE month ILIKE $1 AND ${BACK_ORDER_SQL}`, [
    `%${month}%`,
  ]);

  const total = parseInt(r.rows[0].total);
  const cost = Number(r.rows[0].cost);
  const rec = parseInt(received.rows[0].c);
  const pend = parseInt(pending.rows[0].c);
  const bo = parseInt(backorder.rows[0].c);

  await logBotAudit('report_monthly', 'report', null, { month });

  if (total === 0) return `📈 *Report — ${month}*\n\nNo orders found for this month.`;

  return `📈 *Monthly Summary — ${month}*\n\n• Total Orders: *${total}*\n• Total Spending: *${fmtPrice(cost)}*\n• Received: ${rec}\n• Pending: ${pend}\n• Back Orders: ${bo}\n• Completion: ${total > 0 ? Math.round((rec / total) * 100) : 0}%`;
}

async function handleTopMaterials() {
  const r = await query(
    `SELECT material_no, description, SUM(quantity) as total_qty, COUNT(*) as order_count
     FROM orders WHERE material_no IS NOT NULL
     GROUP BY material_no, description
     ORDER BY total_qty DESC LIMIT 10`,
  );
  await logBotAudit('report_top', 'report', null, {});

  if (!r.rows.length) return 'Not enough order data for top materials report.';

  const items = r.rows
    .map(
      (m, i) =>
        `${i + 1}. *${m.material_no}* | ${m.description || '—'}\n   Orders: ${m.order_count} | Total Qty: ${m.total_qty}`,
    )
    .join('\n\n');

  return `📊 *Top 10 Materials by Quantity*\n\n${items}`;
}

async function handleSpending() {
  const r = await query(
    `SELECT month, COUNT(*) as orders, COALESCE(SUM(total_cost),0) as total
     FROM orders WHERE month IS NOT NULL
     GROUP BY month ORDER BY MAX(created_at) DESC LIMIT 6`,
  );
  await logBotAudit('report_spending', 'report', null, {});

  if (!r.rows.length) return 'Not enough order data for spending report.';

  const items = r.rows.map((m) => `• *${m.month}*: ${m.orders} orders | ${fmtPrice(Number(m.total))}`).join('\n');

  const grand = r.rows.reduce((sum, m) => sum + Number(m.total), 0);

  return `💰 *Spending Overview*\n\n${items}\n\n*Grand Total: ${fmtPrice(grand)}*`;
}

// ── Machines ──

async function handleListMachines(params, session) {
  const sql = params.modality
    ? 'SELECT * FROM machines WHERE modality ILIKE $1 ORDER BY id DESC'
    : 'SELECT * FROM machines ORDER BY id DESC';
  const values = params.modality ? [`%${params.modality}%`] : [];
  const r = await query(sql, values);
  await logBotAudit('list_machines', 'machine', null, params);

  if (!r.rows.length) return 'No machines found.';

  session.page = 0;
  return paginate(
    r.rows,
    session,
    (m) =>
      `*#${m.id}* ${m.name}\nModality: ${m.modality} | Location: ${m.location || '—'}\nStatus: ${m.status} | Installed: ${fmtDate(m.install_date)}`,
  );
}

// ── Unknown ──

function handleUnknown() {
  return `I didn't understand that. Type *help* for available commands.\n\nQuick examples:\n• price 130-095-005\n• status ORD-2001\n• order 2 130-095-005\n• list orders\n• approvals\n• report`;
}

// ── Export ──

export const commandHandlers = {
  help: handleHelp,
  price_lookup: handlePriceLookup,
  order_status: handleOrderStatus,
  create_order: handleCreateOrder,
  update_order: handleUpdateOrder,
  delete_order: handleDeleteOrder,
  list_orders: handleListOrders,
  search_orders: handleSearchOrders,
  list_bulk: handleListBulk,
  bulk_detail: handleBulkDetail,
  list_approvals: handleListApprovals,
  approve: handleApprove,
  reject: handleReject,
  stock: handleStock,
  stock_history: handleStockHistory,
  search_catalog: handleSearchCatalog,
  report_monthly: handleReportMonthly,
  report_top_materials: handleTopMaterials,
  report_spending: handleSpending,
  list_machines: handleListMachines,
  unknown: handleUnknown,
};

// Stateful flow executors
export const stateHandlers = {
  create_order_material: handleCreateOrderMaterial,
  create_order_qty: handleCreateOrderQty,
};

export const confirmExecutors = {
  order_confirm: executeOrderConfirm,
  delete_confirm: executeDeleteConfirm,
  approve_confirm: executeApproveConfirm,
  reject_confirm: executeRejectConfirm,
};
