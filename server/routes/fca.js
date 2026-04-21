import { Router } from 'express';
import { query } from '../db.js';
import { snakeToCamel, camelToSnake } from '../utils.js';
import { pickAllowed } from '../validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const FCA_FIELDS = [
  'fca_number',
  'instrument_model',
  'title',
  'description',
  'released_date',
];

const FCA_STATUS_VALUES = new Set(['Not Applicable', 'Pending', 'In Progress', 'Completed']);
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

// Strip blob before sending in list/detail JSON (clients fetch PDF via /:id/pdf)
function stripBlob(row) {
  if (!row) return row;
  const { pdf_blob, ...rest } = row;
  return snakeToCamel({ ...rest, has_pdf: pdf_blob != null });
}

// GET /summary — roll-up counts by instrument_model and status
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const defs = await query(
      `SELECT instrument_model, COUNT(*)::int AS fca_count
       FROM fca_definitions
       GROUP BY instrument_model
       ORDER BY instrument_model`,
    );
    const statuses = await query(
      `SELECT d.instrument_model, s.status, COUNT(*)::int AS cnt
       FROM fca_status s
       JOIN fca_definitions d ON d.id = s.fca_id
       GROUP BY d.instrument_model, s.status`,
    );
    res.json({
      byModel: defs.rows.map(snakeToCamel),
      statusCounts: statuses.rows.map(snakeToCamel),
    });
  }),
);

// GET / — list FCA definitions (metadata only). Optional ?instrumentModel=X
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { instrumentModel } = req.query;
    const params = [];
    let where = '';
    if (instrumentModel) {
      params.push(instrumentModel);
      where = ` WHERE instrument_model = $1`;
    }
    const result = await query(
      `SELECT id, fca_number, instrument_model, title, description, pdf_filename,
              pdf_size_bytes, released_date, created_at, created_by, updated_at,
              (pdf_blob IS NOT NULL) AS has_pdf
       FROM fca_definitions${where}
       ORDER BY instrument_model, fca_number`,
      params,
    );
    res.json(result.rows.map(snakeToCamel));
  }),
);

// GET /:id — FCA metadata (no blob)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, fca_number, instrument_model, title, description, pdf_filename,
              pdf_size_bytes, released_date, created_at, created_by, updated_at,
              (pdf_blob IS NOT NULL) AS has_pdf
       FROM fca_definitions WHERE id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'FCA not found' });
    res.json(snakeToCamel(result.rows[0]));
  }),
);

// GET /:id/pdf — stream PDF to client
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT pdf_blob, pdf_filename FROM fca_definitions WHERE id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0 || !result.rows[0].pdf_blob) {
      return res.status(404).json({ error: 'PDF not found for this FCA' });
    }
    const { pdf_blob, pdf_filename } = result.rows[0];
    const filename = (pdf_filename || 'fca.pdf').replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf_blob);
  }),
);

// POST / — create FCA (admin only). Accepts optional pdfBase64 + pdfFilename.
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const b = pickAllowed(camelToSnake(req.body), FCA_FIELDS);
    if (!b.fca_number || !b.instrument_model) {
      return res.status(400).json({ error: 'fcaNumber and instrumentModel are required' });
    }
    b.fca_number = parseInt(b.fca_number, 10);
    if (Number.isNaN(b.fca_number)) return res.status(400).json({ error: 'fcaNumber must be numeric' });

    // PDF upload (optional)
    const { pdfBase64, pdfFilename } = req.body;
    let pdfBuffer = null;
    if (pdfBase64) {
      pdfBuffer = Buffer.from(pdfBase64, 'base64');
      if (pdfBuffer.length > MAX_PDF_BYTES) {
        return res.status(400).json({ error: `PDF exceeds ${MAX_PDF_BYTES / 1024 / 1024}MB limit` });
      }
      // Basic PDF header check (%PDF-)
      if (pdfBuffer.slice(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ error: 'Uploaded file is not a valid PDF' });
      }
    }

    const cols = [...Object.keys(b), 'created_by'];
    const vals = [...Object.values(b), req.user?.username || null];
    if (pdfBuffer) {
      cols.push('pdf_blob', 'pdf_filename', 'pdf_size_bytes');
      vals.push(pdfBuffer, pdfFilename || 'fca.pdf', pdfBuffer.length);
    }
    const ph = cols.map((_, i) => `$${i + 1}`);
    try {
      const result = await query(
        `INSERT INTO fca_definitions (${cols.join(', ')}) VALUES (${ph.join(', ')})
         RETURNING id, fca_number, instrument_model, title, description, pdf_filename,
                   pdf_size_bytes, released_date, created_at, created_by, updated_at,
                   (pdf_blob IS NOT NULL) AS has_pdf`,
        vals,
      );
      res.status(201).json(snakeToCamel(result.rows[0]));
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'An FCA with this number already exists for this instrument model' });
      }
      throw err;
    }
  }),
);

