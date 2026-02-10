import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Data consistency tests — when User A creates/modifies data (orders, bulk groups,
 * stock checks, part arrival), User B fetching the same endpoint sees the updated data.
 *
 * Strategy: Mock the shared `query` function from db.js. Both users' route handlers
 * call the same query(), so whatever one user inserts, the other user's GET returns.
 * We simulate two separate users by calling the route handlers with different req.user tokens.
 */

// ─── Shared mock DB layer ───
// All rows live in these arrays (simulating a shared PostgreSQL database)
let ordersTable = [];
let bulkGroupsTable = [];
let stockChecksTable = [];

// Auto-increment counter for RETURNING * simulation
let insertCounter = 0;

vi.mock('../db.js', () => ({
  query: vi.fn(async (sql, params) => {
    const sqlLower = sql.toLowerCase().trim();

    // ── ORDERS ──
    if (sqlLower.startsWith('select') && sqlLower.includes('from orders')) {
      return { rows: [...ordersTable] };
    }
    if (sqlLower.startsWith('insert into orders')) {
      const row = { id: params[0] || `ORD-${++insertCounter}` };
      // Build row from column names in SQL
      const colMatch = sql.match(/INSERT INTO orders \(([^)]+)\)/i);
      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        cols.forEach((col, i) => { row[col] = params[i]; });
      }
      ordersTable.push(row);
      return { rows: [row] };
    }
    if (sqlLower.startsWith('update orders set')) {
      const id = params[params.length - 1];
      const idx = ordersTable.findIndex(o => o.id === id);
      if (idx >= 0) {
        // Extract SET clauses — e.g. qty_received = $1
        const setMatch = sql.match(/SET (.+) WHERE/i);
        if (setMatch) {
          const setParts = setMatch[1].split(',').map(s => s.trim());
          setParts.forEach(part => {
            const [col, placeholder] = part.split('=').map(s => s.trim());
            const paramIdx = parseInt(placeholder.replace('$', '')) - 1;
            ordersTable[idx][col] = params[paramIdx];
          });
        }
        return { rows: [ordersTable[idx]] };
      }
      return { rows: [] };
    }

    // ── BULK GROUPS ──
    if (sqlLower.startsWith('select') && sqlLower.includes('from bulk_groups')) {
      return { rows: [...bulkGroupsTable] };
    }
    if (sqlLower.startsWith('insert into bulk_groups')) {
      const row = {};
      const colMatch = sql.match(/INSERT INTO bulk_groups \(([^)]+)\)/i);
      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        cols.forEach((col, i) => { row[col] = params[i]; });
      }
      bulkGroupsTable.push(row);
      return { rows: [row] };
    }

    // ── STOCK CHECKS ──
    if (sqlLower.startsWith('select') && sqlLower.includes('from stock_checks')) {
      return { rows: [...stockChecksTable] };
    }
    if (sqlLower.startsWith('insert into stock_checks')) {
      const row = {};
      const colMatch = sql.match(/INSERT INTO stock_checks \(([^)]+)\)/i);
      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        cols.forEach((col, i) => { row[col] = params[i]; });
      }
      stockChecksTable.push(row);
      return { rows: [row] };
    }
    if (sqlLower.startsWith('update stock_checks set')) {
      const id = params[params.length - 1];
      const idx = stockChecksTable.findIndex(o => o.id === id);
      if (idx >= 0) {
        const setMatch = sql.match(/SET (.+) WHERE/i);
        if (setMatch) {
          const setParts = setMatch[1].split(',').map(s => s.trim());
          setParts.forEach(part => {
            const [col, placeholder] = part.split('=').map(s => s.trim());
            const paramIdx = parseInt(placeholder.replace('$', '')) - 1;
            stockChecksTable[idx][col] = params[paramIdx];
          });
        }
        return { rows: [stockChecksTable[idx]] };
      }
      return { rows: [] };
    }

    return { rows: [] };
  }),
}));

// ─── Import route handlers after mocking db ───
const { default: ordersRouter } = await import('./orders.js');
const { default: bulkGroupsRouter } = await import('./bulkGroups.js');
const { default: stockChecksRouter } = await import('./stockChecks.js');

// ─── Helper: create mock req/res for Express ───
function mockReq({ method = 'GET', body = {}, params = {}, query: q = {}, user = {} } = {}) {
  return { method, body, params, query: q, user, headers: {} };
}

function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

