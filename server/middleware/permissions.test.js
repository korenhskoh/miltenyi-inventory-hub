import { describe, it, expect, vi, beforeEach } from 'vitest';

const usersTable = {};
vi.mock('../db.js', () => ({
  query: vi.fn(async (_sql, params) => ({ rows: usersTable[params[0]] ? [usersTable[params[0]]] : [] })),
}));

const { requirePermission, userHasPermission, invalidatePermissionCache } = await import('./permissions.js');

function mockRes() {
  return {
    _status: null,
    _json: null,
    status(c) {
      this._status = c;
      return this;
    },
    json(d) {
      this._json = d;
      return this;
    },
  };
}

describe('permissions middleware', () => {
  beforeEach(() => {
    invalidatePermissionCache();
    usersTable.U1 = { role: 'user', status: 'active', permissions: { approvals: true } };
    usersTable.U2 = { role: 'user', status: 'active', permissions: {} };
    usersTable.U3 = { role: 'user', status: 'inactive', permissions: { approvals: true } };
  });

  it('grants an admin whose account is admin in the DB', async () => {
    usersTable.A1 = { role: 'admin', status: 'active', permissions: {} };
    expect(await userHasPermission({ id: 'A1', role: 'admin' }, 'approvals')).toBe(true);
  });

  it('rejects a token claiming admin when the DB says otherwise', async () => {
    // A demoted account must lose its rights immediately, not when the 24h token expires.
    expect(await userHasPermission({ id: 'U2', role: 'admin' }, 'approvals')).toBe(false);
  });

  it('rejects a user that no longer exists', async () => {
    expect(await userHasPermission({ id: 'GONE', role: 'admin' }, 'orders')).toBe(false);
  });

  it('grants a user with the permission set in the DB', async () => {
    expect(await userHasPermission({ id: 'U1', role: 'user' }, 'approvals')).toBe(true);
  });

  it('denies a user without the permission (defaults apply)', async () => {
    expect(await userHasPermission({ id: 'U2', role: 'user' }, 'approvals')).toBe(false);
    expect(await userHasPermission({ id: 'U2', role: 'user' }, 'orders')).toBe(true); // default true
  });

  it('denies inactive users even if the permission is set', async () => {
    expect(await userHasPermission({ id: 'U3', role: 'user' }, 'approvals')).toBe(false);
  });

  it('requirePermission responds 403 and does not call next when denied', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requirePermission('deleteOrders')({ user: { id: 'U2', role: 'user' } }, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePermission accepts any of several keys', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requirePermission('settings', 'approvals')({ user: { id: 'U1', role: 'user' } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('cache is invalidated on user update', async () => {
    expect(await userHasPermission({ id: 'U2', role: 'user' }, 'approvals')).toBe(false);
    usersTable.U2.permissions = { approvals: true };
    expect(await userHasPermission({ id: 'U2', role: 'user' }, 'approvals')).toBe(false); // cached
    invalidatePermissionCache('U2');
    expect(await userHasPermission({ id: 'U2', role: 'user' }, 'approvals')).toBe(true);
  });
});