// PUT /:id — update FCA metadata and optionally replace PDF (admin only)
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const b = pickAllowed(camelToSnake(req.body), FCA_FIELDS);
    if (b.fca_number !== undefined) {
      b.fca_number = parseInt(b.fca_number, 10);
      if (Number.isNaN(b.fca_number)) return res.status(400).json({ error: 'fcaNumber must be numeric' });
    }
    const { pdfBase64, pdfFilename } = req.body;

    const sets = [];
    const vals = [];
    let pi = 1;
    for (const [k, v] of Object.entries(b)) {
      sets.push(`${k} = $${pi++}`);
      vals.push(v);
    }

    if (pdfBase64) {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      if (pdfBuffer.length > MAX_PDF_BYTES) {
        return res.status(400).json({ error: `PDF exceeds ${MAX_PDF_BYTES / 1024 / 1024}MB limit` });
      }
      if (pdfBuffer.slice(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ error: 'Uploaded file is not a valid PDF' });
      }
      sets.push(`pdf_blob = $${pi++}`);
      vals.push(pdfBuffer);
      sets.push(`pdf_filename = $${pi++}`);
      vals.push(pdfFilename || 'fca.pdf');
      sets.push(`pdf_size_bytes = $${pi++}`);
      vals.push(pdfBuffer.length);
    }

    sets.push(`updated_at = NOW()`);
    if (sets.length === 1) return res.status(400).json({ error: 'No fields to update' });

    vals.push(req.params.id);
    const result = await query(
      `UPDATE fca_definitions SET ${sets.join(', ')} WHERE id = $${pi}
       RETURNING id, fca_number, instrument_model, title, description, pdf_filename,
                 pdf_size_bytes, released_date, created_at, created_by, updated_at,
                 (pdf_blob IS NOT NULL) AS has_pdf`,
      vals,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'FCA not found' });
    res.json(snakeToCamel(result.rows[0]));
  }),
);

// DELETE /:id — admin only; cascades fca_status rows
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await query('DELETE FROM fca_definitions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'FCA not found' });
    res.json({ success: true });
  }),
);

// GET /:id/statuses — all instrument statuses for a given FCA.
// An instrument matches the FCA if either (a) its model field equals
// instrument_model (case-insensitive) or (b) model is blank but the
// instrument's name contains instrument_model. The fallback lets FCAs apply
// to instruments whose admins haven't filled the new Model field yet.
router.get(
  '/:id/statuses',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT m.id AS machine_id, m.name, m.serial_number, m.region, m.country, m.model, m.modality,
              s.id AS status_id, s.status, s.completed_date, s.notes, s.updated_by, s.updated_at
       FROM fca_definitions d
       JOIN machines m ON (
         (NULLIF(TRIM(m.model), '') IS NOT NULL AND LOWER(m.model) = LOWER(d.instrument_model))
         OR (NULLIF(TRIM(m.model), '') IS NULL AND m.name ILIKE '%' || d.instrument_model || '%')
       )
       LEFT JOIN fca_status s ON s.fca_id = d.id AND s.machine_id = m.id
       WHERE d.id = $1
       ORDER BY m.region, m.country, m.serial_number`,
      [req.params.id],
    );
    res.json(result.rows.map(snakeToCamel));
  }),
);

// GET /machine/:machineId/statuses — every applicable FCA for a given instrument with its status
router.get(
  '/machine/:machineId/statuses',
  asyncHandler(async (req, res) => {
    const mRes = await query('SELECT id, model, name FROM machines WHERE id = $1', [req.params.machineId]);
    if (mRes.rows.length === 0) return res.status(404).json({ error: 'Instrument not found' });
    const { id: machineId, model, name } = mRes.rows[0];
    const trimmedModel = (model || '').trim();

    const result = await query(
      `SELECT d.id AS fca_id, d.fca_number, d.instrument_model, d.title, d.released_date,
              (d.pdf_blob IS NOT NULL) AS has_pdf,
              s.id AS status_id, s.status, s.completed_date, s.notes, s.updated_by, s.updated_at
       FROM fca_definitions d
       LEFT JOIN fca_status s ON s.fca_id = d.id AND s.machine_id = $1
       WHERE (LENGTH($2) > 0 AND LOWER(d.instrument_model) = LOWER($2))
          OR (LENGTH($2) = 0 AND $3 ILIKE '%' || d.instrument_model || '%')
       ORDER BY d.fca_number`,
      [machineId, trimmedModel, name || ''],
    );
    res.json(result.rows.map(snakeToCamel));
  }),
);

// POST /status — upsert a status for (fca_id, machine_id). Authenticated users.
router.post(
  '/status',
  asyncHandler(async (req, res) => {
    const { fcaId, machineId, status, completedDate, notes } = req.body;
    if (!fcaId || !machineId) return res.status(400).json({ error: 'fcaId and machineId are required' });
    if (status && !FCA_STATUS_VALUES.has(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const finalStatus = status || 'Pending';
    const result = await query(
      `INSERT INTO fca_status (fca_id, machine_id, status, completed_date, notes, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (fca_id, machine_id)
       DO UPDATE SET status = EXCLUDED.status,
                     completed_date = EXCLUDED.completed_date,
                     notes = EXCLUDED.notes,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()
       RETURNING *`,
      [fcaId, machineId, finalStatus, completedDate || null, notes || null, req.user?.username || null],
    );
    res.json(snakeToCamel(result.rows[0]));
  }),
);

export default router;
