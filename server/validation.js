/**
 * Pick only allowed fields from an object (prevents mass assignment).
 * Skips undefined values. Skips null too unless `keepNull` is set — updates
 * need to be able to clear a column (e.g. remove a contract end date).
 */
export function pickAllowed(obj, allowedFields, { keepNull = false, nullable = null } = {}) {
  const result = {};
  const nullableSet = nullable instanceof Set ? nullable : nullable ? new Set(nullable) : null;
  for (const field of allowedFields) {
    if (obj[field] === undefined) continue;
    // Clearing a field is a real edit, not a no-op. Dropping every null meant
    // "remove this order from its bulk group" (bulkGroupId: null) arrived as an
    // empty body and came back 400 "No fields to update" — the row vanished
    // from the modal optimistically and was still in the group after a reload,
    // so the batch kept showing its old item count.
    //
    // Only the fields named in `nullable` may be cleared, so this does not
    // become a way to blank a quantity or a status by accident.
    if (obj[field] === null) {
      const allowedToClear = keepNull || (nullableSet ? nullableSet.has(field) : false);
      if (!allowedToClear) continue;
    }
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
