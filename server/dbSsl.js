/**
 * Whether to use TLS for the database connection, and how strictly.
 *
 * This used to be `NODE_ENV === 'production' ? { rejectUnauthorized: false } : false`,
 * which quietly tied two unrelated things together: running in production mode,
 * and talking to a database across the public internet. On a managed host those
 * coincide. On a PostgreSQL installed on the same machine they do not — a local
 * server ships with SSL off and answers the handshake with
 *
 *   The server does not support SSL connections
 *
 * so the app could not boot in production mode against its own database. Turning
 * NODE_ENV down to development to dodge that would also disable the production
 * guards elsewhere (the refusal to seed an admin without ADMIN_PASSWORD, among
 * others), which is the wrong trade entirely.
 *
 * So TLS is now its own setting:
 *
 *   disable    no TLS. Correct for a database on the same machine or a trusted
 *              LAN, where the connection never leaves the building.
 *   no-verify  TLS, but the certificate is not checked. What a managed host with
 *              a self-signed certificate needs, and what the old code always did
 *              in production.
 *   require    TLS with the certificate verified. The right answer for a database
 *              reached across an untrusted network.
 *
 * Unset keeps the previous behaviour exactly, so nothing already deployed
 * changes until its own DATABASE_SSL says so.
 */

export const DATABASE_SSL_MODES = ['disable', 'no-verify', 'require'];

/**
 * @param env  the environment: { DATABASE_SSL, NODE_ENV }
 * @returns the `ssl` option for a pg Pool — `false`, or an options object
 * @throws  on a value that is not a recognised mode, rather than silently
 *          falling back; a typo'd 'disabled' must not turn TLS on by surprise.
 */
export function databaseSsl(env = {}) {
  const raw = String(env.DATABASE_SSL ?? '')
    .trim()
    .toLowerCase();

  if (!raw) {
    // Unchanged from before this setting existed.
    return env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
  }

  switch (raw) {
    case 'disable':
    case 'false':
    case 'off':
      return false;
    case 'no-verify':
      return { rejectUnauthorized: false };
    case 'require':
    case 'true':
    case 'on':
      return { rejectUnauthorized: true };
    default:
      throw new Error(
        `DATABASE_SSL is "${env.DATABASE_SSL}", which is not a mode. Use one of: ${DATABASE_SSL_MODES.join(', ')}.`,
      );
  }
}
