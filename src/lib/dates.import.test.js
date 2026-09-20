import { describe, it, expect } from 'vitest';
import { normalizeDate } from './dates.js';

describe('normalizeDate — spreadsheet imports', () => {
  it('reads a day-first date as written, not as US month-first', () => {
    // 03/04/2025 on a Singapore sheet is 3 April. new Date() read it as 4 March,
    // silently shifting the contract a month earlier and marking it expired.
    expect(normalizeDate('03/04/2025')).toBe('2025-04-03');
  });

  it('no longer drops an unambiguous day-first date', () => {
    // new Date('15/03/2025') is Invalid Date -> the field was imported blank.
    expect(normalizeDate('15/03/2025')).toBe('2025-03-15');
  });

  it('still reads an unambiguous month-first date correctly', () => {
    expect(normalizeDate('12/31/2025')).toBe('2025-12-31');
  });

  it('accepts dash and dot separators', () => {
    expect(normalizeDate('03-04-2025')).toBe('2025-04-03');
    expect(normalizeDate('03.04.2025')).toBe('2025-04-03');
  });

  it('expands two-digit years', () => {
    expect(normalizeDate('1/2/25')).toBe('2025-02-01');
  });

  it('rejects an impossible date instead of rolling it over', () => {
    // new Date(2025, 1, 31) silently becomes 3 March.
    expect(normalizeDate('31/02/2025')).toBe('');
    expect(normalizeDate('2025-02-31')).toBe('');
    expect(normalizeDate('2026-13-01')).toBe('');
  });

  it('keeps a valid leap day', () => {
    expect(normalizeDate('2024-02-29')).toBe('2024-02-29');
    expect(normalizeDate('2025-02-29')).toBe('');
  });

  it('treats a stringified Excel serial as a serial, not a year', () => {
    // Sheets are read with raw:false, so serials arrive as text and
    // new Date('45000') was parsed as the year 45000.
    expect(normalizeDate('45000')).toBe(normalizeDate(45000));
    expect(normalizeDate('45000').startsWith('45000')).toBe(false);
  });

  it('passes ISO values straight through', () => {
    expect(normalizeDate('2025-04-03')).toBe('2025-04-03');
    expect(normalizeDate('2025-04-03T10:00:00Z')).toBe('2025-04-03');
  });

  it('returns empty for junk and blanks', () => {
    expect(normalizeDate('nonsense')).toBe('');
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate(null)).toBe('');
  });
});
