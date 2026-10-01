/**
 * End-to-end tally check: order -> approval -> part arrival, with edits in
 * between, asserting the numbers agree at every step.
 *
 * Runs against a RUNNING server and a real PostgreSQL, and reads the database
 * directly rather than trusting the API's echo of what it was sent. The unit
 * tests cover the rules; this covers the journey, where the figures drift.
 *
 *   DATABASE_URL=postgres://... ADMIN_PASSWORD=... npm run test:e2e
 *
 * Optional: API=http://host:port/api (default http://localhost:3001/api).
 *
 * It writes rows with a timestamp-based suffix and does not clean up, so point
 * it at a scratch database, never production. Exit code 0 means every check
 * passed; 1 means at least one did not and the failing checks are listed.
 */
import pg from 'pg';

// Read DATE columns as the plain 'YYYY-MM-DD' strings they are, exactly as
// server/db.js does. Without this, node-postgres hands back a JS Date at LOCAL
// midnight, and reading it as UTC reports the day before everywhere east of
// Greenwich — which is where this is used.
pg.types.setTypeParser(1082, (v) => v);

const API = process.env.API || 'http://localhost:3001/api';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let token = '';
const SFX = String(Date.now()).slice(-7);
const failures = [];
const steps = [];

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  steps.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        expected ${e}\n        actual   ${a}`}`);
  if (!ok) failures.push(label);
  return ok;
}

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body: json };
}

const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0] || null;
const num = (v) => Number(v) || 0;

async function login() {
  const r = await call('POST', '/auth/login', { username: 'admin', password: process.env.ADMIN_PASSWORD });
  if (!r.body?.token) throw new Error(`login failed: ${r.status} ${JSON.stringify(r.body)}`);
  token = r.body.token;
}

/** Order state as the database holds it, in the terms the UI shows. */
async function orderState(id) {
  const o = await one('SELECT * FROM orders WHERE id = $1', [id]);
  if (!o) return null;
  return {
    qty: num(o.quantity),
    received: num(o.qty_received),
    backOrder: num(o.back_order),
    status: o.status,
    approval: o.approval_status,
    group: o.bulk_group_id,
    arrival: o.arrival_date ? String(o.arrival_date).slice(0, 10) : null,
  };
}

/** What the batch actually contains, computed from the orders themselves. */
async function groupActual(gid) {
  const r = await one(
    `SELECT COUNT(*)::int AS items, COALESCE(SUM(total_cost), 0)::numeric AS total
     FROM orders WHERE bulk_group_id = $1`,
    [gid],
  );
  return { items: r.items, total: num(r.total) };
}

async function groupStored(gid) {
  const g = await one('SELECT items, total_cost FROM bulk_groups WHERE id = $1', [gid]);
  return g ? { items: num(g.items), total: num(g.total_cost) } : null;
}

async function onHand(materialNo) {
  const r = await one(
    `SELECT quantity FROM local_inventory
     WHERE material_no = $1 AND (lots_number IS NULL OR lots_number = '')`,
    [materialNo],
  );
  return r ? num(r.quantity) : 0;
}

async function movementSum(materialNo) {
  const r = await one(
    'SELECT COALESCE(SUM(quantity_change), 0)::int AS s FROM inventory_transactions WHERE material_no = $1',
    [materialNo],
  );
  return r.s;
}

/** The invariant the UI's "out of sync" banner is about. */
async function assertGroupTallies(gid, label) {
  const [stored, actual] = await Promise.all([groupStored(gid), groupActual(gid)]);
  check(`${label}: batch ${gid} stored totals match its lines`, stored, actual);
}

/** Stock on hand must equal the sum of every movement ever recorded for it. */
async function assertStockTallies(materialNo, label) {
  const [hand, moved] = await Promise.all([onHand(materialNo), movementSum(materialNo)]);
  check(`${label}: ${materialNo} on-hand equals the sum of its movements`, hand, moved);
}

/** back_order is defined as received minus ordered; it is never anything else. */
async function assertBackOrderDerived(id, label) {
  const s = await orderState(id);
  check(`${label}: ${id} back_order = received - ordered`, s.backOrder, s.received - s.qty);
}

