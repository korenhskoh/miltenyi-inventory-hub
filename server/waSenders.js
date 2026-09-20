/**
 * Resolving which WhatsApp numbers may talk to the bot.
 *
 * Two sources feed one map keyed by phone digits:
 *   1. every active user account that has a phone number, and
 *   2. the Settings "Allowed Senders" list.
 *
 * The allow-list stores usernames (that is what the Settings UI adds), while
 * the map is keyed by digits — so before this module every entry silently
 * missed and the list had no effect at all. Both shapes are accepted here.
 *
 * A value of `null` means "allowed, but bound to no account", which leaves the
 * sender with no permissions and so limited to read-only commands.
 */

/** Normalise a phone number to bare digits, defaulting to the Singapore code. */
export function phoneDigits(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let d = phone.replace(/[\s\-+()]/g, '');
  if (d.length === 8) d = '65' + d;
  return d;
}

const isPhoneLike = (d) => /^\d{7,15}$/.test(d);

/**
 * @param {Array} users      active user rows: { id, username, name, role, phone }
 * @param {Array} allowList  the waAllowedSenders config value
 * @param {Function} [warn]  called with (reason, detail) for anything unusable
 * @returns {Map<string, object|null>} phone digits → account (or null)
 */
export function buildSenderMap(users, allowList, warn = () => {}) {
  const map = new Map();
  const byUsername = new Map();

  for (const u of users || []) {
    if (u?.username) byUsername.set(String(u.username).trim().toLowerCase(), u);
    const d = phoneDigits(u?.phone);
    if (d && isPhoneLike(d)) {
      map.set(d, { id: u.id, username: u.username, name: u.name, role: u.role });
    }
  }

  for (const entry of Array.isArray(allowList) ? allowList : []) {
    const raw = typeof entry === 'string' ? entry : entry?.phone || entry?.username;
    if (!raw) continue;

    const account = byUsername.get(String(raw).trim().toLowerCase());
    if (account) {
      const d = phoneDigits(account.phone);
      if (d && isPhoneLike(d)) {
        map.set(d, { id: account.id, username: account.username, name: account.name, role: account.role });
      } else {
        warn('no_phone', account.username);
      }
      continue;
    }

    const d = phoneDigits(raw);
    if (isPhoneLike(d)) {
      if (!map.has(d)) map.set(d, null);
    } else {
      warn('unresolved', String(raw));
    }
  }

  return map;
}

/** Extract the bare number from a JID, tolerating device suffixes and @lid. */
export function jidDigits(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}
