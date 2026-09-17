// Arrival / back-order maths shared by Part Arrival confirm, batch confirm and Edit Order.
//
// App convention: `backOrder = qtyReceived - quantity` (negative while items are
// outstanding, 0 when fully received). An order only becomes 'Received' once the
// full quantity has arrived; a partial delivery keeps its current status.

const num = (v) => Number(v) || 0;

/**
 * Compute the arrival fields for `order` when `qtyReceivedNow` units have been
 * received in total (not the delta).
 * @returns {{ qtyReceived: number, backOrder: number, status: string }}
 */
export function computeArrival(order, qtyReceivedNow) {
  const quantity = num(order?.quantity);
  const qtyReceived = num(qtyReceivedNow);
  return {
    qtyReceived,
    backOrder: qtyReceived - quantity,
    status: qtyReceived >= quantity ? 'Received' : order?.status,
  };
}

/** Newly received units compared with what the order already recorded. */
export function arrivalDelta(order, qtyReceivedNow) {
  return num(qtyReceivedNow) - num(order?.qtyReceived);
}
