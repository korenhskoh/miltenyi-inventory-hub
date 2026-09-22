import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat, resolveConfig, redactConfig, providerCatalog, PROVIDER_IDS, AiError } from './index.js';

let calls;
function mockFetch(handler) {
  calls = [];
  globalThis.fetch = vi.fn(async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return handler(url, calls.length);
  });
}
const ok = (text) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () =>
    JSON.stringify({
      choices: [{ message: { content: text }, finish_reason: 'stop' }],
      content: [{ type: 'text', text }],
      candidates: [{ content: { parts: [{ text }] } }],
    }),
});
const fail = (status) => ({
  ok: false,
  status,
  statusText: 'x',
  text: async () => JSON.stringify({ error: { message: 'boom' } }),
});

const MSG = [{ role: 'user', content: 'hello' }];

describe('resolveConfig', () => {
  it('defaults everything from an empty config', () => {
    const c = resolveConfig({});
    expect(c.provider).toBe('openai');
    expect(c.model).toBe('gpt-4o-mini');
    expect(c.enabled).toBe(false); // no key
    expect(c.maxTokens).toBeGreaterThan(0);
  });

  it('keeps a key per provider so switching does not lose the others', () => {
    const raw = { provider: 'anthropic', apiKeys: { openai: 'k-oai', anthropic: 'k-ant' } };
    expect(resolveConfig(raw).apiKey).toBe('k-ant');
    expect(resolveConfig({ ...raw, provider: 'openai' }).apiKey).toBe('k-oai');
  });

  it('reads the legacy single apiKey field, so existing setups keep working', () => {
    // Before this was multi-provider there was one `apiKey`. It must not break.
    const c = resolveConfig({ apiKey: 'sk-legacy' });
    expect(c.apiKey).toBe('sk-legacy');
    expect(c.enabled).toBe(true);
  });

  it('falls back to a known provider when given nonsense', () => {
    expect(resolveConfig({ provider: 'skynet' }).provider).toBe('openai');
  });

  it('clamps generation settings into a sane range', () => {
    expect(resolveConfig({ temperature: 99 }).temperature).toBe(2);
    expect(resolveConfig({ temperature: -5 }).temperature).toBe(0);
    expect(resolveConfig({ maxTokens: 0 }).maxTokens).toBe(1);
    expect(resolveConfig({ maxTokens: 'abc' }).maxTokens).toBe(700);
  });

  it('ignores a fallback that is the same as the primary', () => {
    expect(resolveConfig({ provider: 'openai', fallbackProvider: 'openai' }).fallbackProvider).toBe(null);
  });
});

describe('redactConfig', () => {
  it('never returns a key, not even partially', () => {
    const out = redactConfig({ provider: 'openai', apiKeys: { openai: 'sk-secret-value' }, model: 'gpt-4o' });
    const asText = JSON.stringify(out);
    expect(asText).not.toContain('sk-secret-value');
    expect(asText).not.toContain('secret');
    expect(out.hasKey.openai).toBe(true);
    expect(out.hasKey.gemini).toBe(false);
  });

  it('still reports the non-secret settings', () => {
    const out = redactConfig({ provider: 'gemini', model: 'gemini-2.5-pro', temperature: 0.7 });
    expect(out.provider).toBe('gemini');
    expect(out.model).toBe('gemini-2.5-pro');
    expect(out.temperature).toBe(0.7);
  });
});

describe('providerCatalog', () => {
  it('describes every registered provider for the settings UI', () => {
    const cat = providerCatalog();
    expect(cat.map((p) => p.id).sort()).toEqual([...PROVIDER_IDS].sort());
    for (const p of cat) {
      expect(p.label).toBeTruthy();
      expect(p.defaultModel).toBeTruthy();
      expect(Array.isArray(p.suggestedModels)).toBe(true);
    }
  });
});

describe('chat', () => {
  beforeEach(() => {
    calls = [];
  });

  it('refuses to spend a request without a key', async () => {
    const err = await chat({ messages: MSG }, {}).catch((e) => e);
    expect(err.code).toBe('config');
  });

  it('rejects malformed messages before calling out', async () => {
    mockFetch(() => ok('x'));
    for (const bad of [[], [{ role: 'system', content: 'x' }], [{ role: 'user', content: '  ' }]]) {
      const err = await chat({ messages: bad }, { apiKey: 'k' }).catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.code).toBe('bad_request');
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns the reply and names the provider that answered', async () => {
    mockFetch(() => ok('hello there'));
    const r = await chat({ messages: MSG }, { provider: 'openai', apiKeys: { openai: 'k' } });
    expect(r.text).toBe('hello there');
    expect(r.provider).toBe('openai');
    expect(r.usedFallback).toBeUndefined();
  });

  it('fails over to the fallback provider on a rate limit', async () => {
    mockFetch((_u, n) => (n === 1 ? fail(429) : ok('from anthropic')));
    const r = await chat(
      { messages: MSG },
      { provider: 'openai', fallbackProvider: 'anthropic', apiKeys: { openai: 'k1', anthropic: 'k2' } },
    );
    expect(r.usedFallback).toBe(true);
    expect(r.fallbackReason).toBe('rate_limit');
    expect(r.provider).toBe('anthropic');
    expect(calls).toHaveLength(2);
  });

  it('does NOT fail over on a bad key — the other provider would fail too', async () => {
    mockFetch(() => fail(401));
    const err = await chat(
      { messages: MSG },
      { provider: 'openai', fallbackProvider: 'anthropic', apiKeys: { openai: 'k1', anthropic: 'k2' } },
    ).catch((e) => e);
    expect(err.code).toBe('auth');
    expect(calls).toHaveLength(1);
  });

  it('does not fail over when the fallback has no key of its own', async () => {
    mockFetch(() => fail(500));
    const err = await chat(
      { messages: MSG },
      { provider: 'openai', fallbackProvider: 'gemini', apiKeys: { openai: 'k1' } },
    ).catch((e) => e);
    expect(err.code).toBe('server');
    expect(calls).toHaveLength(1);
  });

  it('routes to whichever provider is configured', async () => {
    for (const id of PROVIDER_IDS) {
      mockFetch(() => ok('hi'));
      const r = await chat({ messages: MSG }, { provider: id, apiKeys: { [id]: 'k' } });
      expect(r.provider).toBe(id);
    }
  });
});
