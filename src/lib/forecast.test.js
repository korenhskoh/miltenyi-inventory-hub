import { describe, it, expect } from 'vitest';
import {
  monthKey,
  addMonths,
  monthDisplay,
  buildSeries,
  classify,
  sbaRate,
  monthlyStdDev,
  forecast,
  annualPlan,
} from './forecast.js';

const months = (...pairs) => buildSeries(pairs.map(([month, qty]) => ({ month, qty })));

describe('month arithmetic', () => {
  it('reads a month from a date or an ISO string', () => {
    expect(monthKey('2026-03-15')).toBe('2026-03');
    expect(monthKey(new Date(2026, 2, 15))).toBe('2026-03');
    expect(monthKey('')).toBe('');
  });

  it('steps across a year boundary in both directions', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-02', -3)).toBe('2025-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it('displays a month the way the rest of the app does', () => {
    expect(monthDisplay('2026-03')).toBe("Mar '26");
  });
});

describe('building the series', () => {
  it('fills the empty months rather than dropping them', () => {
    // This is the whole point. The old forecast kept only months that had an
    // order, so it averaged the last three ordering EVENTS and read a
    // once-a-year purchase as a monthly habit.
    const s = months(['2026-01', 30], ['2026-08', 2]);
    expect(s).toHaveLength(8);
    expect(s.map((p) => p.qty)).toEqual([30, 0, 0, 0, 0, 0, 0, 2]);
  });

  it('adds up several movements in one month', () => {
    const s = buildSeries([
      { month: '2026-01-04', qty: 3 },
      { month: '2026-01-27', qty: 4 },
    ]);
    expect(s).toEqual([{ month: '2026-01', qty: 7 }]);
  });

  it('returns nothing for no input', () => {
    expect(buildSeries([])).toEqual([]);
    expect(buildSeries(null)).toEqual([]);
  });
});

describe('classifying demand', () => {
  it('calls a part that moves every month smooth', () => {
    expect(classify(months(['2026-01', 4], ['2026-02', 5], ['2026-03', 4], ['2026-04', 5])).shape).toBe('smooth');
  });

  it('calls a part that moves in lumps intermittent', () => {
    const c = classify(months(['2026-01', 10], ['2026-04', 10], ['2026-07', 10], ['2026-10', 10]));
    expect(c.shape).toBe('intermittent');
    expect(c.adi).toBeCloseTo(2.5, 1);
  });

  it('refuses to model a single observation', () => {
    expect(classify(months(['2026-01', 5], ['2026-06', 0])).shape).toBe('insufficient');
  });

  it('reports no demand at all', () => {
    expect(classify(months(['2026-01', 0], ['2026-02', 0])).shape).toBe('none');
  });
});

describe('the rate estimates land near the truth', () => {
  it('reads a lumpy part close to its real run rate', () => {
    // 32 units over 8 months is 4.0/month. The old weighted average returned 19
    // for the same data — nearly five times the truth — because it never saw
    // the empty months.
    const rate = sbaRate(months(['2026-01', 30], ['2026-08', 2]));
    expect(rate).toBeGreaterThan(2.5);
    expect(rate).toBeLessThan(5);
  });

  it('reads a regular intermittent part close to its real rate', () => {
    // 40 units over 12 months is 3.33/month.
    const rate = sbaRate(months(['2026-01', 10], ['2026-04', 10], ['2026-07', 10], ['2026-10', 10]));
    expect(rate).toBeGreaterThan(2.8);
    expect(rate).toBeLessThan(4);
  });

  it('returns zero when nothing was ever consumed', () => {
    expect(sbaRate(months(['2026-01', 0], ['2026-02', 0]))).toBe(0);
  });
});

describe('forecasting', () => {
  const steady = months(['2026-01', 4], ['2026-02', 4], ['2026-03', 4], ['2026-04', 4], ['2026-05', 4], ['2026-06', 4]);

  it('holds a steady part steady, however far out it is asked', () => {
    // The old forecast multiplied by a fleet factor INSIDE its loop, so this
    // same input returned 6, 8, 10, 13, 17, 22 on a 25-instrument fleet.
    for (const horizon of [3, 6, 12, 24]) {
      const f = forecast(steady, horizon);
      expect(f.points).toHaveLength(horizon);
      expect(f.points.every((p) => p.qty === 4)).toBe(true);
    }
  });

  it('follows a rising trend without running away over two years', () => {
    const rising = months(
      ['2026-01', 2],
      ['2026-02', 4],
      ['2026-03', 6],
      ['2026-04', 8],
      ['2026-05', 10],
      ['2026-06', 12],
    );
    const f = forecast(rising, 24);
    expect(f.method).toMatch(/trend detected/i);
    // Above the mean of the history, because demand is climbing…
    expect(f.points[0].qty).toBeGreaterThan(7);
    // …but damped, so two years out it converges rather than reaching the 60
    // an undamped straight line would give.
    expect(f.points[23].qty).toBeLessThan(25);
  });

  it('does not invent a trend out of noise', () => {
    // 1, 9, 2, 8, 3, 7 has a mean of 5 and no trend, but a trend model reads
    // the last upswing as a climb and predicts 15. The model is chosen by how
    // well each one would have predicted the history, so this picks the level.
    const noisy = months(
      ['2026-01', 1],
      ['2026-02', 9],
      ['2026-03', 2],
      ['2026-04', 8],
      ['2026-05', 3],
      ['2026-06', 7],
    );
    const f = forecast(noisy, 6);
    expect(f.method).toMatch(/no trend/i);
    expect(f.points[0].qty).toBeGreaterThan(3);
    expect(f.points[0].qty).toBeLessThan(8);
  });

  it('lets a falling part fall, without going negative', () => {
    const falling = months(
      ['2026-01', 12],
      ['2026-02', 10],
      ['2026-03', 8],
      ['2026-04', 6],
      ['2026-05', 4],
      ['2026-06', 2],
    );
    const f = forecast(falling, 24);
    expect(f.points[0].qty).toBeLessThan(6);
    expect(f.points.every((p) => p.qty >= 0)).toBe(true);
  });

  it('labels the months following the last real one', () => {
    const f = forecast(steady, 3);
    expect(f.points.map((p) => p.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(f.points[0].name).toBe("Jul '26");
  });

  it('widens the band further out and never goes below zero', () => {
    const noisy = months(
      ['2026-01', 1],
      ['2026-02', 9],
      ['2026-03', 2],
      ['2026-04', 8],
      ['2026-05', 3],
      ['2026-06', 7],
    );
    const f = forecast(noisy, 12);
    const first = f.points[0];
    const last = f.points[11];
    expect(last.hi - last.lo).toBeGreaterThan(first.hi - first.lo);
    expect(f.points.every((p) => p.lo >= 0)).toBe(true);
  });

  it('totals the horizon, which is what an annual plan needs', () => {
    const f = forecast(steady, 12);
    expect(f.total).toBeCloseTo(48, 0);
  });

  it('says which method it used rather than presenting one number for everything', () => {
    expect(forecast(steady, 6).method).toMatch(/smoothing|trend/i);
    expect(forecast(months(['2026-01', 10], ['2026-05', 10], ['2026-09', 10]), 6).method).toMatch(/croston/i);
    expect(forecast(months(['2026-01', 5], ['2026-06', 0]), 6).method).toMatch(/too few/i);
    expect(forecast(months(['2026-01', 0], ['2026-02', 0]), 6).method).toMatch(/no demand/i);
  });

  it('survives an empty series', () => {
    const f = forecast([], 6);
    expect(f.points).toHaveLength(6);
    expect(f.points.every((p) => p.qty === 0)).toBe(true);
  });
});

describe('annual planning', () => {
  const series = months(['2026-01', 4], ['2026-02', 4], ['2026-03', 4], ['2026-04', 4], ['2026-05', 4], ['2026-06', 4]);

  it('compares the next twelve months with the last twelve', () => {
    const plan = annualPlan(series, { stock: 20, leadTimeDays: 30 });
    expect(plan.next12).toBeCloseTo(48, 0);
    expect(plan.prior12).toBe(24); // only six months of history exist
  });

  it('works out how long the stock on hand lasts', () => {
    // The number that decides whether to order at all — and the old page could
    // not compute it, because it was never given the stock levels.
    expect(annualPlan(series, { stock: 20 }).monthsCover).toBeCloseTo(5, 1);
    expect(annualPlan(series, { stock: 0 }).monthsCover).toBe(0);
  });

  it("sets a reorder point from the part's own lead time", () => {
    const quick = annualPlan(series, { stock: 20, leadTimeDays: 7 });
    const slow = annualPlan(series, { stock: 20, leadTimeDays: 90 });
    expect(slow.reorderPoint).toBeGreaterThan(quick.reorderPoint);
  });

  it('flags a part that should be ordered now', () => {
    expect(annualPlan(series, { stock: 1, leadTimeDays: 33 }).needsOrder).toBe(true);
    expect(annualPlan(series, { stock: 500, leadTimeDays: 33 }).needsOrder).toBe(false);
  });

  it('leaves the reorder point unset when the lead time is unknown', () => {
    expect(annualPlan(series, { stock: 20 }).reorderPoint).toBeNull();
  });

  it('reports how much evidence it had', () => {
    const plan = annualPlan(months(['2026-01', 10], ['2026-06', 5]), { stock: 3 });
    expect(plan.observedMonths).toBe(6);
    expect(plan.demandMonths).toBe(2);
  });
});
