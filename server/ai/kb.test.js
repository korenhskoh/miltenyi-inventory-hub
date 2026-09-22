import { describe, it, expect } from 'vitest';
import { chunkText, tokenize, bm25Scores, formatPassages, stem, CHUNK_CHARS } from './kb.js';
import { cosine, pickEmbeddingProvider } from './embeddings.js';
import { extractText } from './extract.js';

const docFrom = (text) => {
  const tokens = tokenize(text);
  const termFreq = new Map();
  for (const t of tokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);
  return { tokens, termFreq };
};

describe('chunking', () => {
  it('leaves a short document as one chunk', () => {
    expect(chunkText('Store between 2 and 8 degrees.')).toEqual(['Store between 2 and 8 degrees.']);
  });

  it('returns nothing for empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('splits a long document and overlaps the chunks', () => {
    const para = 'The MACS separator requires annual calibration by a trained engineer. ';
    const chunks = chunkText(para.repeat(80));
    expect(chunks.length).toBeGreaterThan(1);
    // Overlap exists so a sentence spanning a boundary survives in one piece.
    const tail = chunks[0].slice(-60);
    expect(chunks[1].includes(tail.trim().split(' ').slice(-4).join(' '))).toBe(true);
  });

  it('breaks at a paragraph rather than mid-sentence when it can', () => {
    const text = `${'a'.repeat(900)}\n\n${'b'.repeat(900)}`;
    const chunks = chunkText(text);
    expect(chunks[0].endsWith('a')).toBe(true);
  });

  it('never runs away on a single unbroken block', () => {
    const chunks = chunkText('x'.repeat(CHUNK_CHARS * 5));
    expect(chunks.length).toBeLessThan(10);
    expect(chunks.every((c) => c.length <= CHUNK_CHARS)).toBe(true);
  });
});

describe('stemming', () => {
  it.each([
    ['calibration', 'calibrated', 'calibrate', 'calibrates'],
    ['stored', 'storage', 'store', 'storing'],
    ['shipping', 'shipped', 'ship'],
    ['requirement', 'required', 'require'],
    ['orders', 'order', 'ordered'],
  ])('reduces %s and its variants to one form', (...forms) => {
    // Keyword search is what runs before anyone adds an embedding key, so the
    // word forms have to meet in the middle or the corpus looks empty.
    expect(new Set(forms.map(stem)).size).toBe(1);
  });

  it('leaves identifiers exactly as they are', () => {
    // 130-095-244 means itself; stemming it would merge distinct part numbers.
    expect(stem('130-095-244')).toBe('130-095-244');
    expect(stem('e-42')).toBe('e-42');
  });

  it('leaves short words alone', () => {
    expect(stem('gas')).toBe('gas');
    expect(stem('its')).toBe('its');
  });

  it('finds a document that phrases it differently', () => {
    const docs = [docFrom('The separator must be calibrated annually.'), docFrom('Orders ship on Tuesdays.')];
    const scores = bm25Scores(tokenize('how often is calibration'), docs);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });
});

describe('lexical scoring', () => {
  it('keeps a material number as one searchable token', () => {
    // Splitting on the hyphen would make the most useful token in this domain
    // match every part number that shares a segment.
    expect(tokenize('price for 130-095-244 please')).toContain('130-095-244');
  });

  it('drops filler words', () => {
    expect(tokenize('what is the price of it')).not.toContain('the');
  });

  it('ranks the chunk that actually mentions the term', () => {
    const docs = [
      docFrom('Annual calibration is performed by a service engineer.'),
      docFrom('Store reagent 130-095-244 between 2 and 8 degrees Celsius.'),
      docFrom('Orders are approved by the manager before dispatch.'),
    ];
    const scores = bm25Scores(tokenize('storage temperature for 130-095-244'), docs);
    expect(scores.indexOf(Math.max(...scores))).toBe(1);
  });

  it('scores everything zero when nothing matches', () => {
    const docs = [docFrom('Calibration schedule'), docFrom('Delivery notes')];
    expect(bm25Scores(tokenize('helicopter'), docs).every((s) => s === 0)).toBe(true);
  });

  it('handles an empty corpus', () => {
    expect(bm25Scores(tokenize('anything'), [])).toEqual([]);
  });
});

describe('cosine similarity', () => {
  it('scores an identical vector as 1', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('scores an orthogonal vector as 0', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('refuses to compare vectors of different lengths', () => {
    // Different lengths mean two embedding models are mixed in one table;
    // ranking on that would be noise dressed as relevance.
    expect(cosine([1, 2, 3], [1, 2])).toBe(0);
  });

  it('survives a zero vector without producing NaN', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe('embedding provider selection', () => {
  it('returns nothing when no key can embed', () => {
    expect(pickEmbeddingProvider({ provider: 'anthropic', apiKeys: { anthropic: 'sk-ant' } })).toBeNull();
  });

  it('uses another provider when the chat provider cannot embed', () => {
    // Claude for answers and OpenAI for vectors is a normal setup, not a fault.
    const picked = pickEmbeddingProvider({
      provider: 'anthropic',
      apiKeys: { anthropic: 'sk-ant', openai: 'sk-oa' },
    });
    expect(picked.id).toBe('openai');
  });

  it('prefers the chat provider when it can embed, to keep one bill', () => {
    const picked = pickEmbeddingProvider({ provider: 'gemini', apiKeys: { gemini: 'k', openai: 'k2' } });
    expect(picked.id).toBe('gemini');
  });
});

describe('passage formatting', () => {
  it('numbers passages and names the document', () => {
    const out = formatPassages([{ title: 'Service Manual', ordinal: 2, content: 'Calibrate annually.' }]);
    expect(out).toContain('[1] Service Manual (part 3)');
    expect(out).toContain('Calibrate annually.');
  });

  it('returns nothing when there were no hits', () => {
    expect(formatPassages([])).toBe('');
  });
});

describe('file extraction', () => {
  it('reads plain text', () => {
    expect(extractText({ filename: 'notes.txt', content: 'Hello world' })).toBe('Hello world');
  });

  it('rejects an empty file with a reason', () => {
    expect(() => extractText({ filename: 'notes.txt', content: '   ' })).toThrow(/empty/i);
  });

  it('tells the user what to do about a PDF instead of failing silently', () => {
    expect(() => extractText({ filename: 'manual.pdf', mime: 'application/pdf', content: 'x' })).toThrow(/\.txt/);
  });

  it('refuses a file that is not really text', () => {
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0xff]).toString('base64');
    expect(() => extractText({ filename: 'thing.txt', content: binary, encoding: 'base64' })).toThrow(
      /look like text/i,
    );
  });

  it('enforces the size limit', () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 'a').toString('base64');
    expect(() => extractText({ filename: 'big.txt', content: big, encoding: 'base64' })).toThrow(/5 MB/);
  });
});
