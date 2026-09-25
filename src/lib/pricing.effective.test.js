import { describe, it, expect } from 'vitest';
import { getEffectiveTotal, getEffectiveUnitPrice } from './pricing.js';

describe('getEffectiveTotal with an unreadable quantity', () => {
  const catalog = { '130-104-453': { sg: 250 } };

  it('keeps the stored total when the quantity is zero', () => {
    // An imported row from a tab with no quantity column: the sheet's Total
    // Cost Price survived, the quantity did not. Multiplying the catalog price
    // by zero wrote a S$5,000 line down to nothing on screen while the export,
    // which reads the raw field, still said S$5,000.
    const order = { materialNo: '130-104-453', quantity: 0, listPrice: 0, totalCost: 5000 };
    expect(getEffectiveUnitPrice(order, catalog)).toBe(250);
    expect(getEffectiveTotal(order, catalog)).toBe(5000);
  });

  it('keeps the stored total when the order has its own price but no quantity', () => {
    expect(getEffectiveTotal({ quantity: 0, listPrice: 180.38, totalCost: 721.52 }, {})).toBe(721.52);
  });

  it('still multiplies where there is a real quantity', () => {
    expect(getEffectiveTotal({ materialNo: '130-104-453', quantity: 4, totalCost: 1 }, catalog)).toBe(1000);
    expect(getEffectiveTotal({ quantity: 4, listPrice: 10, totalCost: 999 }, {})).toBe(40);
  });

  it('falls back to the stored total when there is no price at all', () => {
    expect(getEffectiveTotal({ quantity: 4, listPrice: 0, totalCost: 88 }, {})).toBe(88);
  });
});
