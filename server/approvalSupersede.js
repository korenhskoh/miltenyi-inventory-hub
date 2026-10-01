/**
 * Which still-open approvals a newly sent approval replaces.
 *
 * Resending an approval request for the same orders is an ordinary thing to
 * do — the approver never answered, or the batch was edited and sent again.
 * Each send used to INSERT a fresh row and leave the old one untouched, so the
 * same orders sat under two open approvals at once. Verified against a live
 * server:
 *
 *   APR-1 | ORD-R1, ORD-R2 | approved
 *   APR-2 | ORD-R1, ORD-R2 | pending     <- left behind by the resend
 *
 * and acting on the stale row flipped both orders from Approved back to
 * Rejected — an approval decision silently undone by a row the user had
 * already dealt with.
 *
 * So a new approval supersedes any open one covering any of the same orders.
 * Only rows still awaiting a decision are touched: an already approved or
 * rejected row is a record of something that happened and is left alone.
 */

/** The set of order ids an approval row covers, from either column shape. */
export function approvalOrderIds(row = {}) {
  const ids = new Set();
  const add = (v) => {
    const s = String(v ?? '').trim();
    if (s) ids.add(s);
  };

  // order_ids is the authoritative list (JSONB array). It arrives as an array
  // from Postgres and as a JSON string on the way in, so accept both.
  let list = row.order_ids ?? row.orderIds;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = null;
    }
  }
  if (Array.isArray(list)) list.forEach(add);

  // order_id is a display field: a single id for one order, a comma-joined
  // string for a batch, a bulk group id for a bulk send. Only useful as a
  // fallback when order_ids is absent, and a group id is not an order id, so
  // it is only read for the single and batch shapes.
  if (ids.size === 0) {
    const single = row.order_id ?? row.orderId;
    if (typeof single === 'string') single.split(',').forEach(add);
  }
  return ids;
}

/**
 * Ids of the open approvals that `incoming` replaces.
 *
 * `existing` is every approval row to consider; rows that are not pending, and
 * the incoming row itself, are never returned.
 */
export function supersededApprovalIds(existing = [], incoming = {}) {
  const incomingIds = approvalOrderIds(incoming);
  if (incomingIds.size === 0) return [];
  const incomingKey = String(incoming.id ?? incoming.ID ?? '');

  return existing
    .filter((row) => {
      if (!row) return false;
      if (String(row.status ?? '').toLowerCase() !== 'pending') return false;
      if (incomingKey && String(row.id) === incomingKey) return false;
      const ids = approvalOrderIds(row);
      for (const id of ids) if (incomingIds.has(id)) return true;
      return false;
    })
    .map((row) => row.id);
}
