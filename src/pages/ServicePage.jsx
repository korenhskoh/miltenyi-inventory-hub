import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Download,
  Upload,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Wrench,
  Calendar,
  RefreshCw,
  LayoutDashboard,
  List,
  Filter,
  Globe,
  Home,
  FileText,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api.js';
import { toLocalYmd, todayLocal, daysFromNowLocal, normalizeDate } from '../lib/dates.js';
import Pagination, { usePagination } from '../components/Pagination.jsx';

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACT_TYPES = [
  'Full Service Contract',
  'Parts Only',
  'Warranty',
  'Time & Material',
  'Preventive Maintenance',
  'On-Call',
  'Other',
];

const MODALITIES = [
  'Flow Cytometer',
  'Cell Sorter',
  'Magnetic Separator',
  'Centrifuge',
  'Microscope',
  'Bioreactor',
  'Incubator',
  'PCR / qPCR',
  'Other',
];

const MAINTENANCE_PERIODS = [
  { label: 'Every 6 months', value: 6 },
  { label: 'Every 12 months', value: 12 },
];

const IQOQ_STATUSES = ['Completed', 'Pending', 'N/A'];

const today = () => todayLocal();
const in30 = () => daysFromNowLocal(30);

// Date fields on a machine record. The API now returns plain 'YYYY-MM-DD' strings, but
// older rows / cached data may still carry ISO timestamps, so normalise defensively.
const DATE_FIELDS = [
  'lastMaintenanceDate',
  'nextMaintenanceDate',
  'contractStart',
  'contractEnd',
  'deliveryDate',
  'installDate',
  'warrantyStart',
  'warrantyEnd',
  'iqoqDate',
];
const normMachineDates = (m) => {
  if (!m) return m;
  const out = { ...m };
  DATE_FIELDS.forEach((k) => {
    if (k in out) out[k] = normalizeDate(out[k]);
  });
  return out;
};

// Days between today and a warranty/expiry date (positive = days remaining, negative = expired)
function daysLeftFromToday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((d - now) / oneDay);
}

function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `S$${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function contractStatus(machine) {
  if (!machine.contractEnd) return 'None';
  if (machine.contractEnd < today()) return 'Expired';
  if (machine.contractEnd <= in30()) return 'Expiring';
  return 'Active';
}

function maintenanceStatus(machine) {
  if (!machine.nextMaintenanceDate) return 'None';
  if (machine.nextMaintenanceDate < today()) return 'Overdue';
  if (machine.nextMaintenanceDate <= in30()) return 'Due';
  return 'OK';
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function ContractBadge({ status }) {
  const cfg = {
    Active: { cls: 'badge-green', icon: <CheckCircle size={11} />, label: 'Active' },
    Expiring: { cls: 'badge-amber', icon: <Clock size={11} />, label: 'Expiring' },
    Expired: { cls: 'badge-red', icon: <XCircle size={11} />, label: 'Expired' },
    None: { cls: 'badge-gray', icon: null, label: 'No Contract' },
  };
  const c = cfg[status] || cfg.None;
  return (
    <span className={`svc-badge ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

