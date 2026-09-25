// Reading the historical order workbooks the service team actually keeps.
//
// The importer used to take row 1 as the header row and match column names by
// exact string. Both assumptions are wrong for these files, and together they
// meant a real workbook produced zero orders and the only feedback was "No
// valid orders found in Excel file":
//
//   1. Every sheet carries a two-line title block — "2026 Service Spare Part
//      Transfer Price", "Date:", "Week:" — so the header row is the THIRD.
//      Reading row 1 mapped nothing, except "Date:" which matched `date` and
//      was quietly used as the order date.
//   2. The headers are written the way people write them: "Material No." with
//      a full stop, "Material Description", "Total Cost Price", "Quantity Back
//      Order", "Date Of Spare Part Arrival " with a trailing space. An exact
//      lookup table matched none of them.
//
// Header detection and normalisation already existed in ./sheet.js for the
// stock-check uploads; this module applies the same approach to orders and adds
// the field set an order needs.
import { normalizeHeader, detectHeaderRow, toNumber } from './sheet.js';
import { normalizeDate, todayLocal } from './dates.js';

/**
 * Column synonyms in normalised form (lowercase, trailing punctuation removed,
 * separators collapsed to single spaces — see normalizeHeader).
 *
 * Order matters within a field: the first match wins, so the most specific
 * spelling is listed first.
 */
export const ORDER_COLUMN_SYNONYMS = {
  id: ['order id', 'orderid', 'id', 'order no', 'order number'],
  materialNo: [
    'material no',
    'material number',
    'materialno',
    'material',
    'mat no',
    'part no',
    'part number',
    'partno',
    'item no',
    'item code',
    'sap code',
    'article no',
  ],
  description: [
    'material description',
    'item description',
    'part description',
    'description',
    'desc',
    'item name',
    'product name',
    'product',
    'item',
    'name',
  ],
  quantity: ['quantity', 'qty', 'order qty', 'ordered qty', 'qty ordered', 'ordered'],
  listPrice: ['list price', 'unit price', 'transfer price', 'price', 'listprice', 'unit cost', 'tp'],
  totalCost: [
    'total cost price',
    'total cost',
    'total price',
    'totalcost',
    'extended price',
    'ext price',
    'total amount',
    'amount',
    'total',
  ],
  orderDate: ['order date', 'orderdate', 'date ordered', 'created date', 'created', 'date'],
  orderBy: ['order by', 'ordered by', 'orderby', 'requested by', 'requestor', 'requester', 'created by', 'user'],
  // "Status Remark" holds free text like "processed" or "LIFE21" — a note about
  // the order, not one of the app's statuses, so it maps to the remark field.
  remark: ['status remark', 'remark', 'remarks', 'note', 'notes', 'comment', 'comments'],
  arrivalDate: [
    'date of spare part arrival',
    'spare part arrival',
    'arrival date',
    'date of arrival',
    'received date',
    'delivery date',
    'arrivaldate',
    'arrival',
  ],
  qtyReceived: ['quantity received', 'qty received', 'received qty', 'qtyreceived', 'received'],
  backOrder: ['quantity back order', 'qty back order', 'back order', 'backorder', 'outstanding'],
  engineer: [
    'check by engineer',
    'checked by engineer',
    'checked by',
    'engineer',
    'technician',
    'assigned to',
    'assigned',
  ],
  status: ['status'],
  month: ['month', 'batch', 'month batch', 'period'],
  year: ['year'],
};

/**
 * Map header labels onto order fields.
 *
 * Every header is normalised first, so "Material No.", "MATERIAL NO" and
 * "material_no" all land on the same field. A field already matched is not
 * overwritten, which keeps the leftmost column when a sheet repeats a label —
 * these workbooks end with a second bare "Remark" column.
 */
export function detectOrderColumns(headers = []) {
  const normalised = headers.map(normalizeHeader);
  const colMap = {};
  for (const [field, synonyms] of Object.entries(ORDER_COLUMN_SYNONYMS)) {
    for (const synonym of synonyms) {
      const idx = normalised.indexOf(synonym);
      if (idx !== -1) {
        if (colMap[field] === undefined) colMap[field] = idx;
        break;
      }
    }
  }
  return colMap;
}

