import { describe, it, expect } from 'vitest';
import { toNumber, toNumberOrNull } from './sheet.js';

describe('toNumberOrNull — physical counts', () => {
  it('keeps "not counted" markers distinct from a counted zero', () => {
    // toNumber returns 0 for these, which read as "counted nothing" and zeroed
    // the item's stock on reconciliation.
    for (const marker of ['-', 'n/a', 'N.A.', 'N/A', 'TBC', '']) {
      expect(toNumber(marker)).toBe(0);
      expect(toNumberOrNull(marker)).toBe(null);
    }
  });

  it('still reads a genuine zero as zero', () => {
    expect(toNumberOrNull('0')).toBe(0);
    expect(toNumberOrNull(0)).toBe(0);
  });

  it('parses ordinary numbers, thousands separators and padding', () => {
    expect(toNumberOrNull('5')).toBe(5);
    expect(toNumberOrNull(' 7 ')).toBe(7);
    expect(toNumberOrNull('1,200')).toBe(1200);
    expect(toNumberOrNull(12)).toBe(12);
  });

  it('keeps accounting negatives', () => {
    expect(toNumberOrNull('(5)')).toBe(-5);
    expect(toNumberOrNull('-5')).toBe(-5);
  });

  it('rejects non-finite input', () => {
    expect(toNumberOrNull(NaN)).toBe(null);
    expect(toNumberOrNull(Infinity)).toBe(null);
    expect(toNumberOrNull(null)).toBe(null);
    expect(toNumberOrNull(undefined)).toBe(null);
  });
});
