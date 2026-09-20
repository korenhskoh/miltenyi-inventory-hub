import { describe, it, expect } from 'vitest';
import { ymdInTz, todayInTz, daysFromNowInTz } from './appDates.js';

describe('ymdInTz', () => {
  it('returns the Singapore calendar day, not the UTC one', () => {
    // 18:30 UTC is already the next morning in Singapore (UTC+8). The server
    // used to slice the UTC ISO string and so ran a day behind every evening.
    const d = new Date('2026-09-20T18:30:00Z');
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-20');
    expect(ymdInTz(d, 'Asia/Singapore')).toBe('2026-09-21');
  });

  it('agrees with UTC during Singapore working hours', () => {
    const d = new Date('2026-09-20T05:00:00Z'); // 13:00 SGT
    expect(ymdInTz(d, 'Asia/Singapore')).toBe('2026-09-20');
  });

  it('handles the other direction for a western timezone', () => {
    const d = new Date('2026-09-20T02:00:00Z'); // still the 19th in New York
    expect(ymdInTz(d, 'America/New_York')).toBe('2026-09-19');
  });

  it('formats as a sortable YYYY-MM-DD string', () => {
    expect(ymdInTz(new Date('2026-01-05T12:00:00Z'), 'Asia/Singapore')).toBe('2026-01-05');
  });

  it('falls back rather than throwing on a bad timezone', () => {
    expect(() => ymdInTz(new Date(), 'Not/AZone')).not.toThrow();
    expect(ymdInTz(new Date(), 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('todayInTz / daysFromNowInTz', () => {
  it('produces well-formed dates', () => {
    expect(todayInTz()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysFromNowInTz(30)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('orders correctly across the 30-day window', () => {
    expect(daysFromNowInTz(30) > todayInTz()).toBe(true);
    expect(daysFromNowInTz(-30) < todayInTz()).toBe(true);
  });

  it('crosses month and year boundaries', () => {
    expect(ymdInTz(new Date('2026-12-31T20:00:00Z'), 'Asia/Singapore')).toBe('2027-01-01');
  });
});