function MaintBadge({ status }) {
  const cfg = {
    Overdue: { cls: 'badge-red', icon: <AlertTriangle size={11} />, label: 'Overdue' },
    Due: { cls: 'badge-amber', icon: <Clock size={11} />, label: 'Due Soon' },
    OK: { cls: 'badge-green', icon: <CheckCircle size={11} />, label: 'OK' },
    None: { cls: 'badge-gray', icon: null, label: '—' },
  };
  const c = cfg[status] || cfg.None;
  return (
    <span className={`svc-badge ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color, sub }) {
  return (
    <div className={`svc-card svc-card--${color}`}>
      <div className="svc-card__icon">{icon}</div>
      <div className="svc-card__body">
        <div className="svc-card__value">{value}</div>
        <div className="svc-card__label">{label}</div>
        {sub && <div className="svc-card__sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Form Field ──────────────────────────────────────────────────────────────

function Field({ label, children, required }) {
  return (
    <div className="svc-field">
      <label className="svc-field__label">
        {label} {required && <span className="svc-required">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Instrument Modal ────────────────────────────────────────────────────────

const EMPTY_MACHINE = {
  region: 'local',
  name: '',
  serialNumber: '',
  model: '',
  modality: '',
  location: '',
  customerName: '',
  customerContact: '',
  customerEmail: '',
  maintenancePeriodMonths: 12,
  lastMaintenanceDate: '',
  nextMaintenanceDate: '',
  contractStart: '',
  contractEnd: '',
  contractType: '',
  status: 'Active',
  remark: '',
  notes: '',
  // Overseas-only fields
  country: '',
  deliveryDate: '',
  installDate: '',
  warrantyStart: '',
  warrantyEnd: '',
  pmSparePart: '',
  sapCode: '',
  proposedServiceContract: '',
  price: '',
  iqoq: '',
  iqoqDate: '',
  iqoqPrice: '',
};

function MachineModal({ machine, region, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_MACHINE,
    region: machine?.region || region || 'local',
    ...normMachineDates(machine || {}),
  }));
  const isOverseas = form.region === 'overseas';

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Auto-compute next maintenance from last + period
  const handleLastMaintenanceChange = (val) => {
    set('lastMaintenanceDate', val);
    if (val && form.maintenancePeriodMonths) {
      const d = new Date(val);
      d.setMonth(d.getMonth() + Number(form.maintenancePeriodMonths));
      set('nextMaintenanceDate', toLocalYmd(d));
    }
  };

  const handlePeriodChange = (val) => {
    set('maintenancePeriodMonths', Number(val));
    if (form.lastMaintenanceDate) {
      const d = new Date(form.lastMaintenanceDate);
      d.setMonth(d.getMonth() + Number(val));
      set('nextMaintenanceDate', toLocalYmd(d));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Local instruments require modality; overseas instruments do not.
    if (!isOverseas && !form.modality) return;
    onSave(form);
  };

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="svc-modal__header">
          <h2>{machine ? 'Edit Instrument' : 'Add Instrument'}</h2>
          <button className="svc-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="svc-modal__body">
          <div className="svc-section-title">Instrument Identity</div>
          <div className="svc-grid-2">
            {isOverseas && (
              <Field label="Country">
                <input
                  className="svc-input"
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  placeholder="e.g. Malaysia"
                />
              </Field>
            )}
            <Field label="Instrument Name">
              <input
                className="svc-input"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. MACSQuant Analyzer"
              />
            </Field>
            <Field label="Serial Number">
              <input
                className="svc-input"
                value={form.serialNumber}
                onChange={(e) => set('serialNumber', e.target.value)}
                placeholder="e.g. SN-20250001"
              />
            </Field>
            <Field label="Instrument Model">
              <input
                className="svc-input"
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder="e.g. Prodigy, MACSQUANT 10"
                list="svc-instrument-models"
              />
            </Field>
            <Field label="Modality" required={!isOverseas}>
              <select
                className="svc-select"
                value={form.modality}
                onChange={(e) => set('modality', e.target.value)}
                required={!isOverseas}
              >
                <option value="">Select modality...</option>
                {MODALITIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input
                className="svc-input"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Lab A, Room 3"
              />
            </Field>
            <Field label="Status">
              <select className="svc-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Under Repair">Under Repair</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
            </Field>
          </div>

          <div className="svc-section-title">Customer Details</div>
          <div className="svc-grid-2">
            <Field label="Customer / Organization Name">
              <input
                className="svc-input"
                value={form.customerName}
                onChange={(e) => set('customerName', e.target.value)}
                placeholder="e.g. NUH Singapore"
              />
            </Field>
            <Field label="Contact Person">
              <input
                className="svc-input"
                value={form.customerContact}
                onChange={(e) => set('customerContact', e.target.value)}
                placeholder="e.g. Dr. Tan Wei"
              />
            </Field>
            <Field label="Contact Email">
              <input
                className="svc-input"
                type="email"
                value={form.customerEmail}
                onChange={(e) => set('customerEmail', e.target.value)}
                placeholder="e.g. contact@hospital.sg"
              />
            </Field>
          </div>

          {!isOverseas && (
            <>
              <div className="svc-section-title">Maintenance Schedule</div>
              <div className="svc-grid-2">
                <Field label="Maintenance Period">
                  <select
                    className="svc-select"
                    value={form.maintenancePeriodMonths}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                  >
                    {MAINTENANCE_PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Last Maintenance Date">
                  <input
                    className="svc-input"
                    type="date"
                    value={form.lastMaintenanceDate || ''}
                    onChange={(e) => handleLastMaintenanceChange(e.target.value)}
                  />
                </Field>
                <Field label="Next Maintenance Date">
                  <input
                    className="svc-input"
                    type="date"
                    value={form.nextMaintenanceDate || ''}
                    onChange={(e) => set('nextMaintenanceDate', e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {isOverseas && (
            <>
              <div className="svc-section-title">Warranty &amp; Installation</div>
              <div className="svc-grid-2">
                <Field label="Delivery Date">
                  <input
                    className="svc-input"
                    type="date"
                    value={form.deliveryDate || ''}
                    onChange={(e) => set('deliveryDate', e.target.value)}
                  />
                </Field>
                <Field label="Installation Date">
                  <input
                    className="svc-input"
                    type="date"
                    value={form.installDate || ''}
                    onChange={(e) => set('installDate', e.target.value)}
                  />
                </Field>
                <Field label="Warranty Start">
                  <input
                    className="svc-input"
                    type="date"
                    value={form.warrantyStart || ''}
                    onChange={(e) => set('warrantyStart', e.target.value)}
                  />
                </Field>
                <Field label="Warranty End">
                  <input
                    className="svc-input"
                    type="date"
                    value={form.warrantyEnd || ''}
                    onChange={(e) => set('warrantyEnd', e.target.value)}
                  />
                </Field>
                <Field label="Days Left (computed)">
                  <input
                    className="svc-input"
                    value={
                      form.warrantyEnd ? `${daysLeftFromToday(form.warrantyEnd)} day(s)` : 'Set a warranty end date'
                    }
                    readOnly
                    style={{ background: 'var(--svc-surface)', cursor: 'default' }}
                  />
                </Field>
                <Field label="SAP Code">
                  <input
                    className="svc-input"
                    value={form.sapCode}
                    onChange={(e) => set('sapCode', e.target.value)}
                    placeholder="e.g. 130-092-355"
                  />
                </Field>
              </div>
              <Field label="PM Spare part">
                <textarea
                  className="svc-textarea"
                  rows={2}
                  value={form.pmSparePart}
                  onChange={(e) => set('pmSparePart', e.target.value)}
                  placeholder="Parts used / recommended"
                />
              </Field>
            </>
          )}

          <div className="svc-section-title">Contract Details</div>
          <div className="svc-grid-2">
            {isOverseas ? (
              <Field label="Proposed Service Contract">
                <input
                  className="svc-input"
                  value={form.proposedServiceContract}
                  onChange={(e) => set('proposedServiceContract', e.target.value)}
                  placeholder="e.g. 3-year full service"
                />
              </Field>
            ) : (
              <Field label="Contract Type">
                <select
                  className="svc-select"
                  value={form.contractType}
                  onChange={(e) => set('contractType', e.target.value)}
                >
                  <option value="">Select type...</option>
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {isOverseas && (
              <Field label="Price (SGD)">
                <input
                  className="svc-input"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            )}
            <Field label="Contract Start">
              <input
                className="svc-input"
                type="date"
                value={form.contractStart || ''}
                onChange={(e) => set('contractStart', e.target.value)}
              />
            </Field>
            <Field label="Contract End">
              <input
                className="svc-input"
                type="date"
                value={form.contractEnd || ''}
                onChange={(e) => set('contractEnd', e.target.value)}
              />
            </Field>
          </div>

          {isOverseas && (
            <>
              <div className="svc-section-title">IQOQ</div>
              <div className="svc-grid-2">
                <Field label="IQOQ Status">
                  <select className="svc-select" value={form.iqoq} onChange={(e) => set('iqoq', e.target.value)}>
                    <option value="">— Select —</option>
                    {IQOQ_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="IQOQ Date">
                  <input
                    className="svc-input"
                    type="date"
                    value={form.iqoqDate || ''}
                    onChange={(e) => set('iqoqDate', e.target.value)}
                  />
                </Field>
                <Field label="IQOQ Price (SGD)">
                  <input
                    className="svc-input"
                    type="number"
                    step="0.01"
                    value={form.iqoqPrice}
                    onChange={(e) => set('iqoqPrice', e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
              </div>
            </>
          )}

          <div className="svc-section-title">Additional Info</div>
          <Field label="Remark">
            <textarea
              className="svc-textarea"
              rows={3}
              value={form.remark}
              onChange={(e) => set('remark', e.target.value)}
              placeholder="Any additional remarks..."
            />
          </Field>
          <Field label="Internal Notes">
            <textarea
              className="svc-textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Internal notes (not visible to customer)..."
            />
          </Field>

          <div className="svc-modal__footer">
            <button type="button" className="svc-btn svc-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="svc-btn svc-btn--primary" disabled={saving}>
              {saving ? 'Saving...' : machine ? 'Save Changes' : 'Add Instrument'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ machine, onConfirm, onClose }) {
  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal svc-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="svc-modal__header">
          <h2>Delete Instrument</h2>
          <button className="svc-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="svc-modal__body">
          <p style={{ color: 'var(--svc-text-muted)', marginBottom: 16 }}>
            Are you sure you want to delete <strong>{machine.name || machine.serialNumber}</strong>? This action cannot
            be undone.
          </p>
          <div className="svc-modal__footer">
            <button className="svc-btn svc-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="svc-btn svc-btn--danger" onClick={() => onConfirm(machine)}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

const IMPORT_COLUMNS_LOCAL = [
  {
    key: 'name',
    label: 'Instrument Name',
    aliases: ['machine name', 'equipment name', 'device name', 'instrument', 'instrumentname', 'name'],
  },
  {
    key: 'serialNumber',
    label: 'Serial Number',
    aliases: ['serial no', 'serial', 'sn', 'serialno', 'serialnumber'],
  },
  { key: 'model', label: 'Model', aliases: ['instrument model', 'machine model', 'device model'] },
  { key: 'modality', label: 'Modality', aliases: ['type', 'category', 'device type', 'instrument type'] },
  { key: 'location', label: 'Location', aliases: ['site', 'lab', 'room', 'building'] },
  {
    key: 'customerName',
    label: 'Customer Name',
    aliases: ['customer', 'organization', 'org', 'company', 'client', 'account'],
  },
  {
    key: 'customerContact',
    label: 'Contact Person',
    aliases: ['contact', 'contact name', 'poc', 'person in charge'],
  },
  {
    key: 'customerEmail',
    label: 'Contact Email',
    aliases: ['email', 'customer email', 'contact e-mail', 'e-mail'],
  },
  {
    key: 'maintenancePeriodMonths',
    label: 'Maintenance Period (months)',
    aliases: ['period', 'maintenance period', 'maint period', 'service period', 'pm period'],
  },
  {
    key: 'lastMaintenanceDate',
    label: 'Last Maintenance Date',
    aliases: ['last service', 'last pm', 'last maint', 'last maintenance', 'previous maintenance'],
  },
  {
    key: 'nextMaintenanceDate',
    label: 'Next Maintenance Date',
    aliases: ['next service', 'next pm', 'next maint', 'next maintenance', 'upcoming maintenance'],
  },
  { key: 'contractType', label: 'Contract Type', aliases: ['contract'] },
  {
    key: 'contractStart',
    label: 'Contract Start Date',
    aliases: ['contract start', 'start date', 'contract from'],
  },
  {
    key: 'contractEnd',
    label: 'Contract End Date',
    aliases: ['contract end', 'end date', 'contract to', 'expiry', 'expiry date'],
  },
  { key: 'status', label: 'Status', aliases: ['state'] },
  { key: 'remark', label: 'Remark', aliases: ['note', 'notes', 'comment', 'comments', 'remarks'] },
];

const IMPORT_COLUMNS_OVERSEAS = [
  { key: 'country', label: 'Country', aliases: ['region', 'nation'] },
  {
    key: 'name',
    label: 'Inst',
    aliases: ['instrument', 'instrument name', 'machine', 'machine name', 'equipment', 'device', 'name'],
  },
  {
    key: 'serialNumber',
    label: 'SN',
    aliases: ['serial', 'serial no', 'serial number', 'serialno', 'serialnumber'],
  },
  { key: 'model', label: 'Model', aliases: ['instrument model', 'machine model', 'device model'] },
  { key: 'location', label: 'Location', aliases: ['site', 'lab', 'room', 'building'] },
  { key: 'deliveryDate', label: 'Delivery Date', aliases: ['delivery', 'delivered', 'ship date', 'shipped'] },
  {
    key: 'installDate',
    label: 'Installation Date',
    aliases: ['installation', 'installed', 'install date', 'commissioning'],
  },
  { key: 'warrantyStart', label: 'Warranty Start', aliases: ['warranty from', 'warranty begin'] },
  {
    key: 'warrantyEnd',
    label: 'Warranty End',
    aliases: ['warranty to', 'warranty expiry', 'warranty expires'],
  },
  {
    key: 'pmSparePart',
    label: 'PM Spare part',
    aliases: ['pm spare', 'pmsparepart', 'spare part', 'spare parts', 'pm parts', 'preventive parts'],
  },
  { key: 'sapCode', label: 'SAP Code', aliases: ['sap', 'sap no', 'material code', 'material no'] },
  {
    key: 'proposedServiceContract',
    label: 'Proposed Service Contract',
    aliases: ['service contract', 'proposed contract', 'contract proposal'],
  },
  { key: 'price', label: 'Price', aliases: ['contract price', 'amount', 'cost'] },
  { key: 'contractStart', label: 'Contract Start', aliases: ['contract from', 'start date'] },
  { key: 'contractEnd', label: 'Contract End', aliases: ['contract to', 'end date'] },
  { key: 'iqoq', label: 'IQOQ', aliases: ['iqoq status', 'iq oq', 'iqoqresult'] },
  { key: 'iqoqDate', label: 'IQOQ Date', aliases: ['iqoq completed', 'iqoq on'] },
  { key: 'iqoqPrice', label: 'IQOQ Price', aliases: ['iqoq cost', 'iqoq amount'] },
];

function getImportColumns(region) {
  return region === 'overseas' ? IMPORT_COLUMNS_OVERSEAS : IMPORT_COLUMNS_LOCAL;
}

const DATE_IMPORT_KEYS = new Set(DATE_FIELDS);
const NUMBER_IMPORT_KEYS = new Set(['price', 'iqoqPrice']);

// Normalize a header for fuzzy matching: lowercase, strip punctuation/whitespace
function normalizeHeader(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s_/()\-.,:;]/g, '');
}

// Copy the top-left value of each merged range into every other cell in the
// range. Excel only stores the value in the anchor cell — without this, merged
// header cells leave blank columns that can't be auto-mapped.
function expandMerges(ws) {
  const merges = ws && ws['!merges'];
  if (!Array.isArray(merges)) return;
  for (const m of merges) {
    const srcAddr = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
    const src = ws[srcAddr];
    if (!src) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { ...src };
      }
    }
  }
}

// Auto-map spreadsheet headers to our canonical column keys via label/key/alias match
function autoMapColumns(headers, columns) {
  // Use Array.from to densify — XLSX may hand us sparse arrays (merged/blank
  // leading cells), which would leave undefined holes that find() trips over.
  const normHeaders = Array.from(headers || [], (h) => ({ raw: h, norm: normalizeHeader(h) }));
  const map = {};
  for (const col of columns || []) {
    if (!col || !col.key) continue;
    const aliases = Array.isArray(col.aliases) ? col.aliases : [];
    const candidates = [col.label, col.key, ...aliases].filter((c) => c != null).map(normalizeHeader);
    const hit = normHeaders.find((h) => h && candidates.includes(h.norm));
    if (hit) map[col.key] = hit.raw;
  }
  return map;
}

function ImportModal({ isAdmin, region = 'local', onImport, onClose }) {
  const importColumns = region === 'overseas' ? IMPORT_COLUMNS_OVERSEAS : IMPORT_COLUMNS_LOCAL;
  const [step, setStep] = useState('upload'); // upload | map | done
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [colMap, setColMap] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = (e) => {
    setErrorMsg('');
    const f = e.target.files[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onerror = () => setErrorMsg('Could not read the file. Please try again.');
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        if (!wb.SheetNames?.length) {
          setErrorMsg('The file has no sheets.');
          return;
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Unmerge cells so headers spanning multiple columns are readable
        expandMerges(ws);
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'YYYY-MM-DD' });
        if (!data.length) {
          setErrorMsg('The first sheet is empty.');
          return;
        }
        if (data.length < 2) {
          setErrorMsg('The sheet must have a header row and at least one data row.');
          return;
        }
        // Densify potentially-sparse arrays from XLSX (merged cells / blank
        // leading columns produce holes that downstream code can't handle).
        const headerRow = Array.from(data[0] || []);
        const rawHeaders = headerRow.map((h) => (h == null ? '' : String(h).trim()));
        const lastNonEmpty = rawHeaders.reduce((last, h, i) => (h ? i : last), -1);
        const hdrs = rawHeaders.slice(0, lastNonEmpty + 1);
        if (hdrs.length === 0) {
          setErrorMsg('The first row has no column headers.');
          return;
        }
        const dataRows = data
          .slice(1)
          .map((r) => Array.from(r || []))
          .filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined));
        if (dataRows.length === 0) {
          setErrorMsg('No data rows were found below the header row.');
          return;
        }
        setHeaders(hdrs);
        setRows(dataRows);
        setColMap(autoMapColumns(hdrs, importColumns));
        setStep('map');
      } catch (err) {
        setErrorMsg(`Could not parse the file: ${err.message || 'unknown error'}`);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const mappedKeyCount = Object.values(colMap).filter(Boolean).length;

  const handleImport = async () => {
    setErrorMsg('');
    if (mappedKeyCount === 0) {
      setErrorMsg('No columns are mapped. Map at least one column (or ask an admin) before importing.');
      return;
    }
    setImporting(true);
    try {
      const machines = rows.map((row) => {
        const obj = { region };
        importColumns.forEach(({ key }) => {
          const hdr = colMap[key];
          if (!hdr) return;
          const idx = headers.indexOf(hdr);
          if (idx === -1) return;
          let val = row[idx];
          if (val === '' || val === undefined || val === null) return;
          if (key === 'maintenancePeriodMonths') {
            val = parseInt(val) || 12;
          } else if (NUMBER_IMPORT_KEYS.has(key)) {
            const cleaned = String(val).replace(/[^0-9.-]/g, '');
            const n = parseFloat(cleaned);
            val = Number.isFinite(n) ? n : null;
          } else if (DATE_IMPORT_KEYS.has(key)) {
            // Handles 'YYYY-MM-DD', ISO timestamps, Excel serials and free-form strings.
            val = normalizeDate(val) || null;
          }
          obj[key] = val;
        });
        return obj;
      });
      const res = await api.bulkImportMachines(machines);
      if (!res) {
        setErrorMsg('Import failed — could not reach the server. Check your connection and try again.');
        setImporting(false);
        return;
      }
      setResult(res);
      setImporting(false);
      // Always show the result screen so the user sees inserted/errors feedback
      setStep('done');
      if (res.inserted > 0) onImport(res.machines || []);
    } catch (err) {
      setImporting(false);
      setErrorMsg(`Import failed: ${err.message || 'unknown error'}`);
    }
  };

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal svc-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="svc-modal__header">
          <h2>Import {region === 'overseas' ? 'Overseas' : 'Local'} Instruments from Excel / CSV</h2>
          <button className="svc-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="svc-modal__body">
          {errorMsg && (
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#fecaca',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {errorMsg}
            </div>
          )}

          {step === 'upload' && (
            <div className="svc-upload-zone">
              <Upload size={40} style={{ color: 'var(--svc-primary)', marginBottom: 12 }} />
              <p style={{ marginBottom: 8, fontWeight: 600 }}>Choose an Excel or CSV file to import</p>
              <p style={{ color: 'var(--svc-text-muted)', fontSize: 13, marginBottom: 16 }}>
                The first row should be column headers. Dates should be in YYYY-MM-DD format.
              </p>
              <label className="svc-btn svc-btn--primary" style={{ cursor: 'pointer' }}>
                Browse File
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          {step === 'map' && (
            <>
              <p style={{ marginBottom: 4, color: 'var(--svc-text-muted)' }}>
                <strong>{fileName}</strong> — {rows.length} data rows detected, {mappedKeyCount} column
                {mappedKeyCount !== 1 ? 's' : ''} auto-mapped.
              </p>
              <p style={{ marginBottom: 16, fontSize: 12, color: 'var(--svc-text-subtle)' }}>
                {isAdmin
                  ? 'Columns were auto-mapped from your headers. Adjust any mapping below before importing.'
                  : 'Columns were auto-mapped from your headers. Ask an admin to adjust the mapping if anything is off.'}
              </p>
              <div className="svc-grid-2" style={{ maxHeight: 400, overflowY: 'auto' }}>
                {importColumns.map(({ key, label }) => (
                  <div key={key} className="svc-field">
                    <label className="svc-field__label">{label}</label>
                    <select
                      className="svc-select"
                      value={colMap[key] || ''}
                      disabled={!isAdmin}
                      onChange={(e) => setColMap((p) => ({ ...p, [key]: e.target.value || undefined }))}
                    >
                      <option value="">— Skip —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="svc-modal__footer" style={{ marginTop: 16 }}>
                <button className="svc-btn svc-btn--ghost" onClick={() => setStep('upload')}>
                  Back
                </button>
                <button className="svc-btn svc-btn--primary" onClick={handleImport} disabled={importing}>
                  {importing ? 'Importing...' : `Import ${rows.length} rows`}
                </button>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <div style={{ padding: '16px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                {result.inserted > 0 ? (
                  <CheckCircle size={48} style={{ color: '#22c55e' }} />
                ) : (
                  <AlertTriangle size={48} style={{ color: '#ef4444' }} />
                )}
                <h3 style={{ marginTop: 8 }}>
                  {result.inserted > 0 ? 'Import Complete' : result.skipped?.length > 0 ? 'Nothing New to Import' : 'Import Failed'}
                </h3>
                <p style={{ color: 'var(--svc-text-muted)' }}>
                  ✅ {result.inserted} instrument(s) imported successfully
                  {result.skipped?.length > 0 && (
                    <span style={{ color: '#f59e0b' }}>
                      , ⏭️ {result.skipped.length} already in the registry (skipped)
                    </span>
                  )}
                  {result.errors?.length > 0 && (
                    <span style={{ color: '#ef4444' }}>, ⚠️ {result.errors.length} row(s) failed</span>
                  )}
                </p>
              </div>
              {result.skipped?.length > 0 && (
                <div
                  style={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    background: 'var(--svc-surface-2)',
                    border: '1px solid var(--svc-border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 8,
                    fontSize: 12,
                    color: 'var(--svc-text-muted)',
                  }}
                >
                  <div style={{ marginBottom: 4, fontWeight: 600 }}>
                    Skipped — these serial numbers are already registered:
                  </div>
                  {result.skipped.slice(0, 50).map((sk, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>
                      Row {sk.row}: {sk.serialNumber}
                    </div>
                  ))}
                  {result.skipped.length > 50 && (
                    <div style={{ marginTop: 4, fontStyle: 'italic' }}>…and {result.skipped.length - 50} more</div>
                  )}
                </div>
              )}
              {result.errors?.length > 0 && (
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    background: 'var(--svc-surface-2)',
                    border: '1px solid var(--svc-border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: 'var(--svc-text-muted)',
                  }}
                >
                  {result.errors.slice(0, 50).map((err, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                  {result.errors.length > 50 && (
                    <div style={{ marginTop: 4, fontStyle: 'italic' }}>…and {result.errors.length - 50} more</div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                {result.inserted === 0 && !result.skipped?.length && (
                  <button className="svc-btn svc-btn--ghost" onClick={() => setStep('map')}>
                    Back to Mapping
                  </button>
                )}
                <button className="svc-btn svc-btn--primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Sub-view ──────────────────────────────────────────────────────

function Dashboard({ summary, machines, region = 'local' }) {
  const isOverseas = region === 'overseas';
  return (
    <div className="svc-dashboard">
      <div className="svc-dash-grid">
        <SummaryCard
          label="Total Instruments"
          value={summary?.total ?? machines.length}
          icon={<Wrench size={22} />}
          color="blue"
          sub="All registered"
        />
        <SummaryCard
          label="Upcoming Maintenance"
          value={summary?.upcomingMaintenance ?? 0}
          icon={<Clock size={22} />}
          color="amber"
          sub="Within 30 days"
        />
        <SummaryCard
          label="Overdue Maintenance"
          value={summary?.overdueMaintenance ?? 0}
          icon={<AlertTriangle size={22} />}
          color="red"
          sub="Past due date"
        />
        <SummaryCard
          label="Active Contracts"
          value={summary?.activeContracts ?? 0}
          icon={<CheckCircle size={22} />}
          color="green"
          sub="Currently active"
        />
        <SummaryCard
          label="Expiring Contracts"
          value={summary?.expiringContracts ?? 0}
          icon={<Calendar size={22} />}
          color="amber"
          sub="Within 30 days"
        />
        <SummaryCard
          label="Expired Contracts"
          value={summary?.expiredContracts ?? 0}
          icon={<XCircle size={22} />}
          color="red"
          sub="Action required"
        />
      </div>

      {/* Recent Alerts */}
      <div className="svc-alerts-section">
        <h3 className="svc-section-heading">Attention Required</h3>
        {machines.filter((m) => {
          if (isOverseas) {
            const dl = daysLeftFromToday(m.warrantyEnd);
            const warrantyAlert = dl !== null && dl <= 30;
            return contractStatus(m) === 'Expired' || contractStatus(m) === 'Expiring' || warrantyAlert;
          }
          return (
            contractStatus(m) === 'Expired' ||
            contractStatus(m) === 'Expiring' ||
            maintenanceStatus(m) === 'Overdue' ||
            maintenanceStatus(m) === 'Due'
          );
        }).length === 0 ? (
          <div className="svc-empty-alert">
            <CheckCircle size={32} style={{ color: '#22c55e' }} />
            <p>All instruments are up to date. No action required!</p>
          </div>
        ) : (
          <div className="svc-alert-table-wrapper">
            <table className="svc-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Serial No</th>
                  <th>{isOverseas ? 'Country' : 'Customer'}</th>
                  <th>{isOverseas ? 'Warranty End' : 'Modality'}</th>
                  <th>{isOverseas ? 'Warranty' : 'Maintenance'}</th>
                  <th>Contract</th>
                </tr>
              </thead>
              <tbody>
                {machines
                  .filter((m) => {
                    if (isOverseas) {
                      const dl = daysLeftFromToday(m.warrantyEnd);
                      const warrantyAlert = dl !== null && dl <= 30;
                      return contractStatus(m) === 'Expired' || contractStatus(m) === 'Expiring' || warrantyAlert;
                    }
                    return (
                      contractStatus(m) === 'Expired' ||
                      contractStatus(m) === 'Expiring' ||
                      maintenanceStatus(m) === 'Overdue' ||
                      maintenanceStatus(m) === 'Due'
                    );
                  })
                  .slice(0, 10)
                  .map((m) => {
                    const dl = isOverseas ? daysLeftFromToday(m.warrantyEnd) : null;
                    const dlCls =
                      dl === null ? 'badge-gray' : dl < 0 ? 'badge-red' : dl <= 30 ? 'badge-amber' : 'badge-green';
                    return (
                      <tr key={m.id}>
                        <td>{m.name || '\u2014'}</td>
                        <td>
                          <span className="svc-mono">{m.serialNumber || '\u2014'}</span>
                        </td>
                        <td>{(isOverseas ? m.country : m.customerName) || '\u2014'}</td>
                        <td>{isOverseas ? fmtDate(m.warrantyEnd) : m.modality}</td>
                        <td>
                          {isOverseas ? (
                            dl === null ? (
                              '\u2014'
                            ) : (
                              <span className={`svc-badge ${dlCls}`}>{dl} day(s)</span>
                            )
                          ) : (
                            <MaintBadge status={maintenanceStatus(m)} />
                          )}
                        </td>
                        <td>
                          <ContractBadge status={contractStatus(m)} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Registry Sub-view ───────────────────────────────────────────────────────

function Registry({
  region,
  search,
  setSearch,
  filtered,
  loading,
  filterModality,
  setFilterModality,
  filterContract,
  setFilterContract,
  filterMaint,
  setFilterMaint,
  filterCountry,
  setFilterCountry,
  uniqueModalities,
  uniqueCountries,
  handleExport,
  setShowImport,
  setEditMachine,
  setShowModal,
  setDeleteMachine,
  setShowInstrumentFca,
  isAdmin,
  handleResetAll,
  resetting,
}) {
  const isOverseas = region === 'overseas';
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Client-side pagination. All rows are already loaded via ?all=true; we just
  // slice for display so the table stays snappy with large datasets.
  const pager = usePagination(filtered, {
    storageKey: 'service-registry',
    initialSize: 100,
    resetKey: [search, filterModality, filterContract, filterMaint, filterCountry, region].join('|'),
  });
  const pagedRows = pager.pageItems;
  const pageStart = Math.max(0, pager.from - 1);

  return (
    <div className="svc-registry">
      {/* Toolbar */}
      <div className="svc-toolbar">
        <div className="svc-search-wrap">
          <Search size={15} className="svc-search-icon" />
          <input
            className="svc-search"
            placeholder={
              isOverseas
                ? 'Search serial, country, instrument\u2026'
                : 'Search serial, customer, instrument, modality\u2026'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="svc-filters">
          {isOverseas ? (
            <div className="svc-filter-group">
              <Filter size={13} />
              <select
                className="svc-select svc-select--sm"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
              >
                <option value="All">All Countries</option>
                {uniqueCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="svc-filter-group">
              <Filter size={13} />
              <select
                className="svc-select svc-select--sm"
                value={filterModality}
                onChange={(e) => setFilterModality(e.target.value)}
              >
                <option value="All">All Modalities</option>
                {uniqueModalities.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          <select
            className="svc-select svc-select--sm"
            value={filterContract}
            onChange={(e) => setFilterContract(e.target.value)}
          >
            <option value="All">All Contracts</option>
            <option value="Active">Active</option>
            <option value="Expiring">Expiring</option>
            <option value="Expired">Expired</option>
            <option value="None">No Contract</option>
          </select>
          {!isOverseas && (
            <select
              className="svc-select svc-select--sm"
              value={filterMaint}
              onChange={(e) => setFilterMaint(e.target.value)}
            >
              <option value="All">All Maintenance</option>
              <option value="Overdue">Overdue</option>
              <option value="Due">Due Soon</option>
              <option value="OK">OK</option>
              <option value="None">Not scheduled</option>
            </select>
          )}
        </div>
        <div className="svc-actions">
          <button className="svc-btn svc-btn--ghost svc-btn--sm" onClick={handleExport} title="Export to Excel">
            <Download size={14} /> Export
          </button>
          <button
            className="svc-btn svc-btn--ghost svc-btn--sm"
            onClick={() => setShowImport(true)}
            title="Import from Excel"
          >
            <Upload size={14} /> Import
          </button>
          {isAdmin && (
            <button
              className="svc-btn svc-btn--danger svc-btn--sm"
              onClick={() => {
                setResetConfirmText('');
                setShowResetModal(true);
              }}
              title={`Delete all ${isOverseas ? 'overseas' : 'local'} instruments`}
              disabled={resetting}
            >
              <Trash2 size={14} /> Reset
            </button>
          )}
          <button
            className="svc-btn svc-btn--primary svc-btn--sm"
            onClick={() => {
              setEditMachine(null);
              setShowModal(true);
            }}
          >
            <Plus size={14} /> Add Instrument
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="svc-table-wrapper svc-desktop-only">
        {isOverseas ? (
          <table className="svc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Country</th>
                <th>Inst</th>
                <th>SN</th>
                <th>Location</th>
                <th>Delivery Date</th>
                <th>Installation Date</th>
                <th>Warranty Start</th>
                <th>Warranty End</th>
                <th>Days Left</th>
                <th>PM Spare part</th>
                <th>SAP Code</th>
                <th>Proposed Service Contract</th>
                <th>Price</th>
                <th>Contract Start</th>
                <th>Contract End</th>
                <th>Contract Status</th>
                <th>IQOQ</th>
                <th>IQOQ Date</th>
                <th>IQOQ Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={21} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--svc-text-muted)' }}>
                    {loading ? 'Loading instruments\u2026' : 'No instruments found. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                pagedRows.map((m, i) => {
                  const cs = contractStatus(m);
                  const dl = daysLeftFromToday(m.warrantyEnd);
                  const dlClass = dl === null ? '' : dl < 0 ? 'badge-red' : dl <= 30 ? 'badge-amber' : 'badge-green';
                  return (
                    <tr key={m.id} className={cs === 'Expired' ? 'svc-row--alert' : ''}>
                      <td className="svc-td-num">{pageStart + i + 1}</td>
                      <td>{m.country || '\u2014'}</td>
                      <td>
                        <div>{m.name || '\u2014'}</div>
                        {m.location && <div className="svc-sub-text">{m.location}</div>}
                      </td>
                      <td>
                        <span className="svc-mono">{m.serialNumber || '\u2014'}</span>
                      </td>
                      <td>{m.location || '\u2014'}</td>
                      <td>{fmtDate(m.deliveryDate)}</td>
                      <td>{fmtDate(m.installDate)}</td>
                      <td>{fmtDate(m.warrantyStart)}</td>
                      <td>{fmtDate(m.warrantyEnd)}</td>
                      <td>{dl === null ? '\u2014' : <span className={`svc-badge ${dlClass}`}>{dl} day(s)</span>}</td>
                      <td className="svc-remark" title={m.pmSparePart || ''}>
                        {m.pmSparePart || '\u2014'}
                      </td>
                      <td>
                        <span className="svc-mono">{m.sapCode || '\u2014'}</span>
                      </td>
                      <td className="svc-remark" title={m.proposedServiceContract || ''}>
                        {m.proposedServiceContract || '\u2014'}
                      </td>
                      <td>{fmtMoney(m.price)}</td>
                      <td>{fmtDate(m.contractStart)}</td>
                      <td>{fmtDate(m.contractEnd)}</td>
                      <td>
                        <ContractBadge status={cs} />
                      </td>
                      <td>{m.iqoq || '\u2014'}</td>
                      <td>{fmtDate(m.iqoqDate)}</td>
                      <td>{fmtMoney(m.iqoqPrice)}</td>
                      <td>
                        <div className="svc-row-actions">
                          <button className="svc-icon-btn" title="FCA Status" onClick={() => setShowInstrumentFca?.(m)}>
                            <ShieldAlert size={14} />
                          </button>
                          <button
                            className="svc-icon-btn svc-icon-btn--edit"
                            title="Edit"
                            onClick={() => {
                              setEditMachine(m);
                              setShowModal(true);
                            }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="svc-icon-btn svc-icon-btn--delete"
                            title="Delete"
                            onClick={() => setDeleteMachine(m)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="svc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Serial No</th>
                <th>Instrument Name</th>
                <th>Modality</th>
                <th>Customer</th>
                <th>Maint. Period</th>
                <th>Last Maintenance</th>
                <th>Next Maintenance</th>
                <th>Maint. Status</th>
                <th>Contract Type</th>
                <th>Contract Start</th>
                <th>Contract End</th>
                <th>Contract Status</th>
                <th>Remark</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--svc-text-muted)' }}>
                    {loading ? 'Loading instruments\u2026' : 'No instruments found. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                pagedRows.map((m, i) => {
                  const cs = contractStatus(m);
                  const ms = maintenanceStatus(m);
                  return (
                    <tr key={m.id} className={cs === 'Expired' || ms === 'Overdue' ? 'svc-row--alert' : ''}>
                      <td className="svc-td-num">{pageStart + i + 1}</td>
                      <td>
                        <span className="svc-mono">{m.serialNumber || '\u2014'}</span>
                      </td>
                      <td>
                        <div>{m.name || '\u2014'}</div>
                        {m.location && <div className="svc-sub-text">{m.location}</div>}
                      </td>
                      <td>{m.modality}</td>
                      <td>
                        <div>{m.customerName || '\u2014'}</div>
                        {m.customerContact && <div className="svc-sub-text">{m.customerContact}</div>}
                        {m.customerEmail && <div className="svc-sub-text">{m.customerEmail}</div>}
                      </td>
                      <td>
                        {m.maintenancePeriodMonths
                          ? MAINTENANCE_PERIODS.find((p) => p.value === Number(m.maintenancePeriodMonths))?.label ||
                            `${m.maintenancePeriodMonths} months`
                          : '\u2014'}
                      </td>
                      <td>{fmtDate(m.lastMaintenanceDate)}</td>
                      <td>{fmtDate(m.nextMaintenanceDate)}</td>
                      <td>
                        <MaintBadge status={ms} />
                      </td>
                      <td>{m.contractType || '\u2014'}</td>
                      <td>{fmtDate(m.contractStart)}</td>
                      <td>{fmtDate(m.contractEnd)}</td>
                      <td>
                        <ContractBadge status={cs} />
                      </td>
                      <td className="svc-remark">{m.remark || '\u2014'}</td>
                      <td>
                        <div className="svc-row-actions">
                          <button className="svc-icon-btn" title="FCA Status" onClick={() => setShowInstrumentFca?.(m)}>
                            <ShieldAlert size={14} />
                          </button>
                          <button
                            className="svc-icon-btn svc-icon-btn--edit"
                            title="Edit"
                            onClick={() => {
                              setEditMachine(m);
                              setShowModal(true);
                            }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="svc-icon-btn svc-icon-btn--delete"
                            title="Delete"
                            onClick={() => setDeleteMachine(m)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Card List */}
      <div className="svc-mobile-only">
        {filtered.length === 0 ? (
          <div className="svc-mobile-empty">
            {loading ? 'Loading instruments\u2026' : 'No instruments found. Add one to get started.'}
          </div>
        ) : (
          pagedRows.map((m, i) => {
            const cs = contractStatus(m);
            const ms = maintenanceStatus(m);
            return (
              <div
                key={m.id}
                className={`svc-mcard ${cs === 'Expired' || (!isOverseas && ms === 'Overdue') ? 'svc-mcard--alert' : ''}`}
              >
                <div className="svc-mcard__head">
                  <div className="svc-mcard__title">
                    <span className="svc-mcard__num">#{pageStart + i + 1}</span>
                    <span className="svc-mcard__name">
                      {m.name || (isOverseas ? m.country : m.modality) || 'Instrument'}
                    </span>
                  </div>
                  <div className="svc-mcard__actions">
                    <button className="svc-icon-btn" title="FCA Status" onClick={() => setShowInstrumentFca?.(m)}>
                      <ShieldAlert size={15} />
                    </button>
                    <button
                      className="svc-icon-btn svc-icon-btn--edit"
                      onClick={() => {
                        setEditMachine(m);
                        setShowModal(true);
                      }}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button className="svc-icon-btn svc-icon-btn--delete" onClick={() => setDeleteMachine(m)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {m.serialNumber && (
                  <div className="svc-mcard__serial">
                    <span className="svc-mono">{m.serialNumber}</span>
                  </div>
                )}
                <div className="svc-mcard__badges">
                  {!isOverseas && <MaintBadge status={ms} />}
                  <ContractBadge status={cs} />
                  {isOverseas &&
                    m.warrantyEnd &&
                    (() => {
                      const dl = daysLeftFromToday(m.warrantyEnd);
                      const cls = dl === null ? '' : dl < 0 ? 'badge-red' : dl <= 30 ? 'badge-amber' : 'badge-green';
                      return <span className={`svc-badge ${cls}`}>{dl} day(s)</span>;
                    })()}
                </div>
                <div className="svc-mcard__grid">
                  {isOverseas ? (
                    <>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Country</span>
                        <span className="svc-mcard__val">{m.country || '\u2014'}</span>
                      </div>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">SAP Code</span>
                        <span className="svc-mcard__val">{m.sapCode || '\u2014'}</span>
                      </div>
                      {m.location && (
                        <div className="svc-mcard__field">
                          <span className="svc-mcard__label">Location</span>
                          <span className="svc-mcard__val">{m.location}</span>
                        </div>
                      )}
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Warranty End</span>
                        <span className="svc-mcard__val">{fmtDate(m.warrantyEnd)}</span>
                      </div>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Contract End</span>
                        <span className="svc-mcard__val">{fmtDate(m.contractEnd)}</span>
                      </div>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">IQOQ</span>
                        <span className="svc-mcard__val">{m.iqoq || '\u2014'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Modality</span>
                        <span className="svc-mcard__val">{m.modality || '\u2014'}</span>
                      </div>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Customer</span>
                        <span className="svc-mcard__val">{m.customerName || '\u2014'}</span>
                      </div>
                      {m.location && (
                        <div className="svc-mcard__field">
                          <span className="svc-mcard__label">Location</span>
                          <span className="svc-mcard__val">{m.location}</span>
                        </div>
                      )}
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Next Maint.</span>
                        <span className="svc-mcard__val">{fmtDate(m.nextMaintenanceDate)}</span>
                      </div>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Contract</span>
                        <span className="svc-mcard__val">{m.contractType || '\u2014'}</span>
                      </div>
                      <div className="svc-mcard__field">
                        <span className="svc-mcard__label">Contract End</span>
                        <span className="svc-mcard__val">{fmtDate(m.contractEnd)}</span>
                      </div>
                    </>
                  )}
                </div>
                {m.remark && <div className="svc-mcard__remark">{m.remark}</div>}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination controls */}
      <Pagination {...pager} unit="instruments" />

      {/* Reset confirmation modal */}
      {showResetModal && (
        <div className="svc-modal-overlay" onClick={() => !resetting && setShowResetModal(false)}>
          <div className="svc-modal svc-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="svc-modal__header">
              <h2>Reset {isOverseas ? 'Overseas' : 'Local'} Registry</h2>
              <button
                type="button"
                className="svc-icon-btn"
                onClick={() => !resetting && setShowResetModal(false)}
                disabled={resetting}
              >
                <X size={20} />
              </button>
            </div>
            <div className="svc-modal__body">
              <p style={{ color: 'var(--svc-text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                This will permanently delete <strong>every {isOverseas ? 'overseas' : 'local'} instrument</strong> and
                all of their FCA status records. This cannot be undone.
              </p>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                Type <code>RESET</code> to confirm:
              </p>
              <input
                className="svc-input"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                autoFocus
              />
              <div className="svc-modal__footer">
                <button
                  type="button"
                  className="svc-btn svc-btn--ghost"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="svc-btn svc-btn--danger"
                  disabled={resetting || resetConfirmText !== 'RESET'}
                  onClick={async () => {
                    await handleResetAll(region);
                    setShowResetModal(false);
                    setResetConfirmText('');
                  }}
                >
                  {resetting ? 'Resetting…' : `Reset ${isOverseas ? 'Overseas' : 'Local'} Registry`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FCA (Field Change Actions) ──────────────────────────────────────────────

const FCA_STATUSES = ['Not Applicable', 'Pending', 'In Progress', 'Completed'];

function fcaStatusBadgeClass(status) {
  switch (status) {
    case 'Completed':
      return 'badge-green';
    case 'In Progress':
      return 'badge-amber';
    case 'Not Applicable':
      return 'badge-gray';
    case 'Pending':
    default:
      return 'badge-red';
  }
}

// Convert a File to base64 (chunked to avoid stack overflow on large files)
async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function FcaEditModal({ fca, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => ({
    fcaNumber: fca?.fcaNumber ?? '',
    instrumentModel: fca?.instrumentModel || '',
    title: fca?.title || '',
    description: fca?.description || '',
    releasedDate: fca?.releasedDate ? String(fca.releasedDate).slice(0, 10) : '',
    pdfFile: null,
    pdfFilename: fca?.pdfFilename || '',
    hasPdf: !!fca?.hasPdf,
  }));
  const [fileErr, setFileErr] = useState('');
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleFileChange = (e) => {
    setFileErr('');
    const f = e.target.files?.[0] || null;
    if (!f) {
      set('pdfFile', null);
      return;
    }
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      setFileErr('Only PDF files are allowed');
      set('pdfFile', null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileErr('PDF exceeds 10MB limit');
      set('pdfFile', null);
      return;
    }
    set('pdfFile', f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fileErr) return;
    const payload = {
      fcaNumber: Number(form.fcaNumber),
      instrumentModel: form.instrumentModel.trim(),
      title: form.title.trim(),
      description: form.description,
      releasedDate: form.releasedDate || null,
    };
    if (form.pdfFile) {
      payload.pdfBase64 = await fileToBase64(form.pdfFile);
      payload.pdfFilename = form.pdfFile.name;
    }
    onSave(payload);
  };

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="svc-modal__header">
          <h2>{fca ? `Edit FCA ${fca.fcaNumber}` : 'Add FCA'}</h2>
          <button type="button" className="svc-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="svc-modal__body">
          <div className="svc-grid-2">
            <Field label="FCA Number" required>
              <input
                type="number"
                min="1"
                className="svc-input"
                value={form.fcaNumber}
                onChange={(e) => set('fcaNumber', e.target.value)}
                required
              />
            </Field>
            <Field label="Instrument Model" required>
              <input
                className="svc-input"
                value={form.instrumentModel}
                onChange={(e) => set('instrumentModel', e.target.value)}
                placeholder="e.g. Prodigy, MACSQUANT 10"
                list="svc-instrument-models"
                required
              />
            </Field>
            <Field label="Released Date">
              <input
                type="date"
                className="svc-input"
                value={form.releasedDate}
                onChange={(e) => set('releasedDate', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Title">
            <input
              className="svc-input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Short summary of the FCA"
            />
          </Field>
          <Field label="Description">
            <textarea
              className="svc-textarea"
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field label={form.hasPdf ? 'Replace PDF (optional, 10MB max)' : 'PDF (optional, 10MB max)'}>
            <input type="file" accept="application/pdf,.pdf" className="svc-input" onChange={handleFileChange} />
            {fileErr && <div style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{fileErr}</div>}
            {form.hasPdf && !form.pdfFile && !fileErr && (
              <div style={{ fontSize: 12, color: 'var(--svc-text-subtle)', marginTop: 4 }}>
                Current: {form.pdfFilename || 'uploaded PDF'} — leave blank to keep.
              </div>
            )}
          </Field>
          <div className="svc-modal__footer">
            <button type="button" className="svc-btn svc-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="svc-btn svc-btn--primary" disabled={saving || !!fileErr}>
              {saving ? 'Saving...' : fca ? 'Save Changes' : 'Create FCA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstrumentFcaStatusModal({ machine, onClose, notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await api.getFcaStatusesForMachine(machine.id);
      if (!cancelled) {
        setRows(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [machine.id]);

  const updateRow = async (row, patch) => {
    const next = { ...row, ...patch };
    setRows((prev) => prev.map((r) => (r.fcaId === row.fcaId ? next : r)));
    const res = await api.upsertFcaStatus({
      fcaId: row.fcaId,
      machineId: machine.id,
      status: next.status || 'Pending',
      completedDate: next.completedDate || null,
      notes: next.notes || null,
    });
    if (!res.ok) {
      notify?.('Update failed', res.error || 'Could not save FCA status', 'error');
    }
  };

  const openPdf = async (fcaId) => {
    const url = await api.fetchFcaPdfBlobUrl(fcaId);
    if (!url) {
      notify?.('PDF unavailable', 'Could not load PDF.', 'error');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal svc-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="svc-modal__header">
          <h2>
            FCA Status — {machine.name || machine.serialNumber}
            {machine.model ? ` (${machine.model})` : ''}
          </h2>
          <button type="button" className="svc-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="svc-modal__body">
          {!machine.model ? (
            <p style={{ color: 'var(--svc-text-muted)' }}>
              This instrument has no Model set. Edit the instrument and fill in the Instrument Model to match FCAs.
            </p>
          ) : loading ? (
            <p style={{ color: 'var(--svc-text-muted)' }}>Loading FCA list…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: 'var(--svc-text-muted)' }}>No FCAs defined for model "{machine.model}".</p>
          ) : (
            <div className="svc-table-wrapper">
              <table className="svc-table">
                <thead>
                  <tr>
                    <th>FCA</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Completed</th>
                    <th>Notes</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.fcaId}>
                      <td>
                        <strong>FCA {r.fcaNumber}</strong>
                      </td>
                      <td className="svc-remark" title={r.title || ''}>
                        {r.title || '—'}
                      </td>
                      <td>
                        <select
                          className="svc-select svc-select--sm"
                          value={r.status || 'Pending'}
                          onChange={(e) => updateRow(r, { status: e.target.value })}
                        >
                          {FCA_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="svc-input"
                          value={r.completedDate ? String(r.completedDate).slice(0, 10) : ''}
                          onChange={(e) => updateRow(r, { completedDate: e.target.value || null })}
                        />
                      </td>
                      <td>
                        <input
                          className="svc-input"
                          value={r.notes || ''}
                          placeholder="Optional notes"
                          onBlur={(e) => {
                            if ((e.target.value || '') !== (r.notes || '')) {
                              updateRow(r, { notes: e.target.value });
                            }
                          }}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) => (x.fcaId === r.fcaId ? { ...x, notes: e.target.value } : x)),
                            )
                          }
                        />
                      </td>
                      <td>
                        {r.hasPdf ? (
                          <button
                            type="button"
                            className="svc-btn svc-btn--ghost svc-btn--sm"
                            onClick={() => openPdf(r.fcaId)}
                          >
                            <FileText size={13} /> View
                          </button>
                        ) : (
                          <span style={{ color: 'var(--svc-text-subtle)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FcaPage({ isAdmin, notify, fcaList, fcaLoading, reloadFcas, instrumentModels }) {
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedFca, setSelectedFca] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editFca, setEditFca] = useState(null);
  const [saving, setSaving] = useState(false);

  const models = useMemo(
    () => [...new Set([...fcaList.map((f) => f.instrumentModel), ...instrumentModels])].filter(Boolean).sort(),
    [fcaList, instrumentModels],
  );

  // Fall back to the first model while the user hasn't picked one (derived, no effect needed)
  const effectiveModel = selectedModel || models[0] || '';

  const fcasForModel = useMemo(
    () =>
      fcaList
        .filter((f) => f.instrumentModel === effectiveModel)
        .slice()
        .sort((a, b) => a.fcaNumber - b.fcaNumber),
    [fcaList, effectiveModel],
  );

  const statusPager = usePagination(statuses, {
    storageKey: 'service-fca',
    initialSize: 50,
    resetKey: String(selectedFca?.id ?? ''),
  });

  const openFcaDetail = useCallback(async (fca) => {
    setSelectedFca(fca);
    setStatusesLoading(true);
    const rows = await api.getFcaStatusesForFca(fca.id);
    setStatuses(rows || []);
    setStatusesLoading(false);
  }, []);

  const openPdf = async (fcaId) => {
    const url = await api.fetchFcaPdfBlobUrl(fcaId);
    if (!url) {
      notify?.('PDF unavailable', 'Could not load PDF.', 'error');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  const handleSave = async (payload) => {
    setSaving(true);
    const res = editFca ? await api.updateFca(editFca.id, payload) : await api.createFca(payload);
    setSaving(false);
    if (res.ok) {
      notify?.(editFca ? 'FCA updated' : 'FCA created', `FCA ${res.fca.fcaNumber} saved`, 'success');
      setShowEdit(false);
      setEditFca(null);
      await reloadFcas();
      if (selectedFca && editFca && selectedFca.id === editFca.id) {
        setSelectedFca(res.fca);
      }
    } else {
      notify?.('Save failed', res.error || 'Unable to save FCA', 'error');
    }
  };

  const handleDelete = async (fca) => {
    if (
      !window.confirm(
        `Delete FCA ${fca.fcaNumber} (${fca.instrumentModel})? This also removes all instrument status records.`,
      )
    ) {
      return;
    }
    const ok = await api.deleteFca(fca.id);
    if (ok) {
      notify?.('Deleted', `FCA ${fca.fcaNumber} removed`, 'success');
      await reloadFcas();
      if (selectedFca?.id === fca.id) {
        setSelectedFca(null);
        setStatuses([]);
      }
    } else {
      notify?.('Delete failed', 'Could not delete FCA', 'error');
    }
  };

  const handleStatusChange = async (row, patch) => {
    if (!selectedFca) return;
    const next = { ...row, ...patch };
    setStatuses((prev) => prev.map((r) => (r.machineId === row.machineId ? next : r)));
    const res = await api.upsertFcaStatus({
      fcaId: selectedFca.id,
      machineId: row.machineId,
      status: next.status || 'Pending',
      completedDate: next.completedDate || null,
      notes: next.notes || null,
    });
    if (!res.ok) {
      notify?.('Update failed', res.error || 'Unable to update status', 'error');
    }
  };

  // Per-FCA completion roll-up
  const getRollup = (fca) => {
    const forThis = statuses.filter((s) => s.machineId && selectedFca?.id === fca.id);
    if (!forThis.length) return null;
    const done = forThis.filter((s) => s.status === 'Completed').length;
    return `${done}/${forThis.length}`;
  };

  return (
    <div className="svc-fca">
      <div className="svc-fca__toolbar">
        <div className="svc-filter-group">
          <Filter size={13} />
          <select
            className="svc-select svc-select--sm"
            value={effectiveModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              setSelectedFca(null);
              setStatuses([]);
            }}
          >
            {models.length === 0 && <option value="">No FCAs yet</option>}
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div style={{ color: 'var(--svc-text-muted)', fontSize: 12 }}>
          {fcaLoading
            ? 'Loading FCAs…'
            : `${fcasForModel.length} FCA${fcasForModel.length !== 1 ? 's' : ''} for ${effectiveModel || '—'}`}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {isAdmin && (
            <button
              type="button"
              className="svc-btn svc-btn--primary svc-btn--sm"
              onClick={() => {
                setEditFca(null);
                setShowEdit(true);
              }}
            >
              <Plus size={14} /> Add FCA
            </button>
          )}
        </div>
      </div>

      <div className="svc-fca__grid">
        {fcasForModel.map((f) => {
          const active = selectedFca?.id === f.id;
          return (
            <button
              type="button"
              key={f.id}
              className={`svc-fca-card ${active ? 'active' : ''}`}
              onClick={() => openFcaDetail(f)}
            >
              <div className="svc-fca-card__num">FCA {f.fcaNumber}</div>
              <div className="svc-fca-card__title">{f.title || '(untitled)'}</div>
              <div className="svc-fca-card__meta">
                {f.hasPdf ? (
                  <span className="svc-badge badge-green">
                    <FileText size={11} /> PDF
                  </span>
                ) : (
                  <span className="svc-badge badge-gray">No PDF</span>
                )}
                {f.releasedDate && <span className="svc-fca-card__date">{fmtDate(f.releasedDate)}</span>}
              </div>
            </button>
          );
        })}
        {!fcaLoading && fcasForModel.length === 0 && (
          <div className="svc-fca__empty">
            No FCAs for {effectiveModel || 'this model'}.{isAdmin && ' Click "Add FCA" to create one.'}
          </div>
        )}
      </div>

      {selectedFca && (
        <div className="svc-fca__detail">
          <div className="svc-fca__detail-head">
            <div>
              <h3>
                FCA {selectedFca.fcaNumber} — {selectedFca.instrumentModel}
              </h3>
              {selectedFca.title && <div className="svc-fca__detail-title">{selectedFca.title}</div>}
              {selectedFca.releasedDate && (
                <div className="svc-sub-text">Released {fmtDate(selectedFca.releasedDate)}</div>
              )}
            </div>
            <div className="svc-fca__detail-actions">
              {selectedFca.hasPdf && (
                <button
                  type="button"
                  className="svc-btn svc-btn--ghost svc-btn--sm"
                  onClick={() => openPdf(selectedFca.id)}
                >
                  <ExternalLink size={13} /> Open PDF
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className="svc-btn svc-btn--ghost svc-btn--sm"
                    onClick={() => {
                      setEditFca(selectedFca);
                      setShowEdit(true);
                    }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    className="svc-btn svc-btn--danger svc-btn--sm"
                    onClick={() => handleDelete(selectedFca)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {selectedFca.description && <p className="svc-fca__detail-desc">{selectedFca.description}</p>}

          <h4 className="svc-section-heading" style={{ marginTop: 16 }}>
            Instrument Status ({statuses.length})
          </h4>
          {statusesLoading ? (
            <p style={{ color: 'var(--svc-text-muted)' }}>Loading…</p>
          ) : statuses.length === 0 ? (
            <div
              style={{
                padding: 14,
                background: 'var(--svc-surface-2)',
                border: '1px solid var(--svc-border)',
                borderRadius: 8,
                color: 'var(--svc-text-muted)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              No instruments match model <strong>"{selectedFca.instrumentModel}"</strong>.
              <br />
              Instruments are matched by their <strong>Instrument Model</strong> field (exact, case-insensitive) or —
              when that field is blank — by their name containing this model text. To link existing instruments, edit
              them and set the Instrument Model field to "{selectedFca.instrumentModel}".
            </div>
          ) : (
            <div className="svc-table-wrapper">
              <table className="svc-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>SN</th>
                    <th>Region</th>
                    <th>Country / Customer</th>
                    <th>Status</th>
                    <th>Completed</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {statusPager.pageItems.map((r) => (
                    <tr key={r.machineId}>
                      <td>{r.name || '—'}</td>
                      <td>
                        <span className="svc-mono">{r.serialNumber || '—'}</span>
                      </td>
                      <td>
                        <span className={`svc-badge ${r.region === 'overseas' ? 'badge-amber' : 'badge-green'}`}>
                          {r.region || 'local'}
                        </span>
                      </td>
                      <td>{r.country || '—'}</td>
                      <td>
                        <select
                          className="svc-select svc-select--sm"
                          value={r.status || 'Pending'}
                          onChange={(e) => handleStatusChange(r, { status: e.target.value })}
                        >
                          {FCA_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="svc-input"
                          value={r.completedDate ? String(r.completedDate).slice(0, 10) : ''}
                          onChange={(e) => handleStatusChange(r, { completedDate: e.target.value || null })}
                        />
                      </td>
                      <td>
                        <input
                          className="svc-input"
                          value={r.notes || ''}
                          placeholder="Optional notes"
                          onChange={(e) =>
                            setStatuses((prev) =>
                              prev.map((x) => (x.machineId === r.machineId ? { ...x, notes: e.target.value } : x)),
                            )
                          }
                          onBlur={(e) => handleStatusChange(r, { notes: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination {...statusPager} unit="instruments" />
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <FcaEditModal
          fca={editFca}
          onSave={handleSave}
          onClose={() => {
            setShowEdit(false);
            setEditFca(null);
          }}
          saving={saving}
        />
      )}
    </div>
  );
}

// ─── Main ServicePage ─────────────────────────────────────────────────────────

export default function ServicePage({ isAdmin = false, notify, machines, setMachines }) {
  const [subPage, setSubPage] = useState('dashboard'); // 'dashboard' | 'machines' | 'fca'
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fcaList, setFcaList] = useState([]);
  const [fcaLoading, setFcaLoading] = useState(false);
  const [showInstrumentFca, setShowInstrumentFca] = useState(null); // machine object
  const [search, setSearch] = useState('');
  const [filterModality, setFilterModality] = useState('All');
  const [filterContract, setFilterContract] = useState('All');
  const [filterMaint, setFilterMaint] = useState('All');
  const [filterCountry, setFilterCountry] = useState('All');
  // Region survives refresh — otherwise overseas imports look "missing" on reload
  const [region, setRegion] = useState(() => {
    try {
      const saved = localStorage.getItem('svc_region');
      return saved === 'overseas' ? 'overseas' : 'local';
    } catch {
      return 'local';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('svc_region', region);
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [region]);
  const [showModal, setShowModal] = useState(false);
  const [editMachine, setEditMachine] = useState(null);
  const [deleteMachine, setDeleteMachine] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetAll = useCallback(
    async (scopeRegion) => {
      setResetting(true);
      const res = await api.resetAllMachines({ region: scopeRegion });
      setResetting(false);
      if (res.ok) {
        notify?.('Registry reset', `${res.deleted} ${scopeRegion} instrument(s) removed`, 'success');
        // Drop the deleted rows from local state and refresh summary
        setMachines((prev) => prev.filter((m) => (m.region || 'local') !== scopeRegion));
        const sRes = await api.getMachineSummary({ region: scopeRegion });
        if (sRes) setSummary(sRes);
      } else {
        notify?.('Reset failed', res.error || 'Could not reset the registry', 'error');
      }
    },
    [notify, setMachines],
  );

  // Load data (region-scoped). Summary is recomputed when region changes.
  const loadData = useCallback(async () => {
    setLoading(true);
    const [mRes, sRes] = await Promise.all([api.getMachines({ all: true }), api.getMachineSummary({ region })]);
    if (mRes) setMachines(mRes);
    if (sRes) setSummary(sRes);
    setLoading(false);
  }, [setMachines, region]);

  const reloadFcas = useCallback(async () => {
    setFcaLoading(true);
    const res = await api.getFcaList();
    setFcaList(res || []);
    setFcaLoading(false);
  }, []);

  useEffect(() => {
    void loadData(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadData]);

  useEffect(() => {
    void reloadFcas(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [reloadFcas]);

  // Reset non-applicable filters when region changes to avoid a stuck filter
  const changeRegion = (r) => {
    if (r === region) return;
    setRegion(r);
    setFilterModality('All');
    setFilterCountry('All');
    setFilterMaint('All');
  };

  // Filter machines client-side: first by region, then by search/filters
  const filtered = useMemo(() => {
    let list = machines.filter((m) => (m.region || 'local') === region);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          (m.serialNumber || '').toLowerCase().includes(q) ||
          (m.customerName || '').toLowerCase().includes(q) ||
          (m.name || '').toLowerCase().includes(q) ||
          (m.modality || '').toLowerCase().includes(q) ||
          (m.country || '').toLowerCase().includes(q),
      );
    }
    if (filterModality !== 'All') list = list.filter((m) => m.modality === filterModality);
    if (filterCountry !== 'All') list = list.filter((m) => m.country === filterCountry);
    if (filterContract !== 'All') list = list.filter((m) => contractStatus(m) === filterContract);
    if (filterMaint !== 'All') list = list.filter((m) => maintenanceStatus(m) === filterMaint);
    return list;
  }, [machines, region, search, filterModality, filterCountry, filterContract, filterMaint]);

  const uniqueModalities = useMemo(
    () =>
      [
        ...new Set(
          machines
            .filter((m) => (m.region || 'local') === region)
            .map((m) => m.modality)
            .filter(Boolean),
        ),
      ].sort(),
    [machines, region],
  );

  const uniqueCountries = useMemo(
    () =>
      [
        ...new Set(
          machines
            .filter((m) => (m.region || 'local') === region)
            .map((m) => m.country)
            .filter(Boolean),
        ),
      ].sort(),
    [machines, region],
  );

  const instrumentModels = useMemo(() => [...new Set(machines.map((m) => m.model).filter(Boolean))].sort(), [machines]);

  // CRUD handlers
  const handleSave = async (form) => {
    setSaving(true);
    const payload = { ...form, region: form.region || region };
    // Clean empty optional dates (local + overseas)
    [
      'lastMaintenanceDate',
      'nextMaintenanceDate',
      'contractStart',
      'contractEnd',
      'deliveryDate',
      'installDate',
      'warrantyStart',
      'warrantyEnd',
      'iqoqDate',
    ].forEach((k) => {
      if (!payload[k]) payload[k] = null;
    });
    // Coerce numeric fields (blank → null so NULL is stored)
    ['price', 'iqoqPrice'].forEach((k) => {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
      else if (payload[k] !== null) payload[k] = Number(payload[k]);
    });
    let result;
    if (editMachine?.id) {
      result = await api.updateMachine(editMachine.id, payload);
      if (result) {
        setMachines((prev) => prev.map((m) => (m.id === result.id ? result : m)));
        notify?.('Instrument Updated', `${result.name || result.serialNumber} updated`, 'success');
      }
    } else {
      result = await api.createMachine(payload);
      if (result) {
        setMachines((prev) => [result, ...prev]);
        notify?.('Instrument Added', `${result.name || result.serialNumber} added`, 'success');
      }
    }
    if (!result) notify?.('Save Failed', 'Could not save instrument. Please retry.', 'error');
    setSaving(false);
    setShowModal(false);
    setEditMachine(null);
    const sRes = await api.getMachineSummary({ region });
    if (sRes) setSummary(sRes);
  };

  const handleDelete = async (machine) => {
    const ok = await api.deleteMachine(machine.id);
    if (ok) {
      setMachines((prev) => prev.filter((m) => m.id !== machine.id));
      notify?.('Deleted', `${machine.name || machine.serialNumber} removed`, 'success');
    } else {
      notify?.('Delete Failed', 'Could not delete instrument.', 'error');
    }
    setDeleteMachine(null);
    const sRes = await api.getMachineSummary({ region });
    if (sRes) setSummary(sRes);
  };

  const handleImportDone = (newMachines) => {
    setMachines((prev) => [...newMachines, ...prev]);
    setShowImport(false);
    notify?.('Import Complete', `${newMachines.length} instrument(s) imported`, 'success');
    api.getMachineSummary({ region }).then((sRes) => {
      if (sRes) setSummary(sRes);
    });
  };

  // Export to Excel (region-specific columns)
  const handleExport = () => {
    const isOverseas = region === 'overseas';
    const rows = filtered.map((m) =>
      isOverseas
        ? {
            Country: m.country || '',
            Inst: m.name || '',
            SN: m.serialNumber || '',
            Location: m.location || '',
            'Delivery Date': normalizeDate(m.deliveryDate),
            'Installation Date': normalizeDate(m.installDate),
            'Warranty Start': normalizeDate(m.warrantyStart),
            'Warranty End': normalizeDate(m.warrantyEnd),
            'Days Left': daysLeftFromToday(m.warrantyEnd) ?? '',
            'PM Spare part': m.pmSparePart || '',
            'SAP Code': m.sapCode || '',
            'Proposed Service Contract': m.proposedServiceContract || '',
            Price: m.price ?? '',
            'Contract Start': normalizeDate(m.contractStart),
            'Contract End': normalizeDate(m.contractEnd),
            'Contract Status': contractStatus(m),
            IQOQ: m.iqoq || '',
            'IQOQ Date': normalizeDate(m.iqoqDate),
            'IQOQ Price': m.iqoqPrice ?? '',
          }
        : {
            'Instrument Name': m.name || '',
            'Serial Number': m.serialNumber || '',
            Modality: m.modality || '',
            Location: m.location || '',
            Status: m.status || '',
            Customer: m.customerName || '',
            'Contact Person': m.customerContact || '',
            'Contact Email': m.customerEmail || '',
            'Maintenance Period (m)': m.maintenancePeriodMonths || '',
            'Last Maintenance': normalizeDate(m.lastMaintenanceDate),
            'Next Maintenance': normalizeDate(m.nextMaintenanceDate),
            'Maint. Status': maintenanceStatus(m),
            'Contract Type': m.contractType || '',
            'Contract Start': normalizeDate(m.contractStart),
            'Contract End': normalizeDate(m.contractEnd),
            'Contract Status': contractStatus(m),
            Remark: m.remark || '',
          },
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const sheetName = isOverseas ? 'Overseas Instruments' : 'Service Instruments';
    const filePrefix = isOverseas ? 'overseas-instruments' : 'service-instruments';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filePrefix}-${today()}.xlsx`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{SERVICE_CSS}</style>
      <div className="svc-page">
        {/* Sub-nav */}
        <div className="svc-subnav">
          <button
            className={`svc-subnav-btn ${subPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setSubPage('dashboard')}
          >
            <LayoutDashboard size={15} /> Dashboard
          </button>
          <button
            className={`svc-subnav-btn ${subPage === 'machines' ? 'active' : ''}`}
            onClick={() => setSubPage('machines')}
          >
            <List size={15} /> Instrument Registry
          </button>
          <button className={`svc-subnav-btn ${subPage === 'fca' ? 'active' : ''}`} onClick={() => setSubPage('fca')}>
            <ShieldAlert size={15} /> FCA
          </button>
          <div className="svc-region-toggle" role="group" aria-label="Instrument region">
            <button
              type="button"
              className={`svc-region-btn ${region === 'local' ? 'active' : ''}`}
              onClick={() => changeRegion('local')}
            >
              <Home size={13} /> Local
            </button>
            <button
              type="button"
              className={`svc-region-btn ${region === 'overseas' ? 'active' : ''}`}
              onClick={() => changeRegion('overseas')}
            >
              <Globe size={13} /> Overseas
            </button>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="svc-icon-btn" onClick={loadData} title="Refresh" disabled={loading}>
              <RefreshCw size={15} className={loading ? 'svc-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Content */}
        {subPage === 'dashboard' ? (
          <Dashboard
            summary={summary}
            machines={machines.filter((m) => (m.region || 'local') === region)}
            region={region}
          />
        ) : subPage === 'fca' ? (
          <FcaPage
            isAdmin={isAdmin}
            notify={notify}
            fcaList={fcaList}
            fcaLoading={fcaLoading}
            reloadFcas={reloadFcas}
            instrumentModels={instrumentModels}
          />
        ) : (
          <Registry
            region={region}
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            loading={loading}
            filterModality={filterModality}
            setFilterModality={setFilterModality}
            filterContract={filterContract}
            setFilterContract={setFilterContract}
            filterMaint={filterMaint}
            setFilterMaint={setFilterMaint}
            filterCountry={filterCountry}
            setFilterCountry={setFilterCountry}
            uniqueModalities={uniqueModalities}
            uniqueCountries={uniqueCountries}
            handleExport={handleExport}
            setShowImport={setShowImport}
            setEditMachine={setEditMachine}
            setShowModal={setShowModal}
            setDeleteMachine={setDeleteMachine}
            setShowInstrumentFca={setShowInstrumentFca}
            isAdmin={isAdmin}
            handleResetAll={handleResetAll}
            resetting={resetting}
          />
        )}

        {/* Modals */}
        {showModal && (
          <MachineModal
            machine={editMachine}
            region={region}
            onSave={handleSave}
            onClose={() => {
              setShowModal(false);
              setEditMachine(null);
            }}
            saving={saving}
          />
        )}
        {deleteMachine && (
          <DeleteConfirm machine={deleteMachine} onConfirm={handleDelete} onClose={() => setDeleteMachine(null)} />
        )}
        {showImport && (
          <ImportModal
            isAdmin={isAdmin}
            region={region}
            onImport={handleImportDone}
            onClose={() => setShowImport(false)}
          />
        )}
        {showInstrumentFca && (
          <InstrumentFcaStatusModal
            machine={showInstrumentFca}
            notify={notify}
            onClose={() => setShowInstrumentFca(null)}
          />
        )}
        <datalist id="svc-instrument-models">
          {instrumentModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
    </>
  );
}

// ─── CSS (scoped) ─────────────────────────────────────────────────────────────

const SERVICE_CSS = `
/* === SERVICE MODULE THEME === */
.svc-page {
  --svc-primary: #6366f1;
  --svc-primary-dark: #4f46e5;
  --svc-danger: #ef4444;
  --svc-success: #22c55e;
  --svc-warning: #f59e0b;
  --svc-bg: #0f172a;
  --svc-surface: #1e293b;
  --svc-surface-2: #293548;
  --svc-border: #334155;
  --svc-text: #f1f5f9;
  --svc-text-muted: #94a3b8;
  --svc-text-subtle: #64748b;
  background: var(--svc-bg);
  min-height: 100%;
  padding: 0;
  color: var(--svc-text);
  font-family: inherit;
}

/* Sub-nav */
.svc-subnav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  background: var(--svc-surface);
  border-bottom: 1px solid var(--svc-border);
}
.svc-subnav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--svc-text-muted);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.svc-subnav-btn:hover { background: var(--svc-surface-2); color: var(--svc-text); }
.svc-subnav-btn.active { background: var(--svc-primary); color: #fff; }

/* Region toggle (Local vs Overseas) */
.svc-region-toggle {
  display: inline-flex;
  margin-left: 16px;
  padding: 3px;
  gap: 2px;
  border-radius: 8px;
  background: var(--svc-surface-2);
  border: 1px solid var(--svc-border);
}
.svc-region-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: var(--svc-text-muted);
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.svc-region-btn:hover { color: var(--svc-text); }
.svc-region-btn.active { background: var(--svc-primary); color: #fff; }

/* FCA page */
.svc-fca { padding: 20px; }
.svc-fca__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.svc-fca__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.svc-fca-card {
  text-align: left;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--svc-border);
  background: var(--svc-surface);
  color: var(--svc-text);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font: inherit;
}
.svc-fca-card:hover { transform: translateY(-1px); border-color: var(--svc-primary); }
.svc-fca-card.active { border-color: var(--svc-primary); background: rgba(99,102,241,0.08); }
.svc-fca-card__num { font-size: 15px; font-weight: 700; color: var(--svc-primary); }
.svc-fca-card__title {
  font-size: 12.5px;
  color: var(--svc-text);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.svc-fca-card__meta {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: var(--svc-text-muted);
  margin-top: 2px;
}
.svc-fca-card__date { font-size: 11px; color: var(--svc-text-subtle); margin-left: auto; }
.svc-fca__empty {
  grid-column: 1 / -1;
  padding: 32px;
  text-align: center;
  color: var(--svc-text-muted);
  background: var(--svc-surface);
  border: 1px dashed var(--svc-border);
  border-radius: 10px;
}
.svc-fca__detail {
  background: var(--svc-surface);
  border: 1px solid var(--svc-border);
  border-radius: 12px;
  padding: 18px 20px;
}
.svc-fca__detail-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.svc-fca__detail-head h3 { font-size: 15px; font-weight: 600; margin: 0; color: var(--svc-text); }
.svc-fca__detail-title { font-size: 13px; color: var(--svc-text-muted); margin-top: 4px; }
.svc-fca__detail-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.svc-fca__detail-desc {
  font-size: 13px;
  color: var(--svc-text-muted);
  white-space: pre-wrap;
  margin: 10px 0 0;
  padding: 10px 12px;
  background: var(--svc-surface-2);
  border-radius: 8px;
}

/* Dashboard */
.svc-dashboard { padding: 24px 20px; }
.svc-dash-grid {
  display: grid;
  /* Six summary cards. auto-fill produced five columns at some widths, which
     left the sixth card stranded on its own row beside a wide empty gap.
     Step through counts that divide six evenly instead. */
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
@media (max-width: 1600px) {
  .svc-dash-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .svc-dash-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.svc-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 12px;
  background: var(--svc-surface);
  border: 1px solid var(--svc-border);
  transition: transform 0.15s, box-shadow 0.15s;
}
.svc-card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
.svc-card__icon {
  width: 44px; height: 44px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.svc-card--blue .svc-card__icon  { background: rgba(99,102,241,0.15); color: #818cf8; }
.svc-card--green .svc-card__icon { background: rgba(34,197,94,0.15);  color: #4ade80; }
.svc-card--amber .svc-card__icon { background: rgba(245,158,11,0.15); color: #fbbf24; }
.svc-card--red .svc-card__icon   { background: rgba(239,68,68,0.15);  color: #f87171; }
.svc-card__value { font-size: 28px; font-weight: 700; line-height: 1; }
.svc-card__label { font-size: 12px; color: var(--svc-text-muted); margin-top: 2px; }
.svc-card__sub   { font-size: 11px; color: var(--svc-text-subtle); margin-top: 1px; }

.svc-section-heading { font-size: 15px; font-weight: 600; margin-bottom: 14px; color: var(--svc-text); }
.svc-alerts-section { background: var(--svc-surface); border-radius: 12px; padding: 20px; border: 1px solid var(--svc-border); }
.svc-empty-alert { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; color: var(--svc-text-muted); font-size: 14px; }
.svc-alert-table-wrapper { overflow-x: auto; }

/* Registry */
.svc-registry { padding: 20px; }
.svc-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.svc-search-wrap { position: relative; flex: 1; min-width: 220px; }
.svc-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--svc-text-subtle); }
.svc-search {
  width: 100%; padding: 8px 12px 8px 32px;
  background: var(--svc-surface);
  border: 1px solid var(--svc-border);
  border-radius: 8px;
  color: var(--svc-text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.svc-search:focus { border-color: var(--svc-primary); }
.svc-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.svc-filter-group { display: flex; align-items: center; gap: 4px; color: var(--svc-text-subtle); }
.svc-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.svc-result-count { font-size: 12px; color: var(--svc-text-muted); margin-bottom: 10px; }
.svc-pagination-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.svc-pagination-top label { font-size: 12px; color: var(--svc-text-muted); }
.svc-pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; margin-top: 14px;
}
.svc-pagination__info { font-size: 12px; color: var(--svc-text-muted); min-width: 120px; text-align: center; }

/* Table */
.svc-table-wrapper { overflow-x: auto; border-radius: 10px; border: 1px solid var(--svc-border); }
.svc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.svc-table thead th {
  padding: 10px 12px;
  background: var(--svc-surface);
  color: var(--svc-text-muted);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--svc-border);
  position: sticky; top: 0;
}
.svc-table tbody tr { border-bottom: 1px solid var(--svc-border); transition: background 0.1s; }
.svc-table tbody tr:hover { background: var(--svc-surface-2); }
.svc-table tbody tr:last-child { border-bottom: none; }
.svc-table td { padding: 10px 12px; vertical-align: top; }
.svc-row--alert { background: rgba(239,68,68,0.04); }
.svc-td-num { color: var(--svc-text-subtle); font-size: 12px; }
.svc-mono { font-family: 'Courier New', monospace; font-size: 12px; background: rgba(99,102,241,0.1); padding: 2px 6px; border-radius: 4px; }
.svc-sub-text { font-size: 11px; color: var(--svc-text-muted); margin-top: 2px; }
.svc-remark { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--svc-text-muted); font-size: 12px; }
.svc-row-actions { display: flex; gap: 4px; }

/* Badges */
.svc-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 600;
}
.badge-green { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge-amber { background: rgba(245,158,11,0.15); color: #fbbf24; }
.badge-red   { background: rgba(239,68,68,0.15);  color: #f87171; }
.badge-gray  { background: rgba(100,116,139,0.15); color: #94a3b8; }

/* Buttons */
.svc-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: none;
  font-size: 13.5px; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.svc-btn--sm { padding: 6px 12px; font-size: 12.5px; }
.svc-btn--primary { background: var(--svc-primary); color: #fff; }
.svc-btn--primary:hover:not(:disabled) { background: var(--svc-primary-dark); }
.svc-btn--ghost { background: var(--svc-surface); color: var(--svc-text-muted); border: 1px solid var(--svc-border); }
.svc-btn--ghost:hover { background: var(--svc-surface-2); color: var(--svc-text); }
.svc-btn--danger { background: #dc2626; color: #fff; }
.svc-btn--danger:hover { background: #b91c1c; }
.svc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Icon buttons */
.svc-icon-btn {
  padding: 6px; border-radius: 6px; border: none;
  background: transparent; color: var(--svc-text-muted);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.svc-icon-btn:hover { background: var(--svc-surface-2); color: var(--svc-text); }
.svc-icon-btn--edit:hover  { color: #818cf8; background: rgba(99,102,241,0.1); }
.svc-icon-btn--delete:hover { color: #f87171; background: rgba(239,68,68,0.1); }

/* Modal */
.svc-modal-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 60px 16px 16px; overflow-y: auto;
}
.svc-modal {
  background: var(--svc-surface);
  border: 1px solid var(--svc-border);
  border-radius: 14px;
  width: 100%; max-width: 680px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  animation: svc-slide-in 0.2s ease;
  margin-bottom: 16px;
}
.svc-modal--sm { max-width: 420px; }
.svc-modal--lg { max-width: 820px; }
@keyframes svc-slide-in { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
.svc-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid var(--svc-border);
}
.svc-modal__header h2 { font-size: 16px; font-weight: 600; margin: 0; }
.svc-modal__body { padding: 20px; }
.svc-modal__footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--svc-border); }

/* Form */
.svc-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--svc-primary); margin: 18px 0 10px; padding-bottom: 6px;
  border-bottom: 1px solid rgba(99,102,241,0.2);
}
.svc-section-title:first-child { margin-top: 0; }
.svc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 540px) { .svc-grid-2 { grid-template-columns: 1fr; } }
.svc-field { display: flex; flex-direction: column; gap: 4px; }
.svc-field__label { font-size: 12px; font-weight: 500; color: var(--svc-text-muted); }
.svc-required { color: #f87171; }
.svc-input, .svc-select, .svc-textarea {
  padding: 8px 10px; background: var(--svc-surface-2);
  border: 1px solid var(--svc-border); border-radius: 7px;
  color: var(--svc-text); font-size: 13px; outline: none; transition: border-color 0.15s;
  font-family: inherit;
}
.svc-input:focus, .svc-select:focus, .svc-textarea:focus { border-color: var(--svc-primary); }
.svc-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 28px; }
.svc-select--sm { font-size: 12px; padding: 6px 24px 6px 8px; }
.svc-textarea { resize: vertical; min-height: 72px; }

/* Upload zone */
.svc-upload-zone {
  text-align: center; padding: 48px 24px;
  border: 2px dashed var(--svc-border); border-radius: 12px;
  background: var(--svc-surface-2);
}

/* Spin */
.svc-spin { animation: svc-spin 1s linear infinite; }
@keyframes svc-spin { to { transform: rotate(360deg); } }

/* ─── Responsive: show/hide ─── */
.svc-mobile-only { display: none; }

/* ─── Mobile card styles ─── */
.svc-mobile-empty {
  text-align: center; padding: 40px 16px;
  color: var(--svc-text-muted); font-size: 14px;
}
.svc-mcard {
  background: var(--svc-surface);
  border: 1px solid var(--svc-border);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  transition: box-shadow 0.15s;
}
.svc-mcard--alert { border-left: 3px solid #ef4444; }
.svc-mcard__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px;
}
.svc-mcard__title {
  display: flex; align-items: center; gap: 8px;
  min-width: 0; flex: 1;
}
.svc-mcard__num {
  font-size: 11px; color: var(--svc-text-subtle); font-weight: 600;
  flex-shrink: 0;
}
.svc-mcard__name {
  font-size: 14px; font-weight: 600; color: var(--svc-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.svc-mcard__actions { display: flex; gap: 2px; flex-shrink: 0; }
.svc-mcard__serial { margin-bottom: 8px; }
.svc-mcard__badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.svc-mcard__grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}
.svc-mcard__field { display: flex; flex-direction: column; gap: 1px; }
.svc-mcard__label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--svc-text-subtle); }
.svc-mcard__val { font-size: 13px; color: var(--svc-text); }
.svc-mcard__remark {
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid var(--svc-border);
  font-size: 12px; color: var(--svc-text-muted);
  font-style: italic;
}

/* ─── Mobile breakpoint ─── */
@media (max-width: 768px) {
  .svc-desktop-only { display: none; }
  .svc-mobile-only  { display: block; }

  .svc-page { font-size: 13px; }

  /* Sub-nav compact */
  .svc-subnav { padding: 8px 12px; gap: 2px; }
  .svc-subnav-btn { padding: 6px 12px; font-size: 12.5px; }

  /* Dashboard compact */
  .svc-dashboard { padding: 14px 12px; }
  .svc-dash-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .svc-card { padding: 12px 14px; gap: 10px; }
  .svc-card__icon { width: 36px; height: 36px; border-radius: 8px; }
  .svc-card__icon svg { width: 16px; height: 16px; }
  .svc-card__value { font-size: 22px; }
  .svc-card__label { font-size: 11px; }
  .svc-section-heading { font-size: 13px; }
  .svc-alerts-section { padding: 12px; }

  /* Registry compact */
  .svc-registry { padding: 12px; }

  /* Toolbar: stack vertically */
  .svc-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .svc-search-wrap { min-width: unset; width: 100%; }
  .svc-filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: 100%;
  }
  .svc-filter-group { width: 100%; }
  .svc-filter-group .svc-select { width: 100%; }
  .svc-filters .svc-select { width: 100%; }
  .svc-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    width: 100%;
  }
  .svc-actions .svc-btn { justify-content: center; font-size: 12px; padding: 7px 6px; }

  /* Modal full-width on mobile */
  .svc-modal-overlay { padding: 16px 8px; align-items: flex-start; }
  .svc-modal { max-width: 100%; border-radius: 12px; }
  .svc-modal__header { padding: 14px 14px; }
  .svc-modal__header h2 { font-size: 15px; }
  .svc-modal__body { padding: 14px; }

  /* Alert table scroll */
  .svc-alert-table-wrapper { margin: 0 -12px; padding: 0 12px; }
}

/* ─── Small phone breakpoint ─── */
@media (max-width: 400px) {
  .svc-dash-grid { grid-template-columns: 1fr; }
  .svc-card__value { font-size: 20px; }
  .svc-mcard__grid { grid-template-columns: 1fr; }
  .svc-actions { grid-template-columns: 1fr 1fr; }
  .svc-subnav-btn { padding: 6px 10px; font-size: 12px; }
  .svc-filters { grid-template-columns: 1fr; }
}
`;
