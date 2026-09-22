import { describe, it, expect, vi, beforeEach } from 'vitest';

const cfg = { value: {} };
vi.mock('../routes/config.js', () => ({ getGlobalConfig: vi.fn(async () => cfg.value) }));
vi.mock('./assistant.js', () => ({
  buildSystemPrompt: vi.fn(() => 'SYSTEM'),
  buildContext: vi.fn(async () => 'CONTEXT'),
  findMaterialNo: vi.fn(() => null),
}));
const chatMock = vi.fn();
vi.mock('./index.js', async (orig) => {
  const actual = await orig();
  return { ...actual, chat: chatMock };
});

const { answerWithModel, HISTORY_LIMIT } = await import('./fallback.js');

describe('answerWithModel', () => {
  beforeEach(() => {
    chatMock.mockReset();
    cfg.value = { apiKeys: { openai: 'k' } };
  });

  it('returns the model reply when a provider is configured', async () => {
    chatMock.mockResolvedValue({ text: '  12 units on hand  ', provider: 'openai', usage: {} });
    expect(await answerWithModel('how many pumps?')).toBe('12 units on hand');
  });

  it('stays silent when no key is configured, so the bot behaves exactly as before', async () => {
    cfg.value = {};
    expect(await answerWithModel('anything')).toBe(null);
    expect(chatMock).not.toHaveBeenCalled();
  });

  it('stays silent when explicitly disabled', async () => {
    cfg.value = { enabled: false, apiKeys: { openai: 'k' } };
    expect(await answerWithModel('anything')).toBe(null);
    expect(chatMock).not.toHaveBeenCalled();
  });

  it('never lets a provider failure break the bot', async () => {
    chatMock.mockRejectedValue(Object.assign(new Error('rate limited'), { code: 'rate_limit' }));
    await expect(answerWithModel('x')).resolves.toBe(null);
  });

  it('treats an empty reply as no answer', async () => {
    chatMock.mockResolvedValue({ text: '   ', provider: 'openai', usage: {} });
    expect(await answerWithModel('x')).toBe(null);
  });

  it('survives the config read failing', async () => {
    const { getGlobalConfig } = await import('../routes/config.js');
    getGlobalConfig.mockRejectedValueOnce(new Error('db down'));
    await expect(answerWithModel('x')).resolves.toBe(null);
  });

  it('passes prior turns so a follow-up makes sense', async () => {
    chatMock.mockResolvedValue({ text: 'ok', provider: 'openai', usage: {} });
    const history = [
      { role: 'user', content: 'stock for pumps?' },
      { role: 'assistant', content: '12' },
    ];
    await answerWithModel('and syringes?', { history });
    const sent = chatMock.mock.calls[0][0].messages;
    expect(sent).toHaveLength(3);
    expect(sent[sent.length - 1]).toEqual({ role: 'user', content: 'and syringes?' });
  });

  it('caps how much history it sends, so cost cannot grow without bound', async () => {
    chatMock.mockResolvedValue({ text: 'ok', provider: 'openai', usage: {} });
    const history = Array.from({ length: 40 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    await answerWithModel('latest', { history });
    expect(chatMock.mock.calls[0][0].messages.length).toBe(HISTORY_LIMIT + 1);
  });
});
