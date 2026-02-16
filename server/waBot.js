// WhatsApp Bot — Session Manager & Entry Point
import logger from './logger.js';
import { matchIntent } from './waBotPatterns.js';
import { commandHandlers, stateHandlers, confirmExecutors } from './waBotCommands.js';

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

export async function handleBotMessage(text, jid) {
  try {
    const session = getSession(jid);
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

    return commandHandlers.unknown();
  } catch (error) {
    logger.error({ err: error }, 'Bot error');
    return `⚠️ Something went wrong. Please try again.\n\nType *help* for commands.`;
  }
}
