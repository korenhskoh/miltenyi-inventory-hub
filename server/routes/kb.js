/**
 * Knowledge-base administration.
 *
 * Writing is restricted to whoever holds the AI Bot permission: a document here
 * is something the assistant will state as fact to the whole company over
 * WhatsApp, so it carries the same weight as a setting, not as a note.
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/permissions.js';
import { getGlobalConfig } from './config.js';
import logger from '../logger.js';
import { ingestDocument, listDocuments, deleteDocument, embedDocument, searchKb } from '../ai/kb.js';
import { extractText, ACCEPTED_EXTENSIONS } from '../ai/extract.js';
import { pickEmbeddingProvider } from '../ai/embeddings.js';

const router = Router();

// GET / — every document, plus whether semantic search is actually available.
router.get(
  '/',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    const embedder = pickEmbeddingProvider(cfg);
    res.json({
      documents: await listDocuments(),
      accepted: ACCEPTED_EXTENSIONS,
      embedding: embedder ? { provider: embedder.id, model: embedder.model } : null,
    });
  }),
);

// POST / — add a document, from a pasted block or an uploaded file.
router.post(
  '/',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const { title, text, filename, mime, content, encoding } = req.body || {};

    let body = typeof text === 'string' ? text : '';
    if (!body && content) {
      try {
        body = extractText({ filename, mime, content, encoding });
      } catch (e) {
        // The extractor's messages say what to do about it, so they go straight
        // to the person rather than being flattened into "upload failed".
        return res.status(400).json({ error: e.message });
      }
    }
    if (!body.trim()) return res.status(400).json({ error: 'Nothing to index — paste some text or choose a file.' });

    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    try {
      const doc = await ingestDocument({
        title: title || filename || 'Untitled',
        text: body,
        source: filename || 'pasted',
        mime: mime || 'text/plain',
        uploadedBy: req.user.id,
        config: cfg,
      });
      res.status(201).json(doc);
    } catch (e) {
      logger.error({ err: e }, 'Knowledge base ingest failed');
      res.status(400).json({ error: e.message });
    }
  }),
);

// POST /:id/reindex — embed a document that arrived before a key existed.
router.post(
  '/:id/reindex',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    const result = await embedDocument(req.params.id, { config: cfg, uploadedBy: req.user.id });
    res.json(result);
  }),
);

// DELETE /:id — chunks go with it, by foreign key.
router.delete(
  '/:id',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const ok = await deleteDocument(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Document not found' });
    res.json({ deleted: req.params.id });
  }),
);

// GET /search — what the assistant would retrieve, so an admin can see why it
// answered the way it did before blaming the model.
router.get(
  '/search',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'q is required' });
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    const hits = await searchKb(q, { config: cfg, topK: Math.min(parseInt(req.query.topK, 10) || 5, 20) });
    res.json({
      hits: hits.map((h) => ({ ...h, content: h.content.slice(0, 600) })),
    });
  }),
);

export default router;
