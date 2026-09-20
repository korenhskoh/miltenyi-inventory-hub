import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed, sanitizeDates } from '../validation.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();

const MACHINE_FIELDS = [
  'name',
  'modality',
  'location',
  'install_date',
  'status',
  'notes',
  'serial_number',
  'customer_name',
  'customer_contact',
  'customer_email',
  'maintenance_period_months',
  'last_maintenance_date',
  'next_maintenance_date',
  'contract_start',
  'contract_end',
  'contract_type',
  'remark',
  'model',
  // Region split + overseas-specific
  'region',
  'country',
  'delivery_date',
  'warranty_start',
  'warranty_end',
  'pm_spare_part',
  'sap_code',
  'proposed_service_contract',
  'price',
  'iqoq',
  'iqoq_date',
  'iqoq_price',
];

const MACHINE_DATE_FIELDS = [
  'install_date',
  'last_maintenance_date',
  'next_maintenance_date',
  'contract_start',
  'contract_end',
  'delivery_date',
  'warranty_start',
  'warranty_end',
  'iqoq_date',
];
const MACHINE_NUMERIC_FIELDS = ['price', 'iqoq_price', 'maintenance_period_months'];

// '' is invalid for DATE/NUMERIC columns; on update it means "clear the value".
function normalizeMachine(b, { update = false } = {}) {
  sanitizeDates(b, MACHINE_DATE_FIELDS, { nullOnEmpty: update });
  for (const f of MACHINE_NUMERIC_FIELDS) {
    if (!(f in b)) continue;
    if (b[f] === '' || b[f] === undefined) {
      if (update) b[f] = null;
      else delete b[f];
    }
  }
  return b;
}

const VALID_REGIONS = new Set(['local', 'overseas']);
function normalizeRegion(r) {
  return VALID_REGIONS.has(r) ? r : 'local';
}

