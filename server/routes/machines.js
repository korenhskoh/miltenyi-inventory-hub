import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';
import { paginate, envelope } from '../pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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
];

// GET /summary — dashboard counts
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const r = await query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE next_maintenance_date IS NOT NULL AND next_maintenance_date <= $2 AND next_maintenance_date >= $1) AS upcoming_maintenance,
        COUNT(*) FILTER (WHERE next_maintenance_date IS NOT NULL AND next_maintenance_date < $1) AS overdue_maintenance,
        COUNT(*) FILTER (WHERE contract_end IS NOT NULL AND contract_end >= $1) AS active_contracts,
        COUNT(*) FILTER (WHERE contract_end IS NOT NULL AND contract_end BETWEEN $1 AND $2) AS expiring_contracts,
        COUNT(*) FILTER (WHERE contract_end IS NOT NULL AND contract_end < $1) AS expired_contracts
      FROM machines
    `,
      [today, in30],
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
    const { modality, customer, contractStatus, maintenanceDue, search } = req.query;
    const { page, pageSize, offset } = paginate(req.query);
    const conditions = [];
    const params = [];
    let pi = 1;
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

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

    const dataResult = await query(`SELECT * FROM machines${where} ORDER BY id DESC LIMIT $${pi++} OFFSET $${pi++}`, [
      ...params,
      pageSize,
      offset,
    ]);
    const rows = dataResult.rows.map(snakeToCamel);
    res.json(envelope(rows, total, page, pageSize));
  }),
);

// POST /bulk — bulk import machines
router.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const { machines } = req.body;
    if (!Array.isArray(machines) || machines.length === 0)
      return res.status(400).json({ error: 'machines array required' });

    const inserted = [];
    const errors = [];

    for (const [idx, machine] of machines.entries()) {
      try {
        const b = pickAllowed(camelToSnake(machine), MACHINE_FIELDS);
        if (!b.name && !b.serial_number) {
          errors.push({ row: idx + 1, error: 'name or serial_number required' });
          continue;
        }
        if (!b.name) b.name = b.serial_number;
        if (!b.modality) b.modality = 'Unknown';
        const keys = Object.keys(b);
        const vals = Object.values(b);
        const ph = keys.map((_, i) => `$${i + 1}`);
        const sql = `INSERT INTO machines (${keys.join(', ')}) VALUES (${ph.join(', ')}) RETURNING *`;
        const result = await query(sql, vals);
        inserted.push(snakeToCamel(result.rows[0]));
      } catch (e) {
        errors.push({ row: idx + 1, error: e.message });
      }
    }

    res.status(201).json({ inserted: inserted.length, errors, machines: inserted });
  }),
);

// POST / — add single machine
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = pickAllowed(camelToSnake(req.body), MACHINE_FIELDS);
    if (!b.name) b.name = b.serial_number || 'Unnamed';
    if (!b.modality) return res.status(400).json({ error: 'modality required' });
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
    const b = pickAllowed(camelToSnake(req.body), MACHINE_FIELDS);
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
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query('DELETE FROM machines WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Machine not found' });
    res.json({ success: true });
  }),
);

export default router;
