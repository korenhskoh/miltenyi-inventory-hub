import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { getGlobalConfig } from './config.js';
import logger from '../logger.js';
import { testConnection, providerCatalog, redactConfig, listModels, AiError } from '../ai/index.js';
import { runChat, checkBudget, spendSnapshot, resolveLimits, DEFAULT_LIMITS } from '../ai/usage.js';
import { pricingCatalog } from '../ai/pricing.js';
import { buildSystemPrompt, buildContext, findMaterialNo } from '../ai/assistant.js';
import { handleBotMessage } from '../waBot.js';
import { query } from '../db.js';
import { APP_TIMEZONE } from '../appDates.js';

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
    // Not an error the user should read as a fault: the cap did what it is for.
    budget: [429, err.message],
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

// GET /models — the provider's own catalog, so the picker is never out of date.
router.get(
  '/models',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    try {
      res.json(await listModels(cfg, req.query.provider));
    } catch (err) {
      // A failed lookup must still leave a usable picker, so the fallback list
      // goes back with a note rather than an error the UI has to handle.
      const { error, code } = explain(err);
      const fallback = providerCatalog().find((p) => p.id === (req.query.provider || cfg.provider));
      logger.warn({ code: err?.code }, 'Could not list provider models');
      res.json({
        provider: fallback?.id || cfg.provider,
        models: fallback?.suggestedModels || [],
        live: false,
        error,
        code,
      });
    }
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
    const context = await buildContext({
      materialNo: findMaterialNo(lastUser?.content),
      question: lastUser?.content || null,
      config: botConfig,
    });
    const system = buildSystemPrompt(botConfig, context);

    try {
      const result = await runChat({
        surface: 'assistant',
        system,
        messages: trimmed,
        config: botConfig,
        userId: req.user.id,
        sessionKey: `app:${req.user.id}`,
      });
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

// ── Cost controls ───────────────────────────────────────────────────────────
//
// A provider key is a payment instrument. These endpoints exist so that what
// it has been spent on is answerable from inside the app, by the people who
// own the bill, rather than only from the provider's own dashboard.

// GET /usage — what the budget screen needs in one call.
router.get(
  '/usage',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    const limits = resolveLimits(cfg);
    const [snapshot, bySurface, byUser] = await Promise.all([
      spendSnapshot(null, APP_TIMEZONE),
      query(
        `SELECT surface,
                COUNT(*)::int AS calls,
                COALESCE(SUM(total_tokens), 0)::int AS tokens,
                COALESCE(SUM(cost_usd), 0)::float AS cost,
                COUNT(*) FILTER (WHERE NOT ok)::int AS failures
         FROM ai_usage
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY surface
         ORDER BY cost DESC`,
      ),
      query(
        `SELECT COALESCE(u.name, a.user_id, 'WhatsApp / unlinked') AS name,
                COUNT(*)::int AS calls,
                COALESCE(SUM(a.cost_usd), 0)::float AS cost
         FROM ai_usage a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1
         ORDER BY cost DESC
         LIMIT 10`,
      ),
    ]);
    res.json({
      limits,
      defaults: DEFAULT_LIMITS,
      timezone: APP_TIMEZONE,
      today: { cost: snapshot.day_cost, calls: snapshot.day_calls },
      month: { cost: snapshot.month_cost },
      bySurface: bySurface.rows,
      byUser: byUser.rows,
    });
  }),
);

// GET /usage/daily — one row per day for the spend chart.
router.get(
  '/usage/daily',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 180);
    const r = await query(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE $1), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS calls,
              COALESCE(SUM(total_tokens), 0)::int AS tokens,
              COALESCE(SUM(cost_usd), 0)::float AS cost
       FROM ai_usage
       WHERE created_at >= NOW() - ($2 || ' days')::interval
       GROUP BY 1
       ORDER BY 1`,
      [APP_TIMEZONE, String(days)],
    );
    res.json({ days: r.rows });
  }),
);

// GET /usage/log — the most recent calls, newest first.
router.get(
  '/usage/log',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const r = await query(
      `SELECT a.id, a.created_at, a.surface, a.provider, a.model, a.prompt_tokens, a.completion_tokens,
              a.total_tokens, a.cost_usd::float AS cost_usd, a.latency_ms, a.ok, a.error_code,
              a.used_fallback, COALESCE(u.name, a.user_id) AS user_name
       FROM ai_usage a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ rows: r.rows });
  }),
);

// GET /pricing — the rate table, defaults merged with any admin override.
router.get(
  '/pricing',
  requirePermission('aiBot'),
  asyncHandler(async (req, res) => {
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    res.json({ pricing: pricingCatalog(cfg.pricing) });
  }),
);

// GET /budget — is there room for one more call right now, and why not.
router.get(
  '/budget',
  requirePermission('dashboard'),
  asyncHandler(async (req, res) => {
    const cfg = (await getGlobalConfig('aiBotConfig')) || {};
    const gate = await checkBudget({ userId: req.user.id, config: cfg });
    res.json({ ok: gate.ok, reason: gate.reason || null, message: gate.message || null });
  }),
);

export default router;