// ── Scenario 1: a bulk batch, edited and trimmed on the way through ─────────
async function scenarioBulk() {
  const G = `BG-E${SFX}`;
  const MAT = `MAT-E${SFX}`;
  const ids = [1, 2, 3].map((n) => `ORD-E${SFX}-${n}`);
  steps.push(`\n=== Scenario 1 — bulk batch ${G} ===`);

  check(
    'bulk group created',
    (await call('POST', '/bulk-groups', { id: G, month: 'Sep 2026', createdBy: 'e2e', items: 0, totalCost: 0 })).status,
    201,
  );

  // Three lines, two of them the same material so the shelf is shared.
  const lines = [
    { id: ids[0], materialNo: MAT, quantity: 5, totalCost: 100 },
    { id: ids[1], materialNo: MAT, quantity: 3, totalCost: 60 },
    { id: ids[2], materialNo: `${MAT}-B`, quantity: 2, totalCost: 40 },
  ];
  for (const l of lines) {
    const r = await call('POST', '/orders', {
      ...l,
      description: 'e2e part',
      bulkGroupId: G,
      status: 'Pending',
      orderDate: '2026-09-01',
    });
    check(`line ${l.id} created`, r.status, 201);
  }
  // The client owns these totals; set them as it would.
  await call('PUT', `/bulk-groups/${G}`, { items: 3, totalCost: 200 });
  await assertGroupTallies(G, 'after creation');

  // Approval for the batch.
  const APR = `APR-E${SFX}`;
  check(
    'approval request sent',
    (
      await call('POST', '/pending-approvals', {
        id: APR,
        orderId: G,
        orderType: 'bulk',
        description: 'e2e bulk',
        requestedBy: 'e2e',
        quantity: 10,
        totalCost: 200,
        sentDate: '2026-09-02',
        status: 'pending',
        orderIds: ids,
      })
    ).status,
    201,
  );

  // Arrival before approval must be refused — the gate that keeps stock from
  // moving for something nobody agreed to buy.
  const early = await call('POST', `/orders/${ids[0]}/arrival`, { qtyReceived: 1 });
  check('arrival refused before approval', early.status, 403);
  check('nothing on the shelf yet', await onHand(MAT), 0);

  // Approve.
  await call('PUT', `/pending-approvals/${APR}`, { status: 'approved', actionDate: '2026-09-03' });
  for (const id of ids) {
    await call('PUT', `/orders/${id}`, { approvalStatus: 'approved', status: 'Approved' });
  }
  check('all three approved', (await Promise.all(ids.map(orderState))).map((s) => s.approval), [
    'approved',
    'approved',
    'approved',
  ]);

  // Edit: line 2 was ordered short, raise 3 -> 4 and its cost with it.
  await call('PUT', `/orders/${ids[1]}`, { quantity: 4, totalCost: 80 });
  check('edited quantity stored', (await orderState(ids[1])).qty, 4);
  // The batch total must be brought along, as the client does.
  await call('PUT', `/bulk-groups/${G}`, { items: 3, totalCost: 220 });
  await assertGroupTallies(G, 'after editing a line');

  // Remove line 3 from the batch — the fix under test. The order survives.
  const removed = await call('PUT', `/orders/${ids[2]}`, { bulkGroupId: null });
  check('removal accepted', removed.status, 200);
  check('line 3 no longer in the batch', (await orderState(ids[2])).group, null);
  check('line 3 still exists as an order', (await orderState(ids[2])).qty, 2);
  await call('PUT', `/bulk-groups/${G}`, { items: 2, totalCost: 180 });
  await assertGroupTallies(G, 'after removing a line');

  // Part arrival: partial on line 1.
  const a1 = await call('POST', `/orders/${ids[0]}/arrival`, {
    qtyReceived: 2,
    arrivalDate: '2026-09-10',
    arrivalCheckedBy: 'e2e',
  });
  check('partial arrival accepted', a1.status, 200);
  check('line 1 after partial arrival', await orderState(ids[0]), {
    qty: 5,
    received: 2,
    backOrder: -3,
    status: 'Approved',
    approval: 'approved',
    group: G,
    arrival: '2026-09-10',
  });
  check('2 units on the shelf', await onHand(MAT), 2);
  await assertStockTallies(MAT, 'after partial arrival');
  await assertBackOrderDerived(ids[0], 'after partial arrival');

  // Repeating the same figure must change nothing.
  const again = await call('POST', `/orders/${ids[0]}/arrival`, { qtyReceived: 2 });
  check('repeated confirmation is idempotent', again.body?.alreadyRecorded, true);
  check('shelf unchanged by the repeat', await onHand(MAT), 2);

  // Complete line 1.
  await call('POST', `/orders/${ids[0]}/arrival`, { qtyReceived: 5, arrivalDate: '2026-09-11' });
  check('line 1 fully received', await orderState(ids[0]), {
    qty: 5,
    received: 5,
    backOrder: 0,
    status: 'Received',
    approval: 'approved',
    group: G,
    arrival: '2026-09-11',
  });
  check('5 on the shelf', await onHand(MAT), 5);

  // Line 2 receives its full 4 — the same shelf, so 5 + 4.
  await call('POST', `/orders/${ids[1]}/arrival`, { qtyReceived: 4, arrivalDate: '2026-09-11' });
  check('shared shelf accumulates', await onHand(MAT), 9);
  await assertStockTallies(MAT, 'after the second line arrives');

  // A miscount, corrected down: line 2 was really 1, not 4.
  const corr = await call('POST', `/orders/${ids[1]}/arrival`, { qtyReceived: 1 });
  check('correction accepted', corr.status, 200);
  check('line 2 after correction', await orderState(ids[1]), {
    qty: 4,
    received: 1,
    backOrder: -3,
    status: 'Approved',
    approval: 'approved',
    group: G,
    arrival: '2026-09-11',
  });
  check('shelf corrected to 5 + 1', await onHand(MAT), 6);
  await assertStockTallies(MAT, 'after the correction');
  await assertBackOrderDerived(ids[1], 'after the correction');

  // Corrected to nothing: the arrival stamp goes with it.
  await call('POST', `/orders/${ids[1]}/arrival`, { qtyReceived: 0 });
  check('line 2 corrected to nothing', await orderState(ids[1]), {
    qty: 4,
    received: 0,
    backOrder: -4,
    status: 'Approved',
    approval: 'approved',
    group: G,
    arrival: null,
  });
  check('shelf back to line 1 only', await onHand(MAT), 5);
  await assertStockTallies(MAT, 'after correcting to nothing');

  // Receiving more than was ordered is refused.
  const over = await call('POST', `/orders/${ids[0]}/arrival`, { qtyReceived: 6 });
  check('over-receipt refused', over.status, 400);
  check('shelf untouched by the refusal', await onHand(MAT), 5);

  // Editing the ordered quantity must keep the derived figures honest.
  // Line 1 stands at 5 ordered, 5 received, Received.
  const shrink = await call('PUT', `/orders/${ids[0]}`, { quantity: 3 });
  check('reducing below what was received is refused', shrink.status, 400);
  check('the refused edit changed nothing', await orderState(ids[0]), {
    qty: 5,
    received: 5,
    backOrder: 0,
    status: 'Received',
    approval: 'approved',
    group: G,
    arrival: '2026-09-11',
  });
  check('the shelf is untouched by the refused edit', await onHand(MAT), 5);

  // Raising it reopens the order, because the rest is still outstanding.
  const grow = await call('PUT', `/orders/${ids[0]}`, { quantity: 8 });
  check('raising the quantity accepted', grow.status, 200);
  check('the order reopens with the shortfall recorded', await orderState(ids[0]), {
    qty: 8,
    received: 5,
    backOrder: -3,
    status: 'Approved',
    approval: 'approved',
    group: G,
    arrival: '2026-09-11',
  });
  await assertBackOrderDerived(ids[0], 'after raising the quantity');
  check('raising the order moved no stock', await onHand(MAT), 5);
  await assertStockTallies(MAT, 'after raising the quantity');

  // And lowering it back to exactly what arrived closes it again.
  await call('PUT', `/orders/${ids[0]}`, { quantity: 5 });
  check('lowering to what arrived closes the order', await orderState(ids[0]), {
    qty: 5,
    received: 5,
    backOrder: 0,
    status: 'Received',
    approval: 'approved',
    group: G,
    arrival: '2026-09-11',
  });
  await assertBackOrderDerived(ids[0], 'after closing the order again');

  await assertGroupTallies(G, 'end of scenario 1');
  return { G, MAT, ids };
}

