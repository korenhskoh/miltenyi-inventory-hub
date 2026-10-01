import { describe, it, expect } from 'vitest';
import {
  approvalRow,
  approvalTotals,
  buildApprovalEmailHtml,
  buildApprovalEmailText,
  APPROVAL_COLUMNS,
} from './approvalEmail.js';

const order = (over = {}) => ({
  materialNo: '130-094-683',
  description: 'Sheath Particle Filter, PALL Ultipo',
  quantity: 10,
  unitPrice: 260.83,
  totalCost: 2608.3,
  ...over,
});

describe('approvalRow', () => {
  it('lays the order out in the six columns, numbered from one', () => {
    expect(approvalRow(order(), 0)).toEqual([
      '1',
      '130-094-683',
      'Sheath Particle Filter, PALL Ultipo',
      '10',
      'S$260.83',
      'S$2,608.30',
    ]);
  });

  it('leaves the price cells blank when a part has no price yet', () => {
    // The approver is being asked to agree to a figure; S$0.00 would say this
    // part is free, which is not what an unlooked-up price means.
    const r = approvalRow(order({ unitPrice: 0, totalCost: 0 }), 4);
    expect(r[4]).toBe('');
    expect(r[5]).toBe('');
    expect(r[3]).toBe('10');
  });

  it('survives an order with nothing filled in', () => {
    // Blank, not 0 — the same reason as the price. A quantity nobody entered is
    // not a quantity of none.
    expect(approvalRow({}, 0)).toEqual(['1', '', '', '', '', '']);
  });

  it('groups thousands the way the sheet does', () => {
    expect(approvalRow(order({ totalCost: 15475.45 }), 0)[5]).toBe('S$15,475.45');
  });
});

describe('approvalTotals', () => {
  it('adds the quantities and the costs', () => {
    const t = approvalTotals([order(), order({ quantity: 15, totalCost: 2289.45 })]);
    expect(t).toEqual({ totalQty: 25, totalCost: 4897.75, unpriced: 0 });
  });

  it('counts the rows that have no cost, so the shortfall can be declared', () => {
    const t = approvalTotals([order(), order({ totalCost: 0 })]);
    expect(t.totalQty).toBe(20);
    expect(t.totalCost).toBe(2608.3);
    expect(t.unpriced).toBe(1);
  });

  it('is zero for an empty request', () => {
    expect(approvalTotals([])).toEqual({ totalQty: 0, totalCost: 0, unpriced: 0 });
  });
});

describe('buildApprovalEmailHtml', () => {
  const html = () =>
    buildApprovalEmailHtml([order(), order({ materialNo: '200-075-721', quantity: 15, totalCost: 2289.45 })], {
      greetingName: 'Roy',
    });

  it('opens with the greeting and the request line', () => {
    expect(html()).toContain('Hi Roy,');
    expect(html()).toContain('I would like to get the approval below :');
  });

  it('carries every column heading', () => {
    APPROVAL_COLUMNS.forEach((c) => expect(html()).toContain(`>${c}<`));
  });

  it('ends with a TOTAL row holding the summed quantity and cost', () => {
    const out = html();
    expect(out).toContain('>TOTAL<');
    expect(out).toContain('>25<');
    expect(out).toContain('S$4,897.75');
  });

  it('styles every cell inline, because Outlook renders mail through Word', () => {
    // A stylesheet or a class would survive the browser preview and vanish in
    // the inbox, which is the failure that is hardest to notice.
    const out = html();
    expect(out).not.toContain('<style');
    expect(out).not.toContain('class=');
    expect((out.match(/style="/g) || []).length).toBeGreaterThan(10);
  });

  it('escapes anything a part description brings with it', () => {
    const out = buildApprovalEmailHtml([order({ description: '<img src=x onerror=alert(1)>' })], {});
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('says so when some items are missing a price', () => {
    const out = buildApprovalEmailHtml([order(), order({ unitPrice: 0, totalCost: 0 })], {});
    expect(out).toMatch(/1 item\(s\) have no unit price/);
  });

  it('stays quiet when everything is priced', () => {
    expect(html()).not.toMatch(/no unit price/);
  });

  it('leaves the greeting out when there is no name for it', () => {
    expect(buildApprovalEmailHtml([order()], {})).not.toContain('Hi ');
  });

  it('appends a signature only when one is supplied', () => {
    // The clipboard paste lands above Outlook's own signature, so adding one
    // there would print it twice.
    expect(buildApprovalEmailHtml([order()], {})).not.toContain('<div style="margin-top:18pt;">');
    expect(buildApprovalEmailHtml([order()], { signature: '<b>Fu Siong</b>' })).toContain('<b>Fu Siong</b>');
  });

  it('renders a table even with no rows, rather than broken markup', () => {
    const out = buildApprovalEmailHtml([], {});
    expect(out).toContain('</table>');
    expect(out).toContain('>TOTAL<');
  });
});

describe('buildApprovalEmailText', () => {
  it('lines the columns up so the plain-text paste is still readable', () => {
    const txt = buildApprovalEmailText([order(), order({ materialNo: '200-075-721', quantity: 15 })], {
      greetingName: 'Roy',
    });
    const lines = txt.split('\n');
    expect(lines[0]).toBe('Hi Roy,');
    expect(txt).toContain('Material No.');
    expect(txt).toContain('TOTAL');
    // Every row padded to the same width means the columns actually align.
    const body = lines.filter((l) => l.includes('130-094-683') || l.includes('200-075-721'));
    expect(body).toHaveLength(2);
    expect(body[0].indexOf('S$')).toBe(body[1].indexOf('S$'));
  });

  it('works with no orders at all', () => {
    expect(buildApprovalEmailText([], {})).toContain('TOTAL');
  });
});
