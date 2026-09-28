/**
 * Building the sheet for a stock check.
 *
 * How this is actually used: someone counts the store room physically and
 * records it in a spreadsheet. That file is what gets uploaded. So the quantity
 * column in the upload is the PHYSICAL count, and the figure to measure it
 * against is what the inventory system holds — Local Inventory. The point of
 * the whole exercise is that discrepancy rate, tracked over time.
 *
 * The importer had these the wrong way round: it read the file's quantity into
 * `systemQty` and left the physical count blank to be typed in by hand. So the
 * variance compared the system against itself-as-typed-in-a-file, and Local
 * Inventory — the thing being audited — was never consulted at all. A real run:
 * three parts whose counts exactly matched Local Inventory were reported as two
 * discrepancies out of three, purely because the file's column was stale.
 */

/** Material numbers compare without case or surrounding space. */
const key = (v) =>
  String(v ?? '')
    .trim()
    .toLowerCase();

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Turn the uploaded rows into stock-check items.
 *
 * `rows`      what was counted: { materialNo, description, countedQty }
 * `inventory` Local Inventory rows: { materialNo, quantity }
 *
 * Each item carries:
 *   systemQty   what the system holds right now — the figure being audited
 *   physicalQty the count from the file, still editable before completing
 *   inSystem    false when the part is not in Local Inventory at all, so a
 *               system quantity of 0 reads as "not in the system" rather than
 *               as a silent shortfall
 */
export function buildCountSheet(rows = [], inventory = []) {
  const stock = new Map();
  for (const row of inventory) {
    const k = key(row?.materialNo ?? row?.material_no);
    if (!k) continue;
    // A part may sit under several lot numbers; the check is against the total
    // on hand for that material.
    stock.set(k, (stock.get(k) || 0) + (toInt(row?.quantity) ?? 0));
  }

  return rows
    .map((row, i) => {
      const materialNo = String(row?.materialNo ?? '').trim();
      const k = key(materialNo);
      const inSystem = stock.has(k);
      const counted = toInt(row?.countedQty);
      return {
        id: `INV-${String(i + 1).padStart(3, '0')}`,
        materialNo,
        description: String(row?.description ?? '').trim(),
        systemQty: inSystem ? stock.get(k) : 0,
        inSystem,
        // A file that carried no count leaves the row uncounted rather than
        // recording a zero nobody wrote.
        physicalQty: counted,
        checked: counted !== null,
      };
    })
    .filter((item) => item.materialNo);
}

/**
 * Parts the system holds that the count sheet never mentions.
 *
 * These matter as much as the ones that are off: stock the system thinks it
 * has, which nobody went and looked at, is exactly where a discrepancy hides.
 */
export function missingFromCount(rows = [], inventory = []) {
  const counted = new Set(rows.map((r) => key(r?.materialNo)).filter(Boolean));
  const seen = new Map();
  for (const row of inventory) {
    const k = key(row?.materialNo ?? row?.material_no);
    if (!k || counted.has(k)) continue;
    const qty = toInt(row?.quantity) ?? 0;
    const prev = seen.get(k);
    if (prev) prev.quantity += qty;
    else
      seen.set(k, {
        materialNo: String(row?.materialNo ?? row?.material_no).trim(),
        description: String(row?.description ?? '').trim(),
        quantity: qty,
      });
  }
  return [...seen.values()].filter((r) => r.quantity !== 0);
}

/** Variance for one counted line: physical minus what the system holds. */
export function variance(item) {
  if (!item?.checked || item.physicalQty === null || item.physicalQty === undefined) return null;
  return (toInt(item.physicalQty) ?? 0) - (toInt(item.systemQty) ?? 0);
}

/**
 * Accuracy across a check.
 *
 * `discrepancyRate` is the share of COUNTED lines that did not match, so a
 * half-finished check reports on what was actually counted rather than being
 * diluted by rows nobody reached.
 */
export function discrepancySummary(items = []) {
  const counted = items.filter((i) => i?.checked && i.physicalQty !== null && i.physicalQty !== undefined);
  let matched = 0;
  let over = 0;
  let short = 0;
  let unitsOver = 0;
  let unitsShort = 0;
  for (const i of counted) {
    const v = variance(i);
    if (v === 0) matched++;
    else if (v > 0) {
      over++;
      unitsOver += v;
    } else {
      short++;
      unitsShort += -v;
    }
  }
  const discrepancies = over + short;
  return {
    lines: items.length,
    counted: counted.length,
    matched,
    discrepancies,
    over,
    short,
    unitsOver,
    unitsShort,
    notInSystem: items.filter((i) => i && i.inSystem === false).length,
    discrepancyRate: counted.length ? discrepancies / counted.length : 0,
    accuracyRate: counted.length ? matched / counted.length : 0,
  };
}
