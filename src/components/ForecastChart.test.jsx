import { describe, it, expect, vi } from 'vitest';

// The chart components are heavy visx/motion TSX; only the data adapter is ours.
vi.mock('../charts/line-chart', () => ({ LineChart: () => null }));
vi.mock('../charts/line', () => ({ Line: () => null }));
vi.mock('../charts/grid', () => ({ Grid: () => null }));
vi.mock('../charts/x-axis', () => ({ XAxis: () => null }));
vi.mock('../charts/tooltip', () => ({ ChartTooltip: () => null }));

const { monthLabelToDate, toSeries } = await import('./ForecastChart.jsx');

describe('monthLabelToDate', () => {
  it('parses the four-digit form used by _sortKey', () => {
    const d = monthLabelToDate('Mar 2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
  });

  it('parses the abbreviated form used by display names and forecast rows', () => {
    // This is the one that was silently dropping every row: parseInt("'26") is NaN.
    const d = monthLabelToDate("Mar '26");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
  });

  it('treats a two-digit year as this century', () => {
    expect(monthLabelToDate("Jan '05").getFullYear()).toBe(2005);
  });

  it('is case insensitive and tolerates extra spacing', () => {
    expect(monthLabelToDate('  SEP   2026  ').getMonth()).toBe(8);
  });

  it('handles every month name', () => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    names.forEach((n, i) => expect(monthLabelToDate(`${n} 2026`).getMonth()).toBe(i));
  });

  it('returns null for junk rather than plotting at the epoch', () => {
    for (const bad of ['', null, undefined, 'nonsense', 'Mar', 'Zzz 2026', 'Mar 20x6', '2026']) {
      expect(monthLabelToDate(bad)).toBe(null);
    }
  });
});

describe('toSeries', () => {
  it('prefers the unambiguous _sortKey but falls back to name', () => {
    const rows = [
      { name: "Mar '26", _sortKey: 'Mar 2026', qty: 12 },
      { name: "Oct '26", qty: 23, forecast: true },
    ];
    const out = toSeries(rows);
    expect(out).toHaveLength(2);
    expect(out[0].date.getFullYear()).toBe(2026);
    expect(out[1].date.getMonth()).toBe(9);
    expect(out[1].forecast).toBe(true);
  });

  it('coerces quantities and defaults the forecast flag', () => {
    const [row] = toSeries([{ _sortKey: 'Mar 2026', qty: '15' }]);
    expect(row.qty).toBe(15);
    expect(row.forecast).toBe(false);
  });

  it('drops unparseable rows instead of failing the whole series', () => {
    const out = toSeries([
      { name: 'rubbish', qty: 1 },
      { _sortKey: 'Apr 2026', qty: 2 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].qty).toBe(2);
  });

  it('tolerates no rows at all', () => {
    expect(toSeries([])).toEqual([]);
    expect(toSeries(null)).toEqual([]);
  });
});
