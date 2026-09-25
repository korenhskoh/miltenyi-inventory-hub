/**
 * Event-driven notifications, evaluated on the server.
 *
 * These rules (waNotifyRules) used to live entirely in the SPA: every trigger
 * fired from App.jsx or DeliveryPage.jsx, which meant a notification only went
 * out if a human happened to have the app open and clicked the button. The same
 * action taken through the WhatsApp bot, through the API, or by a scheduled job
 * sent nothing at all — and the rules themselves were business logic sitting in
 * the client where nothing could enforce them.
 *
 * Anything here is best-effort: a notification that cannot be delivered must
 * never fail the operation that triggered it.
 */
import { query } from './db.js';
import logger from './logger.js';
import { getGlobalConfig } from './routes/config.js';
import { messageTemplates } from './messageTemplates.js';

// Supplied by the server at startup: { sock, formatPhoneNumber, sendText }
let getWaContext = () => ({});
export function setWaContext(fn) {
  getWaContext = typeof fn === 'function' ? fn : () => ({});
}

/** Fill {placeholders} from a flat data object. */
export function fillTemplate(text, data) {
  if (!text) return '';
  return String(text).replace(/\{(\w+)\}/g, (_m, key) => (data[key] === undefined ? '' : String(data[key])));
}

/**
 * Is this rule switched on? Unknown keys are OFF, so a typo silently sends
 * nothing rather than messaging everyone.
 */
export async function isRuleEnabled(ruleKey) {
  try {
    const rules = (await getGlobalConfig('waNotifyRules')) || {};
    return rules[ruleKey] === true;
  } catch (e) {
    logger.error({ err: e, ruleKey }, 'Could not read waNotifyRules');
    return false;
  }
}

/** Active users with a phone number on file. */
async function waRecipients() {
  const r = await query("SELECT name, phone FROM users WHERE status = 'active' AND phone IS NOT NULL AND phone <> ''");
  return r.rows;
}

/**
 * The one person a rule names, when it names one.
 *
 * "Notify requester" was sending to every active user with a phone. On a busy
 * goods-in day that is one message per delivered line to the whole team, which
 * is how a useful notification becomes one everybody mutes — and it is not what
 * the rule says it does.
 *
 * Matched on display name, which is what orders.order_by stores. If the person
 * has no phone on file, or no account, the rule falls back to the team so the
 * message is not simply lost, and says which happened.
 */
async function waRecipientByName(name) {
  const wanted = String(name || '').trim();
  if (!wanted) return { rows: [], reason: 'no-name' };
  const r = await query(
    `SELECT name, phone FROM users
      WHERE status = 'active' AND phone IS NOT NULL AND phone <> ''
        AND LOWER(TRIM(name)) = LOWER($1)`,
    [wanted],
  );
  return { rows: r.rows, reason: r.rows.length ? 'matched' : 'no-phone' };
}

async function logNotification(type, to, subject, status) {
  try {
    await query(
      'INSERT INTO notif_log (id, type, recipient, subject, date, status) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)',
      [`N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, to, subject, status],
    );
  } catch (e) {
    logger.error({ err: e }, 'Could not write notif_log entry');
  }
}

/**
 * Send the WhatsApp notification for an event, if its rule is on.
 *
 * @param {string} ruleKey      key in waNotifyRules
 * @param {object} data         placeholder values for the template
 * @param {object} [opts]
 * @param {string} [opts.templateKey]  key in waMessageTemplates / messageTemplates
 * @param {string} [opts.subject]      what to record in notif_log
 */
export async function notifyEvent(ruleKey, data, { templateKey = ruleKey, subject, to = null } = {}) {
  try {
    if (!(await isRuleEnabled(ruleKey))) return { sent: 0, skipped: 'rule-off' };

    const { sendText, formatPhoneNumber } = getWaContext();
    if (!sendText || !formatPhoneNumber) return { sent: 0, skipped: 'whatsapp-not-connected' };

    // The editable template from Settings wins; the built-in is the fallback so
    // a rule still sends something when nobody has customised it.
    // The Settings screen edits templates under its own names, which are not
    // the names the senders look up: "Part Arrival Verified" is stored as
    // `partArrival` but sent as `partArrivalDone`, and back orders as
    // `backOrder` vs `backOrderUpdate`. So an admin's edits saved fine and were
    // silently ignored, and the hard-coded default went out instead.
    const TEMPLATE_ALIASES = { partArrivalDone: 'partArrival', backOrderUpdate: 'backOrder' };
    const custom = (await getGlobalConfig('waMessageTemplates')) || {};
    const customBody = (custom[templateKey] || custom[TEMPLATE_ALIASES[templateKey]])?.message;
    const message = customBody
      ? fillTemplate(customBody, data)
      : typeof messageTemplates[templateKey] === 'function'
        ? messageTemplates[templateKey](data)
        : '';
    if (!message.trim()) return { sent: 0, skipped: 'no-template' };

    // `to` names one person; without it, or when that person cannot be reached,
    // the message goes to the team as before.
    let recipients;
    let audience;
    if (to) {
      const targeted = await waRecipientByName(to);
      if (targeted.rows.length) {
        recipients = targeted.rows;
        audience = to;
      } else {
        recipients = await waRecipients();
        audience = `${recipients.length} user(s) — ${to} has no phone on file`;
        logger.warn({ ruleKey, to }, 'Named recipient unreachable, notified the team instead');
      }
    } else {
      recipients = await waRecipients();
      audience = `${recipients.length} user(s)`;
    }
    if (recipients.length === 0) return { sent: 0, skipped: 'no-recipients' };

    let sent = 0;
    for (const u of recipients) {
      try {
        await sendText(formatPhoneNumber(u.phone), message);
        sent++;
      } catch (e) {
        logger.warn({ err: e, phone: u.phone, ruleKey }, 'Event notification not delivered to one recipient');
      }
    }

    await logNotification(
      'whatsapp',
      audience,
      subject || `Auto-notification: ${ruleKey}`,
      sent === recipients.length ? 'Delivered' : sent > 0 ? 'Partial' : 'Failed',
    );
    logger.info({ ruleKey, sent, of: recipients.length }, 'Event notification sent');
    return { sent, of: recipients.length };
  } catch (e) {
    // Never let a notification failure break the operation that triggered it.
    logger.error({ err: e, ruleKey }, 'Event notification failed');
    return { sent: 0, error: e.message };
  }
}