// ─── Two simulated users ───
const userA = { id: 'U001', username: 'alice', role: 'user' };
const userB = { id: 'U002', username: 'bob', role: 'user' };

// ─── Helper: call a route handler layer ───
// Express routers have a .handle() method, but for unit tests we can
// iterate the router stack manually. Instead, we'll use a simpler approach:
// call the specific layer by matching path and method.

function findHandler(router, method, path) {
  for (const layer of router.stack) {
    if (layer.route) {
      const routePath = layer.route.path;
      const routeMethod = Object.keys(layer.route.methods)[0];
      if (routeMethod === method.toLowerCase() && routePath === path) {
        return layer.route.stack[0].handle;
      }
    }
  }
  return null;
}

beforeEach(() => {
  ordersTable = [];
  bulkGroupsTable = [];
  stockChecksTable = [];
  insertCounter = 0;
});

// ═══════════════════════════════════════════════════════════════════
// 1. ORDERS — User A creates, User B sees it
// ═══════════════════════════════════════════════════════════════════
describe('Data consistency - Orders', () => {
  it('User B sees order created by User A', async () => {
    const createHandler = findHandler(ordersRouter, 'POST', '/');
    const listHandler = findHandler(ordersRouter, 'GET', '/');

    // User A creates an order
    const reqA = mockReq({
      method: 'POST',
      body: { id: 'ORD-101', description: 'Miltenyi Reagent X', quantity: 5 },
      user: userA,
    });
    const resA = mockRes();
    await createHandler(reqA, resA);
    expect(resA._status).toBe(201);

    // User B fetches orders — should see the same order
    const reqB = mockReq({ user: userB, query: {} });
    const resB = mockRes();
    await listHandler(reqB, resB);
    expect(resB._status).toBe(200);
    expect(resB._json).toBeInstanceOf(Array);
    expect(resB._json.length).toBe(1);
    expect(resB._json[0].id).toBe('ORD-101');
    expect(resB._json[0].description).toBe('Miltenyi Reagent X');
  });

  it('Both users see all orders regardless of who created them', async () => {
    const createHandler = findHandler(ordersRouter, 'POST', '/');
    const listHandler = findHandler(ordersRouter, 'GET', '/');

    // User A creates order 1
    await createHandler(
      mockReq({ method: 'POST', body: { id: 'ORD-201', description: 'Order by A', quantity: 1 }, user: userA }),
      mockRes()
    );

    // User B creates order 2
    await createHandler(
      mockReq({ method: 'POST', body: { id: 'ORD-202', description: 'Order by B', quantity: 2 }, user: userB }),
      mockRes()
    );

    // User A fetches — sees both
    const resA = mockRes();
    await listHandler(mockReq({ user: userA, query: {} }), resA);
    expect(resA._json.length).toBe(2);
    const idsA = resA._json.map(o => o.id);
    expect(idsA).toContain('ORD-201');
    expect(idsA).toContain('ORD-202');

    // User B fetches — sees both
    const resB = mockRes();
    await listHandler(mockReq({ user: userB, query: {} }), resB);
    expect(resB._json.length).toBe(2);
    const idsB = resB._json.map(o => o.id);
    expect(idsB).toContain('ORD-201');
    expect(idsB).toContain('ORD-202');
  });

  it('Part arrival update by User A is visible to User B', async () => {
    const createHandler = findHandler(ordersRouter, 'POST', '/');
    const updateHandler = findHandler(ordersRouter, 'PUT', '/:id');
    const listHandler = findHandler(ordersRouter, 'GET', '/');

    // Create an approved order (approval_status must be 'approved' for qty_received updates)
    await createHandler(
      mockReq({ method: 'POST', body: { id: 'ORD-301', description: 'Part', quantity: 10, approval_status: 'approved' }, user: userA }),
      mockRes()
    );

    // User A records part arrival (qty_received)
    const updateReq = mockReq({
      method: 'PUT',
      params: { id: 'ORD-301' },
      body: { qtyReceived: 5 },
      user: userA,
    });
    const updateRes = mockRes();
    await updateHandler(updateReq, updateRes);

    // User B fetches — should see updated qty_received
    const resB = mockRes();
    await listHandler(mockReq({ user: userB, query: {} }), resB);
    expect(resB._json.length).toBe(1);
    expect(resB._json[0].qtyReceived || resB._json[0].qty_received).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. BULK GROUPS — User A creates, User B sees it
// ═══════════════════════════════════════════════════════════════════
describe('Data consistency - Bulk Groups', () => {
  it('User B sees bulk group created by User A', async () => {
    const createHandler = findHandler(bulkGroupsRouter, 'POST', '/');
    const listHandler = findHandler(bulkGroupsRouter, 'GET', '/');

    // User A creates a bulk group
    await createHandler(
      mockReq({ method: 'POST', body: { id: 'BG-101', month: 'Feb 2026' }, user: userA }),
      mockRes()
    );

    // User B fetches — should see it
    const resB = mockRes();
    await listHandler(mockReq({ user: userB }), resB);
    expect(resB._json.length).toBe(1);
    expect(resB._json[0].id).toBe('BG-101');
    expect(resB._json[0].month).toBe('Feb 2026');
  });

  it('Multiple bulk groups from different users are all visible', async () => {
    const createHandler = findHandler(bulkGroupsRouter, 'POST', '/');
    const listHandler = findHandler(bulkGroupsRouter, 'GET', '/');

    await createHandler(
      mockReq({ method: 'POST', body: { id: 'BG-201', month: 'Jan 2026' }, user: userA }),
      mockRes()
    );
    await createHandler(
      mockReq({ method: 'POST', body: { id: 'BG-202', month: 'Feb 2026' }, user: userB }),
      mockRes()
    );

    // Both users see both groups
    for (const user of [userA, userB]) {
      const res = mockRes();
      await listHandler(mockReq({ user }), res);
      expect(res._json.length).toBe(2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. STOCK CHECKS — User A creates, User B sees it
// ═══════════════════════════════════════════════════════════════════
describe('Data consistency - Stock Checks', () => {
  it('User B sees stock check created by User A', async () => {
    const createHandler = findHandler(stockChecksRouter, 'POST', '/');
    const listHandler = findHandler(stockChecksRouter, 'GET', '/');

    await createHandler(
      mockReq({
        method: 'POST',
        body: { id: 'SC-101', checkedBy: 'Alice', items: 50, disc: 2, status: 'In Progress' },
        user: userA,
      }),
      mockRes()
    );

    const resB = mockRes();
    await listHandler(mockReq({ user: userB }), resB);
    expect(resB._json.length).toBe(1);
    expect(resB._json[0].id).toBe('SC-101');
  });

  it('Stock check update by User A is visible to User B', async () => {
    const createHandler = findHandler(stockChecksRouter, 'POST', '/');
    const updateHandler = findHandler(stockChecksRouter, 'PUT', '/:id');
    const listHandler = findHandler(stockChecksRouter, 'GET', '/');

    // Create
    await createHandler(
      mockReq({ method: 'POST', body: { id: 'SC-201', items: 30, status: 'In Progress' }, user: userA }),
      mockRes()
    );

    // User A updates status to Completed
    await updateHandler(
      mockReq({ method: 'PUT', params: { id: 'SC-201' }, body: { status: 'Completed' }, user: userA }),
      mockRes()
    );

    // User B fetches — sees updated status
    const resB = mockRes();
    await listHandler(mockReq({ user: userB }), resB);
    expect(resB._json.length).toBe(1);
    expect(resB._json[0].status).toBe('Completed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. CROSS-ENTITY — Order with bulkGroupId links to bulk group
// ═══════════════════════════════════════════════════════════════════
describe('Data consistency - Bulk-linked orders', () => {
  it('Order created with bulkGroupId is visible in orders list with that link', async () => {
    const createBG = findHandler(bulkGroupsRouter, 'POST', '/');
    const createOrder = findHandler(ordersRouter, 'POST', '/');
    const listOrders = findHandler(ordersRouter, 'GET', '/');

    // User A creates bulk group
    await createBG(
      mockReq({ method: 'POST', body: { id: 'BG-301', month: 'Mar 2026' }, user: userA }),
      mockRes()
    );

    // User A creates order linked to that bulk group
    await createOrder(
      mockReq({
        method: 'POST',
        body: { id: 'ORD-401', description: 'Linked order', quantity: 3, bulk_group_id: 'BG-301' },
        user: userA,
      }),
      mockRes()
    );

    // User B fetches orders — sees the bulkGroupId linkage
    const resB = mockRes();
    await listOrders(mockReq({ user: userB, query: {} }), resB);
    expect(resB._json.length).toBe(1);
    const order = resB._json[0];
    expect(order.bulkGroupId || order.bulk_group_id).toBe('BG-301');
  });
});
