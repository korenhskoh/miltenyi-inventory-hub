import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Download,
  Upload,
  X,
  Package,
  Minus,
  History,
  AlertTriangle,
  Filter,
  ClipboardCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api.js';
import { parseSheet, autoDetectColumns, toNumber, isBlank, toNumberOrNull } from '../lib/sheet.js';
import { fmtDate, fmtNum, applySortData, toggleSort, exportToFile } from '../utils.js';
import Pagination, { usePagination } from '../components/Pagination.jsx';

// ─── CSS ──────────────────────────────────────────────────────────────────────
const LI_CSS = `
.li-wrap{font-family:system-ui,-apple-system,sans-serif;color:#1A202C}
.li-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden}
.li-th{padding:8px 12px;text-align:left;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.5px;font-weight:600;border-bottom:2px solid #E2E8F0;cursor:pointer;user-select:none;white-space:nowrap}
.li-th:hover{background:#F0FDF4}
.li-td{padding:8px 12px;font-size:12.5px;border-bottom:1px solid #F0F2F5;white-space:nowrap}
.li-mono{font-family:'JetBrains Mono','Fira Code',monospace}
.li-btn{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s}
.li-btn-primary{background:#0B7A3E;color:#fff}.li-btn-primary:hover{background:#096d37}
.li-btn-secondary{background:#F1F5F9;color:#475569;border:1px solid #E2E8F0}.li-btn-secondary:hover{background:#E2E8F0}
.li-btn-danger{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA}.li-btn-danger:hover{background:#FEE2E2}
.li-btn-stockcheck{background:#0F766E;color:#fff;box-shadow:0 1px 3px rgba(15,118,110,.35)}.li-btn-stockcheck:hover{background:#0d6259}
.li-btn-warn{background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA}.li-btn-warn:hover{background:#FFEDD5}
.li-badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.li-stat{padding:16px 20px;background:#fff;border:1px solid #E2E8F0;border-radius:12px}
.li-stat-label{font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.li-stat-val{font-size:22px;font-weight:700}
.li-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;animation:liFadeIn .15s}
.li-modal-box{background:#fff;border-radius:16px;padding:28px 32px;max-width:94vw;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.li-input{width:100%;padding:8px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;box-sizing:border-box}
.li-input:focus{outline:none;border-color:#0B7A3E;box-shadow:0 0 0 3px rgba(11,122,62,.1)}
.li-label{display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:4px}
.li-txn-badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600}
@keyframes liFadeIn{from{opacity:0}to{opacity:1}}
@media(max-width:768px){
  .li-stat-grid{grid-template-columns:repeat(2,1fr)!important}
  .li-toolbar{flex-direction:column!important}
  .li-toolbar>*{width:100%!important;max-width:none!important}
  .li-table-wrap{display:none!important}
  .li-mobile-cards{display:block!important}
  .li-modal-box{padding:20px 16px!important;width:95vw!important}
}
`;


const TXN_COLORS = {
  charge_out: { bg: '#FEF2F2', color: '#DC2626', label: 'Charge Out' },
  import: { bg: '#F0FDF4', color: '#15803D', label: 'Import' },
  adjustment: { bg: '#FFF7ED', color: '#C2410C', label: 'Adjustment' },
  arrival: { bg: '#EFF6FF', color: '#2563EB', label: 'Arrival' },
};

const IMPORT_FIELDS = [
  { key: 'materialNo', label: 'Material No', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'lotsNumber', label: 'Lot Number', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'quantity', label: 'Quantity (replaces current stock)', required: true },
];

const ADJUST_FIELDS = [
  { key: 'materialNo', label: 'Material No', required: true },
  { key: 'lotsNumber', label: 'Lot Number', required: false },
  { key: 'quantity', label: 'Quantity (+/- added to current stock)', required: true },
];

const STOCK_CHECK_FIELDS = [
  { key: 'materialNo', label: 'Material No', required: true },
  { key: 'lotsNumber', label: 'Lot No', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'chargeIn', label: 'Charge In', required: false },
  { key: 'chargeOut', label: 'Charge Out', required: false },
  { key: 'countedQty', label: 'Counted Qty', required: false },
];

const STOCK_CHECK_RULE = 'Counted balance wins where given; otherwise before + charge in \u2212 charge out.';

const SC_STATUS_STYLES = {
  ok: { bg: '#F0FDF4', color: '#15803D', label: 'OK' },
  new: { bg: '#EFF6FF', color: '#2563EB', label: 'New item' },
  created: { bg: '#EFF6FF', color: '#2563EB', label: 'Created' },
  error: { bg: '#FEF2F2', color: '#DC2626', label: 'Error' },
};

const EMPTY_SHEET_STATE = { aoa: [], rows: [], headers: [], fileName: '', headerRow: 0 };

