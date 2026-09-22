/**
 * Semantic intent routing — the model as a better parser, not as a second brain.
 *
 * The regex engine in waBotPatterns.js is exact and free, and it stays first.
 * What it cannot do is cope with how people actually type: "whats the damage on
 * 130-095-244", "any parts still waiting for sign off?", "apa harga untuk…".
 * Those all fell through to the generic "I didn't understand" reply even though
 * the app has a command for each of them.
 *
 * So when the regexes miss, the model is asked one narrow question — WHICH of
 * these known commands did they mean, and with what arguments — and the answer
 * is executed by the existing handler, with the existing permission checks.
 *
 * Two deliberate limits:
 *
 *   1. Only read-only intents are ever dispatched automatically. Anything that
 *      creates, changes, approves or deletes is SUGGESTED as the exact command
 *      to type. A regex misfire shows the wrong list; a routing misfire on
 *      "delete" would destroy an order the person never named.
 *   2. Extracted arguments are re-validated against the same shapes the regexes
 *      require. A model-supplied order id that is not ORD-<digits> is dropped,
 *      not queried.
 */
import logger from '../logger.js';
import { resolveConfig } from './index.js';
import { runChat } from './usage.js';

/**
 * The commands the router may choose between.
 *
 * `safe: true` means the handler only reads. The descriptions are written for
 * the model, so they say what a person would be asking, not what the code does.
 */
export const ROUTABLE_INTENTS = [
  { name: 'help', safe: true, desc: 'asking what the bot can do, or how to use it', params: [] },
  {
    name: 'price_lookup',
    safe: true,
    desc: 'the price or cost of one part, identified by a material number like 130-095-244',
    params: ['materialNo'],
  },
  {
    name: 'order_status',
    safe: true,
    desc: 'the current status or whereabouts of one order, identified like ORD-1042',
    params: ['orderId'],
  },
  {
    name: 'list_orders',
    safe: true,
    desc: 'a list of orders, optionally narrowed by status, month or the engineer who raised them',
    params: ['status', 'month', 'engineer'],
  },
  { name: 'search_orders', safe: true, desc: 'finding orders that match some free text', params: ['query'] },
  {
    name: 'search_catalog',
    safe: true,
    desc: 'finding parts in the catalog by description or keyword, when no material number is given',
    params: ['query'],
  },
  { name: 'list_bulk', safe: true, desc: 'a list of bulk order groups', params: [] },
  {
    name: 'bulk_detail',
    safe: true,
    desc: 'the contents of one bulk group, identified like BLK-7',
    params: ['bulkId'],
  },
  { name: 'list_approvals', safe: true, desc: 'what is waiting for approval', params: [] },
  { name: 'stock', safe: true, desc: 'current stock levels or the latest stock check', params: [] },
  { name: 'stock_history', safe: true, desc: 'past stock checks', params: [] },
  {
    name: 'report_monthly',
    safe: true,
    desc: 'a monthly summary report, optionally for a named month like "Mar 2026"',
    params: ['month'],
  },
  { name: 'report_top_materials', safe: true, desc: 'which parts are ordered most often', params: [] },
  { name: 'report_spending', safe: true, desc: 'how much has been spent in total', params: [] },
  {
    name: 'list_machines',
    safe: true,
    desc: 'the instrument or machine registry, optionally filtered by modality',
    params: ['modality'],
  },

  // Everything below changes data. The router may recognise these, but the bot
  // answers with the command to type rather than running it.
  {
    name: 'create_order',
    safe: false,
    desc: 'placing a new order for a quantity of a part',
    params: ['materialNo', 'qty'],
  },
  { name: 'update_order', safe: false, desc: 'changing the status of an order', params: ['orderId', 'newStatus'] },
  { name: 'delete_order', safe: false, desc: 'deleting an order', params: ['orderId'] },
  { name: 'approve', safe: false, desc: 'approving something that is pending', params: ['approvalId'] },
  { name: 'reject', safe: false, desc: 'rejecting something that is pending', params: ['approvalId'] },
];

const BY_NAME = new Map(ROUTABLE_INTENTS.map((i) => [i.name, i]));

/**
 * Argument shapes, mirroring what the regex intents produce.
 *
 * Anything that does not validate is dropped rather than corrected: a handler
 * receiving no order id asks for one, which is recoverable. A handler receiving
 * a hallucinated one looks up somebody else's order.
 */
const VALIDATORS = {
  materialNo: (v) => (/^\d{3}-\d{3}-\d{3}$/.test(String(v).trim()) ? String(v).trim() : null),
  orderId: (v) => (/^ORD-\d+$/i.test(String(v).trim()) ? String(v).trim().toUpperCase() : null),
  bulkId: (v) => (/^BLK-\d+$/i.test(String(v).trim()) ? String(v).trim().toUpperCase() : null),
  approvalId: (v) => (String(v).trim() ? String(v).trim().toUpperCase() : null),
  qty: (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 && n <= 10000 ? n : null;
  },
  status: (v) =>
    /^(pending|approved|received|ordered|cancelled|rejected)$/i.test(String(v).trim()) ? String(v).trim() : null,
  newStatus: (v) => (String(v).trim() ? String(v).trim() : null),
  month: (v) => (/^[a-z]{3,9}\s+\d{4}$/i.test(String(v).trim()) ? String(v).trim() : null),
  engineer: (v) => (String(v).trim().length <= 60 ? String(v).trim() : null),
  modality: (v) => (String(v).trim().length <= 40 ? String(v).trim() : null),
  query: (v) => {
    const s = String(v).trim();
    return s.length >= 2 && s.length <= 100 ? s : null;
  },
};

