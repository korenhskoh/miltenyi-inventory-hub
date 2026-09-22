import { postJson, normalizeStopReason } from '../types.js';

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
  defaultModel: 'gemini-2.0-flash',
  defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  keyHint: 'AIza…',
  keyUrl: 'https://aistudio.google.com/app/apikey',
  suggestedModels: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],

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
};

export default gemini;
