import { query } from './db.js';
import { initAuthCreds, BufferJSON, proto } from 'baileys';

/**
 * PostgreSQL-backed auth state for Baileys WhatsApp.
 * Replaces useMultiFileAuthState so sessions survive Railway redeploys.
 */
export async function usePostgresAuthState() {
  const writeData = async (type, id, value) => {
    const json = JSON.stringify(value, BufferJSON.replacer);
    await query(
      `INSERT INTO wa_auth (key_type, key_id, value) VALUES ($1, $2, $3)
       ON CONFLICT (key_type, key_id) DO UPDATE SET value = $3`,
      [type, id, json],
    );
  };

  const readData = async (type, id) => {
    const result = await query('SELECT value FROM wa_auth WHERE key_type = $1 AND key_id = $2', [type, id]);
    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0].value, BufferJSON.reviver);
  };

  // Read a whole set of keys in one round trip. Baileys asks for pre-keys and
  // sender keys in batches of dozens; doing those one query at a time made
  // every decrypt wait on a serial chain of round trips to Postgres.
  const readMany = async (type, ids) => {
    if (!ids.length) return {};
    const result = await query('SELECT key_id, value FROM wa_auth WHERE key_type = $1 AND key_id = ANY($2::text[])', [
      type,
      ids,
    ]);
    const out = {};
    for (const row of result.rows) {
      out[row.key_id] = JSON.parse(row.value, BufferJSON.reviver);
    }
    return out;
  };

  const removeData = async (type, id) => {
    await query('DELETE FROM wa_auth WHERE key_type = $1 AND key_id = $2', [type, id]);
  };

  // Load existing creds or create new ones
  let creds = await readData('creds', 'main');
  if (!creds) {
    creds = initAuthCreds();
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const found = await readMany(type, ids);
          const data = {};
          for (const id of ids) {
            let value = found[id];
            if (value === undefined) continue; // Baileys expects absent, not null
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              tasks.push(value ? writeData(type, id, value) : removeData(type, id));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', 'main', creds);
    },
  };
}
