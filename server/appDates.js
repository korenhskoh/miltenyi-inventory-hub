/**
 * Business-day boundaries for server-side date comparisons.
 *
 * The SPA computes "today" from the browser's local clock, while the server
 * used `new Date().toISOString().slice(0, 10)` — which is UTC. Singapore runs
 * at UTC+8, so between midnight and 08:00 local the server considered it still
 * yesterday: dashboard tiles and the badges in the table below them disagreed
 * for eight hours every morning, and an instrument due today was counted
 * "overdue" by one and not the other.
 *
 * Everything here resolves against one configured business timezone.
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Singapore';

/** 'YYYY-MM-DD' for the given instant in the business timezone. */
export function ymdInTz(date = new Date(), timeZone = APP_TIMEZONE) {
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a plain string.
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    // An invalid APP_TIMEZONE should degrade, not crash the request.
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
}

/** Today in the business timezone. */
export function todayInTz(timeZone = APP_TIMEZONE) {
  return ymdInTz(new Date(), timeZone);
}

/** `days` from now in the business timezone (negative for the past). */
export function daysFromNowInTz(days, timeZone = APP_TIMEZONE) {
  return ymdInTz(new Date(Date.now() + days * 86400000), timeZone);
}

/**
 * The wall-clock parts of an instant, as read in the business timezone.
 * Returns { year, month, day, hour, minute, weekday } with month 1-12 and
 * weekday 0-6 (Sunday = 0), matching Date's getDay().
 */
export function zonedParts(date = new Date(), timeZone = APP_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // 24-hour formatting renders midnight as "24" in some ICU versions.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdays[parts.weekday] ?? 0,
  };
}

/**
 * The instant at which the business timezone's wall clock reads the given
 * calendar date and time. Resolves the zone's offset by guessing UTC, reading
 * back what the zone shows, and correcting — twice, so a DST step between the
 * guess and the answer settles. (Asia/Singapore has no DST, but the scheduler
 * timezone is configurable and may.)
 */
export function instantForZonedTime(year, month, day, hour, minute, timeZone = APP_TIMEZONE) {
  let ts = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 2; i++) {
    const seen = zonedParts(new Date(ts), timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0, 0);
    const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const drift = wantedAsUtc - seenAsUtc;
    if (drift === 0) break;
    ts += drift;
  }
  return ts;
}
