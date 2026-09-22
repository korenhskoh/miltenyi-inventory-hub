import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../logger.js';
import { isActiveAdmin, currentAccount } from './permissions.js';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Refuse to boot: a random per-process secret logs everyone out on each
    // restart and, with multiple instances, makes tokens unverifiable.
    logger.fatal('JWT_SECRET is not set. Set a stable JWT_SECRET (e.g. `openssl rand -hex 32`) and restart.');
    process.exit(1);
  } else {
    logger.warn('JWT_SECRET not set — generating random secret (tokens will not survive restarts)');
  }
}
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = '24h';

/**
 * Generate a JWT token for a user
 */
export function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Middleware: verify the JWT, then confirm the account still exists and is active.
 *
 * A valid signature is not enough. Tokens live for 24 hours, so checking only
 * the signature meant that suspending or deleting an account did nothing for a
 * day: the person's browser kept reading and writing orders, and the only thing
 * that noticed was /auth/me, which nothing but the SPA consults. Deactivation is
 * the control you reach for when someone leaves or an account is compromised,
 * so it has to bite on the next request, not tomorrow.
 *
 * The lookup is the same 30-second-cached one the permission checks already use,
 * so this costs a database round trip at most twice a minute per user.
 *
 * `role` is refreshed from the row rather than trusted from the claim, which is
 * what stops a demoted admin keeping admin-shaped answers until their token
 * expires.
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // Expired token → 401 so the client clears its session and shows the login
    // screen. Tampered/invalid tokens stay 403.
    if (err && err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }

  let account;
  try {
    account = await currentAccount(decoded.id);
  } catch (e) {
    // The account may be perfectly fine — we simply cannot tell. Answering 401
    // would log everyone out over a database blip, so this is reported as a
    // temporary fault instead.
    logger.error({ err: e }, 'Could not verify the account behind a token');
    return res.status(503).json({ error: 'Account verification is unavailable. Please try again.' });
  }

  if (!account) {
    return res.status(401).json({ error: 'This account no longer exists. Please log in again.' });
  }
  if (account.status !== 'active') {
    return res.status(403).json({ error: 'This account is not active. Contact an administrator.' });
  }

  // The claim is a snapshot from login; the row is the truth.
  req.user = { ...decoded, role: account.role };
  next();
}

/**
 * Middleware: require admin role (must be used after verifyToken).
 * Verified against the database, not the token's role claim — see
 * isActiveAdmin() for why.
 */
export async function requireAdmin(req, res, next) {
  if (await isActiveAdmin(req.user)) return next();
  return res.status(403).json({ error: 'Admin access required.' });
}
