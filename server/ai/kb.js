/**
 * The knowledge base: documents the assistant is allowed to quote.
 *
 * The model already gets live figures from the database. What it could never
 * answer was anything written down rather than recorded — a service procedure,
 * a warranty rule, a storage temperature, "what does error E-42 mean". Those
 * live in PDFs and emails, so the answer was always "check with the team".
 *
 * Retrieval here is hybrid on purpose. Vectors catch meaning ("how cold should
 * I keep it" → a paragraph about 2–8 °C), keywords catch the identifiers that
 * vectors are famously bad at (130-095-244, E-42, ORD-1042). Either alone
 * misses half the questions this system gets asked, and the keyword half keeps
 * working when there is no embedding provider at all.
 */
import { query, withTransaction } from '../db.js';
import logger from '../logger.js';
import { embedTexts, cosine } from './embeddings.js';

/**
 * Chunk size is a trade-off between precision and context. Around 1,200
 * characters is a few paragraphs: big enough that an answer is not cut in half,
 * small enough that a hit is mostly signal.
 */
export const CHUNK_CHARS = 1200;
export const CHUNK_OVERLAP = 150;
export const MAX_CHUNKS_PER_DOC = 400;

/**
 * Split text into overlapping chunks, preferring to break where the author did.
 *
 * The overlap exists because the sentence that answers the question is often
 * the one straddling a boundary; without it that sentence belongs to neither
 * chunk in full.
 */
export function chunkText(text, { size = CHUNK_CHARS, overlap = CHUNK_OVERLAP } = {}) {
  const clean = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_DOC) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      // Prefer a paragraph break, then a sentence end, then a space — but only
      // if one exists in the last third, otherwise a long unbroken block would
      // collapse into tiny chunks.
      const window = clean.slice(start, end);
      const floor = Math.floor(size * 0.6);
      const candidates = [window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n')];
      const cut = candidates.find((c) => c > floor);
      if (cut && cut > 0) end = start + cut;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/** Rough token count, good enough for a size estimate and a cost warning. */
export const estimateTokens = (s) => Math.ceil(String(s || '').length / 4);

// ── Lexical scoring ─────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    'a an the and or but if of to in on for with at by from is are was were be been do does did this that these those ' +
    'it its as not no can could should would will shall may might have has had you your we our they their i me my ' +
    'what which when where who how why please tell show me about'
  ).split(' '),
);

/**
 * Crude suffix stripping, so "calibration" finds "calibrated".
 *
 * Without it, keyword search only matches the exact word form — and keyword
 * search is the DEFAULT, because it is what runs before anyone adds an
 * embedding key. Asking "how often is calibration?" of a document that says
 * "must be calibrated annually" returned nothing at all, which reads as an
 * empty knowledge base rather than a vocabulary mismatch.
 *
 * Deliberately not a full Porter stemmer: this only has to make both sides of
 * a comparison agree, and a short conservative list is easier to reason about
 * than an algorithm nobody on the team will read.
 */
export function stem(token) {
  // Identifiers are never stemmed: 130-095-244 and E-42 mean exactly themselves.
  if (/[\d-]/.test(token)) return token;
  if (token.length <= 4) return token;

  let base = token;
  for (const [suffix, replacement] of [
    ['ational', 'ate'],
    ['ization', 'ize'],
    ['ations', 'ate'],
    ['ation', 'ate'],
    ['ements', 'ement'],
    ['ement', ''],
    ['iness', 'y'],
    ['ness', ''],
    ['ingly', ''],
    ['ies', 'y'],
    ['ing', ''],
    ['edly', ''],
    ['age', ''],
    ['ed', ''],
    ['es', ''],
    ['ly', ''],
    ['s', ''],
  ]) {
    if (base.endsWith(suffix) && base.length - suffix.length >= 3) {
      base = base.slice(0, base.length - suffix.length) + replacement;
      break;
    }
  }

  // The two normalisations that make the forms agree: English doubles the final
  // consonant before -ed/-ing ("shipping"), and the -ate/-ise endings left by
  // the table above still differ from the past tense ("calibrate" vs
  // "calibrat"). Both are settled by trimming, in this order.
  base = base.replace(/([bdfglmnprt])\1$/, '$1');
  if (base.length > 3 && base.endsWith('e')) base = base.slice(0, -1);
  return base;
}

export function tokenize(text) {
  return (
    String(text || '')
      .toLowerCase()
      // Keep digits joined to hyphens so 130-095-244 survives as one token; it is
      // the single most valuable token in this domain.
      .split(/[^a-z0-9-]+/)
      .map((t) => t.replace(/^-+|-+$/g, ''))
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
      .map(stem)
  );
}

