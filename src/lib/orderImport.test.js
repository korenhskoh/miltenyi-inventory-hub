import { describe, it, expect } from 'vitest';
import {
  detectOrderColumns,
  isOrderSheet,
  monthFromSheetName,
  firstOfMonth,
  rowToOrder,
  parseOrderSheet,
} from './orderImport.js';

/**
 * These fixtures are the real shape of the service team's workbook: a two-line
 * title block above the headers, headers written with the punctuation people
 * actually type, Excel serial dates, and a tail of blank rows kept for next
 * month. Every one of those defeated the previous importer, which produced zero
 * orders from an 18-sheet file and said only "No valid orders found".
 */
const TITLE_BLOCK = [
  ['2026 Service Spare Part Transfer Price', '', '', 'Date:', 46288, '', '', '', '', '*Copy and paste the table below'],
  ['', '*Keep record here without delete them', '', 'Week:', 39, '', '', '', '', '*Remember to check'],
];
const HEADERS = [
  'Material No.',
  'Material Description',
  'Quantity',
  'List Price',
  'Total Cost Price',
  'Order Date',
  'Order By',
  'Status Remark',
  'Pending Check',
  'Date Of Spare Part Arrival ',
  'Quantity Received',
  'Quantity Back Order',
  'Check by Engineer',
];
const BLANK_ROW = ['', ' ', '', ' ', ' ', '', '', '', '', '', '', '', ''];

const sheet = (...dataRows) => [...TITLE_BLOCK, HEADERS, ...dataRows, BLANK_ROW, BLANK_ROW];

describe('column detection', () => {
  it('matches headers written the way people actually type them', () => {
    const cols = detectOrderColumns(HEADERS);
    expect(cols.materialNo).toBe(0); // "Material No." — the full stop broke exact matching
    expect(cols.description).toBe(1); // "Material Description"
    expect(cols.quantity).toBe(2);
    expect(cols.listPrice).toBe(3);
    expect(cols.totalCost).toBe(4); // "Total Cost Price"
    expect(cols.orderDate).toBe(5);
    expect(cols.orderBy).toBe(6);
    expect(cols.arrivalDate).toBe(9); // trailing space
    expect(cols.qtyReceived).toBe(10); // "Quantity Received"
    expect(cols.backOrder).toBe(11);
    expect(cols.engineer).toBe(12); // "Check by Engineer"
  });

  it('maps "Status Remark" to the remark field, not to status', () => {
    // It holds free text like "processed" or "LIFE21" — none of which are
    // statuses the app understands.
    const cols = detectOrderColumns(HEADERS);
    expect(cols.remark).toBe(7);
    expect(cols.status).toBeUndefined();
  });

  it('keeps the leftmost column when a label repeats', () => {
    const cols = detectOrderColumns(['Remark', 'Quantity', 'Remark']);
    expect(cols.remark).toBe(0);
  });

  it('still matches the plain spellings', () => {
    const cols = detectOrderColumns(['material_no', 'DESC', 'qty', 'unit price']);
    expect(cols).toMatchObject({ materialNo: 0, description: 1, quantity: 2, listPrice: 3 });
  });
});

describe('sheet classification', () => {
  it('reads a sheet that records orders', () => {
    expect(isOrderSheet(detectOrderColumns(HEADERS))).toBe(true);
  });

  it('skips a price list', () => {
    // The same workbook carries "Distributor" and "Singapore" pricing tabs.
    // Importing those as orders would invent purchases that never happened.
    const priceList = ['Material No.', 'Material Description', 'Quantity', 'List Price', 'Total Cost Price'];
    expect(isOrderSheet(detectOrderColumns(priceList))).toBe(false);
  });

  it('skips a sheet with nothing recognisable', () => {
    expect(isOrderSheet(detectOrderColumns(['Notes', 'Colour']))).toBe(false);
  });
});

describe('sheet names', () => {
  it.each([
    ['Jan_2026', 'Jan 2026'],
    ['2_Feb_2026', 'Feb 2026'],
    ['13_Apr_2026', 'Apr 2026'],
    ['June 2026', 'Jun 2026'],
    ['2_July 2025', 'Jul 2025'],
  ])('reads %s as %s', (name, expected) => {
    // The leading number is a batch counter, not part of the date.
    expect(monthFromSheetName(name)).toBe(expected);
  });

  it('returns nothing for a name that is not a month', () => {
    expect(monthFromSheetName('Distributor')).toBeNull();
    expect(monthFromSheetName('Sheet1')).toBeNull();
  });

  it('turns a month label into a first-of-month date', () => {
    expect(firstOfMonth('Feb 2026')).toBe('2026-02-01');
    expect(firstOfMonth('nonsense')).toBe('');
  });
});