/**
 * Does this sheet hold ORDERS, or is it a price list?
 *
 * The same workbook carries "Distributor" and "Singapore" tabs, which are
 * catalogue pricing: material, description, quantity, price — and nothing about
 * ordering. Importing those as orders would invent a batch of purchases that
 * never happened, dated today. They belong in the Parts Catalog upload instead,
 * so they are skipped here and named in the result rather than dropped quietly.
 */
export function isOrderSheet(colMap) {
  if (colMap.materialNo === undefined && colMap.description === undefined) return false;
  return ['orderDate', 'orderBy', 'qtyReceived', 'arrivalDate', 'backOrder', 'status'].some(
    (f) => colMap[f] !== undefined,
  );
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2_Feb_2026" → "Feb 2026", "June 2026" → "Jun 2026", "13_Apr_2026" → "Apr 2026".
 *
 * Tabs are named per batch, so the leading number is a batch counter rather
 * than part of the date. Producing the app's own "Mon YYYY" shape means an
 * imported batch groups with everything else instead of sitting in a category
 * of its own.
 */
export function monthFromSheetName(sheetName) {
  const s = String(sheetName || '').toLowerCase();
  const monthIdx = MONTHS.findIndex((m) => new RegExp(`(^|[^a-z])${m}`, 'i').test(s));
  if (monthIdx === -1) return null;
  const year = s.match(/(20\d{2})/);
  if (!year) return null;
  return `${MONTH_LABELS[monthIdx]} ${year[1]}`;
}

/** The first of a "Mon YYYY" month, used when a historical row has no order date. */
export function firstOfMonth(label) {
  if (!label) return '';
  const m = String(label).match(/^([A-Za-z]{3})\s+(20\d{2})$/);
  if (!m) return '';
  const idx = MONTH_LABELS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
  if (idx === -1) return '';
  return `${m[2]}-${String(idx + 1).padStart(2, '0')}-01`;
}

/**
 * The four statuses the app actually understands.
 *
 * A sheet's own "Status" column used to be copied through verbatim, so a cell
 * reading "Processed", "Delivered" or plain lowercase "received" became the
 * order's status. Nothing downstream recognises those: the row matched none of
 * the status tabs, so choosing any status hid it; it was counted in none of the
 * five status tallies while still counting in the total, so the tiles stopped
 * summing; and because the check for "already received" is exact-case, a
 * "received" row kept approvalStatus 'pending', which left it unapprovable,
 * unreceivable and stuck.
 *
 * So the sheet's value is mapped onto the app's vocabulary, and anything that
 * cannot be mapped is ignored in favour of what the received quantities say —
 * which is the more reliable evidence anyway.
 */
const STATUS_SYNONYMS = {
  received: 'Received',
  complete: 'Received',
  completed: 'Received',
  delivered: 'Received',
  arrived: 'Received',
  closed: 'Received',
  approved: 'Approved',
  approve: 'Approved',
  rejected: 'Rejected',
  reject: 'Rejected',
  cancelled: 'Rejected',
  canceled: 'Rejected',
  pending: 'Pending Approval',
  'pending approval': 'Pending Approval',
  'awaiting approval': 'Pending Approval',
  open: 'Pending Approval',
};

export function normalizeStatus(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!key) return '';
  return STATUS_SYNONYMS[key] || '';
}

