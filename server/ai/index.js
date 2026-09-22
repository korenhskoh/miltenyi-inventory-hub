/**
 * Provider-agnostic access to a chat model.
 *
 * Callers ask for `chat()` and never learn which provider answered. Swapping
 * OpenAI for Anthropic or Gemini is a Settings change, not a code change, and
 * adding a fourth provider is one file in ./providers plus a line in REGISTRY.
 *
 * API keys live only on the server. They are stored per provider so switching
 * back and forth does not lose them, and they are never returned to a client —
 * see `redactConfig`.
 */
import openai from './providers/openai.js';
import anthropic from './providers/anthropic.js';
import gemini from './providers/gemini.js';
import { AiError, isRetryable } from './types.js';

export const REGISTRY = { openai, anthropic, gemini };
export const PROVIDER_IDS = Object.keys(REGISTRY);
export const DEFAULT_PROVIDER = 'openai';

/** What the Settings UI needs to render the provider picker. */
export function providerCatalog() {
  return PROVIDER_IDS.map((id) => {
    const p = REGISTRY[id];
    return {
      id: p.id,
      label: p.label,
      defaultModel: p.defaultModel,
      defaultBaseUrl: p.defaultBaseUrl,
      keyHint: p.keyHint,
      keyUrl: p.keyUrl,
      suggestedModels: p.suggestedModels,
    };
  });
}

const clamp = (v, lo, hi, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

/**
 * Turn the stored aiBotConfig into something safe to act on.
 *
 * Everything is defaulted, so a half-filled or legacy config still resolves.
 * The legacy single `apiKey` field — from before this was multi-provider — is
 * read as the key for whichever provider is selected, so existing setups keep
 * working without anyone re-entering anything.
 */
export function resolveConfig(raw = {}) {
  const provider = PROVIDER_IDS.includes(raw.provider) ? raw.provider : DEFAULT_PROVIDER;
  const adapter = REGISTRY[provider];
  const keys = raw.apiKeys && typeof raw.apiKeys === 'object' ? raw.apiKeys : {};
  const apiKey = keys[provider] || raw.apiKey || '';

  const fallbackProvider =
    raw.fallbackProvider && PROVIDER_IDS.includes(raw.fallbackProvider) && raw.fallbackProvider !== provider
      ? raw.fallbackProvider
      : null;

  return {
    // The model is only consulted once a key exists, so "enabled" means both.
    enabled: raw.enabled !== false && Boolean(apiKey),
    provider,
    model: (raw.model || '').trim() || adapter.defaultModel,
    apiKey,
    baseUrl: (raw.baseUrl || '').trim() || adapter.defaultBaseUrl,
    maxTokens: clamp(raw.maxTokens, 1, 8192, 700),
    temperature: clamp(raw.temperature, 0, 2, 0.3),
    timeoutMs: clamp(raw.timeoutMs, 1000, 120000, 30000),
    fallbackProvider,
    fallbackModel:
      (raw.fallbackModel || '').trim() || (fallbackProvider ? REGISTRY[fallbackProvider].defaultModel : ''),
    fallbackApiKey: fallbackProvider ? keys[fallbackProvider] || '' : '',
  };
}

/**
 * Strip every secret before a config goes anywhere near a client.
 *
 * Keys are reported only as "is one set", never echoed — not even partially.
 * The old behaviour returned the stored key to any admin, which put a live
 * provider credential into the browser for no reason.
 */
export function redactConfig(raw = {}) {
  const cfg = resolveConfig(raw);
  const keys = raw.apiKeys && typeof raw.apiKeys === 'object' ? raw.apiKeys : {};
  return {
    enabled: cfg.enabled,
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    timeoutMs: cfg.timeoutMs,
    fallbackProvider: cfg.fallbackProvider,
    fallbackModel: cfg.fallbackModel,
    hasKey: Object.fromEntries(
      PROVIDER_IDS.map((id) => [id, Boolean(keys[id] || (id === cfg.provider && raw.apiKey))]),
    ),
  };
}

/** Validate the normalised messages array before spending a request on it. */
function assertMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AiError('bad_request', 'At least one message is required');
  }
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      throw new AiError('bad_request', "Each message needs a role of 'user' or 'assistant'");
    }
    if (typeof m.content !== 'string' || !m.content.trim()) {
      throw new AiError('bad_request', 'Each message needs non-empty text');
    }
  }
}

