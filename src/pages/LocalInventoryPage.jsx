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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api.js';
import { fmtDate, fmtNum, applySortData, toggleSort, exportToFile } from '../utils.js';

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

const PAGE_SIZE = 25;

const TXN_COLORS = {
  charge_out: { bg: '#FEF2F2', color: '#DC2626', label: 'Charge Out' },
  import: { bg: '#F0FDF4', color: '#15803D', label: 'Import' },
  adjustment: { bg: '#FFF7ED', color: '#C2410C', label: 'Adjustment' },
  arrival: { bg: '#EFF6FF', color: '#2563EB', label: 'Arrival' },
};

const IMPORT_SYNONYMS = {
  materialNo: [
    'material_no',
    'material no',
    'materialno',
    'mat no',
    'part no',
    'part_no',
    'partno',
    'material number',
    'item no',
  ],
  description: ['description', 'desc', 'item description', 'part description', 'name', 'item name'],
  lotsNumber: ['lots_number', 'lots number', 'lot no', 'lot_no', 'lotno', 'lot number', 'batch', 'batch no'],
  category: ['category', 'cat', 'group', 'type'],
  quantity: ['quantity', 'qty', 'amount', 'stock', 'count', 'on hand', 'on_hand'],
};

function autoDetectColumns(headers) {
  const map = {};
  const lowerHeaders = headers.map((h) => String(h).toLowerCase().trim());
  for (const [field, synonyms] of Object.entries(IMPORT_SYNONYMS)) {
    for (const syn of synonyms) {
      const idx = lowerHeaders.indexOf(syn);
      if (idx !== -1 && !Object.values(map).includes(headers[idx])) {
        map[field] = headers[idx];
        break;
      }
    }
  }
  return map;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LocalInventoryPage({ isAdmin, currentUser: _currentUser, notify }) {
  // ── State ──
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary] = useState({ total: 0, totalQuantity: 0, lowStock: 0, categories: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(0);
  const [sortCfg, setSortCfg] = useState({ key: 'updatedAt', dir: 'desc' });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showChargeOut, setShowChargeOut] = useState(false);
  const [showImportMapper, setShowImportMapper] = useState(false);
  const [showAdjustMapper, setShowAdjustMapper] = useState(false);
  const [showDetail, setShowDetail] = useState(null); // inventory item for detail + history
  const [detailTxns, setDetailTxns] = useState([]);
  const [importData, setImportData] = useState({ rows: [], headers: [], fileName: '' });
  const [importColumnMap, setImportColumnMap] = useState({});
  const [adjustData, setAdjustData] = useState({ rows: [], headers: [], fileName: '' });
  const [adjustColumnMap, setAdjustColumnMap] = useState({});
  const [chargeOutItems, setChargeOutItems] = useState([{ materialNo: '', lotsNumber: '', quantity: 1, notes: '' }]);
  const [showBulkSearch, setShowBulkSearch] = useState(false);
  const [bulkSearchInput, setBulkSearchInput] = useState('');
  const [bulkSearchResults, setBulkSearchResults] = useState([]);

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
    const [inv, sum] = await Promise.all([api.getLocalInventory(), api.getLocalInventorySummary()]);
    if (inv) setInventory(inv);
    if (sum) setSummary(sum);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [inv, sum] = await Promise.all([api.getLocalInventory(), api.getLocalInventorySummary()]);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ── Handlers ──
  const handleSave = async () => {
    const payload = {
      materialNo: formData.materialNo.trim(),
      description: formData.description.trim(),
      lotsNumber: formData.lotsNumber.trim() || null,
      category: formData.category.trim() || null,
      quantity: parseInt(formData.quantity) || 0,
    };
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
    } else {
      notify('Error', 'Failed to save item', 'error');
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

  const handleFileUpload = (e, mode) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (json.length === 0) {
        notify('Error', 'No data found in file', 'error');
        return;
      }
      const headers = Object.keys(json[0]);
      const autoMap = autoDetectColumns(headers);

      if (mode === 'import') {
        setImportData({ rows: json, headers, fileName: file.name });
        setImportColumnMap(autoMap);
        setShowImportMapper(true);
      } else {
        setAdjustData({ rows: json, headers, fileName: file.name });
        setAdjustColumnMap(autoMap);
        setShowAdjustMapper(true);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleBulkImport = async () => {
    const mapped = importData.rows
      .map((row) => ({
        materialNo: String(row[importColumnMap.materialNo] || '').trim(),
        description: String(row[importColumnMap.description] || '').trim(),
        lotsNumber: importColumnMap.lotsNumber ? String(row[importColumnMap.lotsNumber] || '').trim() : '',
        category: importColumnMap.category ? String(row[importColumnMap.category] || '').trim() : '',
        quantity: parseInt(row[importColumnMap.quantity]) || 0,
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
        quantity: parseInt(row[adjustColumnMap.quantity]) || 0,
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
  const renderColumnMapper = (data, columnMap, setColumnMap, fields, onConfirm, title) => (
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
          File: <strong>{data.fileName}</strong> — {data.rows.length} rows detected
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
              setCurrentPage(0);
            }}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          className="li-input"
          value={catFilter}
          onChange={(e) => {
            setCatFilter(e.target.value);
            setCurrentPage(0);
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

      {/* Info bar */}
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>{filtered.length} items</div>

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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                <button
                  className="li-btn li-btn-secondary"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  style={{ padding: '4px 10px' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Page {currentPage + 1} / {totalPages}
                </span>
                <button
                  className="li-btn li-btn-secondary"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  style={{ padding: '4px 10px' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
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
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: 12 }}>
            <button
              className="li-btn li-btn-secondary"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: 12, alignSelf: 'center', color: '#64748B' }}>
              {currentPage + 1}/{totalPages}
            </span>
            <button
              className="li-btn li-btn-secondary"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
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
                  onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
                />
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
          importColumnMap,
          setImportColumnMap,
          [
            { key: 'materialNo', label: 'Material No', required: true },
            { key: 'description', label: 'Description', required: false },
            { key: 'lotsNumber', label: 'Lot Number', required: false },
            { key: 'category', label: 'Category', required: false },
            { key: 'quantity', label: 'Quantity', required: true },
          ],
          handleBulkImport,
          'Import Inventory Items',
        )}

      {/* ═══ ADJUST COLUMN MAPPER ═══ */}
      {showAdjustMapper &&
        renderColumnMapper(
          adjustData,
          adjustColumnMap,
          setAdjustColumnMap,
          [
            { key: 'materialNo', label: 'Material No', required: true },
            { key: 'lotsNumber', label: 'Lot Number', required: false },
            { key: 'quantity', label: 'Quantity (+/-)', required: true },
          ],
          handleBulkAdjust,
          'Adjust Inventory Quantities',
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
                  setBulkSearchResults([]);
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