// ─── Component ────────────────────────────────────────────────────────────────
export default function LocalInventoryPage({ isAdmin, currentUser: _currentUser, notify }) {
  // ── State ──
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary] = useState({ total: 0, totalQuantity: 0, lowStock: 0, categories: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [sortCfg, setSortCfg] = useState({ key: 'updatedAt', dir: 'desc' });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showChargeOut, setShowChargeOut] = useState(false);
  const [showImportMapper, setShowImportMapper] = useState(false);
  const [showAdjustMapper, setShowAdjustMapper] = useState(false);
  const [showDetail, setShowDetail] = useState(null); // inventory item for detail + history
  const [detailTxns, setDetailTxns] = useState([]);
  const [importData, setImportData] = useState(EMPTY_SHEET_STATE);
  const [importColumnMap, setImportColumnMap] = useState({});
  const [adjustData, setAdjustData] = useState(EMPTY_SHEET_STATE);
  const [adjustColumnMap, setAdjustColumnMap] = useState({});

  // Stock check (reconciliation) upload
  const [showStockCheck, setShowStockCheck] = useState(false);
  const [scSheets, setScSheets] = useState({});
  const [scData, setScData] = useState({ ...EMPTY_SHEET_STATE, sheetNames: [], sheetName: '' });
  const [scColumnMap, setScColumnMap] = useState({});
  const [scPreview, setScPreview] = useState(null);
  const [scBusy, setScBusy] = useState(false);
  const [chargeOutItems, setChargeOutItems] = useState([{ materialNo: '', lotsNumber: '', quantity: 1, notes: '' }]);
  const [showBulkSearch, setShowBulkSearch] = useState(false);
  const [bulkSearchInput, setBulkSearchInput] = useState('');
  const [bulkSearchResults, setBulkSearchResults] = useState({ found: [], notFound: [], totalSearched: 0 });

  // Add/Edit form
  const [formData, setFormData] = useState({
    materialNo: '',
    description: '',
    lotsNumber: '',
    category: '',
    quantity: 0,
  });

  // ── Data loading ──
  const loadData = useCallback(async () => {
    setLoading(true);
    const [inv, sum] = await Promise.all([api.getLocalInventory({ all: true }), api.getLocalInventorySummary()]);
    if (inv) setInventory(inv);
    if (sum) setSummary(sum);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [inv, sum] = await Promise.all([api.getLocalInventory({ all: true }), api.getLocalInventorySummary()]);
      if (cancelled) return;
      if (inv) setInventory(inv);
      if (sum) setSummary(sum);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived data ──
  const categories = useMemo(() => {
    const cats = new Set();
    inventory.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return [...cats].sort();
  }, [inventory]);

  const filtered = useMemo(() => {
    let items = inventory;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          (item.materialNo || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          (item.lotsNumber || '').toLowerCase().includes(q),
      );
    }
    if (catFilter !== 'All') {
      items = items.filter((item) => item.category === catFilter);
    }
    return applySortData(items, sortCfg);
  }, [inventory, search, catFilter, sortCfg]);

  const pager = usePagination(filtered, {
    storageKey: 'inventory',
    initialSize: 100,
    resetKey: [search, catFilter, sortCfg.key, sortCfg.dir].join('|'),
  });
  const pageItems = pager.pageItems;

  // ── Handlers ──
  const handleSave = async () => {
    const payload = {
      materialNo: formData.materialNo.trim(),
      description: formData.description.trim(),
      lotsNumber: formData.lotsNumber.trim() || null,
      category: formData.category.trim() || null,
    };
    // Quantity is only set on create; edits must go through Adjust Qty (admin-only /adjust endpoint)
    if (!editingItem) payload.quantity = parseInt(formData.quantity) || 0;
    if (!payload.materialNo) {
      notify('Error', 'Material No is required', 'error');
      return;
    }

    let result;
    if (editingItem) {
      result = await api.updateInventoryItem(editingItem.id, payload);
    } else {
      result = await api.createInventoryItem(payload);
    }

    if (result) {
      notify('Success', editingItem ? 'Item updated' : 'Item added', 'success');
      setShowAddModal(false);
      setEditingItem(null);
      loadData();
    } else if (editingItem) {
      notify('Error', 'Failed to save item', 'error');
    } else {
      // POST /api/local-inventory returns 409 when material+lot already exists, but
      // api.createInventoryItem collapses every non-OK response to null, so surface the
      // most likely cause when a matching row is already in the loaded inventory.
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      const duplicate = inventory.some(
        (it) => norm(it.materialNo) === norm(payload.materialNo) && norm(it.lotsNumber) === norm(payload.lotsNumber),
      );
      notify(
        'Error',
        duplicate
          ? `${payload.materialNo}${payload.lotsNumber ? ` (Lot ${payload.lotsNumber})` : ''} already exists — use Adjust Qty to change the quantity.`
          : 'Failed to add item — it may already exist (use Adjust Qty to change the quantity).',
        'error',
      );
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete ${item.materialNo}${item.lotsNumber ? ` (Lot: ${item.lotsNumber})` : ''}?`)) return;
    const ok = await api.deleteInventoryItem(item.id);
    if (ok) {
      notify('Deleted', `${item.materialNo} removed`, 'success');
      loadData();
    } else {
      notify('Error', 'Failed to delete', 'error');
    }
  };

  const handleChargeOut = async () => {
    const valid = chargeOutItems.filter((i) => i.materialNo.trim());
    if (valid.length === 0) {
      notify('Error', 'Add at least one material number', 'error');
      return;
    }
    const result = await api.chargeOutInventory(valid);
    if (result) {
      const msg =
        result.errors?.length > 0
          ? `${result.processed} processed, ${result.errors.length} errors`
          : `${result.processed} items charged out`;
      notify('Charge Out', msg, result.errors?.length > 0 ? 'error' : 'success');
      setShowChargeOut(false);
      setChargeOutItems([{ materialNo: '', lotsNumber: '', quantity: 1, notes: '' }]);
      loadData();
    } else {
      notify('Error', 'Charge out failed', 'error');
    }
  };

  // Read any upload as a grid of cells: the real workbooks carry a title block
  // above the headers, so row 1 is not the header row.
  const sheetToAoa = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const handleFileUpload = (e, mode) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheetNames = wb.SheetNames || [];
      if (!sheetNames.length) {
        notify('Error', 'No sheets found in file', 'error');
        return;
      }
      const sheets = {};
      sheetNames.forEach((name) => {
        sheets[name] = sheetToAoa(wb.Sheets[name]);
      });
      const firstName = sheetNames[0];
      const aoa = sheets[firstName];
      const { headers, rows, headerRowIndex } = parseSheet(aoa);
      if (rows.length === 0) {
        notify('Error', 'No data rows found in file', 'error');
        return;
      }

      if (mode === 'import') {
        setImportData({ aoa, rows, headers, fileName: file.name, headerRow: headerRowIndex });
        setImportColumnMap(
          autoDetectColumns(
            headers,
            IMPORT_FIELDS.map((f) => f.key),
          ),
        );
        setShowImportMapper(true);
      } else if (mode === 'adjust') {
        setAdjustData({ aoa, rows, headers, fileName: file.name, headerRow: headerRowIndex });
        setAdjustColumnMap(
          autoDetectColumns(
            headers,
            ADJUST_FIELDS.map((f) => f.key),
          ),
        );
        setShowAdjustMapper(true);
      } else {
        setScSheets(sheets);
        setScData({
          aoa,
          rows,
          headers,
          fileName: file.name,
          headerRow: headerRowIndex,
          sheetNames,
          sheetName: firstName,
        });
        setScColumnMap(
          autoDetectColumns(
            headers,
            STOCK_CHECK_FIELDS.map((f) => f.key),
          ),
        );
        setScPreview(null);
        setShowStockCheck(true);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Re-parse an already-loaded grid with a different header row (1-based input).
  const reparseWith = (data, setData, setMap, fieldKeys, headerRow1Based, aoaOverride, extra = {}) => {
    const aoa = aoaOverride || data.aoa;
    const idx = Math.max(0, Math.min((parseInt(headerRow1Based, 10) || 1) - 1, Math.max(0, aoa.length - 1)));
    const { headers, rows, headerRowIndex } = parseSheet(aoa, idx);
    setData({ ...data, ...extra, aoa, headers, rows, headerRow: headerRowIndex });
    setMap(autoDetectColumns(headers, fieldKeys));
  };

  const handleBulkImport = async () => {
    const mapped = importData.rows
      .map((row) => ({
        materialNo: String(row[importColumnMap.materialNo] || '').trim(),
        description: String(row[importColumnMap.description] || '').trim(),
        lotsNumber: importColumnMap.lotsNumber ? String(row[importColumnMap.lotsNumber] || '').trim() : '',
        category: importColumnMap.category ? String(row[importColumnMap.category] || '').trim() : '',
        quantity: toNumber(row[importColumnMap.quantity]),
      }))
      .filter((r) => r.materialNo);

    if (mapped.length === 0) {
      notify('Error', 'No valid rows found', 'error');
      return;
    }

    const result = await api.bulkImportInventory(mapped);
    if (result) {
      notify(
        'Import Complete',
        `${result.inserted || 0} added, ${result.updated || 0} updated${result.errors?.length ? `, ${result.errors.length} errors` : ''}`,
        result.errors?.length ? 'error' : 'success',
      );
      setShowImportMapper(false);
      loadData();
    } else {
      notify('Error', 'Import failed', 'error');
    }
  };

  const handleBulkAdjust = async () => {
    const mapped = adjustData.rows
      .map((row) => ({
        materialNo: String(row[adjustColumnMap.materialNo] || '').trim(),
        lotsNumber: adjustColumnMap.lotsNumber ? String(row[adjustColumnMap.lotsNumber] || '').trim() : '',
        quantity: toNumber(row[adjustColumnMap.quantity]),
      }))
      .filter((r) => r.materialNo && r.quantity !== 0);

    if (mapped.length === 0) {
      notify('Error', 'No valid rows found', 'error');
      return;
    }

    const result = await api.adjustInventory(mapped);
    if (result) {
      notify(
        'Adjustment Complete',
        `${result.processed || 0} items adjusted${result.errors?.length ? `, ${result.errors.length} errors` : ''}`,
        result.errors?.length ? 'error' : 'success',
      );
      setShowAdjustMapper(false);
      loadData();
    } else {
      notify('Error', 'Adjustment failed', 'error');
    }
  };

  // ── Stock Check (reconciliation) ──
  const scFieldKeys = STOCK_CHECK_FIELDS.map((f) => f.key);

  const scHeaderRowValues = useMemo(() => {
    const raw = scData.aoa?.[scData.headerRow] || [];
    return raw
      .map((c) => String(c ?? '').trim())
      .filter(Boolean)
      .join(' | ');
  }, [scData.aoa, scData.headerRow]);

  const scValidationError = !scColumnMap.materialNo
    ? 'Map the Material No column to continue.'
    : !scColumnMap.chargeIn && !scColumnMap.chargeOut && !scColumnMap.countedQty
      ? 'Map at least one of Charge In, Charge Out or Counted Qty.'
      : '';

  const closeStockCheck = () => {
    setShowStockCheck(false);
    setScPreview(null);
  };

  const buildStockCheckItems = () =>
    scData.rows
      .map((row) => {
        const cell = (key) => (scColumnMap[key] ? row[scColumnMap[key]] : '');
        const item = { materialNo: String(cell('materialNo') ?? '').trim() };
        if (scColumnMap.lotsNumber) item.lotsNumber = String(cell('lotsNumber') ?? '').trim();
        if (scColumnMap.description) item.description = String(cell('description') ?? '').trim();
        if (scColumnMap.chargeIn) item.chargeIn = toNumber(cell('chargeIn'));
        if (scColumnMap.chargeOut) item.chargeOut = toNumber(cell('chargeOut'));
        // A blank count means "not counted" — which is not the same as a counted
        // zero. Sheets also use '-' or 'n/a' for rows nobody counted, and
        // toNumber() reads those as 0, which would zero that item's stock.
        // toNumberOrNull keeps "no number here" distinct from "counted zero".
        if (scColumnMap.countedQty) {
          const counted = toNumberOrNull(cell('countedQty'));
          if (counted !== null) item.countedQty = counted;
        }
        return item;
      })
      .filter((i) => i.materialNo);

  const scSummary = useMemo(() => {
    const rows = scPreview?.rows || [];
    const errors = rows.filter((r) => r.status === 'error').length;
    return {
      total: rows.length,
      ready: rows.length - errors,
      newItems: rows.filter((r) => r.status === 'new' || r.status === 'created').length,
      errors,
      variances: rows.filter((r) => r.status !== 'error' && Number(r.variance) !== 0).length,
    };
  }, [scPreview]);

  const runStockCheck = async (dryRun) => {
    const items = buildStockCheckItems();
    if (items.length === 0) {
      notify('Error', 'No rows with a material number were found', 'error');
      return;
    }
    setScBusy(true);
    const r = await api.reconcileInventory(items, { dryRun, reference: scData.fileName });
    setScBusy(false);
    if (!r || r.ok === false) {
      const msg = r?.error || 'Stock check failed';
      notify(
        'Error',
        /403|forbidden|admin/i.test(msg) ? 'Admin permission required to apply a stock check' : msg,
        'error',
      );
      return;
    }
    if (dryRun) {
      setScPreview(r);
      return;
    }
    const rows = r.rows || [];
    const errors = r.errors?.length ?? rows.filter((x) => x.status === 'error').length;
    const created = r.created ?? rows.filter((x) => x.status === 'created' || x.status === 'new').length;
    const applied = r.applied ?? rows.length - errors - created;
    notify(
      'Stock Check',
      `${applied} items updated, ${created} created, ${errors} skipped`,
      errors > 0 ? 'error' : 'success',
    );
    closeStockCheck();
    loadData();
  };

  const handleStockCheckApply = () => {
    if (scSummary.errors > 0 || scSummary.variances > 0) {
      const ok = window.confirm(
        `Apply this stock check?\n\n` +
          `${scSummary.ready} rows will be written (${scSummary.newItems} new item(s) created).\n` +
          `${scSummary.variances} row(s) differ from the expected balance and will be set to the counted figure.\n` +
          `${scSummary.errors} row(s) have errors and will be skipped.`,
      );
      if (!ok) return;
    }
    runStockCheck(false);
  };

  const openDetail = async (item) => {
    setShowDetail(item);
    const txns = await api.getInventoryTransactions(item.id);
    setDetailTxns(txns || []);
  };

  const openEdit = (item) => {
    setFormData({
      materialNo: item.materialNo || '',
      description: item.description || '',
      lotsNumber: item.lotsNumber || '',
      category: item.category || '',
      quantity: item.quantity || 0,
    });
    setEditingItem(item);
    setShowAddModal(true);
  };

  const openAdd = () => {
    setFormData({ materialNo: '', description: '', lotsNumber: '', category: '', quantity: 0 });
    setEditingItem(null);
    setShowAddModal(true);
  };

  // ── Bulk Search ──
  const handleBulkSearch = () => {
    const raw = bulkSearchInput
      .split(/[\n,;\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = [...new Set(raw)];
    if (unique.length === 0) return;

    const invLookup = {};
    for (const item of inventory) {
      const key = (item.materialNo || '').toLowerCase();
      if (!invLookup[key]) invLookup[key] = [];
      invLookup[key].push(item);
    }

    const found = [];
    const notFound = [];
    for (const mn of unique) {
      const matches = invLookup[mn.toLowerCase()];
      if (matches && matches.length > 0) {
        for (const m of matches) found.push({ ...m, _searched: mn });
      } else {
        notFound.push(mn);
      }
    }
    setBulkSearchResults({ found, notFound, totalSearched: unique.length });
  };

  // ── Export ──
  const handleExport = () => {
    const columns = [
      { key: 'materialNo', label: 'Material No' },
      { key: 'description', label: 'Description' },
      { key: 'lotsNumber', label: 'Lot No' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'updatedAt', label: 'Last Updated', fmt: (v) => (v ? new Date(v).toLocaleString('en-SG') : '') },
    ];
    exportToFile(filtered, columns, 'Local_Inventory_Export', 'xlsx');
  };

  // ── Column Mapper Renderer ──
  const renderColumnMapper = (data, setData, columnMap, setColumnMap, fields, onConfirm, title) => (
    <div
      className="li-modal"
      onClick={() => (title.includes('Adjust') ? setShowAdjustMapper(false) : setShowImportMapper(false))}
    >
      <div className="li-modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 700 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button
            onClick={() => (title.includes('Adjust') ? setShowAdjustMapper(false) : setShowImportMapper(false))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
          >
            <X size={20} />
          </button>
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#64748B',
            marginBottom: 12,
            padding: '10px 14px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 8,
          }}
        >
          <div>
            File: <strong>{data.fileName}</strong> — {data.rows.length} rows detected
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label className="li-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Header row
            </label>
            <input
              className="li-input"
              type="number"
              min={1}
              max={Math.max(1, data.aoa.length)}
              value={data.headerRow + 1}
              onChange={(e) =>
                reparseWith(
                  data,
                  setData,
                  setColumnMap,
                  fields.map((f) => f.key),
                  e.target.value,
                )
              }
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {data.headers.join(' | ')}
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          {fields.map((f) => (
            <div key={f.key}>
              <label className="li-label">
                {f.label} {f.required && <span style={{ color: '#DC2626' }}>*</span>}
              </label>
              <select
                className="li-input"
                value={columnMap[f.key] || ''}
                onChange={(e) => setColumnMap((prev) => ({ ...prev, [f.key]: e.target.value }))}
              >
                <option value="">— Select —</option>
                {data.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#F8FAFB' }}>
                <th className="li-th">#</th>
                {fields.map((f) => (
                  <th key={f.key} className="li-th">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 5).map((row, i) => (
                <tr key={i}>
                  <td className="li-td" style={{ color: '#94A3B8' }}>
                    {i + 1}
                  </td>
                  {fields.map((f) => (
                    <td key={f.key} className="li-td">
                      {columnMap[f.key] ? String(row[columnMap[f.key]] ?? '') : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            className="li-btn li-btn-secondary"
            onClick={() => (title.includes('Adjust') ? setShowAdjustMapper(false) : setShowImportMapper(false))}
          >
            Cancel
          </button>
          <button
            className="li-btn li-btn-primary"
            onClick={onConfirm}
            disabled={!fields.filter((f) => f.required).every((f) => columnMap[f.key])}
            style={{ opacity: fields.filter((f) => f.required).every((f) => columnMap[f.key]) ? 1 : 0.5 }}
          >
            <Upload size={14} /> Import {data.rows.length} Rows
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render ──
  return (
    <div className="li-wrap">
      <style>{LI_CSS}</style>

      {/* Summary Cards */}
      <div
        className="li-stat-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}
      >
        {[
          { l: 'Total Items', v: fmtNum(summary.total), c: '#4338CA' },
          { l: 'Total Quantity', v: fmtNum(summary.totalQuantity), c: '#0B7A3E' },
          { l: 'Low / Out of Stock', v: summary.lowStock, c: summary.lowStock > 0 ? '#DC2626' : '#94A3B8' },
          { l: 'Categories', v: summary.categories, c: '#2563EB' },
        ].map((s, i) => (
          <div key={i} className="li-stat">
            <div className="li-stat-label">{s.l}</div>
            <div className="li-stat-val" style={{ color: s.c }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        className="li-toolbar"
        style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
          <input
            className="li-input"
            placeholder="Search material no., description, lot..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          className="li-input"
          value={catFilter}
          onChange={(e) => {
            setCatFilter(e.target.value);
          }}
          style={{ width: 'auto', maxWidth: 180 }}
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="li-btn li-btn-secondary" onClick={() => setShowBulkSearch(true)}>
            <Search size={14} /> Bulk Search
          </button>
          <button className="li-btn li-btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add Item
          </button>
          <label className="li-btn li-btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Import
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFileUpload(e, 'import')}
              style={{ display: 'none' }}
            />
          </label>
          <button className="li-btn li-btn-warn" onClick={() => setShowChargeOut(true)}>
            <Minus size={14} /> Charge Out
          </button>
          {isAdmin && (
            <label className="li-btn li-btn-stockcheck" style={{ cursor: 'pointer' }}>
              <ClipboardCheck size={14} /> Stock Check
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, 'stockcheck')}
                style={{ display: 'none' }}
              />
            </label>
          )}
          {isAdmin && (
            <label className="li-btn li-btn-secondary" style={{ cursor: 'pointer' }}>
              <Filter size={14} /> Adjust Qty
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, 'adjust')}
                style={{ display: 'none' }}
              />
            </label>
          )}
          <button className="li-btn li-btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Table (Desktop) */}
      <div className="li-card li-table-wrap">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
            <Package size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No items found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Add items manually or import from xlsx/csv</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFB' }}>
                    {[
                      { key: 'materialNo', label: 'Material No.' },
                      { key: 'description', label: 'Description' },
                      { key: 'lotsNumber', label: 'Lot No.' },
                      { key: 'category', label: 'Category' },
                      { key: 'quantity', label: 'Qty' },
                      { key: 'updatedAt', label: 'Last Updated' },
                    ].map((col) => (
                      <th key={col.key} className="li-th" onClick={() => toggleSort(setSortCfg, col.key)}>
                        {col.label} {sortCfg.key === col.key && (sortCfg.dir === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                    <th className="li-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(item)}>
                      <td className="li-td li-mono" style={{ color: '#0B7A3E', fontWeight: 600, fontSize: 11 }}>
                        {item.materialNo}
                      </td>
                      <td className="li-td" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.description || '\u2014'}
                      </td>
                      <td className="li-td li-mono" style={{ fontSize: 11, color: '#64748B' }}>
                        {item.lotsNumber || '\u2014'}
                      </td>
                      <td className="li-td">
                        {item.category ? (
                          <span className="li-badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            {item.category}
                          </span>
                        ) : (
                          '\u2014'
                        )}
                      </td>
                      <td
                        className="li-td li-mono"
                        style={{ fontWeight: 700, color: item.quantity <= 0 ? '#DC2626' : '#1A202C' }}
                      >
                        {item.quantity}
                      </td>
                      <td className="li-td" style={{ fontSize: 11, color: '#94A3B8' }}>
                        {fmtDate(item.updatedAt)}
                      </td>
                      <td className="li-td" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {isAdmin && (
                            <button
                              onClick={() => openEdit(item)}
                              style={{
                                padding: 4,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#64748B',
                              }}
                              title="Edit"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(item)}
                              style={{
                                padding: 4,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#DC2626',
                              }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '4px 16px 10px', borderTop: '1px solid #E2E8F0' }}>
              <Pagination {...pager} unit="items" />
            </div>
          </>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="li-mobile-cards" style={{ display: 'none' }}>
        {pageItems.map((item) => (
          <div
            key={item.id}
            className="li-card"
            style={{ marginBottom: 10, padding: 14, cursor: 'pointer' }}
            onClick={() => openDetail(item)}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}
            >
              <div>
                <div className="li-mono" style={{ fontSize: 12, fontWeight: 700, color: '#0B7A3E' }}>
                  {item.materialNo}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{item.description || '\u2014'}</div>
              </div>
              <div
                className="li-mono"
                style={{ fontSize: 18, fontWeight: 700, color: item.quantity <= 0 ? '#DC2626' : '#1A202C' }}
              >
                {item.quantity}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#94A3B8' }}>
              {item.lotsNumber && <span>Lot: {item.lotsNumber}</span>}
              {item.category && (
                <span className="li-badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  {item.category}
                </span>
              )}
              <span style={{ marginLeft: 'auto' }}>{fmtDate(item.updatedAt)}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No items found</div>
        )}
        <Pagination {...pager} unit="items" style={{ padding: '4px 4px 10px' }} />
      </div>

      {/* ═══ ADD / EDIT MODAL ═══ */}
      {showAddModal && (
        <div
          className="li-modal"
          onClick={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
        >
          <div className="li-modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editingItem ? 'Edit Item' : 'Add Inventory Item'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label className="li-label">Material No. *</label>
                <input
                  className="li-input"
                  value={formData.materialNo}
                  onChange={(e) => setFormData((p) => ({ ...p, materialNo: e.target.value }))}
                  placeholder="e.g. 130-095-005"
                />
              </div>
              <div>
                <label className="li-label">Description</label>
                <input
                  className="li-input"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Part description"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="li-label">Lot Number</label>
                  <input
                    className="li-input"
                    value={formData.lotsNumber}
                    onChange={(e) => setFormData((p) => ({ ...p, lotsNumber: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="li-label">Category</label>
                  <input
                    className="li-input"
                    value={formData.category}
                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                    placeholder="e.g. Consumables"
                    list="li-cat-list"
                  />
                  <datalist id="li-cat-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="li-label">Quantity</label>
                <input
                  className="li-input"
                  type="number"
                  min={0}
                  value={formData.quantity}
                  readOnly={!!editingItem}
                  disabled={!!editingItem}
                  onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
                />
                {editingItem && (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    Quantity cannot be edited here &mdash; use Adjust Qty.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                className="li-btn li-btn-secondary"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
              >
                Cancel
              </button>
              <button className="li-btn li-btn-primary" onClick={handleSave} disabled={!formData.materialNo.trim()}>
                {editingItem ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CHARGE OUT MODAL ═══ */}
      {showChargeOut && (
        <div className="li-modal" onClick={() => setShowChargeOut(false)}>
          <div className="li-modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Charge Out Parts</h2>
              <button
                onClick={() => setShowChargeOut(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#64748B',
                marginBottom: 14,
                padding: '10px 14px',
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 8,
              }}
            >
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              This will reduce quantity from the local inventory for each item listed below.
            </div>

            {chargeOutItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 80px 1fr 30px',
                  gap: 8,
                  marginBottom: 8,
                  alignItems: 'end',
                }}
              >
                <div>
                  {idx === 0 && <label className="li-label">Material No. *</label>}
                  <input
                    className="li-input"
                    value={item.materialNo}
                    onChange={(e) =>
                      setChargeOutItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, materialNo: e.target.value } : it)),
                      )
                    }
                    placeholder="130-095-005"
                    list="li-inv-list"
                  />
                </div>
                <div>
                  {idx === 0 && <label className="li-label">Lot No.</label>}
                  <input
                    className="li-input"
                    value={item.lotsNumber}
                    onChange={(e) =>
                      setChargeOutItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, lotsNumber: e.target.value } : it)),
                      )
                    }
                    placeholder="Optional"
                  />
                </div>
                <div>
                  {idx === 0 && <label className="li-label">Qty</label>}
                  <input
                    className="li-input"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      setChargeOutItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it)),
                      )
                    }
                  />
                </div>
                <div>
                  {idx === 0 && <label className="li-label">Notes</label>}
                  <input
                    className="li-input"
                    value={item.notes}
                    onChange={(e) =>
                      setChargeOutItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, notes: e.target.value } : it)),
                      )
                    }
                    placeholder="Reason"
                  />
                </div>
                <button
                  onClick={() => setChargeOutItems((prev) => prev.filter((_, i) => i !== idx))}
                  style={{
                    padding: 4,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#DC2626',
                    marginBottom: 2,
                  }}
                  disabled={chargeOutItems.length === 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            {/* Autocomplete datalist for materials */}
            <datalist id="li-inv-list">
              {inventory.map((item) => (
                <option key={`${item.materialNo}-${item.lotsNumber || ''}`} value={item.materialNo}>
                  {item.description} {item.lotsNumber ? `(Lot: ${item.lotsNumber})` : ''} — Qty: {item.quantity}
                </option>
              ))}
            </datalist>

            <button
              className="li-btn li-btn-secondary"
              onClick={() =>
                setChargeOutItems((prev) => [...prev, { materialNo: '', lotsNumber: '', quantity: 1, notes: '' }])
              }
              style={{ marginBottom: 16, fontSize: 11 }}
            >
              <Plus size={12} /> Add Row
            </button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="li-btn li-btn-secondary" onClick={() => setShowChargeOut(false)}>
                Cancel
              </button>
              <button
                className="li-btn li-btn-warn"
                onClick={handleChargeOut}
                disabled={!chargeOutItems.some((i) => i.materialNo.trim())}
              >
                <Minus size={14} /> Charge Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETAIL / HISTORY MODAL ═══ */}
      {showDetail && (
        <div className="li-modal" onClick={() => setShowDetail(null)}>
          <div className="li-modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                <span style={{ color: '#0B7A3E' }}>{showDetail.materialNo}</span>
              </h2>
              <button
                onClick={() => setShowDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Item info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, fontSize: 13 }}>
              <div>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Description</span>
                <div style={{ fontWeight: 500 }}>{showDetail.description || '\u2014'}</div>
              </div>
              <div>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Lot Number</span>
                <div style={{ fontWeight: 500 }}>{showDetail.lotsNumber || '\u2014'}</div>
              </div>
              <div>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Category</span>
                <div style={{ fontWeight: 500 }}>{showDetail.category || '\u2014'}</div>
              </div>
              <div>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Current Quantity</span>
                <div style={{ fontWeight: 700, fontSize: 18, color: showDetail.quantity <= 0 ? '#DC2626' : '#0B7A3E' }}>
                  {showDetail.quantity}
                </div>
              </div>
            </div>

            {/* Transaction history */}
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                margin: '0 0 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <History size={16} /> Transaction History
            </h3>

            {detailTxns.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                No transactions yet
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB' }}>
                      <th className="li-th">Date</th>
                      <th className="li-th">Type</th>
                      <th className="li-th" style={{ textAlign: 'right' }}>
                        Change
                      </th>
                      <th className="li-th" style={{ textAlign: 'right' }}>
                        After
                      </th>
                      <th className="li-th">User</th>
                      <th className="li-th">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailTxns.map((txn) => {
                      const tc = TXN_COLORS[txn.type] || { bg: '#F1F5F9', color: '#475569', label: txn.type };
                      return (
                        <tr key={txn.id} style={{ borderBottom: '1px solid #F0F2F5' }}>
                          <td className="li-td" style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                            {txn.createdAt
                              ? new Date(txn.createdAt).toLocaleString('en-SG', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '\u2014'}
                          </td>
                          <td className="li-td">
                            <span className="li-txn-badge" style={{ background: tc.bg, color: tc.color }}>
                              {tc.label}
                            </span>
                          </td>
                          <td
                            className="li-td li-mono"
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: txn.quantityChange > 0 ? '#15803D' : '#DC2626',
                            }}
                          >
                            {txn.quantityChange > 0 ? `+${txn.quantityChange}` : txn.quantityChange}
                          </td>
                          <td className="li-td li-mono" style={{ textAlign: 'right' }}>
                            {txn.quantityAfter}
                          </td>
                          <td className="li-td" style={{ fontSize: 11, color: '#64748B' }}>
                            {txn.userName || '\u2014'}
                          </td>
                          <td
                            className="li-td"
                            style={{
                              fontSize: 11,
                              color: '#94A3B8',
                              maxWidth: 140,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {txn.notes || '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="li-btn li-btn-secondary" onClick={() => openEdit(showDetail)}>
                <Edit3 size={14} /> Edit
              </button>
              <button className="li-btn li-btn-secondary" onClick={() => setShowDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ IMPORT COLUMN MAPPER ═══ */}
      {showImportMapper &&
        renderColumnMapper(
          importData,
          setImportData,
          importColumnMap,
          setImportColumnMap,
          IMPORT_FIELDS,
          handleBulkImport,
          'Import Inventory Items',
        )}

      {/* ═══ ADJUST COLUMN MAPPER ═══ */}
      {showAdjustMapper &&
        renderColumnMapper(
          adjustData,
          setAdjustData,
          adjustColumnMap,
          setAdjustColumnMap,
          ADJUST_FIELDS,
          handleBulkAdjust,
          'Adjust Inventory Quantities',
        )}

      {/* ═══ STOCK CHECK (RECONCILIATION) ═══ */}
      {showStockCheck && (
        <div className="li-modal" onClick={closeStockCheck}>
          <div className="li-modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 980 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Stock Check Reconciliation</h2>
              <button
                onClick={closeStockCheck}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                fontSize: 12,
                color: '#64748B',
                marginBottom: 12,
                padding: '10px 14px',
                background: '#F0FDFA',
                border: '1px solid #99F6E4',
                borderRadius: 8,
              }}
            >
              <div>
                File: <strong>{scData.fileName}</strong> — {scData.rows.length} rows found
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                {scData.sheetNames.length > 1 && (
                  <>
                    <label className="li-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                      Sheet
                    </label>
                    <select
                      className="li-input"
                      value={scData.sheetName}
                      onChange={(e) => {
                        const name = e.target.value;
                        const aoa = scSheets[name] || [];
                        const parsed = parseSheet(aoa);
                        setScData({
                          ...scData,
                          sheetName: name,
                          aoa,
                          headers: parsed.headers,
                          rows: parsed.rows,
                          headerRow: parsed.headerRowIndex,
                        });
                        setScColumnMap(autoDetectColumns(parsed.headers, scFieldKeys));
                        setScPreview(null);
                      }}
                      style={{ width: 'auto', maxWidth: 220 }}
                    >
                      {scData.sheetNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label className="li-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                  Header row
                </label>
                <input
                  className="li-input"
                  type="number"
                  min={1}
                  max={Math.max(1, scData.aoa.length)}
                  value={scData.headerRow + 1}
                  onChange={(e) => {
                    reparseWith(scData, setScData, setScColumnMap, scFieldKeys, e.target.value);
                    setScPreview(null);
                  }}
                  style={{ width: 90 }}
                />
              </div>
              <div style={{ fontSize: 11, marginTop: 6, color: '#0F766E' }}>
                Header row reads: <strong>{scHeaderRowValues || '(empty)'}</strong>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {STOCK_CHECK_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="li-label">
                    {f.label} {f.required && <span style={{ color: '#DC2626' }}>*</span>}
                  </label>
                  <select
                    className="li-input"
                    value={scColumnMap[f.key] || ''}
                    onChange={(e) => {
                      setScColumnMap((prev) => ({ ...prev, [f.key]: e.target.value }));
                      setScPreview(null);
                    }}
                  >
                    <option value="">—</option>
                    {scData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 12 }}>{STOCK_CHECK_RULE}</div>

            {scPreview && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  {scSummary.ready} rows ready · {scSummary.newItems} new items · {scSummary.errors} errors ·{' '}
                  {scSummary.variances} with a count variance
                </div>
                <div
                  style={{
                    overflow: 'auto',
                    maxHeight: 320,
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFB', position: 'sticky', top: 0 }}>
                        <th className="li-th">Material</th>
                        <th className="li-th">Description</th>
                        <th className="li-th">Before</th>
                        <th className="li-th">+ In</th>
                        <th className="li-th">− Out</th>
                        <th className="li-th">Counted</th>
                        <th className="li-th">Variance</th>
                        <th className="li-th">After</th>
                        <th className="li-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scPreview.rows || []).map((r, i) => {
                        const isError = r.status === 'error';
                        const badge = SC_STATUS_STYLES[r.status] || SC_STATUS_STYLES.ok;
                        const variance = Number(r.variance) || 0;
                        return (
                          <tr
                            key={`${r.row ?? i}-${r.materialNo}-${i}`}
                            style={{ background: isError ? '#FEF2F2' : undefined }}
                          >
                            <td
                              className="li-td li-mono"
                              style={{ color: isError ? '#DC2626' : '#0B7A3E', fontWeight: 600 }}
                            >
                              {r.materialNo}
                              {r.lotsNumber ? ` / ${r.lotsNumber}` : ''}
                            </td>
                            <td
                              className="li-td"
                              style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {isError ? (
                                <span style={{ color: '#DC2626' }}>{r.error || 'Error'}</span>
                              ) : (
                                r.description || '\u2014'
                              )}
                            </td>
                            <td className="li-td li-mono">{r.before ?? '\u2014'}</td>
                            <td className="li-td li-mono" style={{ color: '#15803D' }}>
                              {r.chargeIn || 0}
                            </td>
                            <td className="li-td li-mono" style={{ color: '#C2410C' }}>
                              {r.chargeOut || 0}
                            </td>
                            <td className="li-td li-mono">{isBlank(r.counted) ? '\u2014' : r.counted}</td>
                            <td
                              className="li-td li-mono"
                              style={{ fontWeight: 700, color: variance !== 0 ? '#B45309' : '#94A3B8' }}
                            >
                              {variance > 0 ? `+${variance}` : variance}
                            </td>
                            <td className="li-td li-mono" style={{ fontWeight: 700 }}>
                              {r.target ?? r.expected ?? '\u2014'}
                            </td>
                            <td className="li-td">
                              <span className="li-badge" style={{ background: badge.bg, color: badge.color }}>
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {scValidationError && (
              <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{scValidationError}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="li-btn li-btn-secondary" onClick={closeStockCheck}>
                Cancel
              </button>
              <button
                className="li-btn li-btn-secondary"
                onClick={() => runStockCheck(true)}
                disabled={!!scValidationError || scBusy}
                style={{ opacity: scValidationError || scBusy ? 0.5 : 1 }}
              >
                <Filter size={14} /> Preview
              </button>
              <button
                className="li-btn li-btn-stockcheck"
                onClick={handleStockCheckApply}
                disabled={!scPreview || scSummary.ready === 0 || scBusy}
                style={{ opacity: !scPreview || scSummary.ready === 0 || scBusy ? 0.5 : 1 }}
              >
                <ClipboardCheck size={14} /> Apply to Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BULK SEARCH MODAL ═══ */}
      {showBulkSearch && (
        <div className="li-modal" onClick={() => setShowBulkSearch(false)}>
          <div className="li-modal-box" onClick={(e) => e.stopPropagation()} style={{ width: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Bulk Search Inventory</h2>
              <button
                onClick={() => setShowBulkSearch(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              Paste material numbers below (separated by comma, newline, semicolon, or tab) to look up their inventory
              status.
            </div>

            <textarea
              className="li-input"
              rows={5}
              value={bulkSearchInput}
              onChange={(e) => setBulkSearchInput(e.target.value)}
              placeholder={'130-095-005\n130-096-102\n170-076-604'}
              style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 12, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, marginBottom: 16 }}>
              <button
                className="li-btn li-btn-secondary"
                onClick={() => {
                  setBulkSearchInput('');
                  setBulkSearchResults({ found: [], notFound: [], totalSearched: 0 });
                }}
              >
                Clear
              </button>
              <button className="li-btn li-btn-primary" onClick={handleBulkSearch} disabled={!bulkSearchInput.trim()}>
                <Search size={14} /> Search
              </button>
            </div>

            {/* Results */}
            {bulkSearchResults.totalSearched > 0 && (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>{bulkSearchResults.found.length} found</span>
                  <span style={{ color: '#94A3B8' }}>/</span>
                  <span style={{ fontWeight: 700 }}>{bulkSearchResults.totalSearched} searched</span>
                  {bulkSearchResults.notFound.length > 0 && (
                    <span style={{ color: '#DC2626', fontWeight: 600 }}>
                      ({bulkSearchResults.notFound.length} not found)
                    </span>
                  )}
                </div>

                {/* Not-found items */}
                {bulkSearchResults.notFound.length > 0 && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: '10px 14px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', marginBottom: 6 }}>
                      <AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Not found in inventory:
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono','Fira Code',monospace",
                        color: '#991B1B',
                        lineHeight: 1.8,
                      }}
                    >
                      {bulkSearchResults.notFound.join(', ')}
                    </div>
                  </div>
                )}

                {/* Found items table */}
                {bulkSearchResults.found.length > 0 && (
                  <div
                    style={{
                      overflowX: 'auto',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      maxHeight: 340,
                      overflowY: 'auto',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFB', position: 'sticky', top: 0 }}>
                          <th className="li-th">Material No.</th>
                          <th className="li-th">Description</th>
                          <th className="li-th">Lot No.</th>
                          <th className="li-th">Category</th>
                          <th className="li-th" style={{ textAlign: 'right' }}>
                            Qty
                          </th>
                          <th className="li-th">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkSearchResults.found.map((item, idx) => (
                          <tr key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid #F0F2F5' }}>
                            <td className="li-td li-mono" style={{ color: '#0B7A3E', fontWeight: 600, fontSize: 11 }}>
                              {item.materialNo}
                            </td>
                            <td
                              className="li-td"
                              style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {item.description || '\u2014'}
                            </td>
                            <td className="li-td li-mono" style={{ fontSize: 11, color: '#64748B' }}>
                              {item.lotsNumber || '\u2014'}
                            </td>
                            <td className="li-td">
                              {item.category ? (
                                <span className="li-badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                                  {item.category}
                                </span>
                              ) : (
                                '\u2014'
                              )}
                            </td>
                            <td
                              className="li-td li-mono"
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: item.quantity <= 0 ? '#DC2626' : '#1A202C',
                              }}
                            >
                              {item.quantity}
                            </td>
                            <td className="li-td" style={{ fontSize: 11, color: '#94A3B8' }}>
                              {fmtDate(item.updatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="li-btn li-btn-secondary" onClick={() => setShowBulkSearch(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
