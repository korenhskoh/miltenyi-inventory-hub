/**
 * Pick only allowed fields from an object (prevents mass assignment).
 * Skips undefined values. Skips null too unless `keepNull` is set — updates
 * need to be able to clear a column (e.g. remove a contract end date).
 */
export function pickAllowed(obj, allowedFields, { keepNull = false } = {}) {
  const result = {};
  for (const field of allowedFields) {
    if (obj[field] === undefined) continue;
    if (obj[field] === null && !keepNull) continue;
    result[field] = obj[field];
  }
  return result;
}

/**
 * Normalise DATE columns: empty strings are invalid for PostgreSQL DATE.
 * On create we drop the key so the column default applies; on update
 * (`nullOnEmpty`) we write NULL so the user can clear a date.
 */
export function sanitizeDates(obj, dateFields, { nullOnEmpty = false } = {}) {
  for (const f of dateFields) {
    if (!(f in obj)) continue;
    if (obj[f] === '' || obj[f] === undefined) {
      if (nullOnEmpty) obj[f] = null;
      else delete obj[f];
    } else if (typeof obj[f] === 'string' && obj[f].length > 10 && /^\d{4}-\d{2}-\d{2}T/.test(obj[f])) {
      // ISO timestamp → plain date (client may echo back a value it received)
      obj[f] = obj[f].slice(0, 10);
    }
  }
  return obj;
}

/**
 * Check that all required fields are present and non-empty.
 * Returns null if valid, or an error message string listing missing fields.
 */
export function requireFields(obj, requiredFields) {
  const missing = requiredFields.filter((f) => !obj[f] && obj[f] !== 0 && obj[f] !== false);
  if (missing.length === 0) return null;
  return `Missing required fields: ${missing.join(', ')}`;
}
