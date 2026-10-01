/**
 * What editing an order's ordered quantity does to the figures derived from it.
 *
 * `back_order` and `status` are not independent facts — they are read off the
 * ordered and received quantities. POST /:id/arrival keeps them that way when
 * the RECEIVED side moves; nothing did when the ORDERED side moved, so a plain
 * PUT left them behind. Verified against a live server, 5 of 5 received:
 *
 *   edit quantity 5 -> 3 : qty=3 recv=5 back=0  status=Received
 *   edit quantity 5 -> 8 : qty=8 recv=5 back=0  status=Received
 *
 * The first says five units were received against an order for three, with no
 * over-delivery recorded. The second is the damaging one: three units are still
 * outstanding and the order reads as closed, so the back-order reports and the
 * chase lists skip it entirely — exactly the "qty received / qty back order"
 * pairing the engineers rely on to know what is still coming.
 *
 * Reducing below what is already received is refused rather than reconciled.
 * The units are physically on the shelf with a stock movement behind them, and
 * no edit to a number in a form should quietly mean "those two never arrived";
 * correcting the arrival is what does that, and it moves the stock with it.
 */

const int = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/**
 * @param order   the stored row: { quantity, qty_received, status }
 * @param newQty  the quantity being written
 * @returns { error } to refuse, or { derived: { back_order, status? } }
 */
export function quantityEditOutcome(order = {}, newQty) {
  const quantity = int(newQty);
  const received = int(order.qty_received);
  const current = String(order.status ?? '');

  if (quantity < 0) {
    return { error: 'quantity must be a non-negative number' };
  }
  if (quantity < received) {
    return {
      error:
        `Cannot reduce the ordered quantity to ${quantity}; ${received} have already been received ` +
        `and are in Local Inventory. Correct the arrival first (POST /api/orders/:id/arrival), ` +
        `so the stock moves with it.`,
    };
  }

  const derived = { back_order: received - quantity };

  // Fully received closes the order; raising the quantity above what arrived
  // reopens it, because the rest is still outstanding.
  const nowFull = quantity > 0 && received >= quantity;
  const wasReceived = current.toLowerCase() === 'received';
  if (nowFull && !wasReceived) derived.status = 'Received';
  else if (!nowFull && wasReceived) derived.status = 'Approved';

  return { derived };
}
