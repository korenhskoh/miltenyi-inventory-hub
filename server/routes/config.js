import { Router } from 'express';
import { query } from '../db.js';
import logger from '../logger.js';
import { userHasPermission, isActiveAdmin } from '../middleware/permissions.js';

const router = Router();

// Keys that are shared app-wide (not per-user). Everything the scheduler, the
// public logo endpoint, the WhatsApp bot and the email sender read from
// user_id = '__global__' MUST be listed here, otherwise Settings writes a
// per-user row that those server components never see.
const GLOBAL_KEYS = new Set([
  'aiBotConfig',
  'waAutoReply',
  'scheduledNotifs',
  'emailConfig',
  'emailTemplates',
  'customLogo',
  'priceConfig',
  'waNotifyRules',
  'waAllowedSenders',
  'waMessageTemplates',
]);
export const CONFIG_GLOBAL_KEYS = GLOBAL_KEYS;

// Which permission may READ each global key.
//
// These are operational settings — SMTP host and sender, approver addresses,
// the WhatsApp allow-list, schedules — and every authenticated account could
// read all of them. They are now scoped to the screen that owns them, so the
// people who work with a setting still see it and nobody else does.
//
// Note that `notifications` and `whatsapp` are ON by default for every account
// (see DEFAULT_USER_PERMS), so they are not a meaningful gate on their own. The
// keys holding infrastructure detail or personal data — mail server, recipient
// lists, the WhatsApp number allow-list — are therefore `settings` only. The
// template and rule keys stay visible to whoever works that screen, since they
// are content rather than credentials.
//
// The two keys not listed here, priceConfig and customLogo, stay readable by
// everyone: prices and branding are rendered on pages every user has.
const READ_PERMISSIONS = {
  emailConfig: ['settings'],
  scheduledNotifs: ['settings'],
  waAllowedSenders: ['settings'],
  emailTemplates: ['settings', 'notifications'],
  waNotifyRules: ['settings', 'whatsapp'],
  waMessageTemplates: ['settings', 'whatsapp'],
  waAutoReply: ['settings', 'whatsapp'],
  aiBotConfig: ['settings', 'aiBot'],
};

async function canReadKey(user, key) {
  const needed = READ_PERMISSIONS[key];
  if (!needed) return true;
  for (const perm of needed) {
    if (await userHasPermission(user, perm)) return true;
  }
  return false;
}

// Secrets inside config values that must never be returned to a client.
// (The server uses the stored values itself — see /api/send-email and the AI
// provider layer.)
const SECRET_PATHS = {
  emailConfig: ['smtpPass'],
  aiBotConfig: ['apiKey'],
};

// Secrets that are write-only for EVERYONE, admins included. A provider API key
// has no reason to travel to a browser: the server is what calls the provider.
// Previously these came back in full to any admin, putting a live credential in
// the page for no purpose. `apiKeys` is the per-provider map.
const WRITE_ONLY_PATHS = {
  aiBotConfig: ['apiKey', 'apiKeys'],
};

// Keys whose value is written by more than one screen, each sending only the
// fields it owns. A plain replace meant whichever saved last wiped the other's
// settings: the AI Bot page has a provider/model form AND a separate
// template/greeting form, both writing aiBotConfig, so saving the greeting
// silently reset the provider, model, base URL and generation settings.
const MERGE_KEYS = new Set(['aiBotConfig']);

function stripSecrets(key, value, isAdmin) {
  if (!value || typeof value !== 'object') return value;
  let copy = value;

  const writeOnly = WRITE_ONLY_PATHS[key];
  if (writeOnly) {
    copy = { ...copy };
    for (const p of writeOnly) {
      if (p in copy) delete copy[p];
    }
    // Say WHICH providers have a key stored, without revealing any of them, so
    // the settings UI can show "key set" without ever holding the value.
    const keys = value.apiKeys && typeof value.apiKeys === 'object' ? value.apiKeys : {};
    copy.hasKey = Object.fromEntries(
      [...new Set([...Object.keys(keys), ...(value.apiKey ? [value.provider || 'openai'] : [])])].map((id) => [
        id,
        Boolean(keys[id] || (id === (value.provider || 'openai') && value.apiKey)),
      ]),
    );
  }

  if (isAdmin || !SECRET_PATHS[key]) return copy;
  copy = { ...copy };
  for (const p of SECRET_PATHS[key]) {
    if (p in copy) copy[p] = '';
  }
  return copy;
}

// Post-save hooks keyed by config key — registered by the server at startup
const postSaveHooks = {};
export function registerConfigHook(key, fn) {
  postSaveHooks[key] = fn;
}

function effectiveUserId(key, reqUser) {
  return GLOBAL_KEYS.has(key) ? '__global__' : reqUser.id;
}

/** Read a global config value directly (used by other server modules). */
export async function getGlobalConfig(key) {
  const r = await query("SELECT value FROM app_config WHERE key = $1 AND user_id = '__global__'", [key]);
  return r.rows.length ? r.rows[0].value : null;
}

