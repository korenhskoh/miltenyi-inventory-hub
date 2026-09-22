import { describe, it, expect, vi, beforeEach } from 'vitest';

// The budget reads the database; the arithmetic it applies to what comes back
// is what these tests are about, so the query is stubbed.
//
// Note the braces on the helpers below: an arrow that RETURNS the mock makes
// vitest call what came back, which fires the mock again and leaves a rejected
// promise nobody awaited — reported as a failure in whichever test ran last.
const queryMock = vi.fn();
vi.mock('../db.js', () => ({
  query: (...args) => queryMock(...args),
  withTransaction: vi.fn(),
  default: {},
}));

const { resolveLimits, checkBudget, DEFAULT_LIMITS } = await import('./usage.js');

const spend = (over) => {
  queryMock.mockResolvedValue({
    rows: [{ day_cost: 0, month_cost: 0, user_day_cost: 0, user_hour_calls: 0, day_calls: 0, ...over }],
  });
};

beforeEach(() => {
  queryMock.mockReset();
});

describe('limit resolution', () => {
  it('falls back to the defaults when nothing is configured', () => {
    expect(resolveLimits({})).toEqual({
      dailyCostUsd: DEFAULT_LIMITS.dailyCostUsd,
      monthlyCostUsd: DEFAULT_LIMITS.monthlyCostUsd,
      perUserDailyCostUsd: DEFAULT_LIMITS.perUserDailyCostUsd,
      perUserHourlyCalls: DEFAULT_LIMITS.perUserHourlyCalls,
    });
  });

  it('treats null as unlimited, which has to be chosen deliberately', () => {
    expect(resolveLimits({ limits: { dailyCostUsd: null } }).dailyCostUsd).toBeNull();
  });

  it('keeps zero, because "no spending at all" is a real setting', () => {
    expect(resolveLimits({ limits: { dailyCostUsd: 0 } }).dailyCostUsd).toBe(0);
  });

  it('ignores junk and negatives rather than inheriting them as a cap', () => {
    expect(resolveLimits({ limits: { dailyCostUsd: 'lots' } }).dailyCostUsd).toBe(DEFAULT_LIMITS.dailyCostUsd);
    expect(resolveLimits({ limits: { monthlyCostUsd: -5 } }).monthlyCostUsd).toBe(DEFAULT_LIMITS.monthlyCostUsd);
  });
});

describe('budget enforcement', () => {
  it('allows a call when nothing has been spent', async () => {
    spend({});
    expect((await checkBudget({ userId: 'U1', config: {} })).ok).toBe(true);
  });

  it('refuses once the daily cap is reached', async () => {
    spend({ day_cost: 5 });
    const gate = await checkBudget({ userId: 'U1', config: { limits: { dailyCostUsd: 5 } } });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('daily_cost');
    // The message is shown to whoever asked, including over WhatsApp.
    expect(gate.message).toMatch(/resets at midnight/i);
  });

  it('reports the monthly cap ahead of the daily one', async () => {
    // Both are blown; saying "try tomorrow" when the month is gone is a lie.
    spend({ day_cost: 99, month_cost: 99 });
    const gate = await checkBudget({ userId: 'U1', config: {} });
    expect(gate.reason).toBe('monthly_cost');
  });

  it('applies the per-person allowance separately from the global one', async () => {
    spend({ user_day_cost: 1 });
    const gate = await checkBudget({ userId: 'U1', config: {} });
    expect(gate.reason).toBe('user_daily_cost');
  });

  it('rate-limits one person without stopping everyone else', async () => {
    spend({ user_hour_calls: 30 });
    expect((await checkBudget({ userId: 'U1', config: {} })).reason).toBe('user_rate');
    // Same spend, no identified user (an unlinked WhatsApp number): the
    // per-person limits cannot apply, only the global ones.
    expect((await checkBudget({ userId: null, config: {} })).ok).toBe(true);
  });

  it('honours an unlimited setting', async () => {
    spend({ day_cost: 1000, month_cost: 1000 });
    const gate = await checkBudget({
      userId: null,
      config: { limits: { dailyCostUsd: null, monthlyCostUsd: null } },
    });
    expect(gate.ok).toBe(true);
  });

  it('stops everything when the cap is zero', async () => {
    spend({});
    expect((await checkBudget({ userId: 'U1', config: { limits: { dailyCostUsd: 0 } } })).ok).toBe(false);
  });

  it('lets the call through when the bookkeeping query itself fails', async () => {
    // A database hiccup should not silence the assistant; the cap is about
    // spending, and one uncounted call is cheaper than an outage.
    queryMock.mockImplementation(async () => {
      throw new Error('connection lost');
    });
    const gate = await checkBudget({ userId: 'U1', config: {} });
    expect(gate.ok).toBe(true);
    expect(gate.degraded).toBe(true);
  });
});
