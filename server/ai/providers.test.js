import { describe, it, expect, vi, beforeEach } from 'vitest';
import openai from './providers/openai.js';
import anthropic from './providers/anthropic.js';
import gemini from './providers/gemini.js';
import { AiError } from './types.js';

// Real provider calls are neither possible nor desirable here. What matters is
// that each adapter shapes the request the way its API demands and reads the
// reply back out of that API's own response shape — those are exactly the
// details that differ between providers and silently break when one changes.
let lastCall;
function mockFetch(status, json) {
  globalThis.fetch = vi.fn(async (url, init) => {
    lastCall = { url, init, body: JSON.parse(init.body) };
    return { ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(json) };
  });
}

const REQ = {
  system: 'You are terse.',
  messages: [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' },
    { role: 'user', content: 'stock?' },
  ],
  apiKey: 'test-key',
  maxTokens: 500,
  temperature: 0.3,
  timeoutMs: 5000,
};

beforeEach(() => {
  lastCall = undefined;
});

describe('openai adapter', () => {
  it('sends the system prompt as a leading message and reads the reply', async () => {
    mockFetch(200, {
      model: 'gpt-4o-mini',
      choices: [{ message: { content: '12 in stock' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 30, completion_tokens: 7 },
    });
    const r = await openai.chat({ ...REQ, model: 'gpt-4o-mini' });

    expect(lastCall.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(lastCall.init.headers.Authorization).toBe('Bearer test-key');
    // OpenAI has no system field: it must be the first message.
    expect(lastCall.body.messages[0]).toEqual({ role: 'system', content: 'You are terse.' });
    expect(lastCall.body.messages).toHaveLength(4);
    expect(r.text).toBe('12 in stock');
    expect(r.usage).toEqual({ inputTokens: 30, outputTokens: 7 });
    expect(r.stopReason).toBe('stop');
  });

  it('honours a baseUrl override, which is how Azure/Groq/Ollama are reached', async () => {
    mockFetch(200, { choices: [{ message: { content: 'x' } }] });
    await openai.chat({ ...REQ, baseUrl: 'http://localhost:11434/v1/' });
    expect(lastCall.url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('omits the system message when there is no system prompt', async () => {
    mockFetch(200, { choices: [{ message: { content: 'x' } }] });
    await openai.chat({ ...REQ, system: '' });
    expect(lastCall.body.messages[0].role).toBe('user');
  });
});

describe('anthropic adapter', () => {
  it('sends system as its own field and flattens content blocks', async () => {
    mockFetch(200, {
      model: 'claude-sonnet-4-5',
      content: [
        { type: 'text', text: '12 in ' },
        { type: 'thinking', text: 'IGNORED' },
        { type: 'text', text: 'stock' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 25, output_tokens: 5 },
    });
    const r = await anthropic.chat({ ...REQ, model: 'claude-sonnet-4-5' });

    expect(lastCall.url).toBe('https://api.anthropic.com/v1/messages');
    expect(lastCall.init.headers['x-api-key']).toBe('test-key');
    // Without the version header the API rejects the call outright.
    expect(lastCall.init.headers['anthropic-version']).toBe('2023-06-01');
    expect(lastCall.body.system).toBe('You are terse.');
    expect(lastCall.body.messages).toHaveLength(3);
    // Only text blocks are the answer.
    expect(r.text).toBe('12 in stock');
    expect(r.usage).toEqual({ inputTokens: 25, outputTokens: 5 });
    expect(r.stopReason).toBe('stop');
  });

  it('always sends max_tokens, which this API requires', async () => {
    mockFetch(200, { content: [{ type: 'text', text: 'x' }] });
    await anthropic.chat({ ...REQ, maxTokens: undefined });
    expect(lastCall.body.max_tokens).toBeGreaterThan(0);
  });

  it('reports a truncated reply as length', async () => {
    mockFetch(200, { content: [{ type: 'text', text: 'x' }], stop_reason: 'max_tokens' });
    expect((await anthropic.chat(REQ)).stopReason).toBe('length');
  });
});

describe('gemini adapter', () => {
  it('puts the model in the URL and maps assistant turns to "model"', async () => {
    mockFetch(200, {
      modelVersion: 'gemini-2.0-flash',
      candidates: [{ content: { parts: [{ text: '12 in stock' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 4 },
    });
    const r = await gemini.chat({ ...REQ, model: 'gemini-2.0-flash' });

    expect(lastCall.url).toContain('/models/gemini-2.0-flash:generateContent');
    // Header, not query string, so the key cannot leak through a logged URL.
    expect(lastCall.init.headers['x-goog-api-key']).toBe('test-key');
    expect(lastCall.url).not.toContain('test-key');
    expect(lastCall.body.systemInstruction.parts[0].text).toBe('You are terse.');
    expect(lastCall.body.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(lastCall.body.generationConfig.maxOutputTokens).toBe(500);
    expect(r.text).toBe('12 in stock');
    expect(r.usage).toEqual({ inputTokens: 20, outputTokens: 4 });
    expect(r.stopReason).toBe('stop');
  });

  it('url-encodes the model id', async () => {
    mockFetch(200, { candidates: [{ content: { parts: [] } }] });
    await gemini.chat({ ...REQ, model: 'models/weird name' });
    expect(lastCall.url).toContain('models%2Fweird%20name');
  });
});

describe('error normalisation', () => {
  const cases = [
    [401, 'auth', false],
    [403, 'auth', false],
    [429, 'rate_limit', true],
    [500, 'server', true],
    [400, 'bad_request', false],
  ];

  for (const [status, code, retryable] of cases) {
    it(`maps HTTP ${status} to ${code}`, async () => {
      mockFetch(status, { error: { message: 'nope' } });
      const err = await openai.chat(REQ).catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.code).toBe(code);
      expect(err.retryable).toBe(retryable);
      expect(err.message).toBe('nope');
    });
  }

  it('reports a timeout rather than hanging', async () => {
    globalThis.fetch = vi.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    const err = await openai.chat({ ...REQ, timeoutMs: 10 }).catch((e) => e);
    expect(err.code).toBe('timeout');
    expect(err.retryable).toBe(true);
  });

  it('reports an unreachable host as a network error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const err = await openai.chat(REQ).catch((e) => e);
    expect(err.code).toBe('network');
  });

  it('survives a non-JSON error body', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => '<html>oops</html>',
    }));
    const err = await openai.chat(REQ).catch((e) => e);
    expect(err.code).toBe('server');
    expect(err.message).toContain('oops');
  });
});
