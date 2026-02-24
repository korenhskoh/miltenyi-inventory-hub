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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api.js';

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

const today = () => new Date().toISOString().slice(0, 10);
const in30 = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

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

// ─── Machine Modal ────────────────────────────────────────────────────────────

const EMPTY_MACHINE = {
  name: '',
  serialNumber: '',
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
};

function MachineModal({ machine, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_MACHINE,
    ...(machine || {}),
  }));

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Auto-compute next maintenance from last + period
  const handleLastMaintenanceChange = (val) => {
    set('lastMaintenanceDate', val);
    if (val && form.maintenancePeriodMonths) {
      const d = new Date(val);
      d.setMonth(d.getMonth() + Number(form.maintenancePeriodMonths));
      set('nextMaintenanceDate', d.toISOString().slice(0, 10));
    }
  };

  const handlePeriodChange = (val) => {
    set('maintenancePeriodMonths', Number(val));
    if (form.lastMaintenanceDate) {
      const d = new Date(form.lastMaintenanceDate);
      d.setMonth(d.getMonth() + Number(val));
      set('nextMaintenanceDate', d.toISOString().slice(0, 10));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.modality) return;
    onSave(form);
  };

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="svc-modal__header">
          <h2>{machine ? 'Edit Machine' : 'Add Machine'}</h2>
          <button className="svc-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="svc-modal__body">
          <div className="svc-section-title">Machine Identity</div>
          <div className="svc-grid-2">
            <Field label="Machine Name">
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
            <Field label="Modality" required>
              <select
                className="svc-select"
                value={form.modality}
                onChange={(e) => set('modality', e.target.value)}
                required
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

          <div className="svc-section-title">Contract Details</div>
          <div className="svc-grid-2">
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
              {saving ? 'Saving...' : machine ? 'Save Changes' : 'Add Machine'}
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
          <h2>Delete Machine</h2>
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

const IMPORT_COLUMNS = [
  { key: 'name', label: 'Machine Name' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'modality', label: 'Modality' },
  { key: 'location', label: 'Location' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'customerContact', label: 'Contact Person' },
  { key: 'customerEmail', label: 'Contact Email' },
  { key: 'maintenancePeriodMonths', label: 'Maintenance Period (months)' },
  { key: 'lastMaintenanceDate', label: 'Last Maintenance Date' },
  { key: 'nextMaintenanceDate', label: 'Next Maintenance Date' },
  { key: 'contractType', label: 'Contract Type' },
  { key: 'contractStart', label: 'Contract Start Date' },
  { key: 'contractEnd', label: 'Contract End Date' },
  { key: 'status', label: 'Status' },
  { key: 'remark', label: 'Remark' },
];

