import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../logger.js';

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
 * Middleware: verify JWT token from Authorization header
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // Expired token → 401 so the client clears its session and shows the login
    // screen. Tampered/invalid tokens stay 403.
    if (err && err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware: require admin role (must be used after verifyToken)
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}
