// Pricing helpers shared by the dashboard, analytics, approval emails and order tables.
//
// Convention (matches AllOrdersPage): the price stored on the order wins when it is
// > 0 (it is what was approved / costed); the catalog price is only a fallback for
// orders that were saved without a price.

const num = (v) => Number(v) || 0;

/** Catalog price for a catalog row `{ sg, tp, dist }`: SG → transfer → distributor. */
export function getCatalogPrice(cp) {
  if (!cp) return 0;
  return num(cp.sg) || num(cp.tp) || num(cp.dist) || 0;
}

/** Unit price for an order: stored listPrice > 0, else the catalog price, else 0. */
export function getEffectiveUnitPrice(order, catalogLookup) {
  if (!order) return 0;
  const stored = num(order.listPrice);
  if (stored > 0) return stored;
  return getCatalogPrice(catalogLookup?.[order.materialNo]);
}

/**
 * Line total for an order: effective unit price × quantity, else the stored totalCost.
 *
 * The quantity has to be real for the multiplication to mean anything. An
 * imported row from a sheet with no quantity column arrives as quantity 0 while
 * still carrying the total cost the sheet recorded, and computing `price × 0`
 * silently wrote that value down to nothing: the row showed a dash, contributed
 * zero to every total on the page, and exported at its true value — so the
 * export and the screen disagreed by the whole amount. Where there is no
 * quantity to multiply, the stored total is the only figure there is.
 */
export function getEffectiveTotal(order, catalogLookup) {
  if (!order) return 0;
  const qty = num(order.quantity);
  const price = getEffectiveUnitPrice(order, catalogLookup);
  if (price > 0 && qty > 0) return price * qty;
  return num(order.totalCost);
}
