import logger from '../logger.js';

export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  logger.error({ err, url: req.originalUrl, method: req.method }, err.message);
  // `error` must be a STRING here. Route handlers return `{ error: 'message' }`
  // and the SPA passes that value straight into toast text, so returning an
  // object from this one place made React throw "Objects are not valid as a
  // React child" and the root ErrorBoundary replaced the whole app — losing
  // whatever the user had unsaved — on any unhandled 500.
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    code: status,
  });
}
