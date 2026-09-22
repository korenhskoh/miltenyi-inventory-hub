import React, { useEffect, useState, useCallback } from 'react';
import { Check, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import api from '../api.js';

/**
 * What the AI has cost, and the caps that stop it costing more.
 *
 * Spend used to be invisible from inside the app: the key worked, the bot
 * answered, and the only evidence of a bill was the provider's dashboard. This
 * screen is the answer to "what are we actually paying for this", and the caps
 * below it are the answer to "what stops it running away".
 */

const card = {
  background: '#fff',
  border: '1.5px solid #E2E8F0',
  borderRadius: 12,
  padding: '14px 16px',
};
const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 };
const hint = { fontSize: 11, color: '#94A3B8', marginTop: 5 };
const field = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13 };

/**
 * Cents are not enough resolution here — a single question costs a fraction of
 * one — but "$0.0000" for a day with no spend reads like a rounding bug rather
 * than a zero, so exact zero gets the ordinary two places.
 */
const money = (n) => {
  const v = Number(n || 0);
  if (v === 0) return '$0.00';
  return `$${v.toFixed(v >= 1 ? 2 : 4)}`;
};

/** A cap of null is "unlimited", which the input shows as an empty box. */
const toInput = (v) => (v === null || v === undefined ? '' : String(v));
const fromInput = (v) => (String(v).trim() === '' ? null : Number(v));

function Meter({ used, cap }) {
  const pct = cap === null || cap === 0 ? (cap === 0 ? 100 : 0) : Math.min(100, (used / cap) * 100);
  const colour = pct >= 100 ? '#DC2626' : pct >= 80 ? '#D97706' : '#0B7A3E';
  return (
    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width .4s ease' }} />
    </div>
  );
}

export default function AiUsagePanel({ notify }) {
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const [limits, setLimits] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [usage, recent] = await Promise.all([api.getAiUsage(), api.getAiUsageLog(25)]);
    if (usage) {
      setData(usage);
      setLimits(usage.limits);
    }
    setLog(recent?.rows || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [usage, recent] = await Promise.all([api.getAiUsage(), api.getAiUsageLog(25)]);
      if (!alive) return;
      if (usage) {
        setData(usage);
        setLimits(usage.limits);
      }
      setLog(recent?.rows || []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveLimits = async () => {
    setBusy(true);
    const saved = await api.setConfigKey('aiBotConfig', { limits });
    setBusy(false);
    if (saved === false || saved === null) {
      notify?.('Not Saved', 'The budget could not be saved.', 'error');
      return;
    }
    await load();
    notify?.('Budget Saved', 'New limits apply to the next question asked.', 'success');
  };

  if (loading) return <div style={{ fontSize: 12, color: '#94A3B8' }}>Loading usage…</div>;
  if (!data) return <div style={{ fontSize: 12, color: '#94A3B8' }}>Usage is unavailable right now.</div>;

  const capField = (key, text, help) => (
    <div>
      <label style={label}>{text}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={toInput(limits?.[key])}
        placeholder="No limit"
        onChange={(e) => setLimits((l) => ({ ...l, [key]: fromInput(e.target.value) }))}
        style={field}
      />
      <p style={hint}>{help}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>TODAY</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A' }}>{money(data.today.cost)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {data.today.calls} call{data.today.calls === 1 ? '' : 's'}
            {limits?.dailyCostUsd !== null && ` · cap ${money(limits.dailyCostUsd)}`}
          </div>
          <Meter used={data.today.cost} cap={limits?.dailyCostUsd} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>THIS MONTH</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A' }}>{money(data.month.cost)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {limits?.monthlyCostUsd !== null ? `cap ${money(limits.monthlyCostUsd)}` : 'no cap set'}
          </div>
          <Meter used={data.month.cost} cap={limits?.monthlyCostUsd} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>LAST 30 DAYS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
            {money(data.bySurface.reduce((s, r) => s + r.cost, 0))}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {data.bySurface.reduce((s, r) => s + r.calls, 0)} calls ·{' '}
            {data.bySurface.reduce((s, r) => s + r.failures, 0)} failed
          </div>
        </div>
      </div>

      <div>
        <label style={label}>Spending limits</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {capField('dailyCostUsd', 'Per day (everyone)', 'Resets at midnight Singapore time.')}
          {capField('monthlyCostUsd', 'Per month (everyone)', 'Resets on the 1st.')}
          {capField('perUserDailyCostUsd', 'Per person, per day', 'Stops one person using the whole budget.')}
          {capField('perUserHourlyCalls', 'Questions per person, per hour', 'A rate limit, not a cost limit.')}
        </div>
        <p style={hint}>
          Leave a box empty for no limit. A limit of 0 stops the model entirely — the bot then answers with its built-in
          commands, exactly as it did before any key was added.
        </p>
        <button className="bp" onClick={saveLimits} disabled={busy} style={{ width: 'fit-content', marginTop: 10 }}>
          <Check size={14} /> {busy ? 'Saving…' : 'Save Budget'}
        </button>
      </div>

      {data.bySurface.length > 0 && (
        <div>
          <label style={label}>Where it goes (30 days)</label>
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#64748B' }}>
                  <th style={{ textAlign: 'left', padding: '9px 12px' }}>Surface</th>
                  <th style={{ textAlign: 'right', padding: '9px 12px' }}>Calls</th>
                  <th style={{ textAlign: 'right', padding: '9px 12px' }}>Tokens</th>
                  <th style={{ textAlign: 'right', padding: '9px 12px' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.bySurface.map((r) => (
                  <tr key={r.surface} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '9px 12px', textTransform: 'capitalize' }}>
                      {r.surface}
                      {r.failures > 0 && <span style={{ color: '#B91C1C', fontSize: 11 }}> · {r.failures} failed</span>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.calls}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.tokens.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{money(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details>
        <summary style={{ fontSize: 12, fontWeight: 600, color: '#4A5568', cursor: 'pointer' }}>
          Recent calls ({log.length})
        </summary>
        <div style={{ ...card, padding: 0, marginTop: 10, maxHeight: 320, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '7px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleString('en-SG', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={{ padding: '7px 12px' }}>
                    {r.ok ? (
                      <span style={{ color: '#0B7A3E' }}>{r.surface}</span>
                    ) : (
                      <span style={{ color: '#B91C1C' }} title={r.error_code || ''}>
                        <AlertTriangle size={11} /> {r.surface}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#475569' }}>{r.user_name || '—'}</td>
                  <td style={{ padding: '7px 12px', color: '#64748B', fontFamily: 'monospace', fontSize: 11 }}>
                    {r.model}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#64748B' }}>
                    {r.total_tokens ? `${r.total_tokens} tok` : '—'}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{money(r.cost_usd)}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td style={{ padding: '14px 12px', color: '#94A3B8' }}>Nothing yet — no model call has been made.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <button className="bs" onClick={load} style={{ width: 'fit-content' }}>
        {loading ? <Loader2 size={13} /> : <RefreshCw size={13} />} Refresh
      </button>
    </div>
  );
}
