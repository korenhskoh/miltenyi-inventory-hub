import { postJson, getJson, normalizeStopReason } from '../types.js';

/**
 * Anthropic's Messages API.
 *
 * Differs from OpenAI in three ways that matter here: the system prompt is its
 * own top-level field rather than a message, `max_tokens` is required rather
 * than optional, and the reply arrives as an array of content blocks which has
 * to be flattened back to text.
 */
const anthropic = {
  id: 'anthropic',
  label: 'Anthropic',
  defaultModel: 'claude-sonnet-5',
  defaultBaseUrl: 'https://api.anthropic.com/v1',
  keyHint: 'sk-ant-…',
  keyUrl: 'https://console.anthropic.com/settings/keys',
  // Fallback list; the live catalog is fetched when a key is stored.
  suggestedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1'],

  async chat({ system, messages, model, apiKey, baseUrl, maxTokens, temperature, timeoutMs }) {
    const url = `${(baseUrl || anthropic.defaultBaseUrl).replace(/\/+$/, '')}/messages`;
    const json = await postJson(url, {
      headers: {
        'x-api-key': apiKey,
        // Pinned: leaving it off makes the API reject the call outright.
        'anthropic-version': '2023-06-01',
      },
      timeoutMs,
      provider: 'anthropic',
      body: {
        model: model || anthropic.defaultModel,
        system: system || undefined,
        messages,
        // Required here, unlike OpenAI, so it always gets a value.
        max_tokens: maxTokens || 1024,
        temperature,
      },
    });

    const text = Array.isArray(json.content)
      ? json.content
          .filter((b) => b?.type === 'text')
          .map((b) => b.text)
          .join('')
      : '';

    return {
      text,
      usage: {
        inputTokens: json.usage?.input_tokens ?? 0,
        outputTokens: json.usage?.output_tokens ?? 0,
      },
      stopReason: normalizeStopReason(json.stop_reason),
      model: json.model || model || anthropic.defaultModel,
    };
  },

  /** Anthropic publishes the account's catalog at /v1/models, newest first. */
  async listModels({ apiKey, baseUrl, timeoutMs }) {
    const url = `${(baseUrl || anthropic.defaultBaseUrl).replace(/\/+$/, '')}/models?limit=100`;
    const json = await getJson(url, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      timeoutMs,
      provider: 'anthropic',
    });
    return (json.data || []).map((m) => m.id);
  },
};

export default anthropic;
