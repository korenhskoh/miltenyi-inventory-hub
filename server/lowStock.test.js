import { describe, it, expect, vi, beforeEach } from 'vitest';

const chargeOutRows = {};
const leadRows = {};
vi.mock('./db.js', () => ({
  query: vi.fn(async (sql, params) => {
    const material = params?.[0];
    if (/inventory_transactions/.test(sql)) return { rows: chargeOutRows[material] || [] };
    if (/FROM orders/.test(sql)) return { rows: [{ avg_days: leadRows[material] ?? null }] };
    return { rows: [] };
  }),
}));
vi.mock('./notify.js', () => ({ notifyEvent: vi.fn(async () => ({ sent: 1 })) }));

const { reorderPointFor, checkLowStock } = await import('./lowStock.js');

/** Six months of steady demand — enough evidence to act on. */
const steady = (qty) =>
  ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month) => ({ month, qty }));

beforeEach(() => {
  for (const k of Object.keys(chargeOutRows)) delete chargeOutRows[k];
  for (const k of Object.keys(leadRows)) delete leadRows[k];
});

describe('reorderPointFor', () => {
  it("derives a threshold from the part's own demand and lead time", async () => {
    chargeOutRows.STEADY = steady(4);
    leadRows.STEADY = 33; // about 1.1 months
    const p = await reorderPointFor('STEADY');
    expect(p.perMonth).toBeCloseTo(4, 0);
    expect(p.leadTimeDays).toBe(33);
    // At least a month's demand, or ordering on the line still runs out.
    expect(p.reorderPoint).toBeGreaterThanOrEqual(4);
  });

  it('gives a longer lead time a higher threshold', async () => {
    chargeOutRows.A = steady(4);
    chargeOutRows.B = steady(4);
    leadRows.A = 7;
    leadRows.B = 90;
    const quick = await reorderPointFor('A');
    const slow = await reorderPointFor('B');
    expect(slow.reorderPoint).toBeGreaterThan(quick.reorderPoint);
  });

  it('returns nothing for a part never consumed', async () => {
    expect(await reorderPointFor('NEVER')).toBeNull();
  });

  it('leaves the threshold unset when no arrival was ever recorded', async () => {
    chargeOutRows.NOLEAD = steady(4);
    expect((await reorderPointFor('NOLEAD')).reorderPoint).toBeNull();
  });
});

describe('checkLowStock', () => {
  it('alerts when stock has fallen to the reorder point', async () => {
    chargeOutRows.LOW = steady(4);
    leadRows.LOW = 33;
    const notify = vi.fn(async () => ({ sent: 2 }));
    const [r] = await checkLowStock([{ materialNo: 'LOW', quantity: 1, description: 'Tubing' }], { notify });
    expect(r.alerted).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    const [rule, data, opts] = notify.mock.calls[0];
    expect(rule).toBe('lowStockAlert');
    expect(data.materialNo).toBe('LOW');
    expect(data.quantity).toBe(1);
    expect(opts.audienceRole).toBe('admin');
  });

  it('stays quiet when there is plenty', async () => {
    chargeOutRows.FINE = steady(4);
    leadRows.FINE = 33;
    const notify = vi.fn();
    const [r] = await checkLowStock([{ materialNo: 'FINE', quantity: 500 }], { notify });
    expect(r.ok).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet rather than guessing from thin history', async () => {
    // One month of demand is not evidence. An alert people learn to ignore is
    // worse than no alert.
    chargeOutRows.THIN = [{ month: '2026-09', qty: 4 }];
    leadRows.THIN = 33;
    const notify = vi.fn();
    const [r] = await checkLowStock([{ materialNo: 'THIN', quantity: 0 }], { notify });
    expect(r.skipped).toBe('not-enough-history');
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet when no lead time was ever measured', async () => {
    chargeOutRows.NOLEAD = steady(4);
    const notify = vi.fn();
    const [r] = await checkLowStock([{ materialNo: 'NOLEAD', quantity: 0 }], { notify });
    expect(r.skipped).toBe('not-enough-history');
    expect(notify).not.toHaveBeenCalled();
  });

  it('checks every line of a bulk charge-out', async () => {
    chargeOutRows.A = steady(4);
    chargeOutRows.B = steady(4);
    leadRows.A = 33;
    leadRows.B = 33;
    const notify = vi.fn(async () => ({ sent: 1 }));
    const out = await checkLowStock(
      [
        { materialNo: 'A', quantity: 0 },
        { materialNo: 'B', quantity: 999 },
      ],
      { notify },
    );
    expect(out.map((r) => r.materialNo)).toEqual(['A', 'B']);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('never lets a failed alert escape to the charge-out that triggered it', async () => {
    chargeOutRows.BOOM = steady(4);
    leadRows.BOOM = 33;
    const notify = vi.fn(async () => {
      throw new Error('whatsapp down');
    });
    const [r] = await checkLowStock([{ materialNo: 'BOOM', quantity: 0 }], { notify });
    expect(r.error).toBe('whatsapp down');
  });

  it('ignores rows with no material', async () => {
    expect(await checkLowStock([{ quantity: 0 }])).toEqual([]);
    expect(await checkLowStock(null)).toEqual([]);
  });
});