/**
 * BM25 over the loaded chunks.
 *
 * Full Postgres text search would also work, but it cannot rank in the same
 * pass as the vectors, and at this corpus size the whole scoring run is a
 * couple of milliseconds in memory.
 */
export function bm25Scores(queryTokens, docs, { k1 = 1.5, b = 0.75 } = {}) {
  const N = docs.length;
  if (N === 0) return [];
  const avgLen = docs.reduce((sum, d) => sum + d.tokens.length, 0) / N || 1;

  const df = new Map();
  for (const term of new Set(queryTokens)) {
    let n = 0;
    for (const d of docs) if (d.termFreq.has(term)) n++;
    df.set(term, n);
  }

  return docs.map((d) => {
    let score = 0;
    for (const term of new Set(queryTokens)) {
      const f = d.termFreq.get(term) || 0;
      if (!f) continue;
      const n = df.get(term) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.tokens.length) / avgLen)));
    }
    return score;
  });
}

// ── Chunk cache ─────────────────────────────────────────────────────────────
//
// Reading every chunk per question would be wasteful, and embeddings are large.
// The corpus changes only when someone uploads or deletes, so it is cached and
// explicitly invalidated rather than given a timeout to guess at.

let chunkCache = null;

export function invalidateKbCache() {
  chunkCache = null;
}

/** A hard ceiling, so one enormous upload cannot exhaust the process memory. */
export const MAX_CACHED_CHUNKS = 5000;

async function loadChunks() {
  if (chunkCache) return chunkCache;
  // Newest documents first.
  //
  // This used to order by doc_id, which is derived from a timestamp — so the
  // LIMIT silently dropped the most RECENTLY uploaded documents once the corpus
  // passed the cap. Someone would add a document, be told it was indexed, and
  // find it never matched anything. Ordering by the document's own date keeps
  // the newest material searchable and drops the oldest instead, which is the
  // right way round; the count is reported so the UI can say so.
  const r = await query(
    `SELECT c.id, c.doc_id, c.ordinal, c.content, c.embedding, c.embedding_dim, d.title
     FROM kb_chunks c
     JOIN kb_documents d ON d.id = c.doc_id
     ORDER BY d.created_at DESC, c.doc_id, c.ordinal
     LIMIT $1`,
    [MAX_CACHED_CHUNKS],
  );
  chunkCache = r.rows.map((row) => {
    const tokens = tokenize(row.content);
    const termFreq = new Map();
    for (const t of tokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);
    return {
      id: row.id,
      docId: row.doc_id,
      ordinal: row.ordinal,
      title: row.title,
      content: row.content,
      embedding: row.embedding || null,
      embeddingDim: row.embedding_dim || (row.embedding ? row.embedding.length : 0),
      tokens,
      termFreq,
    };
  });
  return chunkCache;
}

const normalise = (values) => {
  const max = Math.max(...values, 0);
  return max > 0 ? values.map((v) => v / max) : values.map(() => 0);
};

/**
 * Find the passages most likely to answer a question.
 *
 * `minScore` exists so that a question the corpus has nothing to say about
 * returns nothing, rather than the least-irrelevant paragraph. Feeding a weak
 * match to the model is how a knowledge base starts inventing policy.
 */
