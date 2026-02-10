import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
    const next = vi.fn();
    return { req, res, next };
  }

  // --- generateToken ---
  it('generateToken returns a string token', () => {
    const token = generateToken({ id: 'U001', username: 'admin', role: 'admin' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  // --- verifyToken ---
  it('rejects request with no Authorization header', () => {
    const { req, res, next } = mockReqResNext();
    verifyToken(req, res, next);
    expect(res._status).toBe(401);
    expect(res._json.error).toMatch(/token/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid token', () => {
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer invalid.token.here' });
    verifyToken(req, res, next);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/invalid|expired/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts request with valid token and sets req.user', () => {
    const token = generateToken({ id: 'U001', username: 'admin', role: 'admin' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });
    verifyToken(req, res, next);
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
    verifyToken(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  // --- requireAdmin ---
  it('requireAdmin allows admin role', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U001', role: 'admin' };
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('requireAdmin rejects non-admin role', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 'U002', role: 'user' };
    requireAdmin(req, res, next);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/admin/i);
    expect(next).not.toHaveBeenCalled();
  });
});
