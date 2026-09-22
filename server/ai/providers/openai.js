import { postJson, getJson, normalizeStopReason } from '../types.js';

/**
 * OpenAI, and everything that speaks its API.
 *
 * Azure OpenAI, Groq, OpenRouter, Together, LM Studio and Ollama all expose the
 * same /chat/completions shape, so overriding `baseUrl` points this adapter at
 * any of them without new code. That is why OpenAI is the default: one adapter
 * covers most of the field.
 */
const openai = {
  id: 'openai',
  label: 'OpenAI',
  defaultModel: 'gpt-5.6-luna',
  defaultBaseUrl: 'https://api.openai.com/v1',
  keyHint: 'sk-…',
  keyUrl: 'https://platform.openai.com/api-keys',
  // A fallback list only: the Settings screen asks the provider for its real
  // catalog whenever a key is stored, because a hard-coded list is out of date
  // the week after it is written. Any model id the account can reach may also
  // be typed in.
  suggestedModels: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-6-astra', 'gpt-5.3-codex'],
  // What the knowledge base uses to turn text into vectors. Small is the right
  // default here: the corpus is product documentation, not literature, and the
  // large model costs six times as much for accuracy nobody would notice.
  embeddingModel: 'text-embedding-3-small',

  async chat({ system, messages, model, apiKey, baseUrl, maxTokens, temperature, timeoutMs }) {
    const url = `${(baseUrl || openai.defaultBaseUrl).replace(/\/+$/, '')}/chat/completions`;
    const json = await postJson(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeoutMs,
      provider: 'openai',
      body: {
        model: model || openai.defaultModel,
        // OpenAI carries instructions as a leading message rather than a field.
        messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
        max_tokens: maxTokens,
        temperature,
      },
    });

    const choice = json.choices?.[0];
    return {
      text: choice?.message?.content ?? '',
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
      },
      stopReason: normalizeStopReason(choice?.finish_reason),
      model: json.model || model || openai.defaultModel,
    };
  },

  /** Batch several texts in one request — the API takes an array natively. */
  async embed({ input, model, apiKey, baseUrl, timeoutMs }) {
    const url = `${(baseUrl || openai.defaultBaseUrl).replace(/\/+$/, '')}/embeddings`;
    const json = await postJson(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeoutMs,
      provider: 'openai',
      body: { model: model || openai.embeddingModel, input },
    });
    return {
      // The API may return them out of order; `index` is authoritative.
      vectors: (json.data || []).sort((a, b) => a.index - b.index).map((d) => d.embedding),
      model: json.model || model || openai.embeddingModel,
      usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: 0 },
    };
  },

  /** The account's real catalog. Chat-capable ids only, newest first. */
  async listModels({ apiKey, baseUrl, timeoutMs }) {
    const url = `${(baseUrl || openai.defaultBaseUrl).replace(/\/+$/, '')}/models`;
    const json = await getJson(url, { headers: { Authorization: `Bearer ${apiKey}` }, timeoutMs, provider: 'openai' });
    return (json.data || [])
      .map((m) => m.id)
      .filter(
        (id) => /^(gpt|o\d|chat-)/i.test(id) && !/(embedding|audio|image|tts|whisper|moderation|realtime)/i.test(id),
      )
      .sort();
  },
};

export default openai;
