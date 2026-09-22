// WhatsApp Message Templates (Baileys)
const templates = {
  orderCreated: (data) => `\u{1F6D2} *New Order Created*

Order ID: ${data.orderId}
Item: ${data.description}
Material: ${data.materialNo}
Quantity: ${data.quantity}
Total: ${data.total}
Ordered By: ${data.orderBy}
Date: ${data.date}

_Miltenyi Inventory Hub SG_`,

  backorderReceived: (data) => `\u{1F4E6} *Backorder Update*

Good news! Items have arrived:

Order ID: ${data.orderId}
Item: ${data.description}
Received: ${data.received}/${data.ordered}
${data.remaining > 0 ? `Still Pending: ${data.remaining}` : '\u2705 Fully Received'}

_Miltenyi Inventory Hub SG_`,

  backOrderUpdate: (data) => `\u{1F4E6} *Short Delivery*

Order ID: ${data.orderId}
Item: ${data.description}
Received: ${data.qtyReceived} of ${data.quantity}
Still Outstanding: ${data.backOrders}
Verified By: ${data.verifiedBy}
Date: ${data.date}

_Miltenyi Inventory Hub SG_`,

  deliveryArrival: (data) => `\u{1F69A} *Delivery Arrived*

Bulk Order: ${data.month}
Items Delivered: ${data.itemCount}
Total Value: ${data.totalValue}

Please verify and update received quantities in the system.

_Miltenyi Inventory Hub SG_`,

  partArrivalDone: (data) => `\u2705 *Part Arrival Verified*

Month: ${data.month}
Total Items: ${data.totalItems}
${data.backOrders > 0 ? `Received: ${data.received}\nBack Order: ${data.backOrders}` : `All Received: ${data.received}`}
Verified By: ${data.verifiedBy}
Date: ${data.date}

Items:
${data.itemsList}

_Miltenyi Inventory Hub SG_`,

  stockAlert: (data) => `\u26A0\uFE0F *Stock Discrepancy Alert*

Stock Check: ${data.checkId}
Discrepancies Found: ${data.discrepancies}
Checked By: ${data.checkedBy}
Date: ${data.date}

Please review the stock check report.

_Miltenyi Inventory Hub SG_`,

  monthlyUpdate: (data) => `\u{1F4CA} *Monthly Summary - ${data.month}*

Orders: ${data.totalOrders}
Received: ${data.received}
Pending: ${data.pending}
Back Orders: ${data.backOrders}
Total Value: ${data.totalValue}

_Miltenyi Inventory Hub SG_`,

  custom: (data) => data.message,
};

/**
 * Render with a missing field showing as an em dash rather than "undefined".
 *
 * These templates interpolate `data.x` directly, so any caller that omits a
 * field broadcast the literal text "undefined" to everyone — and a POST to
 * /api/whatsapp/send with a template but no data threw, answering 500 instead
 * of a useful 400. Reading through a proxy fixes every template at once,
 * including any added later.
 */
const withDefaults = (data) =>
  new Proxy(data && typeof data === 'object' ? data : {}, {
    get(target, key) {
      const v = target[key];
      if (v === undefined || v === null || v === '') return '—';
      return v;
    },
  });

export const messageTemplates = Object.fromEntries(
  Object.entries(templates).map(([key, fn]) => [
    key,
    (data) => {
      // `custom` is the user's own message; an em dash for a missing one would
      // be nonsense, so it keeps the plain behaviour with an explicit fallback.
      if (key === 'custom') return String(data?.message ?? '').trim() || '(empty message)';
      return fn(withDefaults(data));
    },
  ]),
);
