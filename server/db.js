import pg from 'pg';
const { Pool, types } = pg;

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects.
// Without this, pg converts DATE to a Date at server-local midnight, which the
// client then receives as an ISO timestamp (e.g. "2026-09-16T16:00:00.000Z")
// that <input type="date"> rejects and that can drift by a day on round-trips.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
});

export default pool;
export const query = (text, params) => pool.query(text, params);

/**
 * Run `fn(client)` inside a real transaction on a single dedicated connection.
 * `pool.query('BEGIN')` followed by `pool.query(...)` does NOT work — each call
 * may land on a different pooled connection, so nothing is actually atomic.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_e) {
      /* ignore rollback failure */
    }
    throw e;
  } finally {
    client.release();
  }
}