// ── Scenario 2: a single order, resent for approval ─────────────────────────
async function scenarioSingle() {
  const id = `ORD-S${SFX}`;
  const MAT = `MAT-S${SFX}`;
  steps.push('\n=== Scenario 2 — single order, approval resent ===');

  check(
    'single order created',
    (
      await call('POST', '/orders', {
        id,
        materialNo: MAT,
        description: 'e2e single',
        quantity: 4,
        totalCost: 90,
        status: 'Pending',
        orderDate: '2026-09-01',
      })
    ).status,
    201,
  );

  const mk = (n, date) =>
    call('POST', '/pending-approvals', {
      id: `APR-S${SFX}-${n}`,
      orderId: id,
      orderType: 'single',
      description: 'e2e single',
      requestedBy: 'e2e',
      quantity: 4,
      totalCost: 90,
      sentDate: date,
      status: 'pending',
      orderIds: [id],
    });

  await mk('A', '2026-09-02');
  const resend = await mk('B', '2026-09-04');
  check('resend reports what it closed', resend.body?.supersededApprovals, [`APR-S${SFX}-A`]);
  const open = await q(`SELECT id FROM pending_approvals WHERE order_id = $1 AND status = 'pending' ORDER BY id`, [id]);
  check('exactly one open request for this order', open.map((r) => r.id), [`APR-S${SFX}-B`]);

  // Deciding the current request approves the order.
  await call('PUT', `/pending-approvals/APR-S${SFX}-B`, { status: 'approved', actionDate: '2026-09-05' });
  await call('PUT', `/orders/${id}`, { approvalStatus: 'approved', status: 'Approved' });

  // The superseded row must not be able to undo that decision. Acting on it is
  // what used to flip the order back to Rejected; it is no longer in the open
  // list, so the UI cannot offer it.
  const stale = await one('SELECT status FROM pending_approvals WHERE id = $1', [`APR-S${SFX}-A`]);
  check('the earlier request is superseded, not pending', stale.status, 'superseded');

  await call('POST', `/orders/${id}/arrival`, { qtyReceived: 4, arrivalDate: '2026-09-10', arrivalCheckedBy: 'e2e' });
  check('single order received in full', await orderState(id), {
    qty: 4,
    received: 4,
    backOrder: 0,
    status: 'Received',
    approval: 'approved',
    group: null,
    arrival: '2026-09-10',
  });
  check('4 on the shelf', await onHand(MAT), 4);
  await assertStockTallies(MAT, 'single order received');
  await assertBackOrderDerived(id, 'single order received');
  return { id, MAT };
}