export async function searchKb(questionText, { topK = 4, config = {}, minScore = 0.12 } = {}) {
  const text = String(questionText || '').trim();
  if (!text) return [];

  let docs;
  try {
    docs = await loadChunks();
  } catch (e) {
    logger.warn({ err: e }, 'Knowledge base unavailable');
    return [];
  }
  if (docs.length === 0) return [];

  const queryTokens = tokenize(text);
  const lexical = normalise(bm25Scores(queryTokens, docs));

  // Vectors are a bonus, not a requirement: no embedding provider, or a corpus
  // ingested before one was configured, simply means lexical-only ranking.
  let semantic = docs.map(() => 0);
  // Per chunk, not per query: a chunk embedded with a DIFFERENT model has a
  // different vector length, and cosine between the two is meaningless. Before,
  // one re-indexed document was enough to switch the whole query into hybrid
  // mode, and every chunk from the old model then scored 0.65 × 0 — dropping
  // below the floor and vanishing from results with no error anywhere. Those
  // chunks are now simply ranked on words, which is what they can support.
  let comparable = docs.map(() => false);
  if (docs.some((d) => Array.isArray(d.embedding) && d.embedding.length)) {
    const embedded = await embedTexts([text], config);
    if (embedded?.vectors?.[0]) {
      const qv = embedded.vectors[0];
      // Cosine runs -1..1; anything negative is unrelated, so it floors at 0.
      semantic = docs.map((d) => Math.max(0, cosine(qv, d.embedding)));
      comparable = docs.map((d) => Array.isArray(d.embedding) && d.embedding.length === qv.length);
    }
  }

  const scored = docs.map((d, i) => ({
    docId: d.docId,
    title: d.title,
    ordinal: d.ordinal,
    content: d.content,
    score: comparable[i] ? 0.65 * semantic[i] + 0.35 * lexical[i] : lexical[i],
  }));

  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** The retrieved passages, formatted for the DATA section of the prompt. */
export function formatPassages(hits) {
  if (!hits?.length) return '';
  return (
    'Reference documents (quote these, and name the document when you do):\n' +
    hits
      .map((h, i) => `[${i + 1}] ${h.title} (part ${h.ordinal + 1})\n${h.content.replace(/\n{2,}/g, '\n')}`)
      .join('\n\n')
  );
}

// ── Ingestion ───────────────────────────────────────────────────────────────

const newId = () =>
  `KB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/**
 * Store a document, chunk it, and embed it if anything can.
 *
 * Chunks are written first and embeddings added after, so a document is
 * searchable the moment it is uploaded even if the embedding call is slow or
 * fails. Status says which state it reached.
 */
export async function ingestDocument({
  title,
  text,
  source = null,
  mime = 'text/plain',
  uploadedBy = null,
  config = {},
}) {
  const cleanTitle =
    String(title || '')
      .trim()
      .slice(0, 200) || 'Untitled';
  const body = String(text || '').trim();
  if (!body) throw new Error('The document has no text to index.');

  const chunks = chunkText(body);
  if (chunks.length === 0) throw new Error('The document produced no chunks.');

  const id = newId();
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO kb_documents (id, title, source, mime, bytes, chunk_count, status, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,'ready',$7)`,
      [id, cleanTitle, source, mime, Buffer.byteLength(body, 'utf8'), chunks.length, uploadedBy],
    );
    for (let i = 0; i < chunks.length; i++) {
      await client.query(`INSERT INTO kb_chunks (doc_id, ordinal, content, tokens) VALUES ($1,$2,$3,$4)`, [
        id,
        i,
        chunks[i],
        estimateTokens(chunks[i]),
      ]);
    }
  });
  invalidateKbCache();

  const embedded = await embedDocument(id, { config, uploadedBy });
  return { id, title: cleanTitle, chunks: chunks.length, embedded: embedded.embedded, status: embedded.status };
}

/** Add or refresh the vectors for one document. Safe to run repeatedly. */
export async function embedDocument(docId, { config = {}, uploadedBy = null } = {}) {
  const r = await query('SELECT id, ordinal, content FROM kb_chunks WHERE doc_id = $1 ORDER BY ordinal', [docId]);
  if (r.rows.length === 0) return { embedded: false, status: 'ready' };

  const result = await embedTexts(
    r.rows.map((c) => c.content),
    config,
    { userId: uploadedBy },
  );
  if (!result) {
    // Not an error state: lexical search still answers. Saying "error" here
    // would send an admin hunting for a fault that is really just a missing key.
    await query(`UPDATE kb_documents SET status = 'ready', error = NULL, updated_at = NOW() WHERE id = $1`, [docId]);
    invalidateKbCache();
    return { embedded: false, status: 'ready' };
  }

  await withTransaction(async (client) => {
    for (let i = 0; i < r.rows.length; i++) {
      await client.query('UPDATE kb_chunks SET embedding = $1, embedding_dim = $2 WHERE id = $3', [
        result.vectors[i],
        result.dim,
        r.rows[i].id,
      ]);
    }
    await client.query(
      `UPDATE kb_documents SET status = 'embedded', embedding_model = $2, error = NULL, updated_at = NOW()
       WHERE id = $1`,
      [docId, `${result.provider}/${result.model}`],
    );
  });
  invalidateKbCache();
  return { embedded: true, status: 'embedded', model: `${result.provider}/${result.model}` };
}

export async function listDocuments() {
  const r = await query(
    `SELECT d.id, d.title, d.source, d.mime, d.bytes, d.chunk_count, d.status, d.error,
            d.embedding_model, d.created_at, COALESCE(u.name, d.uploaded_by) AS uploaded_by
     FROM kb_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     ORDER BY d.created_at DESC`,
  );
  return r.rows;
}

export async function deleteDocument(id) {
  const r = await query('DELETE FROM kb_documents WHERE id = $1 RETURNING id', [id]);
  invalidateKbCache();
  return r.rowCount > 0;
}
