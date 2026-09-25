import { describe, it, expect, vi } from 'vitest';

vi.mock('./db.js', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn(), validate: vi.fn(() => true) } }));

const { shouldCatchUp, buildCronExpression } = await import('./scheduler.js');

describe('shouldCatchUp', () => {
  // The slot is resolved in the report's own timezone, so these cases have to
  // name one and use absolute instants — a bare '2026-09-20T10:00:00' means
  // whatever the machine running the tests happens to be set to, and the
  // deploy target runs UTC while the reports fire in Singapore.
  const base = { enabled: true, frequency: 'daily', time: '09:00', timezone: 'Asia/Singapore' };
  /** The instant at which Singapore's wall clock reads this date and time. */
  const sgt = (s) => new Date(`${s}+08:00`);

  it('is false when the scheduler is disabled', () => {
    expect(shouldCatchUp({ ...base, enabled: false }, sgt('2026-09-20T10:00:00'))).toBe(false);
  });

  it('catches up a daily run the server was down for', () => {
    // Slot was 09:00 today, it is now 10:00, last run was yesterday.
    const now = sgt('2026-09-20T10:00:00');
    expect(shouldCatchUp({ ...base, lastRun: sgt('2026-09-19T09:00:00').toISOString() }, now)).toBe(true);
  });

  it('does not re-send a run that already happened', () => {
    const now = sgt('2026-09-20T10:00:00');
    expect(shouldCatchUp({ ...base, lastRun: sgt('2026-09-20T09:00:05').toISOString() }, now)).toBe(false);
  });

  it('does not send a stale run from long ago', () => {
    // 09:00 slot, now 23:00 — well past the 6h grace window, nobody wants it.
    const now = sgt('2026-09-20T23:00:00');
    expect(shouldCatchUp({ ...base, lastRun: sgt('2026-09-01T09:00:00').toISOString() }, now)).toBe(false);
  });

  it('treats a never-run config as needing the current slot', () => {
    const now = sgt('2026-09-20T09:30:00');
    expect(shouldCatchUp({ ...base, lastRun: null }, now)).toBe(true);
  });

  it('walks back to the right weekday for a weekly report', () => {
    // 2026-09-20 is a Sunday; the Monday slot was 2026-09-14, six days ago.
    const now = sgt('2026-09-20T10:00:00');
    expect(shouldCatchUp({ ...base, frequency: 'weekly', dayOfWeek: 1, lastRun: null }, now)).toBe(false);
  });

  it('catches up a weekly report on its own day', () => {
    // 2026-09-21 is a Monday.
    const now = sgt('2026-09-21T10:00:00');
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

describe('shouldCatchUp resolves the slot in the report timezone, not the process timezone', () => {
  // The process runs UTC on the deploy target while cron fires in Asia/Singapore.
  // A weekly Monday 09:00 SGT report fires at 01:00 UTC on Monday.
  const weekly = { enabled: true, frequency: 'weekly', time: '09:00', dayOfWeek: 1, timezone: 'Asia/Singapore' };

  it('does not re-send after a redeploy later on the same day', () => {
    // The slot is 01:00 UTC. Reading it as 09:00 UTC instead made a redeploy in
    // this window look like a fresh, unserved slot, and every active user got a
    // second copy of the same report.
    const firedAt = new Date('2026-09-28T01:00:00Z'); // Mon 09:00 SGT
    const redeploy = new Date('2026-09-28T10:00:00Z'); // Mon 18:00 SGT, same day
    expect(shouldCatchUp({ ...weekly, lastRun: firedAt.toISOString() }, redeploy)).toBe(false);
  });

  it('still catches up a run that was genuinely missed', () => {
    const restart = new Date('2026-09-28T03:00:00Z'); // Mon 11:00 SGT, 2h after the slot
    expect(shouldCatchUp({ ...weekly, lastRun: '2026-09-21T01:00:00Z' }, restart)).toBe(true);
  });

  it('does not fire before the day’s slot has come round', () => {
    const early = new Date('2026-09-28T00:30:00Z'); // Mon 08:30 SGT, before 09:00
    // The newest slot on or before now is LAST Monday, far outside the grace window.
    expect(shouldCatchUp({ ...weekly, lastRun: '2026-09-21T01:00:00Z' }, early)).toBe(false);
  });

  it('handles a daily report across the UTC day boundary', () => {
    const daily = { enabled: true, frequency: 'daily', time: '09:00', timezone: 'Asia/Singapore' };
    // 16:30 UTC on the 27th is already the 28th in Singapore, whose 09:00 slot
    // has not come round yet; the previous slot (27th 09:00 SGT = 01:00Z) has
    // already been served.
    const daily27 = { ...daily, lastRun: '2026-09-27T01:00:00Z' };
    expect(shouldCatchUp(daily27, new Date('2026-09-27T16:30:00Z'))).toBe(false);
    // And once the 28th's slot arrives it is caught up on.
    expect(shouldCatchUp(daily27, new Date('2026-09-28T02:00:00Z'))).toBe(true);
  });
});
