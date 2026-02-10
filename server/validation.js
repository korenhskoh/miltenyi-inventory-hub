/**
 * Pick only allowed fields from an object (prevents mass assignment).
 * Skips null and undefined values.
 */
export function pickAllowed(obj, allowedFields) {
  const result = {};
  for (const field of allowedFields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Check that all required fields are present and non-empty.
 * Returns null if valid, or an error message string listing missing fields.
 */
export function requireFields(obj, requiredFields) {
  const missing = requiredFields.filter(f => !obj[f] && obj[f] !== 0 && obj[f] !== false);
  if (missing.length === 0) return null;
  return `Missing required fields: ${missing.join(', ')}`;
}
