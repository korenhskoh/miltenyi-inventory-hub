import { describe, it, expect, vi } from 'vitest';

vi.mock('./db.js', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn(), validate: vi.fn(() => true) } }));

const { shouldCatchUp, buildCronExpression } = await import('./scheduler.js');

describe('shouldCatchUp', () => {
  const base = { enabled: true, frequency: 'daily', time: '09:00' };

  it('is false when the scheduler is disabled', () => {
    expect(shouldCatchUp({ ...base, enabled: false }, new Date('2026-09-20T10:00:00'))).toBe(false);
  });

  it('catches up a daily run the server was down for', () => {
    // Slot was 09:00 today, it is now 10:00, last run was yesterday.
    const now = new Date('2026-09-20T10:00:00');
    expect(shouldCatchUp({ ...base, lastRun: '2026-09-19T09:00:00' }, now)).toBe(true);
  });

  it('does not re-send a run that already happened', () => {
    const now = new Date('2026-09-20T10:00:00');
    expect(shouldCatchUp({ ...base, lastRun: '2026-09-20T09:00:05' }, now)).toBe(false);
  });

  it('does not send a stale run from long ago', () => {
    // 09:00 slot, now 23:00 — well past the 6h grace window, nobody wants it.
    const now = new Date('2026-09-20T23:00:00');
    expect(shouldCatchUp({ ...base, lastRun: '2026-09-01T09:00:00' }, now)).toBe(false);
  });

  it('treats a never-run config as needing the current slot', () => {
    const now = new Date('2026-09-20T09:30:00');
    expect(shouldCatchUp({ ...base, lastRun: null }, now)).toBe(true);
  });

  it('walks back to the right weekday for a weekly report', () => {
    // 2026-09-20 is a Sunday; the Monday slot was 2026-09-14, six days ago.
    const now = new Date('2026-09-20T10:00:00');
    expect(shouldCatchUp({ ...base, frequency: 'weekly', dayOfWeek: 1, lastRun: null }, now)).toBe(false);
  });

  it('catches up a weekly report on its own day', () => {
    // 2026-09-21 is a Monday.
    const now = new Date('2026-09-21T10:00:00');
    expect(shouldCatchUp({ ...base, frequency: 'weekly', dayOfWeek: 1, lastRun: null }, now)).toBe(true);
  });
});

describe('buildCronExpression', () => {
  it('keeps midnight at midnight', () => {
    // `rawHour || 9` used to turn 00:30 into 09:30.
    expect(buildCronExpression({ frequency: 'daily', time: '00:30' })).toBe('30 0 * * *');
  });

  it('handles a normal morning time', () => {
    expect(buildCronExpression({ frequency: 'daily', time: '09:00' })).toBe('0 9 * * *');
  });

  it('falls back to 9am when the time is unparseable', () => {
    expect(buildCronExpression({ frequency: 'daily', time: 'not-a-time' })).toBe('0 9 * * *');
  });

  it('builds weekly and monthly expressions', () => {
    expect(buildCronExpression({ frequency: 'weekly', time: '08:15', dayOfWeek: 3 })).toBe('15 8 * * 3');
    expect(buildCronExpression({ frequency: 'monthly', time: '00:00', dayOfMonth: 1 })).toBe('0 0 1 * *');
  });

  it('clamps out-of-range values', () => {
    expect(buildCronExpression({ frequency: 'daily', time: '99:99' })).toBe('59 23 * * *');
  });
});
