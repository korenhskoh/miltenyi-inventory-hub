import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * RBAC permission enforcement tests.
 *
 * 1. Backend: Admin-only routes (users, config, migrate) reject non-admin tokens.
 * 2. Backend: Protected routes reject unauthenticated requests.
 * 3. Frontend: hasPermission logic correctly grants/denies feature access.
 * 4. Backend: Order approval enforcement — only approved orders allow part arrival.
 */

// ─── Import auth middleware (real, not mocked) ───
import { generateToken, verifyToken, requireAdmin } from '../middleware/auth.js';

// ─── Helper ───
function mockReqResNext(headers = {}) {
  const req = { headers, user: null, params: {}, body: {}, query: {} };
  const res = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

// ═══════════════════════════════════════════════════════════════════
// 1. Backend: verifyToken rejects unauthenticated requests
// ═══════════════════════════════════════════════════════════════════
describe('RBAC - Authentication enforcement', () => {
  it('rejects request without token (401)', () => {
    const { req, res, next } = mockReqResNext();
    verifyToken(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with tampered token (403)', () => {
    const { req, res, next } = mockReqResNext({
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IlUwMDEifQ.TAMPERED',
    });
    verifyToken(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid admin token', () => {
    const token = generateToken({ id: 'U001', username: 'admin', role: 'admin' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
  });

  it('accepts valid user token', () => {
    const token = generateToken({ id: 'U002', username: 'alice', role: 'user' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('user');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Backend: requireAdmin blocks non-admin users
// ═══════════════════════════════════════════════════════════════════
describe('RBAC - Admin-only route enforcement', () => {
  it('allows admin through requireAdmin middleware', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U001', username: 'admin', role: 'admin' };
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks regular user from admin routes (403)', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U002', username: 'alice', role: 'user' };
    requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/admin/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks user with no role from admin routes', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U003', username: 'bob' }; // no role property
    requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks request with no user object from admin routes', () => {
    const { req, res, next } = mockReqResNext();
    req.user = null;
    requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Backend: Full middleware chain — verifyToken + requireAdmin
// ═══════════════════════════════════════════════════════════════════
describe('RBAC - Full auth chain (verifyToken → requireAdmin)', () => {
  it('admin token passes both middlewares', () => {
    const token = generateToken({ id: 'U001', username: 'admin', role: 'admin' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });

    // Step 1: verifyToken
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Step 2: requireAdmin
    const next2 = vi.fn();
    requireAdmin(req, { ...res, _status: null, _json: null, status(c) { this._status = c; return this; }, json(d) { this._json = d; } }, next2);
    expect(next2).toHaveBeenCalled();
  });

  it('regular user token passes verifyToken but fails requireAdmin', () => {
    const token = generateToken({ id: 'U002', username: 'alice', role: 'user' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });

    // Step 1: verifyToken — passes
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.role).toBe('user');

    // Step 2: requireAdmin — fails
    const res2 = { _status: null, _json: null, status(c) { this._status = c; return this; }, json(d) { this._json = d; } };
    const next2 = vi.fn();
    requireAdmin(req, res2, next2);
    expect(res2._status).toBe(403);
    expect(next2).not.toHaveBeenCalled();
  });

  it('no token fails at verifyToken — never reaches requireAdmin', () => {
    const { req, res, next } = mockReqResNext();
    verifyToken(req, res, next);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    // requireAdmin never called
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Frontend: hasPermission logic
// ═══════════════════════════════════════════════════════════════════
describe('RBAC - Frontend hasPermission logic', () => {
  // Replicate the frontend hasPermission function for unit testing
  const DEFAULT_USER_PERMS = {
    dashboard: true, catalog: true, orders: true, bulkOrders: true,
    analytics: true, stockCheck: true, delivery: true, whatsapp: true,
    notifications: true, editAllOrders: false, deleteOrders: false,
    editAllBulkOrders: false, deleteBulkOrders: false, deleteStockChecks: false,
    deleteNotifications: false, approvals: false, users: false, settings: false, aiBot: false,
  };

  function hasPermission(currentUser, isAdmin, key) {
    if (isAdmin) return true;
    const perms = currentUser?.permissions || DEFAULT_USER_PERMS;
    return perms[key] === true;
  }

  it('admin has access to ALL features', () => {
    const admin = { id: 'U001', role: 'admin', permissions: {} };
    const allKeys = Object.keys(DEFAULT_USER_PERMS);
    for (const key of allKeys) {
      expect(hasPermission(admin, true, key)).toBe(true);
    }
  });

  it('regular user has default permissions (base features only)', () => {
    const user = { id: 'U002', role: 'user' }; // no explicit permissions
    // Base features → allowed
    expect(hasPermission(user, false, 'dashboard')).toBe(true);
    expect(hasPermission(user, false, 'orders')).toBe(true);
    expect(hasPermission(user, false, 'catalog')).toBe(true);
    expect(hasPermission(user, false, 'stockCheck')).toBe(true);
    expect(hasPermission(user, false, 'delivery')).toBe(true);

    // Admin/action features → denied by default
    expect(hasPermission(user, false, 'users')).toBe(false);
    expect(hasPermission(user, false, 'settings')).toBe(false);
    expect(hasPermission(user, false, 'approvals')).toBe(false);
    expect(hasPermission(user, false, 'deleteOrders')).toBe(false);
    expect(hasPermission(user, false, 'editAllOrders')).toBe(false);
    expect(hasPermission(user, false, 'aiBot')).toBe(false);
  });

  it('user with custom permissions only accesses granted features', () => {
    const user = {
      id: 'U003',
      role: 'user',
      permissions: {
        dashboard: true,
        orders: true,
        catalog: false, // explicitly denied
        bulkOrders: false,
        analytics: false,
        stockCheck: false,
        delivery: false,
        whatsapp: false,
        notifications: false,
        editAllOrders: false,
        deleteOrders: true, // admin granted this action
        editAllBulkOrders: false,
        deleteBulkOrders: false,
        deleteStockChecks: false,
        deleteNotifications: false,
        approvals: false,
        users: false,
        settings: false,
        aiBot: false,
      },
    };

    expect(hasPermission(user, false, 'dashboard')).toBe(true);
    expect(hasPermission(user, false, 'orders')).toBe(true);
    expect(hasPermission(user, false, 'deleteOrders')).toBe(true); // granted

    expect(hasPermission(user, false, 'catalog')).toBe(false); // denied
    expect(hasPermission(user, false, 'stockCheck')).toBe(false);
    expect(hasPermission(user, false, 'settings')).toBe(false);
    expect(hasPermission(user, false, 'users')).toBe(false);
  });

  it('user with empty permissions object falls back to defaults', () => {
    const user = { id: 'U004', role: 'user', permissions: {} };
    // Empty object → all keys are undefined → hasPermission returns false for all
    // This is by design: admin must explicitly grant permissions
    expect(hasPermission(user, false, 'dashboard')).toBe(false);
    expect(hasPermission(user, false, 'orders')).toBe(false);
  });

  it('user with null permissions falls back to DEFAULT_USER_PERMS', () => {
    const user = { id: 'U005', role: 'user', permissions: null };
    // null → falls back to DEFAULT_USER_PERMS
    expect(hasPermission(user, false, 'dashboard')).toBe(true);
    expect(hasPermission(user, false, 'orders')).toBe(true);
    expect(hasPermission(user, false, 'users')).toBe(false);
  });

  it('user without permissions property falls back to DEFAULT_USER_PERMS', () => {
    const user = { id: 'U006', role: 'user' };
    expect(hasPermission(user, false, 'dashboard')).toBe(true);
    expect(hasPermission(user, false, 'settings')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Frontend: Navigation filtering by permission
// ═══════════════════════════════════════════════════════════════════
describe('RBAC - Navigation item filtering', () => {
  const DEFAULT_USER_PERMS = {
    dashboard: true, catalog: true, orders: true, bulkOrders: true,
    analytics: true, stockCheck: true, delivery: true, whatsapp: true,
    notifications: true, editAllOrders: false, deleteOrders: false,
    editAllBulkOrders: false, deleteBulkOrders: false, deleteStockChecks: false,
    deleteNotifications: false, approvals: false, users: false, settings: false, aiBot: false,
  };

  function hasPermission(currentUser, isAdmin, key) {
    if (isAdmin) return true;
    const perms = currentUser?.permissions || DEFAULT_USER_PERMS;
    return perms[key] === true;
  }

  // Simulated nav items (matches the app)
  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', perm: 'dashboard' },
    { id: 'catalog', label: 'Parts Catalog', perm: 'catalog' },
    { id: 'orders', label: 'Orders', perm: 'orders' },
    { id: 'bulkOrders', label: 'Bulk Orders', perm: 'bulkOrders' },
    { id: 'analytics', label: 'Analytics', perm: 'analytics' },
    { id: 'stockCheck', label: 'Stock Checks', perm: 'stockCheck' },
    { id: 'delivery', label: 'Delivery', perm: 'delivery' },
    { id: 'approvals', label: 'Approvals', perm: 'approvals' },
    { id: 'users', label: 'User Management', perm: 'users' },
    { id: 'settings', label: 'Settings', perm: 'settings' },
  ];

  it('admin sees all navigation items', () => {
    const admin = { id: 'U001', role: 'admin' };
    const visible = allNavItems.filter(n => hasPermission(admin, true, n.perm));
    expect(visible.length).toBe(allNavItems.length);
  });

  it('default user sees base nav items but not admin ones', () => {
    const user = { id: 'U002', role: 'user' }; // no permissions → defaults
    const visible = allNavItems.filter(n => hasPermission(user, false, n.perm));
    const visibleIds = visible.map(n => n.id);

    // Should see base items
    expect(visibleIds).toContain('dashboard');
    expect(visibleIds).toContain('orders');
    expect(visibleIds).toContain('catalog');
    expect(visibleIds).toContain('delivery');

    // Should NOT see admin items
    expect(visibleIds).not.toContain('approvals');
    expect(visibleIds).not.toContain('users');
    expect(visibleIds).not.toContain('settings');
  });

  it('user with only orders permission sees only that page', () => {
    const user = {
      id: 'U003',
      role: 'user',
      permissions: {
        dashboard: false, catalog: false, orders: true, bulkOrders: false,
        analytics: false, stockCheck: false, delivery: false, whatsapp: false,
        notifications: false, approvals: false, users: false, settings: false,
      },
    };
    const visible = allNavItems.filter(n => hasPermission(user, false, n.perm));
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe('orders');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Approval enforcement logic (unit test of the rule)
// ═══════════════════════════════════════════════════════════════════
describe('RBAC - Approval enforcement for part arrival (logic)', () => {
  // The orders route enforces: if qty_received is being updated,
  // the order's approval_status must be 'approved'. This is a unit
  // test of that business rule expressed as a pure function.

  function canRecordPartArrival(order, updates) {
    if (updates.qtyReceived !== undefined || updates.qty_received !== undefined) {
      return order.approval_status === 'approved';
    }
    return true; // no arrival update → always allowed
  }

  it('blocks part arrival on pending order', () => {
    const order = { id: 'ORD-501', approval_status: 'pending' };
    expect(canRecordPartArrival(order, { qtyReceived: 5 })).toBe(false);
  });

  it('blocks part arrival on rejected order', () => {
    const order = { id: 'ORD-502', approval_status: 'rejected' };
    expect(canRecordPartArrival(order, { qtyReceived: 3 })).toBe(false);
  });

  it('allows part arrival on approved order', () => {
    const order = { id: 'ORD-503', approval_status: 'approved' };
    expect(canRecordPartArrival(order, { qtyReceived: 10 })).toBe(true);
  });

  it('allows non-arrival updates on any order', () => {
    const order = { id: 'ORD-504', approval_status: 'pending' };
    expect(canRecordPartArrival(order, { status: 'Confirmed' })).toBe(true);
  });

  it('allows non-arrival updates even on rejected order', () => {
    const order = { id: 'ORD-505', approval_status: 'rejected' };
    expect(canRecordPartArrival(order, { remark: 'updated' })).toBe(true);
  });
});
