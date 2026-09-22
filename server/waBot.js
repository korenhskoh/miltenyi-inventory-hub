// WhatsApp Bot — Session Manager & Entry Point
import logger from './logger.js';
import { matchIntent } from './waBotPatterns.js';
import { commandHandlers, stateHandlers, confirmExecutors } from './waBotCommands.js';
import { answerWithModel, HISTORY_LIMIT } from './ai/fallback.js';
import { routeIntent } from './ai/router.js';
import { getGlobalConfig } from './routes/config.js';

const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Session store: jid → session object
const botSessions = new Map();

function getSession(jid) {
  if (!botSessions.has(jid)) {
    botSessions.set(jid, {
      state: 'idle',
      data: {},
      lastActivity: Date.now(),
      page: 0,
      lastResults: null,
      formatFn: null,
      // Recent turns, so a model fallback can answer a follow-up like
      // "and the one before that?" rather than treating every message as new.
      history: [],
    });
  }
  const s = botSessions.get(jid);
  s.lastActivity = Date.now();
  return s;
}

// Sweep expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [jid, s] of botSessions) {
    if (now - s.lastActivity > SESSION_TIMEOUT) {
      botSessions.delete(jid);
    }
  }
}, CLEANUP_INTERVAL);

export async function handleBotMessage(text, jid, user = null) {
  try {
    const session = getSession(jid);
    // The account behind this number, used for permission checks on privileged
    // commands (approve / reject / delete / status change / order creation).
    session.user = user;
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // ── 1. Handle stateful flows first ──

    if (session.state !== 'idle') {
      // Pagination: "more"
      if (session.state === 'paginating' && /^(more|next|continue|\.\.\.)$/i.test(lower)) {
        if (session.lastResults && session.formatFn) {
          const { lastResults, formatFn } = session;
          // paginate is called from waBotCommands via the formatFn reference
          const start = (session.page || 0) * 5;
          const page = lastResults.slice(start, start + 5);
          const hasMore = start + 5 < lastResults.length;

          if (page.length === 0) {
            session.state = 'idle';
            session.lastResults = null;
            return 'No more results.';
          }

          const header = `_Showing ${start + 1}–${start + page.length} of ${lastResults.length}_`;
          const body = page.map(formatFn).join('\n\n');
          const footer = hasMore ? '\n\nReply *more* for next page.' : '';

          if (hasMore) {
            session.page = (session.page || 0) + 1;
          } else {
            session.state = 'idle';
            session.lastResults = null;
            session.page = 0;
            session.formatFn = null;
          }
          return `${header}\n\n${body}${footer}`;
        }
        session.state = 'idle';
        return 'No more results.';
      }

      // Confirm
      if (/^(confirm|yes|y|ok|proceed)$/i.test(lower)) {
        const executor = confirmExecutors[session.state];
        if (executor) return await executor(session);
        session.state = 'idle';
        return 'Nothing pending to confirm. Type *help* for commands.';
      }

      // Cancel
      if (/^(cancel|no|n|abort|stop|exit|quit)$/i.test(lower)) {
        session.state = 'idle';
        session.data = {};
        session.lastResults = null;
        session.page = 0;
        session.formatFn = null;
        return 'Cancelled. Type *help* for commands.';
      }

      // Multi-step input handlers (create_order_material, create_order_qty)
      const stateHandler = stateHandlers[session.state];
      if (stateHandler) return await stateHandler(trimmed, session);

      // If in paginating state but user sends a non-navigation command,
      // reset and fall through to normal intent matching
      session.state = 'idle';
      session.data = {};
      session.lastResults = null;
      session.page = 0;
      session.formatFn = null;
    }

    // ── 2. Parse intent ──

    const { intent, params } = matchIntent(trimmed);

    // Handle confirm/cancel when idle (no pending action)
    if (intent === 'confirm') return 'Nothing pending to confirm. Type *help* for commands.';
    if (intent === 'cancel') return 'Nothing to cancel. Type *help* for commands.';
    if (intent === 'more') return 'No results to paginate. Try *list orders* or *list bulk*.';

    // ── 3. Route to command handler ──

    const handler = commandHandlers[intent];
    if (handler) return await handler(params, session, jid);

    // ── 4. Nothing matched the regexes ──
    //
    // Two chances left, in order of cost and precision. First, ask the model
    // which KNOWN command this was — "any parts still waiting for sign off?"
    // is list_approvals, phrased in a way no regex will ever cover. That runs
    // the real handler, with its real permission check, so the answer is the
    // same one the exact command would have produced.
    const surface = jid.startsWith('app:') ? 'assistant' : 'whatsapp';
    let botConfig = {};
    try {
      botConfig = (await getGlobalConfig('aiBotConfig')) || {};
    } catch (e) {
      logger.warn({ err: e }, 'Could not read AI config for routing');
    }

    const routed = await routeIntent(trimmed, {
      config: botConfig,
      userId: session.user?.id || null,
      sessionKey: jid,
    });

    if (routed) {
      // Anything that changes data is offered, never executed. A routing
      // mistake on a read shows the wrong list; on a delete it destroys an
      // order nobody named.
      if (!routed.safe) {
        return `Did you mean to ${routed.intent.replace(/_/g, ' ')}? Send this to do it:\n\n*${routed.suggestion}*`;
      }
      const routedHandler = commandHandlers[routed.intent];
      if (routedHandler) return await routedHandler(routed.params, session, jid);
    }

    // Second: let the model answer in words. It gets live figures and explains
    // them. It cannot act — every command that changes anything is a rule above
    // this line, with its own permission check. If no provider is configured,
    // or the call fails, answerWithModel returns null and the original reply is
    // used unchanged.
    const aiAnswer = await answerWithModel(trimmed, {
      history: session.history,
      // Who to bill and rate-limit. A WhatsApp sender with no linked account
      // still gets counted globally, just not per-person.
      userId: session.user?.id || null,
      sessionKey: jid,
      surface,
    });
    if (aiAnswer) {
      session.history = [
        ...session.history,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: aiAnswer },
      ].slice(-HISTORY_LIMIT);
      return aiAnswer;
    }

    return commandHandlers.unknown();
  } catch (error) {
    logger.error({ err: error }, 'Bot error');
    return `⚠️ Something went wrong. Please try again.\n\nType *help* for commands.`;
  }
}
