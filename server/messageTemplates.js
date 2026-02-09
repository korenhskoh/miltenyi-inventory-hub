// WhatsApp Message Templates (Baileys)
export const messageTemplates = {
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

  custom: (data) => data.message
};
