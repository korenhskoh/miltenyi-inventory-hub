// Spreadsheet parsing helpers shared by every upload in the app.
//
// Two things repeatedly broke real-world files:
//   1. Headers were assumed to be on row 1, but the operational workbooks carry
//      a title/date block above them ("... Stock Check" / "Date:" / "Week:"),
//      so the real header row is the third or fourth.
//   2. Header matching was an exact string compare, so "Material No." (with the
//      trailing full stop everyone actually types) never matched "material no".
//
// Everything here is pure so it can be unit tested without a browser.

/** Lowercase, strip trailing punctuation, and collapse separators to one space. */
export function normalizeHeader(h) {
  return String(h ?? '')
    .toLowerCase()
    .replace(/[._:#*]+$/g, '')
    .replace(/[_\-/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Column synonyms, all written in normalised form. */
export const COLUMN_SYNONYMS = {
  materialNo: [
    'material no',
    'material number',
    'materialno',
    'material',
    'mat no',
    'part no',
    'part number',
    'partno',
    'item no',
    'item code',
    'sap code',
    'article no',
  ],
  description: ['description', 'desc', 'material description', 'item description', 'part description', 'item name', 'name'],
  lotsNumber: ['lot no', 'lots number', 'lot number', 'lotno', 'lot', 'batch', 'batch no', 'serial no'],
  category: ['category', 'cat', 'group', 'type'],
  // Absolute stock level (an "import"/"set to this" column)
  quantity: ['quantity', 'qty', 'amount', 'stock', 'on hand', 'stock on hand'],
  // Stock-check movement columns
  chargeIn: ['charge in', 'chargein', 'in', 'qty in', 'quantity in', 'received', 'receive', 'receipt', 'incoming', 'stock in', 'add', 'added', 'arrival'],
  chargeOut: ['charge out', 'chargeout', 'out', 'qty out', 'quantity out', 'issued', 'issue', 'consumed', 'used', 'usage', 'outgoing', 'stock out', 'deduct'],
  // Physically counted closing figure
  countedQty: ['counted', 'counted qty', 'physical', 'physical count', 'actual', 'actual qty', 'balance', 'closing', 'closing balance', 'closing stock', 'count'],
};

const ALL_SYNONYMS = new Set(Object.values(COLUMN_SYNONYMS).flat());

/**
 * Find the row that actually holds the column headers.
 * Scores the first `maxScan` rows by how many cells look like known headers,
 * falling back to the first row with two or more non-empty text cells.
 */
export function detectHeaderRow(aoa, maxScan = 15) {
  let best = { index: 0, score: -1 };
  const limit = Math.min(maxScan, aoa.length);
  for (let i = 0; i < limit; i++) {
    const row = aoa[i] || [];
    let known = 0;
    let filled = 0;
    for (const cell of row) {
      const n = normalizeHeader(cell);
      if (!n) continue;
      filled++;
      if (ALL_SYNONYMS.has(n)) known++;
    }
    // A known header name is worth far more than merely having content.
    const score = known * 10 + Math.min(filled, 8);
    if (known > 0 && score > best.score) best = { index: i, score };
  }
  if (best.score >= 0) return best.index;
  for (let i = 0; i < limit; i++) {
    const filled = (aoa[i] || []).filter((c) => normalizeHeader(c)).length;
    if (filled >= 2) return i;
  }
  return 0;
}

/** Make header labels unique and non-empty so they can key row objects. */
export function makeHeaderLabels(headerRow, width) {
  const labels = [];
  const seen = new Map();
  for (let c = 0; c < width; c++) {
    let label = String(headerRow?.[c] ?? '').trim() || `Column ${c + 1}`;
    if (seen.has(label)) {
      const n = seen.get(label) + 1;
      seen.set(label, n);
      label = `${label} (${n})`;
    } else {
      seen.set(label, 1);
    }
    labels.push(label);
  }
  return labels;
}

/**
 * Turn a sheet (as an array of arrays) into { headers, rows, headerRowIndex },
 * where `rows` are objects keyed by the header labels. Blank rows are dropped.
 */
export function parseSheet(aoa, headerRowIndex) {
  const idx = Number.isInteger(headerRowIndex) ? headerRowIndex : detectHeaderRow(aoa);
  const width = aoa.reduce((m, r) => Math.max(m, (r || []).length), 0);
  const headers = makeHeaderLabels(aoa[idx], width);
  const rows = [];
  for (let r = idx + 1; r < aoa.length; r++) {
    const raw = aoa[r] || [];
    if (!raw.some((c) => String(c ?? '').trim() !== '')) continue;
    const obj = {};
    headers.forEach((h, c) => {
      obj[h] = raw[c] ?? '';
    });
    rows.push(obj);
  }
  return { headers, rows, headerRowIndex: idx };
}

/**
 * Map header labels to field names. `fields` limits which ones to look for.
 * Exact normalised match first, then a contains match, so "Charge Out Qty"
 * still resolves to chargeOut.
 */
export function autoDetectColumns(headers, fields = Object.keys(COLUMN_SYNONYMS)) {
  const map = {};
  const taken = new Set();
  const norm = headers.map(normalizeHeader);

  for (const pass of ['exact', 'contains']) {
    for (const field of fields) {
      if (map[field]) continue;
      for (const syn of COLUMN_SYNONYMS[field] || []) {
        const i = norm.findIndex(
          (h, idx) => !taken.has(idx) && (pass === 'exact' ? h === syn : h.includes(syn) && syn.length >= 3),
        );
        if (i !== -1) {
          map[field] = headers[i];
          taken.add(i);
          break;
        }
      }
    }
  }
  return map;
}

/** Parse a spreadsheet cell into a number; blank/non-numeric become 0. */
export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  // Accept "1,200", "(3)" for negatives, and a stray unit suffix
  const neg = /^\(.*\)$/.test(s);
  const n = parseFloat(s.replace(/[(),\s]/g, '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

/** Was this cell left blank? (distinguishes "no count taken" from "counted 0") */
export function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

/**
 * Parse a cell that must be a real number, or return null.
 *
 * toNumber() returns 0 for anything it cannot parse, which is right for a
 * movement column (no movement = 0) but catastrophic for a physical count:
 * stock sheets conventionally put '-', 'n/a' or 'N.A.' in the count column for
 * rows nobody counted, and reading those as a counted zero sets that item's
 * stock to zero. "Not a number" and "counted nothing" must stay distinct.
 */
export function toNumberOrNull(v) {
  if (isBlank(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  const neg = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[(),\s]/g, '').replace(/[^\d.-]/g, '');
  if (!/\d/.test(cleaned)) return null; // '-', 'n/a', 'N.A.', 'TBC', …
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}
