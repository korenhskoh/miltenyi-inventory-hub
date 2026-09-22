import React, { useEffect, useState, useCallback } from 'react';
import { Check, AlertTriangle, Loader2, KeyRound, Zap } from 'lucide-react';
import api from '../api.js';

/**
 * Choose which model answers, and prove the key works before anyone relies on it.
 *
 * Keys are write-only on the server: they can be set here but never read back,
 * so the field always starts blank and "leave blank to keep the current key" is
 * literally how it behaves. That is deliberate — a provider credential has no
 * reason to travel to a browser.
 */
export default function AiProviderSettings({ notify }) {
  const [catalog, setCatalog] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    const res = await api.getAiProviders();
    if (!res) return;
    setCatalog(res.providers || []);
    setCfg(res.config || {});
  }, []);

  useEffect(() => {
    // Guarded so a response arriving after unmount cannot set state, which is
    // also what the lint rule about cascading renders is pointing at.
    let alive = true;
    (async () => {
      const res = await api.getAiProviders();
      if (!alive || !res) return;
      setCatalog(res.providers || []);
      setCfg(res.config || {});
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!cfg) return <div style={{ fontSize: 12, color: '#94A3B8' }}>Loading providers…</div>;

  const current = catalog.find((p) => p.id === cfg.provider) || catalog[0];
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));

  const save = async () => {
    setBusy(true);
    // Only send a key when one was typed; blank means "keep what is stored".
    const payload = {
      provider: cfg.provider,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      temperature: Number(cfg.temperature),
      maxTokens: Number(cfg.maxTokens),
      fallbackProvider: cfg.fallbackProvider || null,
      ...(key.trim() ? { apiKeys: { [cfg.provider]: key.trim() } } : {}),
    };
    const saved = await api.setConfigKey('aiBotConfig', payload);
    setBusy(false);
    if (saved === false || saved === null) {
      notify?.('Not Saved', 'The AI settings could not be saved.', 'error');
      return;
    }
    setKey('');
    setTestResult(null);
    await load();
    notify?.('Settings Saved', `${current?.label} is now answering.`, 'success');
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await api.testAiProvider({ provider: cfg.provider, apiKey: key.trim() || undefined });
    setTesting(false);
    setTestResult(res);
  };

  const field = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13 };
  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 };
  const hint = { fontSize: 11, color: '#94A3B8', marginTop: 5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={label}>AI Provider</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {catalog.map((p) => {
            const active = p.id === cfg.provider;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => set({ provider: p.id, model: p.defaultModel, baseUrl: p.defaultBaseUrl })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 14px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: active ? '#E6F4ED' : '#fff',
                  color: active ? '#0B7A3E' : '#475569',
                  border: `1.5px solid ${active ? '#0B7A3E' : '#E2E8F0'}`,
                }}
              >
                {p.label}
                {cfg.hasKey?.[p.id] && (
                  <span title="A key is stored for this provider" style={{ display: 'inline-flex' }}>
                    <KeyRound size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p style={hint}>
          The key icon marks providers that already have a key stored. Switching provider keeps the others&apos; keys.
        </p>
      </div>

      <div>
        <label style={label}>Model</label>
        <input
          list="ai-model-list"
          value={cfg.model || ''}
          onChange={(e) => set({ model: e.target.value })}
          style={field}
        />
        <datalist id="ai-model-list">
          {(current?.suggestedModels || []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p style={hint}>Suggestions are listed, but any model id your account can reach will work.</p>
      </div>

      <div>
        <label style={label}>API Key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={cfg.hasKey?.[cfg.provider] ? '•••••••• (stored — leave blank to keep it)' : current?.keyHint}
          style={{ ...field, fontFamily: 'monospace' }}
          autoComplete="off"
        />
        <p style={hint}>
          Stored on the server and never sent back to this page.{' '}
          {current?.keyUrl && (
            <a href={current.keyUrl} target="_blank" rel="noreferrer" style={{ color: '#0B7A3E' }}>
              Get a key
            </a>
          )}
        </p>
      </div>

      <details>
        <summary style={{ fontSize: 12, fontWeight: 600, color: '#4A5568', cursor: 'pointer' }}>Advanced</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <label style={label}>Temperature</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={cfg.temperature ?? 0.3}
              onChange={(e) => set({ temperature: e.target.value })}
              style={field}
            />
            <p style={hint}>Lower is more literal. 0.3 suits factual answers.</p>
          </div>
          <div>
            <label style={label}>Max reply tokens</label>
            <input
              type="number"
              min="1"
              max="8192"
              value={cfg.maxTokens ?? 700}
              onChange={(e) => set({ maxTokens: e.target.value })}
              style={field}
            />
            <p style={hint}>Replies are read on a phone; short is better.</p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Base URL</label>
            <input value={cfg.baseUrl || ''} onChange={(e) => set({ baseUrl: e.target.value })} style={field} />
            <p style={hint}>
              Override to reach an OpenAI-compatible service — Azure, Groq, OpenRouter, or a local model server.
            </p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Fallback provider</label>
            <select
              value={cfg.fallbackProvider || ''}
              onChange={(e) => set({ fallbackProvider: e.target.value || null })}
              style={field}
            >
              <option value="">None</option>
              {catalog
                .filter((p) => p.id !== cfg.provider)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
            </select>
            <p style={hint}>
              Used only when the main provider is rate-limited, times out or errors — never when a key is rejected,
              since the second would fail the same way.
            </p>
          </div>
        </div>
      </details>

      {testResult && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 9,
            fontSize: 12,
            background: testResult.ok ? '#D1FAE5' : '#FEE2E2',
            color: testResult.ok ? '#065F46' : '#B91C1C',
            border: `1px solid ${testResult.ok ? '#A7F3D0' : '#FECACA'}`,
          }}
        >
          {testResult.ok ? <Check size={15} /> : <AlertTriangle size={15} />}
          <span>
            {testResult.ok
              ? `Connected to ${testResult.model} in ${testResult.ms}ms.`
              : testResult.error || 'The test failed.'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="bp" onClick={save} disabled={busy} style={{ width: 'fit-content' }}>
          <Check size={14} /> {busy ? 'Saving…' : 'Save Configuration'}
        </button>
        <button
          className="bs"
          onClick={test}
          disabled={testing || (!key.trim() && !cfg.hasKey?.[cfg.provider])}
          style={{ width: 'fit-content' }}
          title={!key.trim() && !cfg.hasKey?.[cfg.provider] ? 'Enter a key first' : 'Send one tiny request'}
        >
          {testing ? <Loader2 size={14} /> : <Zap size={14} />} {testing ? 'Testing…' : 'Test connection'}
        </button>
      </div>
      <p style={{ ...hint, marginTop: -8 }}>
        With no key configured the bot stays rule-based, exactly as before — the model only answers questions the rules
        cannot match, and never performs actions.
      </p>
    </div>
  );
}
