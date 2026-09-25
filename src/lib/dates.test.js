import { describe, it, expect } from 'vitest';
import { toLocalYmd, normalizeDate, daysFromNowLocal, todayLocal, compareMonths, monthSortKey } from './dates.js';

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

describe('month ordering', () => {
  it('sorts months chronologically, not alphabetically', () => {
    // A plain .sort() on these labels gave Apr 2025, Apr 2026, Aug 2025,
    // Aug 2026, Dec 2025, Feb 2026, Jan 2025 — which is what the All Orders
    // month dropdown showed after importing two years of workbooks.
    const labels = ['Dec 2025', 'Jan 2025', 'Apr 2026', 'Feb 2026', 'Aug 2025'];
    expect([...labels].sort(compareMonths)).toEqual(['Jan 2025', 'Aug 2025', 'Dec 2025', 'Feb 2026', 'Apr 2026']);
  });

  it('puts a label that is not a month last rather than scattering it', () => {
    const sorted = ['Week 12', 'Mar 2026', 'Jan 2026'].sort(compareMonths);
    expect(sorted).toEqual(['Jan 2026', 'Mar 2026', 'Week 12']);
  });

  it('reads a full month name too', () => {
    expect(monthSortKey('January 2026')).toBe(monthSortKey('Jan 2026'));
  });
});
