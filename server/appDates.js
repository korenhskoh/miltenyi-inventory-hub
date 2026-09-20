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
