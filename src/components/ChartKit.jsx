/**
 * Shared chart furniture, so every chart in the app reads as one system.
 *
 * Built on Recharts, which the app already depends on. The Bklit registry we
 * originally picked for this cannot be reached from the build environment, so
 * the look is reproduced here directly; these pieces are deliberately thin, and
 * swapping the underlying chart library later means replacing this one file.
 *
 * The palette is the Miltenyi green with amber and red reserved for warning and
 * alert states, matching the badges used elsewhere.
 */
import React from 'react';

export const CHART_COLORS = {
  primary: '#0B7A3E',
  accent: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  muted: '#94A3B8',
  grid: '#E2E8F0',
};

/** Series colours in the order a multi-series chart should use them. */
export const SERIES = [CHART_COLORS.primary, CHART_COLORS.info, CHART_COLORS.accent, CHART_COLORS.danger, '#7C3AED'];

export const axisProps = {
  tick: { fontSize: 11, fill: CHART_COLORS.muted },
  axisLine: false,
  tickLine: false,
};

/** A soft vertical fade under an area/line, keyed by id so several can coexist. */
export function ChartGradient({ id, color, from = 0.22, to = 0 }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}

/**
 * Tooltip that reads like the rest of the UI rather than Recharts' default.
 * `formatValue` keeps currency and plain counts consistent across charts.
 */
export function ChartTooltip({ active, payload, label, formatValue = (v) => v, footnote }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#0F172A',
        color: '#F8FAFC',
        borderRadius: 8,
        padding: '8px 11px',
        fontSize: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        border: '1px solid rgba(255,255,255,0.08)',
        minWidth: 120,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 5, fontSize: 11.5, opacity: 0.85 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
          <span
            style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.stroke, flexShrink: 0 }}
            aria-hidden
          />
          <span style={{ opacity: 0.8 }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{formatValue(p.value)}</span>
        </div>
      ))}
      {footnote && <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.65 }}>{footnote}</div>}
    </div>
  );
}

/** Grid styling shared by every cartesian chart. */
export const gridProps = {
  strokeDasharray: '3 3',
  stroke: CHART_COLORS.grid,
  vertical: false,
};