const cell = (row, idx) => (idx === undefined ? '' : (row?.[idx] ?? ''));
const text = (v) =>
  String(v ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');

/**
 * Turn one spreadsheet row into an order, or null if the row is not one.
 *
 * These sheets are printed forms: most of every tab is blank rows kept for next
 * month, some holding a single space rather than nothing. A row counts only if
 * it names a part or describes one.
 */
export function rowToOrder(row, colMap, ctx = {}) {
  const { sheetMonth = null, defaultOrderBy = '', makeId = () => `ORD-${Date.now()}`, bulkGroupId = null } = ctx;

  const materialNo = text(cell(row, colMap.materialNo));
  const description = text(cell(row, colMap.description));
  if (!materialNo && !description) return null;

  const quantityRaw = toNumber(cell(row, colMap.quantity));
  const listPrice = toNumber(cell(row, colMap.listPrice));
  const totalCostRaw = toNumber(cell(row, colMap.totalCost));

  // One tab's quantity column has no header at all, so it cannot be matched by
  // name. Two fallbacks, in order of how much they assume:
  //
  //   1. Where both money columns are filled the quantity is recoverable
  //      exactly, and an exact answer beats importing the row as zero.
  //   2. Otherwise, the unlabelled column immediately left of the price is the
  //      quantity in this layout — used only when it holds a plain number, so a
  //      stray note in that cell is ignored rather than imported as a count.
  let quantity = quantityRaw;
  if (!quantity && listPrice > 0 && totalCostRaw > 0) {
    const derived = Math.round(totalCostRaw / listPrice);
    if (derived > 0 && Math.abs(derived * listPrice - totalCostRaw) < 0.05) quantity = derived;
  }
  if (!quantity && colMap.quantity === undefined && colMap.listPrice > 0) {
    const neighbour = toNumber(cell(row, colMap.listPrice - 1));
    if (neighbour > 0 && Number.isInteger(neighbour)) quantity = neighbour;
  }

  const qtyReceived = toNumber(cell(row, colMap.qtyReceived));
  const arrivalDate = normalizeDate(cell(row, colMap.arrivalDate));
  const orderDate = normalizeDate(cell(row, colMap.orderDate)) || firstOfMonth(sheetMonth) || todayLocal();
  const totalCost = totalCostRaw || listPrice * quantity;

  // The sheet keeps its own back-order column, but it is derived from the other
  // two and agrees with them throughout these workbooks. Recomputing keeps one
  // source of truth and matches how the app writes the column everywhere else:
  // negative means short.
  const backOrder = qtyReceived - quantity;

  const fullyReceived = quantity > 0 && qtyReceived >= quantity;
  const status = normalizeStatus(text(cell(row, colMap.status))) || (fullyReceived ? 'Received' : 'Pending Approval');

  return {
    id: makeId(),
    materialNo,
    description: description || materialNo,
    quantity,
    listPrice,
    totalCost: Math.round(totalCost * 100) / 100,
    orderDate,
    orderBy: text(cell(row, colMap.orderBy)) || defaultOrderBy,
    remark: text(cell(row, colMap.remark)),
    arrivalDate,
    qtyReceived,
    backOrder,
    engineer: text(cell(row, colMap.engineer)),
    emailFull: '',
    emailBack: '',
    status,
    // History that already arrived is history: leaving it unapproved would put
    // years of completed orders into the approvals queue and mark them
    // receivable all over again.
    approvalStatus:
      status === 'Received' || status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : 'pending',
    month: text(cell(row, colMap.month)) || sheetMonth || '',
    year: text(cell(row, colMap.year)) || (orderDate ? orderDate.slice(0, 4) : String(new Date().getFullYear())),
    ...(bulkGroupId ? { bulkGroupId } : {}),
  };
}

/**
 * Parse one sheet given as an array of arrays.
 *
 * Returns the orders plus what was decided about the sheet, so the caller can
 * tell the user which tabs were read, which were skipped and why, instead of a
 * single count that hides the difference.
 */
export function parseOrderSheet(aoa, ctx = {}) {
  const rows = Array.isArray(aoa) ? aoa : [];
  if (rows.length === 0) return { orders: [], skipped: 'empty', headerRowIndex: 0, columns: {} };

  const headerRowIndex = detectHeaderRow(rows, 15);
  const headers = rows[headerRowIndex] || [];
  const columns = detectOrderColumns(headers);

  if (columns.materialNo === undefined && columns.description === undefined) {
    return { orders: [], skipped: 'no recognisable columns', headerRowIndex, columns };
  }
  if (!isOrderSheet(columns)) {
    return { orders: [], skipped: 'looks like a price list, not orders', headerRowIndex, columns };
  }

  const orders = [];
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const order = rowToOrder(rows[r], columns, ctx);
    if (order) orders.push(order);
  }
  return { orders, skipped: null, headerRowIndex, columns };
}

/**
 * Which order fields a set of headers resolved to, for showing the user what
 * the importer understood before they commit to it.
 */
export function describeMapping(headers, columns) {
  return Object.entries(columns)
    .map(([field, idx]) => ({ field, header: String(headers?.[idx] ?? '').trim() || `Column ${idx + 1}`, index: idx }))
    .sort((a, b) => a.index - b.index);
}
