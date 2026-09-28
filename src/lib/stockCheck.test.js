import { describe, it, expect } from 'vitest';
import { buildCountSheet, missingFromCount, variance, discrepancySummary } from './stockCheck.js';

/**
 * The workflow: someone counts the store room and records it in a spreadsheet.
 * That file is uploaded. Its quantity column is the PHYSICAL count; the figure
 * it is measured against comes from Local Inventory.
 */
const counted = [
  { materialNo: '130-129-937', description: 'Ferrule', countedQty: 10 },
  { materialNo: '130-127-414', description: 'IQ/OQ Fixed WBC', countedQty: 6 },
  { materialNo: '130-133-929', description: 'Drawer button', countedQty: 3 },
];
const system = [
  { materialNo: '130-129-937', quantity: 10 },
  { materialNo: '130-127-414', quantity: 6 },
  { materialNo: '130-133-929', quantity: 9 },
];

describe('the count sheet measures the upload against Local Inventory', () => {
  it('takes the physical count from the file and the system figure from inventory', () => {
    const sheet = buildCountSheet(counted, system);
    expect(sheet.map((s) => [s.materialNo, s.physicalQty, s.systemQty])).toEqual([
      ['130-129-937', 10, 10],
      ['130-127-414', 6, 6],
      ['130-133-929', 3, 9],
    ]);
  });

  it('reports a true variance, not the file against itself', () => {
    // The whole bug in one case: these three counts are exactly right against
    // Local Inventory for two of them. Reading the file's own column as the
    // system figure made every line look like a match, and reading it the other
    // way round invented discrepancies that were not there.
    const sheet = buildCountSheet(counted, system);
    expect(sheet.map(variance)).toEqual([0, 0, -6]);
    const s = discrepancySummary(sheet);
    expect(s.counted).toBe(3);
    expect(s.matched).toBe(2);
    expect(s.discrepancies).toBe(1);
    expect(s.short).toBe(1);
    expect(s.unitsShort).toBe(6);
    expect(s.discrepancyRate).toBeCloseTo(1 / 3);
    expect(s.accuracyRate).toBeCloseTo(2 / 3);
  });

  it('sums a part held under several lot numbers', () => {
    const sheet = buildCountSheet(
      [{ materialNo: 'A-1', countedQty: 7 }],
      [
        { materialNo: 'A-1', quantity: 4 },
        { materialNo: 'A-1', quantity: 3 },
      ],
    );
    expect(sheet[0].systemQty).toBe(7);
    expect(variance(sheet[0])).toBe(0);
  });

  it('matches material numbers regardless of case and padding', () => {
    const sheet = buildCountSheet([{ materialNo: ' a-1 ', countedQty: 2 }], [{ materialNo: 'A-1', quantity: 2 }]);
    expect(sheet[0].systemQty).toBe(2);
    expect(variance(sheet[0])).toBe(0);
  });

  it('flags a counted part the system has never heard of', () => {
    const sheet = buildCountSheet([{ materialNo: 'NEW-1', countedQty: 2 }], system);
    expect(sheet[0].inSystem).toBe(false);
    expect(sheet[0].systemQty).toBe(0);
    expect(variance(sheet[0])).toBe(2);
    expect(discrepancySummary(sheet).notInSystem).toBe(1);
  });

  it('leaves a row with no count in the file uncounted, not zero', () => {
    const sheet = buildCountSheet([{ materialNo: '130-129-937', countedQty: '' }], system);
    expect(sheet[0].physicalQty).toBeNull();
    expect(sheet[0].checked).toBe(false);
    expect(variance(sheet[0])).toBeNull();
    // A half-done check reports on what was counted, not diluted by the rest.
    expect(discrepancySummary(sheet).counted).toBe(0);
    expect(discrepancySummary(sheet).discrepancyRate).toBe(0);
  });

  it('records a counted zero as a real count', () => {
    const sheet = buildCountSheet([{ materialNo: '130-133-929', countedQty: 0 }], system);
    expect(sheet[0].physicalQty).toBe(0);
    expect(sheet[0].checked).toBe(true);
    expect(variance(sheet[0])).toBe(-9); // the system thinks there are 9
  });

  it('names stock the system holds that nobody counted', () => {
    // Just as important as a wrong count: the system believes it has these and
    // no one looked.
    const missing = missingFromCount(counted, [...system, { materialNo: 'UNSEEN', description: 'Seal', quantity: 5 }]);
    expect(missing).toEqual([{ materialNo: 'UNSEEN', description: 'Seal', quantity: 5 }]);
  });

  it('does not report a zero-stock part as missed', () => {
    const missing = missingFromCount(counted, [...system, { materialNo: 'EMPTY', quantity: 0 }]);
    expect(missing).toEqual([]);
  });

  it('drops rows with no material number', () => {
    expect(buildCountSheet([{ materialNo: '  ', countedQty: 3 }], system)).toEqual([]);
  });
});
