/**
 * The shape every provider adapter speaks.
 *
 * Callers build a request in these terms and never see a provider's own wire
 * format; adapters translate in both directions. Adding a provider means adding
 * one file that implements `chat`, not touching anything that calls it.
 *
 * ChatRequest:
 *   system      string            instructions, kept separate from the turns
 *   messages    [{ role, content }]  role is 'user' | 'assistant'
 *   model       string
 *   apiKey      string
 *   baseUrl     string?           override for gateways and self-hosted servers
 *   maxTokens   number
 *   temperature number
 *   timeoutMs   number
 *
 * ChatResult:
 *   text        string            the reply
 *   usage       { inputTokens, outputTokens }
 *   stopReason  'stop' | 'length' | 'filter' | 'other'
 *   model       string            what the provider says it actually used
 */

/** Errors carry a stable `code` so callers can react without parsing prose. */
export class AiError extends Error {
  constructor(code, message, { status, provider, retryable = false } = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code; // auth | rate_limit | timeout | bad_request | server | network | config
    this.status = status;
    this.provider = provider;
    this.retryable = retryable;
  }
}

/**
 * Map an HTTP status onto a stable code.
 *
 * 401/403 is nearly always a bad or unentitled key; 429 and 5xx are worth
 * retrying or failing over, and everything else is the caller's mistake.
 */
export function codeForStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'bad_request';
}

export function isRetryable(code) {
  return code === 'rate_limit' || code === 'server' || code === 'timeout' || code === 'network';
}

/** Normalise whatever a provider calls its stop reason. */
export function normalizeStopReason(raw) {
  const v = String(raw ?? '').toLowerCase();
  if (['stop', 'end_turn', 'stop_sequence', 'complete'].includes(v)) return 'stop';
  if (['length', 'max_tokens', 'max_token'].includes(v)) return 'length';
  if (['content_filter', 'safety', 'blocklist', 'prohibited_content'].includes(v)) return 'filter';
  return 'other';
}

/**
 * One fetch with a timeout, JSON in and JSON out, and errors already
 * normalised. Every adapter goes through here so timeout and error handling
 * cannot drift between them.
 */
export async function getJson(url, { headers, timeoutMs = 20000, provider } = {}) {
  return request(url, { method: 'GET', headers, timeoutMs, provider });
}

export async function postJson(url, { headers, body, timeoutMs = 30000, provider }) {
  return request(url, { method: 'POST', headers, body, timeoutMs, provider });
}

async function request(url, { method, headers, body, timeoutMs = 30000, provider }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') {
      throw new AiError('timeout', `${provider} did not respond within ${timeoutMs}ms`, {
        provider,
        retryable: true,
      });
    }
    throw new AiError('network', `Could not reach ${provider}: ${e.message}`, { provider, retryable: true });
  }
  clearTimeout(timer);

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const code = codeForStatus(res.status);
    // Providers bury the useful line in different places.
    const detail = json?.error?.message || json?.message || json?.error?.status || text.slice(0, 200) || res.statusText;
    throw new AiError(code, detail, { status: res.status, provider, retryable: isRetryable(code) });
  }
  return json;
}
