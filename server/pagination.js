export function paginate(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.limit) || 50));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

export function envelope(rows, total, page, pageSize) {
  return { data: rows, total, page, pageSize };
}
