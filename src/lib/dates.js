// Date helpers that respect the user's LOCAL calendar day.
// `new Date().toISOString().slice(0, 10)` is UTC — between 00:00 and 08:00 in
// Singapore it yields *yesterday*, which is wrong for order / arrival dates.

const pad = (n) => String(n).padStart(2, '0');

/** Format a Date (or date-ish value) as local YYYY-MM-DD. Invalid → ''. */
export function toLocalYmd(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Today's date as local YYYY-MM-DD. */
export function todayLocal() {
  return toLocalYmd(new Date());
}

/** Local YYYY-MM-DD `days` from now (negative for the past). */
export function daysFromNowLocal(days) {
  return toLocalYmd(new Date(Date.now() + days * 86400000));
}

/**
 * Normalise any date value (Date, ISO timestamp, 'YYYY-MM-DD', Excel serial)
 * to 'YYYY-MM-DD' for storage. Returns '' when it can't be parsed.
 */
export function normalizeDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return toLocalYmd(v);
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30), interpreted as a calendar day
    const ms = Math.round((v - 25569) * 86400000);
    const dt = new Date(ms);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return toLocalYmd(new Date(s));
}

/** 'Sep 2026' style month label for a date value (local). */
export function monthLabel(v = new Date()) {
  const dt = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
}
