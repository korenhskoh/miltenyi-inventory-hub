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
    // `quantity > 0` matters: an imported row whose quantity cell was blank
    // comes through as 0, and `0 >= 0` marked it Received the moment anyone
    // pressed Confirm — closing out a line nobody had delivered.
    status: quantity > 0 && qtyReceived >= quantity ? 'Received' : order?.status,
  };
}

/**
 * Which of the three arrival states an order is in.
 *
 * One definition, because the page had three that disagreed. The status pill
 * and the tab filter both required an arrival DATE before they would call a
 * short delivery a back order, and the headline tiles required one too — so an
 * imported row with 4 of 10 received and a blank arrival-date cell (routine in
 * these workbooks, where the received count is filled in but the date column is
 * not) was labelled "0/10 Awaiting" next to an input showing 4, and was counted
 * in none of the three tiles at all.
 *
 * What decides it is the quantity received, not whether someone wrote a date.
 */
export function arrivalCondition(order) {
  const quantity = num(order?.quantity);
  const received = num(order?.qtyReceived);
  if (quantity > 0 && received >= quantity) return 'Arrived';
  if (received > 0) return 'Back Order';
  return 'Awaiting';
}

/** Newly received units compared with what the order already recorded. */
export function arrivalDelta(order, qtyReceivedNow) {
  return num(qtyReceivedNow) - num(order?.qtyReceived);
}
