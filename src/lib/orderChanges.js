/**
 * What else changes when an order is edited or removed, and how to say so.
 *
 * Deleting an order is not a self-contained act. If parts have already been
 * booked in against it, those units stay in Local Inventory with a stock
 * movement that now points at an order that no longer exists — verified: six
 * units of a part survived their order's deletion, with the transaction still
 * reading "Part arrival for ORD-E1". If the order belongs to a batch, the
 * batch's item count and value are recalculated, and the batch is removed
 * entirely when its last line goes. None of that was mentioned in a confirm
 * that read only "Delete order ORD-E1?".
 */

const num = (v) => Number(v) || 0;

/**
 * Describe the consequences of deleting `orders` (one or many).
 *
 * `allOrders` is the full list, needed to tell whether a batch is being
 * emptied rather than merely reduced.
 */
export function deletionImpact(orders = [], allOrders = []) {
  const doomed = orders.filter(Boolean);
  const doomedIds = new Set(doomed.map((o) => o.id));

  const receivedUnits = doomed.reduce((s, o) => s + num(o.qtyReceived), 0);
  const withStock = doomed.filter((o) => num(o.qtyReceived) > 0);

  const groupIds = [...new Set(doomed.map((o) => o.bulkGroupId).filter(Boolean))];
  const emptiedGroups = groupIds.filter((id) => {
    const survivors = allOrders.filter((o) => o.bulkGroupId === id && !doomedIds.has(o.id));
    return survivors.length === 0;
  });

  const approved = doomed.filter((o) => String(o.approvalStatus || '').toLowerCase() === 'approved');

  return {
    count: doomed.length,
    receivedUnits,
    partsWithStock: withStock.map((o) => ({
      id: o.id,
      materialNo: o.materialNo || '',
      qtyReceived: num(o.qtyReceived),
    })),
    affectedGroups: groupIds,
    emptiedGroups,
    approvedCount: approved.length,
  };
}

/**
 * The confirmation text for a deletion, naming every side effect.
 * Returns a single string suitable for window.confirm.
 */
export function deletionWarning(orders = [], allOrders = []) {
  const i = deletionImpact(orders, allOrders);
  const subject = i.count === 1 ? `order ${orders[0]?.id}` : `${i.count} orders`;
  const lines = [`Delete ${subject}?`, ''];

  if (i.receivedUnits > 0) {
    const where = i.partsWithStock.map((p) => `${p.materialNo || p.id} (${p.qtyReceived})`).join(', ');
    lines.push(
      `• ${i.receivedUnits} unit(s) have already been booked into Local Inventory: ${where}.`,
      '  Deleting the order does NOT take them back out of stock — adjust Local Inventory by hand if they should not be there.',
    );
  }
  if (i.affectedGroups.length) {
    lines.push(
      `• ${i.affectedGroups.length} bulk batch(es) will have their item count and total value recalculated: ${i.affectedGroups.join(', ')}.`,
    );
  }
  if (i.emptiedGroups.length) {
    lines.push(`• ${i.emptiedGroups.join(', ')} will be left empty and removed entirely.`);
  }
  if (i.approvedCount > 0) {
    lines.push(`• ${i.approvedCount} of these were already approved.`);
  }

  lines.push('', 'This cannot be undone.');
  return lines.join('\n');
}

/** True when the deletion touches anything beyond the orders themselves. */
export function hasSideEffects(orders = [], allOrders = []) {
  const i = deletionImpact(orders, allOrders);
  return i.receivedUnits > 0 || i.affectedGroups.length > 0 || i.emptiedGroups.length > 0;
}

/**
 * Did this API result mean the write did not happen?
 *
 * The order helpers answer in three shapes — `null`/`false` from the older
 * wrappers, `{ ok: false, error }` from the reporting ones, and `{ error }`
 * straight from the server — and an optimistic UI change has to be undone for
 * every one of them. Getting this wrong in either direction is bad: miss a
 * failure and the screen keeps a value that was never saved, treat a success as
 * a failure and a good edit is thrown away.
 */
export function writeFailed(result) {
  if (result === null || result === undefined || result === false) return true;
  if (typeof result !== 'object') return false;
  if (result.ok === false) return true;
  if (result.ok === true) return false;
  if (result.error) return true;
  return false;
}

/** The reason to show the user, when there is one. */
export function failureReason(result, fallback) {
  if (result && typeof result === 'object' && result.error) return String(result.error);
  return fallback || 'The server refused the change — the screen has been put back.';
}
