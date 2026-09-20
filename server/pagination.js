export function paginate(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.limit) || 50));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

// Opt-in escape hatch: `?all=true` returns every row without LIMIT/OFFSET.
// The SPA loads several tables wholesale and derives totals / bulk-group
// membership from them, so a silent 50-row cap corrupts those calculations.
export function wantsAll(query) {
  return query.all === 'true' || query.all === '1';
}

// Build the trailing LIMIT/OFFSET clause (or nothing when returning all rows).
// Returns { clause, params } so callers can append to their own param list.
export function limitClause(req, startIndex) {
  if (wantsAll(req.query)) return { clause: '', params: [] };
  const { pageSize, offset } = paginate(req.query);
  return { clause: ` LIMIT $${startIndex} OFFSET $${startIndex + 1}`, params: [pageSize, offset] };
}

export function envelope(rows, total, page, pageSize) {
  // pageSize 0 (an `all=true` query that matched nothing) makes clients compute
  // total/pageSize as Infinity or NaN — report at least 1.
  return { data: rows, total, page, pageSize: pageSize || total || 1 };
}
