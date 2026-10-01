/**
 * The approval request as an Outlook-ready HTML table.
 *
 * The app already had an HTML builder, but it only ran on the SMTP path. With
 * no company SMTP the send falls back to `mailto:`, and a mailto: URL has no
 * HTML body at all — the protocol carries plain text and nothing else — so what
 * arrived was the pipe-and-dash table. No amount of template work fixes that;
 * the body has to reach Outlook by some other route.
 *
 * So the table is built here, once, and used by both: the SMTP send puts it in
 * the message, and "Copy for Outlook" puts it on the clipboard as text/html so
 * pasting into a new mail produces the real table — from the real company
 * address, under the sender's own Outlook signature.
 *
 * The markup is deliberately plain: a table with inline styles on every cell,
 * no stylesheet, no flexbox, no background images. Outlook renders mail through
 * Word, which ignores most CSS, so anything cleverer survives in the browser
 * preview and falls apart in the inbox.
 */

import { escapeHtml } from '../utils.js';

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `S$${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const qty = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n)) : '';
};

/** The columns, in the order the approver is used to reading them. */
export const APPROVAL_COLUMNS = ['No.', 'Material No.', 'Description', 'Qty', 'Unit Price', 'Total (SGD)'];

/**
 * Normalise an order into the six cells of a row.
 *
 * A missing unit price leaves both price cells blank rather than printing
 * S$0.00, because a part whose price has not been looked up yet is not a part
 * that costs nothing — and the approver is being asked to agree to the figure.
 */
export function approvalRow(order = {}, index = 0) {
  const unit = Number(order.unitPrice);
  const total = Number(order.totalCost);
  const hasUnit = Number.isFinite(unit) && unit > 0;
  const hasTotal = Number.isFinite(total) && total > 0;
  return [
    String(index + 1),
    String(order.materialNo || ''),
    String(order.description || ''),
    qty(order.quantity),
    hasUnit ? money(unit) : '',
    hasTotal ? money(total) : '',
  ];
}

/** The TOTAL line: quantities always add up; costs skip the unpriced rows. */
export function approvalTotals(orders = []) {
  const totalQty = orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const totalCost = orders.reduce((s, o) => {
    const v = Number(o.totalCost);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  const unpriced = orders.filter((o) => !(Number(o.totalCost) > 0)).length;
  return { totalQty, totalCost, unpriced };
}

const TH =
  'border:1px solid #C55A11;background:#ED7D31;color:#000000;' +
  'font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;padding:2px 6px;';
const TD = 'border:1px solid #C55A11;font-family:Calibri,Arial,sans-serif;font-size:11pt;padding:2px 6px;';

const align = (i) => (i === 0 || i === 3 ? 'center' : i >= 4 ? 'right' : 'left');

/**
 * The full mail body.
 *
 * `signature` is for the SMTP path, which has no Outlook signature to fall back
 * on. The clipboard path leaves it out, so the paste lands above whatever
 * signature Outlook adds.
 */
export function buildApprovalEmailHtml(orders = [], { greetingName = '', intro, signature = null } = {}) {
  const rows = orders.map((o, i) => approvalRow(o, i));
  const { totalQty, totalCost, unpriced } = approvalTotals(orders);

  const cell = (v, i, style) => `<td style="${style}text-align:${align(i)};">${escapeHtml(v) || '&nbsp;'}</td>`;

  let html = '<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000000;">';
  if (greetingName) html += `<p style="margin:0 0 12pt;">Hi ${escapeHtml(greetingName)},</p>`;
  html += `<p style="margin:0 0 12pt;">${escapeHtml(intro || 'I would like to get the approval below :')}</p>`;

  html += '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #C55A11;">';
  html +=
    '<tr>' +
    APPROVAL_COLUMNS.map(
      (c, i) => `<th style="${TH}text-align:${i === 2 ? 'center' : align(i)};">${escapeHtml(c)}</th>`,
    ).join('') +
    '</tr>';
  rows.forEach((r) => {
    html += '<tr>' + r.map((v, i) => cell(v, i, TD)).join('') + '</tr>';
  });

  const totalStyle = TD + 'font-weight:bold;';
  html +=
    '<tr>' +
    cell('', 0, totalStyle) +
    cell('', 1, totalStyle) +
    `<td style="${totalStyle}text-align:left;">TOTAL</td>` +
    cell(String(totalQty), 3, totalStyle) +
    cell('', 4, totalStyle) +
    cell(money(totalCost), 5, totalStyle) +
    '</tr>';
  html += '</table>';

  // Say it plainly rather than letting the TOTAL quietly under-report.
  if (unpriced > 0) {
    html += `<p style="margin:12pt 0 0;font-size:10pt;color:#C00000;">Note: ${unpriced} item(s) have no unit price yet, so they are not included in the total.</p>`;
  }

  if (signature) html += `<div style="margin-top:18pt;">${signature}</div>`;
  html += '</div>';
  return html;
}

/**
 * The same thing as plain text, for the text/plain half of the clipboard and
 * for any client that refuses HTML. Pasting into a mail that is in plain-text
 * mode then still gives something readable rather than raw markup.
 */
export function buildApprovalEmailText(orders = [], { greetingName = '', intro } = {}) {
  const rows = orders.map((o, i) => approvalRow(o, i));
  const { totalQty, totalCost } = approvalTotals(orders);
  const all = [APPROVAL_COLUMNS, ...rows, ['', '', 'TOTAL', String(totalQty), '', money(totalCost)]];
  const widths = APPROVAL_COLUMNS.map((_, i) => Math.max(...all.map((r) => String(r[i] ?? '').length)));
  const line = (r) =>
    r
      .map((v, i) => String(v ?? '').padEnd(widths[i]))
      .join('  ')
      .trimEnd();

  const out = [];
  if (greetingName) out.push(`Hi ${greetingName},`, '');
  out.push(intro || 'I would like to get the approval below :', '');
  out.push(line(APPROVAL_COLUMNS));
  out.push(widths.map((w) => '-'.repeat(w)).join('  '));
  rows.forEach((r) => out.push(line(r)));
  out.push(widths.map((w) => '-'.repeat(w)).join('  '));
  out.push(line(['', '', 'TOTAL', String(totalQty), '', money(totalCost)]));
  return out.join('\n');
}
