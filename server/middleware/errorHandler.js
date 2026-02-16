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
  res.status(status).json({
    error: {
      code: status,
      message: status === 500 ? 'Internal server error' : err.message,
    },
  });
}
