/**
 * Turns the AI Bot settings plus live data into a grounded prompt.
 *
 * The model is deliberately answer-only: it is given facts and asked to explain
 * them. Creating, approving and changing anything stays with the rule-based
 * intents, which are explicit and permission-checked. So the system prompt's
 * main job is to stop the model inventing figures or promising actions it
 * cannot take.
 */
import { query } from '../db.js';
import logger from '../logger.js';

const TEMPLATES = {
  sales: 'You help the sales team with pricing, availability and order status. Be brief and commercial.',
  support: 'You help service engineers. Be technical and precise about part numbers, specs and maintenance.',
  orders: 'You answer strictly about orders: status, quantities, approvals and deliveries. Stay on topic.',
  custom: '',
};

export function buildSystemPrompt(botConfig = {}, context = '') {
  const template = TEMPLATES[botConfig.template] ?? TEMPLATES.sales;
  const custom = (botConfig.customInstructions || '').trim();

  return [
    'You are the assistant inside Miltenyi Inventory Hub, a spare-part inventory and service system for Singapore.',
    template,
    custom,
    '',
    'Rules you must follow:',
    '- Answer only from the DATA section below and the conversation. If the data does not contain the answer, say so plainly and suggest which page to check.',
    '- Never invent part numbers, prices, quantities, dates or order ids. An approximate figure is worse than no figure here.',
    '- You cannot create, approve, change or delete anything. If asked to, explain the exact command or page that does it.',
    '- Prices are Singapore dollars. Dates are day-month-year.',
    '- Keep replies short: a couple of sentences, or a short list. This is read on a phone.',
    '',
    context ? `DATA (current, read-only):\n${context}` : 'DATA: none available for this question.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A compact digest of live state.
 *
 * Deliberately small: a handful of aggregates and only the rows most likely to
 * be relevant. Sending the whole database would cost a fortune per message, and
 * bury the answer.
 */
export async function buildContext({ materialNo } = {}) {
  const parts = [];
  try {
    const stats = await query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'Pending Approval')::int AS pending,
             COUNT(*) FILTER (WHERE status = 'Received')::int AS received,
             COUNT(*) FILTER (WHERE arrival_date IS NOT NULL
                              AND COALESCE(qty_received,0) < COALESCE(quantity,0)
                              AND COALESCE(status,'') <> 'Rejected')::int AS short_deliveries
      FROM orders`);
    const s = stats.rows[0] || {};
    parts.push(
      `Orders: ${s.total ?? 0} total, ${s.pending ?? 0} awaiting approval, ${s.received ?? 0} received, ${s.short_deliveries ?? 0} delivered short.`,
    );
  } catch (e) {
    logger.warn({ err: e }, 'AI context: order stats unavailable');
  }

  try {
    const inv = await query(
      'SELECT material_no, description, quantity FROM local_inventory ORDER BY quantity ASC LIMIT 10',
    );
    if (inv.rows.length) {
      parts.push(
        'Lowest stock:\n' + inv.rows.map((r) => `  ${r.material_no} ${r.description || ''} — ${r.quantity}`).join('\n'),
      );
    }
  } catch (e) {
    logger.warn({ err: e }, 'AI context: inventory unavailable');
  }

  // When the question named a part, pull its detail specifically.
  if (materialNo) {
    try {
      const p = await query(
        'SELECT material_no, description, sg_price, dist_price, transfer_price FROM parts_catalog WHERE material_no = $1',
        [materialNo],
      );
      if (p.rows.length) {
        const r = p.rows[0];
        parts.push(
          `Catalog ${r.material_no}: ${r.description || ''}; SG ${r.sg_price}, distributor ${r.dist_price}, transfer ${r.transfer_price}.`,
        );
      }
      const stock = await query('SELECT quantity FROM local_inventory WHERE material_no = $1', [materialNo]);
      if (stock.rows.length) parts.push(`On hand for ${materialNo}: ${stock.rows[0].quantity}.`);
    } catch (e) {
      logger.warn({ err: e, materialNo }, 'AI context: material detail unavailable');
    }
  }

  return parts.join('\n');
}

/** Pull a Miltenyi-style material number out of free text, if there is one. */
export function findMaterialNo(text) {
  const m = String(text || '').match(/\b\d{3}-\d{3}-\d{3}\b/);
  return m ? m[0] : null;
}
