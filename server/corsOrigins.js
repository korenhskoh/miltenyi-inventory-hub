/**
 * Which origins the browser may call this server from.
 *
 * FRONTEND_URL held exactly one URL, which works for a single hosted address
 * and not at all for a server on an office desktop, where the same system is
 * legitimately reached several ways at once:
 *
 *   http://inventory-pc:3001      by computer name on the LAN
 *   http://192.168.1.50:3001      by address, for anything that cannot resolve the name
 *   http://10.8.0.4:3001          over the VPN, from home or a customer site
 *
 * Pinning it to one of those breaks the others, so the setting was simply left
 * unset -- and unset means CORS reflects whatever origin asks, with a SECURITY
 * warning on every boot that everybody learns to ignore. A list costs nothing
 * and lets the local install be locked down properly.
 *
 * Returns what the `cors` package wants for `origin`: a list, or `true` meaning
 * reflect-anything when nothing was configured.
 */
export function corsOrigins(frontendUrl) {
  const raw = String(frontendUrl ?? '').trim();
  if (!raw) return true;

  const origins = raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '')) // a trailing slash never matches an Origin header
    .filter(Boolean);

  return origins.length ? origins : true;
}

/** True when CORS is wide open, so the caller can warn about it. */
export function corsIsOpen(frontendUrl) {
  return corsOrigins(frontendUrl) === true;
}
