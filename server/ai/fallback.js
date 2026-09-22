/**
 * The model as a fallback for messages the rules could not match.
 *
 * Order matters: rules run first because they are instant, free, deterministic
 * and permission-checked, and they are what actually performs actions. The
 * model only ever speaks — it is handed live figures and asked to explain them,
 * so the worst case is a wrong sentence rather than a wrong database row.
 *
 * Returning null means "no answer": the caller then uses its existing
 * rule-based reply. So with no key configured, or the provider down, behaviour
 * is exactly what it was before the model existed.
 */
import logger from '../logger.js';
import { getGlobalConfig } from '../routes/config.js';
import { resolveConfig } from './index.js';
import { runChat } from './usage.js';
import { buildSystemPrompt, buildContext, findMaterialNo } from './assistant.js';

/** How many previous turns to carry. Enough for a follow-up, cheap to send. */
export const HISTORY_LIMIT = 6;

export async function answerWithModel(
  text,
  { history = [], userId = null, sessionKey = null, surface = 'whatsapp' } = {},
) {
  let botConfig;
  try {
    botConfig = (await getGlobalConfig('aiBotConfig')) || {};
  } catch (e) {
    logger.warn({ err: e }, 'AI fallback: could not read config');
    return null;
  }

  const cfg = resolveConfig(botConfig);
  // No key, or explicitly switched off: stay rule-only and say nothing.
  if (!cfg.enabled) return null;

  try {
    const context = await buildContext({ materialNo: findMaterialNo(text), question: text, config: botConfig });
    const system = buildSystemPrompt(botConfig, context);
    const messages = [...history.slice(-HISTORY_LIMIT), { role: 'user', content: text }];
    const result = await runChat({ surface, system, messages, config: botConfig, userId, sessionKey });
    const answer = (result.text || '').trim();
    if (!answer) return null;
    logger.info(
      { provider: result.provider, usage: result.usage, usedFallback: !!result.usedFallback },
      'AI answered an unmatched message',
    );
    return answer;
  } catch (err) {
    // A spending cap is not a failure — it is the answer. Saying so beats
    // pretending the question was not understood, which is what returning null
    // would look like from the other end.
    if (err?.code === 'budget') return err.message;
    // A model failure must never take down a working rule-based bot.
    logger.warn({ code: err?.code, message: err?.message }, 'AI fallback unavailable — using the rule-based reply');
    return null;
  }
}
