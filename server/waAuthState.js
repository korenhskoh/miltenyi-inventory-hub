import { query } from './db.js';
import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';

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
      [type, id, json]
    );
  };

  const readData = async (type, id) => {
    const result = await query(
      'SELECT value FROM wa_auth WHERE key_type = $1 AND key_id = $2',
      [type, id]
    );
    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0].value, BufferJSON.reviver);
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
          const data = {};
          for (const id of ids) {
            let value = await readData(type, id);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              if (value) {
                await writeData(type, id, value);
              } else {
                await removeData(type, id);
              }
            }
          }
        }
      }
    },
    saveCreds: async () => {
      await writeData('creds', 'main', creds);
    }
  };
}