// GET /summary — dashboard counts (optionally scoped by region)
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const params = [today, in30];
    let regionClause = '';
    if (req.query.region && VALID_REGIONS.has(req.query.region)) {
      params.push(req.query.region);
      regionClause = ` WHERE region = $${params.length}`;
    }

    const r = await query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE next_maintenance_date IS NOT NULL AND next_maintenance_date <= $2 AND next_maintenance_date >= $1) AS upcoming_maintenance,
        COUNT(*) FILTER (WHERE next_maintenance_date IS NOT NULL AND next_maintenance_date < $1) AS overdue_maintenance,
        COUNT(*) FILTER (WHERE contract_end IS NOT NULL AND contract_end >= $1) AS active_contracts,
        COUNT(*) FILTER (WHERE contract_end IS NOT NULL AND contract_end BETWEEN $1 AND $2) AS expiring_contracts,
        COUNT(*) FILTER (WHERE contract_end IS NOT NULL AND contract_end < $1) AS expired_contracts
      FROM machines${regionClause}
    `,
      params,
    );

    res.json({
      total: parseInt(r.rows[0].total),
      upcomingMaintenance: parseInt(r.rows[0].upcoming_maintenance),
      overdueMaintenance: parseInt(r.rows[0].overdue_maintenance),
      activeContracts: parseInt(r.rows[0].active_contracts),
      expiringContracts: parseInt(r.rows[0].expiring_contracts),
      expiredContracts: parseInt(r.rows[0].expired_contracts),
    });
  }),
);

// GET / — list all machines with optional filters
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { modality, customer, contractStatus, maintenanceDue, search, region } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const conditions = [];
    const params = [];
    let pi = 1;
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    if (region && VALID_REGIONS.has(region)) {
      conditions.push(`region = $${pi++}`);
      params.push(region);
    }
    if (modality) {
      conditions.push(`modality = $${pi++}`);
      params.push(modality);
    }
    if (customer) {
      conditions.push(`customer_name ILIKE $${pi++}`);
      params.push(`%${customer}%`);
    }
    if (search) {
      conditions.push(
        `(serial_number ILIKE $${pi} OR customer_name ILIKE $${pi} OR name ILIKE $${pi} OR modality ILIKE $${pi})`,
      );
      params.push(`%${search}%`);
      pi++;
    }
    if (contractStatus === 'Active') {
      conditions.push(`contract_end >= $${pi++}`);
      params.push(today);
    } else if (contractStatus === 'Expiring') {
      conditions.push(`contract_end BETWEEN $${pi++} AND $${pi++}`);
      params.push(today, in30);
    } else if (contractStatus === 'Expired') {
      conditions.push(`contract_end < $${pi++}`);
      params.push(today);
    }
    if (maintenanceDue === 'Overdue') {
      conditions.push(`next_maintenance_date < $${pi++}`);
      params.push(today);
    } else if (maintenanceDue === 'Due') {
      conditions.push(`next_maintenance_date BETWEEN $${pi++} AND $${pi++}`);
      params.push(today, in30);
    } else if (maintenanceDue === 'OK') {
      conditions.push(`(next_maintenance_date IS NULL OR next_maintenance_date > $${pi++})`);
      params.push(in30);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM machines${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    // Opt-in: return all rows without pagination. The registry needs every
    // instrument to filter/search client-side; 50-row pages silently drop data.
    const returnAll = req.query.all === 'true' || req.query.all === '1';
    let dataResult;
    if (returnAll) {
      dataResult = await query(`SELECT * FROM machines${where} ORDER BY id DESC`, params);
    } else {
      dataResult = await query(`SELECT * FROM machines${where} ORDER BY id DESC LIMIT $${pi++} OFFSET $${pi++}`, [
        ...params,
        pageSize,
        offset,
      ]);
    }
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, returnAll ? 1 : page, returnAll ? rows.length : pageSize));
  }),
);

// POST /bulk — bulk import machines.
// Every row is inserted (sparse / unnamed rows get synthesised placeholders)
// so the DB ends up with exactly what the user sent, not a validated subset.
router.post(
  '/bulk',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { machines } = req.body;
    if (!Array.isArray(machines) || machines.length === 0)
      return res.status(400).json({ error: 'machines array required' });

    const inserted = [];
    const errors = [];

    for (const [idx, machine] of machines.entries()) {
      try {
        const b = normalizeMachine(pickAllowed(camelToSnake(machine), MACHINE_FIELDS));
        // Fill in defaults so no row is rejected just because of missing fields.
        if (!b.name) b.name = b.serial_number ? String(b.serial_number) : `Imported row ${idx + 1}`;
        if (!b.modality) b.modality = 'Unknown';
        b.region = normalizeRegion(b.region);
        const keys = Object.keys(b);
        const vals = Object.values(b);
        const ph = keys.map((_, i) => `$${i + 1}`);
        const sql = `INSERT INTO machines (${keys.join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`;
        const result = await query(sql, vals);
        inserted.push(snakeToCamel(result.rows[0]));
      } catch (e) {
        errors.push({ row: idx + 1, error: e.message });
        logger.warn({ row: idx + 1, err: e.message }, 'Bulk machine import: row failed');
      }
    }

    logger.info(
      { requested: machines.length, inserted: inserted.length, failed: errors.length },
      'Bulk machine import complete',
    );
    res.status(201).json({ inserted: inserted.length, errors, machines: inserted });
  }),
);

// DELETE /all — wipe the instrument registry (admin only, region-scoped)
router.delete(
  '/all',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { region } = req.query;
    if (region && !VALID_REGIONS.has(region)) {
      return res.status(400).json({ error: 'Invalid region' });
    }
    let result;
    if (region) {
      result = await query('DELETE FROM machines WHERE region = $1 RETURNING id', [region]);
    } else {
      result = await query('DELETE FROM machines RETURNING id');
    }
    res.json({ success: true, deleted: result.rowCount });
  }),
);

// POST / — add single machine
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = normalizeMachine(pickAllowed(camelToSnake(req.body), MACHINE_FIELDS));
    b.region = normalizeRegion(b.region);
    if (!b.name) b.name = b.serial_number || 'Unnamed';
    // modality is required for local instruments; overseas instruments may omit it
    if (!b.modality) {
      if (b.region === 'local') return res.status(400).json({ error: 'modality required' });
      b.modality = 'Unknown';
    }
    const keys = Object.keys(b);
    const vals = Object.values(b);
    const ph = keys.map((_, i) => `$${i + 1}`);
    const sql = `INSERT INTO machines (${keys.join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`;
    const result = await query(sql, vals);
    res.status(201).json(snakeToCamel(result.rows[0]));
  }),
);

// PUT /:id — update machine
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const b = normalizeMachine(pickAllowed(camelToSnake(req.body), MACHINE_FIELDS, { keepNull: true }), {
      update: true,
    });
    if ('region' in b) b.region = normalizeRegion(b.region);
    b.updated_at = new Date().toISOString();
    const keys = Object.keys(b);
    const vals = Object.values(b);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const sql = `UPDATE machines SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await query(sql, [...vals, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Machine not found' });
    res.json(snakeToCamel(result.rows[0]));
  }),
);

// DELETE /:id — delete machine
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query('DELETE FROM machines WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Machine not found' });
    res.json({ success: true });
  }),
);

export default router;
