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

/** Line total for an order: effective unit price × quantity, else the stored totalCost. */
export function getEffectiveTotal(order, catalogLookup) {
  if (!order) return 0;
  const price = getEffectiveUnitPrice(order, catalogLookup);
  return price > 0 ? price * num(order.quantity) : num(order.totalCost);
}
