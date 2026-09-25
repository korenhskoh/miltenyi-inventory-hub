// What the dashboard needs to answer "what needs me today".
//
// Everything here is pure, so the front page's figures can be tested without a
// browser or a database — which matters more here than anywhere else, because
// these numbers are the ones somebody acts on first thing in the morning.
//
// The dashboard used to be four charts of what had already happened, three of
// which Analytics drew as well. Nothing on it said what was waiting: thirteen
// orders could sit unapproved and the only trace was a red 2 in a corner that
// referred to something else entirely.

import { annualPlan, buildSeries, monthKey } from './forecast.js';
import { getEffectiveTotal } from './pricing.js';
import { ORDER_STATUS } from './approvals.js';

const num = (v) => Number(v) || 0;

/** Days between two 'YYYY-MM-DD' dates, or null if either is unusable. */
export function daysBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(`${String(from).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(to).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Parts that should be ordered now.
 *
 * The reorder point is the demand expected over that part's OWN measured lead
 * time plus a buffer — the forecasting page computes it already, but it lived
 * only there, so it was a report you had to remember to open rather than a
 * prompt you were given. Most urgent first, by how little cover is left.
 */
export function reorderNow(consumption, { horizon = 12, limit = 5 } = {}) {
  if (!consumption) return { items: [], count: 0 };
  const stock = new Map((consumption.stock || []).map((r) => [r.material_no, r]));
  const lead = new Map((consumption.leadTimes || []).map((r) => [r.material_no, r]));

  const byMaterial = new Map();
  for (const row of consumption.series || []) {
    if (!byMaterial.has(row.material_no)) byMaterial.set(row.material_no, []);
    byMaterial.get(row.material_no).push({ month: row.month, qty: num(row.qty) });
  }

  const items = [];
  for (const [materialNo, rows] of byMaterial) {
    const stockRow = stock.get(materialNo);
    const plan = annualPlan(buildSeries(rows), {
      stock: num(stockRow?.quantity),
      leadTimeDays: lead.has(materialNo) ? num(lead.get(materialNo).avg_days) : null,
      horizon,
    });
    if (!plan.needsOrder) continue;
    items.push({
      materialNo,
      description: stockRow?.description || '',
      stock: plan.stock,
      perMonth: plan.perMonth,
      monthsCover: plan.monthsCover,
      reorderPoint: plan.reorderPoint,
      leadTimeDays: plan.leadTimeDays,
    });
  }

  // No cover at all is the worst case, so a null sorts first, not last.
  items.sort((a, b) => (a.monthsCover ?? -1) - (b.monthsCover ?? -1));
  return { items: items.slice(0, limit), count: items.length };
}

/** Orders waiting for somebody to approve them, and how long they have waited. */
export function awaitingApproval(orders, catalogLookup, today) {
  const waiting = (orders || []).filter((o) => o.approvalStatus === 'pending' && o.status !== ORDER_STATUS.REJECTED);
  let oldestDays = null;
  let oldestDate = null;
  for (const o of waiting) {
    const d = daysBetween(o.orderDate, today);
    if (d === null) continue;
    if (oldestDays === null || d > oldestDays) {
      oldestDays = d;
      oldestDate = o.orderDate;
    }
  }
  return {
    count: waiting.length,
    value: waiting.reduce((s, o) => s + getEffectiveTotal(o, catalogLookup), 0),
    oldestDays,
    oldestDate,
    items: waiting,
  };
}

/**
 * Approved orders that should have arrived by now and have not.
 *
 * "By now" is that part's own average order-to-arrival time, measured from the
 * orders that did arrive, with a fallback for a part that has never been
 * received before. Nothing in the app flagged a late delivery at all: an order
 * approved in February and never chased looked exactly like one approved
 * yesterday.
 */
export function overdueArrivals(orders, consumption, today, { fallbackDays = 30, limit = 5 } = {}) {
  const lead = new Map((consumption?.leadTimes || []).map((r) => [r.material_no, num(r.avg_days)]));
  const items = [];
  for (const o of orders || []) {
    if (o.approvalStatus !== 'approved') continue;
    if (o.status === ORDER_STATUS.REJECTED) continue;
    if (num(o.quantity) > 0 && num(o.qtyReceived) >= num(o.quantity)) continue;
    const elapsed = daysBetween(o.orderDate, today);
    if (elapsed === null) continue;
    const expected = lead.get(o.materialNo) || fallbackDays;
    if (elapsed <= expected) continue;
    items.push({
      ...o,
      elapsedDays: elapsed,
      expectedDays: expected,
      overdueDays: elapsed - expected,
      measured: lead.has(o.materialNo),
    });
  }
  items.sort((a, b) => b.overdueDays - a.overdueDays);
  return { items: items.slice(0, limit), count: items.length };
}

/** Deliveries that came up short: something arrived, but not everything. */
export function shortDeliveries(orders, { limit = 5 } = {}) {
  const items = (orders || [])
    .filter((o) => o.status !== ORDER_STATUS.REJECTED && num(o.qtyReceived) > 0 && num(o.qtyReceived) < num(o.quantity))
    .map((o) => ({ ...o, missing: num(o.quantity) - num(o.qtyReceived) }));
  items.sort((a, b) => b.missing - a.missing);
  return { items: items.slice(0, limit), count: items.length };
}

/**
 * Spend, split by what it actually means.
 *
 * One combined figure answered nobody's question. What has been spent, what is
 * committed and out for delivery, and what is still only a request are three
 * different numbers with three different consequences.
 */
export function spendSplit(orders, catalogLookup) {
  let received = 0;
  let committed = 0;
  let pending = 0;
  for (const o of orders || []) {
    if (o.status === ORDER_STATUS.REJECTED) continue;
    const value = getEffectiveTotal(o, catalogLookup);
    if (o.status === ORDER_STATUS.RECEIVED) received += value;
    else if (o.approvalStatus === 'approved') committed += value;
    else pending += value;
  }
  return { received, committed, pending, total: received + committed + pending };
}

/**
 * Contracts about to expire and instruments due for service.
 *
 * Both dates are already stored on every machine and read nowhere near the
 * front page — which is a shame, because they are the two things on this page
 * that are genuinely expensive to miss.
 */
export function serviceAlerts(machines, today, { withinDays = 90, limit = 5 } = {}) {
  const expiring = [];
  const dueMaintenance = [];
  for (const m of machines || []) {
    if (m.status === 'Retired' || m.status === 'Inactive') continue;
    const toEnd = daysBetween(today, m.contractEnd || m.contract_end);
    if (toEnd !== null && toEnd <= withinDays) {
      expiring.push({ ...m, daysLeft: toEnd, expired: toEnd < 0 });
    }
    const toService = daysBetween(today, m.nextMaintenanceDate || m.next_maintenance_date);
    if (toService !== null && toService <= withinDays) {
      dueMaintenance.push({ ...m, daysLeft: toService, overdue: toService < 0 });
    }
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);
  dueMaintenance.sort((a, b) => a.daysLeft - b.daysLeft);
  return {
    expiring: expiring.slice(0, limit),
    expiringCount: expiring.length,
    dueMaintenance: dueMaintenance.slice(0, limit),
    dueMaintenanceCount: dueMaintenance.length,
  };
}

/** Stock checks that found a discrepancy and have not been closed out. */
export function stockCheckAlerts(stockChecks, { limit = 5 } = {}) {
  const open = (stockChecks || []).filter((c) => num(c.disc) > 0 && c.status !== 'Resolved');
  open.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return {
    items: open.slice(0, limit),
    count: open.length,
    discrepancies: open.reduce((s, c) => s + num(c.disc), 0),
  };
}

/**
 * Monthly order values with the same month a year earlier beside them.
 *
 * A trend line on its own says very little; against last year it answers a
 * question. Two years of history exist now, so the comparison is free.
 */
export function monthlyWithLastYear(orders, catalogLookup, { months = 12 } = {}) {
  const byMonth = new Map();
  for (const o of orders || []) {
    if (o.status === ORDER_STATUS.REJECTED) continue;
    const key = monthKey(o.orderDate);
    if (!key) continue;
    byMonth.set(key, (byMonth.get(key) || 0) + getEffectiveTotal(o, catalogLookup));
  }
  const keys = [...byMonth.keys()].sort();
  if (keys.length === 0) return [];
  const recent = keys.slice(-months);
  const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return recent.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const priorKey = `${y - 1}-${String(m).padStart(2, '0')}`;
    return {
      month: key,
      name: `${SHORT[m - 1]} '${String(y).slice(-2)}`,
      value: Math.round(byMonth.get(key) || 0),
      lastYear: byMonth.has(priorKey) ? Math.round(byMonth.get(priorKey)) : null,
    };
  });
}