describe('row parsing', () => {
  const cols = detectOrderColumns(HEADERS);
  const ctx = { sheetMonth: 'Feb 2026', defaultOrderBy: 'Importer', makeId: () => 'ORD-1' };

  it('reads a fully received line', () => {
    const row = [
      '130-127-575',
      'MACSima Stain Support Kit',
      4,
      180.38,
      721.52,
      46288,
      'Fu Siong',
      'processed',
      '',
      46290,
      4,
      0,
      'Wee Boon',
    ];
    const o = rowToOrder(row, cols, ctx);
    expect(o).toMatchObject({
      materialNo: '130-127-575',
      quantity: 4,
      listPrice: 180.38,
      totalCost: 721.52,
      qtyReceived: 4,
      backOrder: 0,
      orderBy: 'Fu Siong',
      remark: 'processed',
      engineer: 'Wee Boon',
      status: 'Received',
      month: 'Feb 2026',
    });
    // Excel serials, not strings — the old importer passed them through raw.
    expect(o.orderDate).toBe('2026-09-23');
    expect(o.arrivalDate).toBe('2026-09-25');
  });

  it('records a short delivery as a negative back order', () => {
    const row = ['130-115-120', 'Bio tubing', 5, 28.564, 142.82, 46288, 'Fu Siong', '', '', 46290, 3, -2, ''];
    expect(rowToOrder(row, cols, ctx)).toMatchObject({ qtyReceived: 3, backOrder: -2, status: 'Pending Approval' });
  });

  it('marks received history as approved so it does not flood the queue', () => {
    const row = ['130-127-575', 'Kit', 2, 100, 200, 46288, 'Fu Siong', '', '', '', 2, 0, ''];
    expect(rowToOrder(row, cols, ctx).approvalStatus).toBe('approved');
    const pending = ['130-127-575', 'Kit', 2, 100, 200, 46288, 'Fu Siong', '', '', '', 0, -2, ''];
    expect(rowToOrder(pending, cols, ctx).approvalStatus).toBe('pending');
  });

  it('dates an undated historical row to its own month, not to today', () => {
    const row = ['130-129-937', 'Ferrule', 10, 24.346, 243.46, '', '', '', '', '', '', -10, ''];
    expect(rowToOrder(row, cols, ctx).orderDate).toBe('2026-02-01');
  });

  it('recovers a quantity from an unlabelled column via the money columns', () => {
    // One tab's quantity header is blank, so it cannot be matched by name.
    const headers = [...HEADERS];
    headers[2] = '';
    const c = detectOrderColumns(headers);
    expect(c.quantity).toBeUndefined();
    const row = ['130-115-120', 'Bio tubing', 5, 28.564, 142.82, 46288, 'Fu Siong', '', '', '', 5, 0, ''];
    expect(rowToOrder(row, c, ctx).quantity).toBe(5);
  });

  it('falls back to the column left of the price when there are no money figures', () => {
    // Same headerless-quantity sheet, but this line has no price at all, so the
    // exact derivation above cannot run.
    const headers = [...HEADERS];
    headers[2] = '';
    const c = detectOrderColumns(headers);
    const row = ['', 'BD trucount', 1, '', '', '', '', '', '', 46290, '', -1, 'Fu Siong'];
    expect(rowToOrder(row, c, ctx).quantity).toBe(1);
  });

  it('ignores a row that names no part', () => {
    expect(rowToOrder(BLANK_ROW, cols, ctx)).toBeNull();
    expect(rowToOrder([], cols, ctx)).toBeNull();
  });

  it('keeps a line that has a description but no material number', () => {
    const row = ['', 'BD trucount', 1, '', '', '', '', '', '', 46290, '', -1, 'Fu Siong'];
    const o = rowToOrder(row, cols, ctx);
    expect(o.description).toBe('BD trucount');
    expect(o.backOrder).toBe(-1);
  });
});

describe('whole-sheet parsing', () => {
  it('finds the header under the title block', () => {
    const aoa = sheet(['130-127-414', 'IQ/OQ Fixed WBC', 2, 80, 160, 46024, 'Fu Siong', 'processed', '', '', 2, 0, '']);
    const res = parseOrderSheet(aoa, { sheetMonth: 'Jan 2026', makeId: () => 'ORD-1' });
    expect(res.headerRowIndex).toBe(2);
    expect(res.skipped).toBeNull();
    expect(res.orders).toHaveLength(1);
  });

  it('drops the blank rows kept for next month', () => {
    const aoa = sheet(
      ['130-127-414', 'A', 1, 10, 10, 46024, 'X', '', '', '', 1, 0, ''],
      ['130-127-427', 'B', 1, 10, 10, 46024, 'X', '', '', '', 1, 0, ''],
    );
    expect(parseOrderSheet(aoa, { makeId: () => 'ORD-1' }).orders).toHaveLength(2);
  });

  it('reports a price-list tab as skipped rather than importing it', () => {
    const aoa = [
      ['2025 Spare Part SG Price', '', '', 'Date:', 46288],
      ['', '', '', 'Week:', 39],
      ['Material No.', 'Material Description', 'Quantity', 'List Price', 'Total Cost Price'],
      ['200-075-725', 'USB Plug', 2, 360, 720],
    ];
    const res = parseOrderSheet(aoa, {});
    expect(res.orders).toHaveLength(0);
    expect(res.skipped).toMatch(/price list/i);
  });

  it('says so when it cannot place any column', () => {
    const res = parseOrderSheet(
      [
        ['Colour', 'Mood'],
        ['red', 'calm'],
      ],
      {},
    );
    expect(res.skipped).toMatch(/no recognisable columns/i);
  });

  it('handles an empty sheet', () => {
    expect(parseOrderSheet([], {})).toMatchObject({ orders: [], skipped: 'empty' });
  });
});
