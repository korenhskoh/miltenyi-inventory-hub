// Telling somebody a part is about to run out, at the moment it happens.
//
// "Low stock alert → Supervisor" has been a switch in the WhatsApp panel since
// the beginning with nothing behind it: no code read the rule, no template
// existed, and no event ever fired. It stayed switched off by default, so the
// only harm was a false sense of coverage — but it is also the rule most worth
// having, because running out of a part stops an engineer's job.
//
// The moment to raise it is a charge-out, which is the only thing that makes
// stock fall. The threshold is the reorder point the forecasting engine already
// computes: expected demand over that part's OWN measured order-to-arrival time,
// plus a buffer. Below that line, ordering today still leaves a gap.

import { query } from './db.js';
import { notifyEvent } from './notify.js';
import { APP_TIMEZONE } from './appDates.js';
import { annualPlan, buildSeries } from '../src/lib/forecast.js';
import logger from './logger.js';

/**
 * The reorder point for one material, from its own history.
 *
 * Deliberately one material at a time: this runs on a charge-out, which touches
 * a handful of lines, and the alternative — recomputing every part in the
 * catalogue on every movement — would cost far more than it saves.
 */
export async function reorderPointFor(materialNo, months = 36) {
  const [series, lead] = await Promise.all([
    query(
      `SELECT to_char(date_trunc('month', created_at AT TIME ZONE $3), 'YYYY-MM') AS month,
              SUM(-quantity_change)::int AS qty
         FROM inventory_transactions
        WHERE type = 'charge_out'
          AND material_no = $1
          AND created_at >= date_trunc('month', NOW()) - ($2 || ' months')::interval
        GROUP BY 1
       HAVING SUM(-quantity_change) > 0
        ORDER BY 1`,
      [materialNo, String(months), APP_TIMEZONE],
    ),
    query(
      `SELECT ROUND(AVG(arrival_date - order_date))::int AS avg_days
         FROM orders
        WHERE material_no = $1
          AND order_date IS NOT NULL
          AND arrival_date IS NOT NULL
          AND arrival_date >= order_date`,
      [materialNo],
    ),
  ]);

  if (series.rows.length === 0) return null; // never consumed — nothing to predict from
  const plan = annualPlan(buildSeries(series.rows.map((r) => ({ month: r.month, qty: r.qty }))), {
    stock: 0, // the caller supplies the real figure; only the threshold is wanted here
    leadTimeDays: lead.rows[0]?.avg_days ?? null,
    horizon: 12,
  });
  return {
    reorderPoint: plan.reorderPoint,
    perMonth: plan.perMonth,
    leadTimeDays: plan.leadTimeDays,
    demandMonths: plan.demandMonths,
  };
}

/**
 * After a charge-out, warn about anything that has fallen to its reorder point.
 *
 * Returns what it decided, so the caller can log it and the tests can read it.
 * Never throws: an alert must not be able to fail the movement that triggered it.
 */
export async function checkLowStock(rows, { notify = notifyEvent } = {}) {
  const results = [];
  for (const row of rows || []) {
    const materialNo = row.materialNo || row.material_no;
    const quantity = Number(row.quantity) || 0;
    if (!materialNo) continue;
    try {
      const point = await reorderPointFor(materialNo);
      // No measured lead time means no honest threshold; a part with two months
      // of history is not evidence either. Silence beats a guess that trains
      // people to ignore the alert.
      if (!point || point.reorderPoint === null || point.demandMonths < 2) {
        results.push({ materialNo, skipped: 'not-enough-history' });
        continue;
      }
      if (quantity > point.reorderPoint) {
        results.push({ materialNo, ok: true, quantity, reorderPoint: point.reorderPoint });
        continue;
      }
      const monthsCover = point.perMonth > 0 ? quantity / point.perMonth : 0;
      const sent = await notify(
        'lowStockAlert',
        {
          materialNo,
          description: row.description || '',
          quantity,
          reorderPoint: point.reorderPoint,
          perMonth: point.perMonth.toFixed(1),
          monthsCover: monthsCover.toFixed(1),
          leadTimeDays: point.leadTimeDays,
          date: new Date().toISOString().slice(0, 10),
        },
        { subject: `Low stock: ${materialNo}`, audienceRole: 'admin' },
      );
      results.push({ materialNo, alerted: true, quantity, reorderPoint: point.reorderPoint, sent });
    } catch (e) {
      logger.warn({ err: e, materialNo }, 'Low-stock check failed for one material');
      results.push({ materialNo, error: e.message });
    }
  }
  return results;
}
