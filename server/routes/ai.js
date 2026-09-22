import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { getGlobalConfig } from './config.js';
import logger from '../logger.js';
import { chat, testConnection, providerCatalog, redactConfig, AiError } from '../ai/index.js';
import { buildSystemPrompt, buildContext, findMaterialNo } from '../ai/assistant.js';
import { handleBotMessage } from '../waBot.js';

const router = Router();

/** Turn an AiError into a message worth showing a person. */
function explain(err) {
  if (!(err instanceof AiError)) return { status: 500, error: 'The assistant is unavailable right now.' };
  const map = {
    config: [400, 'No AI provider is configured yet — add a key in AI Bot settings.'],
    auth: [502, 'The AI provider rejected the API key. Check it in AI Bot settings.'],
    rate_limit: [503, 'The AI provider is rate-limiting us. Try again shortly.'],
    timeout: [504, 'The AI provider did not respond in time.'],
    network: [502, 'Could not reach the AI provider.'],
    server: [502, 'The AI provider had an error. Try again shortly.'],
    bad_request: [400, err.message],
  };
  const [status, message] = map[err.code] || [500, 'The assistant is unavailable right now.'];
  return { status, error: message, code: err.code };
}

// GET /providers — catalog plus the current settings, with every key redacted.
router.get(
  '/providers',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    res.json({ providers: providerCatalog(), config: redactConfig(cfg) });
  }),
);

// POST /test — prove a configured key actually works, before anyone relies on it.
router.post(
  '/test',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const stored = (await getGlobalConfig('aiBotConfig')) || {};
    // A key typed into the form but not yet saved can be tested directly; it is
    // used for this one call and never written anywhere.
    const merged = req.body?.apiKey
      ? { ...stored, apiKeys: { ...(stored.apiKeys || {}), [req.body.provider || stored.provider]: req.body.apiKey } }
      : stored;
    const cfg = { ...merged, ...(req.body?.provider ? { provider: req.body.provider } : {}) };
    try {
      res.json(await testConnection(cfg));
    } catch (err) {
      const { status, error, code } = explain(err);
      logger.warn({ code: err?.code, provider: err?.provider }, 'AI connection test failed');
      res.status(status).json({ ok: false, error, code });
    }
  }),
);

// POST /ask — the shared brain.
//
// The in-app assistant used to carry its OWN regex engine in App.jsx: about
// 137 lines handling price, order status, stock and placing an order, while
// the WhatsApp bot had a separate server-side engine with roughly 20 intents.
// The same question got a different answer depending on where it was asked,
// and every new capability had to be written twice. Both surfaces now go
// through one engine — rules first, model for anything they cannot match.
router.post(
  '/ask',
  requirePermission('dashboard'),
  asyncHandler(async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'message is required' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message is too long' });

    // The engine keys its conversation state by sender. In WhatsApp that is a
    // JID; here it is the account, so each person keeps their own thread and
    // a stateful flow (like confirming an order) belongs to them alone.
    const sessionKey = `app:${req.user.id}`;
    const reply = await handleBotMessage(message, sessionKey, {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name || req.user.username,
      role: req.user.role,
    });
    res.json({ text: reply });
  }),
);

// POST /chat — the in-app assistant. Answer-only by design: the model is given
// live figures and asked to explain them, never to act on them.
router.post(
  '/chat',
  requirePermission('dashboard'),
  asyncHandler(async (req, res) => {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    // Keep the window small: cost is per token and old turns rarely help.
    const trimmed = messages
      .slice(-10)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (trimmed.length === 0) return res.status(400).json({ error: 'No usable messages' });

    const botConfig = (await getGlobalConfig('aiBotConfig')) || {};
    const lastUser = [...trimmed].reverse().find((m) => m.role === 'user');
    const context = await buildContext({ materialNo: findMaterialNo(lastUser?.content) });
    const system = buildSystemPrompt(botConfig, context);

    try {
      const result = await chat({ system, messages: trimmed }, botConfig);
      logger.info(
        { provider: result.provider, usage: result.usage, usedFallback: !!result.usedFallback },
        'AI assistant replied',
      );
      res.json({
        text: result.text,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        usedFallback: !!result.usedFallback,
      });
    } catch (err) {
      const { status, error, code } = explain(err);
      logger.warn({ code: err?.code }, 'AI assistant call failed');
      res.status(status).json({ error, code });
    }
  }),
);

export default router;
