// Default email templates seeded into app_config
export const defaultEmailTemplates = {
  orderApproval: {
    subject: '[APPROVAL] Order {orderId} - {description}',
    body: 'Dear Approver,\n\nA new order requires your approval.\n\nOrder ID: {orderId}\nDescription: {description}\nQuantity: {quantity}\nRequested By: {requestedBy}\nDate: {date}\n\nOrder Details:\n{orderDetails}\n\nPlease reply with one of the following to approve or reject this order:\n- Reply "approve" or "yes" to APPROVE this order\n- Reply "reject" or "no" to REJECT this order\n\nYou may also include comments after your decision.\n\nThank you,\nMiltenyi Inventory Hub'
  },
  bulkApproval: {
    subject: '[APPROVAL] Bulk Order {batchId} - {month}',
    body: 'Dear Approver,\n\nA bulk order requires your approval.\n\nBatch ID: {batchId}\nMonth: {month}\nTotal Items: {totalItems}\nTotal Value: {totalValue}\nRequested By: {requestedBy}\nDate: {date}\n\nBulk Order Details:\n{bulkOrderDetails}\n\nPlease reply with one of the following to approve or reject this bulk order:\n- Reply "approve" or "yes" to APPROVE this bulk order\n- Reply "reject" or "no" to REJECT this bulk order\n\nYou may also include comments after your decision.\n\nThank you,\nMiltenyi Inventory Hub'
  },
  orderNotification: {
    subject: 'New Order: {orderId} - {description}',
    body: 'Dear Team,\n\nA new order has been created.\n\nOrder ID: {orderId}\nDescription: {description}\nQuantity: {quantity}\nRequested By: {requestedBy}\nDate: {date}\nStatus: {status}\n\nOrder Details:\n{orderDetails}\n\nPlease log in to the Miltenyi Inventory Hub for more details.\n\nThank you,\nMiltenyi Inventory Hub'
  },
  backOrderAlert: {
    subject: 'Back Order Alert: {description}',
    body: 'Dear Team,\n\nThe following item is on back order and requires attention.\n\nItem: {description}\nCatalog Number: {catalogNumber}\nQuantity on Back Order: {quantity}\nExpected Arrival: {expectedArrival}\nSupplier: {supplier}\n\nPlease take the necessary action to follow up on this back order.\n\nThank you,\nMiltenyi Inventory Hub'
  },
  partArrivalDone: {
    subject: 'Part Arrival Verified - {month}',
    body: 'Dear Team,\n\nPart arrival has been verified for the following batch.\n\nMonth: {month}\nTotal Items: {totalItems}\nFully Received: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\nDate: {date}\n\nItems Summary:\n{itemsList}\n\nPlease log in to the Miltenyi Inventory Hub for full details.\n\nThank you,\nMiltenyi Inventory Hub'
  },
  monthlySummary: {
    subject: 'Monthly Summary - {month}',
    body: 'Dear Team,\n\nHere is the monthly inventory summary for {month}.\n\nTotal Orders: {totalOrders}\nPending Orders: {pendingOrders}\nCompleted Orders: {completedOrders}\nBack Orders: {backOrders}\nTotal Value: {totalValue}\n\nTop Items Ordered:\n{topItems}\n\nPlease review the summary and take any necessary actions.\n\nThank you,\nMiltenyi Inventory Hub'
  }
};
