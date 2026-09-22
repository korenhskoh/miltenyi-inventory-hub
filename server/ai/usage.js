/**
 * Every model call, priced and written down — and stopped when it costs too much.
 *
 * A provider key is a live payment instrument. Before this, anyone who could
 * reach the bot could spend against it without limit, and the only record of
 * what had been spent lived on the provider's own dashboard. Two things fix
 * that: a row per call, and a cap checked *before* the call rather than after.
 *
 * The caps deliberately fail CLOSED for spend and OPEN for bookkeeping: if the
 * budget query itself fails we let the call through (a database hiccup should
 * not mute the assistant), but a cap that has actually been reached refuses.
 */
import { query } from '../db.js';
import logger from '../logger.js';
import { APP_TIMEZONE } from '../appDates.js';
import { chat, resolveConfig, AiError } from './index.js';
import { costOf } from './pricing.js';

/**
 * Defaults sized for a team of a few dozen asking questions all day, not for a
 * public chatbot. They are low on purpose: a surprise is cheaper to discover at
 * $5 than at $500, and raising a cap is one field in Settings.
 */
export const DEFAULT_LIMITS = {
  dailyCostUsd: 5,
  monthlyCostUsd: 50,
  perUserDailyCostUsd: 1,
  perUserHourlyCalls: 30,
  maxTokensPerCall: 8192,
};

export function resolveLimits(raw = {}) {
  const l = raw?.limits && typeof raw.limits === 'object' ? raw.limits : {};
  const num = (v, fallback) => {
    const n = Number(v);
    // 0 is a legitimate value — it means "no spending at all" — so only an
    // unusable value falls back. Negative is treated as unset, not as credit.
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  };
  return {
    // A cap of null means unlimited, which an admin has to choose explicitly.
    dailyCostUsd: l.dailyCostUsd === null ? null : num(l.dailyCostUsd, DEFAULT_LIMITS.dailyCostUsd),
    monthlyCostUsd: l.monthlyCostUsd === null ? null : num(l.monthlyCostUsd, DEFAULT_LIMITS.monthlyCostUsd),
    perUserDailyCostUsd:
      l.perUserDailyCostUsd === null ? null : num(l.perUserDailyCostUsd, DEFAULT_LIMITS.perUserDailyCostUsd),
    perUserHourlyCalls:
      l.perUserHourlyCalls === null ? null : Math.floor(num(l.perUserHourlyCalls, DEFAULT_LIMITS.perUserHourlyCalls)),
  };
}

/**
 * Spend so far, in one round trip rather than four.
 *
 * The time predicates sit in both a WHERE and the FILTER clauses on purpose.
 * With the filters alone there was nothing to drive an index scan, so this
 * full-scanned ai_usage — a table that grows a row per model call forever —
 * before EVERY call. Left alone it would eventually exceed the statement
 * timeout, and because checkBudget deliberately fails open, the caps would stop
 * being enforced exactly when the log was largest. The WHERE bounds the scan to
 * the current month (or the last hour, whichever reaches further back).
 */
export async function spendSnapshot(userId = null, timeZone = APP_TIMEZONE) {
  const day = `date_trunc('day', NOW() AT TIME ZONE $1) AT TIME ZONE $1`;
  const month = `date_trunc('month', NOW() AT TIME ZONE $1) AT TIME ZONE $1`;
  const sql = `
    SELECT
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= ${day}), 0)::float AS day_cost,
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= ${month}), 0)::float AS month_cost,
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= ${day} AND user_id = $2), 0)::float AS user_day_cost,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour' AND user_id = $2)::int AS user_hour_calls,
      COUNT(*) FILTER (WHERE created_at >= ${day})::int AS day_calls
    FROM ai_usage
    WHERE created_at >= LEAST(${month}, NOW() - INTERVAL '1 hour')`;
  const r = await query(sql, [timeZone, userId]);
  return r.rows[0];
}

const money = (n) => `$${Number(n).toFixed(2)}`;

/**
 * Decide whether this call may happen.
 *
 * Returns `{ ok: true }` or `{ ok: false, reason, message }`. The message is
 * written to be shown to whoever asked — including on WhatsApp — so it says
 * what was hit and when it clears, not "quota exceeded".
 */
