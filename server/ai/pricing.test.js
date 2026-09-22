import { describe, it, expect } from 'vitest';
import { costOf, rateFor, pricingCatalog, UNKNOWN_RATE } from './pricing.js';

describe('AI pricing', () => {
  it('prices a call from the per-million rates', () => {
    // gemini-3.8-flash is $0.75 in / $3.75 out per million.
    const { usd } = costOf({ provider: 'gemini', model: 'gemini-3.8-flash', inputTokens: 1_000_000, outputTokens: 0 });
    expect(usd).toBe(0.75);
  });

  it('matches a dated model id back to its family', () => {
    // Providers append build dates; pricing must not fall off a cliff for them.
    const dated = rateFor('anthropic', 'claude-haiku-4-5-20251001');
    expect(dated.known).toBe(true);
    expect(dated.rate).toEqual(rateFor('anthropic', 'claude-haiku-4-5').rate);
  });

  it('prefers the longest matching prefix, not the first', () => {
    const lite = rateFor('gemini', 'gemini-3.5-flash-lite');
    expect(lite.rate).toEqual([0.3, 2.5]);
    expect(lite.rate).not.toEqual(rateFor('gemini', 'gemini-3.5-flash').rate);
  });

  it('charges an unknown model at a deliberately high rate, not zero', () => {
    // Free-by-default would let an unpriced model sail past every budget cap.
    const { usd, known } = costOf({ provider: 'openai', model: 'brand-new-thing', inputTokens: 1_000_000 });
    expect(known).toBe(false);
    expect(usd).toBe(UNKNOWN_RATE[0]);
    expect(usd).toBeGreaterThan(0);
  });

  it('lets an admin override a stale published rate', () => {
    const { usd } = costOf(
      { provider: 'openai', model: 'gpt-5.6-luna', inputTokens: 1_000_000 },
      { openai: { 'gpt-5.6-luna': [1, 2] } },
    );
    expect(usd).toBe(1);
  });

  it('marks overridden rates in the catalog', () => {
    const cat = pricingCatalog({ gemini: { 'gemini-3.8-flash': [9, 9] } });
    expect(cat.gemini['gemini-3.8-flash']).toEqual({ input: 9, output: 9, overridden: true });
    expect(cat.openai['gpt-5.6-luna'].overridden).toBe(false);
  });

  it('ignores a malformed override rather than producing NaN costs', () => {
    const { usd, known } = costOf(
      { provider: 'openai', model: 'gpt-5.6-luna', inputTokens: 1000 },
      { openai: { 'gpt-5.6-luna': 'free' } },
    );
    expect(Number.isFinite(usd)).toBe(true);
    expect(known).toBe(false);
  });
});
