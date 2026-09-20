// Pure pagination maths, shared by every table so they all behave the same.

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 'All'];

/** Is this page size the "show everything" option? */
export const isAllSize = (size) => size === 'All' || size === 0 || size === Infinity;

/**
 * Slice `items` for a 1-based page.
 * The page is clamped during the calculation, so a list that shrinks under the
 * user (a filter, a delete) lands on the last page instead of showing nothing.
 */
export function paginate(items, page, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  if (isAllSize(pageSize)) {
    return { pageItems: list, page: 1, totalPages: 1, total, from: total ? 1 : 0, to: total };
  }
  const size = Math.max(1, Number(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (safePage - 1) * size;
  const pageItems = list.slice(start, start + size);
  return {
    pageItems,
    page: safePage,
    totalPages,
    total,
    from: total ? start + 1 : 0,
    to: Math.min(start + size, total),
  };
}

/** "Showing 51–100 of 1,640 orders" */
export function rangeLabel({ from, to, total }, unit = 'items') {
  const n = (v) => v.toLocaleString();
  if (!total) return `No ${unit}`;
  if (from === 1 && to === total) return `${n(total)} ${unit}`;
  return `Showing ${n(from)}–${n(to)} of ${n(total)} ${unit}`;
}
