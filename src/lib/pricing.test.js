import { describe, it, expect } from 'vitest';
import { getCatalogPrice, getEffectiveUnitPrice, getEffectiveTotal } from './pricing.js';

const lookup = {
  '130-001': { sg: 120, tp: 90, dist: 80 },
  '130-002': { sg: 0, tp: 90, dist: 80 },
  '130-003': { sg: null, tp: undefined, dist: '55' },
};

describe('getCatalogPrice', () => {
  it('prefers sg, then tp, then dist', () => {
    expect(getCatalogPrice(lookup['130-001'])).toBe(120);
    expect(getCatalogPrice(lookup['130-002'])).toBe(90);
    expect(getCatalogPrice(lookup['130-003'])).toBe(55);
  });
  it('returns 0 for a missing row', () => {
    expect(getCatalogPrice(undefined)).toBe(0);
    expect(getCatalogPrice({})).toBe(0);
  });
});

describe('getEffectiveUnitPrice', () => {
  it('uses the stored listPrice when > 0', () => {
    expect(getEffectiveUnitPrice({ materialNo: '130-001', listPrice: 99 }, lookup)).toBe(99);
    expect(getEffectiveUnitPrice({ materialNo: '130-001', listPrice: '42.5' }, lookup)).toBe(42.5);
  });
  it('falls back to the catalog when listPrice is 0 / missing', () => {
    expect(getEffectiveUnitPrice({ materialNo: '130-001', listPrice: 0 }, lookup)).toBe(120);
    expect(getEffectiveUnitPrice({ materialNo: '130-002' }, lookup)).toBe(90);
  });
  it('returns 0 when neither is available', () => {
    expect(getEffectiveUnitPrice({ materialNo: 'nope' }, lookup)).toBe(0);
    expect(getEffectiveUnitPrice({ materialNo: 'nope' }, undefined)).toBe(0);
    expect(getEffectiveUnitPrice(null, lookup)).toBe(0);
  });
});

describe('getEffectiveTotal', () => {
  it('multiplies the effective unit price by quantity', () => {
    expect(getEffectiveTotal({ materialNo: '130-001', listPrice: 10, quantity: 3, totalCost: 999 }, lookup)).toBe(30);
    expect(getEffectiveTotal({ materialNo: '130-001', listPrice: 0, quantity: 2 }, lookup)).toBe(240);
  });
  it('falls back to the stored totalCost when no price is known', () => {
    expect(getEffectiveTotal({ materialNo: 'nope', quantity: 2, totalCost: 77 }, lookup)).toBe(77);
    expect(getEffectiveTotal({ materialNo: 'nope', quantity: 2 }, lookup)).toBe(0);
  });
});