// GET / - list all config entries as { [key]: value } object
// Global keys always come from '__global__'; other keys prefer the per-user row.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const globalKeys = [...GLOBAL_KEYS];
    const result = await query(
      `SELECT DISTINCT ON (key) key, value
       FROM app_config
       WHERE user_id = '__global__' OR (user_id = $1 AND NOT (key = ANY($2::text[])))
       ORDER BY key, CASE WHEN user_id = $1 THEN 0 ELSE 1 END`,
      [userId, globalKeys],
    );
    // From the DATABASE, not the token's role claim. A token lives 24 hours, so
    // trusting the claim handed a just-demoted admin the stored SMTP password
    // for the rest of the day.
    const isAdmin = await isActiveAdmin(req.user);
    const configObj = {};
    for (const row of result.rows) {
      if (!(await canReadKey(req.user, row.key))) continue;
      configObj[row.key] = stripSecrets(row.key, row.value, isAdmin);
    }
    res.json(configObj);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:key - get single config entry value
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!(await canReadKey(req.user, key))) {
      return res.status(403).json({ error: `Permission required to read ${key}` });
    }

    const userId = effectiveUserId(key, req.user);
    const isAdmin = await isActiveAdmin(req.user);
    const result = await query('SELECT * FROM app_config WHERE key = $1 AND user_id = $2', [key, userId]);

    // Fallback to global if per-user not found
    if (result.rows.length === 0 && userId !== '__global__') {
      const fallback = await query("SELECT * FROM app_config WHERE key = $1 AND user_id = '__global__'", [key]);
      if (fallback.rows.length === 0) {
        return res.status(404).json({ error: 'Config key not found' });
      }
      return res.json(stripSecrets(key, fallback.rows[0].value, isAdmin));
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Config key not found' });
    }

    res.json(stripSecrets(key, result.rows[0].value, isAdmin));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:key - upsert config entry (per-user or global)
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    let { value } = req.body;

    // A body with no value used to store SQL NULL and answer 200 — a client bug
    // or a retry that lost its body silently wiped the SMTP settings.
    if (value === undefined) {
      return res.status(400).json({ error: 'A value is required.' });
    }

    // Global keys: admins, or users granted the Settings (or AI Bot) permission
    if (GLOBAL_KEYS.has(key)) {
      const ok =
        (await userHasPermission(req.user, 'settings')) ||
        (key === 'aiBotConfig' && (await userHasPermission(req.user, 'aiBot')));
      if (!ok) return res.status(403).json({ error: 'Settings permission required for global settings' });
    }

    const userId = effectiveUserId(key, req.user);

    // If a client sends back a blanked-out secret, keep the stored one.
    if ((SECRET_PATHS[key] || WRITE_ONLY_PATHS[key]) && value && typeof value === 'object') {
      const current = await query('SELECT value FROM app_config WHERE key = $1 AND user_id = $2', [key, userId]);
      const stored = current.rows[0]?.value || {};
      value = { ...value };
      for (const p of SECRET_PATHS[key] || []) {
        if ((value[p] === '' || value[p] === undefined) && stored[p]) value[p] = stored[p];
      }
      // Write-only fields are never sent back to the client, so an update will
      // always arrive without them. Carry the stored values forward, merging
      // per provider so saving a key for one does not wipe the others.
      if (WRITE_ONLY_PATHS[key]) {
        if (value.apiKey === undefined && stored.apiKey) value.apiKey = stored.apiKey;
        const incoming = value.apiKeys && typeof value.apiKeys === 'object' ? value.apiKeys : {};
        const existing = stored.apiKeys && typeof stored.apiKeys === 'object' ? stored.apiKeys : {};
        const merged = { ...existing };
        for (const [id, k] of Object.entries(incoming)) {
          // An empty string means "leave it alone", not "delete it".
          if (typeof k === 'string' && k.trim()) merged[id] = k.trim();
        }
        if (Object.keys(merged).length) value.apiKeys = merged;
        // hasKey is a read-side hint; never store it.
        delete value.hasKey;
      }
    }

    // Shallow-merge onto what is stored, so a partial save keeps the fields it
    // did not send. Only for keys that several screens co-own.
    if (MERGE_KEYS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      const current = await query('SELECT value FROM app_config WHERE key = $1 AND user_id = $2', [key, userId]);
      const stored = current.rows[0]?.value;
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        value = { ...stored, ...value };
      }
    }

    const sql = `
      INSERT INTO app_config (key, user_id, value, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key, user_id) DO UPDATE SET value = $3, updated_at = NOW()
      RETURNING *
    `;
    const result = await query(sql, [key, userId, JSON.stringify(value)]);

    // Fire post-save hook if registered (e.g. reload scheduler, reset SMTP transporter)
    if (postSaveHooks[key]) {
      try {
        await postSaveHooks[key](value);
      } catch (hookErr) {
        logger.error({ err: hookErr, key }, `Config post-save hook failed for key: ${key}`);
      }
    }

    // Echo back with the caller's own visibility — hard-coding isAdmin=true here
    // leaked the stored smtpPass / apiKey to any non-admin allowed to save settings.
    res.json({
      key: result.rows[0].key,
      value: stripSecrets(key, result.rows[0].value, await isActiveAdmin(req.user)),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