async function callProvider(id, { system, messages, model, apiKey, baseUrl, maxTokens, temperature, timeoutMs }) {
  const adapter = REGISTRY[id];
  if (!adapter) throw new AiError('config', `Unknown provider: ${id}`);
  if (!apiKey) throw new AiError('config', `No API key configured for ${adapter.label}`, { provider: id });
  const result = await adapter.chat({ system, messages, model, apiKey, baseUrl, maxTokens, temperature, timeoutMs });
  return { ...result, provider: id };
}

/**
 * Send a conversation to the configured model.
 *
 * On a retryable failure — rate limit, timeout, network, provider 5xx — and
 * only then, the configured fallback provider is tried. A bad key or a bad
 * request is not retried anywhere, because the second provider would fail the
 * same way and it would just double the latency.
 */
export async function chat({ system, messages }, rawConfig) {
  const cfg = resolveConfig(rawConfig);
  assertMessages(messages);
  if (!cfg.apiKey) {
    throw new AiError('config', 'No API key configured — add one in AI Bot settings', { provider: cfg.provider });
  }

  try {
    return await callProvider(cfg.provider, {
      system,
      messages,
      model: cfg.model,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
      timeoutMs: cfg.timeoutMs,
    });
  } catch (err) {
    const canFallback = cfg.fallbackProvider && cfg.fallbackApiKey && isRetryable(err?.code);
    if (!canFallback) throw err;
    const result = await callProvider(cfg.fallbackProvider, {
      system,
      messages,
      model: cfg.fallbackModel,
      apiKey: cfg.fallbackApiKey,
      baseUrl: REGISTRY[cfg.fallbackProvider].defaultBaseUrl,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
      timeoutMs: cfg.timeoutMs,
    });
    return { ...result, usedFallback: true, fallbackReason: err.code };
  }
}

/**
 * Ask the provider what models this account can actually use.
 *
 * A list written into the source is stale within weeks — model ids change
 * faster than this app ships. So the picker is populated from the provider
 * itself whenever a key is stored, and the hard-coded `suggestedModels` is only
 * the fallback for "no key yet" and "the provider's list endpoint refused".
 */
export async function listModels(rawConfig = {}, providerId = null) {
  const cfg = resolveConfig(rawConfig);
  const id = providerId && PROVIDER_IDS.includes(providerId) ? providerId : cfg.provider;
  const adapter = REGISTRY[id];
  const keys = rawConfig?.apiKeys && typeof rawConfig.apiKeys === 'object' ? rawConfig.apiKeys : {};
  const apiKey = keys[id] || (id === cfg.provider ? cfg.apiKey : '') || '';

  if (!apiKey || typeof adapter.listModels !== 'function') {
    return { provider: id, models: adapter.suggestedModels, live: false };
  }
  const models = await adapter.listModels({
    apiKey,
    baseUrl: id === cfg.provider ? cfg.baseUrl : adapter.defaultBaseUrl,
    timeoutMs: Math.min(cfg.timeoutMs, 15000),
  });
  const list = Array.isArray(models) ? models.filter(Boolean) : [];
  // An empty catalog is not an answer worth showing an empty dropdown for.
  if (list.length === 0) return { provider: id, models: adapter.suggestedModels, live: false };
  return { provider: id, models: list, live: true };
}

/**
 * A cheap round trip so Settings can prove a key works before anyone relies on it.
 *
 * `onComplete` lets the caller record the spend. This call used to go straight
 * to the provider without touching the usage log, so the spend screen
 * under-reported every time someone pressed Test.
 */
export async function testConnection(rawConfig, onComplete = null) {
  const cfg = resolveConfig(rawConfig);
  const started = Date.now();
  let res;
  try {
    res = await callProvider(cfg.provider, {
      system: 'Reply with the single word: ok',
      messages: [{ role: 'user', content: 'ping' }],
      model: cfg.model,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      maxTokens: 16,
      temperature: 0,
      timeoutMs: Math.min(cfg.timeoutMs, 15000),
    });
  } catch (err) {
    await onComplete?.({
      ok: false,
      provider: cfg.provider,
      model: cfg.model,
      errorCode: err?.code,
      ms: Date.now() - started,
    });
    throw err;
  }
  await onComplete?.({
    ok: true,
    provider: res.provider || cfg.provider,
    model: res.model,
    usage: res.usage,
    ms: Date.now() - started,
  });
  return { ok: true, provider: cfg.provider, model: res.model, ms: Date.now() - started, reply: res.text.trim() };
}

export { AiError };
