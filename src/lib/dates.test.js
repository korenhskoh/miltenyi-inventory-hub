import { describe, it, expect } from 'vitest';
import { toLocalYmd, normalizeDate, daysFromNowLocal, todayLocal } from './dates.js';

describe('dates', () => {
  it('formats local calendar day (not UTC)', () => {
    const d = new Date(2026, 8, 17, 1, 30); // 01:30 local on 17 Sep
    expect(toLocalYmd(d)).toBe('2026-09-17');
  });
  it('normalises ISO timestamps and YMD strings by slicing', () => {
    expect(normalizeDate('2026-09-16T16:00:00.000Z')).toBe('2026-09-16');
    expect(normalizeDate('2026-09-17')).toBe('2026-09-17');
  });
  it('normalises Excel serials', () => {
    expect(normalizeDate(46000)).toBe('2025-12-09');
  });
  it('returns empty for junk', () => {
    expect(normalizeDate('not a date')).toBe('');
    expect(normalizeDate(null)).toBe('');
  });
  it('todayLocal / daysFromNowLocal are YYYY-MM-DD', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysFromNowLocal(1) > todayLocal()).toBe(true);
  });
});