function ImportModal({ onImport, onClose }) {
  const [step, setStep] = useState('upload'); // upload | map | preview | done
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [colMap, setColMap] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'YYYY-MM-DD' });
      if (data.length < 2) return;
      const hdrs = data[0].map(String);
      setHeaders(hdrs);
      setRows(data.slice(1).filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined)));
      // Auto-map: fuzzy match headers
      const autoMap = {};
      IMPORT_COLUMNS.forEach(({ key, label }) => {
        const match = hdrs.find(
          (h) =>
            h.toLowerCase().replace(/[\s_/()-]/g, '') === label.toLowerCase().replace(/[\s_/()-]/g, '') ||
            h.toLowerCase().replace(/[\s_/()-]/g, '') === key.toLowerCase(),
        );
        if (match) autoMap[key] = match;
      });
      setColMap(autoMap);
      setStep('map');
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    setImporting(true);
    const machines = rows.map((row) => {
      const obj = {};
      IMPORT_COLUMNS.forEach(({ key }) => {
        const hdr = colMap[key];
        if (!hdr) return;
        const idx = headers.indexOf(hdr);
        if (idx === -1) return;
        let val = row[idx];
        if (val === '' || val === undefined || val === null) return;
        if (key === 'maintenancePeriodMonths') val = parseInt(val) || 12;
        // Normalize date strings
        if (['lastMaintenanceDate', 'nextMaintenanceDate', 'contractStart', 'contractEnd'].includes(key)) {
          if (val && !String(val).match(/^\d{4}-\d{2}-\d{2}$/)) {
            try {
              val = new Date(val).toISOString().slice(0, 10);
            } catch {
              val = null;
            }
          }
        }
        obj[key] = val;
      });
      return obj;
    });
    const res = await api.bulkImportMachines(machines);
    setResult(res);
    setImporting(false);
    if (res?.inserted > 0) {
      setStep('done');
      onImport(res.machines || []);
    }
  };

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal svc-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="svc-modal__header">
          <h2>Import Machines from Excel / CSV</h2>
          <button className="svc-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="svc-modal__body">
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
              <p style={{ marginBottom: 16, color: 'var(--svc-text-muted)' }}>
                <strong>{fileName}</strong> — {rows.length} data rows detected. Map your columns:
              </p>
              <div className="svc-grid-2" style={{ maxHeight: 400, overflowY: 'auto' }}>
                {IMPORT_COLUMNS.map(({ key, label }) => (
                  <div key={key} className="svc-field">
                    <label className="svc-field__label">{label}</label>
                    <select
                      className="svc-select"
                      value={colMap[key] || ''}
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
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle size={48} style={{ color: '#22c55e', marginBottom: 12 }} />
              <h3 style={{ marginBottom: 8 }}>Import Complete</h3>
              <p style={{ color: 'var(--svc-text-muted)' }}>
                ✅ {result.inserted} machine(s) imported successfully
                {result.errors?.length > 0 && (
                  <span style={{ color: '#ef4444' }}>, ⚠️ {result.errors.length} row(s) failed</span>
                )}
              </p>
              <button className="svc-btn svc-btn--primary" style={{ marginTop: 16 }} onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Sub-view ──────────────────────────────────────────────────────

function Dashboard({ summary, machines }) {
  return (
    <div className="svc-dashboard">
      <div className="svc-dash-grid">
        <SummaryCard
          label="Total Machines"
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
        {machines.filter(
          (m) =>
            contractStatus(m) === 'Expired' ||
            contractStatus(m) === 'Expiring' ||
            maintenanceStatus(m) === 'Overdue' ||
            maintenanceStatus(m) === 'Due',
        ).length === 0 ? (
          <div className="svc-empty-alert">
            <CheckCircle size={32} style={{ color: '#22c55e' }} />
            <p>All machines are up to date. No action required!</p>
          </div>
        ) : (
          <div className="svc-alert-table-wrapper">
            <table className="svc-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Serial No</th>
                  <th>Customer</th>
                  <th>Modality</th>
                  <th>Maintenance</th>
                  <th>Contract</th>
                </tr>
              </thead>
              <tbody>
                {machines
                  .filter(
                    (m) =>
                      contractStatus(m) === 'Expired' ||
                      contractStatus(m) === 'Expiring' ||
                      maintenanceStatus(m) === 'Overdue' ||
                      maintenanceStatus(m) === 'Due',
                  )
                  .slice(0, 10)
                  .map((m) => (
                    <tr key={m.id}>
                      <td>{m.name || '\u2014'}</td>
                      <td>
                        <span className="svc-mono">{m.serialNumber || '\u2014'}</span>
                      </td>
                      <td>{m.customerName || '\u2014'}</td>
                      <td>{m.modality}</td>
                      <td>
                        <MaintBadge status={maintenanceStatus(m)} />
                      </td>
                      <td>
                        <ContractBadge status={contractStatus(m)} />
                      </td>
                    </tr>
                  ))}
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
  uniqueModalities,
  handleExport,
  setShowImport,
  setEditMachine,
  setShowModal,
  setDeleteMachine,
}) {
  return (
    <div className="svc-registry">
      {/* Toolbar */}
      <div className="svc-toolbar">
        <div className="svc-search-wrap">
          <Search size={15} className="svc-search-icon" />
          <input
            className="svc-search"
            placeholder="Search serial, customer, machine, modality\u2026"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="svc-filters">
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
          <select
            className="svc-select svc-select--sm"
            value={filterMaint}
            onChange={(e) => setFilterMaint(e.target.value)}
          >
            <option value="All">All Maintenance</option>
            <option value="Overdue">Overdue</option>
            <option value="Due">Due Soon</option>
            <option value="OK">OK</option>
          </select>
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
          <button
            className="svc-btn svc-btn--primary svc-btn--sm"
            onClick={() => {
              setEditMachine(null);
              setShowModal(true);
            }}
          >
            <Plus size={14} /> Add Machine
          </button>
        </div>
      </div>

      {/* Result count */}
      <div className="svc-result-count">
        {loading ? 'Loading\u2026' : `${filtered.length} machine${filtered.length !== 1 ? 's' : ''} found`}
      </div>

      {/* Desktop Table */}
      <div className="svc-table-wrapper svc-desktop-only">
        <table className="svc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Serial No</th>
              <th>Machine Name</th>
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
                  {loading ? 'Loading machines\u2026' : 'No machines found. Add one to get started.'}
                </td>
              </tr>
            ) : (
              filtered.map((m, i) => {
                const cs = contractStatus(m);
                const ms = maintenanceStatus(m);
                return (
                  <tr key={m.id} className={cs === 'Expired' || ms === 'Overdue' ? 'svc-row--alert' : ''}>
                    <td className="svc-td-num">{i + 1}</td>
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
      </div>

      {/* Mobile Card List */}
      <div className="svc-mobile-only">
        {filtered.length === 0 ? (
          <div className="svc-mobile-empty">
            {loading ? 'Loading machines\u2026' : 'No machines found. Add one to get started.'}
          </div>
        ) : (
          filtered.map((m, i) => {
            const cs = contractStatus(m);
            const ms = maintenanceStatus(m);
            return (
              <div key={m.id} className={`svc-mcard ${cs === 'Expired' || ms === 'Overdue' ? 'svc-mcard--alert' : ''}`}>
                <div className="svc-mcard__head">
                  <div className="svc-mcard__title">
                    <span className="svc-mcard__num">#{i + 1}</span>
                    <span className="svc-mcard__name">{m.name || m.modality || 'Machine'}</span>
                  </div>
                  <div className="svc-mcard__actions">
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
                  <MaintBadge status={ms} />
                  <ContractBadge status={cs} />
                </div>
                <div className="svc-mcard__grid">
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
                </div>
                {m.remark && <div className="svc-mcard__remark">{m.remark}</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main ServicePage ─────────────────────────────────────────────────────────

export default function ServicePage({ notify, machines, setMachines }) {
  const [subPage, setSubPage] = useState('dashboard'); // 'dashboard' | 'machines'
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterModality, setFilterModality] = useState('All');
  const [filterContract, setFilterContract] = useState('All');
  const [filterMaint, setFilterMaint] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editMachine, setEditMachine] = useState(null);
  const [deleteMachine, setDeleteMachine] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    const [mRes, sRes] = await Promise.all([api.getMachines(), api.getMachineSummary()]);
    if (mRes) setMachines(mRes);
    if (sRes) setSummary(sRes);
    setLoading(false);
  }, [setMachines]);

  useEffect(() => {
    void loadData(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadData]);

  // Filter machines client-side for instant feedback
  const filtered = useMemo(() => {
    let list = [...machines];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          (m.serialNumber || '').toLowerCase().includes(q) ||
          (m.customerName || '').toLowerCase().includes(q) ||
          (m.name || '').toLowerCase().includes(q) ||
          (m.modality || '').toLowerCase().includes(q),
      );
    }
    if (filterModality !== 'All') list = list.filter((m) => m.modality === filterModality);
    if (filterContract !== 'All') list = list.filter((m) => contractStatus(m) === filterContract);
    if (filterMaint !== 'All') list = list.filter((m) => maintenanceStatus(m) === filterMaint);
    return list;
  }, [machines, search, filterModality, filterContract, filterMaint]);

  const uniqueModalities = useMemo(
    () => [...new Set(machines.map((m) => m.modality).filter(Boolean))].sort(),
    [machines],
  );

  // CRUD handlers
  const handleSave = async (form) => {
    setSaving(true);
    const payload = { ...form };
    // Clean empty optional dates
    ['lastMaintenanceDate', 'nextMaintenanceDate', 'contractStart', 'contractEnd'].forEach((k) => {
      if (!payload[k]) payload[k] = null;
    });
    let result;
    if (editMachine?.id) {
      result = await api.updateMachine(editMachine.id, payload);
      if (result) {
        setMachines((prev) => prev.map((m) => (m.id === result.id ? result : m)));
        notify?.('Machine Updated', `${result.name || result.serialNumber} updated`, 'success');
      }
    } else {
      result = await api.createMachine(payload);
      if (result) {
        setMachines((prev) => [result, ...prev]);
        notify?.('Machine Added', `${result.name || result.serialNumber} added`, 'success');
      }
    }
    if (!result) notify?.('Save Failed', 'Could not save machine. Please retry.', 'error');
    setSaving(false);
    setShowModal(false);
    setEditMachine(null);
    // Refresh summary
    const sRes = await api.getMachineSummary();
    if (sRes) setSummary(sRes);
  };

  const handleDelete = async (machine) => {
    const ok = await api.deleteMachine(machine.id);
    if (ok) {
      setMachines((prev) => prev.filter((m) => m.id !== machine.id));
      notify?.('Deleted', `${machine.name || machine.serialNumber} removed`, 'success');
    } else {
      notify?.('Delete Failed', 'Could not delete machine.', 'error');
    }
    setDeleteMachine(null);
    const sRes = await api.getMachineSummary();
    if (sRes) setSummary(sRes);
  };

  const handleImportDone = (newMachines) => {
    setMachines((prev) => [...newMachines, ...prev]);
    setShowImport(false);
    notify?.('Import Complete', `${newMachines.length} machine(s) imported`, 'success');
    api.getMachineSummary().then((sRes) => {
      if (sRes) setSummary(sRes);
    });
  };

  // Export to Excel
  const handleExport = () => {
    const rows = filtered.map((m) => ({
      'Machine Name': m.name || '',
      'Serial Number': m.serialNumber || '',
      Modality: m.modality || '',
      Location: m.location || '',
      Status: m.status || '',
      Customer: m.customerName || '',
      'Contact Person': m.customerContact || '',
      'Contact Email': m.customerEmail || '',
      'Maintenance Period (m)': m.maintenancePeriodMonths || '',
      'Last Maintenance': m.lastMaintenanceDate || '',
      'Next Maintenance': m.nextMaintenanceDate || '',
      'Maint. Status': maintenanceStatus(m),
      'Contract Type': m.contractType || '',
      'Contract Start': m.contractStart || '',
      'Contract End': m.contractEnd || '',
      'Contract Status': contractStatus(m),
      Remark: m.remark || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Service Machines');
    XLSX.writeFile(wb, `service-machines-${today()}.xlsx`);
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
            <List size={15} /> Machine Registry
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <button className="svc-icon-btn" onClick={loadData} title="Refresh" disabled={loading}>
              <RefreshCw size={15} className={loading ? 'svc-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Content */}
        {subPage === 'dashboard' ? (
          <Dashboard summary={summary} machines={machines} />
        ) : (
          <Registry
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
            uniqueModalities={uniqueModalities}
            handleExport={handleExport}
            setShowImport={setShowImport}
            setEditMachine={setEditMachine}
            setShowModal={setShowModal}
            setDeleteMachine={setDeleteMachine}
          />
        )}

        {/* Modals */}
        {showModal && (
          <MachineModal
            machine={editMachine}
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
        {showImport && <ImportModal onImport={handleImportDone} onClose={() => setShowImport(false)} />}
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

/* Dashboard */
.svc-dashboard { padding: 24px 20px; }
.svc-dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
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
