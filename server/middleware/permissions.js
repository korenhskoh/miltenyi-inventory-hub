import { query } from '../db.js';
import logger from '../logger.js';

/**
 * Feature permissions. These mirror DEFAULT_USER_PERMS in the SPA so the server
 * enforces exactly what the UI shows/hides. Admins implicitly have everything.
 */
export const DEFAULT_USER_PERMS = {
  dashboard: true,
  catalog: true,
  orders: true,
  bulkOrders: true,
  analytics: true,
  stockCheck: true,
  delivery: true,
  whatsapp: true,
  notifications: true,
  auditTrail: false,
  editAllOrders: false,
  deleteOrders: false,
  editAllBulkOrders: false,
  deleteBulkOrders: false,
  deleteStockChecks: false,
  deleteNotifications: false,
  approvals: false,
  users: false,
  settings: false,
  aiBot: false,
};

// Small per-user cache so we don't hit the DB on every request.
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // userId -> { at, perms, role, status }

export function invalidatePermissionCache(userId) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function loadUser(userId) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  const r = await query('SELECT role, status, permissions FROM users WHERE id = $1', [userId]);
  const row = r.rows[0];
  let perms = row?.permissions;
  if (typeof perms === 'string') {
    try {
      perms = JSON.parse(perms);
    } catch {
      perms = null;
    }
  }
  const entry = {
    at: Date.now(),
    role: row?.role || null,
    status: row?.status || null,
    perms: { ...DEFAULT_USER_PERMS, ...(perms && typeof perms === 'object' ? perms : {}) },
  };
  cache.set(userId, entry);
  return entry;
}

/** Resolve whether the request's user holds a permission (admins always do). */
export async function userHasPermission(reqUser, key) {
  if (!reqUser) return false;
  if (reqUser.role === 'admin') return true;
  try {
    const u = await loadUser(reqUser.id);
    if (u.status && u.status !== 'active') return false;
    if (u.role === 'admin') return true;
    return u.perms[key] === true;
  } catch (e) {
    logger.error({ err: e, key }, 'Permission lookup failed');
    return false;
  }
}

/**
 * Middleware factory: require one of the given permission keys.
 * Must run after verifyToken.
 */
export function requirePermission(...keys) {
  return async (req, res, next) => {
    for (const k of keys) {
      if (await userHasPermission(req.user, k)) return next();
    }
    return res.status(403).json({ error: `Permission required: ${keys.join(' or ')}` });
  };
}
