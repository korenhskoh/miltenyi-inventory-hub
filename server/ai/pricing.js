/**
 * What a model call costs.
 *
 * Provider prices change, and a number baked into code goes stale silently —
 * which is the worst failure mode for a budget, because the cap keeps passing
 * while the real bill climbs. So these are DEFAULTS: an admin can override any
 * rate from Settings (`aiBotConfig.pricing`), and the effective rate is stamped
 * onto each usage row at call time, so a later correction never rewrites
 * history.
 *
 * Rates are US dollars per MILLION tokens, which is how every provider quotes
 * them, so a rate can be copied straight off a pricing page without arithmetic.
 *
 * Checked against the providers' published pricing in September 2026. Treat
 * them as a starting point, not as gospel — the usage screen shows which model
 * priced at a rate nobody has confirmed.
 */

/** Per-million-token rates: [inputPerMillion, outputPerMillion]. */
export const DEFAULT_RATES = {
  openai: {
    'gpt-6-astra': [10, 50],
    'gpt-5.6-sol': [4, 20],
    'gpt-5.6-terra': [2, 12],
    'gpt-5.6-luna': [0.2, 1.2],
    'gpt-5.6-cyber': [12.5, 75],
    'gpt-5.3-codex': [1.75, 14],
    'chat-latest': [5, 30],
    'text-embedding-3-small': [0.02, 0],
    'text-embedding-3-large': [0.13, 0],
  },
  anthropic: {
    'claude-fable-5-1': [10, 50],
    'claude-opus-5': [5, 25],
    'claude-sonnet-5': [2, 10],
    'claude-haiku-4-5': [1, 5],
  },
  gemini: {
    'gemini-3.8-flash': [0.75, 3.75],
    'gemini-3.7-flash': [0.75, 3.75],
    'gemini-3.6-flash': [0.75, 3.75],
    'gemini-3.5-flash': [1.5, 9],
    'gemini-3.5-flash-lite': [0.3, 2.5],
    'gemini-3.1-flash-lite': [0.25, 1.5],
    'gemini-3.1-pro': [2, 12],
    'gemini-2.5-pro': [1.25, 10],
    'gemini-2.5-flash': [0.3, 2.5],
    'gemini-2.0-flash': [0.1, 0.4],
    'gemini-embedding-001': [0, 0],
  },
};

/**
 * A last-resort rate for a model nobody has priced.
 *
 * Deliberately not zero. An unknown model costing "nothing" would sail past
 * every cap; a visible over-estimate trips the budget early and gets noticed,
 * which is the failure we want.
 */
export const UNKNOWN_RATE = [3, 15];

const clean = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();

/**
 * Find the rate for a model, tolerating the version suffixes providers append.
 *
 * `gpt-4o-mini-2024-07-18` should price as `gpt-4o-mini` rather than fall to
 * the unknown rate, so the longest configured prefix wins.
 */
export function rateFor(provider, model, overrides = {}) {
  const p = clean(provider);
  const m = clean(model);
  const table = { ...(DEFAULT_RATES[p] || {}), ...(overrides?.[p] || {}) };

  if (table[m]) return normaliseRate(table[m]);

  let best = null;
  for (const [key, rate] of Object.entries(table)) {
    const k = clean(key);
    if (m.startsWith(k) && (!best || k.length > best.key.length)) best = { key: k, rate };
  }
  if (best) return normaliseRate(best.rate);
  return { rate: UNKNOWN_RATE, known: false };
}

function normaliseRate(rate) {
  if (Array.isArray(rate) && rate.length === 2) {
    const [i, o] = rate.map(Number);
    if (Number.isFinite(i) && Number.isFinite(o) && i >= 0 && o >= 0) return { rate: [i, o], known: true };
  }
  return { rate: UNKNOWN_RATE, known: false };
}

/** Dollars for one call, rounded to the micro-dollar the usage column stores. */
export function costOf({ provider, model, inputTokens = 0, outputTokens = 0 }, overrides = {}) {
  const { rate, known } = rateFor(provider, model, overrides);
  const usd = (Number(inputTokens) || 0) * (rate[0] / 1e6) + (Number(outputTokens) || 0) * (rate[1] / 1e6);
  return { usd: Math.round(usd * 1e6) / 1e6, known };
}

/** The whole table, for the Settings screen to show and edit. */
export function pricingCatalog(overrides = {}) {
  const out = {};
  for (const provider of new Set([...Object.keys(DEFAULT_RATES), ...Object.keys(overrides || {})])) {
    const merged = { ...(DEFAULT_RATES[provider] || {}), ...(overrides?.[provider] || {}) };
    out[provider] = Object.fromEntries(
      Object.entries(merged).map(([model, rate]) => [
        model,
        { input: rate[0], output: rate[1], overridden: Boolean(overrides?.[provider]?.[model]) },
      ]),
    );
  }
  return out;
}