// ── Scenario 3: deleting a received order ──────────────────────────────────
async function scenarioDelete() {
  const id = `ORD-D${SFX}`;
  const MAT = `MAT-D${SFX}`;
  steps.push('\n=== Scenario 3 — deleting an order that already took delivery ===');
  await call('POST', '/orders', {
    id,
    materialNo: MAT,
    description: 'e2e delete',
    quantity: 2,
    totalCost: 20,
    status: 'Pending',
    orderDate: '2026-09-01',
  });
  await call('PUT', `/orders/${id}`, { approvalStatus: 'approved', status: 'Approved' });
  await call('POST', `/orders/${id}/arrival`, { qtyReceived: 2, arrivalDate: '2026-09-10' });
  check('2 booked in', await onHand(MAT), 2);

  const del = await call('DELETE', `/orders/${id}`);
  check('delete accepted', del.status < 300, true);
  check('order gone', await orderState(id), null);
  // Documented behaviour, warned about in the confirm: the stock stays.
  check('the stock stays on the shelf', await onHand(MAT), 2);
  const orphan = await q(
    'SELECT quantity_change FROM inventory_transactions WHERE material_no = $1 ORDER BY id',
    [MAT],
  );
  steps.push(`        note: movements left behind for ${MAT}: ${JSON.stringify(orphan.map((r) => r.quantity_change))}`);
  await assertStockTallies(MAT, 'after deleting the received order');
}

async function main() {
  await login();
  await scenarioBulk();
  await scenarioSingle();
  await scenarioDelete();
  console.log(steps.join('\n'));
  console.log(
    `\n${failures.length ? `${failures.length} CHECK(S) FAILED:\n  - ${failures.join('\n  - ')}` : 'ALL CHECKS PASSED'}`,
  );
  await db.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('harness error:', e);
  await db.end().catch(() => {});
  process.exit(2);
});
