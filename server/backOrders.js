/**
 * One definition of "back order", shared by every surface that reports it.
 *
 * `orders.back_order` is written as (received − ordered), so it is NEGATIVE
 * when a delivery falls short — and every order carries it from creation,
 * before anything has shipped. Three places had drifted apart on the strength
 * of that one field:
 *
 *   - the dashboard tile counted short deliveries (right),
 *   - the scheduled email counted `back_order < 0`, which is every order that
 *     has not fully arrived yet, rejected ones included,
 *   - the WhatsApp monthly report counted `back_order > 0`, which a short
 *     delivery can never satisfy — it reported 0 every month, for every month.
 *
 * On one live dataset those three read 3, 13 and 0 for the same question.
 *
 * What makes a row a back order is that SOMETHING arrived and it was not
 * everything — not whether an arrival date was typed in, since these workbooks
 * routinely fill the received count and leave the date column blank. This
 * matches arrivalCondition() in src/lib/arrival.js.
 */
export const BACK_ORDER_SQL = `COALESCE(qty_received, 0) > 0
  AND COALESCE(qty_received, 0) < COALESCE(quantity, 0)
  AND COALESCE(status, '') <> 'Rejected'`;

/** The same test, for a row already in hand. */
export function isBackOrder(row) {
  const received = Number(row?.qty_received ?? row?.qtyReceived) || 0;
  const ordered = Number(row?.quantity) || 0;
  const status = String(row?.status ?? '');
  return received > 0 && received < ordered && status !== 'Rejected';
}

/** Units still outstanding on a short delivery. */
export function outstandingUnits(row) {
  if (!isBackOrder(row)) return 0;
  return (Number(row?.quantity) || 0) - (Number(row?.qty_received ?? row?.qtyReceived) || 0);
}
