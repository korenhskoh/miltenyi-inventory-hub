import { describe, it, expect, vi, beforeEach } from 'vitest';

// requireAdmin verifies the role against the DB (not the token claim), so the
// database layer has to be stubbed here.
const usersTable = {
  U001: { role: 'admin', status: 'active', permissions: {} },
  U002: { role: 'user', status: 'active', permissions: {} },
  U004: { role: 'admin', status: 'inactive', permissions: {} },
  U005: { role: 'user', status: 'suspended', permissions: {} },
};
vi.mock('../db.js', () => ({
  query: vi.fn(async (_sql, params) => ({ rows: usersTable[params?.[0]] ? [usersTable[params[0]]] : [] })),
}));

describe('JWT auth middleware', () => {
  let verifyToken, requireAdmin, generateToken, JWT_SECRET;

  beforeEach(async () => {
    // Fresh import each test
    const mod = await import('./auth.js');
    verifyToken = mod.verifyToken;
    requireAdmin = mod.requireAdmin;
    generateToken = mod.generateToken;
    JWT_SECRET = mod.JWT_SECRET;
  });

  function mockReqResNext(headers = {}) {
    const req = { headers };
    const res = {
      _status: null,
      _json: null,
      status(code) {
        this._status = code;
        return this;
      },
      json(data) {
        this._json = data;
        return this;
      },
    };
    const next = vi.fn();
    return { req, res, next };
  }

  // --- generateToken ---
  it('generateToken returns a string token', async () => {
    const token = generateToken({ id: 'U001', username: 'admin', role: 'admin' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  // --- verifyToken ---
  it('rejects request with no Authorization header', async () => {
    const { req, res, next } = mockReqResNext();
    await verifyToken(req, res, next);
    expect(res._status).toBe(401);
    expect(res._json.error).toMatch(/token/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid token', async () => {
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer invalid.token.here' });
    await verifyToken(req, res, next);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/invalid|expired/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts request with valid token and sets req.user', async () => {
    const token = generateToken({ id: 'U001', username: 'admin', role: 'admin' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('U001');
    expect(req.user.role).toBe('admin');
  });

  it('rejects expired token', async () => {
    // Import jwt to create an expired token
    const jwt = (await import('jsonwebtoken')).default;
    const expiredToken = jwt.sign({ id: 'U001' }, JWT_SECRET, { expiresIn: '-1s' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${expiredToken}` });
    await verifyToken(req, res, next);
    // Expired (as opposed to tampered) tokens return 401 so the SPA logs the user out
    expect(res._status).toBe(401);
    expect(res._json.error).toMatch(/expired/i);
    expect(next).not.toHaveBeenCalled();
  });

  // --- requireAdmin ---
  it('requireAdmin allows an active admin', async () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U001', role: 'admin' };
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('requireAdmin rejects non-admin role', async () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U002', role: 'user' };
    await requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/admin/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAdmin rejects a token claiming admin for a demoted account', async () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U002', role: 'admin' }; // stale claim, DB says 'user'
    await requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAdmin rejects a suspended admin', async () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U004', role: 'admin' };
    await requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Revocation ──────────────────────────────────────────────────────────
  //
  // Verifying only the signature meant a token stayed good for its full 24
  // hours: suspending or deleting an account did nothing, and the person's
  // browser kept reading and writing until it expired.

  it('refuses a token whose account has been suspended', async () => {
    const { req, res, next } = mockReqResNext({
      authorization: `Bearer ${generateToken({ id: 'U005', username: 's', role: 'user' })}`,
    });
    await verifyToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  it('refuses a token whose account no longer exists', async () => {
    const { req, res, next } = mockReqResNext({
      authorization: `Bearer ${generateToken({ id: 'U999', username: 'ghost', role: 'user' })}`,
    });
    await verifyToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('takes the role from the database, not from the token claim', async () => {
    // A demoted admin keeps a token that still says admin. Trusting it handed
    // them admin-shaped answers — including the stored SMTP password — for the
    // rest of the day.
    const { req, res, next } = mockReqResNext({
      authorization: `Bearer ${generateToken({ id: 'U002', username: 'u', role: 'admin' })}`,
    });
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('user');
  });
});
