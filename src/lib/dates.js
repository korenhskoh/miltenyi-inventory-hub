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
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    // Validate rather than trusting the shape — '2026-13-01' matched the old
    // pattern and was passed to Postgres, which rejected the whole row.
    const [, y, mo, d] = iso.map(Number);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return s.slice(0, 10);
    return '';
  }

  // Excel/CSV sheets are read with raw:false, so a serial date arrives as the
  // string "45000" rather than a number. new Date("45000") reads that as the
  // YEAR 45000; route it through the serial branch instead.
  if (/^\d{1,6}(\.\d+)?$/.test(s)) return normalizeDate(Number(s));

  // Day-first formats. JavaScript reads 03/04/2025 as 4 March (US order), so a
  // Singapore sheet's 3 April silently became a different, earlier date and an
  // unambiguous 15/03/2025 became Invalid Date and was dropped entirely.
  // Parse the parts ourselves rather than handing them to the Date constructor.
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    let [, a, b, y] = dmy;
    let day = Number(a);
    let month = Number(b);
    // Only an out-of-range day proves the sheet was month-first (e.g. 12/31/2025).
    if (day > 12 && month <= 12) {
      // day-first, as written
    } else if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    let year = Number(y);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dt = new Date(year, month - 1, day);
      // Rejects impossible dates like 31/02: the Date rolls over to March.
      if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
        return toLocalYmd(dt);
      }
    }
    return '';
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? '' : toLocalYmd(parsed);
}

/** 'Sep 2026' style month label for a date value (local). */
export function monthLabel(v = new Date()) {
  const dt = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
}
