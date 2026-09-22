import { postJson, normalizeStopReason } from '../types.js';

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
  defaultModel: 'gpt-4o-mini',
  defaultBaseUrl: 'https://api.openai.com/v1',
  keyHint: 'sk-…',
  keyUrl: 'https://platform.openai.com/api-keys',
  // Offered in the UI; any model id the account can reach may be typed in.
  suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],

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
};

export default openai;
