import { postJson, getJson, normalizeStopReason } from '../types.js';

/**
 * Google Gemini.
 *
 * The furthest from the other two: the model id is part of the URL rather than
 * the body, the key goes in a header rather than Authorization, turns are
 * `contents` with `parts` (and the assistant role is called "model"), and the
 * generation settings live under `generationConfig`.
 */
const gemini = {
  id: 'gemini',
  label: 'Google Gemini',
  defaultModel: 'gemini-3.8-flash',
  defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  keyHint: 'AIza…',
  keyUrl: 'https://aistudio.google.com/app/apikey',
  // Fallback list; the live catalog is fetched when a key is stored.
  suggestedModels: [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
  ],
  embeddingModel: 'gemini-embedding-001',

  async chat({ system, messages, model, apiKey, baseUrl, maxTokens, temperature, timeoutMs }) {
    const chosen = model || gemini.defaultModel;
    const url = `${(baseUrl || gemini.defaultBaseUrl).replace(/\/+$/, '')}/models/${encodeURIComponent(
      chosen,
    )}:generateContent`;

    const json = await postJson(url, {
      // The key can also go in the query string; a header keeps it out of any
      // URL that might end up in a log.
      headers: { 'x-goog-api-key': apiKey },
      timeoutMs,
      provider: 'gemini',
      body: {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      },
    });

    const candidate = json.candidates?.[0];
    const text = (candidate?.content?.parts || []).map((p) => p?.text || '').join('');

    return {
      text,
      usage: {
        inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      },
      stopReason: normalizeStopReason(candidate?.finishReason),
      model: json.modelVersion || chosen,
    };
  },

  /**
   * Gemini has no multi-input embeddings endpoint on v1beta, so this batches
   * through :batchEmbedContents, which takes one request object per text.
   */
  async embed({ input, model, apiKey, baseUrl, timeoutMs }) {
    const chosen = model || gemini.embeddingModel;
    const base = (baseUrl || gemini.defaultBaseUrl).replace(/\/+$/, '');
    const url = `${base}/models/${encodeURIComponent(chosen)}:batchEmbedContents`;
    const json = await postJson(url, {
      headers: { 'x-goog-api-key': apiKey },
      timeoutMs,
      provider: 'gemini',
      body: {
        requests: input.map((text) => ({
          model: `models/${chosen}`,
          content: { parts: [{ text }] },
        })),
      },
    });
    return {
      vectors: (json.embeddings || []).map((e) => e.values),
      model: chosen,
      // Gemini does not report embedding token usage; the rate table prices it
      // at zero, so an estimate here would only add noise.
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  },

  /** Gemini returns "models/<id>"; strip the prefix and drop non-chat models. */
  async listModels({ apiKey, baseUrl, timeoutMs }) {
    const url = `${(baseUrl || gemini.defaultBaseUrl).replace(/\/+$/, '')}/models?pageSize=200`;
    const json = await getJson(url, { headers: { 'x-goog-api-key': apiKey }, timeoutMs, provider: 'gemini' });
    return (json.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((id) => id && !/embedding|aqa|imagen|veo/i.test(id));
  },
};

export default gemini;
