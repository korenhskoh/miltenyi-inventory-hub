/**
 * Text → vectors, from whichever provider can actually do it.
 *
 * Embeddings are a separate capability from chat: OpenAI and Gemini offer one,
 * Anthropic does not. So the embedding provider is chosen independently of the
 * chat provider — running Claude for answers while OpenAI does the vectors is
 * normal, not a misconfiguration.
 *
 * When no provider can embed, this returns null rather than throwing, and the
 * knowledge base falls back to lexical search. That matters: a search that is
 * merely less clever still answers the question, while a search that errors
 * takes the whole assistant down with it.
 */
import logger from '../logger.js';
import { REGISTRY, resolveConfig } from './index.js';
import { recordUsage } from './usage.js';
import { costOf } from './pricing.js';

/** Providers that can embed, in preference order. */
export const EMBEDDING_PROVIDERS = ['openai', 'gemini'];

/** How many chunks go in one request. Keeps a request well inside every limit. */
export const BATCH_SIZE = 64;

/**
 * Which provider will do the embedding, given the stored config.
 *
 * Preference order: an explicit choice, then the chat provider if it can embed
 * (one key, one bill), then any other provider with a key.
 */
export function pickEmbeddingProvider(rawConfig = {}) {
  const cfg = resolveConfig(rawConfig);
  const keys = rawConfig?.apiKeys && typeof rawConfig.apiKeys === 'object' ? rawConfig.apiKeys : {};
  const keyFor = (id) => keys[id] || (id === cfg.provider ? cfg.apiKey : '') || '';

  const explicit = rawConfig?.embeddingProvider;
  const candidates = [
    ...(explicit && EMBEDDING_PROVIDERS.includes(explicit) ? [explicit] : []),
    ...(EMBEDDING_PROVIDERS.includes(cfg.provider) ? [cfg.provider] : []),
    ...EMBEDDING_PROVIDERS,
  ];

  for (const id of candidates) {
    const apiKey = keyFor(id);
    if (apiKey && typeof REGISTRY[id]?.embed === 'function') {
      return {
        id,
        apiKey,
        model: rawConfig?.embeddingModel || REGISTRY[id].embeddingModel,
        baseUrl: id === cfg.provider ? cfg.baseUrl : REGISTRY[id].defaultBaseUrl,
        timeoutMs: cfg.timeoutMs,
      };
    }
  }
  return null;
}

/**
 * Embed a list of texts.
 *
 * Returns `{ vectors, model, provider, dim }`, or null when nothing can embed.
 * Vectors come back in the order the texts were given, and every call is
 * written to the usage log like any other spend.
 */
export async function embedTexts(texts, rawConfig = {}, { userId = null } = {}) {
  const input = (Array.isArray(texts) ? texts : [texts]).map((t) => String(t || '').trim()).filter(Boolean);
  if (input.length === 0) return null;

  const target = pickEmbeddingProvider(rawConfig);
  if (!target) return null;

  const adapter = REGISTRY[target.id];
  const vectors = [];
  let model = target.model;

  for (let i = 0; i < input.length; i += BATCH_SIZE) {
    const batch = input.slice(i, i + BATCH_SIZE);
    const started = Date.now();
    try {
      const res = await adapter.embed({
        input: batch,
        model: target.model,
        apiKey: target.apiKey,
        baseUrl: target.baseUrl,
        timeoutMs: target.timeoutMs,
      });
      if (!Array.isArray(res?.vectors) || res.vectors.length !== batch.length) {
        throw new Error(`Expected ${batch.length} vectors, got ${res?.vectors?.length ?? 0}`);
      }
      vectors.push(...res.vectors);
      model = res.model || model;
      const { usd } = costOf(
        { provider: target.id, model, inputTokens: res.usage?.inputTokens, outputTokens: 0 },
        rawConfig?.pricing,
      );
      await recordUsage({
        surface: 'embedding',
        userId,
        provider: target.id,
        model,
        inputTokens: res.usage?.inputTokens,
        costUsd: usd,
        latencyMs: Date.now() - started,
        ok: true,
      });
    } catch (err) {
      await recordUsage({
        surface: 'embedding',
        userId,
        provider: target.id,
        model,
        latencyMs: Date.now() - started,
        ok: false,
        errorCode: err?.code || 'error',
      });
      logger.warn({ code: err?.code, message: err?.message, provider: target.id }, 'Embedding failed');
      return null;
    }
  }

  return { vectors, model, provider: target.id, dim: vectors[0]?.length || 0 };
}

/**
 * Cosine similarity, guarding the cases that produce NaN.
 *
 * Vectors of different lengths mean two different embedding models are mixed in
 * the same table — comparing them is meaningless, so they score zero rather
 * than quietly ranking on noise.
 */
export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
