import React, { useMemo } from 'react';
import { curveMonotoneX } from '@visx/curve';
import { LineChart } from '../charts/line-chart';
import { Line } from '../charts/line';
import { Grid } from '../charts/grid';
import { XAxis } from '../charts/x-axis';
import { ChartTooltip } from '../charts/tooltip';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Turn a month label into a real Date.
 *
 * The Bklit chart is a time-series chart: it scales the x-axis from Date
 * values, where the rest of this app carries month labels. Two shapes appear
 * on the forecasting page and BOTH must work — historical rows carry a
 * `_sortKey` like "Mar 2026", while their display `name`, and every forecast
 * row, uses the abbreviated "Mar '26". Reading only the four-digit form left
 * parseInt("'26") as NaN, every row was dropped, and the chart rendered
 * nothing at all — with no error, because an empty series is a legitimate state.
 *
 * Anything genuinely unparseable is dropped rather than plotted at the epoch,
 * which would drag the whole axis back to 1970.
 */
export function monthLabelToDate(label) {
  if (!label) return null;
  const parts = String(label).trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  const mi = MONTHS.indexOf(parts[0].slice(0, 3));
  if (mi < 0) return null;

  const rawYear = parts[1].replace(/^'/, '');
  if (!/^\d{2}$|^\d{4}$/.test(rawYear)) return null;
  const n = parseInt(rawYear, 10);
  // A two-digit year is this century: "26" is 2026, not 1926.
  const year = rawYear.length === 2 ? 2000 + n : n;
  return new Date(year, mi, 1);
}

/** Map the forecasting page's rows onto what the chart expects. */
export function toSeries(rows) {
  return (rows || [])
    .map((r) => {
      // _sortKey is the unambiguous four-digit form where it exists; forecast
      // rows only have the abbreviated name.
      const date = monthLabelToDate(r._sortKey) ?? monthLabelToDate(r.name);
      if (!date) return null;
      return { date, qty: Number(r.qty) || 0, forecast: !!r.forecast, label: r.name };
    })
    .filter(Boolean);
}

export default function ForecastChart({ rows, height = 300 }) {
  const data = useMemo(() => toSeries(rows), [rows]);
  // Where the history stops and the prediction starts. The legend under the
  // chart has always claimed the forecast was drawn dashed; until now it was
  // drawn as one continuous solid line, so there was no way to see which part
  // of it had actually happened.
  const dashFrom = useMemo(() => {
    const i = data.findIndex((d) => d.forecast);
    // Dash from the last real point, so the dashed run starts at the join
    // rather than one month after it.
    return i <= 0 ? undefined : i - 1;
  }, [data]);
  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height }}>
      <LineChart
        data={data}
        xDataKey="date"
        margin={{ top: 16, right: 20, bottom: 28, left: 40 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Grid />
        <XAxis />
        {/*
         * Monotone, not the default natural spline. A natural spline
         * overshoots between points, and demand for a spare part swings
         * between nothing and a lump — so the curve dived well below zero
         * between two intermittent months and was clipped off the bottom of
         * the chart. A monotone curve stays within the values it joins, which
         * is also the only honest shape here: there is no month in which
         * minus-four units were consumed.
         */}
        <Line
          dataKey="qty"
          stroke="var(--chart-line-primary)"
          strokeWidth={2.5}
          curve={curveMonotoneX}
          dashFromIndex={dashFrom}
        />
        <ChartTooltip />
      </LineChart>
    </div>
  );
}