function buildSystemPrompt() {
  const list = ROUTABLE_INTENTS.map(
    (i) => `- ${i.name}: ${i.desc}${i.params.length ? ` (arguments: ${i.params.join(', ')})` : ''}`,
  ).join('\n');

  return [
    'You classify one message from a spare-parts inventory system into exactly one known command.',
    '',
    'Commands:',
    list,
    '',
    'Reply with ONLY a JSON object, no prose and no code fence:',
    '{"intent":"<command name or none>","params":{},"confidence":0.0}',
    '',
    'Rules:',
    '- Use "none" when the message is a general question, small talk, or does not map cleanly onto a command. A wrong command is worse than none.',
    '- Copy argument values from the message. Never invent a material number, order id, bulk id or quantity — omit the argument instead.',
    '- A material number looks like 130-095-244. An order id looks like ORD-1042. A bulk id looks like BLK-7.',
    '- confidence is 0 to 1: how sure you are this is the command the person wants.',
    '- Messages may be in English, Malay, Mandarin or a mix.',
  ].join('\n');
}

/** Pull the JSON out of a reply, tolerating a code fence or a stray sentence. */
export function parseRouting(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Keep only arguments this intent accepts, in the shape its handler expects. */
export function sanitizeParams(intentName, params) {
  const intent = BY_NAME.get(intentName);
  if (!intent) return {};
  const out = {};
  for (const key of intent.params) {
    const raw = params?.[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const clean = VALIDATORS[key] ? VALIDATORS[key](raw) : null;
    if (clean !== null) out[key] = clean;
  }
  return out;
}

/** The literal command to type, used when a mutating intent is recognised. */
export function suggestedCommand(intentName, params) {
  switch (intentName) {
    case 'create_order':
      return params.qty && params.materialNo
        ? `order ${params.qty} x ${params.materialNo}`
        : 'order <quantity> x <material number>';
    case 'update_order':
      return params.orderId && params.newStatus
        ? `update ${params.orderId} to ${params.newStatus}`
        : 'update <order id> to <status>';
    case 'delete_order':
      return params.orderId ? `delete ${params.orderId}` : 'delete <order id>';
    case 'approve':
      return params.approvalId ? `approve ${params.approvalId}` : 'approve <id>';
    case 'reject':
      return params.approvalId ? `reject ${params.approvalId}` : 'reject <id>';
    default:
      return null;
  }
}

/**
 * Below this, the answer is a guess. A guess that runs a command is worse than
 * a plain "I didn't understand", because the person then has to work out that
 * the answer on screen is about something they never asked for.
 */
export const MIN_CONFIDENCE = 0.6;

/** Repeated phrasings are common ("stock?" all day) and each one costs money. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map();

const cacheKey = (t) => String(t).trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);

export function clearRoutingCache() {
  cache.clear();
}

function cacheGet(text) {
  const hit = cache.get(cacheKey(text));
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(cacheKey(text));
    return undefined;
  }
  return hit.value;
}

function cacheSet(text, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(cacheKey(text), { at: Date.now(), value });
}

/**
 * Map free text onto a known command.
 *
 * Returns null when routing is off, unavailable, or the model was not sure
 * enough — the caller then does exactly what it did before. Never throws.
 */
export async function routeIntent(text, { config = {}, userId = null, sessionKey = null } = {}) {
  // Off by default: routing spends money on messages that used to cost nothing,
  // so it is something an admin turns on knowingly.
  if (config?.semanticRouting !== true) return null;
  if (!resolveConfig(config).enabled) return null;

  const message = String(text || '').trim();
  // Too short to classify, or long enough that it is prose rather than a command.
  if (message.length < 2 || message.length > 400) return null;

  const cached = cacheGet(message);
  if (cached !== undefined) return cached;

  let parsed;
  try {
    const result = await runChat({
      surface: 'routing',
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: message }],
      // Classification wants the most likely label, not a creative one, and the
      // reply is a few dozen tokens of JSON — so this call is deliberately cheap.
      config: { ...config, temperature: 0, maxTokens: 200 },
      userId,
      sessionKey,
    });
    parsed = parseRouting(result.text);
  } catch (err) {
    // Including a budget refusal: routing is an optimisation, and it must not be
    // the thing that reports a cap. The free-form path handles that.
    logger.warn({ code: err?.code }, 'Semantic routing unavailable');
    return null;
  }

  if (!parsed || typeof parsed.intent !== 'string') return null;
  const name = parsed.intent.trim();
  if (name === 'none' || !BY_NAME.has(name)) {
    cacheSet(message, null);
    return null;
  }

  const confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE) {
    cacheSet(message, null);
    return null;
  }

  const intent = BY_NAME.get(name);
  const params = sanitizeParams(name, parsed.params);
  const routed = {
    intent: name,
    params,
    confidence,
    safe: intent.safe,
    suggestion: intent.safe ? null : suggestedCommand(name, params),
  };
  cacheSet(message, routed);
  logger.info({ intent: name, confidence, safe: intent.safe }, 'Semantic routing matched a command');
  return routed;
}