export async function checkBudget({ userId = null, config = {}, timeZone = APP_TIMEZONE } = {}) {
  const limits = resolveLimits(config);
  let snap;
  try {
    snap = await spendSnapshot(userId, timeZone);
  } catch (e) {
    // Bookkeeping is down, not the budget. Blocking here would turn a database
    // blip into a total outage of the assistant.
    logger.warn({ err: e }, 'AI budget check unavailable — allowing the call');
    return { ok: true, degraded: true };
  }

  if (limits.monthlyCostUsd !== null && snap.month_cost >= limits.monthlyCostUsd) {
    return {
      ok: false,
      reason: 'monthly_cost',
      message: `The AI budget for this month (${money(limits.monthlyCostUsd)}) is used up. It resets on the 1st, or an admin can raise it in AI Bot settings.`,
    };
  }
  if (limits.dailyCostUsd !== null && snap.day_cost >= limits.dailyCostUsd) {
    return {
      ok: false,
      reason: 'daily_cost',
      message: `Today's AI budget (${money(limits.dailyCostUsd)}) is used up. It resets at midnight, or an admin can raise it in AI Bot settings.`,
    };
  }
  if (userId && limits.perUserDailyCostUsd !== null && snap.user_day_cost >= limits.perUserDailyCostUsd) {
    return {
      ok: false,
      reason: 'user_daily_cost',
      message: `You have used your own AI allowance for today (${money(limits.perUserDailyCostUsd)}). It resets at midnight.`,
    };
  }
  if (userId && limits.perUserHourlyCalls !== null && snap.user_hour_calls >= limits.perUserHourlyCalls) {
    return {
      ok: false,
      reason: 'user_rate',
      message: `That is ${limits.perUserHourlyCalls} AI questions in an hour — the limit. Try again shortly.`,
    };
  }
  return { ok: true, snapshot: snap };
}

/**
 * Write one usage row. Never throws: losing a log line must not lose the reply
 * the user was waiting for.
 */
export async function recordUsage(row) {
  try {
    await query(
      `INSERT INTO ai_usage
         (surface, user_id, session_key, provider, model, prompt_tokens, completion_tokens,
          total_tokens, cost_usd, latency_ms, ok, error_code, used_fallback)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        row.surface,
        row.userId || null,
        row.sessionKey || null,
        row.provider || 'unknown',
        row.model || 'unknown',
        row.inputTokens || 0,
        row.outputTokens || 0,
        (row.inputTokens || 0) + (row.outputTokens || 0),
        row.costUsd || 0,
        row.latencyMs ?? null,
        row.ok !== false,
        row.errorCode || null,
        Boolean(row.usedFallback),
      ],
    );
  } catch (e) {
    logger.warn({ err: e, surface: row?.surface }, 'Could not write the AI usage row');
  }
}

/**
 * The single way the rest of the app talks to a model.
 *
 * Checks the budget, makes the call, prices it and logs it — success or
 * failure. A refused budget throws AiError('budget'), which callers surface as
 * a plain sentence rather than an error.
 */
export async function runChat({ surface, system, messages, config, userId = null, sessionKey = null }) {
  const gate = await checkBudget({ userId, config });
  if (!gate.ok) {
    // Logged with zero cost so the refusal is visible in the usage log too —
    // otherwise a capped day looks identical to a quiet one.
    await recordUsage({
      surface,
      userId,
      sessionKey,
      provider: resolveConfig(config).provider,
      model: resolveConfig(config).model,
      ok: false,
      errorCode: `budget:${gate.reason}`,
    });
    throw new AiError('budget', gate.message);
  }

  const started = Date.now();
  try {
    const result = await chat({ system, messages }, config);
    const { usd } = costOf(
      {
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      },
      config?.pricing,
    );
    await recordUsage({
      surface,
      userId,
      sessionKey,
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      costUsd: usd,
      latencyMs: Date.now() - started,
      ok: true,
      usedFallback: result.usedFallback,
    });
    return { ...result, costUsd: usd };
  } catch (err) {
    const cfg = resolveConfig(config);
    await recordUsage({
      surface,
      userId,
      sessionKey,
      provider: cfg.provider,
      model: cfg.model,
      latencyMs: Date.now() - started,
      ok: false,
      errorCode: err?.code || 'error',
    });
    throw err;
  }
}
