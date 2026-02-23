import * as XLSX from 'xlsx';

// ════════════════════════════ FORMATTERS ═════════════════════════════
export const fmt = (n) =>
  n != null && n !== 0
    ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', minimumFractionDigits: 2 }).format(n)
    : '\u2014';
export const fmtDate = (d) =>
  d && d !== 'None'
    ? new Date(d).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
    : '\u2014';
export const fmtNum = (n) => new Intl.NumberFormat('en-SG').format(n);

// ════════════════════════════ TEMPLATE HELPERS ═════════════════════
/** Replace ALL {field} placeholders in a string with values from a data object */
export const fillTemplate = (template, data) => {
  if (!template) return '';
  let result = template;
  Object.entries(data).forEach(([k, v]) => {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? '');
  });
  return result;
};

// ════════════════════════════ SORT HELPERS ══════════════════════════
export const applySortData = (arr, sortCfg) => {
  if (!sortCfg.key) return arr;
  const sorted = [...arr];
  sorted.sort((a, b) => {
    let va = a[sortCfg.key],
      vb = b[sortCfg.key];
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (typeof va === 'number' && typeof vb === 'number') return sortCfg.dir === 'asc' ? va - vb : vb - va;
    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    return sortCfg.dir === 'asc' ? (va > vb ? 1 : va < vb ? -1 : 0) : va < vb ? 1 : va > vb ? -1 : 0;
  });
  return sorted;
};
export const toggleSort = (setter, key) =>
  setter((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

// ════════════════════════════ EXPORT HELPERS ══════════════════════════
export const exportToFile = (data, columns, filename, format) => {
  const rows = data.map((row) => {
    const obj = {};
    columns.forEach((col) => {
      obj[col.label] = col.fmt ? col.fmt(row[col.key], row) : (row[col.key] ?? '');
    });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${filename}.${format === 'csv' ? 'csv' : 'xlsx'}`, format === 'csv' ? { bookType: 'csv' } : {});
};
export const exportToPDF = (data, columns, title) => {
  const w = window.open('', '_blank');
  if (!w) return;
  const hdr = columns
    .map(
      (c) =>
        `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #0B7A3E;font-size:11px;color:#4A5568;text-transform:uppercase;letter-spacing:.5px">${c.label}</th>`,
    )
    .join('');
  const body = data
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 === 0 ? '#fff' : '#F8FAFB'}">${columns.map((c) => `<td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-size:12px">${c.fmt ? c.fmt(row[c.key], row) : (row[c.key] ?? '\u2014')}</td>`).join('')}</tr>`,
    )
    .join('');
  w.document.write(
    `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:24px;color:#1A202C}@media print{.no-print{display:none}}</style></head><body><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h1 style="font-size:18px;font-weight:700;margin:0;color:#0B7A3E">Miltenyi Inventory Hub</h1><h2 style="font-size:14px;font-weight:500;margin:4px 0 0;color:#64748B">${title}</h2></div><div style="text-align:right;font-size:11px;color:#94A3B8">Exported: ${new Date().toLocaleString('en-SG')}<br/>${data.length} records</div></div><table style="width:100%;border-collapse:collapse"><thead><tr>${hdr}</tr></thead><tbody>${body}</tbody></table><div class="no-print" style="margin-top:20px;text-align:center"><button onclick="window.print()" style="padding:8px 24px;background:#0B7A3E;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer">Print / Save as PDF</button></div></body></html>`,
  );
  w.document.close();
};
