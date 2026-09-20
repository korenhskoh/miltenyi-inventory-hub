import { describe, it, expect } from 'vitest';
import { normalizeHeader, detectHeaderRow, parseSheet, autoDetectColumns, toNumber, isBlank } from './sheet.js';

describe('normalizeHeader', () => {
  it('strips trailing punctuation and collapses separators', () => {
    expect(normalizeHeader('Material No.')).toBe('material no');
    expect(normalizeHeader('  Charge_Out  ')).toBe('charge out');
    expect(normalizeHeader('Lot-No:')).toBe('lot no');
  });
});

describe('detectHeaderRow', () => {
  it('finds headers under a title block', () => {
    const aoa = [
      ['2026 Service Spare Part Stock Check', '', '', 'Date:', '2026-02-05'],
      ['', 'Keep record here', '', 'Week:', 6],
      ['Material No.', 'Description', 'Charge In', 'Charge Out', 'Balance'],
      ['130-093-607', 'Calib beads', 5, 3, 12],
    ];
    expect(detectHeaderRow(aoa)).toBe(2);
  });
  it('handles headers already on row 1', () => {
    expect(detectHeaderRow([['Material No', 'Qty'], ['130-1', 2]])).toBe(0);
  });
});

describe('parseSheet + autoDetectColumns', () => {
  const aoa = [
    ['2026 Stock Check', '', '', 'Date:', '2026-02-05'],
    ['', '', '', 'Week:', 6],
    ['Material No.', 'Material Description', 'Lot No.', 'Charge In', 'Charge Out', 'Closing Balance'],
    ['130-093-607', 'Calib beads', 'L1', 5, 3, 12],
    ['', '', '', '', '', ''],
    ['130-118-210', 'Pump head', '', 0, 2, 2],
  ];
  it('reads rows beneath the detected header row and drops blanks', () => {
    const { headers, rows, headerRowIndex } = parseSheet(aoa);
    expect(headerRowIndex).toBe(2);
    expect(headers[0]).toBe('Material No.');
    expect(rows).toHaveLength(2);
    expect(rows[0]['Charge In']).toBe(5);
  });
  it('maps charge in / out / counted columns', () => {
    const { headers } = parseSheet(aoa);
    const map = autoDetectColumns(headers, ['materialNo', 'lotsNumber', 'chargeIn', 'chargeOut', 'countedQty']);
    expect(map.materialNo).toBe('Material No.');
    expect(map.lotsNumber).toBe('Lot No.');
    expect(map.chargeIn).toBe('Charge In');
    expect(map.chargeOut).toBe('Charge Out');
    expect(map.countedQty).toBe('Closing Balance');
  });
  it('does not map one column to two fields', () => {
    const map = autoDetectColumns(['Material No.', 'Qty'], ['materialNo', 'quantity', 'countedQty']);
    expect(map.quantity).toBe('Qty');
    expect(map.countedQty).toBeUndefined();
  });
  it('falls back to a contains match', () => {
    const map = autoDetectColumns(['Part No', 'Charge Out Qty'], ['materialNo', 'chargeOut']);
    expect(map.materialNo).toBe('Part No');
    expect(map.chargeOut).toBe('Charge Out Qty');
  });
});

describe('toNumber / isBlank', () => {
  it('parses spreadsheet numbers', () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber('1,200')).toBe(1200);
    expect(toNumber('(3)')).toBe(-3);
    expect(toNumber('')).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('-2')).toBe(-2);
  });
  it('distinguishes blank from zero', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(0)).toBe(false);
  });
});
