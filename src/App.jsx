import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from "recharts";
import { Search, Package, TrendingUp, Truck, Bell, MessageSquare, Settings, ChevronDown, ChevronRight, Plus, Filter, Download, Mail, Phone, CheckCircle, AlertTriangle, Clock, X, Menu, Home, ClipboardList, BarChart3, Eye, Send, RefreshCw, Users, User, Calendar, DollarSign, Archive, AlertCircle, Check, ExternalLink, FileText, Database, Tag, ArrowUpDown, ArrowUp, ArrowDown, Edit3, Trash2, Copy, Printer, ShoppingCart, UserPlus, Shield, Lock, LogOut, QrCode, Wifi, WifiOff, Layers, FolderPlus, ChevronLeft, Bot, Upload, Sparkles, FileUp, MessageCircle, Zap, Brain, PanelRightOpen, PanelRightClose } from "lucide-react";
import * as XLSX from 'xlsx';
import api from './api.js';

// ════════════════════════════ DATA ════════════════════════════════════
const PARTS_CATALOG = [];
const PRICE_CONFIG_DEFAULT = { exchangeRate: 1.85, sgMarkup: 1.4, gst: 1.09, distMarkup: 2.05, specialRate: 2.0, year: 2025 };

const CATEGORIES = {
  'CLI-CS-Spare Parts': { label: 'Clinical Cell Sorting', short: 'CLI-CS', color: '#0B7A3E' },
  'CLI-OT-Spare Parts': { label: 'Clinical Other', short: 'CLI-OT', color: '#047857' },
  'CLI-PP-Spare Parts': { label: 'Clinical Pre-Processing', short: 'CLI-PP', color: '#059669' },
  'RES-CA-Spare Parts': { label: 'Research Cell Analysis', short: 'RES-CA', color: '#2563EB' },
  'RES-CS-Spare Parts': { label: 'Research Cell Sorting', short: 'RES-CS', color: '#1D4ED8' },
  'RES-IM-MACSima-Spare Parts': { label: 'MACSima Imaging', short: 'MACSima', color: '#7C3AED' },
  'RES-IM-Spare Parts': { label: 'Research Imaging', short: 'RES-IM', color: '#9333EA' },
  'RES-IM-UM-Spare Parts': { label: 'UltraMicroscope', short: 'UM', color: '#A855F7' },
  'RES-OT-Spare Parts': { label: 'Research Other', short: 'RES-OT', color: '#D97706' },
  'RES-SP-Spare Parts': { label: 'Research Sample Prep', short: 'RES-SP', color: '#EA580C' },
};

const DEFAULT_USERS = [
  { id: 'U001', username: 'admin', name: 'System Admin', email: 'admin@miltenyibiotec.com', role: 'admin', status: 'active', created: '2025-01-01', phone: '' },
];

const MONTH_OPTIONS = [
  'Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026',
  'Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026'
];

// ════════════════════════════ HELPERS ═════════════════════════════════
const fmt = (n) => n != null && n !== 0 ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', minimumFractionDigits: 2 }).format(n) : '\u2014';
const fmtDate = (d) => d && d !== 'None' ? new Date(d).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';
const fmtNum = (n) => new Intl.NumberFormat('en-SG').format(n);

const STATUS_CFG = {
  Received: { color: '#0B7A3E', bg: '#E6F4ED', icon: CheckCircle },
  'Back Order': { color: '#C53030', bg: '#FEE2E2', icon: AlertTriangle },
  'Pending Approval': { color: '#7C3AED', bg: '#EDE9FE', icon: Clock },
  Approved: { color: '#0B7A3E', bg: '#D1FAE5', icon: CheckCircle },
  Rejected: { color: '#DC2626', bg: '#FEE2E2', icon: X },
};
const Badge = ({ status }) => { const c = STATUS_CFG[status]||STATUS_CFG['Pending Approval']; const I=c.icon; return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,color:c.color,background:c.bg }}><I size={12}/> {status}</span>; };
const Pill = ({ bg, color, children }) => <span className="pill" style={{ background: bg, color }}>{children}</span>;
const Toggle = ({ active, onClick, color }) => <div onClick={onClick} style={{ width:40,height:22,borderRadius:11,background:active?(color||'#0B7A3E'):'#E2E8F0',cursor:'pointer',position:'relative',transition:'background 0.2s' }}><div style={{ width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:active?20:2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}/></div>;
const Toast = ({ items, onDismiss }) => <div style={{ position:'fixed',top:80,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:8,maxWidth:380 }}>{items.map((n,i) => <div key={i} style={{ background:n.type==='success'?'#0B7A3E':n.type==='warning'?'#D97706':'#2563EB',color:'#fff',padding:'12px 16px',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.18)',display:'flex',alignItems:'center',gap:10,animation:'slideIn 0.3s' }}>{n.type==='success'?<CheckCircle size={18}/>:n.type==='warning'?<AlertTriangle size={18}/>:<Bell size={18}/>}<div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{n.title}</div><div style={{fontSize:11,opacity:0.9}}>{n.message}</div></div><button onClick={()=>onDismiss(i)} style={{background:'none',border:'none',color:'#fff',cursor:'pointer'}}><X size={14}/></button></div>)}</div>;

// ════════════════════════════ BATCH ACTION BAR ══════════════════════
const BatchBar = ({ count, onClear, children }) => count > 0 ? (
  <div className="batch-bar" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'linear-gradient(135deg,#1E293B,#334155)',borderRadius:10,marginBottom:12,color:'#fff',fontSize:13,flexWrap:'wrap',animation:'slideIn 0.2s'}}>
    <span style={{fontWeight:700,minWidth:90}}>{count} selected</span>
    <div style={{display:'flex',gap:6,flex:1,flexWrap:'wrap'}}>{children}</div>
    <button onClick={onClear} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>Clear</button>
  </div>
) : null;
const BatchBtn = ({ onClick, bg, icon: I, children }) => (
  <button onClick={onClick} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 12px',background:bg||'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{I&&<I size={12}/>}{children}</button>
);

// ════════════════════════════ EXPORT HELPERS ══════════════════════════
const exportToFile = (data, columns, filename, format) => {
  const rows = data.map(row => {
    const obj = {};
    columns.forEach(col => { obj[col.label] = col.fmt ? col.fmt(row[col.key], row) : (row[col.key] ?? ''); });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${filename}.${format === 'csv' ? 'csv' : 'xlsx'}`, format === 'csv' ? { bookType: 'csv' } : {});
};
const exportToPDF = (data, columns, title) => {
  const w = window.open('', '_blank');
  if (!w) return;
  const hdr = columns.map(c => `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #0B7A3E;font-size:11px;color:#4A5568;text-transform:uppercase;letter-spacing:.5px">${c.label}</th>`).join('');
  const body = data.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#F8FAFB'}">${columns.map(c => `<td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-size:12px">${c.fmt ? c.fmt(row[c.key], row) : (row[c.key] ?? '—')}</td>`).join('')}</tr>`).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;margin:24px;color:#1A202C}@media print{.no-print{display:none}}</style></head><body><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h1 style="font-size:18px;font-weight:700;margin:0;color:#0B7A3E">Miltenyi Inventory Hub</h1><h2 style="font-size:14px;font-weight:500;margin:4px 0 0;color:#64748B">${title}</h2></div><div style="text-align:right;font-size:11px;color:#94A3B8">Exported: ${new Date().toLocaleString('en-SG')}<br/>${data.length} records</div></div><table style="width:100%;border-collapse:collapse"><thead><tr>${hdr}</tr></thead><tbody>${body}</tbody></table><div class="no-print" style="margin-top:20px;text-align:center"><button onclick="window.print()" style="padding:8px 24px;background:#0B7A3E;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer">Print / Save as PDF</button></div></body></html>`);
  w.document.close();
};
const ExportDropdown = ({ data, columns, filename, title }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div ref={ref} style={{position:'relative',display:'inline-block'}}>
      <button onClick={()=>setOpen(!open)} className="bs" style={{padding:'6px 12px',display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600}}><Download size={13}/> Export</button>
      {open && <div style={{position:'absolute',right:0,top:'100%',marginTop:4,background:'#fff',border:'1px solid #E2E8F0',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:100,minWidth:150,overflow:'hidden'}}>
        {[{label:'CSV (.csv)',fmt:'csv'},{label:'Excel (.xlsx)',fmt:'xlsx'},{label:'PDF (Print)',fmt:'pdf'}].map(opt=>(
          <button key={opt.fmt} onClick={()=>{setOpen(false);if(opt.fmt==='pdf')exportToPDF(data,columns,title);else exportToFile(data,columns,filename,opt.fmt);}} style={{display:'block',width:'100%',padding:'10px 16px',border:'none',background:'#fff',textAlign:'left',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'#1A202C',borderBottom:'1px solid #F0F2F5'}} onMouseOver={e=>e.target.style.background='#F0FDF4'} onMouseOut={e=>e.target.style.background='#fff'}>{opt.label}</button>
        ))}
      </div>}
    </div>
  );
};
const SelBox = ({ checked, onChange }) => (
  <input type="checkbox" checked={checked} onChange={onChange} style={{width:16,height:16,cursor:'pointer',accentColor:'#0B7A3E'}}/>
);

// ════════════════════════════ QR CODE GENERATOR ══════════════════════
// Simple QR-like pattern generator for WhatsApp Baileys simulation
const QRCodeCanvas = ({ text, size = 200 }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const modules = 25;
    const cellSize = size / modules;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    // Generate deterministic pattern from text
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = ((seed << 5) - seed) + text.charCodeAt(i);
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    // Draw finder patterns
    const drawFinder = (x, y) => {
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
        if (i===0||i===6||j===0||j===6||(i>=2&&i<=4&&j>=2&&j<=4)) ctx.fillRect((x+j)*cellSize, (y+i)*cellSize, cellSize, cellSize);
      }
    };
    drawFinder(0, 0); drawFinder(modules-7, 0); drawFinder(0, modules-7);
    // Fill data area
    for (let i = 0; i < modules; i++) for (let j = 0; j < modules; j++) {
      if ((i<7&&j<7)||(i<7&&j>=modules-7)||(i>=modules-7&&j<7)) continue;
      if (rng() > 0.5) ctx.fillRect(j*cellSize, i*cellSize, cellSize, cellSize);
    }
  }, [text, size]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8, border: '4px solid #fff', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />;
};

// ════════════════════════════ MAIN APP ════════════════════════════════
export default function App() {
  // ── Check if opened as Order Detail Window ──
  const urlParams = new URLSearchParams(window.location.search);
  const isOrderDetailWindow = urlParams.get('orderDetail') === 'true';
  const [orderDetailData, setOrderDetailData] = useState(() => {
    if (isOrderDetailWindow) {
      const stored = localStorage.getItem('viewOrderDetail');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  // ── Auth State ──
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState(() => {
    try { const u = localStorage.getItem('mih_currentUser'); const t = localStorage.getItem('mih_token'); if (u && t) return JSON.parse(u); return null; } catch { return null; }
  });
  const [authView, setAuthView] = useState('login'); // login | register
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ username: '', password: '', name: '', email: '', phone: '' });
  const [pendingUsers, setPendingUsers] = useState([]);

  // ── App State ──
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [allOrdersTypeFilter, setAllOrdersTypeFilter] = useState('All');
  const [allOrdersMonth, setAllOrdersMonth] = useState('All');
  const [allOrdersStatus, setAllOrdersStatus] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [notifs, setNotifs] = useState([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBulkGroup, setSelectedBulkGroup] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [historyImportData, setHistoryImportData] = useState([]);
  const [historyImportPreview, setHistoryImportPreview] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState({ key: 'sg', dir: 'desc' });
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [priceConfig, setPriceConfig] = useState(PRICE_CONFIG_DEFAULT);
  const [catalogPage, setCatalogPage] = useState(0);
  const [showCatalogMapper, setShowCatalogMapper] = useState(false);
  const [catalogMapperData, setCatalogMapperData] = useState({ rows: [], headers: [], fileName: '' });
  const [catalogColumnMap, setCatalogColumnMap] = useState({ m: '', d: '', c: '', sg: '', dist: '', tp: '', rsp: '' });

  // ── WhatsApp Baileys State ──
  const [waConnected, setWaConnected] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waQrVisible, setWaQrVisible] = useState(false);
  const [waQrCode, setWaQrCode] = useState('');
  const [waSessionInfo, setWaSessionInfo] = useState(null);
  const [waMessages, setWaMessages] = useState([]);
  const [waRecipient, setWaRecipient] = useState('');
  const [waMessageText, setWaMessageText] = useState('');
  const [waTemplate, setWaTemplate] = useState('custom');

  // ── Bulk Order State ──
  const [showBulkOrder, setShowBulkOrder] = useState(false);
  const [bulkMonth, setBulkMonth] = useState('Feb 2026');
  const [bulkItems, setBulkItems] = useState([{ materialNo: '', description: '', quantity: 1, listPrice: 0 }]);
  const [bulkOrderBy, setBulkOrderBy] = useState('');
  const [bulkRemark, setBulkRemark] = useState('');
  const [bulkGroups, setBulkGroups] = useState([]);// Cleared for history import

  // ── Stock Check & Notif Log ──
  const [stockChecks, setStockChecks] = useState([]);

  // ── Part Arrival Check State ──
  const [arrivalCheckMode, setArrivalCheckMode] = useState(false);
  const [selectedBulkForArrival, setSelectedBulkForArrival] = useState(null);
  const [arrivalItems, setArrivalItems] = useState([]);
  const [arrivalStatusFilter, setArrivalStatusFilter] = useState('All');
  const [pendingArrival, setPendingArrival] = useState({}); // {orderId: {qtyReceived, backOrder}} - keyed-in but not confirmed
  const [arrivalSelected, setArrivalSelected] = useState(new Set()); // selected order IDs for batch confirm

  // ── Enhanced Stock Check State ──
  const [stockCheckMode, setStockCheckMode] = useState(false);
  const [stockInventoryList, setStockInventoryList] = useState([]);
  const [selectedStockCheck, setSelectedStockCheck] = useState(null);

  const [notifLog, setNotifLog] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [auditFilter, setAuditFilter] = useState({ action: 'All', user: 'All', entityType: 'All' });
  const [machines, setMachines] = useState([]);

  const notify = useCallback((title, message, type = 'info') => {
    setNotifs(prev => [...prev, { title, message, type }]);
    setTimeout(() => setNotifs(prev => prev.slice(1)), 4000);
  }, []);

  // DB sync wrapper: shows toast on API failure (non-blocking)
  const dbSync = useCallback((promise, msg) => {
    Promise.resolve(promise).then(r => {
      if (r === null || r === false) notify('Save Failed', msg || 'Failed to save to database. Please retry.', 'error');
    }).catch(() => notify('Save Failed', msg || 'Failed to save to database. Please retry.', 'error'));
  }, []);

  // Persist helpers: update local state AND save to DB
  const addNotifEntry = useCallback((entry) => {
    setNotifLog(prev=>[entry,...prev]);
    dbSync(api.createNotifEntry(entry), 'Notification log not saved');
  }, [dbSync]);
  const addApproval = useCallback((entry) => {
    setPendingApprovals(prev=>[entry,...prev]);
    dbSync(api.createApproval(entry), 'Approval not saved');
  }, [dbSync]);
  const logAction = useCallback((action, entityType, entityId, details) => {
    const entry = { userId: currentUser?.id, userName: currentUser?.name, action, entityType, entityId, details };
    setAuditLog(prev => [{ ...entry, createdAt: new Date().toISOString(), id: Date.now() }, ...prev]);
    api.createAuditEntry(entry).catch(() => {});
  }, [currentUser]);
  const addStockCheck = useCallback((entry) => {
    setStockChecks(prev=>[entry,...prev]);
    dbSync(api.createStockCheck(entry), 'Stock check not saved');
  }, [dbSync]);

  // Numeric coercion helpers — PostgreSQL NUMERIC(12,2) returns strings
  const numOrders = arr => arr.map(o => ({...o, totalCost:Number(o.totalCost)||0, quantity:Number(o.quantity)||0, qtyReceived:Number(o.qtyReceived)||0, backOrder:Number(o.backOrder)||0, listPrice:Number(o.listPrice)||0}));
  const numBulk = arr => arr.map(g => ({...g, totalCost:Number(g.totalCost)||0, items:Number(g.items)||0}));
  const numApprovals = arr => arr.map(a => ({...a, totalCost:Number(a.totalCost)||0, quantity:Number(a.quantity)||0}));
  const numCatalog = arr => arr.map(p => ({...p, sgPrice:Number(p.sgPrice)||0, distPrice:Number(p.distPrice)||0, transferPrice:Number(p.transferPrice)||0, rspEur:Number(p.rspEur)||0}));
  const numStockChecks = arr => arr.map(c => ({...c, items:Number(c.items)||0, disc:Number(c.disc)||0}));

  // Helper: recalculate bulk group items/totalCost for affected bulk group IDs after order changes
  const recalcBulkGroupForMonths = useCallback((bgIds, ordersAfterChange) => {
    const idSet = new Set(bgIds.filter(Boolean));
    if (!idSet.size) return;
    setBulkGroups(prev => prev.map(bg => {
      if (!idSet.has(bg.id)) return bg;
      const bgOrders = ordersAfterChange.filter(o => o.bulkGroupId === bg.id);
      const newItems = bgOrders.length;
      const newTotalCost = bgOrders.reduce((s, o) => s + (o.totalCost || 0), 0);
      if (bg.items !== newItems || Math.abs((bg.totalCost || 0) - newTotalCost) > 0.01) {
        dbSync(api.updateBulkGroup(bg.id, { items: newItems, totalCost: newTotalCost }), 'Bulk group tally sync');
        return { ...bg, items: newItems, totalCost: newTotalCost };
      }
      return bg;
    }));
  }, [dbSync]);

  // Helper: auto-complete bulk group when all orders received
  const checkBulkGroupCompletion = useCallback((bulkGroupId, ordersAfterChange) => {
    if (!bulkGroupId) return;
    setBulkGroups(prev => prev.map(bg => {
      if (bg.id !== bulkGroupId || bg.status === 'Completed') return bg;
      const bgOrders = ordersAfterChange.filter(o => o.bulkGroupId === bg.id);
      if (bgOrders.length > 0 && bgOrders.every(o => (o.qtyReceived || 0) >= o.quantity)) {
        dbSync(api.updateBulkGroup(bg.id, { status: 'Completed' }), 'Bulk group completion sync');
        return { ...bg, status: 'Completed' };
      }
      return bg;
    }));
  }, [dbSync]);

  // Helper: confirm arrival for a single order — applies status based on qtyReceived
  // Works with pending value OR current value (e.g. 0 = no items received → Back Order)
  const confirmArrival = useCallback((orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const pending = pendingArrival[orderId];
    const val = pending ? pending.qtyReceived : (order.qtyReceived || 0);
    const status = val >= order.quantity ? 'Received' : 'Back Order';
    const updates = { qtyReceived: val, backOrder: val - order.quantity, status, arrivalDate: val > 0 ? new Date().toISOString().slice(0, 10) : order.arrivalDate };
    const updatedOrders = orders.map(x => x.id === orderId ? { ...x, ...updates } : x);
    setOrders(updatedOrders);
    dbSync(api.updateOrder(orderId, updates), 'Arrival update not saved');
    if (order.bulkGroupId) checkBulkGroupCompletion(order.bulkGroupId, updatedOrders);
    setPendingArrival(prev => { const next = { ...prev }; delete next[orderId]; return next; });
    setArrivalSelected(prev => { const next = new Set(prev); next.delete(orderId); return next; });
    logAction('Confirm Arrival', 'order', orderId, { qtyReceived: val, status });
  }, [orders, pendingArrival, checkBulkGroupCompletion, dbSync, logAction]);

  // Helper: batch confirm — confirms all provided orderIds (or all with pending values)
  const batchConfirmArrival = useCallback((orderIds) => {
    if (!orderIds || orderIds.length === 0) return;
    let updatedOrders = [...orders];
    const confirmedIds = [];
    const updates = [];
    orderIds.forEach(orderId => {
      const order = updatedOrders.find(o => o.id === orderId);
      if (!order || order.status === 'Received') return;
      const pending = pendingArrival[orderId];
      const val = pending ? pending.qtyReceived : (order.qtyReceived || 0);
      const status = val >= order.quantity ? 'Received' : 'Back Order';
      const upd = { qtyReceived: val, backOrder: val - order.quantity, status, arrivalDate: val > 0 ? new Date().toISOString().slice(0, 10) : order.arrivalDate };
      updatedOrders = updatedOrders.map(x => x.id === orderId ? { ...x, ...upd } : x);
      updates.push({ orderId, upd, bulkGroupId: order.bulkGroupId });
      confirmedIds.push(orderId);
    });
    if (confirmedIds.length === 0) return;
    setOrders(updatedOrders);
    updates.forEach(({ orderId, upd, bulkGroupId }) => {
      dbSync(api.updateOrder(orderId, upd), 'Arrival update not saved');
      if (bulkGroupId) checkBulkGroupCompletion(bulkGroupId, updatedOrders);
    });
    setPendingArrival(prev => {
      const next = { ...prev };
      confirmedIds.forEach(id => delete next[id]);
      return next;
    });
    setArrivalSelected(new Set());
    logAction('Batch Confirm Arrival', 'order', confirmedIds.join(','), { count: confirmedIds.length });
    notify('Arrival Confirmed', `${confirmedIds.length} order(s) status updated`, 'success');
  }, [orders, pendingArrival, checkBulkGroupCompletion, dbSync, logAction, notify]);

  const isAdmin = currentUser?.role === 'admin';

  // ── Feature Permissions ──
  const FEATURE_PERMISSIONS = [
    { key: 'dashboard', label: 'Dashboard', group: 'Pages' },
    { key: 'catalog', label: 'Parts Catalog', group: 'Pages' },
    { key: 'orders', label: 'Orders', group: 'Pages' },
    { key: 'bulkOrders', label: 'Bulk Orders', group: 'Pages' },
    { key: 'analytics', label: 'Analytics', group: 'Pages' },
    { key: 'stockCheck', label: 'Stock Check', group: 'Pages' },
    { key: 'delivery', label: 'Part Arrival', group: 'Pages' },
    { key: 'whatsapp', label: 'WhatsApp', group: 'Pages' },
    { key: 'notifications', label: 'Notifications', group: 'Pages' },
    { key: 'auditTrail', label: 'Audit Trail', group: 'Pages' },
    { key: 'editAllOrders', label: 'Edit All Orders', group: 'Actions' },
    { key: 'deleteOrders', label: 'Delete Orders', group: 'Actions' },
    { key: 'editAllBulkOrders', label: 'Edit All Bulk Orders', group: 'Actions' },
    { key: 'deleteBulkOrders', label: 'Delete Bulk Orders', group: 'Actions' },
    { key: 'deleteStockChecks', label: 'Delete Stock Checks', group: 'Actions' },
    { key: 'deleteNotifications', label: 'Delete Notifications', group: 'Actions' },
    { key: 'approvals', label: 'Manage Approvals', group: 'Admin' },
    { key: 'users', label: 'User Management', group: 'Admin' },
    { key: 'settings', label: 'Settings', group: 'Admin' },
    { key: 'aiBot', label: 'AI Bot Admin', group: 'Admin' },
  ];
  const DEFAULT_USER_PERMS = { dashboard:true,catalog:true,orders:true,bulkOrders:true,analytics:true,stockCheck:true,delivery:true,whatsapp:true,notifications:true,auditTrail:false,editAllOrders:false,deleteOrders:false,editAllBulkOrders:false,deleteBulkOrders:false,deleteStockChecks:false,deleteNotifications:false,approvals:false,users:false,settings:false,aiBot:false };
  const hasPermission = useCallback((key) => {
    if (isAdmin) return true;
    const perms = currentUser?.permissions || DEFAULT_USER_PERMS;
    return perms[key] === true;
  }, [currentUser, isAdmin]);

  // ── Catalog ──
  const catalogLookup = useMemo(() => { const m={}; partsCatalog.forEach(p=>{m[p.m]=p;}); return m; }, [partsCatalog]);
  const PAGE_SIZE = 25;
  const catalog = useMemo(() => {
    let items = partsCatalog.map(p => ({ materialNo:p.m, description:p.d, category:p.c, singaporePrice:p.sg, distributorPrice:p.dist, transferPrice:p.tp, rspEur:p.rsp }));
    if (catalogSearch) { const q=catalogSearch.toLowerCase(); items=items.filter(p=>p.materialNo.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)); }
    if (catFilter !== 'All') items=items.filter(p=>p.category===catFilter);
    const key = catalogSort.key==='sg'?'singaporePrice':catalogSort.key==='dist'?'distributorPrice':catalogSort.key==='tp'?'transferPrice':'description';
    items.sort((a,b) => { const va=a[key],vb=b[key]; return catalogSort.dir==='asc'?(va>vb?1:-1):(va<vb?1:-1); });
    return items;
  }, [partsCatalog, catalogSearch, catFilter, catalogSort]);

  // ── Stats ──
  const stats = useMemo(() => {
    const t=orders.length, r=orders.filter(o=>o.status==='Received').length, b=orders.filter(o=>o.status==='Back Order').length;
    const p=orders.filter(o=>o.status==='Pending Approval'||o.status==='Approved').length;
    const tc=orders.reduce((s,o)=>s+(Number(o.totalCost)||0),0), tq=orders.reduce((s,o)=>s+(Number(o.quantity)||0),0), tr=orders.reduce((s,o)=>s+(Number(o.qtyReceived)||0),0);
    return { total:t, received:r, backOrder:b, pending:p, totalCost:tc, fulfillmentRate: tq>0?((tr/tq)*100).toFixed(1):0 };
  }, [orders]);
  const filteredOrders = useMemo(() => orders.filter(o => {
    if (o.bulkGroupId) return false;
    const ms = !search || o.materialNo.toLowerCase().includes(search.toLowerCase()) || o.description.toLowerCase().includes(search.toLowerCase()) || o.orderBy.toLowerCase().includes(search.toLowerCase());
    return ms && (statusFilter==='All'||o.status===statusFilter);
  }), [orders, search, statusFilter]);
  const monthlyData = useMemo(() => {
    const monthMap = {};
    orders.forEach(o => {
      if (!o.month) return;
      // Normalize month key: strip prefixes like "2_", replace underscores with spaces
      const norm = o.month.replace(/^\d+_/,'').replace(/_/g,' ');
      // Extract short month name for display (e.g. "Feb 2026" → "Feb '26")
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0,3)} '${parts[1].slice(2)}` : norm;
      if (!monthMap[shortLabel]) monthMap[shortLabel] = {name:shortLabel, orders:0, cost:0, received:0, backOrder:0, _sortKey:norm};
      monthMap[shortLabel].orders++;
      monthMap[shortLabel].cost += (Number(o.totalCost)||0);
      if (o.status==='Received') monthMap[shortLabel].received++;
      if (o.status==='Back Order') monthMap[shortLabel].backOrder++;
    });
    // Sort chronologically
    const monthOrder = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    return Object.values(monthMap).sort((a,b) => {
      const [am,ay] = a._sortKey.toLowerCase().split(' ');
      const [bm,by] = b._sortKey.toLowerCase().split(' ');
      return (parseInt(ay)||0) - (parseInt(by)||0) || (monthOrder[am?.slice(0,3)]||0) - (monthOrder[bm?.slice(0,3)]||0);
    });
  }, [orders]);
  const statusPieData = useMemo(() => [{name:'Received',value:stats.received,color:'#0B7A3E'},{name:'Back Order',value:stats.backOrder,color:'#C53030'},{name:'In Progress',value:stats.pending,color:'#2563EB'}], [stats]);
  const allOrdersMonths = useMemo(() => [...new Set([...orders.map(o=>o.month),...bulkGroups.map(g=>g.month)].filter(Boolean))].sort(), [orders, bulkGroups]);
  const allOrdersCombined = useMemo(() => {
    let combined = orders.map(o=>({...o, orderType: o.bulkGroupId ? 'Bulk' : 'Single'}));
    if (allOrdersTypeFilter!=='All') combined = combined.filter(o=>o.orderType===(allOrdersTypeFilter==='Single Orders'?'Single':'Bulk'));
    if (allOrdersMonth!=='All') combined = combined.filter(o=>o.month===allOrdersMonth);
    if (allOrdersStatus!=='All') combined = combined.filter(o=>o.status===allOrdersStatus);
    return combined;
  }, [orders, allOrdersTypeFilter, allOrdersMonth, allOrdersStatus]);
  const topItems = useMemo(() => {
    const m={}; orders.forEach(o=>{if(!m[o.description])m[o.description]={name:o.description.length>30?o.description.slice(0,30)+'...':o.description,qty:0,cost:0};m[o.description].qty+=(Number(o.quantity)||0);m[o.description].cost+=(Number(o.totalCost)||0);});
    return Object.values(m).sort((a,b)=>b.cost-a.cost).slice(0,8);
  }, [orders]);
  const catPriceData = useMemo(() => Object.entries(CATEGORIES).map(([k,c])=>{const i=partsCatalog.filter(p=>p.c===k);if(!i.length)return null;return{name:c.short,sg:Math.round(i.reduce((s,p)=>s+p.sg,0)/i.length),dist:Math.round(i.reduce((s,p)=>s+p.dist,0)/i.length),count:i.length,color:c.color};}).filter(Boolean),[partsCatalog]);
  const catalogStats = useMemo(()=>{const t=partsCatalog.length;const cc={};partsCatalog.forEach(p=>{cc[p.c]=(cc[p.c]||0)+1;});return{total:t,avgSg:partsCatalog.reduce((s,p)=>s+p.sg,0)/t,avgDist:partsCatalog.reduce((s,p)=>s+p.dist,0)/t,catCounts:cc};},[partsCatalog]);

  // ── Advanced Analytics Memos ──
  const leadTimeData = useMemo(() => {
    const monthMap = {};
    orders.forEach(o => {
      if (!o.orderDate || !o.arrivalDate || o.status !== 'Received') return;
      const diff = Math.round((new Date(o.arrivalDate) - new Date(o.orderDate)) / 86400000);
      if (diff < 0 || diff > 365) return;
      const norm = o.month?.replace(/^\d+_/,'').replace(/_/g,' ') || 'Unknown';
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0,3)} '${parts[1].slice(2)}` : norm;
      if (!monthMap[shortLabel]) monthMap[shortLabel] = { name: shortLabel, totalDays: 0, count: 0, _sortKey: norm };
      monthMap[shortLabel].totalDays += diff;
      monthMap[shortLabel].count++;
    });
    return Object.values(monthMap).map(m => ({ ...m, avgDays: Math.round(m.totalDays / m.count) })).sort((a, b) => {
      const mo = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
      const [am,ay] = a._sortKey.toLowerCase().split(' ');
      const [bm,by] = b._sortKey.toLowerCase().split(' ');
      return (parseInt(ay)||0) - (parseInt(by)||0) || (mo[am?.slice(0,3)]||0) - (mo[bm?.slice(0,3)]||0);
    });
  }, [orders]);

  const statusTrendData = useMemo(() => {
    const monthMap = {};
    orders.forEach(o => {
      if (!o.month) return;
      const norm = o.month.replace(/^\d+_/,'').replace(/_/g,' ');
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0,3)} '${parts[1].slice(2)}` : norm;
      if (!monthMap[shortLabel]) monthMap[shortLabel] = { name: shortLabel, 'Pending Approval': 0, Approved: 0, Received: 0, 'Back Order': 0, Rejected: 0, _sortKey: norm };
      if (monthMap[shortLabel][o.status] !== undefined) monthMap[shortLabel][o.status]++;
    });
    const mo = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    return Object.values(monthMap).sort((a,b) => {
      const [am,ay] = a._sortKey.toLowerCase().split(' ');
      const [bm,by] = b._sortKey.toLowerCase().split(' ');
      return (parseInt(ay)||0) - (parseInt(by)||0) || (mo[am?.slice(0,3)]||0) - (mo[bm?.slice(0,3)]||0);
    });
  }, [orders]);

  const materialFrequency = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      const key = o.materialNo || o.description;
      if (!m[key]) m[key] = { name: (o.description||key).length > 25 ? (o.description||key).slice(0,25)+'...' : (o.description||key), materialNo: o.materialNo, qty: 0, cost: 0, orderCount: 0 };
      m[key].qty += (Number(o.quantity)||0);
      m[key].cost += (Number(o.totalCost)||0);
      m[key].orderCount++;
    });
    return Object.values(m).sort((a,b) => b.orderCount - a.orderCount).slice(0, 10);
  }, [orders]);

  const categorySpendData = useMemo(() => {
    const catMap = {};
    orders.forEach(o => {
      const cat = partsCatalog.find(p => p.m === o.materialNo);
      const catName = cat ? (CATEGORIES[cat.c]?.short || cat.c || 'Unknown') : 'Unknown';
      if (!catMap[catName]) catMap[catName] = { name: catName, value: 0, count: 0, color: cat ? (CATEGORIES[cat.c]?.color || '#94A3B8') : '#94A3B8' };
      catMap[catName].value += (Number(o.totalCost)||0);
      catMap[catName].count++;
    });
    return Object.values(catMap).sort((a,b) => b.value - a.value);
  }, [orders, partsCatalog]);

  // ── New Order ──
  
  // ── AI Bot State ──
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState([]);
  const [aiBotConfig, setAiBotConfig] = useState({ template: 'sales', customInstructions: '', greeting: "Hi! I'm your Miltenyi inventory assistant. I can help with pricing, orders, and stock checks.", apiKey: '' });
const [customLogo, setCustomLogo] = useState(() => {
    try { const v = localStorage.getItem('mih_customLogo'); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [waAutoReply, setWaAutoReply] = useState(false);
  const [waNotifyRules, setWaNotifyRules] = useState({ orderCreated: true, bulkOrderCreated: true, partArrivalDone: true, deliveryArrival: true, backOrderUpdate: true, lowStockAlert: false, monthlySummary: false, urgentRequest: true });
  const [scheduledNotifs, setScheduledNotifs] = useState({ enabled: true, frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1, time: '09:00', lastRun: null, recipients: [], emailEnabled: true, whatsappEnabled: true, reports: { monthlySummary: true, backOrderReport: true, lowStockAlert: true, pendingApprovals: true, orderStats: true } });
const [emailConfig, setEmailConfig] = useState({ senderEmail: 'inventory@miltenyibiotec.com', senderName: 'Miltenyi Inventory Hub', smtpHost: '', smtpPort: 587, enabled: true, approverEmail: '', approvalEnabled: true, approvalKeywords: ['approve', 'approved', 'yes', 'confirm', 'confirmed', 'ok', 'accept', 'accepted'] });
  const [emailTemplates, setEmailTemplates] = useState({
    orderApproval: { subject: '[APPROVAL] Order {orderId} - {description}', body: 'Order Approval Request\n\nOrder ID: {orderId}\nDescription: {description}\nMaterial No: {materialNo}\nQuantity: {quantity}\nTotal: S${totalCost}\nRequested By: {orderBy}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG' },
    bulkApproval: { subject: '[APPROVAL] Bulk Order {batchId} - {month}', body: 'Bulk Order Approval Request\n\nBatch ID: {batchId}\nMonth: {month}\nItems: {itemCount}\nTotal Cost: S${totalCost}\nRequested By: {orderBy}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG' },
    orderNotification: { subject: 'New Order: {orderId} - {description}', body: 'A new order has been created.\n\nOrder ID: {orderId}\nItem: {description}\nMaterial: {materialNo}\nQuantity: {quantity}\nTotal: S${totalCost}\nOrdered By: {orderBy}\nDate: {date}\n\n-Miltenyi Inventory Hub SG' },
    backOrderAlert: { subject: 'Back Order Alert: {description}', body: 'Back Order Alert\n\nThe following item is on back order:\n\nOrder ID: {orderId}\nItem: {description}\nOrdered: {quantity}\nReceived: {received}\nPending: {pending}\n\nPlease follow up with HQ.\n\n-Miltenyi Inventory Hub SG' },
    monthlySummary: { subject: 'Monthly Summary - {month}', body: 'Monthly Inventory Summary\n\nMonth: {month}\nTotal Orders: {totalOrders}\nReceived: {received}\nPending: {pending}\nBack Orders: {backOrders}\nTotal Value: S${totalValue}\n\n-Miltenyi Inventory Hub SG' },
    partArrivalDone: { subject: 'Part Arrival Verified - {month}', body: 'Part Arrival Verified\n\nMonth: {month}\nTotal Items: {totalItems}\nFully Received: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\nDate: {date}\n\nItems:\n{itemsList}\n\n-Miltenyi Inventory Hub SG' }
  });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [waAllowedSenders, setWaAllowedSenders] = useState(['admin']); // usernames allowed to connect WhatsApp
  const [aiConversationLogs, setAiConversationLogs] = useState([]);
  const [aiAdminTab, setAiAdminTab] = useState('knowledge');
  const [forecastTab, setForecastTab] = useState('forecast');
  const [forecastMaterial, setForecastMaterial] = useState('');
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [newMachine, setNewMachine] = useState({ name: '', modality: '', location: '', installDate: '', status: 'Active', notes: '' });

  // ── Batch Selection State ──
  const [selOrders, setSelOrders] = useState(new Set());
  const [selBulk, setSelBulk] = useState(new Set());
  const [selUsers, setSelUsers] = useState(new Set());
  const [selStockChecks, setSelStockChecks] = useState(new Set());
  const [selNotifs, setSelNotifs] = useState(new Set());
  const [selApprovals, setSelApprovals] = useState(new Set());

  // ── Loading State ──
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Persist currentUser to localStorage ──
  useEffect(() => {
    try {
      if (currentUser) { localStorage.setItem('mih_currentUser', JSON.stringify(currentUser)); }
      else { localStorage.removeItem('mih_currentUser'); }
    } catch(e){}
  }, [currentUser]);

  // ── Auto-logout on token expiry ──
  useEffect(() => {
    api.onAuthError(() => { setCurrentUser(null); notify('Session Expired','Please log in again','warning'); });
  }, []);

  // ── localStorage Persistence ──
  const LS_KEYS = { orders: 'mih_orders', bulkGroups: 'mih_bulkGroups', emailConfig: 'mih_emailConfig', emailTemplates: 'mih_emailTemplates', priceConfig: 'mih_priceConfig', notifLog: 'mih_notifLog', pendingApprovals: 'mih_pendingApprovals', users: 'mih_users', waNotifyRules: 'mih_waNotifyRules', scheduledNotifs: 'mih_scheduledNotifs', customLogo: 'mih_customLogo', stockChecks: 'mih_stockChecks' };

  // Shared function to load all app data from DB
  // Uses !== null checks: null = API failed (skip), [] = DB empty (set empty state)
  const loadAppData = useCallback(async () => {
    try {
      const [apiOrders, apiBulk, apiUsers, apiChecks, apiNotifs, apiApprovals, apiConfig, apiCatalog, apiAudit, apiMachines] = await Promise.all([
        api.getOrders(), api.getBulkGroups(), api.getUsers(), api.getStockChecks(),
        api.getNotifLog(), api.getApprovals(), api.getConfig(), api.getCatalog(),
        api.getAuditLog(), api.getMachines()
      ]);
      if (apiOrders !== null) setOrders(numOrders(apiOrders));
      if (apiBulk !== null) setBulkGroups(numBulk(apiBulk));
      if (apiUsers !== null) setUsers(apiUsers);
      if (apiChecks !== null) setStockChecks(numStockChecks(apiChecks));
      if (apiNotifs !== null) setNotifLog(apiNotifs);
      if (apiAudit !== null) setAuditLog(apiAudit);
      if (apiMachines !== null) setMachines(apiMachines);
      if (apiApprovals !== null) setPendingApprovals(numApprovals(apiApprovals));
      if (apiConfig && Object.keys(apiConfig).length) {
        if (apiConfig.emailConfig && typeof apiConfig.emailConfig === 'object') setEmailConfig(prev => ({...prev, ...apiConfig.emailConfig}));
        if (apiConfig.emailTemplates && typeof apiConfig.emailTemplates === 'object') setEmailTemplates(prev => ({...prev, ...apiConfig.emailTemplates}));
        if (apiConfig.priceConfig && typeof apiConfig.priceConfig === 'object') setPriceConfig(prev => ({...prev, ...apiConfig.priceConfig}));
        if (apiConfig.waNotifyRules && typeof apiConfig.waNotifyRules === 'object') setWaNotifyRules(prev => ({...prev, ...apiConfig.waNotifyRules}));
        if (apiConfig.scheduledNotifs && typeof apiConfig.scheduledNotifs === 'object') setScheduledNotifs(prev => ({...prev, ...apiConfig.scheduledNotifs, reports: {...prev.reports, ...(apiConfig.scheduledNotifs.reports||{})}}));
        if (apiConfig.customLogo) setCustomLogo(apiConfig.customLogo);
        if (apiConfig.aiBotConfig && typeof apiConfig.aiBotConfig === 'object') setAiBotConfig(prev => ({...prev, ...apiConfig.aiBotConfig}));
        if (apiConfig.waAutoReply !== undefined) setWaAutoReply(apiConfig.waAutoReply);
        if (Array.isArray(apiConfig.waAllowedSenders)) setWaAllowedSenders(apiConfig.waAllowedSenders);
      }
      if (apiCatalog !== null) { const nc = numCatalog(apiCatalog); setPartsCatalog(nc.map(p => ({ m: p.materialNo, d: p.description, c: p.category, sg: p.sgPrice, dist: p.distPrice, tp: p.transferPrice, rsp: p.rspEur }))); }
      console.log('Data loaded from database');
      return true;
    } catch (e) {
      console.log('API not available:', e.message);
      return false;
    }
  }, []);

  // Load data on mount — refresh session, fetch logo, then load all data from DB
  useEffect(() => {
    async function loadOnMount() {
      // 1. Always fetch latest logo from public endpoint (works before login)
      try {
        const dbLogo = await api.getPublicLogo();
        if (dbLogo !== null) setCustomLogo(dbLogo);
      } catch {}

      // 2. If we have a stored token, validate session and refresh user from DB
      const hasToken = !!api.getToken();
      if (hasToken) {
        try {
          const meResult = await api.getMe();
          if (meResult && meResult.user) {
            setCurrentUser(meResult.user); // Fresh data from DB (permissions, role, etc.)
          } else {
            // Token invalid/expired — clear session silently (no toast on first load)
            setCurrentUser(null);
            api.logout();
            api.resetAuthError(); // suppress any 401 toasts from data-load calls below
            return; // skip data loading — not authenticated
          }
        } catch {
          // API unreachable — keep localStorage user as fallback
        }
      }

      // 3. Load all app data from DB (requires valid token for protected routes)
      const loaded = await loadAppData();
      if (loaded) return;

      // Fallback to localStorage
      try {
        const saved = {};
        Object.entries(LS_KEYS).forEach(([key, lsKey]) => { const v = localStorage.getItem(lsKey); if (v) saved[key] = JSON.parse(v); });
        if (saved.orders?.length) setOrders(saved.orders);
        if (saved.bulkGroups?.length) setBulkGroups(saved.bulkGroups);
        if (saved.emailConfig) setEmailConfig(saved.emailConfig);
        if (saved.emailTemplates) setEmailTemplates(saved.emailTemplates);
        if (saved.priceConfig) setPriceConfig(saved.priceConfig);
        if (saved.notifLog?.length) setNotifLog(saved.notifLog);
        if (saved.pendingApprovals?.length) setPendingApprovals(saved.pendingApprovals);
        if (saved.users?.length) setUsers(saved.users);
        if (saved.waNotifyRules) setWaNotifyRules(saved.waNotifyRules);
        if (saved.scheduledNotifs) setScheduledNotifs(saved.scheduledNotifs);
        if (saved.customLogo) setCustomLogo(saved.customLogo);
        if (saved.stockChecks?.length) setStockChecks(saved.stockChecks);
      } catch (e) { console.warn('Failed to load saved data:', e); }
    }
    loadOnMount().finally(() => setIsLoading(false));
  }, []);

  // Targeted data refresh when switching tabs
  const refreshPageData = useCallback(async (pageId) => {
    try {
      switch (pageId) {
        case 'dashboard': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o)); if (b) setBulkGroups(numBulk(b));
          break;
        }
        case 'orders': {
          const o = await api.getOrders();
          if (o) setOrders(numOrders(o));
          break;
        }
        case 'bulkorders': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o)); if (b) setBulkGroups(numBulk(b));
          break;
        }
        case 'stockcheck': {
          const c = await api.getStockChecks();
          if (c) setStockChecks(numStockChecks(c));
          break;
        }
        case 'delivery': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o)); if (b) setBulkGroups(numBulk(b));
          break;
        }
        case 'analytics': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o)); if (b) setBulkGroups(numBulk(b));
          break;
        }
        case 'notifications': {
          const n = await api.getNotifLog();
          if (n) setNotifLog(n);
          break;
        }
        case 'users': {
          const u = await api.getUsers();
          if (u) setUsers(u);
          break;
        }
        case 'settings': {
          const cfg = await api.getConfig();
          if (cfg && Object.keys(cfg).length) {
            if (cfg.emailConfig && typeof cfg.emailConfig === 'object') setEmailConfig(prev => ({...prev, ...cfg.emailConfig}));
            if (cfg.emailTemplates && typeof cfg.emailTemplates === 'object') setEmailTemplates(prev => ({...prev, ...cfg.emailTemplates}));
            if (cfg.priceConfig && typeof cfg.priceConfig === 'object') setPriceConfig(prev => ({...prev, ...cfg.priceConfig}));
            if (cfg.waNotifyRules && typeof cfg.waNotifyRules === 'object') setWaNotifyRules(prev => ({...prev, ...cfg.waNotifyRules}));
            if (cfg.scheduledNotifs && typeof cfg.scheduledNotifs === 'object') setScheduledNotifs(prev => ({...prev, ...cfg.scheduledNotifs, reports: {...prev.reports, ...(cfg.scheduledNotifs.reports||{})}}));
            if (cfg.customLogo) setCustomLogo(cfg.customLogo);
            if (cfg.aiBotConfig && typeof cfg.aiBotConfig === 'object') setAiBotConfig(prev => ({...prev, ...cfg.aiBotConfig}));
            if (cfg.waAutoReply !== undefined) setWaAutoReply(cfg.waAutoReply);
            if (Array.isArray(cfg.waAllowedSenders)) setWaAllowedSenders(cfg.waAllowedSenders);
          }
          break;
        }
        case 'catalog': {
          const cat = await api.getCatalog();
          if (cat !== null) {
            const nc = numCatalog(cat);
            setPartsCatalog(nc.map(p => ({ m: p.materialNo, d: p.description, c: p.category, sg: p.sgPrice, dist: p.distPrice, tp: p.transferPrice, rsp: p.rspEur })));
          }
          break;
        }
        default: break;
      }
    } catch (e) { console.log('Tab refresh:', e.message); }
  }, []);

  // Refresh data when tab changes
  useEffect(() => {
    if (currentUser && page) refreshPageData(page);
  }, [page, refreshPageData, currentUser]);

  // Save to localStorage on changes
  useEffect(() => { try { localStorage.setItem(LS_KEYS.orders, JSON.stringify(orders)); } catch(e){} }, [orders]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.bulkGroups, JSON.stringify(bulkGroups)); } catch(e){} }, [bulkGroups]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.emailConfig, JSON.stringify(emailConfig)); } catch(e){} }, [emailConfig]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.emailTemplates, JSON.stringify(emailTemplates)); } catch(e){} }, [emailTemplates]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.priceConfig, JSON.stringify(priceConfig)); } catch(e){} }, [priceConfig]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.notifLog, JSON.stringify(notifLog)); } catch(e){} }, [notifLog]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.pendingApprovals, JSON.stringify(pendingApprovals)); } catch(e){} }, [pendingApprovals]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.users, JSON.stringify(users)); } catch(e){} }, [users]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.waNotifyRules, JSON.stringify(waNotifyRules)); } catch(e){} }, [waNotifyRules]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.scheduledNotifs, JSON.stringify(scheduledNotifs)); } catch(e){} }, [scheduledNotifs]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.customLogo, JSON.stringify(customLogo)); } catch(e){} }, [customLogo]);
  useEffect(() => { try { localStorage.setItem(LS_KEYS.stockChecks, JSON.stringify(stockChecks)); } catch(e){} }, [stockChecks]);

  // ── Open Order in New Tab ──
  const openOrderInNewTab = (order) => {
    localStorage.setItem('viewOrderDetail', JSON.stringify(order));
    window.open(`${window.location.origin}${window.location.pathname}?orderDetail=true`, '_blank', 'width=700,height=800,scrollbars=yes,resizable=yes');
  };

  // ── New Order ──
  const [newOrder, setNewOrder] = useState({ materialNo:'', description:'', quantity:1, listPrice:0, orderBy:'', remark:'', bulkGroupId:'' });
  const [newBulkMonth, setNewBulkMonth] = useState(''); // for "+ Create New Bulk Batch" inline picker
  const handleMaterialLookup = (matNo) => { const p=catalogLookup[matNo]; if(p) { setNewOrder(prev=>({...prev,materialNo:matNo,description:p.d,listPrice:p.tp})); notify('Part Found',`${p.d}`, 'success'); }};
  const handleSubmitOrder = async () => {
    if (!newOrder.materialNo?.trim()) { notify('Missing Field','Material No. is required','warning'); return; }
    if (!newOrder.description?.trim()) { notify('Missing Field','Description is required','warning'); return; }
    if (!parseInt(newOrder.quantity) || parseInt(newOrder.quantity) < 1) { notify('Invalid Quantity','Quantity must be at least 1','warning'); return; }
    if (!newOrder.orderBy) { notify('Missing Field','Order By is required','warning'); return; }
    setIsSubmitting(true);
    const now = new Date();
    const monthStr = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]} ${now.getFullYear()}`;
    const linkedBg = newOrder.bulkGroupId ? bulkGroups.find(bg => bg.id === newOrder.bulkGroupId) : null;
    const o = { id:`ORD-${2000+orders.length}`,...newOrder, bulkGroupId:linkedBg ? linkedBg.id : null, quantity:parseInt(newOrder.quantity), listPrice:parseFloat(newOrder.listPrice)||0, totalCost:(parseFloat(newOrder.listPrice)||0)*parseInt(newOrder.quantity), orderDate:now.toISOString().slice(0,10), arrivalDate:null, qtyReceived:0, backOrder:-parseInt(newOrder.quantity), engineer:'', emailFull:'', emailBack:'', status:'Pending Approval', approvalStatus:'pending', approvalSentDate:null, month:linkedBg ? linkedBg.month : monthStr, year:String(now.getFullYear()) };
    setOrders(prev=>[o,...prev]); setShowNewOrder(false); setNewOrder({materialNo:'',description:'',quantity:1,listPrice:0,orderBy:'',remark:'',bulkGroupId:''}); setNewBulkMonth('');
    if (linkedBg) recalcBulkGroupForMonths([linkedBg.id], [o, ...orders]);
    const created = await api.createOrder(o);
    setIsSubmitting(false);
    if (!created) { notify('Save Failed','Order not saved to database. Please retry.','error'); return; }
    notify('Order Created',`${o.description} — ${o.quantity} units. Select and use "Order Approval & Notify" to send for approval.`,'success');
    logAction('create', 'order', o.id, { description: o.description, quantity: o.quantity, totalCost: o.totalCost });
  };

  // ── Duplicate Order ──
  const handleDuplicateOrder = (sourceOrder) => {
    // Strip existing [Copy] or [Copy-N] prefix to get base name
    const baseName = sourceOrder.description.replace(/^\[Copy(?:-\d+)?\]\s*/, '');
    // Count existing copies of this base name
    const copyCount = orders.filter(o => {
      const stripped = o.description.replace(/^\[Copy(?:-\d+)?\]\s*/, '');
      return stripped === baseName && o.description !== baseName;
    }).length;
    const copyNum = copyCount + 1;
    const copy = {
      ...sourceOrder,
      id: `ORD-${2000+orders.length}`,
      description: `[Copy-${copyNum}] ${baseName}`,
      orderDate: new Date().toISOString().slice(0,10),
      arrivalDate: null,
      qtyReceived: 0,
      backOrder: -sourceOrder.quantity,
      status: 'Pending Approval',
      approvalStatus: undefined,
      approvalSentDate: undefined,
      emailFull: '',
      emailBack: '',
    };
    setOrders(prev=>[copy,...prev]);
    dbSync(api.createOrder(copy), 'Duplicated order not saved to database');
    notify('Order Duplicated',`[Copy-${copyNum}] ${baseName}`,'success');
  };

  // ── Approval Action Handler ──
  const handleApprovalAction = (approvalId, action) => {
    const approval = pendingApprovals.find(a=>a.id===approvalId);
    if (!approval) return;

    setPendingApprovals(prev=>prev.map(a=>a.id===approvalId?{...a,status:action,actionDate:new Date().toISOString().slice(0,10)}:a));
    dbSync(api.updateApproval(approvalId, {status:action,actionDate:new Date().toISOString().slice(0,10)}), 'Approval update not saved');

    if (action === 'approved') {
      // Update order status to Approved
      if (approval.orderType === 'single') {
        setOrders(prev=>prev.map(o=>o.id===approval.orderId?{...o,status:'Approved',approvalStatus:'approved'}:o));
        dbSync(api.updateOrder(approval.orderId, {status:'Approved',approvalStatus:'approved'}), 'Order approval not saved');
      } else if (approval.orderType === 'bulk' && approval.orderIds) {
        setOrders(prev=>prev.map(o=>approval.orderIds.includes(o.id)?{...o,status:'Approved',approvalStatus:'approved'}:o));
        setBulkGroups(prev=>prev.map(g=>g.id===approval.orderId?{...g,status:'Approved'}:g));
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Approved'), 'Bulk order status not saved');
        dbSync(api.updateBulkGroup(approval.orderId, {status:'Approved'}), 'Bulk group approval not saved');
      } else if (approval.orderType === 'batch' && approval.orderIds) {
        setOrders(prev=>prev.map(o=>approval.orderIds.includes(o.id)?{...o,status:'Approved',approvalStatus:'approved'}:o));
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Approved'), 'Batch order approval not saved');
      }
      addNotifEntry({id:`N-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'approval',to:approval.requestedBy,subject:`Order ${approval.orderId} Approved`,date:new Date().toISOString().slice(0,10),status:'Approved'});
      notify('Order Approved',`${approval.orderId} has been approved`,'success');
    } else {
      // Update order status to Rejected
      if (approval.orderType === 'single') {
        setOrders(prev=>prev.map(o=>o.id===approval.orderId?{...o,status:'Rejected',approvalStatus:'rejected'}:o));
        dbSync(api.updateOrder(approval.orderId, {status:'Rejected',approvalStatus:'rejected'}), 'Order rejection not saved');
      } else if (approval.orderType === 'bulk' && approval.orderIds) {
        setOrders(prev=>prev.map(o=>approval.orderIds.includes(o.id)?{...o,status:'Rejected',approvalStatus:'rejected'}:o));
        setBulkGroups(prev=>prev.map(g=>g.id===approval.orderId?{...g,status:'Rejected'}:g));
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Rejected'), 'Bulk order rejection not saved');
        dbSync(api.updateBulkGroup(approval.orderId, {status:'Rejected'}), 'Bulk group rejection not saved');
      } else if (approval.orderType === 'batch' && approval.orderIds) {
        setOrders(prev=>prev.map(o=>approval.orderIds.includes(o.id)?{...o,status:'Rejected',approvalStatus:'rejected'}:o));
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Rejected'), 'Batch order rejection not saved');
      }
      addNotifEntry({id:`N-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'approval',to:approval.requestedBy,subject:`Order ${approval.orderId} Rejected`,date:new Date().toISOString().slice(0,10),status:'Rejected'});
      notify('Order Rejected',`${approval.orderId} has been rejected`,'warning');
    }
  };

  // ── Batch Selection Helpers ──
  const toggleSel = (set, setter, id) => setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (set, setter, ids) => setter(prev => prev.size === ids.length ? new Set() : new Set(ids));

  // Batch Actions — Orders
  const batchDeleteOrders = () => {
    if (!selOrders.size || !window.confirm(`Delete ${selOrders.size} selected order(s)?`)) return;
    const ids = [...selOrders];
    const deletedOrders = orders.filter(o => selOrders.has(o.id));
    const remainingOrders = orders.filter(o => !selOrders.has(o.id));
    setOrders(remainingOrders);
    ids.forEach(id => dbSync(api.deleteOrder(id), 'Order delete not saved'));
    // Recalculate affected bulk group totals
    const affectedBgIds = [...new Set(deletedOrders.map(o => o.bulkGroupId).filter(Boolean))];
    if (affectedBgIds.length) recalcBulkGroupForMonths(affectedBgIds, remainingOrders);
    notify('Batch Delete', `${ids.length} orders deleted`, 'success');
    setSelOrders(new Set());
  };
  const batchStatusOrders = (status) => {
    if (!selOrders.size) return;
    const ids = [...selOrders];
    setOrders(prev => prev.map(o => selOrders.has(o.id) ? { ...o, status } : o));
    dbSync(api.bulkUpdateOrderStatus(ids, status), 'Order status update not saved');
    notify('Batch Update', `${ids.length} orders → ${status}`, 'success');
    setSelOrders(new Set());
  };

  // Batch Actions — Bulk Groups
  const batchDeleteBulk = () => {
    if (!selBulk.size || !window.confirm(`Delete ${selBulk.size} bulk group(s) and their orders?`)) return;
    const ids = [...selBulk];
    // Cascade delete orders linked to these bulk groups
    const orphanedOrders = orders.filter(o => o.bulkGroupId && selBulk.has(o.bulkGroupId));
    if (orphanedOrders.length) {
      setOrders(prev => prev.filter(o => !(o.bulkGroupId && selBulk.has(o.bulkGroupId))));
      orphanedOrders.forEach(o => dbSync(api.deleteOrder(o.id), 'Orphaned order delete not saved'));
    }
    setBulkGroups(prev => prev.filter(g => !selBulk.has(g.id)));
    ids.forEach(id => dbSync(api.deleteBulkGroup(id), 'Bulk group delete not saved'));
    notify('Batch Delete', `${ids.length} bulk groups + ${orphanedOrders.length} orders deleted`, 'success');
    setSelBulk(new Set());
  };
  const batchStatusBulk = (status) => {
    if (!selBulk.size) return;
    const ids = [...selBulk];
    const idSet = new Set(ids);
    setBulkGroups(prev => prev.map(g => selBulk.has(g.id) ? { ...g, status } : g));
    ids.forEach(id => dbSync(api.updateBulkGroup(id, { status }), 'Bulk group status not saved'));
    // Cascade approval status to all linked orders
    if (status === 'Approved' || status === 'Rejected') {
      const approvalStatus = status === 'Approved' ? 'approved' : 'rejected';
      const linkedOrders = orders.filter(o => o.bulkGroupId && idSet.has(o.bulkGroupId));
      setOrders(prev => prev.map(o => o.bulkGroupId && idSet.has(o.bulkGroupId) ? { ...o, status, approvalStatus } : o));
      linkedOrders.forEach(o => dbSync(api.updateOrder(o.id, { status, approvalStatus }), 'Order approval cascade failed'));
    }
    notify('Batch Update', `${ids.length} bulk groups → ${status}`, 'success');
    setSelBulk(new Set());
  };

  // ── Batch Approval & Notify — Single Orders ──
  const batchApprovalNotifyOrders = async () => {
    if (!selOrders.size) return;
    if (!emailConfig.enabled || !emailConfig.approvalEnabled || !emailConfig.approverEmail) {
      notify('Config Required', 'Enable approval emails and set approver email in Settings', 'warning');
      return;
    }
    const selected = orders.filter(o => selOrders.has(o.id));
    if (!selected.length) return;
    const now = new Date().toISOString().slice(0, 10);
    const approvalId = `APR-${Date.now()}`;
    const orderIds = selected.map(o => o.id);
    const totalCost = selected.reduce((s, o) => s + (Number(o.totalCost) || 0), 0);
    const totalQty = selected.reduce((s, o) => s + (Number(o.quantity) || 0), 0);

    // Create batch approval record
    addApproval({ id: approvalId, orderId: orderIds.join(', '), orderType: 'batch', description: `Batch Approval - ${selected.length} orders`, requestedBy: currentUser?.name || 'System', quantity: totalQty, totalCost, sentDate: now, status: 'pending', orderIds });

    // Update approvalSentDate
    setOrders(prev => prev.map(o => selOrders.has(o.id) ? { ...o, approvalSentDate: now } : o));
    orderIds.forEach(id => dbSync(api.updateOrder(id, { approvalSentDate: now }), 'Approval date not saved'));

    // Build plain-text table
    const hdr = 'No. | Order ID     | Material No.     | Description                        | Qty  | Total (SGD)';
    const sep = '----|--------------|------------------|------------------------------------|------|------------';
    const rows = selected.map((o, i) =>
      `${String(i + 1).padEnd(3)} | ${(o.id || '').padEnd(12)} | ${(o.materialNo || 'N/A').padEnd(16)} | ${(o.description || '').substring(0, 34).padEnd(34)} | ${String(o.quantity || 0).padEnd(4)} | S$${(Number(o.totalCost) || 0).toFixed(2)}`
    );
    const table = [hdr, sep, ...rows, sep, `TOTAL: ${selected.length} orders | ${totalQty} units | S$${totalCost.toFixed(2)}`].join('\n');

    // Compose mailto
    const subject = `[APPROVAL] Batch Order Request - ${selected.length} Orders (S$${totalCost.toFixed(2)})`;
    const body = `Order Approval Request\n\nRequested By: ${currentUser?.name || 'System'}\nDate: ${now}\nTotal Orders: ${selected.length}\nTotal Quantity: ${totalQty}\nTotal Cost: S$${totalCost.toFixed(2)}\n\n${table}\n\nReply APPROVE to approve all orders or REJECT to decline.\n\n-Miltenyi Inventory Hub SG`;
    const mailtoUrl = `mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (mailtoUrl.length > 2000) {
      const short = body.substring(0, 1400) + '\n\n[... see full details in Inventory Hub or WhatsApp]';
      window.open(`mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(short)}`, '_blank');
    } else {
      window.open(mailtoUrl, '_blank');
    }

    // Notification log
    addNotifEntry({ id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'approval', to: emailConfig.approverEmail, subject, date: now, status: 'Pending' });

    // WhatsApp
    if (waConnected) {
      try {
        const waMsg = `*Order Approval Request*\n\nRequested By: ${currentUser?.name || 'System'}\nDate: ${now}\nOrders: ${selected.length}\nTotal: S$${totalCost.toFixed(2)}\n\n` +
          selected.map((o, i) => `${i + 1}. ${o.id} | ${o.materialNo || 'N/A'} | ${(o.description || '').slice(0, 30)} | Qty: ${o.quantity} | S$${(Number(o.totalCost) || 0).toFixed(2)}`).join('\n') +
          `\n\n_Reply APPROVE or REJECT_\n_Miltenyi Inventory Hub SG_`;
        const approverUser = users.find(u => u.email === emailConfig.approverEmail);
        if (approverUser?.phone) {
          await fetch(`${WA_API_URL}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: approverUser.phone, template: 'custom', data: { message: waMsg } }) });
          notify('WhatsApp Sent', 'Batch approval sent to approver', 'success');
        }
      } catch (e) { console.log('WA batch approval error:', e); }
    }

    notify('Approval Sent', `${selected.length} orders sent for approval to ${emailConfig.approverEmail}`, 'success');
    setSelOrders(new Set());
  };

  // ── Batch Approval & Notify — Bulk Orders ──
  const batchApprovalNotifyBulk = async () => {
    if (!selBulk.size) return;
    if (!emailConfig.enabled || !emailConfig.approvalEnabled || !emailConfig.approverEmail) {
      notify('Config Required', 'Enable approval emails and set approver email in Settings', 'warning');
      return;
    }
    const selectedGroups = bulkGroups.filter(g => selBulk.has(g.id));
    if (!selectedGroups.length) return;
    const now = new Date().toISOString().slice(0, 10);
    const linkedOrders = orders.filter(o => o.bulkGroupId && selBulk.has(o.bulkGroupId));
    const totalCost = linkedOrders.reduce((s, o) => s + (Number(o.totalCost) || 0), 0);
    const totalQty = linkedOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);

    // Create approval per bulk group
    selectedGroups.forEach(bg => {
      const bgOrders = orders.filter(o => o.bulkGroupId === bg.id);
      const bgCost = bgOrders.reduce((s, o) => s + (Number(o.totalCost) || 0), 0);
      addApproval({ id: `APR-${Date.now()}-${bg.id}`, orderId: bg.id, orderType: 'bulk', description: `Bulk Order - ${bg.month}`, requestedBy: bg.createdBy || currentUser?.name || 'System', quantity: bgOrders.length, totalCost: bgCost, sentDate: now, status: 'pending', orderIds: bgOrders.map(o => o.id) });
    });

    // Update approvalSentDate on all linked orders
    const linkedIds = new Set(linkedOrders.map(o => o.id));
    setOrders(prev => prev.map(o => linkedIds.has(o.id) ? { ...o, approvalSentDate: now } : o));
    linkedOrders.forEach(o => dbSync(api.updateOrder(o.id, { approvalSentDate: now }), 'Approval date not saved'));

    // Build grouped plain-text table
    let lines = [];
    selectedGroups.forEach(bg => {
      const bgOrders = orders.filter(o => o.bulkGroupId === bg.id);
      const bgCost = bgOrders.reduce((s, o) => s + (Number(o.totalCost) || 0), 0);
      lines.push(`\n=== ${bg.id} | ${bg.month} | By: ${bg.createdBy || 'N/A'} ===`);
      lines.push('No. | Material No.     | Description                        | Qty  | Total (SGD)');
      lines.push('----|------------------|------------------------------------|------|------------');
      bgOrders.forEach((o, i) => {
        lines.push(`${String(i + 1).padEnd(3)} | ${(o.materialNo || 'N/A').padEnd(16)} | ${(o.description || '').substring(0, 34).padEnd(34)} | ${String(o.quantity || 0).padEnd(4)} | S$${(Number(o.totalCost) || 0).toFixed(2)}`);
      });
      lines.push(`Batch Subtotal: ${bgOrders.length} items | S$${bgCost.toFixed(2)}`);
    });
    lines.push(`\nGRAND TOTAL: ${selectedGroups.length} batches | ${linkedOrders.length} items | S$${totalCost.toFixed(2)}`);
    const table = lines.join('\n');

    const subject = `[APPROVAL] Bulk Order Batch - ${selectedGroups.length} Batches (S$${totalCost.toFixed(2)})`;
    const body = `Bulk Order Approval Request\n\nRequested By: ${currentUser?.name || 'System'}\nDate: ${now}\nBatches: ${selectedGroups.length}\nTotal Items: ${linkedOrders.length}\nTotal Cost: S$${totalCost.toFixed(2)}\n\n${table}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG`;
    const mailtoUrl = `mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (mailtoUrl.length > 2000) {
      const short = body.substring(0, 1400) + '\n\n[... see full details in Inventory Hub or WhatsApp]';
      window.open(`mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(short)}`, '_blank');
    } else {
      window.open(mailtoUrl, '_blank');
    }

    addNotifEntry({ id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'approval', to: emailConfig.approverEmail, subject, date: now, status: 'Pending' });

    // WhatsApp
    if (waConnected) {
      try {
        const waMsg = `*Bulk Order Approval Request*\n\nRequested By: ${currentUser?.name || 'System'}\nDate: ${now}\nBatches: ${selectedGroups.length}\nItems: ${linkedOrders.length}\nTotal: S$${totalCost.toFixed(2)}\n\n` +
          selectedGroups.map(bg => {
            const bgOrders = orders.filter(o => o.bulkGroupId === bg.id);
            return `*${bg.id} - ${bg.month}*\n` + bgOrders.map((o, i) => `  ${i + 1}. ${o.materialNo || 'N/A'} | ${(o.description || '').slice(0, 30)} | Qty: ${o.quantity} | S$${(Number(o.totalCost) || 0).toFixed(2)}`).join('\n');
          }).join('\n\n') +
          `\n\n_Reply APPROVE or REJECT_\n_Miltenyi Inventory Hub SG_`;
        const approverUser = users.find(u => u.email === emailConfig.approverEmail);
        if (approverUser?.phone) {
          await fetch(`${WA_API_URL}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: approverUser.phone, template: 'custom', data: { message: waMsg } }) });
          notify('WhatsApp Sent', 'Bulk batch approval sent to approver', 'success');
        }
      } catch (e) { console.log('WA bulk batch approval error:', e); }
    }

    notify('Approval Sent', `${selectedGroups.length} bulk batches sent for approval to ${emailConfig.approverEmail}`, 'success');
    setSelBulk(new Set());
  };

  // Batch Actions — Users
  const batchDeleteUsers = () => {
    if (!selUsers.size || !window.confirm(`Delete ${selUsers.size} user(s)?`)) return;
    const ids = [...selUsers];
    setUsers(prev => prev.filter(u => !selUsers.has(u.id)));
    ids.forEach(id => dbSync(api.deleteUser(id), 'User delete not saved'));
    notify('Batch Delete', `${ids.length} users deleted`, 'success');
    setSelUsers(new Set());
  };
  const batchRoleUsers = (role) => {
    if (!selUsers.size) return;
    const ids = [...selUsers];
    setUsers(prev => prev.map(u => selUsers.has(u.id) ? { ...u, role } : u));
    ids.forEach(id => dbSync(api.updateUser(id, { role }), 'User role update not saved'));
    notify('Batch Update', `${ids.length} users → ${role}`, 'success');
    setSelUsers(new Set());
  };
  const batchStatusUsers = (status) => {
    if (!selUsers.size) return;
    const ids = [...selUsers];
    setUsers(prev => prev.map(u => selUsers.has(u.id) ? { ...u, status } : u));
    ids.forEach(id => dbSync(api.updateUser(id, { status }), 'User status not saved'));
    notify('Batch Update', `${ids.length} users → ${status}`, 'success');
    setSelUsers(new Set());
  };

  // Batch Actions — Stock Checks
  const batchDeleteStockChecks = () => {
    if (!selStockChecks.size || !window.confirm(`Delete ${selStockChecks.size} stock check(s)?`)) return;
    const ids = [...selStockChecks];
    setStockChecks(prev => prev.filter(s => !selStockChecks.has(s.id)));
    ids.forEach(id => dbSync(api.deleteStockCheck(id), 'Stock check delete not saved'));
    notify('Batch Delete', `${selStockChecks.size} stock checks deleted`, 'success');
    setSelStockChecks(new Set());
  };

  // Batch Actions — Notifications
  const batchDeleteNotifs = () => {
    if (!selNotifs.size || !window.confirm(`Delete ${selNotifs.size} notification(s)?`)) return;
    const ids = [...selNotifs];
    setNotifLog(prev => prev.filter(n => !selNotifs.has(n.id)));
    ids.forEach(id => dbSync(api.deleteNotifEntry(id), 'Notification delete not saved'));
    notify('Batch Delete', `${selNotifs.size} notifications deleted`, 'success');
    setSelNotifs(new Set());
  };

  // Batch Actions — Approvals
  const batchApprovalAction = (action) => {
    if (!selApprovals.size) return;
    const ids = [...selApprovals];
    ids.forEach(id => handleApprovalAction(id, action));
    notify(`Batch ${action === 'approved' ? 'Approve' : 'Reject'}`, `${ids.length} approvals ${action}`, action === 'approved' ? 'success' : 'warning');
    setSelApprovals(new Set());
  };

  // ── WhatsApp Baileys functions ──
  // WhatsApp API Base URL
  const WA_API_URL = '/api/whatsapp';

  // Poll for WhatsApp status
  const pollWaStatus = async () => {
    try {
      const res = await fetch(`${WA_API_URL}/status`);
      const data = await res.json();

      if (data.status === 'connected' && !waConnected) {
        setWaConnected(true);
        setWaConnecting(false);
        setWaQrVisible(false);
        setWaSessionInfo(data.sessionInfo);
        notify('WhatsApp Connected', 'Baileys session established', 'success');
      } else if (data.status === 'awaiting_scan' && data.qrCode) {
        setWaQrCode(data.qrCode);
        setWaQrVisible(true);
      } else if (data.status === 'disconnected' && waConnected) {
        setWaConnected(false);
        setWaSessionInfo(null);
      }

      return data.status;
    } catch (err) {
      console.error('WhatsApp status error:', err);
      return 'error';
    }
  };

  const handleWaConnect = async () => {
    setWaConnecting(true);
    try {
      const res = await fetch(`${WA_API_URL}/connect`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        notify('Connecting...', 'Scan QR code with WhatsApp', 'info');

        // Poll for status until connected
        const pollInterval = setInterval(async () => {
          const status = await pollWaStatus();
          if (status === 'connected' || status === 'error') {
            clearInterval(pollInterval);
            setWaConnecting(false);
          }
        }, 2000);

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (!waConnected) {
            setWaConnecting(false);
            setWaQrVisible(false);
            notify('Connection Timeout', 'QR code expired. Try again.', 'warning');
          }
        }, 120000);
      }
    } catch (err) {
      setWaConnecting(false);
      notify('Connection Failed', 'Make sure the server is running', 'warning');
    }
  };

  const handleWaDisconnect = async () => {
    try {
      await fetch(`${WA_API_URL}/disconnect`, { method: 'POST' });
      setWaConnected(false);
      setWaSessionInfo(null);
      setWaQrCode('');
      notify('WhatsApp Disconnected', 'Session closed', 'warning');
    } catch (err) {
      notify('Error', 'Failed to disconnect', 'warning');
    }
  };

  const handleWaSend = async () => {
    if (!waRecipient || !waMessageText) return;

    // Extract phone number from recipient string (e.g., "+65 9111 2222 (Name)")
    const phoneMatch = waRecipient.match(/(\+?\d[\d\s-]+)/);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : waRecipient;

    try {
      const res = await fetch(`${WA_API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          template: waTemplate !== 'custom' ? waTemplate : null,
          data: waTemplate === 'custom' ? { message: waMessageText } : getTemplateData(waTemplate)
        })
      });

      const data = await res.json();

      if (data.success) {
        const msg = { id: `WA-${String(waMessages.length+1).padStart(3,'0')}`, to: waRecipient, message: waMessageText, time: new Date().toLocaleString(), status: 'sent' };
        setWaMessages(prev => [msg, ...prev]);
        addNotifEntry({id:`N-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'whatsapp',to:waRecipient,subject:waMessageText.slice(0,50),date:new Date().toISOString().slice(0,10),status:'Delivered'});
        setWaRecipient(''); setWaMessageText(''); setWaTemplate('custom');
        notify('WhatsApp Sent', `Message delivered to ${phone}`, 'success');

        // Update message status
        setTimeout(() => setWaMessages(prev => prev.map((m,i) => i===0 ? {...m, status:'delivered'} : m)), 2000);
        setTimeout(() => setWaMessages(prev => prev.map((m,i) => i===0 ? {...m, status:'read'} : m)), 5000);
      } else {
        notify('Send Failed', data.error || 'Unknown error', 'warning');
      }
    } catch (err) {
      notify('Send Failed', 'Server connection error', 'warning');
    }
  };

  // Get template data based on current context
  const getTemplateData = (templateId) => {
    const now = new Date();
    switch(templateId) {
      case 'orderCreated':
        return {
          orderId: orders[0]?.id || 'ORD-XXX',
          description: orders[0]?.description || 'Item',
          materialNo: orders[0]?.materialNo || '130-XXX-XXX',
          quantity: orders[0]?.quantity || 1,
          total: fmt(orders[0]?.totalCost || 0),
          orderBy: orders[0]?.orderBy || currentUser?.name,
          date: now.toLocaleDateString()
        };
      case 'backorderReceived':
        const boOrder = orders.find(o => o.backOrder < 0);
        return {
          orderId: boOrder?.id || 'ORD-XXX',
          description: boOrder?.description || 'Item',
          received: boOrder?.qtyReceived || 0,
          ordered: boOrder?.quantity || 0,
          remaining: Math.abs(boOrder?.backOrder || 0)
        };
      case 'deliveryArrival':
        return {
          month: bulkGroups[0]?.month || 'Current Month',
          itemCount: bulkGroups[0]?.items || 0,
          totalValue: fmt(bulkGroups[0]?.totalCost || 0)
        };
      case 'stockAlert':
        return {
          checkId: stockChecks[0]?.id || 'SC-XXX',
          discrepancies: stockChecks[0]?.disc || 0,
          checkedBy: stockChecks[0]?.checkedBy || currentUser?.name,
          date: now.toLocaleDateString()
        };
      case 'monthlyUpdate':
        return {
          month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
          totalOrders: orders.length,
          received: orders.filter(o => o.status === 'Received').length,
          pending: orders.filter(o => o.status === 'Pending Approval' || o.status === 'Approved').length,
          backOrders: orders.filter(o => o.status === 'Back Order').length,
          totalValue: fmt(orders.reduce((s, o) => s + o.totalCost, 0))
        };
      default:
        return { message: waMessageText };
    }
  };

  // Auto-notify function for system events
  const sendAutoNotify = async (template, data, recipients) => {
    if (!waConnected || !waAutoReply) return;

    for (const phone of recipients) {
      try {
        await fetch(`${WA_API_URL}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, template, data })
        });
      } catch (err) {
        console.error('Auto-notify error:', err);
      }
    }
  };

  const waTemplates = {
    backOrder: (items) => `⚠️ *Back Order Alert*\n\nThe following items are on back order:\n${items||'- Yearly Maintenance Kit, MACSima (5 units)'}\n\nPlease follow up with HQ.\n\n_Miltenyi Biotec SG Service_`,
    deliveryArrived: () => `📦 *Delivery Arrived*\n\nA new shipment has arrived at the warehouse. Please verify the items against the order list.\n\nCheck the Inventory Hub for details.\n\n_Miltenyi Biotec SG Service_`,
    stockAlert: (item) => `🔔 *Stock Level Warning*\n\n${item||'Pump Syringe Hamilton 5ml'} is running low.\nCurrent stock: Below threshold\n\nPlease initiate reorder.\n\n_Miltenyi Biotec SG Service_`,
    monthlyUpdate: (month) => `📊 *Monthly Inventory Update — ${month||'Feb 2026'}*\n\nAll received orders have been verified.\nBack orders: See Inventory Hub\n\nPlease review and confirm.\n\n_Miltenyi Biotec SG Service_`,
  };

  // ── Bulk Order ──
  const addBulkItem = () => setBulkItems(prev=>[...prev,{materialNo:'',description:'',quantity:1,listPrice:0}]);
  const removeBulkItem = (idx) => setBulkItems(prev=>prev.filter((_,i)=>i!==idx));
  const updateBulkItem = (idx, field, val) => {
    setBulkItems(prev=>prev.map((item,i)=>{
      if(i!==idx) return item;
      const updated = {...item,[field]:val};
      if(field==='materialNo' && val.length>=10) {
        const p=catalogLookup[val];
        if(p) return {...updated, description:p.d, listPrice:p.tp};
      }
      return updated;
    }));
  };
  const handleBulkSubmit = async () => {
    const validItems = bulkItems.filter(i=>i.materialNo&&i.description);
    if(!validItems.length) { notify('No Valid Items','Each item needs Material No. and Description','warning'); return; }
    if(!bulkOrderBy) { notify('Missing Field','Order By is required','warning'); return; }
    setIsSubmitting(true);
    const bgId = `BG-${String(bulkGroups.length+1).padStart(3,'0')}`;
    const newOrders = validItems.map((item,idx)=>({
      id:`ORD-${2000+orders.length+idx}`, materialNo:item.materialNo, description:item.description,
      quantity:parseInt(item.quantity)||1, listPrice:parseFloat(item.listPrice)||0,
      totalCost:(parseFloat(item.listPrice)||0)*(parseInt(item.quantity)||1),
      orderDate:new Date().toISOString().slice(0,10), orderBy:bulkOrderBy, remark:`Bulk: ${bulkMonth} — ${bulkRemark}`,
      arrivalDate:null, qtyReceived:0, backOrder:-(parseInt(item.quantity)||1), engineer:'',
      emailFull:'', emailBack:'', status:'Pending Approval', month:bulkMonth, year:String(new Date().getFullYear()),
      bulkGroupId:bgId
    }));
    const totalCost = newOrders.reduce((s,o)=>s+o.totalCost,0);
    setOrders(prev=>[...newOrders,...prev]);
    newOrders.forEach(o => dbSync(api.createOrder(o), 'Bulk order item not saved'));
    const bg = {id:bgId, month:bulkMonth, createdBy:bulkOrderBy, items:newOrders.length, totalCost, status:'Pending Approval', date:new Date().toISOString().slice(0,10)};
    setBulkGroups(prev=>[bg,...prev]);
    dbSync(api.createBulkGroup(bg), 'Bulk group not saved to database');
    setShowBulkOrder(false); setBulkItems([{materialNo:'',description:'',quantity:1,listPrice:0}]); setBulkRemark('');
    setIsSubmitting(false);
    notify('Bulk Order Created',`${newOrders.length} items for ${bulkMonth}. Select and use "Order Approval & Notify" to send for approval.`,'success');
    logAction('create', 'bulk_group', bg.id, { month: bulkMonth, items: newOrders.length, totalCost: bg.totalCost });
  };

  // ── Auth Handlers ──
  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) { notify('Missing Fields','Please enter username and password','warning'); return; }
    setIsSubmitting(true);
    const result = await api.login(loginForm.username, loginForm.password);
    setIsSubmitting(false);
    if (result && result.user) {
      setCurrentUser(result.user);
      api.resetAuthError(); // allow future session-expired toasts
      await loadAppData(); // fetch all data from DB after login
      notify(`Welcome back, ${result.user.name}`, result.user.role==='admin'?'Admin access granted':'User access granted', 'success');
    } else {
      // Fallback: local login when backend/DB is unavailable
      const localUser = users.find(u => u.username === loginForm.username && u.status === 'active');
      if (localUser && loginForm.password === 'admin123' && localUser.role === 'admin') {
        setCurrentUser(localUser);
        notify(`Welcome back, ${localUser.name}`, 'Admin access granted (offline mode)', 'success');
      } else {
        notify('Login Failed','Invalid credentials or account not approved','warning');
      }
    }
  };
  const handleRegister = async () => {
    if(!regForm.username||!regForm.password||!regForm.name||!regForm.email) { notify('Missing Fields','Please fill all required fields','warning'); return; }
    if(users.find(u=>u.username===regForm.username)||pendingUsers.find(u=>u.username===regForm.username)) { notify('Username Taken','Choose a different username','warning'); return; }
    const result = await api.register({username:regForm.username,password:regForm.password,name:regForm.name,email:regForm.email,phone:regForm.phone});
    if (result) {
      setPendingUsers(prev=>[...prev,{id:result.id||`P${String(prev.length+2).padStart(3,'0')}`,username:regForm.username,name:regForm.name,email:regForm.email,phone:regForm.phone,requestDate:new Date().toISOString().slice(0,10)}]);
    } else {
      setPendingUsers(prev=>[...prev,{id:`P${String(prev.length+2).padStart(3,'0')}`,username:regForm.username,name:regForm.name,email:regForm.email,phone:regForm.phone,requestDate:new Date().toISOString().slice(0,10)}]);
    }
    setRegForm({username:'',password:'',name:'',email:'',phone:''});
    setAuthView('login');
    notify('Registration Submitted','Your account is pending admin approval','info');
  };
  const handleApproveUser = async (pending) => {
    const newUser = {
      id: `U${String(users.length+1).padStart(3,'0')}`,
      username: pending.username,
      name: pending.name,
      email: pending.email,
      phone: pending.phone || '',
      role: 'user',
      status: 'active',
      password: 'temp123',
      permissions: {...DEFAULT_USER_PERMS},
    };
    const created = await api.createUser(newUser);
    if (created) {
      setUsers(prev=>[...prev, created]);
    } else {
      setUsers(prev=>[...prev, {...newUser, created: new Date().toISOString().slice(0,10)}]);
    }
    setPendingUsers(prev=>prev.filter(u=>u.id!==pending.id));
    notify('User Approved',`${pending.name} can now login (temp password: temp123)`,'success');
  };
  const handleRejectUser = (id) => { setPendingUsers(prev=>prev.filter(u=>u.id!==id)); notify('Registration Rejected','User has been denied access','warning'); };
  const handleCreateUser = async (form) => {
    const perms = form.role==='admin' ? Object.fromEntries(Object.keys(DEFAULT_USER_PERMS).map(k=>[k,true])) : {...DEFAULT_USER_PERMS};
    const newUser = {
      id: `U${String(users.length+1).padStart(3,'0')}`,
      username: form.username,
      name: form.name,
      email: form.email,
      phone: form.phone || '',
      role: form.role || 'user',
      status: 'active',
      password: form.password,
      permissions: perms,
    };
    const created = await api.createUser(newUser);
    if (created) {
      setUsers(prev=>[...prev, created]);
    } else {
      setUsers(prev=>[...prev, {...newUser, created: new Date().toISOString().slice(0,10)}]);
    }
    notify('User Created',`${form.name} (${form.role}) added`,'success');
  };

  // ── Nav ──
  const allNavItems = [
    { id:'dashboard', label:'Dashboard', icon:Home, perm:'dashboard' },
    { id:'catalog', label:'Parts Catalog', icon:Database, perm:'catalog' },
    { id:'allorders', label:'All Orders', icon:ShoppingCart, perm:'orders' },
    { id:'orders', label:'Single Orders', icon:Package, perm:'orders' },
    { id:'bulkorders', label:'Bulk Orders', icon:Layers, perm:'bulkOrders' },
    { id:'analytics', label:'Analytics', icon:BarChart3, perm:'analytics' },
    { id:'forecasting', label:'Forecasting', icon:TrendingUp, perm:'analytics' },
    { id:'stockcheck', label:'Stock Check', icon:ClipboardList, perm:'stockCheck' },
    { id:'delivery', label:'Part Arrival', icon:Truck, perm:'delivery' },
    { id:'whatsapp', label:'WhatsApp', icon:MessageSquare, perm:'whatsapp' },
    { id:'notifications', label:'Notifications', icon:Bell, perm:'notifications' },
    { id:'audit', label:'Audit Trail', icon:Shield, perm:'auditTrail' },
    { id:'aibot', label:'AI Bot Admin', icon:Bot, perm:'aiBot' },
    { id:'users', label:'User Management', icon:Users, perm:'users' },
    { id:'settings', label:'Settings', icon:Settings, perm:'settings' },
  ];
  const navItems = allNavItems.filter(n => hasPermission(n.perm));

  // ════════════════════════════ AI BOT PROCESSING ════════════════════════════
  const processAiMessage = (userMessage) => {
    const msg = userMessage.toLowerCase().trim();
    const catalogLookupLocal = partsCatalog.reduce((acc, p) => { acc[p.m] = p; return acc; }, {});

    // Price check pattern
    const priceMatch = msg.match(/price.*?(\d{3}-\d{3}-\d{3})|^(\d{3}-\d{3}-\d{3})/);
    if (priceMatch || msg.includes("price")) {
      const matNo = priceMatch ? (priceMatch[1] || priceMatch[2]) : null;
      if (matNo && catalogLookupLocal[matNo]) {
        const p = catalogLookupLocal[matNo];
        return { type: "price", text: `📦 **${p.d}** (${matNo})\n\n💰 **Prices (${priceConfig.year}):**\n• SG Price: ${fmt(p.sg)}\n• Distributor: ${fmt(p.dist)}\n• Transfer: ${fmt(p.tp)}\n\nWould you like to place an order?` };
      }
      if (matNo) return { type: "not_found", text: `I couldn't find part number **${matNo}** in the catalog. Please verify the material number.` };
      return { type: "prompt", text: "Please provide a material number (e.g., 130-095-005) to check the price." };
    }

    // Order status pattern
    const orderMatch = msg.match(/status.*?(ord-\d+)|(ord-\d+).*status|order.*(ord-\d+)/i);
    if (orderMatch || msg.includes("status") || msg.includes("track")) {
      const orderId = orderMatch ? (orderMatch[1] || orderMatch[2] || orderMatch[3])?.toUpperCase() : null;
      if (orderId) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          return { type: "order", text: `📋 **Order ${order.id}**\n\n• Item: ${order.description}\n• Qty: ${order.quantity}\n• Status: **${order.status}**\n• Ordered: ${fmtDate(order.orderDate)}\n• Arrival: ${order.arrivalDate ? fmtDate(order.arrivalDate) : "Pending"}\n• Received: ${order.qtyReceived}/${order.quantity}` };
        }
        return { type: "not_found", text: `Order **${orderId}** not found. Please check the order ID.` };
      }
      return { type: "prompt", text: "Please provide an order ID (e.g., ORD-027) to check the status." };
    }

    // Stock check pattern
    if (msg.includes("stock") || msg.includes("inventory") || msg.includes("available")) {
      const stockItems = stockChecks.slice(0, 3);
      return { type: "stock", text: `📊 **Recent Stock Checks:**\n\n${stockItems.map(s => `• ${s.id}: ${s.items} items checked, ${s.disc} discrepancies (${s.status})`).join("\n")}\n\nFor detailed stock info, check the Stock Check page.` };
    }

    // Place order pattern
    const placeOrderMatch = msg.match(/order\s*(\d+)?\s*[x×]?\s*(\d{3}-\d{3}-\d{3})/i) || msg.match(/(\d{3}-\d{3}-\d{3})\s*[x×]?\s*(\d+)?.*order/i);
    if (msg.includes("place order") || msg.includes("create order") || placeOrderMatch) {
      if (placeOrderMatch) {
        const matNo = placeOrderMatch[2] || placeOrderMatch[1];
        const qty = placeOrderMatch[1] || placeOrderMatch[2] || 1;
        if (catalogLookupLocal[matNo]) {
          const p = catalogLookupLocal[matNo];
          return { type: "order_confirm", text: `🛒 **Ready to order:**\n\n• Part: ${p.d}\n• Material: ${matNo}\n• Quantity: ${qty}\n• Unit Price: ${fmt(p.tp)}\n• Total: ${fmt(p.tp * parseInt(qty))}\n\nType "confirm" to place this order or "cancel" to abort.`, pendingOrder: { materialNo: matNo, description: p.d, quantity: parseInt(qty), listPrice: p.tp } };
        }
      }
      return { type: "prompt", text: "To place an order, tell me the part number and quantity.\nExample: \"Order 2x 130-095-005\"" };
    }

    // Confirm order
    if (msg === "confirm" && aiMessages.length > 0) {
      const lastBotMsg = [...aiMessages].reverse().find(m => m.role === "bot" && m.pendingOrder);
      if (lastBotMsg?.pendingOrder) {
        const po = lastBotMsg.pendingOrder;
        const aiNow = new Date();
        const aiMonth = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][aiNow.getMonth()]} ${aiNow.getFullYear()}`;
        const newOrd = { id: `ORD-${2000 + orders.length}`, ...po, totalCost: po.listPrice * po.quantity, orderDate: aiNow.toISOString().slice(0, 10), arrivalDate: null, qtyReceived: 0, backOrder: -po.quantity, engineer: "", emailFull: "", emailBack: "", status: "Pending", orderBy: currentUser.name, month: aiMonth, year: String(aiNow.getFullYear()), remark: "Created via AI Assistant" };
        setOrders(prev => [newOrd, ...prev]);
        dbSync(api.createOrder(newOrd), 'AI order not saved to database');
        notify("Order Created", `${po.description} × ${po.quantity}`, "success");
        return { type: "success", text: `✅ **Order Created Successfully!**\n\n• Order ID: ${newOrd.id}\n• Item: ${po.description}\n• Quantity: ${po.quantity}\n• Total: ${fmt(newOrd.totalCost)}\n\nYou can track this order by asking "Status ${newOrd.id}"` };
      }
    }

    // Cancel
    if (msg === "cancel") {
      return { type: "info", text: "Order cancelled. How else can I help you?" };
    }

    // Help
    if (msg.includes("help") || msg === "hi" || msg === "hello") {
      return { type: "help", text: `👋 ${aiBotConfig.greeting}\n\n**I can help you with:**\n• 💰 Check prices - "Price for 130-095-005"\n• 📦 Track orders - "Status ORD-027"\n• 🛒 Place orders - "Order 2x 130-095-005"\n• 📊 Stock levels - "Check stock"\n\nHow can I assist you today?` };
    }

    // Default - would go to AI API in real implementation
    return { type: "ai", text: `I understand you're asking about: "${userMessage}"\n\nThis query would be processed by the AI API for a detailed response. For now, try:\n• Price checks\n• Order status\n• Placing orders\n• Stock information\n\nOr type "help" for available commands.` };
  };

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    const userMsg = { id: Date.now(), role: "user", text: aiInput, time: new Date().toLocaleTimeString() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput("");
    setAiProcessing(true);

    setTimeout(() => {
      const response = processAiMessage(aiInput);
      const botMsg = { id: Date.now() + 1, role: "bot", text: response.text, type: response.type, time: new Date().toLocaleTimeString(), pendingOrder: response.pendingOrder };
      setAiMessages(prev => [...prev, botMsg]);
      setAiProcessing(false);
      setAiConversationLogs(prev => [...prev, { id: `AI-${String(prev.length + 1).padStart(3, "0")}`, user: currentUser.name, query: aiInput, response: response.text.slice(0, 100), time: new Date().toISOString(), type: response.type }]);
    }, 500);
  };

  const handleAiQuickAction = (action) => {
    const prompts = {
      price: "I want to check a price",
      status: "Check order status",
      order: "I want to place an order",
      stock: "Show stock levels"
    };
    setAiInput(prompts[action] || "");
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map(f => ({
      id: `KB-${String(aiKnowledgeBase.length + 1).padStart(3, '0')}`,
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      type: f.name.split('.').pop().toUpperCase(),
      uploadedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: currentUser.name
    }));
    setAiKnowledgeBase(prev => [...prev, ...newFiles]);
    notify('Files Uploaded', `${files.length} file(s) added to knowledge base`, 'success');
  };

  // ── Header mapping for CSV/Excel import ──
  const HEADER_MAP = {
    'id': 'id', 'order id': 'id', 'orderid': 'id', 'order_id': 'id',
    'material': 'materialNo', 'material no': 'materialNo', 'materialno': 'materialNo', 'material_no': 'materialNo', 'part number': 'materialNo', 'part no': 'materialNo', 'partno': 'materialNo', 'mat no': 'materialNo',
    'description': 'description', 'desc': 'description', 'item': 'description', 'item description': 'description', 'product': 'description', 'product name': 'description', 'name': 'description',
    'quantity': 'quantity', 'qty': 'quantity', 'ordered': 'quantity', 'order qty': 'quantity', 'ordered qty': 'quantity',
    'price': 'listPrice', 'list price': 'listPrice', 'listprice': 'listPrice', 'unit price': 'listPrice', 'transfer price': 'listPrice', 'tp': 'listPrice', 'cost': 'listPrice',
    'total': 'totalCost', 'total cost': 'totalCost', 'totalcost': 'totalCost', 'amount': 'totalCost', 'total amount': 'totalCost', 'ext price': 'totalCost', 'extended price': 'totalCost',
    'order date': 'orderDate', 'orderdate': 'orderDate', 'date': 'orderDate', 'created': 'orderDate', 'created date': 'orderDate', 'order_date': 'orderDate',
    'order by': 'orderBy', 'orderby': 'orderBy', 'ordered by': 'orderBy', 'user': 'orderBy', 'created by': 'orderBy', 'requestor': 'orderBy', 'requester': 'orderBy',
    'remark': 'remark', 'remarks': 'remark', 'note': 'remark', 'notes': 'remark', 'comment': 'remark', 'comments': 'remark',
    'arrival': 'arrivalDate', 'arrival date': 'arrivalDate', 'arrivaldate': 'arrivalDate', 'received date': 'arrivalDate', 'delivery date': 'arrivalDate',
    'received': 'qtyReceived', 'qty received': 'qtyReceived', 'qtyreceived': 'qtyReceived', 'received qty': 'qtyReceived',
    'back order': 'backOrder', 'backorder': 'backOrder', 'pending': 'backOrder', 'back_order': 'backOrder',
    'engineer': 'engineer', 'assigned': 'engineer', 'assigned to': 'engineer', 'technician': 'engineer',
    'status': 'status',
    'month': 'month', 'batch': 'month', 'month batch': 'month', 'period': 'month',
    'year': 'year',
    'category': 'category', 'cat': 'category', 'type': 'category'
  };

  // Parse rows from a 2D array (headers + data) into order objects
  const parseRowsToOrders = (headers, rows, sheetMonth) => {
    const colMap = {};
    headers.forEach((h, i) => {
      const key = String(h || '').trim().toLowerCase().replace(/['"]/g, '');
      if (HEADER_MAP[key]) colMap[HEADER_MAP[key]] = i;
    });

    const existingIds = new Set(orders.map(o => o.id));
    let nextId = Math.max(0, ...orders.map(o => parseInt(o.id.replace('ORD-', '')) || 0)) + 1;
    const parsed = [];

    for (const row of rows) {
      const getValue = (field) => {
        const idx = colMap[field];
        if (idx === undefined) return '';
        const val = row[idx];
        return val != null ? String(val).trim().replace(/^["']|["']$/g, '') : '';
      };

      let orderId = getValue('id');
      if (!orderId || existingIds.has(orderId)) {
        orderId = 'ORD-' + String(nextId++).padStart(4, '0');
      }
      existingIds.add(orderId);

      const qty = parseInt(getValue('quantity')) || 0;
      const received = parseInt(getValue('qtyReceived')) || 0;

      const order = {
        id: orderId,
        materialNo: getValue('materialNo'),
        description: getValue('description') || 'Imported Item',
        quantity: qty,
        listPrice: parseFloat(getValue('listPrice')) || 0,
        totalCost: parseFloat(getValue('totalCost')) || (parseFloat(getValue('listPrice')) || 0) * qty,
        orderDate: getValue('orderDate') || new Date().toISOString().slice(0, 10),
        orderBy: getValue('orderBy') || currentUser.name,
        remark: getValue('remark') || 'Imported from file',
        arrivalDate: getValue('arrivalDate') || '',
        qtyReceived: received,
        backOrder: received - qty,
        engineer: getValue('engineer') || '',
        emailFull: '', emailBack: '',
        status: getValue('status') || (received >= qty && qty > 0 ? 'Received' : received > 0 ? 'Back Order' : 'Pending Approval'),
        month: getValue('month') || sheetMonth || ('Import ' + new Date().toISOString().slice(0, 7)),
        year: getValue('year') || new Date().getFullYear().toString()
      };

      if (order.description !== 'Imported Item' || order.materialNo) {
        parsed.push(order);
      }
    }
    return parsed;
  };

  // ── History Import CSV/Excel Parser ──
  const handleHistoryImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      // Excel file — use SheetJS for multi-sheet support
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const allOrders = [];
        const newBulkGroups = [];

        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (jsonData.length < 2) return;

          const headers = jsonData[0];
          const rows = jsonData.slice(1).filter(r => r.some(cell => cell !== ''));
          if (!rows.length) return;

          // Use sheet name as month batch if it looks like a month
          const sheetMonth = sheetName.trim();
          const sheetOrders = parseRowsToOrders(headers, rows, sheetMonth);

          if (sheetOrders.length > 0) {
            allOrders.push(...sheetOrders);
            // Auto-create a bulk group from each sheet
            const totalCost = sheetOrders.reduce((s, o) => s + o.totalCost, 0);
            newBulkGroups.push({
              id: 'BG-' + String(bulkGroups.length + newBulkGroups.length + 1).padStart(3, '0'),
              month: sheetMonth,
              createdBy: currentUser.name,
              items: sheetOrders.length,
              totalCost,
              status: 'Pending Approval',
              date: new Date().toISOString().slice(0, 10)
            });
          }
        });

        if (allOrders.length > 0) {
          setHistoryImportData(allOrders);
          setHistoryImportPreview(true);
          // Store bulk groups to add on confirm
          setHistoryImportData(prev => { prev._bulkGroups = newBulkGroups; return [...allOrders]; });
          setHistoryImportData(allOrders);
          // Temporarily store bulk groups
          window.__pendingBulkGroups = newBulkGroups;
          notify('Excel Parsed', allOrders.length + ' orders from ' + wb.SheetNames.length + ' sheet(s) ready to import', 'success');
        } else {
          notify('Import Error', 'No valid orders found in Excel file', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV file — plain text parsing
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          notify('Import Error', 'File appears empty or invalid', 'error');
          return;
        }

        // Parse CSV: split by comma with quote handling
        const parseCSVLine = (line) => {
          const values = [];
          let current = '';
          let inQuotes = false;
          for (const char of line) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
            else current += char;
          }
          values.push(current.trim());
          return values;
        };

        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(parseCSVLine);
        const importedOrders = parseRowsToOrders(headers, rows, null);

        if (importedOrders.length > 0) {
          setHistoryImportData(importedOrders);
          setHistoryImportPreview(true);
          window.__pendingBulkGroups = null;
          notify('File Parsed', importedOrders.length + ' orders ready to import', 'success');
        } else {
          notify('Import Error', 'No valid orders found in file', 'error');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const confirmHistoryImport = () => {
    setOrders(prev => [...prev, ...historyImportData]);
    historyImportData.forEach(o => dbSync(api.createOrder(o), 'History order not saved'));
    // Also add any bulk groups from Excel sheets
    if (window.__pendingBulkGroups && window.__pendingBulkGroups.length > 0) {
      setBulkGroups(prev => [...window.__pendingBulkGroups, ...prev]);
      window.__pendingBulkGroups.forEach(g => dbSync(api.createBulkGroup(g), 'History bulk group not saved'));
      notify('History Imported', historyImportData.length + ' orders + ' + window.__pendingBulkGroups.length + ' bulk batches added', 'success');
      window.__pendingBulkGroups = null;
    } else {
      notify('History Imported', historyImportData.length + ' orders added to system', 'success');
    }
    setHistoryImportData([]);
    setHistoryImportPreview(false);
  };

  // ════════════════════════════ ORDER DETAIL WINDOW (NEW TAB) ═════════════════════════
  if (isOrderDetailWindow && orderDetailData) {
    const o = orderDetailData;
    return (
      <div style={{ minHeight:'100vh', background:'#F4F6F8', fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", padding:24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap'); .mono{font-family:'JetBrains Mono',monospace}`}</style>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center' }}><Package size={24} color="#fff"/></div>
            <div>
              <h1 style={{ fontSize:18,fontWeight:700,color:'#0F172A' }}>Order Details</h1>
              <span className="mono" style={{ fontSize:12,color:'#64748B' }}>{o.id}</span>
            </div>
          </div>
          <button onClick={()=>window.close()} style={{ padding:'10px 20px',background:'#E2E8F0',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}><X size={16}/> Close Window</button>
        </div>

        <div style={{ background:'#fff',borderRadius:16,padding:28,boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>
          {/* Title & Status */}
          <div style={{ marginBottom:20 }}>
            <h2 style={{ fontSize:20,fontWeight:700,marginBottom:8 }}>{o.description}</h2>
            <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
              <Badge status={o.status}/>
              <span className="mono" style={{ fontSize:12,color:'#64748B',padding:'4px 10px',background:'#F8FAFB',borderRadius:6 }}>{o.materialNo||'—'}</span>
            </div>
          </div>

          {/* Key Info Badges */}
          <div style={{ display:'flex',gap:12,marginBottom:24,flexWrap:'wrap' }}>
            {o.orderBy&&<div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#DBEAFE',borderRadius:10 }}>
              <User size={16} color="#2563EB"/>
              <div><div style={{ fontSize:10,color:'#64748B',fontWeight:600 }}>ORDERED BY</div><div style={{ fontSize:14,fontWeight:700,color:'#2563EB' }}>{o.orderBy}</div></div>
            </div>}
            {o.month&&<div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#E6F4ED',borderRadius:10 }}>
              <Calendar size={16} color="#0B7A3E"/>
              <div><div style={{ fontSize:10,color:'#64748B',fontWeight:600 }}>MONTH BATCH</div><div style={{ fontSize:14,fontWeight:700,color:'#0B7A3E' }}>{String(o.month).replace('_',' ')}</div></div>
            </div>}
            {o.orderDate&&<div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#F8FAFB',borderRadius:10 }}>
              <Clock size={16} color="#64748B"/>
              <div><div style={{ fontSize:10,color:'#64748B',fontWeight:600 }}>ORDER DATE</div><div style={{ fontSize:14,fontWeight:700,color:'#374151' }}>{fmtDate(o.orderDate)}</div></div>
            </div>}
          </div>

          {/* Quantity Info */}
          <div style={{ padding:20,borderRadius:12,background:'#F0FDF4',border:'1px solid #BBF7D0',marginBottom:24 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16 }}><Package size={18} color="#059669"/><span style={{ fontWeight:700,fontSize:14,color:'#059669' }}>Quantity Status</span></div>
            <div className="grid-3" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:11,color:'#64748B',marginBottom:4 }}>Ordered</div>
                <div className="mono" style={{ fontSize:28,fontWeight:700 }}>{o.quantity}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:11,color:'#64748B',marginBottom:4 }}>Received</div>
                <div className="mono" style={{ fontSize:28,fontWeight:700,color:o.qtyReceived>=o.quantity?'#059669':'#D97706' }}>{o.qtyReceived||0}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:11,color:'#64748B',marginBottom:4 }}>Back Order</div>
                <div className="mono" style={{ fontSize:28,fontWeight:700,color:(o.backOrder||0)<0?'#DC2626':'#059669' }}>{(o.backOrder||0)<0?o.backOrder:'✓ Full'}</div>
              </div>
            </div>
            {(o.backOrder||0)<0 && <div style={{ marginTop:16,padding:10,background:'#FEF2F2',borderRadius:8,fontSize:12,color:'#DC2626',display:'flex',alignItems:'center',gap:8 }}><AlertCircle size={14}/> {Math.abs(o.backOrder)} items still pending</div>}
            {o.qtyReceived>=o.quantity && o.quantity>0 && <div style={{ marginTop:16,padding:10,background:'#D1FAE5',borderRadius:8,fontSize:12,color:'#059669',display:'flex',alignItems:'center',gap:8 }}><CheckCircle size={14}/> Order fully received</div>}
          </div>

          {/* Price & Details Grid */}
          <div className="grid-2" style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:24 }}>
            {[
              {l:'Unit Price',v:o.listPrice>0?fmt(o.listPrice):'—',icon:DollarSign,c:'#0B7A3E'},
              {l:'Total Cost',v:o.totalCost>0?fmt(o.totalCost):'—',icon:DollarSign,c:'#2563EB'},
              {l:'Arrival Date',v:o.arrivalDate?fmtDate(o.arrivalDate):'Pending',icon:Truck,c:'#7C3AED'},
              {l:'Engineer',v:o.engineer||'Not Assigned',icon:User,c:'#D97706'},
              {l:'Email Full Sent',v:o.emailFull||'—',icon:Mail,c:'#64748B'},
              {l:'Email B/O Sent',v:o.emailBack||'—',icon:Mail,c:'#64748B'}
            ].map((f,i)=>(
              <div key={i} style={{ padding:14,borderRadius:10,background:'#F8FAFB',display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ padding:8,background:`${f.c}15`,borderRadius:8 }}><f.icon size={16} color={f.c}/></div>
                <div>
                  <div style={{ fontSize:10,color:'#94A3B8',fontWeight:600,textTransform:'uppercase' }}>{f.l}</div>
                  <div style={{ fontSize:14,fontWeight:600 }}>{f.v}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Remark */}
          {o.remark && (
            <div style={{ padding:16,background:'#FEF3C7',borderRadius:10,marginBottom:24 }}>
              <div style={{ fontSize:11,color:'#92400E',fontWeight:600,marginBottom:6 }}>REMARK</div>
              <div style={{ fontSize:13,color:'#78350F' }}>{o.remark}</div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex',gap:12,paddingTop:16,borderTop:'1px solid #E8ECF0' }}>
            <button onClick={()=>window.print()} style={{ padding:'12px 24px',background:'linear-gradient(135deg,#006837,#00A550)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}><FileText size={16}/> Print</button>
            <button onClick={()=>window.close()} style={{ padding:'12px 24px',background:'#E2E8F0',color:'#64748B',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer' }}>Close</button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center',marginTop:24,fontSize:11,color:'#94A3B8' }}>
          Miltenyi Inventory Hub — Singapore • Generated {new Date().toLocaleString()}
        </div>
      </div>
    );
  }

  // ════════════════════════════ LOADING SCREEN ═══════════════════════
  if (isLoading) {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg, #003020 0%, #006837 40%, #00A550 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',system-ui,sans-serif"}}>
        <div style={{textAlign:'center',color:'#fff'}}>
          <div style={{width:48,height:48,border:'4px solid rgba(255,255,255,0.3)',borderTop:'4px solid #fff',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
          <div style={{fontSize:18,fontWeight:600}}>Miltenyi Inventory Hub</div>
          <div style={{fontSize:13,opacity:0.7,marginTop:6}}>Loading...</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ════════════════════════════ LOGIN SCREEN ═════════════════════════
  if (!currentUser) {
    // Miltenyi Biotec product data for 3D carousel
    const miltenyiProducts = [
      { name: 'MACSQuant Analyzer 16', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_n8v15e6un15d7oqj2utjh91ia5/MACSQuant-Analyzer-16-background-image.png', color: '#00A550' },
      { name: 'gentleMACS Octo Dissociator', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_d8rr4h80cqqjt3r1bnl9e7e2v6/gentleMACS-Octo-Dissociator-with-Heaters.png', color: '#006837' },
      { name: 'CliniMACS Prodigy', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_6lhcj1t1b1kfq1qsb2g4rh3i15/CliniMACS-Prodigy-background-image.png', color: '#00C853' },
      { name: 'MACSQuant Tyto', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_h1s2lq6ed1kbhaqolj2djt5ifs/MACSQuant-Tyto-background-image.png', color: '#43A047' },
      { name: 'MACS MicroBeads', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_b1qfgt49b5odr5l0aemeh6c5cd/CD4-MicroBeads-human.png', color: '#2E7D32' },
      { name: 'MACSima Imaging', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_oijt0l5j7t05bnpvr7ss1c0m5e/MACSima-Imaging-System-background-image.png', color: '#1565C0' },
      { name: 'UltraMicroscope', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_cpii0p39bkitccn4s5qvd17q4c/UltraMicroscope-Blaze-background-image.png', color: '#7B1FA2' },
      // Inner ring
      { name: 'MultiMACS M96', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_fmui4o2ru1b7h0f4ehj7dh1p3d/MultiMACS-M96-background-image.png', color: '#1B5E20' },
      { name: 'MACSQuant X', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_u0p9jfp72t7mu7sfp4cjr1ia6a/MACSQuant-X-background-image.png', color: '#388E3C' },
      { name: 'gentleMACS Dissociator', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_eoei7gq4o9c6d2jj4h1bia6g30/gentleMACS-Dissociator-background-image.png', color: '#4CAF50' },
      { name: 'CliniMACS Plus', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_qjkh16r9b9fn9oqhk2p6l1a74u/CliniMACS-Plus-background-image.png', color: '#E65100' },
      { name: 'autoMACS Neo', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_h7hqt4b9v5qf9e6p7rn8q5m2vd/autoMACS-Neo-background-image.png', color: '#00838F' },
      { name: 'CellCelector', img: 'https://static.miltenyibiotec.com/asset/150655405641/document_1b0f5v2pu3h5c9mp3p67qhk4h4/CellCelector-background-image.png', color: '#AD1457' },
    ];

    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif", overflow:'hidden', position:'relative', animation:'colorCycleBase 12s ease-in-out infinite' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Sora:wght@300;400;500;600;700&display=swap');

          @keyframes fadeUp { from { opacity:0;transform:translateY(30px); } to { opacity:1;transform:translateY(0); } }
          @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
          @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }

          /* ── Color cycling: green → blue → orange → green (12s loop) ── */
          @keyframes colorCycleBg {
            0%, 100%  { background: radial-gradient(ellipse 80% 60% at 30% 40%, rgba(0,168,80,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 70% 60%, rgba(0,104,55,0.14) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 50% 80%, rgba(0,200,83,0.10) 0%, transparent 60%), linear-gradient(180deg, #001a0f 0%, #002815 40%, #001a0f 100%); }
            33%       { background: radial-gradient(ellipse 80% 60% at 30% 40%, rgba(30,100,210,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 70% 60%, rgba(20,70,160,0.14) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 50% 80%, rgba(60,140,255,0.10) 0%, transparent 60%), linear-gradient(180deg, #0a0f1a 0%, #0d1928 40%, #0a0f1a 100%); }
            66%       { background: radial-gradient(ellipse 80% 60% at 30% 40%, rgba(230,130,20,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 70% 60%, rgba(200,100,10,0.14) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 50% 80%, rgba(255,170,50,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a0f00 0%, #281800 40%, #1a0f00 100%); }
          }
          @keyframes colorCycleBase {
            0%, 100%  { background-color: #001a0f; }
            33%       { background-color: #0a0f1a; }
            66%       { background-color: #1a0f00; }
          }
          @keyframes colorCycleGrid {
            0%, 100%  { background-image: linear-gradient(rgba(0,168,80,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,168,80,0.05) 1px, transparent 1px); }
            33%       { background-image: linear-gradient(rgba(30,100,210,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(30,100,210,0.05) 1px, transparent 1px); }
            66%       { background-image: linear-gradient(rgba(230,130,20,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(230,130,20,0.05) 1px, transparent 1px); }
          }
          @keyframes colorCycleParticle {
            0%, 100%  { background: rgba(0,200,83,0.35); }
            33%       { background: rgba(60,140,255,0.35); }
            66%       { background: rgba(255,170,50,0.35); }
          }
          @keyframes colorCycleGlow1 {
            0%, 100%  { background: radial-gradient(circle, rgba(0,200,83,0.10) 0%, transparent 70%); }
            33%       { background: radial-gradient(circle, rgba(60,140,255,0.10) 0%, transparent 70%); }
            66%       { background: radial-gradient(circle, rgba(255,170,50,0.10) 0%, transparent 70%); }
          }
          @keyframes colorCycleGlow2 {
            0%, 100%  { background: radial-gradient(circle, rgba(0,104,55,0.12) 0%, transparent 70%); }
            33%       { background: radial-gradient(circle, rgba(20,70,160,0.12) 0%, transparent 70%); }
            66%       { background: radial-gradient(circle, rgba(200,100,10,0.12) 0%, transparent 70%); }
          }
          @keyframes colorCycleImgShadow {
            0%, 100%  { filter: brightness(1.1) drop-shadow(0 4px 8px rgba(0,200,83,0.3)); }
            33%       { filter: brightness(1.1) drop-shadow(0 4px 8px rgba(60,140,255,0.3)); }
            66%       { filter: brightness(1.1) drop-shadow(0 4px 8px rgba(255,170,50,0.3)); }
          }
          @keyframes colorCycleBtn {
            0%, 100%  { background: linear-gradient(135deg, #006837 0%, #00A550 50%, #00C853 100%); box-shadow: 0 4px 16px rgba(0,165,80,0.3); }
            33%       { background: linear-gradient(135deg, #1446A0 0%, #1E64D2 50%, #3C8CFF 100%); box-shadow: 0 4px 16px rgba(30,100,210,0.3); }
            66%       { background: linear-gradient(135deg, #C86414 0%, #E68214 50%, #FFAA32 100%); box-shadow: 0 4px 16px rgba(230,130,20,0.3); }
          }
          @keyframes colorCycleFocus {
            0%, 100%  { border-color: #00A550; box-shadow: 0 0 0 4px rgba(0,165,80,0.12), 0 2px 8px rgba(0,165,80,0.08); }
            33%       { border-color: #1E64D2; box-shadow: 0 0 0 4px rgba(30,100,210,0.12), 0 2px 8px rgba(30,100,210,0.08); }
            66%       { border-color: #E68214; box-shadow: 0 0 0 4px rgba(230,130,20,0.12), 0 2px 8px rgba(230,130,20,0.08); }
          }
          @keyframes colorCycleLink {
            0%, 100%  { color: #00A550; }
            33%       { color: #1E64D2; }
            66%       { color: #E68214; }
          }
          @keyframes colorCycleAccentLine {
            0%, 100%  { background: linear-gradient(90deg, #00A550, #00C853); }
            33%       { background: linear-gradient(90deg, #1E64D2, #3C8CFF); }
            66%       { background: linear-gradient(90deg, #E68214, #FFAA32); }
          }
          @keyframes colorCycleLogoBg {
            0%, 100%  { background: linear-gradient(135deg,#006837,#00A550); }
            33%       { background: linear-gradient(135deg,#1446A0,#1E64D2); }
            66%       { background: linear-gradient(135deg,#C86414,#E68214); }
          }
          @keyframes colorCycleLogoShadow {
            0%, 100%  { box-shadow: 0 8px 24px rgba(0,104,55,0.25); }
            33%       { box-shadow: 0 8px 24px rgba(30,100,210,0.25); }
            66%       { box-shadow: 0 8px 24px rgba(230,130,20,0.25); }
          }

          @keyframes orbit3d {
            0%   { transform: rotateY(0deg)   translateZ(320px) rotateY(0deg)   scale(0.7); opacity: 0.3; }
            25%  { transform: rotateY(90deg)  translateZ(320px) rotateY(-90deg) scale(1.1); opacity: 0.9; }
            50%  { transform: rotateY(180deg) translateZ(320px) rotateY(-180deg) scale(0.7); opacity: 0.3; }
            75%  { transform: rotateY(270deg) translateZ(320px) rotateY(-270deg) scale(1.1); opacity: 0.9; }
            100% { transform: rotateY(360deg) translateZ(320px) rotateY(-360deg) scale(0.7); opacity: 0.3; }
          }
          @keyframes orbit3d-reverse {
            0%   { transform: rotateY(0deg)   translateZ(250px) rotateY(0deg)   scale(0.6); opacity: 0.2; }
            25%  { transform: rotateY(-90deg)  translateZ(250px) rotateY(90deg) scale(0.9); opacity: 0.7; }
            50%  { transform: rotateY(-180deg) translateZ(250px) rotateY(180deg) scale(0.6); opacity: 0.2; }
            75%  { transform: rotateY(-270deg) translateZ(250px) rotateY(270deg) scale(0.9); opacity: 0.7; }
            100% { transform: rotateY(-360deg) translateZ(250px) rotateY(360deg) scale(0.6); opacity: 0.2; }
          }
          @keyframes float-gentle { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
          @keyframes pulse-glow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
          @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes grid-pulse { 0%,100% { opacity: 0.03; } 50% { opacity: 0.07; } }

          .login-bg-gradient {
            position: absolute; inset: 0; z-index: 0;
            animation: colorCycleBg 12s ease-in-out infinite;
          }
          .login-grid-overlay {
            position: absolute; inset: 0; z-index: 1;
            background-size: 60px 60px;
            animation: colorCycleGrid 12s ease-in-out infinite, grid-pulse 8s ease-in-out infinite;
          }
          .login-particles { position: absolute; inset: 0; z-index: 1; overflow: hidden; }
          .login-particle {
            position: absolute; border-radius: 50%;
            animation: float-gentle 6s ease-in-out infinite, colorCycleParticle 12s ease-in-out infinite;
          }

          .product-orbit-container {
            position: absolute; z-index: 2; pointer-events: none;
            width: 700px; height: 700px;
            top: 50%; left: 50%; transform: translate(-50%, -50%);
            perspective: 1200px;
          }
          .product-orbit-ring {
            position: absolute; inset: 0;
            transform-style: preserve-3d;
            animation: rotate-slow 40s linear infinite;
          }
          .product-orbit-ring-2 {
            position: absolute; inset: 50px;
            transform-style: preserve-3d;
            animation: rotate-slow 30s linear infinite reverse;
          }
          .product-card-3d {
            position: absolute; top: 50%; left: 50%;
            width: 110px; height: 130px; margin: -65px 0 0 -55px;
            transform-style: preserve-3d;
            transition: all 0.5s ease;
          }
          .product-card-3d-inner {
            width: 100%; height: 100%;
            background: rgba(255,255,255,0.06);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 10px; box-sizing: border-box;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
          }
          .product-card-3d-inner img {
            width: 70px; height: 70px; object-fit: contain;
            margin-bottom: 8px;
            animation: colorCycleImgShadow 12s ease-in-out infinite;
          }
          .product-card-3d-inner .product-label {
            font-size: 8px; font-weight: 600; color: rgba(255,255,255,0.7);
            text-align: center; line-height: 1.2; letter-spacing: 0.3px;
            font-family: 'Sora', 'DM Sans', sans-serif;
          }

          .login-card-glass {
            animation: fadeUp 0.7s ease;
            width: 420px; max-width: 92vw;
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 44px 40px;
            box-shadow: 0 32px 100px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
            position: relative; z-index: 10;
          }

          .login-input {
            font-family: 'DM Sans', sans-serif; font-size: 13px;
            padding: 12px 16px; border: 1.5px solid #E2E8F0; border-radius: 12px;
            outline: none; transition: all 0.3s ease; color: #1A202C;
            background: #fff; width: 100%; box-sizing: border-box;
          }
          .login-input:focus {
            animation: colorCycleFocus 12s ease-in-out infinite;
          }
          .login-input::placeholder { color: #A0AEC0; }

          .login-btn-primary {
            width: 100%; padding: 13px; border-radius: 12px; border: none;
            background-size: 200% auto;
            color: #fff; font-size: 14px; font-weight: 600;
            cursor: pointer; font-family: 'DM Sans', sans-serif;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            transition: transform 0.3s ease;
            animation: colorCycleBtn 12s ease-in-out infinite;
          }
          .login-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.1); }
          .login-btn-primary:active { transform: translateY(0px); }

          .login-link { background: none; border: none; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; animation: colorCycleLink 12s ease-in-out infinite; }

          .login-header-line {
            width: 40px; height: 3px; border-radius: 2px;
            margin: 0 auto 16px;
            animation: colorCycleAccentLine 12s ease-in-out infinite;
          }

          .login-logo-box {
            width: 64px; height: 64px; border-radius: 18px;
            display: inline-flex; align-items: center; justify-content: center;
            margin-bottom: 16px; overflow: hidden;
            animation: colorCycleLogoBg 12s ease-in-out infinite, colorCycleLogoShadow 12s ease-in-out infinite;
          }

          @media (max-width: 768px) {
            .product-orbit-container { width: 500px; height: 500px; }
            .product-card-3d { width: 80px; height: 100px; margin: -50px 0 0 -40px; }
            .product-card-3d-inner img { width: 50px; height: 50px; }
            .product-card-3d-inner .product-label { font-size: 7px; }
            .login-card-glass { padding: 32px 28px; }
          }
          @media (max-width: 480px) {
            .product-orbit-container { width: 380px; height: 380px; }
          }
        `}</style>

        {/* Background layers */}
        <div className="login-bg-gradient" />
        <div className="login-grid-overlay" />

        {/* Floating particles */}
        <div className="login-particles">
          {[...Array(20)].map((_,i) => (
            <div key={i} className="login-particle" style={{
              width: 2 + Math.random()*4, height: 2 + Math.random()*4,
              left: `${Math.random()*100}%`, top: `${Math.random()*100}%`,
              animationDelay: `${Math.random()*6}s`,
              animationDuration: `${4+Math.random()*6}s`,
              opacity: 0.1 + Math.random()*0.3,
            }} />
          ))}
        </div>

        {/* Ambient glow orbs */}
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', top:'10%', left:'5%', animation:'colorCycleGlow1 12s ease-in-out infinite, pulse-glow 6s ease-in-out infinite', zIndex:1 }} />
        <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', bottom:'15%', right:'10%', animation:'colorCycleGlow2 12s ease-in-out infinite, pulse-glow 8s ease-in-out infinite 2s', zIndex:1 }} />

        {/* 3D Product Orbit */}
        <div className="product-orbit-container">
          <div className="product-orbit-ring">
            {miltenyiProducts.slice(0,7).map((p,i) => (
              <div key={i} className="product-card-3d" style={{
                animation: `orbit3d 45s linear infinite`,
                animationDelay: `${i * -(45/7)}s`,
              }}>
                <div className="product-card-3d-inner">
                  <img src={p.img} alt={p.name} onError={e => { e.target.style.display='none'; }} />
                  <div className="product-label">{p.name}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="product-orbit-ring-2">
            {miltenyiProducts.slice(7).map((p,i) => (
              <div key={i} className="product-card-3d" style={{
                animation: `orbit3d-reverse 35s linear infinite`,
                animationDelay: `${i * -(35/6)}s`,
              }}>
                <div className="product-card-3d-inner">
                  <img src={p.img} alt={p.name} onError={e => { e.target.style.display='none'; }} />
                  <div className="product-label">{p.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Login Card */}
        <div className="login-card-glass">
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div className="login-header-line" />
            <div className={customLogo?'':'login-logo-box'} style={customLogo?{width:64,height:64,borderRadius:18,background:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:16,overflow:'hidden',border:'2px solid #E8EDF2',boxShadow:'0 8px 24px rgba(0,0,0,0.1)'}:{}}>
              {customLogo?<img src={customLogo} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Package size={30} color="#fff"/>}
            </div>
            <h1 style={{ fontSize:24,fontWeight:700,color:'#0F172A',letterSpacing:-0.5,fontFamily:"'Sora','DM Sans',sans-serif",margin:0 }}>Miltenyi Inventory Hub</h1>
            <p style={{ fontSize:10,color:'#94A3B8',marginTop:6,letterSpacing:0.5,textTransform:'uppercase',fontWeight:500 }}>Service Spare Parts Management &mdash; Singapore</p>
          </div>

          {authView === 'login' ? (
            <div>
              <div style={{ marginBottom:16 }}>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Username</label>
                <input className="login-input" value={loginForm.username} onChange={e=>setLoginForm(p=>({...p,username:e.target.value}))} placeholder="Enter username" onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
              </div>
              <div style={{ marginBottom:24 }}>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Password</label>
                <input className="login-input" type="password" value={loginForm.password} onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))} placeholder="Enter password" onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
              </div>
              <button onClick={handleLogin} disabled={isSubmitting} className="login-btn-primary" style={{opacity:isSubmitting?.6:1}}>
                <Lock size={16}/> {isSubmitting?'Signing in...':'Sign In'}
              </button>
              <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#64748B' }}>
                Don't have an account? <button onClick={()=>setAuthView('register')} className="login-link">Register here</button>
              </div>
              <div style={{ marginTop:24,padding:12,borderRadius:10,background:'linear-gradient(135deg,#F0FFF4,#F8FAFB)',fontSize:11,color:'#94A3B8',border:'1px solid #E8F5E9' }}>
                <div style={{fontWeight:600,marginBottom:4,color:'#4CAF50',fontSize:10,textTransform:'uppercase',letterSpacing:0.5}}>Getting Started</div>
                <div>Contact your administrator for login credentials</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom:14 }}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Full Name *</label><input className="login-input" value={regForm.name} onChange={e=>setRegForm(p=>({...p,name:e.target.value}))} placeholder="Your full name"/></div>
              <div style={{ marginBottom:14 }}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Email *</label><input className="login-input" type="email" value={regForm.email} onChange={e=>setRegForm(p=>({...p,email:e.target.value}))} placeholder="name@miltenyibiotec.com"/></div>
              <div style={{ marginBottom:14 }}><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Phone</label><input className="login-input" value={regForm.phone} onChange={e=>setRegForm(p=>({...p,phone:e.target.value}))} placeholder="+65 9XXX XXXX"/></div>
              <div className="grid-2" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14 }}>
                <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Username *</label><input className="login-input" value={regForm.username} onChange={e=>setRegForm(p=>({...p,username:e.target.value}))} placeholder="Choose username"/></div>
                <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Password *</label><input className="login-input" type="password" value={regForm.password} onChange={e=>setRegForm(p=>({...p,password:e.target.value}))} placeholder="Create password"/></div>
              </div>
              <div style={{ padding:10,borderRadius:10,background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)',fontSize:11,color:'#92400E',marginBottom:20,display:'flex',alignItems:'center',gap:6,border:'1px solid #FDE68A' }}><AlertTriangle size={13}/> Your account will need admin approval before you can login.</div>
              <button onClick={handleRegister} className="login-btn-primary"><UserPlus size={16}/> Request Account</button>
              <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:'#64748B' }}>
                Already have an account? <button onClick={()=>setAuthView('login')} className="login-link">Sign in</button>
              </div>
            </div>
          )}
        </div>
        <Toast items={notifs} onDismiss={i=>setNotifs(p=>p.filter((_,j)=>j!==i))}/>
      </div>
    );
  }

  // ════════════════════════════ MAIN APP RENDER ══════════════════════
  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", background:'#F4F6F8', minHeight:'100vh', display:'flex', color:'#1A202C' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px}
        @keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .card{background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.03);transition:box-shadow .2s}
        .card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .bp{background:linear-gradient(135deg,#006837,#0B7A3E 50%,#00A550);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;transition:all .2s;font-family:inherit}
        .bp:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(11,122,62,.3)}
        .bs{background:#F7FAFC;color:#4A5568;border:1px solid #E2E8F0;padding:9px 20px;border-radius:8px;font-weight:500;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        .bs:hover{background:#EDF2F7}
        .bw{background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        .be{background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        .bd{background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;border:none;padding:9px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
        input,select,textarea{font-family:inherit;font-size:13px;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;outline:none;transition:border-color .2s;color:#1A202C;background:#fff}
        input:focus,select:focus{border-color:#0B7A3E;box-shadow:0 0 0 3px rgba(11,122,62,.1)}
        .tr{transition:background .15s;cursor:pointer} .tr:hover{background:#F0FDF4!important}
        .ni{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;cursor:pointer;transition:all .15s;font-size:13px;font-weight:500;color:#64748B;margin:2px 0}
        .ni:hover{background:rgba(11,122,62,.06);color:#0B7A3E} .ni.a{background:linear-gradient(135deg,rgba(11,122,62,.1),rgba(0,165,80,.08));color:#0B7A3E;font-weight:600}
        .mo{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}
        .th{padding:12px 14px;text-align:left;font-weight:600;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #E8ECF0;white-space:nowrap}
        .td{padding:10px 14px} .mono{font-family:'JetBrains Mono',monospace}
        .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .sc{position:relative;overflow:hidden;border-radius:14px;padding:20px 22px;color:#fff}
        .sc::after{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.1)}
      `}</style>

      <Toast items={notifs} onDismiss={i=>setNotifs(p=>p.filter((_,j)=>j!==i))}/>

      {/* MOBILE SIDEBAR OVERLAY */}
      <div className={`sidebar-overlay${sidebarOpen?'':' hidden'}`} onClick={()=>setSidebarOpen(false)}/>

      {/* SIDEBAR */}
      <aside className={`app-sidebar${sidebarOpen?' open':''}`} style={{ width:sidebarOpen?250:68, background:'#fff', borderRight:'1px solid #E8ECF0', display:'flex', flexDirection:'column', transition:'width .25s', flexShrink:0, zIndex:50 }}>
        <div style={{ padding:sidebarOpen?'20px 18px 16px':'20px 12px 16px', borderBottom:'1px solid #F0F2F5', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:customLogo?'#fff':'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden' }}>{customLogo?<img src={customLogo} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Package size={18} color="#fff"/>}</div>
          {sidebarOpen && <div><div style={{fontWeight:700,fontSize:14,color:'#006837'}}>Miltenyi</div><div style={{fontSize:10,color:'#94A3B8',fontWeight:500,letterSpacing:.5,textTransform:'uppercase'}}>Inventory Hub SG</div></div>}
        </div>
        <nav style={{ padding:'12px 10px', flex:1, overflowY:'auto' }}>
          {navItems.map(item=>(
            <div key={item.id} className={`ni ${page===item.id?'a':''}`} onClick={()=>{setPage(item.id);setCatalogPage(0);if(window.innerWidth<=768)setSidebarOpen(false);}} title={item.label}>
              <item.icon size={18}/>
              {sidebarOpen && <span>{item.label}</span>}
              {item.id==='catalog'&&sidebarOpen && <span style={{marginLeft:'auto',fontSize:10,background:'#E6F4ED',color:'#0B7A3E',padding:'2px 6px',borderRadius:8,fontWeight:700}}>{partsCatalog.length}</span>}
              {item.id==='whatsapp'&&sidebarOpen && <span style={{marginLeft:'auto',width:8,height:8,borderRadius:'50%',background:waConnected?'#25D366':'#E2E8F0'}}/>}
              {item.id==='users'&&sidebarOpen&&pendingUsers.length>0 && <span style={{marginLeft:'auto',fontSize:10,background:'#FEE2E2',color:'#DC2626',padding:'2px 6px',borderRadius:8,fontWeight:700}}>{pendingUsers.length}</span>}
            </div>
          ))}
        </nav>
        <div style={{ padding:'12px 10px', borderTop:'1px solid #F0F2F5' }}>
          <div className="ni" onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu size={18}/>{sidebarOpen&&<span style={{fontSize:12}}>Collapse</span>}</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, overflow:'auto', maxHeight:'100vh' }}>
        <header className="app-header" style={{ background:'#fff', borderBottom:'1px solid #E8ECF0', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className="mobile-menu-btn" onClick={()=>setSidebarOpen(true)} style={{background:'none',border:'none',cursor:'pointer',padding:4,alignItems:'center',justifyContent:'center'}}><Menu size={22} color="#0F172A"/></button>
            <div>
              <h1 style={{fontSize:20,fontWeight:700,color:'#0F172A',letterSpacing:-.5}}>{navItems.find(n=>n.id===page)?.label||'Dashboard'}</h1>
              <p className="header-subtitle" style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Logged in as <strong style={{color:'#0B7A3E'}}>{currentUser.name}</strong> ({currentUser.role}) • Prices {priceConfig.year}</p>
            </div>
          </div>
          <div className="header-actions" style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ position:'relative' }}><Search size={15} style={{position:'absolute',left:10,top:10,color:'#94A3B8'}}/><input className="header-search" type="text" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:32,width:220,height:36}}/></div>
            {isAdmin && <span className="admin-pill"><Pill bg="#DBEAFE" color="#2563EB"><Shield size={11}/> Admin</Pill></span>}
            <button onClick={()=>setAiPanelOpen(!aiPanelOpen)} className="bs" style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:6,background:aiPanelOpen?'#E6F4ED':'#F8FAFB',border:aiPanelOpen?'1.5px solid #0B7A3E':'1.5px solid #E2E8F0'}} title="AI Assistant">{aiPanelOpen?<PanelRightClose size={16} color="#0B7A3E"/>:<Bot size={16}/>} <span className="ai-label" style={{fontSize:12,fontWeight:600,color:aiPanelOpen?'#0B7A3E':'#64748B'}}>AI</span></button>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700}}>{currentUser.name.split(' ').map(w=>w[0]).join('')}</div>
              <button className="bs" style={{padding:'8px 12px',fontSize:12}} onClick={()=>{api.logout();setCurrentUser(null);setLoginForm({username:'',password:''});}}><LogOut size={14}/><span className="logout-text">{sidebarOpen?'Logout':''}</span></button>
            </div>
          </div>
        </header>

        <div className="app-content" style={{ padding:'24px 28px', animation:'fadeIn .3s' }}>

{/* ═══════════ DASHBOARD ═══════════ */}
{page==='dashboard'&&(<div>
  <div className="grid-5" style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:24}}>
    {[{l:'Catalog',v:fmtNum(partsCatalog.length),i:Database,bg:'linear-gradient(135deg,#4338CA,#6366F1)'},{l:'Total Orders',v:stats.total,i:Package,bg:'linear-gradient(135deg,#006837,#0B9A4E)'},{l:'Spend',v:fmt(stats.totalCost),i:DollarSign,bg:'linear-gradient(135deg,#1E40AF,#3B82F6)'},{l:'Fulfillment',v:`${stats.fulfillmentRate}%`,i:TrendingUp,bg:'linear-gradient(135deg,#047857,#10B981)'},{l:'Back Orders',v:stats.backOrder,i:AlertTriangle,bg:'linear-gradient(135deg,#B91C1C,#EF4444)'}].map((s,i)=>(
      <div key={i} className="sc" style={{background:s.bg}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><div style={{fontSize:11,fontWeight:500,opacity:.85,marginBottom:6,textTransform:'uppercase',letterSpacing:.8}}>{s.l}</div><div className="mono" style={{fontSize:24,fontWeight:700,letterSpacing:-1}}>{s.v}</div></div><div style={{background:'rgba(255,255,255,.15)',borderRadius:10,padding:8}}><s.i size={18}/></div></div></div>
    ))}
  </div>
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:24}}>
    <div className="card" style={{padding:'20px 24px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600}}>Monthly Trends</h3><span style={{fontSize:11,color:'#94A3B8'}}>Feb 2025 — Jan 2026</span></div>
      <ResponsiveContainer width="100%" height={250}><AreaChart data={monthlyData}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0B7A3E" stopOpacity={.15}/><stop offset="95%" stopColor="#0B7A3E" stopOpacity={0}/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DC2626" stopOpacity={.15}/><stop offset="95%" stopColor="#DC2626" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Area type="monotone" dataKey="received" stroke="#0B7A3E" fillOpacity={1} fill="url(#g1)" name="Received" strokeWidth={2}/><Area type="monotone" dataKey="backOrder" stroke="#DC2626" fillOpacity={1} fill="url(#g2)" name="Back Order" strokeWidth={2}/></AreaChart></ResponsiveContainer>
    </div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Status</h3>
      <ResponsiveContainer width="100%" height={190}><PieChart><Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" strokeWidth={0}>{statusPieData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
      <div style={{display:'flex',justifyContent:'center',gap:14,marginTop:8}}>{statusPieData.map((s,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#64748B'}}><div style={{width:8,height:8,borderRadius:'50%',background:s.color}}/>{s.name} ({s.value})</div>)}</div>
    </div>
  </div>
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Top Items by Cost</h3><ResponsiveContainer width="100%" height={260}><BarChart data={topItems} layout="vertical" margin={{left:140}}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:'#94A3B8'}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#4A5568'}} axisLine={false} tickLine={false} width={135}/><Tooltip formatter={v=>fmt(v)} contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Bar dataKey="cost" fill="#0B7A3E" radius={[0,6,6,0]} barSize={16}/></BarChart></ResponsiveContainer></div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Avg Price: SG vs Distributor</h3><ResponsiveContainer width="100%" height={260}><BarChart data={catPriceData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:'#94A3B8'}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)} contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Bar dataKey="sg" name="Singapore" fill="#0B7A3E" radius={[4,4,0,0]} barSize={14}/><Bar dataKey="dist" name="Distributor" fill="#2563EB" radius={[4,4,0,0]} barSize={14}/><Legend iconSize={10} wrapperStyle={{fontSize:11}}/></BarChart></ResponsiveContainer></div>
  </div>
</div>)}

{/* ═══════════ CATALOG ═══════════ */}
{page==='catalog'&&(<div>
  <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
    {[{l:'Total Parts',v:fmtNum(catalogStats.total),i:Database,c:'#4338CA'},{l:'Avg SG',v:fmt(catalogStats.avgSg),i:DollarSign,c:'#0B7A3E'},{l:'Avg Dist',v:fmt(catalogStats.avgDist),i:Tag,c:'#2563EB'},{l:'Categories',v:Object.keys(catalogStats.catCounts).length,i:Archive,c:'#D97706'}].map((s,i)=>(
      <div key={i} className="card" style={{padding:'16px 20px'}}><div style={{display:'flex',justifyContent:'space-between'}}><div><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div></div><div style={{padding:10,background:`${s.c}10`,borderRadius:10}}><s.i size={18} color={s.c}/></div></div></div>
    ))}
  </div>
  <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
    <div style={{position:'relative',flex:1,maxWidth:360}}><Search size={15} style={{position:'absolute',left:10,top:10,color:'#94A3B8'}}/><input placeholder="Search material no. or description..." value={catalogSearch} onChange={e=>{setCatalogSearch(e.target.value);setCatalogPage(0);}} style={{paddingLeft:32,width:'100%',height:36}}/></div>
    <select value={catFilter} onChange={e=>{setCatFilter(e.target.value);setCatalogPage(0);}} style={{height:36}}><option value="All">All Categories</option>{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.label} ({catalogStats.catCounts[k]||0})</option>)}</select>
    <span style={{fontSize:12,color:'#94A3B8',marginLeft:'auto'}}>{catalog.length} parts</span>
  </div>
  <div className="card" style={{overflow:'hidden'}}><div className="table-wrap" style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
    <thead><tr style={{background:'#F8FAFB'}}>
      <th className="th" style={{width:120}}>Material No.</th><th className="th">Description</th><th className="th" style={{width:120}}>Category</th>
      {[{k:'tp',l:'Transfer'},{k:'sg',l:'SG Price'},{k:'dist',l:'Dist Price'}].map(h=><th key={h.k} className="th" style={{width:110,textAlign:'right',cursor:'pointer'}} onClick={()=>setCatalogSort(s=>({key:h.k,dir:s.key===h.k&&s.dir==='desc'?'asc':'desc'}))}>{h.l} {catalogSort.key===h.k?(catalogSort.dir==='desc'?'↓':'↑'):''}</th>)}
      <th className="th" style={{width:70,textAlign:'right'}}>Margin</th>
    </tr></thead>
    <tbody>{catalog.slice(catalogPage*PAGE_SIZE,(catalogPage+1)*PAGE_SIZE).map((p,i)=>{const margin=p.singaporePrice>0?((p.singaporePrice-p.distributorPrice)/p.singaporePrice*100).toFixed(1):0;const cc=CATEGORIES[p.category];return(
      <tr key={p.materialNo+i} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD'}} onClick={()=>setSelectedPart(p)}>
        <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:500}}>{p.materialNo}</td>
        <td className="td" style={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.description}</td>
        <td className="td"><Pill bg={`${cc?.color||'#64748B'}12`} color={cc?.color||'#64748B'}>{cc?.short||'—'}</Pill></td>
        <td className="td mono" style={{textAlign:'right',fontSize:11}}>{p.transferPrice>0?fmt(p.transferPrice):'—'}</td>
        <td className="td mono" style={{textAlign:'right',fontSize:11,fontWeight:600}}>{p.singaporePrice>0?fmt(p.singaporePrice):'—'}</td>
        <td className="td mono" style={{textAlign:'right',fontSize:11}}>{p.distributorPrice>0?fmt(p.distributorPrice):'—'}</td>
        <td className="td mono" style={{textAlign:'right',fontSize:11,color:margin>30?'#0B7A3E':margin>15?'#D97706':'#DC2626'}}>{margin}%</td>
      </tr>);})}</tbody>
  </table></div>
  <div style={{padding:'12px 16px',borderTop:'1px solid #F0F2F5',display:'flex',justifyContent:'space-between',background:'#FCFCFD'}}>
    <span style={{fontSize:12,color:'#94A3B8'}}>Page {catalogPage+1}/{Math.ceil(catalog.length/PAGE_SIZE)}</span>
    <div style={{display:'flex',gap:6}}><button className="bs" style={{padding:'6px 12px',fontSize:12}} disabled={catalogPage===0} onClick={()=>setCatalogPage(p=>p-1)}>← Prev</button><button className="bs" style={{padding:'6px 12px',fontSize:12}} disabled={(catalogPage+1)*PAGE_SIZE>=catalog.length} onClick={()=>setCatalogPage(p=>p+1)}>Next →</button></div>
  </div></div>
</div>)}

{/* ═══════════ ALL ORDERS ═══════════ */}
{page==='allorders'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B',margin:0}}>Unified view of all single and bulk orders</p>
    <ExportDropdown data={allOrdersCombined} columns={[{key:'id',label:'Order ID'},{key:'materialNo',label:'Material No'},{key:'description',label:'Description'},{key:'quantity',label:'Qty'},{key:'listPrice',label:'List Price',fmt:v=>v>0?fmt(v):''},{key:'totalCost',label:'Total Cost',fmt:v=>v>0?fmt(v):''},{key:'orderDate',label:'Order Date',fmt:v=>fmtDate(v)},{key:'orderBy',label:'Ordered By'},{key:'status',label:'Status'},{key:'orderType',label:'Type'},{key:'month',label:'Month'}]} filename="all-orders" title="All Orders Export"/>
  </div>

  {/* Summary Cards */}
  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
    {[
      {l:'Total Orders',v:allOrdersCombined.length,i:Package,c:'#0B7A3E',bg:'linear-gradient(135deg,#006837,#0B9A4E)'},
      {l:'Single Orders',v:allOrdersCombined.filter(o=>o.orderType==='Single').length,i:Package,c:'#2563EB',bg:'linear-gradient(135deg,#1E40AF,#3B82F6)'},
      {l:'Bulk Orders',v:allOrdersCombined.filter(o=>o.orderType==='Bulk').length,i:Layers,c:'#7C3AED',bg:'linear-gradient(135deg,#5B21B6,#7C3AED)'},
      {l:'Total Value',v:fmt(allOrdersCombined.reduce((s,o)=>s+(Number(o.totalCost)||0),0)),i:DollarSign,c:'#D97706',bg:'linear-gradient(135deg,#92400E,#D97706)'}
    ].map((s,i)=>(
      <div key={i} style={{background:s.bg,borderRadius:12,padding:'20px 22px',color:'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div><div style={{fontSize:11,opacity:.8,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>{s.l}</div><div className="mono" style={{fontSize:26,fontWeight:700}}>{s.v}</div></div>
          <div style={{padding:8,background:'rgba(255,255,255,0.15)',borderRadius:8}}><s.i size={18}/></div>
        </div>
      </div>
    ))}
  </div>

  {/* Filter Bar */}
  <div className="card" style={{padding:'14px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{fontSize:11,fontWeight:600,color:'#64748B',textTransform:'uppercase',letterSpacing:.5}}>Type</span>
      {['All','Single Orders','Bulk Orders'].map(t=><button key={t} onClick={()=>setAllOrdersTypeFilter(t)} style={{padding:'5px 12px',borderRadius:20,border:allOrdersTypeFilter===t?'none':'1px solid #E2E8F0',background:allOrdersTypeFilter===t?'#0B7A3E':'#fff',color:allOrdersTypeFilter===t?'#fff':'#64748B',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{t}</button>)}
    </div>
    <div style={{width:1,height:24,background:'#E2E8F0'}}/>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{fontSize:11,fontWeight:600,color:'#64748B',textTransform:'uppercase',letterSpacing:.5}}>Month</span>
      <select value={allOrdersMonth} onChange={e=>setAllOrdersMonth(e.target.value)} style={{padding:'5px 10px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:11,fontFamily:'inherit',cursor:'pointer',color:'#1A202C'}}>
        <option value="All">All Months</option>
        {allOrdersMonths.map(m=><option key={m} value={m}>{m}</option>)}
      </select>
    </div>
    <div style={{width:1,height:24,background:'#E2E8F0'}}/>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{fontSize:11,fontWeight:600,color:'#64748B',textTransform:'uppercase',letterSpacing:.5}}>Status</span>
      {['All','Pending Approval','Approved','Received','Back Order','Rejected'].map(s=><button key={s} onClick={()=>setAllOrdersStatus(s)} style={{padding:'5px 12px',borderRadius:20,border:allOrdersStatus===s?'none':'1px solid #E2E8F0',background:allOrdersStatus===s?'#0B7A3E':'#fff',color:allOrdersStatus===s?'#fff':'#64748B',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{s}</button>)}
    </div>
  </div>

  {/* All Orders Table */}
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontWeight:600,fontSize:14}}>All Orders</span>
      <span style={{fontSize:11,color:'#94A3B8'}}>{allOrdersCombined.length} results</span>
    </div>
    <div className="table-wrap" style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{['Type','ID','Material / Items','Description','Qty','Total Cost','By','Date','Status'].map(h=><th key={h} className="th" style={{whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
      <tbody>{allOrdersCombined.length===0?<tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'#94A3B8',fontSize:13}}>No orders match the selected filters</td></tr>:allOrdersCombined.map((o,i)=>(
        <tr key={o.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD',cursor:'pointer'}} onClick={()=>openOrderInNewTab(o)}>
          <td className="td"><Pill bg={o.orderType==='Single'?'#DBEAFE':'#EDE9FE'} color={o.orderType==='Single'?'#2563EB':'#7C3AED'}>{o.orderType==='Single'?'Single':'Bulk'}</Pill></td>
          <td className="td mono" style={{fontSize:11,fontWeight:600,color:o.orderType==='Single'?'#0B7A3E':'#4338CA'}}>{o.id}</td>
          <td className="td mono" style={{fontSize:11,color:'#64748B'}}>{o.materialNo||'—'}</td>
          <td className="td" style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
          <td className="td" style={{fontWeight:600,textAlign:'center'}}>{o.quantity}</td>
          <td className="td mono" style={{fontSize:11,fontWeight:600}}>{(Number(o.totalCost)||0)>0?fmt(o.totalCost):'—'}</td>
          <td className="td" style={{fontSize:11}}>{o.orderBy||'—'}</td>
          <td className="td" style={{color:'#94A3B8',fontSize:11}}>{fmtDate(o.orderDate)}</td>
          <td className="td"><Badge status={o.status}/></td>
        </tr>
      ))}</tbody>
    </table></div>
    <div style={{padding:'12px 16px',borderTop:'1px solid #F0F2F5',display:'flex',justifyContent:'space-between',background:'#FCFCFD'}}>
      <span style={{fontSize:12,color:'#94A3B8'}}>{allOrdersCombined.length} orders{allOrdersTypeFilter!=='All'||allOrdersMonth!=='All'||allOrdersStatus!=='All'?' (filtered)':''}</span>
      <span style={{fontSize:12,fontWeight:500}}>{fmt(allOrdersCombined.reduce((s,o)=>s+(Number(o.totalCost)||0),0))}</span>
    </div>
  </div>

  {/* Month Overview */}
  {allOrdersTypeFilter==='All'&&allOrdersStatus==='All'&&allOrdersMonth==='All'&&(
  <div className="card" style={{padding:'20px 24px',marginTop:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Orders by Month</h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
      {allOrdersMonths.map(month=>{
        const singleCount=orders.filter(o=>!o.bulkGroupId&&o.month===month).length;
        const bulkCount=orders.filter(o=>o.bulkGroupId&&o.month===month).length;
        const totalCost=orders.filter(o=>o.month===month).reduce((s,o)=>s+(Number(o.totalCost)||0),0);
        return <div key={month} onClick={()=>setAllOrdersMonth(allOrdersMonth===month?'All':month)} style={{padding:14,borderRadius:10,background:allOrdersMonth===month?'#E6F4ED':'#F8FAFB',border:allOrdersMonth===month?'2px solid #0B7A3E':'1px solid #E8ECF0',cursor:'pointer',transition:'all 0.2s'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:'#0B7A3E',display:'flex',alignItems:'center',gap:6}}><Calendar size={12}/> {month}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11}}>
            <div>Single: <strong>{singleCount}</strong></div>
            <div>Bulk: <strong>{bulkCount}</strong></div>
            <div style={{gridColumn:'span 2'}}>Value: <strong className="mono">{fmt(totalCost)}</strong></div>
          </div>
        </div>;
      })}
    </div>
  </div>)}
</div>)}

{/* ═══════════ SINGLE ORDERS ═══════════ */}
{page==='orders'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <div style={{display:'flex',gap:8}}>{['All','Pending Approval','Approved','Received','Back Order','Rejected'].map(s=><button key={s} onClick={()=>setStatusFilter(s)} style={{padding:'6px 14px',borderRadius:20,border:statusFilter===s?'none':'1px solid #E2E8F0',background:statusFilter===s?'#0B7A3E':'#fff',color:statusFilter===s?'#fff':'#64748B',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>{s} ({s==='All'?orders.filter(o=>!o.bulkGroupId).length:orders.filter(o=>!o.bulkGroupId&&o.status===s).length})</button>)}</div>
    <div style={{display:'flex',gap:8}}>
      <ExportDropdown data={filteredOrders} columns={[{key:'id',label:'Order ID'},{key:'materialNo',label:'Material No'},{key:'description',label:'Description'},{key:'quantity',label:'Qty'},{key:'listPrice',label:'List Price',fmt:v=>v>0?fmt(v):''},{key:'totalCost',label:'Total Cost',fmt:v=>v>0?fmt(v):''},{key:'orderDate',label:'Order Date',fmt:v=>fmtDate(v)},{key:'orderBy',label:'Ordered By'},{key:'engineer',label:'Engineer'},{key:'status',label:'Status'}]} filename="single-orders" title="Single Orders Export"/>
      <button className="bp" onClick={()=>setShowNewOrder(true)}><Plus size={14}/> New Order</button>
    </div>
  </div>
  {hasPermission('deleteOrders') && <BatchBar count={selOrders.size} onClear={()=>setSelOrders(new Set())}>
    <BatchBtn onClick={batchApprovalNotifyOrders} bg="#7C3AED" icon={Send}>Order Approval & Notify</BatchBtn>
    <BatchBtn onClick={()=>batchStatusOrders('Received')} bg="#059669" icon={CheckCircle}>Received</BatchBtn>
    <BatchBtn onClick={()=>batchStatusOrders('Back Order')} bg="#D97706" icon={AlertTriangle}>Back Order</BatchBtn>
    <BatchBtn onClick={batchDeleteOrders} bg="#DC2626" icon={Trash2}>Delete</BatchBtn>
  </BatchBar>}
  <div className="card" style={{overflow:'hidden'}}><div className="table-wrap" style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
    <thead><tr style={{background:'#F8FAFB'}}>{hasPermission('deleteOrders')&&<th className="th" style={{width:36}}><SelBox checked={selOrders.size===filteredOrders.length&&filteredOrders.length>0} onChange={()=>toggleAll(selOrders,setSelOrders,filteredOrders.map(o=>o.id))}/></th>}{['Material No.','Description','Qty','Price','Total','Ordered','By','Status','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
    <tbody>{filteredOrders.map((o,i)=>(
      <tr key={o.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:selOrders.has(o.id)?'#E6F4ED':i%2===0?'#fff':'#FCFCFD',cursor:'pointer'}} onClick={()=>openOrderInNewTab(o)}>
        {hasPermission('deleteOrders')&&<td className="td" onClick={e=>e.stopPropagation()}><SelBox checked={selOrders.has(o.id)} onChange={()=>toggleSel(selOrders,setSelOrders,o.id)}/></td>}
        <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:500}}>{o.materialNo||'—'}</td>
        <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center'}}>{o.quantity}</td>
        <td className="td mono" style={{fontSize:11}}>{o.listPrice>0?fmt(o.listPrice):'—'}</td>
        <td className="td mono" style={{fontSize:11,fontWeight:600}}>{o.totalCost>0?fmt(o.totalCost):'—'}</td>
        <td className="td" style={{color:'#94A3B8',fontSize:11}}>{fmtDate(o.orderDate)}</td>
        <td className="td" style={{fontSize:11}}>{o.orderBy||'—'}</td>
        <td className="td"><Badge status={o.status}/></td>
        <td className="td">
          <div style={{display:'flex',gap:4}}>
            {(hasPermission('editAllOrders')||o.orderBy===currentUser?.name)&&<button onClick={(e)=>{e.stopPropagation();setEditingOrder({...o});}} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Edit3 size={11}/> Edit</button>}
            <button onClick={(e)=>{e.stopPropagation();handleDuplicateOrder(o);}} style={{background:'#7C3AED',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Copy size={11}/></button>
            {hasPermission('deleteOrders')&&<button onClick={(e)=>{e.stopPropagation();if(window.confirm(`Delete order ${o.id}?`)){const remaining=orders.filter(x=>x.id!==o.id);setOrders(remaining);dbSync(api.deleteOrder(o.id),'Order delete not saved');if(o.bulkGroupId)recalcBulkGroupForMonths([o.bulkGroupId],remaining);notify('Deleted',o.id,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Trash2 size={11}/></button>}
          </div>
        </td>
      </tr>))}</tbody>
  </table></div>
  <div style={{padding:'12px 16px',borderTop:'1px solid #F0F2F5',display:'flex',justifyContent:'space-between',background:'#FCFCFD'}}><span style={{fontSize:12,color:'#94A3B8'}}>{filteredOrders.length}/{orders.length}{selOrders.size>0&&` • ${selOrders.size} selected`}</span><span style={{fontSize:12,fontWeight:500}}>{fmt(filteredOrders.reduce((s,o)=>s+o.totalCost,0))}</span></div></div>
</div>)}

{/* ═══════════ BULK ORDERS ═══════════ */}
{page==='bulkorders'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B'}}>Create and manage monthly grouped bulk orders for easier tracking</p>
    <div style={{display:'flex',gap:8}}>
      <ExportDropdown data={bulkGroups} columns={[{key:'id',label:'Batch ID'},{key:'month',label:'Month'},{key:'createdBy',label:'Created By'},{key:'items',label:'Items'},{key:'totalCost',label:'Total Cost',fmt:v=>v>0?fmt(v):''},{key:'status',label:'Status'},{key:'date',label:'Date',fmt:v=>fmtDate(v)}]} filename="bulk-orders" title="Bulk Orders Export"/>
      <button className="bp" onClick={()=>setShowBulkOrder(true)}><FolderPlus size={14}/> Create Bulk Order</button>
    </div>
  </div>
  <div className="grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
    {[{l:'Total Batches',v:bulkGroups.length,i:Layers,c:'#4338CA'},{l:'Total Items',v:bulkGroups.reduce((s,g)=>s+g.items,0),i:Package,c:'#0B7A3E'},{l:'Total Value',v:fmt(bulkGroups.reduce((s,g)=>s+g.totalCost,0)),i:DollarSign,c:'#2563EB'}].map((s,i)=>(
      <div key={i} className="card" style={{padding:'18px 22px'}}><div style={{display:'flex',justifyContent:'space-between'}}><div><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div><div style={{padding:10,background:`${s.c}10`,borderRadius:10}}><s.i size={20} color={s.c}/></div></div></div>
    ))}
  </div>
  {hasPermission('deleteBulkOrders') && <BatchBar count={selBulk.size} onClear={()=>setSelBulk(new Set())}>
    <BatchBtn onClick={batchApprovalNotifyBulk} bg="#7C3AED" icon={Send}>Order Approval & Notify</BatchBtn>
    <BatchBtn onClick={()=>batchStatusBulk('Approved')} bg="#2563EB" icon={Shield}>Approved</BatchBtn>
    <BatchBtn onClick={batchDeleteBulk} bg="#DC2626" icon={Trash2}>Delete</BatchBtn>
  </BatchBar>}
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',fontWeight:600,fontSize:14}}>Monthly Bulk Order Batches</div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{hasPermission('deleteBulkOrders')&&<th className="th" style={{width:36}}><SelBox checked={selBulk.size===bulkGroups.length&&bulkGroups.length>0} onChange={()=>toggleAll(selBulk,setSelBulk,bulkGroups.map(g=>g.id))}/></th>}{['Batch ID','Month','Created By','Items','Total Cost','Status','Date','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{bulkGroups.map(g=>(
        <tr key={g.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:selBulk.has(g.id)?'#EDE9FE':'#fff'}}>
          {hasPermission('deleteBulkOrders')&&<td className="td"><SelBox checked={selBulk.has(g.id)} onChange={()=>toggleSel(selBulk,setSelBulk,g.id)}/></td>}
          <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#4338CA'}}>{g.id}</td>
          <td className="td" style={{fontWeight:600}}><Pill bg="#E6F4ED" color="#0B7A3E"><Calendar size={11}/> {g.month}</Pill></td>
          <td className="td">{g.createdBy}</td>
          <td className="td" style={{fontWeight:600,textAlign:'center'}}>{g.items}</td>
          <td className="td mono" style={{fontWeight:600,fontSize:11}}>{fmt(g.totalCost)}</td>
          <td className="td"><Pill bg={g.status==='Completed'?'#E6F4ED':g.status==='Approved'?'#D1FAE5':g.status==='Rejected'?'#FEE2E2':'#FEF3C7'} color={g.status==='Completed'?'#0B7A3E':g.status==='Approved'?'#059669':g.status==='Rejected'?'#DC2626':'#D97706'}>{g.status}</Pill></td>
          <td className="td" style={{color:'#94A3B8',fontSize:11}}>{fmtDate(g.date)}</td>
          <td className="td">
            <div style={{display:'flex',gap:6}}>
              {(hasPermission('editAllBulkOrders')||g.createdBy===currentUser?.name)&&<button onClick={()=>setSelectedBulkGroup({...g})} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Edit3 size={11}/> Edit</button>}
              <button onClick={()=>setExpandedMonth(expandedMonth===g.month?null:g.month)} style={{background:expandedMonth===g.month?'#064E3B':'#0B7A3E',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Eye size={11}/> {expandedMonth===g.month?'Hide':'View'}</button>
              {hasPermission('deleteBulkOrders')&&<button onClick={()=>{if(window.confirm(`Delete bulk group ${g.id} and its linked orders?`)){const orphaned=orders.filter(o=>o.bulkGroupId===g.id);if(orphaned.length){setOrders(prev=>prev.filter(o=>o.bulkGroupId!==g.id));orphaned.forEach(o=>dbSync(api.deleteOrder(o.id),'Orphaned order delete'));}setBulkGroups(prev=>prev.filter(x=>x.id!==g.id));dbSync(api.deleteBulkGroup(g.id),'Bulk group delete not saved');notify('Deleted',`${g.id} + ${orphaned.length} orders`,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Trash2 size={11}/></button>}
            </div>
          </td>
        </tr>))}</tbody>
    </table>
  </div>
  {/* Orders grouped by month batch */}
  <div className="card" style={{padding:'20px 24px',marginTop:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Orders by Month Batch <span style={{fontWeight:400,fontSize:12,color:'#64748B'}}>(Click to view orders)</span></h3>
    <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
      {[...new Set(orders.filter(o=>o.bulkGroupId).map(o=>o.month))].slice(0,16).map(month=>{
        const mo = orders.filter(o=>o.bulkGroupId&&o.month===month);
        const createdByUsers = [...new Set(mo.map(o=>o.orderBy).filter(Boolean))];
        return <div key={month} onClick={()=>setExpandedMonth(expandedMonth===month?null:month)} style={{padding:14,borderRadius:10,background:expandedMonth===month?'#E6F4ED':'#F8FAFB',border:expandedMonth===month?'2px solid #0B7A3E':'1px solid #E8ECF0',cursor:'pointer',transition:'all 0.2s'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:'#0B7A3E',display:'flex',alignItems:'center',gap:6}}><Calendar size={12}/> {month}</div>
          <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11}}>
            <div>Orders: <strong>{mo.length}</strong></div>
            <div>Qty: <strong>{mo.reduce((s,o)=>s+o.quantity,0)}</strong></div>
            <div style={{gridColumn:'span 2'}}>Cost: <strong className="mono">{fmt(mo.reduce((s,o)=>s+o.totalCost,0))}</strong></div>
            {createdByUsers.length>0&&<div style={{gridColumn:'span 2',marginTop:4,fontSize:10,color:'#64748B'}}>By: {createdByUsers.join(', ')}</div>}
          </div>
        </div>;
      })}
    </div>
  </div>

  {/* Expanded Month Orders View */}
  {expandedMonth&&(
    <div className="card" style={{padding:'20px 24px',marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h3 style={{fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:8}}><Calendar size={16} color="#0B7A3E"/> Orders for: {expandedMonth}</h3>
        <button onClick={()=>setExpandedMonth(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18} color="#64748B"/></button>
      </div>
      {hasPermission('deleteOrders')&&(()=>{ const monthOrders = orders.filter(o=>o.bulkGroupId&&(o.month===expandedMonth||o.month===expandedMonth.replace(/ /g,'_')||o.month.replace(/_/g,' ')===expandedMonth)); const monthIds = monthOrders.filter(o=>selOrders.has(o.id)); return monthIds.length>0 ? <BatchBar count={monthIds.length} onClear={()=>setSelOrders(prev=>{const n=new Set(prev);monthOrders.forEach(o=>n.delete(o.id));return n;})}>
        <BatchBtn onClick={batchApprovalNotifyOrders} bg="#7C3AED" icon={Send}>Order Approval & Notify</BatchBtn>
        <BatchBtn onClick={()=>batchStatusOrders('Received')} bg="#059669" icon={CheckCircle}>Received</BatchBtn>
        <BatchBtn onClick={()=>batchStatusOrders('Back Order')} bg="#D97706" icon={AlertTriangle}>Back Order</BatchBtn>
        <BatchBtn onClick={batchDeleteOrders} bg="#DC2626" icon={Trash2}>Delete</BatchBtn>
      </BatchBar> : null; })()}
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{background:'#F8FAFB'}}>{hasPermission('deleteOrders')&&<th className="th" style={{width:36}}>{(()=>{const mo=orders.filter(o=>o.bulkGroupId&&(o.month===expandedMonth||o.month===expandedMonth.replace(/ /g,'_')||o.month.replace(/_/g,' ')===expandedMonth));return <SelBox checked={mo.length>0&&mo.every(o=>selOrders.has(o.id))} onChange={()=>{const mo2=orders.filter(o=>o.bulkGroupId&&(o.month===expandedMonth||o.month===expandedMonth.replace(/ /g,'_')||o.month.replace(/_/g,' ')===expandedMonth));const ids=mo2.map(o=>o.id);setSelOrders(prev=>{const n=new Set(prev);const allSel=ids.every(id=>prev.has(id));ids.forEach(id=>allSel?n.delete(id):n.add(id));return n;});}}/>;})()}</th>}{['Order ID','Material No','Description','Qty','Ordered By','Order Date','Status','Total Cost','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody>{orders.filter(o=>o.bulkGroupId&&(o.month===expandedMonth||o.month===expandedMonth.replace(/ /g,'_')||o.month.replace(/_/g,' ')===expandedMonth)).map(o=>(
          <tr key={o.id} className="tr" onClick={()=>openOrderInNewTab(o)} style={{borderBottom:'1px solid #F7FAFC',cursor:'pointer',background:selOrders.has(o.id)?'#E6F4ED':'#fff'}}>
            {hasPermission('deleteOrders')&&<td className="td" onClick={e=>e.stopPropagation()}><SelBox checked={selOrders.has(o.id)} onChange={()=>toggleSel(selOrders,setSelOrders,o.id)}/></td>}
            <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#4338CA'}}>{o.id}</td>
            <td className="td mono" style={{fontSize:10}}>{o.materialNo||'—'}</td>
            <td className="td" style={{fontSize:11,maxWidth:200}}>{o.description}</td>
            <td className="td" style={{fontWeight:600,textAlign:'center'}}>{o.quantity}</td>
            <td className="td"><Pill bg="#DBEAFE" color="#2563EB"><User size={10}/> {o.orderBy||'—'}</Pill></td>
            <td className="td" style={{color:'#64748B',fontSize:11}}>{fmtDate(o.orderDate)}</td>
            <td className="td"><Pill bg={o.status==='Received'?'#E6F4ED':o.status==='Back Order'?'#FEF3C7':'#FEE2E2'} color={o.status==='Received'?'#0B7A3E':o.status==='Back Order'?'#D97706':'#DC2626'}>{o.status}</Pill></td>
            <td className="td mono" style={{fontWeight:600,fontSize:11}}>{fmt(o.totalCost)}</td>
            <td className="td">
              <div style={{display:'flex',gap:4}}>
              {(hasPermission('editAllOrders')||o.orderBy===currentUser?.name)&&<button onClick={(e)=>{e.stopPropagation();setEditingOrder({...o});}} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Edit3 size={11}/> Edit</button>}
              <button onClick={(e)=>{e.stopPropagation();handleDuplicateOrder(o);}} style={{background:'#7C3AED',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Copy size={11}/></button>
              {hasPermission('deleteOrders')&&<button onClick={(e)=>{e.stopPropagation();if(window.confirm(`Delete ${o.id}?`)){const remaining=orders.filter(x=>x.id!==o.id);setOrders(remaining);dbSync(api.deleteOrder(o.id),'Order delete not saved');if(o.bulkGroupId)recalcBulkGroupForMonths([o.bulkGroupId],remaining);notify('Deleted',o.id,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer'}}><Trash2 size={11}/></button>}
              </div>
            </td>
          </tr>))}</tbody>
      </table>
      <div style={{marginTop:12,padding:12,background:'#F8FAFB',borderRadius:8,fontSize:12}}>
        <strong>Summary:</strong> {orders.filter(o=>o.bulkGroupId&&(o.month===expandedMonth||o.month===expandedMonth.replace(/ /g,'_')||o.month.replace(/_/g,' ')===expandedMonth)).length} orders |
        Total Qty: {orders.filter(o=>o.bulkGroupId&&(o.month===expandedMonth||o.month===expandedMonth.replace(/ /g,'_')||o.month.replace(/_/g,' ')===expandedMonth)).reduce((s,o)=>s+o.quantity,0)} |
        Total Cost: <strong className="mono">{fmt(orders.filter(o=>o.bulkGroupId&&(o.month===expandedMonth||o.month===expandedMonth.replace(/ /g,'_')||o.month.replace(/_/g,' ')===expandedMonth)).reduce((s,o)=>s+o.totalCost,0))}</strong>
      </div>
    </div>
  )}
</div>)}

{/* ═══════════ ANALYTICS ═══════════ */}
{page==='analytics'&&(<div>
  {/* Summary Cards */}
  <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
    {[
      {l:'Total Orders',v:fmtNum(stats.total),c:'#0B7A3E',bg:'linear-gradient(135deg,#006837,#0B9A4E)',i:Package},
      {l:'Total Spend',v:fmt(stats.totalCost),c:'#2563EB',bg:'linear-gradient(135deg,#1E40AF,#3B82F6)',i:DollarSign},
      {l:'Avg Lead Time',v:leadTimeData.length>0?`${Math.round(leadTimeData.reduce((s,d)=>s+d.avgDays,0)/leadTimeData.length)}d`:'—',c:'#D97706',bg:'linear-gradient(135deg,#92400E,#D97706)',i:Clock},
      {l:'Fulfillment Rate',v:`${stats.fulfillmentRate}%`,c:'#7C3AED',bg:'linear-gradient(135deg,#5B21B6,#7C3AED)',i:TrendingUp}
    ].map((s,i)=>(
      <div key={i} style={{background:s.bg,borderRadius:12,padding:'20px 22px',color:'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div><div style={{fontSize:11,opacity:.8,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>{s.l}</div><div className="mono" style={{fontSize:24,fontWeight:700}}>{s.v}</div></div>
          <div style={{padding:8,background:'rgba(255,255,255,0.15)',borderRadius:8}}><s.i size={18}/></div>
        </div>
      </div>
    ))}
  </div>

  {/* Row 1: Monthly Spend + Order Volume */}
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Monthly Spend</h3><ResponsiveContainer width="100%" height={270}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)} contentStyle={{borderRadius:10,border:'none',fontSize:12}}/><Bar dataKey="cost" radius={[6,6,0,0]} barSize={22}>{monthlyData.map((_,i)=><Cell key={i} fill={i===monthlyData.length-1?'#00A550':'#0B7A3E'}/>)}</Bar></BarChart></ResponsiveContainer></div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Order Volume vs Received</h3><ResponsiveContainer width="100%" height={270}><LineChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="orders" stroke="#0B7A3E" strokeWidth={2.5} dot={{r:4}} name="Orders"/><Line type="monotone" dataKey="received" stroke="#2563EB" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}} name="Received"/></LineChart></ResponsiveContainer></div>
  </div>

  {/* Row 2: Status Distribution + Top 10 Materials */}
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Status Distribution by Month</h3>
      {statusTrendData.length>0?<ResponsiveContainer width="100%" height={270}><BarChart data={statusTrendData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="Received" stackId="a" fill="#0B7A3E" radius={[0,0,0,0]}/><Bar dataKey="Approved" stackId="a" fill="#059669"/><Bar dataKey="Pending Approval" stackId="a" fill="#7C3AED"/><Bar dataKey="Back Order" stackId="a" fill="#DC2626"/><Bar dataKey="Rejected" stackId="a" fill="#F87171" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<div style={{height:270,display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontSize:13}}>No data available</div>}
    </div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Top 10 Ordered Materials</h3>
      {materialFrequency.length>0?<ResponsiveContainer width="100%" height={270}><BarChart data={materialFrequency} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis type="number" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis dataKey="name" type="category" width={120} tick={{fontSize:10,fill:'#64748B'}} axisLine={false} tickLine={false}/><Tooltip formatter={(v,n)=>n==='cost'?fmt(v):v}/><Bar dataKey="orderCount" fill="#2563EB" radius={[0,4,4,0]} barSize={16} name="Orders"/></BarChart></ResponsiveContainer>:<div style={{height:270,display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontSize:13}}>No data available</div>}
    </div>
  </div>

  {/* Row 3: Lead Time Trend + Category Spend */}
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Average Lead Time (Days)</h3>
      {leadTimeData.length>0?<ResponsiveContainer width="100%" height={270}><AreaChart data={leadTimeData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false} unit="d"/><Tooltip formatter={v=>`${v} days`}/><Area type="monotone" dataKey="avgDays" stroke="#D97706" fill="#FEF3C7" strokeWidth={2.5} name="Avg Days"/></AreaChart></ResponsiveContainer>:<div style={{height:270,display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontSize:13}}>No lead time data — requires orders with both order date and arrival date</div>}
    </div>
    <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Spend by Category</h3>
      {categorySpendData.length>0?<ResponsiveContainer width="100%" height={270}><PieChart><Pie data={categorySpendData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>{categorySpendData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer>:<div style={{height:270,display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontSize:13}}>No category data available</div>}
      {categorySpendData.length>0&&<div style={{display:'flex',justifyContent:'center',gap:10,marginTop:4,flexWrap:'wrap'}}>{categorySpendData.slice(0,6).map((s,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#64748B'}}><div style={{width:8,height:8,borderRadius:'50%',background:s.color}}/>{s.name}</div>)}</div>}
    </div>
  </div>

  {/* Row 4: Engineer Activity */}
  <div className="card" style={{padding:'20px 24px'}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Engineer Activity</h3><div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>{[...new Set(orders.flatMap(o=>[o.orderBy,o.engineer]).filter(Boolean))].map(eng=>{const eo=orders.filter(o=>o.orderBy===eng||o.engineer===eng);return(<div key={eng} style={{padding:16,borderRadius:12,background:'#F8FAFB'}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700}}>{eng.split(' ').map(w=>w[0]).join('')}</div><div><div style={{fontWeight:600,fontSize:14}}>{eng}</div><div style={{fontSize:11,color:'#94A3B8'}}>User</div></div></div><div className="grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}><div><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Orders</div><div className="mono" style={{fontSize:18,fontWeight:700}}>{eo.length}</div></div><div><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Checked</div><div className="mono" style={{fontSize:18,fontWeight:700,color:'#0B7A3E'}}>{eo.filter(o=>o.engineer===eng).length}</div></div><div><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase'}}>Value</div><div className="mono" style={{fontSize:14,fontWeight:700}}>{fmt(eo.reduce((s,o)=>s+o.totalCost,0))}</div></div></div></div>);})}</div></div>
</div>)}

{/* ═══════════ FORECASTING ═══════════ */}
{page==='forecasting'&&hasPermission('analytics')&&(()=>{
  // Build material history: { materialNo → { months: [{name, qty}], totalQty, description } }
  const materialHistory = {};
  const monthOrder = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  orders.forEach(o => {
    if (!o.materialNo) return;
    if (!materialHistory[o.materialNo]) materialHistory[o.materialNo] = { materialNo: o.materialNo, description: o.description, monthMap: {}, totalQty: 0, totalCost: 0, orderCount: 0 };
    const h = materialHistory[o.materialNo];
    h.totalQty += (Number(o.quantity)||0);
    h.totalCost += (Number(o.totalCost)||0);
    h.orderCount++;
    if (o.month) {
      const norm = o.month.replace(/^\d+_/,'').replace(/_/g,' ');
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0,3)} '${parts[1].slice(2)}` : norm;
      if (!h.monthMap[shortLabel]) h.monthMap[shortLabel] = { name: shortLabel, qty: 0, _sortKey: norm };
      h.monthMap[shortLabel].qty += (Number(o.quantity)||0);
    }
  });
  const allMaterials = Object.values(materialHistory).sort((a,b) => b.orderCount - a.orderCount);
  const selectedMat = forecastMaterial || (allMaterials[0]?.materialNo || '');
  const matData = materialHistory[selectedMat];
  const matMonthly = matData ? Object.values(matData.monthMap).sort((a,b) => {
    const [am,ay] = a._sortKey.toLowerCase().split(' ');
    const [bm,by] = b._sortKey.toLowerCase().split(' ');
    return (parseInt(ay)||0) - (parseInt(by)||0) || (monthOrder[am?.slice(0,3)]||0) - (monthOrder[bm?.slice(0,3)]||0);
  }) : [];

  // Weighted moving average forecast
  const forecastMonths = [];
  if (matMonthly.length >= 2) {
    const vals = matMonthly.map(m => m.qty);
    const machineGrowth = machines.length > 0 ? 1 + (machines.filter(m=>m.status==='Active').length * 0.02) : 1;
    const futureMonths = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
    for (let i = 0; i < 6; i++) {
      const n = vals.length + i;
      const recent = [...vals, ...forecastMonths.map(f=>f.qty)];
      const w1 = recent[recent.length - 1] || 0;
      const w2 = recent[recent.length - 2] || w1;
      const w3 = recent[recent.length - 3] || w2;
      const predicted = Math.round((0.5 * w1 + 0.3 * w2 + 0.2 * w3) * machineGrowth);
      const monthIdx = (new Date().getMonth() + i + 1) % 12;
      forecastMonths.push({ name: `${futureMonths[monthIdx]} '26`, qty: predicted, forecast: true });
    }
  }
  const chartData = [...matMonthly.map(m=>({...m, forecast: false})), ...forecastMonths];

  // Summary forecast for all materials
  const forecastSummary = allMaterials.slice(0, 20).map(mat => {
    const vals = Object.values(mat.monthMap).sort((a,b) => {
      const [am,ay] = a._sortKey.toLowerCase().split(' ');
      const [bm,by] = b._sortKey.toLowerCase().split(' ');
      return (parseInt(ay)||0) - (parseInt(by)||0) || (monthOrder[am?.slice(0,3)]||0) - (monthOrder[bm?.slice(0,3)]||0);
    }).map(m => m.qty);
    const avg = vals.length > 0 ? Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) : 0;
    const lastVal = vals[vals.length - 1] || 0;
    const prevVal = vals[vals.length - 2] || lastVal;
    const trend = lastVal > prevVal ? 'up' : lastVal < prevVal ? 'down' : 'stable';
    const w1 = vals[vals.length-1]||0, w2 = vals[vals.length-2]||w1, w3 = vals[vals.length-3]||w2;
    const predicted = Math.round(0.5*w1 + 0.3*w2 + 0.2*w3);
    const variance = vals.length >= 3 ? Math.sqrt(vals.slice(-3).reduce((s,v)=>s+Math.pow(v-avg,2),0)/3) : 999;
    const confidence = variance < avg * 0.3 ? 'High' : variance < avg * 0.7 ? 'Medium' : 'Low';
    return { ...mat, avgMonthly: avg, trend, predicted, confidence, monthCount: vals.length };
  });

  // Modality stats
  const modalityCounts = {};
  machines.forEach(m => { if (m.status === 'Active') modalityCounts[m.modality] = (modalityCounts[m.modality]||0)+1; });

  return (<div>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
      <div style={{padding:10,background:'linear-gradient(135deg,#D97706,#F59E0B)',borderRadius:12}}><TrendingUp size={22} color="#fff"/></div>
      <div><h2 style={{fontSize:18,fontWeight:700,margin:0}}>Material Forecasting</h2><p style={{fontSize:12,color:'#94A3B8',margin:0}}>Predict future material needs based on historical data and machine fleet</p></div>
    </div>

    {/* Tabs */}
    <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'2px solid #E8ECF0',paddingBottom:2}}>
      {[{id:'forecast',label:'Forecast Dashboard',icon:TrendingUp},{id:'machines',label:'Machine Fleet',icon:Settings},{id:'summary',label:'All Materials Forecast',icon:ClipboardList}].map(tab=>(
        <button key={tab.id} onClick={()=>setForecastTab(tab.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',border:'none',background:forecastTab===tab.id?'#FEF3C7':'transparent',color:forecastTab===tab.id?'#92400E':'#64748B',fontWeight:600,fontSize:13,borderRadius:'8px 8px 0 0',cursor:'pointer',fontFamily:'inherit',borderBottom:forecastTab===tab.id?'2px solid #D97706':'2px solid transparent',marginBottom:-2}}><tab.icon size={15}/> {tab.label}</button>
      ))}
    </div>

    {/* Forecast Dashboard */}
    {forecastTab==='forecast'&&(<div>
      <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Unique Materials',v:allMaterials.length,c:'#D97706'},
          {l:'Active Machines',v:machines.filter(m=>m.status==='Active').length,c:'#0B7A3E'},
          {l:'Modalities',v:Object.keys(modalityCounts).length,c:'#2563EB'},
          {l:'Data Months',v:matMonthly.length,c:'#7C3AED'}
        ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
      </div>

      <div className="card" style={{padding:'20px 24px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:0}}>Material Forecast</h3>
          <select value={selectedMat} onChange={e=>{setForecastMaterial(e.target.value);}} style={{padding:'8px 14px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12,fontFamily:'inherit',minWidth:250}}>
            {allMaterials.map(m=><option key={m.materialNo} value={m.materialNo}>{m.materialNo} — {(m.description||'').slice(0,40)}</option>)}
          </select>
        </div>
        {matData && <div style={{marginBottom:12,padding:'12px 16px',background:'#FEF3C7',borderRadius:10,fontSize:12}}>
          <strong>{matData.description}</strong> — Total ordered: {matData.totalQty} units across {matData.orderCount} orders ({fmt(matData.totalCost)} total)
          {forecastMonths.length>0&&<span style={{marginLeft:8,color:'#92400E'}}> | Next month forecast: <strong>{forecastMonths[0]?.qty} units</strong></span>}
        </div>}
        {chartData.length>0?<ResponsiveContainer width="100%" height={300}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="qty" stroke="#D97706" strokeWidth={2.5} dot={(props)=>{const{cx,cy,payload}=props;return payload.forecast?<circle cx={cx} cy={cy} r={5} fill="#fff" stroke="#DC2626" strokeWidth={2} strokeDasharray="3 3"/>:<circle cx={cx} cy={cy} r={4} fill="#D97706"/>;}} name="Quantity"/></LineChart></ResponsiveContainer>:<div style={{height:300,display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8'}}>Select a material to view forecast</div>}
        <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:8,fontSize:11,color:'#64748B'}}>
          <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:'50%',background:'#D97706'}}/> Historical</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:'50%',border:'2px dashed #DC2626',background:'#fff'}}/> Forecast</span>
        </div>
      </div>

      {/* Machine Modality Correlation */}
      {machines.length>0&&Object.keys(modalityCounts).length>0&&(
        <div className="card" style={{padding:'20px 24px'}}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Machine Fleet Overview</h3>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            {Object.entries(modalityCounts).map(([mod,cnt])=>(
              <div key={mod} style={{padding:'12px 18px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:10,minWidth:120}}>
                <div style={{fontSize:11,color:'#64748B',textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{mod}</div>
                <div className="mono" style={{fontSize:22,fontWeight:700,color:'#0B7A3E'}}>{cnt}</div>
                <div style={{fontSize:10,color:'#94A3B8'}}>active machines</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>)}

    {/* Machine Fleet Management */}
    {forecastTab==='machines'&&(<div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
        <p style={{fontSize:13,color:'#64748B',margin:0}}>Manage your local machine fleet. Machine count affects forecast predictions.</p>
        <button className="bp" onClick={()=>setShowAddMachine(true)}><Plus size={14}/> Add Machine</button>
      </div>

      <div className="grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        {[{l:'Total Machines',v:machines.length,c:'#0B7A3E'},{l:'Active',v:machines.filter(m=>m.status==='Active').length,c:'#2563EB'},{l:'Modalities',v:Object.keys(modalityCounts).length,c:'#7C3AED'}].map((s,i)=>(
          <div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>
        ))}
      </div>

      {showAddMachine&&(
        <div className="card" style={{padding:'20px 24px',marginBottom:16,border:'2px solid #D97706'}}>
          <h4 style={{fontSize:14,fontWeight:600,marginBottom:12}}>Add New Machine</h4>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Machine Name *</label><input value={newMachine.name} onChange={e=>setNewMachine(p=>({...p,name:e.target.value}))} placeholder="e.g. MACSQuant Analyzer 16" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Modality *</label><input value={newMachine.modality} onChange={e=>setNewMachine(p=>({...p,modality:e.target.value}))} placeholder="e.g. Cell Analysis, Cell Sorting" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Location</label><input value={newMachine.location} onChange={e=>setNewMachine(p=>({...p,location:e.target.value}))} placeholder="e.g. Lab A, Singapore" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Install Date</label><input type="date" value={newMachine.installDate} onChange={e=>setNewMachine(p=>({...p,installDate:e.target.value}))} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Status</label><select value={newMachine.status} onChange={e=>setNewMachine(p=>({...p,status:e.target.value}))} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}><option>Active</option><option>Inactive</option><option>Decommissioned</option></select></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Notes</label><input value={newMachine.notes} onChange={e=>setNewMachine(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button className="bp" onClick={()=>{
              if(!newMachine.name||!newMachine.modality){notify('Missing Fields','Name and Modality are required','warning');return;}
              const m = {...newMachine};
              dbSync(api.createMachine(m).then(saved=>{if(saved){setMachines(prev=>[saved,...prev]);logAction('create','machine',String(saved.id),{name:m.name,modality:m.modality});}}),'Machine not saved');
              setNewMachine({name:'',modality:'',location:'',installDate:'',status:'Active',notes:''});
              setShowAddMachine(false);
              notify('Machine Added',`${m.name} (${m.modality})`,'success');
            }}><Check size={14}/> Save Machine</button>
            <button className="bs" onClick={()=>setShowAddMachine(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'#F8FAFB'}}>{['Name','Modality','Location','Install Date','Status','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{machines.length===0?<tr><td colSpan={6} style={{padding:24,textAlign:'center',color:'#94A3B8',fontSize:13}}>No machines added yet. Add machines to improve forecast accuracy.</td></tr>:machines.map(m=>(
            <tr key={m.id} className="tr" style={{borderBottom:'1px solid #F7FAFC'}}>
              <td className="td" style={{fontWeight:600}}>{m.name}</td>
              <td className="td"><Pill bg="#EDE9FE" color="#7C3AED">{m.modality}</Pill></td>
              <td className="td" style={{color:'#64748B'}}>{m.location||'—'}</td>
              <td className="td" style={{fontSize:11,color:'#94A3B8'}}>{m.installDate?fmtDate(m.installDate):'—'}</td>
              <td className="td"><Pill bg={m.status==='Active'?'#D1FAE5':m.status==='Inactive'?'#FEF3C7':'#F3F4F6'} color={m.status==='Active'?'#059669':m.status==='Inactive'?'#D97706':'#64748B'}>{m.status}</Pill></td>
              <td className="td"><button onClick={()=>{if(window.confirm(`Delete machine "${m.name}"?`)){setMachines(prev=>prev.filter(x=>x.id!==m.id));dbSync(api.deleteMachine(m.id),'Machine delete failed');logAction('delete','machine',String(m.id),{name:m.name});notify('Deleted',m.name,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Trash2 size={11}/> Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>)}

    {/* All Materials Forecast Summary */}
    {forecastTab==='summary'&&(<div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <p style={{fontSize:13,color:'#64748B',margin:0}}>Predicted material needs for next month based on historical trends</p>
        <ExportDropdown data={forecastSummary} columns={[{key:'materialNo',label:'Material No'},{key:'description',label:'Description'},{key:'orderCount',label:'Orders'},{key:'totalQty',label:'Total Qty'},{key:'avgMonthly',label:'Avg Monthly'},{key:'predicted',label:'Predicted Next'},{key:'trend',label:'Trend'},{key:'confidence',label:'Confidence'}]} filename="forecast-summary" title="Material Forecast Summary"/>
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{maxHeight:600,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead><tr style={{background:'#F8FAFB',position:'sticky',top:0,zIndex:1}}>{['Material No','Description','Total Orders','Total Qty','Avg Monthly','Trend','Predicted Next Month','Confidence'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{forecastSummary.length===0?<tr><td colSpan={8} style={{padding:24,textAlign:'center',color:'#94A3B8',fontSize:13}}>No order history available for forecasting</td></tr>:forecastSummary.map((m,i)=>(
              <tr key={m.materialNo} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD',cursor:'pointer'}} onClick={()=>{setForecastMaterial(m.materialNo);setForecastTab('forecast');}}>
                <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#0B7A3E'}}>{m.materialNo}</td>
                <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.description}</td>
                <td className="td" style={{textAlign:'center',fontWeight:600}}>{m.orderCount}</td>
                <td className="td" style={{textAlign:'center'}}>{m.totalQty}</td>
                <td className="td" style={{textAlign:'center'}}>{m.avgMonthly}</td>
                <td className="td" style={{textAlign:'center'}}>{m.trend==='up'?<span style={{color:'#DC2626'}}>↑ Up</span>:m.trend==='down'?<span style={{color:'#059669'}}>↓ Down</span>:<span style={{color:'#64748B'}}>→ Stable</span>}</td>
                <td className="td" style={{textAlign:'center'}}><span className="mono" style={{fontWeight:700,fontSize:14,color:'#D97706'}}>{m.predicted}</span></td>
                <td className="td"><Pill bg={m.confidence==='High'?'#D1FAE5':m.confidence==='Medium'?'#FEF3C7':'#FEE2E2'} color={m.confidence==='High'?'#059669':m.confidence==='Medium'?'#D97706':'#DC2626'}>{m.confidence}</Pill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>)}
  </div>);
})()}

{/* ═══════════ STOCK CHECK ═══════════ */}
{page==='stockcheck'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B'}}>Upload stock list file and perform inventory audit</p>
  </div>

  {/* Stats */}
  <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
    {[
      {l:'Total Checks',v:stockChecks.length,c:'#4338CA'},
      {l:'Completed',v:stockChecks.filter(s=>s.status==='Completed').length,c:'#0B7A3E'},
      {l:'In Progress',v:stockChecks.filter(s=>s.status==='In Progress').length,c:'#D97706'},
      {l:'Total Discrepancies',v:stockChecks.reduce((s,c)=>s+c.disc,0),c:'#DC2626'}
    ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
  </div>

  {/* Upload Section - Show when no active check */}
  {!stockCheckMode && (
    <div className="card" style={{padding:'24px',marginBottom:20}}>
      <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Start New Stock Check</h3>
      <p style={{fontSize:12,color:'#64748B',marginBottom:20}}>Upload an Excel (.xlsx) or CSV file with your stock list. File should contain columns: Material No, Description, System Qty</p>

      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* File Upload */}
        <label style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          padding:'40px 24px',border:'2px dashed #D1D5DB',borderRadius:12,
          background:'#F9FAFB',cursor:'pointer',transition:'all 0.2s'
        }}>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e)=>{
            const file = e.target.files[0];
            if(!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
              const text = evt.target.result;
              const lines = text.split('\n').filter(l=>l.trim());
              const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());

              // Find column indices
              const matIdx = headers.findIndex(h=>h.includes('material') || h.includes('part') || h.includes('sku'));
              const descIdx = headers.findIndex(h=>h.includes('desc') || h.includes('name') || h.includes('item'));
              const qtyIdx = headers.findIndex(h=>h.includes('qty') || h.includes('quantity') || h.includes('stock') || h.includes('system'));

              const invList = lines.slice(1).map((line,i) => {
                const cols = line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
                return {
                  id: `INV-${String(i+1).padStart(3,'0')}`,
                  materialNo: matIdx>=0 ? cols[matIdx] : cols[0] || '',
                  description: descIdx>=0 ? cols[descIdx] : cols[1] || '',
                  systemQty: parseInt(qtyIdx>=0 ? cols[qtyIdx] : cols[2]) || 0,
                  physicalQty: 0,
                  checked: false
                };
              }).filter(item => item.materialNo);

              if(invList.length > 0) {
                setStockInventoryList(invList);
                setStockCheckMode(true);
                addStockCheck({
                  id:`SC-${String(stockChecks.length+1).padStart(3,'0')}`,
                  date:new Date().toISOString().slice(0,10),
                  checkedBy:currentUser.name,
                  items:invList.length,
                  disc:0,
                  status:'In Progress',
                  notes:`Uploaded: ${file.name}`,
                  inventory:invList
                });
                notify('File Uploaded',`${invList.length} items loaded for stock check`,'success');
              } else {
                notify('Invalid File','Could not parse items from file','warning');
              }
            };
            reader.readAsText(file);
            e.target.value = '';
          }} style={{display:'none'}}/>
          <Upload size={36} color="#9CA3AF" style={{marginBottom:12}}/>
          <span style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Drop file here or click to upload</span>
          <span style={{fontSize:12,color:'#9CA3AF'}}>CSV or Excel file (.csv, .xlsx)</span>
        </label>

        {/* File Format Guide */}
        <div style={{padding:'20px',background:'#F8FAFB',borderRadius:12}}>
          <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Expected File Format</h4>
          <div style={{fontFamily:'monospace',fontSize:11,background:'#fff',padding:12,borderRadius:8,border:'1px solid #E2E8F0'}}>
            <div style={{color:'#64748B',marginBottom:4}}>Material No, Description, System Qty</div>
            <div>130-095-005, MACSQuant Analyzer, 5</div>
            <div>130-093-235, Pump Head Assembly, 3</div>
            <div>130-042-303, Tubing Set Sterile, 10</div>
          </div>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:12}}>
            Column headers are flexible - the system will detect: material/part/sku, description/name/item, qty/quantity/stock
          </p>
        </div>
      </div>
    </div>
  )}

  {/* Active Stock Check */}
  {stockCheckMode && stockInventoryList.length>0 && (
    <div className="card" style={{padding:'24px',marginBottom:20,border:'2px solid #0B7A3E'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700}}>Active Stock Check</h3>
          <p style={{fontSize:12,color:'#64748B'}}>Enter physical count for each item • {stockInventoryList.filter(i=>i.checked).length}/{stockInventoryList.length} checked</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="bp" onClick={()=>{
            const discrepancies = stockInventoryList.filter(i=>i.checked && i.physicalQty !== i.systemQty).length;
            const scUpdates = {status:'Completed',disc:discrepancies,notes:`Completed by ${currentUser.name}. ${discrepancies} discrepancies found.`};
            setStockChecks(prev=>prev.map((s,idx)=>idx===0?{...s,...scUpdates}:s));
            if(stockChecks[0]) dbSync(api.updateStockCheck(stockChecks[0].id, scUpdates), 'Stock check update not saved');
            setStockCheckMode(false);
            setStockInventoryList([]);
            notify('Stock Check Completed',`${discrepancies} discrepancies found`,'success');
          }}><Check size={14}/> Complete Check</button>
          <button className="bs" onClick={()=>{setStockCheckMode(false);setStockInventoryList([]);setStockChecks(prev=>prev.slice(1));}}><X size={14}/> Cancel</button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{height:8,background:'#E2E8F0',borderRadius:4,marginBottom:20,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${(stockInventoryList.filter(i=>i.checked).length/stockInventoryList.length)*100}%`,background:'linear-gradient(90deg,#006837,#00A550)',borderRadius:4,transition:'width 0.3s'}}/>
      </div>

      <div style={{maxHeight:400,overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'#F8FAFB',zIndex:10}}><tr><th className="th">Material No.</th><th className="th">Description</th><th className="th" style={{width:100}}>System Qty</th><th className="th" style={{width:120}}>Physical Count</th><th className="th" style={{width:100}}>Variance</th><th className="th" style={{width:80}}>Status</th></tr></thead>
          <tbody>
            {stockInventoryList.map((item,idx)=>{
              const variance = item.checked ? item.physicalQty - item.systemQty : null;
              return (
                <tr key={item.id} style={{borderBottom:'1px solid #F0F2F5',background:item.checked?(variance!==0?'#FEF2F2':'#F0FDF4'):'#fff'}}>
                  <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:600}}>{item.materialNo}</td>
                  <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</td>
                  <td className="td" style={{textAlign:'center',fontWeight:600}}>{item.systemQty}</td>
                  <td className="td" style={{textAlign:'center'}}>
                    <input type="number" min="0" value={item.physicalQty||''} placeholder="0" onChange={e=>{
                      const val = parseInt(e.target.value)||0;
                      setStockInventoryList(prev=>prev.map((x,i)=>i===idx?{...x,physicalQty:val,checked:true}:x));
                    }} style={{width:70,padding:'6px 8px',textAlign:'center',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
                  </td>
                  <td className="td" style={{textAlign:'center',fontWeight:700,color:variance===null?'#94A3B8':variance===0?'#059669':variance>0?'#2563EB':'#DC2626'}}>
                    {variance===null?'—':variance===0?'Match':variance>0?`+${variance}`:variance}
                  </td>
                  <td className="td">
                    {item.checked ? (
                      variance===0 ? <Pill bg="#D1FAE5" color="#059669">✓ OK</Pill> : <Pill bg="#FEE2E2" color="#DC2626">Disc.</Pill>
                    ) : <Pill bg="#F3F4F6" color="#9CA3AF">Pending</Pill>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{marginTop:20,padding:16,background:'#F8FAFB',borderRadius:10,display:'flex',justifyContent:'space-between'}}>
        <div><span style={{fontSize:12,color:'#64748B'}}>Checked: </span><strong>{stockInventoryList.filter(i=>i.checked).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Matches: </span><strong style={{color:'#059669'}}>{stockInventoryList.filter(i=>i.checked && i.physicalQty===i.systemQty).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Discrepancies: </span><strong style={{color:'#DC2626'}}>{stockInventoryList.filter(i=>i.checked && i.physicalQty!==i.systemQty).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Pending: </span><strong style={{color:'#D97706'}}>{stockInventoryList.filter(i=>!i.checked).length}</strong></div>
      </div>
    </div>
  )}

  {/* Stock Check History */}
  {hasPermission('deleteStockChecks')&&<BatchBar count={selStockChecks.size} onClear={()=>setSelStockChecks(new Set())}>
    <BatchBtn onClick={batchDeleteStockChecks} bg="#DC2626" icon={Trash2}>Delete Selected</BatchBtn>
  </BatchBar>}
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:14}}>Stock Check History</span>{selStockChecks.size>0&&<span style={{fontSize:11,color:'#DC2626',fontWeight:600}}>{selStockChecks.size} selected</span>}</div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{hasPermission('deleteStockChecks')&&<th className="th" style={{width:36}}><SelBox checked={selStockChecks.size===stockChecks.length&&stockChecks.length>0} onChange={()=>toggleAll(selStockChecks,setSelStockChecks,stockChecks.map(r=>r.id))}/></th>}{['ID','Date','Checked By','Items','Discrepancies','Status','Notes','Action'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{stockChecks.map(r=><tr key={r.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:selStockChecks.has(r.id)?'#FEF3C7':'#fff'}}>
        {hasPermission('deleteStockChecks')&&<td className="td"><SelBox checked={selStockChecks.has(r.id)} onChange={()=>toggleSel(selStockChecks,setSelStockChecks,r.id)}/></td>}
        <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#0B7A3E'}}>{r.id}</td>
        <td className="td">{fmtDate(r.date)}</td>
        <td className="td">{r.checkedBy}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center'}}>{r.items}</td>
        <td className="td" style={{textAlign:'center'}}><Pill bg={r.disc>0?'#FEE2E2':'#D1FAE5'} color={r.disc>0?'#DC2626':'#059669'}>{r.disc}</Pill></td>
        <td className="td"><Pill bg={r.status==='Completed'?'#D1FAE5':'#FEF3C7'} color={r.status==='Completed'?'#059669':'#D97706'}>{r.status}</Pill></td>
        <td className="td" style={{color:'#64748B',fontSize:11,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notes||'—'}</td>
        <td className="td">
          <div style={{display:'flex',gap:4}}>
          {r.status==='Completed' && (
            <button className="bs" style={{padding:'4px 8px',fontSize:11}} onClick={()=>{notify('Report Downloaded',`${r.id} exported`,'success');}}><Download size={12}/></button>
          )}
          {hasPermission('deleteStockChecks')&&<button onClick={()=>{if(window.confirm(`Delete stock check ${r.id}?`)){setStockChecks(prev=>prev.filter(x=>x.id!==r.id));dbSync(api.deleteStockCheck(r.id),'Stock check delete not saved');notify('Deleted',r.id,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer'}}><Trash2 size={11}/></button>}
          </div>
        </td>
      </tr>)}</tbody>
    </table>
  </div>
</div>)}

{/* ═══════════ PART ARRIVAL CHECK ═══════════ */}
{page==='delivery'&&(<div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B'}}>Check and verify material arrivals from single orders and bulk batches</p>
  </div>

  {/* Stats Cards */}
  <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
    {[
      {l:'Awaiting Arrival',v:orders.filter(o=>o.status==='Back Order'||o.status==='Approved').length,c:'#D97706'},
      {l:'Fully Received',v:orders.filter(o=>(o.qtyReceived||0)>=o.quantity&&o.quantity>0).length,c:'#0B7A3E'},
      {l:'Partial Received',v:orders.filter(o=>(o.qtyReceived||0)>0&&(o.qtyReceived||0)<o.quantity).length,c:'#2563EB'},
      {l:'Back Orders',v:orders.filter(o=>o.status==='Back Order').length,c:'#DC2626'}
    ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
  </div>

  {/* Bulk Orders to Check */}
  <div className="card" style={{padding:'20px 24px',marginBottom:20}}>
    <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Bulk Orders - Arrival Verification</h3>
    <div style={{display:'grid',gap:12}}>
      {bulkGroups.map(bg=>{
        const bgOrders = orders.filter(o=>o.bulkGroupId===bg.id);
        const fullyReceived = bgOrders.filter(o=>o.qtyReceived>=o.quantity&&o.quantity>0).length;
        const pending = bgOrders.filter(o=>o.qtyReceived<o.quantity).length;
        const hasBackOrder = bgOrders.some(o=>o.backOrder<0);
        const unapprovedCount = bgOrders.filter(o=>o.approvalStatus!=='approved').length;
        return (
          <div key={bg.id} style={{padding:'16px 20px',border:'1px solid #E2E8F0',borderRadius:12,background:selectedBulkForArrival===bg.id?'#E6F4ED':'#fff'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:fullyReceived===bgOrders.length?'#D1FAE5':hasBackOrder?'#FEE2E2':'#FEF3C7',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {fullyReceived===bgOrders.length?<CheckCircle size={20} color="#059669"/>:hasBackOrder?<AlertCircle size={20} color="#DC2626"/>:<Clock size={20} color="#D97706"/>}
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{bg.month} Bulk Order</div>
                  <div style={{fontSize:12,color:'#64748B'}}>{bg.id} • {bgOrders.length} items • {fmt(bg.totalCost)}</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{textAlign:'right',marginRight:12}}>
                  <div style={{fontSize:11,color:'#94A3B8'}}>Progress</div>
                  <div style={{fontSize:14,fontWeight:700,color:fullyReceived===bgOrders.length?'#059669':'#D97706'}}>{fullyReceived}/{bgOrders.length} received</div>
                </div>
                <button className={selectedBulkForArrival===bg.id?"bp":"bs"} onClick={()=>{setSelectedBulkForArrival(selectedBulkForArrival===bg.id?null:bg.id);setArrivalItems(bgOrders);}} style={{padding:'8px 16px'}}>
                  {selectedBulkForArrival===bg.id?'Hide':'Check Items'}
                </button>
              </div>
            </div>

            {/* Expanded Items List */}
            {selectedBulkForArrival===bg.id && (
              <div style={{marginTop:16,borderTop:'1px solid #E8ECF0',paddingTop:16}}>
                {unapprovedCount > 0 && (
                  <div style={{padding:'10px 16px',background:'#FEF3C7',border:'1px solid #FDE68A',borderRadius:8,marginBottom:12,display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#92400E'}}>
                    <AlertTriangle size={16}/>
                    <span><strong>{unapprovedCount} order(s)</strong> not yet approved — arrival inputs disabled until approved.</span>
                  </div>
                )}
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'#F8FAFB'}}><th className="th" style={{width:30}}><input type="checkbox" checked={bgOrders.filter(o=>o.approvalStatus==='approved'&&o.status!=='Received').every(o=>arrivalSelected.has(o.id))&&bgOrders.some(o=>o.approvalStatus==='approved'&&o.status!=='Received')} onChange={e=>{const ids=bgOrders.filter(o=>o.approvalStatus==='approved'&&o.status!=='Received').map(o=>o.id);setArrivalSelected(prev=>{const next=new Set(prev);if(e.target.checked)ids.forEach(id=>next.add(id));else ids.forEach(id=>next.delete(id));return next;});}}/></th><th className="th">Material No.</th><th className="th">Description</th><th className="th" style={{width:70}}>Ordered</th><th className="th" style={{width:80}}>Received</th><th className="th" style={{width:70}}>B/O</th><th className="th" style={{width:100}}>Status</th><th className="th" style={{width:120}}>Action</th></tr></thead>
                  <tbody>
                    {bgOrders.map((o,idx)=>{
                      const pv = pendingArrival[o.id];
                      const dispQty = pv ? pv.qtyReceived : (o.qtyReceived||0);
                      const dispBO = pv ? pv.qtyReceived - o.quantity : (o.qtyReceived||0) - o.quantity;
                      const hasPending = !!pv;
                      return (
                      <tr key={o.id} style={{borderBottom:'1px solid #F0F2F5',background:hasPending?'#FFFBEB':'transparent'}}>
                        <td className="td"><input type="checkbox" disabled={o.approvalStatus!=='approved'||o.status==='Received'} checked={arrivalSelected.has(o.id)} onChange={e=>{setArrivalSelected(prev=>{const next=new Set(prev);if(e.target.checked)next.add(o.id);else next.delete(o.id);return next;})}}/></td>
                        <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:600}}>{o.materialNo||'—'}</td>
                        <td className="td" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
                        <td className="td" style={{textAlign:'center',fontWeight:600}}>{o.quantity}</td>
                        <td className="td" style={{textAlign:'center'}}>
                          <input type="number" min="0" max={o.quantity} value={dispQty} disabled={o.approvalStatus!=='approved'||o.status==='Received'} title={o.approvalStatus!=='approved'?'Order must be approved first':o.status==='Received'?'Already received':''} onChange={e=>{const val=Math.max(0,Math.min(o.quantity,parseInt(e.target.value)||0));setPendingArrival(prev=>({...prev,[o.id]:{qtyReceived:val,backOrder:val-o.quantity}}));}} style={{width:50,padding:'4px 6px',textAlign:'center',borderRadius:6,border:hasPending?'2px solid #F59E0B':'1px solid #E2E8F0',fontSize:12,opacity:o.approvalStatus!=='approved'||o.status==='Received'?0.5:1,cursor:o.approvalStatus!=='approved'||o.status==='Received'?'not-allowed':'text'}}/>
                        </td>
                        <td className="td" style={{textAlign:'center',fontWeight:600,color:dispBO<0?'#DC2626':'#059669'}}>{dispBO<0?dispBO:'✓'}</td>
                        <td className="td"><Pill bg={o.status==='Received'?'#D1FAE5':o.status==='Back Order'?'#FEE2E2':'#FEF3C7'} color={o.status==='Received'?'#059669':o.status==='Back Order'?'#DC2626':'#D97706'}>{o.status==='Received'?'Received':o.status==='Back Order'?'Back Order':'Approved'}</Pill></td>
                        <td className="td">
                          {o.status==='Received'?<span style={{display:'flex',alignItems:'center',gap:4,color:'#059669',fontSize:11,fontWeight:600}}><Check size={14}/>Done</span>:<button className={hasPending?"bp":"bs"} onClick={()=>confirmArrival(o.id)} style={{padding:'4px 10px',fontSize:11,borderRadius:6}}>{hasPending?'Confirm':'Confirm'}</button>}
                        </td>
                      </tr>);
                    })}
                  </tbody>
                </table>

                {/* Batch Confirm + Notify Actions */}
                <div style={{display:'flex',gap:10,marginTop:16,paddingTop:16,borderTop:'1px solid #E8ECF0',flexWrap:'wrap'}}>
                  {(()=>{const selIds=bgOrders.filter(o=>arrivalSelected.has(o.id)&&o.status!=='Received').map(o=>o.id);return selIds.length>0?<button className="bp" onClick={()=>batchConfirmArrival(selIds)} style={{padding:'8px 16px',display:'flex',alignItems:'center',gap:6}}><CheckCircle size={14}/> Batch Confirm ({selIds.length} selected)</button>:null;})()}
                  <button className="be" onClick={()=>{
                    const summary = bgOrders.map(o=>`• ${o.materialNo}: ${o.qtyReceived}/${o.quantity} ${o.qtyReceived>=o.quantity?'✓':'(B/O: '+(o.quantity-o.qtyReceived)+')'}`).join('\n');
                    notify('Email Sent',`Arrival report for ${bg.month} sent`,'success');
                    addNotifEntry({id:`N-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'email',to:'service-sg@miltenyibiotec.com',subject:`Arrival Check: ${bg.month}`,date:new Date().toISOString().slice(0,10),status:'Sent'});
                  }}><Mail size={14}/> Email Report</button>
                  {waConnected ? (
                    <button className="bw" onClick={async ()=>{
                      const received = bgOrders.filter(o=>o.qtyReceived>=o.quantity).length;
                      const backorder = bgOrders.filter(o=>o.qtyReceived<o.quantity).length;
                      const itemsList = bgOrders.slice(0,5).map(o=>`• ${o.description.slice(0,30)}: ${o.qtyReceived}/${o.quantity}`).join('\n');
                      try {
                        // Send to all engineers if partArrivalDone rule enabled
                        if (waNotifyRules.partArrivalDone) {
                          for (const user of users.filter(u=>u.role!=='admin'&&u.status==='active'&&u.phone)) {
                            await fetch(`${WA_API_URL}/send`, {
                              method: 'POST', headers: {'Content-Type':'application/json'},
                              body: JSON.stringify({ phone: user.phone, template: 'partArrivalDone', data: { month: bg.month, totalItems: bgOrders.length, received, backOrders: backorder, verifiedBy: currentUser?.name||'Admin', date: new Date().toISOString().slice(0,10), itemsList: itemsList+(bgOrders.length>5?`\n...and ${bgOrders.length-5} more`:'') }})
                            });
                          }
                        }
                        notify('WhatsApp Sent',`Arrival report for ${bg.month} sent`,'success');
                        addNotifEntry({id:`N-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'whatsapp',to:'SG Service Team',subject:`Arrival: ${bg.month} - ${received} full, ${backorder} B/O`,date:new Date().toISOString().slice(0,10),status:'Delivered'});
                      } catch(e) { notify('Error','Failed to send WhatsApp','error'); }
                    }}><MessageSquare size={14}/> WhatsApp Report</button>
                  ) : (
                    <button className="bs" onClick={()=>{setPage('whatsapp');notify('Connect WhatsApp','Please scan QR code first','info');}} style={{opacity:0.7}}><MessageSquare size={14}/> WhatsApp (Not Connected)</button>
                  )}
                  <button className="bp" onClick={async ()=>{
                    // Mark all as complete and send notification
                    const allReceived = bgOrders.every(o=>o.qtyReceived>=o.quantity);
                    if (allReceived) {
                      setBulkGroups(prev=>prev.map(g=>g.id===bg.id?{...g,status:'Completed'}:g));
                      dbSync(api.updateBulkGroup(bg.id, {status:'Completed'}), 'Bulk group completion not saved');
                      notify('Arrival Complete',`${bg.month} marked as fully received`,'success');
                      if (waConnected && waNotifyRules.partArrivalDone) {
                        try {
                          await fetch(`${WA_API_URL}/send`, {
                            method: 'POST', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ phone: users.find(u=>u.name===bg.createdBy)?.phone || '+65 9111 2222', template: 'partArrivalDone', data: { month: bg.month, totalItems: bgOrders.length, received: bgOrders.length, backOrders: 0, verifiedBy: currentUser?.name||'Admin', date: new Date().toISOString().slice(0,10), itemsList: bgOrders.slice(0,5).map(o=>`• ${o.description.slice(0,30)}: ${o.qtyReceived}/${o.quantity}`).join('\n')+(bgOrders.length>5?`\n...and ${bgOrders.length-5} more`:'') }})
                          });
                        } catch(e) {}
                      }
                    } else {
                      notify('Incomplete',`${bgOrders.filter(o=>o.qtyReceived<o.quantity).length} items still pending`,'error');
                    }
                  }}><CheckCircle size={14}/> Mark Complete</button>
                  <button className="bs" onClick={()=>setSelectedBulkForArrival(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>

  {/* Single Orders - Arrival Verification */}
  {(()=>{
    const indivOrders = orders.filter(o=>!o.bulkGroupId&&o.approvalStatus==='approved'&&o.quantity>0);
    if (!indivOrders.length) return null;
    return (
      <div className="card" style={{padding:'20px 24px',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Single Orders - Arrival Verification</h3>
        <div style={{fontSize:12,color:'#64748B',marginBottom:12}}>{indivOrders.length} approved individual order(s) not part of any bulk group</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{background:'#F8FAFB'}}><th className="th" style={{width:30}}><input type="checkbox" checked={indivOrders.filter(o=>o.status!=='Received').every(o=>arrivalSelected.has(o.id))&&indivOrders.some(o=>o.status!=='Received')} onChange={e=>{const ids=indivOrders.filter(o=>o.status!=='Received').map(o=>o.id);setArrivalSelected(prev=>{const next=new Set(prev);if(e.target.checked)ids.forEach(id=>next.add(id));else ids.forEach(id=>next.delete(id));return next;});}}/></th><th className="th">Material No.</th><th className="th">Description</th><th className="th" style={{width:70}}>Ordered</th><th className="th" style={{width:80}}>Received</th><th className="th" style={{width:70}}>B/O</th><th className="th" style={{width:100}}>Status</th><th className="th" style={{width:120}}>Action</th></tr></thead>
          <tbody>
            {indivOrders.map(o=>{
              const pv = pendingArrival[o.id];
              const dispQty = pv ? pv.qtyReceived : (o.qtyReceived||0);
              const dispBO = pv ? pv.qtyReceived - o.quantity : (o.qtyReceived||0) - o.quantity;
              const hasPending = !!pv;
              return (
              <tr key={o.id} style={{borderBottom:'1px solid #F0F2F5',background:hasPending?'#FFFBEB':'transparent'}}>
                <td className="td"><input type="checkbox" disabled={o.status==='Received'} checked={arrivalSelected.has(o.id)} onChange={e=>{setArrivalSelected(prev=>{const next=new Set(prev);if(e.target.checked)next.add(o.id);else next.delete(o.id);return next;});}}/></td>
                <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:600}}>{o.materialNo||'\u2014'}</td>
                <td className="td" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
                <td className="td" style={{textAlign:'center',fontWeight:600}}>{o.quantity}</td>
                <td className="td" style={{textAlign:'center'}}>
                  <input type="number" min="0" max={o.quantity} value={dispQty} disabled={o.status==='Received'} onChange={e=>{const val=Math.max(0,Math.min(o.quantity,parseInt(e.target.value)||0));setPendingArrival(prev=>({...prev,[o.id]:{qtyReceived:val,backOrder:val-o.quantity}}));}} style={{width:50,padding:'4px 6px',textAlign:'center',borderRadius:6,border:hasPending?'2px solid #F59E0B':'1px solid #E2E8F0',fontSize:12,opacity:o.status==='Received'?0.5:1,cursor:o.status==='Received'?'not-allowed':'text'}}/>
                </td>
                <td className="td" style={{textAlign:'center',fontWeight:600,color:dispBO<0?'#DC2626':'#059669'}}>{dispBO<0?dispBO:'\u2713'}</td>
                <td className="td"><Pill bg={o.status==='Received'?'#D1FAE5':o.status==='Back Order'?'#FEE2E2':'#FEF3C7'} color={o.status==='Received'?'#059669':o.status==='Back Order'?'#DC2626':'#D97706'}>{o.status==='Received'?'Received':o.status==='Back Order'?'Back Order':'Approved'}</Pill></td>
                <td className="td">
                  {o.status==='Received'?<span style={{display:'flex',alignItems:'center',gap:4,color:'#059669',fontSize:11,fontWeight:600}}><Check size={14}/>Done</span>:<button className={hasPending?"bp":"bs"} onClick={()=>confirmArrival(o.id)} style={{padding:'4px 10px',fontSize:11,borderRadius:6}}>{hasPending?'Confirm':'Confirm'}</button>}
                </td>
              </tr>);
            })}
          </tbody>
        </table>
        <div style={{display:'flex',gap:10,marginTop:16,paddingTop:16,borderTop:'1px solid #E8ECF0',flexWrap:'wrap'}}>
          {(()=>{const selIds=indivOrders.filter(o=>arrivalSelected.has(o.id)&&o.status!=='Received').map(o=>o.id);return selIds.length>0?<button className="bp" onClick={()=>batchConfirmArrival(selIds)} style={{padding:'8px 16px',display:'flex',alignItems:'center',gap:6}}><CheckCircle size={14}/> Batch Confirm ({selIds.length} selected)</button>:null;})()}
          <button className="be" onClick={()=>{
            notify('Email Sent','Individual orders arrival report sent','success');
            addNotifEntry({id:`N-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:'email',to:'service-sg@miltenyibiotec.com',subject:'Arrival Check: Individual Orders',date:new Date().toISOString().slice(0,10),status:'Sent'});
          }}><Mail size={14}/> Email Report</button>
        </div>
      </div>
    );
  })()}

  {/* All Orders - Arrival Status */}
  {(()=>{
    const statusTabs = ['All','Pending Approval','Approved','Back Order','Received','Rejected'];
    const arrivalFiltered = arrivalStatusFilter==='All' ? orders : orders.filter(o=>o.status===arrivalStatusFilter);
    // Sort: Back Order first, then Pending, then others
    const statusPriority = {'Back Order':0,'Pending Approval':1,'Approved':2,'Rejected':3,'Received':4};
    const arrivalSorted = [...arrivalFiltered].sort((a,b)=>(statusPriority[a.status]??9)-(statusPriority[b.status]??9));
    return (
    <div className="card" style={{overflow:'hidden'}}>
      <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <span style={{fontWeight:600,fontSize:14}}>All Orders - Arrival Status</span>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <ExportDropdown data={arrivalSorted} columns={[{key:'id',label:'Order ID'},{key:'materialNo',label:'Material No'},{key:'description',label:'Description'},{key:'quantity',label:'Qty Ordered'},{key:'qtyReceived',label:'Qty Received',fmt:v=>v||0},{key:'backOrder',label:'Back Order',fmt:(v,row)=>(row.qtyReceived||0)-row.quantity},{key:'arrivalDate',label:'Arrival Date',fmt:v=>fmtDate(v)},{key:'status',label:'Status'}]} filename="part-arrival" title="Part Arrival - Arrival Status"/>
            <span style={{fontSize:11,color:'#94A3B8'}}>{arrivalSorted.length} of {orders.length} orders</span>
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {statusTabs.map(s=>{
            const cnt = s==='All'?orders.length:orders.filter(o=>o.status===s).length;
            return <button key={s} onClick={()=>setArrivalStatusFilter(s)} style={{padding:'5px 12px',borderRadius:20,border:arrivalStatusFilter===s?'none':'1px solid #E2E8F0',background:arrivalStatusFilter===s?(s==='Back Order'?'#FEE2E2':s==='Received'?'#D1FAE5':s==='Approved'?'#D1FAE5':s==='Pending Approval'?'#EDE9FE':s==='Rejected'?'#FEE2E2':'#1E293B'):'#fff',color:arrivalStatusFilter===s?(s==='Back Order'?'#C53030':s==='Received'?'#059669':s==='Approved'?'#059669':s==='Pending Approval'?'#7C3AED':s==='Rejected'?'#DC2626':'#fff'):'#64748B',fontSize:11,fontWeight:600,cursor:'pointer'}}>{s} ({cnt})</button>;
          })}
        </div>
      </div>
      <div style={{maxHeight:500,overflowY:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'#F8FAFB',position:'sticky',top:0,zIndex:1}}>{['Order ID','Material','Description','Ordered','Recv','B/O','Arrival Date','Status'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{arrivalSorted.length===0?<tr><td colSpan={8} style={{padding:24,textAlign:'center',color:'#94A3B8',fontSize:13}}>No orders with status "{arrivalStatusFilter}"</td></tr>:arrivalSorted.map((o,i)=><tr key={o.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD'}}>
            <td className="td mono" style={{fontSize:11,fontWeight:500,color:'#475569'}}>{o.id}</td>
            <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:500}}>{o.materialNo||'—'}</td>
            <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
            <td className="td" style={{fontWeight:600,textAlign:'center'}}>{o.quantity}</td>
            <td className="td" style={{fontWeight:600,textAlign:'center',color:(o.qtyReceived||0)>=o.quantity?'#0B7A3E':'#D97706'}}>{o.qtyReceived||0}</td>
            <td className="td" style={{fontWeight:600,textAlign:'center',color:(o.backOrder||0)<0?'#DC2626':'#0B7A3E'}}>{(o.backOrder||0)<0?o.backOrder:'—'}</td>
            <td className="td" style={{color:o.arrivalDate?'#1A202C':'#94A3B8',fontSize:11}}>{o.arrivalDate?fmtDate(o.arrivalDate):'—'}</td>
            <td className="td"><Badge status={o.status}/></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>);
  })()}
</div>)}

{/* ═══════════ WHATSAPP BAILEYS ═══════════ */}
{page==='whatsapp'&&(<div>
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
    {/* Connection Panel */}
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <div style={{padding:8,background:'#D1FAE5',borderRadius:10}}><MessageSquare size={18} color="#059669"/></div>
        <div><h3 style={{fontSize:15,fontWeight:600}}>Baileys WhiskeySockets</h3><p style={{fontSize:11,color:'#94A3B8'}}>WhatsApp Web Multi-Device API</p></div>
      </div>

      {/* Connection Status Card */}
      <div className="card" style={{padding:'20px 24px',marginBottom:16,border:waConnected?'2px solid #25D366':'2px solid #E2E8F0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {waConnected ? <Wifi size={20} color="#25D366"/> : <WifiOff size={20} color="#94A3B8"/>}
            <div>
              <div style={{fontWeight:600,fontSize:14,color:waConnected?'#0B7A3E':'#64748B'}}>{waConnected?'Connected':'Disconnected'}</div>
              <div style={{fontSize:11,color:'#94A3B8'}}>{waConnected?'Session active via Baileys Multi-Device':'Scan QR code to connect'}</div>
            </div>
          </div>
          <div style={{width:12,height:12,borderRadius:'50%',background:waConnected?'#25D366':'#E2E8F0',animation:waConnected?'pulse 2s infinite':'none'}}/>
        </div>

        {waConnected && waSessionInfo && (
          <div style={{padding:12,borderRadius:8,background:'#F0FDF4',marginBottom:16,fontSize:12}}>
            <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>Phone: <strong className="mono">{waSessionInfo.phone}</strong></div>
              <div>Name: <strong>{waSessionInfo.name}</strong></div>
              <div>Protocol: <strong className="mono" style={{fontSize:10}}>{waSessionInfo.protocol}</strong></div>
              <div>Connected: <strong style={{fontSize:10}}>{waSessionInfo.connectedAt}</strong></div>
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {waQrVisible && !waConnected && (
          <div style={{textAlign:'center',padding:20,background:'#F8FAFB',borderRadius:12,marginBottom:16}}>
            <div style={{marginBottom:12}}>
              {waQrCode.startsWith("data:") ? <img src={waQrCode} alt="QR Code" style={{width:200,height:200,borderRadius:8}}/> : <QRCodeCanvas text={waQrCode} size={200}/>}
            </div>
            <div style={{fontSize:13,fontWeight:600,color:'#1A202C',marginBottom:4}}>Scan with WhatsApp</div>
            <div style={{fontSize:11,color:'#94A3B8'}}>Open WhatsApp → Linked Devices → Link a Device</div>
            {waConnecting && <div style={{marginTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:12,color:'#D97706'}}><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Waiting for scan...</div>}
          </div>
        )}

        {!(hasPermission('whatsapp')||waAllowedSenders.includes(currentUser?.username)) && !waConnected && (
          <div style={{padding:12,borderRadius:8,background:'#FEF3C7',fontSize:12,color:'#92400E',marginBottom:16,display:'flex',gap:8}}><Shield size={14}/> Only authorized users can connect WhatsApp. Contact admin to be assigned as a sender.</div>
        )}

        <div style={{display:'flex',gap:8}}>
          {!waConnected ? (
            <button className="bw" onClick={handleWaConnect} disabled={!(hasPermission('whatsapp')||waAllowedSenders.includes(currentUser?.username))||waConnecting} style={{opacity:(hasPermission('whatsapp')||waAllowedSenders.includes(currentUser?.username))?1:.5,flex:1}}>
              {waConnecting?<><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Connecting...</>:<><QrCode size={14}/> {hasPermission('whatsapp')?'Scan QR Code':'Admin Only'}</>}
            </button>
          ) : (
            <button className="bd" onClick={handleWaDisconnect} style={{flex:1}}><WifiOff size={14}/> Disconnect Session</button>
          )}
        </div>
      </div>

      {/* Auto-notification Rules */}
      <div className="card" style={{padding:'18px 20px'}}>
        <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Auto-Notify Rules via Baileys</h4>
        {[
          {key:'orderCreated',label:'New order created → Notify team'},
          {key:'bulkOrderCreated',label:'Bulk order created → Notify all engineers'},
          {key:'partArrivalDone',label:'Part arrival verified → Notify requester'},
          {key:'deliveryArrival',label:'Delivery arrival → Notify assigned engineer'},
          {key:'backOrderUpdate',label:'Back order update → Team group'},
          {key:'lowStockAlert',label:'Low stock alert → Supervisor'},
          {key:'monthlySummary',label:'Monthly summary → All engineers'},
          {key:'urgentRequest',label:'Urgent request → Broadcast to all'}
        ].map((rule,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<7?'1px solid #F0F2F5':'none'}}>
            <span style={{fontSize:12.5}}>{rule.label}</span><Toggle active={waNotifyRules[rule.key]} onClick={()=>setWaNotifyRules(prev=>({...prev,[rule.key]:!prev[rule.key]}))} color="#25D366"/>
          </div>
        ))}
      </div>

      {/* Scheduled Reports & Notifications */}
      <div className="card" style={{padding:'18px 20px',marginTop:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{padding:8,background:'linear-gradient(135deg,#7C3AED,#8B5CF6)',borderRadius:10}}><Calendar size={18} color="#fff"/></div>
            <div>
              <h4 style={{fontSize:14,fontWeight:700}}>Scheduled Reports & Notifications</h4>
              <p style={{fontSize:11,color:'#94A3B8'}}>Auto-send reports via Email & WhatsApp</p>
            </div>
          </div>
          <Toggle active={scheduledNotifs.enabled} onClick={()=>setScheduledNotifs(prev=>({...prev,enabled:!prev.enabled}))} color="#7C3AED"/>
        </div>

        {scheduledNotifs.enabled && (
          <div style={{display:'grid',gap:14}}>
            {/* Schedule Frequency */}
            <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>Frequency</label>
                <select value={scheduledNotifs.frequency} onChange={e=>setScheduledNotifs(prev=>({...prev,frequency:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>
                  {scheduledNotifs.frequency==='weekly'||scheduledNotifs.frequency==='biweekly'?'Day of Week':scheduledNotifs.frequency==='monthly'?'Day of Month':'Time'}
                </label>
                {(scheduledNotifs.frequency==='weekly'||scheduledNotifs.frequency==='biweekly')&&(
                  <select value={scheduledNotifs.dayOfWeek} onChange={e=>setScheduledNotifs(prev=>({...prev,dayOfWeek:parseInt(e.target.value)}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=><option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                {scheduledNotifs.frequency==='monthly'&&(
                  <select value={scheduledNotifs.dayOfMonth} onChange={e=>setScheduledNotifs(prev=>({...prev,dayOfMonth:parseInt(e.target.value)}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                    {Array.from({length:28},(_,i)=><option key={i+1} value={i+1}>{i+1}{i===0?'st':i===1?'nd':i===2?'rd':'th'}</option>)}
                  </select>
                )}
                {scheduledNotifs.frequency==='daily'&&(
                  <input type="time" value={scheduledNotifs.time} onChange={e=>setScheduledNotifs(prev=>({...prev,time:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
                )}
              </div>
            </div>

            {/* Send Time for non-daily */}
            {scheduledNotifs.frequency!=='daily'&&(
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>Send Time</label>
                <input type="time" value={scheduledNotifs.time} onChange={e=>setScheduledNotifs(prev=>({...prev,time:e.target.value}))} style={{width:150,padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
              </div>
            )}

            {/* Delivery Channels */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Delivery Channels</label>
              <div style={{display:'flex',gap:16}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={scheduledNotifs.emailEnabled} onChange={e=>setScheduledNotifs(prev=>({...prev,emailEnabled:e.target.checked}))}/>
                  <Mail size={14} color={scheduledNotifs.emailEnabled?'#059669':'#9CA3AF'}/> Email
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={scheduledNotifs.whatsappEnabled} onChange={e=>setScheduledNotifs(prev=>({...prev,whatsappEnabled:e.target.checked}))}/>
                  <MessageSquare size={14} color={scheduledNotifs.whatsappEnabled?'#25D366':'#9CA3AF'}/> WhatsApp
                </label>
              </div>
            </div>

            {/* Report Types */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Reports to Include</label>
              <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {key:'monthlySummary',label:'Order Summary',desc:'Total orders, costs, status breakdown'},
                  {key:'backOrderReport',label:'Back Order Report',desc:'Pending items awaiting delivery'},
                  {key:'lowStockAlert',label:'Low Stock Alerts',desc:'Items below threshold'},
                  {key:'pendingApprovals',label:'Pending Approvals',desc:'Orders awaiting approval'},
                  {key:'orderStats',label:'Order Statistics',desc:'Trends and analytics'}
                ].map(r=>(
                  <label key={r.key} style={{display:'flex',alignItems:'flex-start',gap:8,padding:10,background:scheduledNotifs.reports?.[r.key]?'#EDE9FE':'#F8FAFB',borderRadius:8,cursor:'pointer',border:scheduledNotifs.reports?.[r.key]?'1px solid #C4B5FD':'1px solid #E8ECF0'}}>
                    <input type="checkbox" checked={scheduledNotifs.reports?.[r.key]} onChange={e=>setScheduledNotifs(prev=>({...prev,reports:{...prev.reports,[r.key]:e.target.checked}}))} style={{marginTop:2}}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:scheduledNotifs.reports?.[r.key]?'#5B21B6':'#374151'}}>{r.label}</div>
                      <div style={{fontSize:10,color:'#94A3B8'}}>{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Recipients</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {users.filter(u=>u.status==='active').map(u=>(
                  <label key={u.id} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:scheduledNotifs.recipients?.includes(u.email)?'#D1FAE5':'#F8FAFB',borderRadius:16,fontSize:11,cursor:'pointer',border:'1px solid #E8ECF0'}}>
                    <input type="checkbox" checked={scheduledNotifs.recipients?.includes(u.email)} onChange={e=>{
                      if(e.target.checked) setScheduledNotifs(prev=>({...prev,recipients:[...(prev.recipients||[]),u.email]}));
                      else setScheduledNotifs(prev=>({...prev,recipients:(prev.recipients||[]).filter(r=>r!==u.email)}));
                    }} style={{display:'none'}}/>
                    <span style={{color:scheduledNotifs.recipients?.includes(u.email)?'#059669':'#64748B'}}>{u.name}</span>
                    {scheduledNotifs.recipients?.includes(u.email)&&<CheckCircle size={12} color="#059669"/>}
                  </label>
                ))}
              </div>
            </div>

            {/* Schedule Summary & Actions */}
            <div style={{padding:12,background:'#F8FAFB',borderRadius:8,marginTop:4}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>
                    Next Report: {scheduledNotifs.frequency==='daily'?'Today':scheduledNotifs.frequency==='weekly'?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][scheduledNotifs.dayOfWeek]:scheduledNotifs.frequency==='monthly'?'Day '+scheduledNotifs.dayOfMonth:'Every 2 weeks'} at {scheduledNotifs.time}
                  </div>
                  <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>
                    {Object.values(scheduledNotifs.reports).filter(Boolean).length} reports • {(scheduledNotifs.recipients||[]).length} recipients • {[scheduledNotifs.emailEnabled&&'Email',scheduledNotifs.whatsappEnabled&&'WhatsApp'].filter(Boolean).join(' & ')}
                  </div>
                </div>
                <button onClick={()=>{
                  const reportCount = Object.values(scheduledNotifs.reports).filter(Boolean).length;
                  const recipientCount = (scheduledNotifs.recipients||[]).length;
                  if(recipientCount===0){notify('No Recipients','Please select at least one recipient','warning');return;}

if(scheduledNotifs.emailEnabled){                    addNotifEntry({id:'N-'+Date.now(),type:'email',to:(scheduledNotifs.recipients||[]).join(', '),subject:'Scheduled Report - Miltenyi Inventory',date:new Date().toISOString().slice(0,10),status:'Sent'});                  }                  if(scheduledNotifs.whatsappEnabled&&waConnected){                    addNotifEntry({id:'N-'+Date.now()+1,type:'whatsapp',to:'Team Group',subject:'Scheduled Report Sent',date:new Date().toISOString().slice(0,10),status:'Delivered'});                  }                  setScheduledNotifs(prev=>({...prev,lastRun:new Date().toISOString()}));                  notify('Report Sent','Scheduled report sent to '+recipientCount+' recipients','success');                }} style={{padding:'8px 16px',background:'linear-gradient(135deg,#7C3AED,#8B5CF6)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>                  <Send size={14}/> Send Now                </button>              </div>              {scheduledNotifs.lastRun&&(                <div style={{marginTop:8,fontSize:10,color:'#94A3B8'}}>                  Last sent: {new Date(scheduledNotifs.lastRun).toLocaleString()}                </div>              )}            </div>          </div>        )}        {!scheduledNotifs.enabled && (          <div style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Enable to automatically send scheduled reports to your team via Email and WhatsApp.</div>        )}      </div>      {/* AI Bot Auto-Reply */}      <div className="card" style={{padding:'18px 20px',marginTop:16,border:waAutoReply?'2px solid #0B7A3E':'2px solid transparent'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{padding:6,background:waAutoReply?'#D1FAE5':'#F3F4F6',borderRadius:8}}><Bot size={16} color={waAutoReply?'#059669':'#9CA3AF'}/></div>
            <div>
              <h4 style={{fontSize:13,fontWeight:600}}>AI Bot Auto-Reply</h4>
              <p style={{fontSize:11,color:'#94A3B8'}}>Automatically respond to customer keywords</p>
            </div>
          </div>
          <Toggle active={waAutoReply} onClick={()=>setWaAutoReply(!waAutoReply)} color="#0B7A3E"/>
        </div>
        {waAutoReply && (
          <div style={{background:'#F8FAFB',borderRadius:8,padding:12}}>
            <div style={{fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Active Keyword Triggers:</div>
            {[
              {keyword:'"price" + part number',response:'Returns SG/Dist/Transfer prices'},
              {keyword:'"status" + order ID',response:'Returns order status details'},
              {keyword:'"help"',response:'Lists available commands'},
              {keyword:'"stock"',response:'Returns recent stock check info'}
            ].map((k,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<3?'1px solid #E8ECF0':'none',fontSize:12}}>
                <span style={{fontFamily:'monospace',color:'#0B7A3E'}}>{k.keyword}</span>
                <span style={{color:'#64748B'}}>{k.response}</span>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:11,color:'#94A3B8',display:'flex',alignItems:'center',gap:6}}><Zap size={12}/> Bot uses same logic as in-app AI Assistant</div>
          </div>
        )}
        {!waAutoReply && (
          <div style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Enable to let the bot automatically reply to incoming WhatsApp messages based on keywords.</div>
        )}
      </div>
    </div>

    {/* Send Messages */}
    <div>
      <div className="card" style={{padding:'20px 24px',marginBottom:16}}>
        <h4 style={{fontSize:14,fontWeight:600,marginBottom:14}}>Send Message via Baileys</h4>
        {!waConnected && <div style={{padding:12,borderRadius:8,background:'#FEE2E2',fontSize:12,color:'#DC2626',marginBottom:14,display:'flex',gap:6}}><WifiOff size={13}/> Connect WhatsApp first to send messages</div>}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Template</label>
            <select value={waTemplate} onChange={e=>{setWaTemplate(e.target.value);if(e.target.value!=='custom')setWaMessageText(waTemplates[e.target.value]?.() || '');}} style={{width:'100%'}}>
              <option value="custom">Custom Message</option>
              <option value="backOrder">Back Order Alert</option>
              <option value="deliveryArrived">Delivery Arrived</option>
              <option value="stockAlert">Stock Level Warning</option>
              <option value="monthlyUpdate">Monthly Update</option>
            </select>
          </div>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Recipient</label>
            <select value={waRecipient} onChange={e=>setWaRecipient(e.target.value)} style={{width:'100%'}}>
              <option value="">Select recipient...</option>
              {users.filter(u=>u.status==='active'&&u.phone).map(u=><option key={u.id} value={`${u.phone} (${u.name})`}>{u.name} — {u.phone}</option>)}
              <option value="SG Service Team Group">SG Service Team Group</option>
            </select>
          </div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Message</label><textarea value={waMessageText} onChange={e=>setWaMessageText(e.target.value)} rows={5} style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:12}}/></div>
          <button className="bw" onClick={handleWaSend} disabled={!waConnected} style={{opacity:waConnected?1:.5}}><Send size={14}/> Send via Baileys</button>
        </div>
      </div>

      {/* Message Log */}
      <div className="card" style={{padding:'18px 20px'}}>
        <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Message History</h4>
        <div style={{maxHeight:300,overflow:'auto'}}>
          {waMessages.map(m=>(
            <div key={m.id} style={{padding:'10px 12px',borderBottom:'1px solid #F0F2F5',fontSize:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontWeight:600,color:'#1A202C'}}>{m.to}</span>
                <Pill bg={m.status==='read'?'#DBEAFE':m.status==='delivered'?'#D1FAE5':'#FEF3C7'} color={m.status==='read'?'#2563EB':m.status==='delivered'?'#059669':'#D97706'}>{m.status==='read'?'✓✓':'✓'} {m.status}</Pill>
              </div>
              <div style={{color:'#64748B',fontSize:11,marginBottom:2}}>{m.message.slice(0,80)}{m.message.length>80?'...':''}</div>
              <div style={{color:'#94A3B8',fontSize:10}}>{m.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
</div>)}

{/* ═══════════ NOTIFICATIONS ═══════════ */}
{page==='notifications'&&(<div>
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:24}}>
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><div style={{padding:8,background:'#DBEAFE',borderRadius:10}}><Mail size={18} color="#2563EB"/></div><div><h3 style={{fontSize:15,fontWeight:600}}>Email Notifications</h3></div></div>
      <div className="card" style={{padding:'18px 20px',marginBottom:12}}><h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Quick Compose</h4><div style={{display:'flex',flexDirection:'column',gap:10}}><select style={{width:'100%'}}><option>Monthly Full Received</option><option>Back Order Alert</option><option>Delivery Confirmation</option><option>Price List Update</option></select><input type="email" placeholder="Recipients" style={{width:'100%'}}/><textarea placeholder="Notes..." rows={3} style={{width:'100%',resize:'vertical'}}/><button className="be" onClick={()=>{notify('Email Sent','Dispatched','success');setNotifLog(p=>[{id:`N-${String(p.length+1).padStart(3,'0')}`,type:'email',to:'service-sg@miltenyibiotec.com',subject:'Update',date:new Date().toISOString().slice(0,10),status:'Sent'},...p]);}}><Send size={14}/> Send</button></div></div>
    </div>
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><div style={{padding:8,background:'#D1FAE5',borderRadius:10}}><MessageSquare size={18} color="#059669"/></div><div><h3 style={{fontSize:15,fontWeight:600}}>WhatsApp (Baileys)</h3><p style={{fontSize:11,color:'#94A3B8'}}>{waConnected?'✓ Connected':'✗ Not connected'} — <button onClick={()=>setPage('whatsapp')} style={{background:'none',border:'none',color:'#0B7A3E',cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:600}}>Manage →</button></p></div></div>
      <div className="card" style={{padding:'18px 20px'}}><p style={{fontSize:12,color:'#64748B',lineHeight:1.6}}>WhatsApp messaging is handled through the <strong>Baileys WhiskeySockets</strong> integration. Go to the WhatsApp page to connect your session, manage templates, and send messages.<br/><br/>Admin must scan QR code to authorize the session.</p></div>
    </div>
  </div>
  {hasPermission('deleteNotifications')&&<BatchBar count={selNotifs.size} onClear={()=>setSelNotifs(new Set())}>
    <BatchBtn onClick={batchDeleteNotifs} bg="#DC2626" icon={Trash2}>Delete Selected</BatchBtn>
  </BatchBar>}
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:14}}>All Notification History</span><span style={{fontSize:11,color:'#94A3B8'}}>{notifLog.length} records{selNotifs.size>0&&` • ${selNotifs.size} selected`}</span></div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}><thead><tr style={{background:'#F8FAFB'}}>{hasPermission('deleteNotifications')&&<th className="th" style={{width:36}}><SelBox checked={selNotifs.size===notifLog.length&&notifLog.length>0} onChange={()=>toggleAll(selNotifs,setSelNotifs,notifLog.map(n=>n.id))}/></th>}{['ID','Channel','To','Subject','Date','Status'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead><tbody>{notifLog.map(n=><tr key={n.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:selNotifs.has(n.id)?'#EDE9FE':'#fff'}}>{hasPermission('deleteNotifications')&&<td className="td"><SelBox checked={selNotifs.has(n.id)} onChange={()=>toggleSel(selNotifs,setSelNotifs,n.id)}/></td>}<td className="td mono" style={{fontSize:11,fontWeight:500}}>{n.id}</td><td className="td"><Pill bg={n.type==='email'?'#DBEAFE':'#D1FAE5'} color={n.type==='email'?'#2563EB':'#059669'}>{n.type==='email'?<Mail size={11}/>:<MessageSquare size={11}/>} {n.type==='email'?'Email':'WhatsApp'}</Pill></td><td className="td" style={{fontSize:12,color:'#64748B'}}>{n.to}</td><td className="td" style={{maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.subject}</td><td className="td" style={{color:'#94A3B8',fontSize:11}}>{fmtDate(n.date)}</td><td className="td"><Pill bg="#E6F4ED" color="#0B7A3E"><Check size={11}/> {n.status}</Pill></td></tr>)}</tbody></table>
  </div>
</div>)}

{/* ═══════════ AUDIT TRAIL ═══════════ */}
{page==='audit'&&hasPermission('auditTrail')&&(()=>{
  const AUDIT_COLORS = { create:'#059669', update:'#2563EB', delete:'#DC2626', approve:'#7C3AED', reject:'#DC2626', login:'#64748B', export:'#D97706', batch_approve:'#7C3AED' };
  const actions = ['All',...new Set(auditLog.map(a=>a.action))];
  const entityTypes = ['All',...new Set(auditLog.map(a=>a.entityType).filter(Boolean))];
  const auditUsers = ['All',...new Set(auditLog.map(a=>a.userName).filter(Boolean))];
  const filtered = auditLog.filter(a => {
    if (auditFilter.action !== 'All' && a.action !== auditFilter.action) return false;
    if (auditFilter.user !== 'All' && a.userName !== auditFilter.user) return false;
    if (auditFilter.entityType !== 'All' && a.entityType !== auditFilter.entityType) return false;
    return true;
  });
  return (<div>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
      <div style={{padding:10,background:'linear-gradient(135deg,#4338CA,#6366F1)',borderRadius:12}}><Shield size={22} color="#fff"/></div>
      <div><h2 style={{fontSize:18,fontWeight:700,margin:0}}>Audit Trail</h2><p style={{fontSize:12,color:'#94A3B8',margin:0}}>Track all user actions and changes across the system</p></div>
    </div>

    <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
      {[
        {l:'Total Events',v:auditLog.length,c:'#4338CA'},
        {l:'Creates',v:auditLog.filter(a=>a.action==='create').length,c:'#059669'},
        {l:'Updates',v:auditLog.filter(a=>a.action==='update').length,c:'#2563EB'},
        {l:'Deletes',v:auditLog.filter(a=>a.action==='delete').length,c:'#DC2626'}
      ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
    </div>

    <div className="card" style={{padding:'14px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:11,fontWeight:600,color:'#64748B',textTransform:'uppercase'}}>Action</span>
        <select value={auditFilter.action} onChange={e=>setAuditFilter(p=>({...p,action:e.target.value}))} style={{padding:'5px 10px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:11,fontFamily:'inherit'}}>
          {actions.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:11,fontWeight:600,color:'#64748B',textTransform:'uppercase'}}>User</span>
        <select value={auditFilter.user} onChange={e=>setAuditFilter(p=>({...p,user:e.target.value}))} style={{padding:'5px 10px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:11,fontFamily:'inherit'}}>
          {auditUsers.map(u=><option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:11,fontWeight:600,color:'#64748B',textTransform:'uppercase'}}>Entity</span>
        <select value={auditFilter.entityType} onChange={e=>setAuditFilter(p=>({...p,entityType:e.target.value}))} style={{padding:'5px 10px',borderRadius:8,border:'1px solid #E2E8F0',fontSize:11,fontFamily:'inherit'}}>
          {entityTypes.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{flex:1}}/>
      <ExportDropdown data={filtered} columns={[{key:'createdAt',label:'Timestamp',fmt:v=>v?new Date(v).toLocaleString('en-SG'):''},{key:'userName',label:'User'},{key:'action',label:'Action'},{key:'entityType',label:'Entity Type'},{key:'entityId',label:'Entity ID'},{key:'details',label:'Details',fmt:v=>v?JSON.stringify(v):''}]} filename="audit-trail" title="Audit Trail Export"/>
      <span style={{fontSize:12,color:'#94A3B8'}}>{filtered.length} events</span>
    </div>

    <div className="card" style={{overflow:'hidden'}}>
      <div style={{maxHeight:600,overflowY:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'#F8FAFB',position:'sticky',top:0,zIndex:1}}>{['Timestamp','User','Action','Entity Type','Entity ID','Details'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{filtered.length===0?<tr><td colSpan={6} style={{padding:24,textAlign:'center',color:'#94A3B8',fontSize:13}}>No audit events found</td></tr>:filtered.slice(0,200).map((a,i)=>(
            <tr key={a.id||i} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD'}}>
              <td className="td" style={{fontSize:11,color:'#94A3B8',whiteSpace:'nowrap'}}>{a.createdAt?new Date(a.createdAt).toLocaleString('en-SG'):''}</td>
              <td className="td" style={{fontWeight:500}}>{a.userName||'—'}</td>
              <td className="td"><Pill bg={`${AUDIT_COLORS[a.action]||'#64748B'}18`} color={AUDIT_COLORS[a.action]||'#64748B'}>{a.action}</Pill></td>
              <td className="td"><Pill bg="#F3F4F6" color="#4A5568">{a.entityType||'—'}</Pill></td>
              <td className="td mono" style={{fontSize:11,fontWeight:600}}>{a.entityId||'—'}</td>
              <td className="td" style={{fontSize:11,color:'#64748B',maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.details?JSON.stringify(a.details):''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {filtered.length>200&&<div style={{padding:'12px 16px',borderTop:'1px solid #F0F2F5',textAlign:'center',fontSize:11,color:'#94A3B8'}}>Showing first 200 of {filtered.length} events. Use export to see all.</div>}
    </div>
  </div>);
})()}

{/* ═══════════ USER MANAGEMENT (ADMIN ONLY) ═══════════ */}
{page==='users'&&hasPermission('users')&&(<div>
  {/* Pending Approvals */}
  {pendingUsers.length>0 && (
    <div className="card" style={{padding:'20px 24px',marginBottom:24,border:'2px solid #FDE68A',background:'#FFFBEB'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}><AlertTriangle size={18} color="#D97706"/><h3 style={{fontSize:15,fontWeight:600,color:'#92400E'}}>Pending Approvals ({pendingUsers.length})</h3></div>
      {pendingUsers.map(u=>(
        <div key={u.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'#fff',borderRadius:10,marginBottom:8,border:'1px solid #FDE68A'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#D97706,#F59E0B)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,fontWeight:700}}>{u.name.split(' ').map(w=>w[0]).join('')}</div>
            <div><div style={{fontWeight:600,fontSize:14}}>{u.name}</div><div style={{fontSize:11,color:'#94A3B8'}}>{u.email} • {u.username} • Requested: {fmtDate(u.requestDate)}</div></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="bp" style={{padding:'7px 16px'}} onClick={()=>handleApproveUser(u)}><Check size={14}/> Approve</button>
            <button className="bd" style={{padding:'7px 16px'}} onClick={()=>handleRejectUser(u.id)}><X size={14}/> Reject</button>
          </div>
        </div>
      ))}
    </div>
  )}

  {/* Active Users */}
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <h3 style={{fontSize:15,fontWeight:600}}>All Users</h3>
    <button className="bp" onClick={()=>{
      const name=prompt('Full Name:'); if(!name)return;
      const username=prompt('Username:'); if(!username)return;
      const email=prompt('Email:'); const role=prompt('Role (admin/user):','user');
      handleCreateUser({name,username,password:'temp123',email:email||'',role:role||'user',phone:''});
    }}><UserPlus size={14}/> Create User</button>
  </div>
  <BatchBar count={selUsers.size} onClear={()=>setSelUsers(new Set())}>
    <BatchBtn onClick={()=>batchRoleUsers('admin')} bg="#2563EB" icon={Shield}>Set Admin</BatchBtn>
    <BatchBtn onClick={()=>batchRoleUsers('user')} bg="#059669" icon={Users}>Set User</BatchBtn>
    <BatchBtn onClick={()=>batchStatusUsers('active')} bg="#059669" icon={CheckCircle}>Activate</BatchBtn>
    <BatchBtn onClick={()=>batchStatusUsers('suspended')} bg="#D97706" icon={AlertTriangle}>Suspend</BatchBtn>
    <BatchBtn onClick={batchDeleteUsers} bg="#DC2626" icon={Trash2}>Delete</BatchBtn>
  </BatchBar>
  <div className="card" style={{overflow:'hidden'}}>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}><th className="th" style={{width:36}}><SelBox checked={selUsers.size===users.length&&users.length>0} onChange={()=>toggleAll(selUsers,setSelUsers,users.map(u=>u.id))}/></th>{['ID','Name','Username','Email','Role','Status','Created','Phone','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{users.map(u=>(
        <tr key={u.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:selUsers.has(u.id)?'#DBEAFE':'#fff'}}>
          <td className="td"><SelBox checked={selUsers.has(u.id)} onChange={()=>toggleSel(selUsers,setSelUsers,u.id)}/></td>
          <td className="td mono" style={{fontSize:11,fontWeight:500}}>{u.id}</td>
          <td className="td"><div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:u.role==='admin'?'linear-gradient(135deg,#1E40AF,#3B82F6)':'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:700}}>{u.name.split(' ').map(w=>w[0]).join('')}</div>
            {u.name}
          </div></td>
          <td className="td mono" style={{fontSize:11}}>{u.username}</td>
          <td className="td" style={{fontSize:11,color:'#64748B'}}>{u.email}</td>
          <td className="td"><Pill bg={u.role==='admin'?'#DBEAFE':'#E6F4ED'} color={u.role==='admin'?'#2563EB':'#0B7A3E'}><Shield size={10}/> {u.role}</Pill></td>
          <td className="td"><Pill bg={u.status==='active'?'#E6F4ED':'#FEE2E2'} color={u.status==='active'?'#0B7A3E':'#DC2626'}>{u.status}</Pill></td>
          <td className="td" style={{fontSize:11,color:'#94A3B8'}}>{fmtDate(u.created)}</td>
          <td className="td mono" style={{fontSize:11}}>{u.phone||'—'}</td>
          <td className="td">
            <div style={{display:'flex',gap:4}}>
              <button onClick={()=>setSelectedUser({...u})} style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><Edit3 size={12}/> Edit</button>
              <button onClick={()=>{if(window.confirm(`Delete user ${u.name}?`)){setUsers(prev=>prev.filter(x=>x.id!==u.id));dbSync(api.deleteUser(u.id),'User delete not saved');notify('Deleted',u.name,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer'}}><Trash2 size={11}/></button>
            </div>
          </td>
        </tr>))}</tbody>
    </table>
  </div>
</div>)}

{/* Edit User Modal */}
{selectedUser&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setSelectedUser(null)}>
  <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:540,maxWidth:'94vw',maxHeight:'85vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <h3 style={{fontSize:16,fontWeight:700}}>Edit User Profile</h3>
      <button onClick={()=>setSelectedUser(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#64748B"/></button>
    </div>
    <div style={{display:'grid',gap:16}}>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Full Name</label>
        <input value={selectedUser.name} onChange={e=>setSelectedUser(prev=>({...prev,name:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Username</label>
        <input value={selectedUser.username} onChange={e=>setSelectedUser(prev=>({...prev,username:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Email</label>
        <input type="email" value={selectedUser.email} onChange={e=>setSelectedUser(prev=>({...prev,email:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Phone Number</label>
        <input value={selectedUser.phone||''} onChange={e=>setSelectedUser(prev=>({...prev,phone:e.target.value}))} placeholder="+65 XXXX XXXX" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Set New Password <span style={{fontWeight:400,color:'#94A3B8'}}>(leave blank to keep current)</span></label>
        <input type="password" value={selectedUser._newPassword||''} onChange={e=>setSelectedUser(prev=>({...prev,_newPassword:e.target.value}))} placeholder="Enter new password" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        {selectedUser._newPassword&&selectedUser._newPassword.length<6&&<div style={{fontSize:11,color:'#DC2626',marginTop:4}}>Password must be at least 6 characters</div>}
      </div>
      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Role</label>
          <select value={selectedUser.role} onChange={e=>{const newRole=e.target.value;if(selectedUser.id===currentUser?.id&&newRole!=='admin'){notify('Cannot Change','You cannot demote your own admin role','error');return;}if(selectedUser.role==='admin'&&newRole!=='admin'){const adminCount=users.filter(u=>u.role==='admin'&&u.status==='active').length;if(adminCount<=1){notify('Cannot Change','At least one admin must remain','error');return;}}setSelectedUser(prev=>({...prev,role:newRole}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          {selectedUser.id===currentUser?.id&&<div style={{fontSize:11,color:'#DC2626',marginTop:4}}>You cannot change your own role</div>}
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Status</label>
          <select value={selectedUser.status} onChange={e=>{const newStatus=e.target.value;if(selectedUser.id===currentUser?.id&&newStatus!=='active'){notify('Cannot Change','You cannot deactivate your own account','error');return;}setSelectedUser(prev=>({...prev,status:newStatus}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>
      {/* Feature Permissions */}
      {selectedUser.role!=='admin'&&<div style={{border:'1.5px solid #E2E8F0',borderRadius:10,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <label style={{fontSize:13,fontWeight:700,color:'#1A202C'}}>Feature Permissions</label>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setSelectedUser(prev=>({...prev,permissions:Object.fromEntries(Object.keys(DEFAULT_USER_PERMS).map(k=>[k,true]))}))} style={{padding:'3px 10px',fontSize:10,fontWeight:600,border:'1px solid #059669',background:'#D1FAE5',color:'#059669',borderRadius:6,cursor:'pointer'}}>All</button>
            <button onClick={()=>setSelectedUser(prev=>({...prev,permissions:{...DEFAULT_USER_PERMS}}))} style={{padding:'3px 10px',fontSize:10,fontWeight:600,border:'1px solid #D97706',background:'#FEF3C7',color:'#D97706',borderRadius:6,cursor:'pointer'}}>Default</button>
            <button onClick={()=>setSelectedUser(prev=>({...prev,permissions:Object.fromEntries(Object.keys(DEFAULT_USER_PERMS).map(k=>[k,false]))}))} style={{padding:'3px 10px',fontSize:10,fontWeight:600,border:'1px solid #DC2626',background:'#FEE2E2',color:'#DC2626',borderRadius:6,cursor:'pointer'}}>None</button>
          </div>
        </div>
        {['Pages','Actions','Admin'].map(group=>(
          <div key={group} style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>{group}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              {FEATURE_PERMISSIONS.filter(p=>p.group===group).map(p=>{
                const perms=selectedUser.permissions||DEFAULT_USER_PERMS;
                const enabled=perms[p.key]===true;
                return <label key={p.key} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,cursor:'pointer',fontSize:12,background:enabled?'#F0FDF4':'#F8FAFB',border:enabled?'1px solid #BBF7D0':'1px solid #E8ECF0',transition:'all 0.15s'}}>
                  <input type="checkbox" checked={enabled} onChange={()=>setSelectedUser(prev=>({...prev,permissions:{...(prev.permissions||DEFAULT_USER_PERMS),[p.key]:!enabled}}))} style={{accentColor:'#059669'}}/>
                  <span style={{fontWeight:enabled?600:400,color:enabled?'#065F46':'#94A3B8'}}>{p.label}</span>
                </label>;
              })}
            </div>
          </div>
        ))}
      </div>}
      {selectedUser.role==='admin'&&<div style={{padding:14,borderRadius:10,background:'#DBEAFE',border:'1px solid #93C5FD',fontSize:12,color:'#1E40AF',display:'flex',alignItems:'center',gap:8}}><Shield size={14}/> Admin role has full access to all features.</div>}
      <div style={{display:'flex',gap:10,marginTop:8}}>
        <button onClick={()=>setSelectedUser(null)} style={{flex:1,padding:'10px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={()=>{if(selectedUser._newPassword&&selectedUser._newPassword.length<6){notify('Error','Password must be at least 6 characters','error');return;}const payload={...selectedUser};if(payload._newPassword){payload.password=payload._newPassword;}delete payload._newPassword;setUsers(prev=>prev.map(u=>u.id===selectedUser.id?selectedUser:u));api.updateUser(selectedUser.id,payload);setSelectedUser(null);notify('User Updated',payload.password?'Password and profile saved to database':'Changes saved to database','success');}} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#006837,#00A550)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>Save Changes</button>
      </div>
    </div>
  </div>
</div>)}

{/* Edit Bulk Order Modal */}
{selectedBulkGroup&&(()=>{
  const bgOrders=orders.filter(o=>o.bulkGroupId===selectedBulkGroup.id);
  const actualItems=bgOrders.length;
  const actualCost=bgOrders.reduce((s,o)=>s+(o.totalCost||0),0);
  return (<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setSelectedBulkGroup(null)}>
  <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:500,maxWidth:'94vw',maxHeight:'80vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <h3 style={{fontSize:16,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Layers size={18} color="#4338CA"/> Edit Bulk Order</h3>
      <button onClick={()=>setSelectedBulkGroup(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#64748B"/></button>
    </div>
    <div style={{display:'grid',gap:16}}>
      <div style={{padding:12,background:'#F8FAFB',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:11,color:'#64748B',marginBottom:4}}>Batch ID</div>
          <div className="mono" style={{fontWeight:700,color:'#4338CA'}}>{selectedBulkGroup.id}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11,color:'#64748B',marginBottom:4}}>Actual from Orders</div>
          <div style={{fontSize:12,fontWeight:600}}>{actualItems} items | {fmt(actualCost)}</div>
        </div>
      </div>
      {(selectedBulkGroup.items!==actualItems||Math.abs((selectedBulkGroup.totalCost||0)-actualCost)>0.01)&&(
        <div style={{padding:10,background:'#FEF3C7',borderRadius:8,fontSize:11,color:'#92400E',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span><AlertTriangle size={12} style={{verticalAlign:'middle',marginRight:4}}/>Items/cost mismatch with actual orders</span>
          <button onClick={()=>setSelectedBulkGroup(prev=>({...prev,items:actualItems,totalCost:actualCost}))} style={{padding:'4px 10px',background:'#D97706',color:'#fff',border:'none',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer'}}>Sync</button>
        </div>
      )}
      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Month</label>
          <input value={selectedBulkGroup.month} onChange={e=>setSelectedBulkGroup(prev=>({...prev,month:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Created By</label>
          <select value={selectedBulkGroup.createdBy} onChange={e=>setSelectedBulkGroup(prev=>({...prev,createdBy:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            {users.filter(u=>u.status==='active').map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Items Count</label>
          <input type="number" value={selectedBulkGroup.items} onChange={e=>setSelectedBulkGroup(prev=>({...prev,items:parseInt(e.target.value)||0}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Total Cost (S$)</label>
          <input type="number" step="0.01" value={selectedBulkGroup.totalCost} onChange={e=>setSelectedBulkGroup(prev=>({...prev,totalCost:parseFloat(e.target.value)||0}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
      </div>
      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Status</label>
          <select value={selectedBulkGroup.status} onChange={e=>setSelectedBulkGroup(prev=>({...prev,status:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Processing">Processing</option>
            <option value="Rejected">Rejected</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Date</label>
          <input type="date" value={selectedBulkGroup.date} onChange={e=>setSelectedBulkGroup(prev=>({...prev,date:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginTop:8}}>
        <button onClick={()=>setSelectedBulkGroup(null)} style={{flex:1,padding:'10px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={()=>{
          const origGroup = bulkGroups.find(g=>g.id===selectedBulkGroup.id);
          const oldMonth = origGroup?.month||'';
          const newMonth = selectedBulkGroup.month;
          const oldStatus = origGroup?.status||'';
          const newStatus = selectedBulkGroup.status;
          setBulkGroups(prev=>prev.map(g=>g.id===selectedBulkGroup.id?selectedBulkGroup:g));
          dbSync(api.updateBulkGroup(selectedBulkGroup.id,selectedBulkGroup),'Bulk group edit not saved');
          // If month changed, update orders linked to this bulk group
          if(oldMonth && newMonth && oldMonth!==newMonth){
            setOrders(prev=>prev.map(o=>o.bulkGroupId===selectedBulkGroup.id?{...o,month:newMonth}:o));
            orders.filter(o=>o.bulkGroupId===selectedBulkGroup.id).forEach(o=>{
              dbSync(api.updateOrder(o.id,{month:newMonth}),'Order month sync failed');
            });
          }
          // If status changed to Approved/Rejected, cascade to all linked orders
          if(oldStatus!==newStatus&&(newStatus==='Approved'||newStatus==='Rejected')){
            const approvalStatus=newStatus==='Approved'?'approved':'rejected';
            const linkedOrders=orders.filter(o=>o.bulkGroupId===selectedBulkGroup.id);
            setOrders(prev=>prev.map(o=>o.bulkGroupId===selectedBulkGroup.id?{...o,status:newStatus,approvalStatus}:o));
            linkedOrders.forEach(o=>dbSync(api.updateOrder(o.id,{status:newStatus,approvalStatus}),'Order approval cascade failed'));
          }
          // If manually set to Completed, mark all linked orders as Received with full arrival data
          if(oldStatus!==newStatus&&newStatus==='Completed'){
            const today=new Date().toISOString().slice(0,10);
            const linkedOrders=orders.filter(o=>o.bulkGroupId===selectedBulkGroup.id);
            setOrders(prev=>prev.map(o=>o.bulkGroupId===selectedBulkGroup.id?{...o,status:'Received',approvalStatus:'approved',qtyReceived:o.quantity,backOrder:0,arrivalDate:o.arrivalDate||today}:o));
            linkedOrders.forEach(o=>dbSync(api.updateOrder(o.id,{status:'Received',approvalStatus:'approved',qtyReceived:o.quantity,backOrder:0,arrivalDate:o.arrivalDate||today}),'Order received cascade failed'));
          }
          setSelectedBulkGroup(null);notify('Bulk Order Updated','Changes saved to database','success');
        }} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#4338CA,#6366F1)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>Save Changes</button>
        {selectedBulkGroup.status==='Pending Approval'&&(
          <div style={{gridColumn:'span 2',marginTop:8,padding:12,background:'#FEF3C7',borderRadius:8,fontSize:11,color:'#92400E'}}>
            <strong>Tip:</strong> If you made changes to a pending order, consider resending the approval email to notify the approver of the updates.
          </div>
        )}
      </div>
    </div>
  </div>
</div>);})()}



{/* Edit Order Modal */}
{editingOrder&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setEditingOrder(null)}>
  <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:600,maxWidth:'94vw',maxHeight:'90vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <h3 style={{fontSize:16,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Edit3 size={18} color="#2563EB"/> Edit Order</h3>
      <button onClick={()=>setEditingOrder(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#64748B"/></button>
    </div>

    {/* Warning for pending approval orders */}
    {(editingOrder.status==='Pending Approval'||editingOrder.approvalStatus==='pending')&&(
      <div style={{marginBottom:16,padding:14,background:'#FEF3C7',borderRadius:10,border:'1px solid #FCD34D'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <AlertTriangle size={16} color="#D97706"/>
          <strong style={{fontSize:13,color:'#92400E'}}>Order Pending Approval</strong>
        </div>
        <p style={{fontSize:12,color:'#92400E',lineHeight:1.5}}>This order is awaiting approval. If you make changes, it's recommended to <strong>resend the approval email</strong> to notify the approver of the updates.</p>
      </div>
    )}

    <div style={{display:'grid',gap:14}}>
      <div style={{padding:12,background:'#F8FAFB',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:11,color:'#64748B',marginBottom:2}}>Order ID</div>
          <div className="mono" style={{fontWeight:700,color:'#2563EB'}}>{editingOrder.id}</div>
        </div>
        <Badge status={editingOrder.status}/>
      </div>

      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Material No</label>
          <input value={editingOrder.materialNo||''} onChange={e=>setEditingOrder(prev=>({...prev,materialNo:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}} placeholder="130-XXX-XXX"/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Description</label>
          <input value={editingOrder.description||''} onChange={e=>setEditingOrder(prev=>({...prev,description:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
      </div>

      <div className="grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Quantity</label>
          <input type="number" min="1" value={editingOrder.quantity||1} onChange={e=>{const qty=parseInt(e.target.value)||1;setEditingOrder(prev=>({...prev,quantity:qty,totalCost:qty*(prev.listPrice||0),backOrder:(prev.qtyReceived||0)-qty}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Unit Price (S$)</label>
          <input type="number" step="0.01" min="0" value={editingOrder.listPrice||0} onChange={e=>{const price=parseFloat(e.target.value)||0;setEditingOrder(prev=>({...prev,listPrice:price,totalCost:price*(prev.quantity||1)}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Total Cost</label>
          <div className="mono" style={{padding:'10px 12px',borderRadius:8,background:'#E6F4ED',fontSize:13,fontWeight:600,color:'#0B7A3E'}}>{fmt(editingOrder.totalCost||0)}</div>
        </div>
      </div>

      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Ordered By</label>
          <select value={editingOrder.orderBy||''} onChange={e=>setEditingOrder(prev=>({...prev,orderBy:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="">Select User</option>
            {users.filter(u=>u.status==='active').map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Status</label>
          <select value={editingOrder.status||'Pending Approval'} onChange={e=>{const s=e.target.value;const approvalSync=s==='Approved'?'approved':s==='Rejected'?'rejected':undefined;setEditingOrder(prev=>({...prev,status:s,...(approvalSync?{approvalStatus:approvalSync}:{})}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Back Order">Back Order</option>
            <option value="Received">Received</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Order Date</label>
          <input type="date" value={editingOrder.orderDate||''} onChange={e=>setEditingOrder(prev=>({...prev,orderDate:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Linked Bulk Batch</label>
          <select value={editingOrder.bulkGroupId||''} onChange={e=>{const bgId=e.target.value||null;const bg=bulkGroups.find(g=>g.id===bgId);setEditingOrder(prev=>({...prev,bulkGroupId:bgId,month:bg?bg.month:prev.month}));}} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box'}}>
            <option value="">-- None (Individual) --</option>
            {bulkGroups.map(bg=><option key={bg.id} value={bg.id}>{bg.month} ({bg.id})</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Remark</label>
        <textarea value={editingOrder.remark||''} onChange={e=>setEditingOrder(prev=>({...prev,remark:e.target.value}))} rows={2} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:13,boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}/>
      </div>

      <div style={{display:'flex',gap:10,marginTop:8}}>
        <button onClick={()=>setEditingOrder(null)} style={{flex:1,padding:'12px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={()=>{
          // If manually set to Received, auto-fill arrival fields so it skips Part Arrival
          const isManualReceived = editingOrder.status === 'Received';
          const finalOrder = isManualReceived ? {...editingOrder, qtyReceived: editingOrder.quantity, backOrder: 0, arrivalDate: editingOrder.arrivalDate || new Date().toISOString().slice(0,10), approvalStatus: 'approved'} : editingOrder;
          const updatedOrders = orders.map(o=>o.id===editingOrder.id?finalOrder:o);
          setOrders(updatedOrders);
          const {qtyReceived, backOrder, arrivalDate, ...editFields} = finalOrder;
          // Include arrival fields when manually marking as Received
          const payload = isManualReceived ? {...editFields, qtyReceived, backOrder, arrivalDate} : editFields;
          dbSync(api.updateOrder(editingOrder.id, payload), 'Order edit not saved');
          // Recalculate parent bulk group totals if this order belongs to one
          if(editingOrder.bulkGroupId){
            const bg = bulkGroups.find(g=>g.id===editingOrder.bulkGroupId);
            if(bg){
              const bgOrders = updatedOrders.filter(o=>o.bulkGroupId===bg.id);
              const newItems = bgOrders.length;
              const newTotalCost = bgOrders.reduce((s,o)=>s+(o.totalCost||0),0);
              if(bg.items!==newItems||bg.totalCost!==newTotalCost){
                const updatedBg = {...bg, items:newItems, totalCost:newTotalCost};
                setBulkGroups(prev=>prev.map(g=>g.id===bg.id?updatedBg:g));
                dbSync(api.updateBulkGroup(bg.id,{items:newItems,totalCost:newTotalCost}),'Bulk group tally not synced');
              }
            }
          }
          notify('Order Updated',editingOrder.id+' has been updated','success');
          setEditingOrder(null);
        }} style={{flex:1,padding:'12px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#2563EB,#3B82F6)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer'}}>Save Changes</button>
      </div>

    </div>
  </div>
</div>)}

{/* History Import Preview Modal */}
{historyImportPreview&&historyImportData.length>0&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>{setHistoryImportPreview(false);setHistoryImportData([]);}}>
  <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:'90%',maxWidth:1000,maxHeight:'85vh',overflow:'auto',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{padding:10,background:'linear-gradient(135deg,#4338CA,#6366F1)',borderRadius:12}}><Database size={20} color="#fff"/></div>
        <div>
          <h3 style={{fontSize:17,fontWeight:700}}>Import Preview</h3>
          <p style={{fontSize:12,color:'#64748B'}}>{historyImportData.length} orders ready to import</p>
        </div>
      </div>
      <button onClick={()=>{setHistoryImportPreview(false);setHistoryImportData([]);}} style={{background:'none',border:'none',cursor:'pointer'}}><X size={22} color="#64748B"/></button>
    </div>

    <div style={{marginBottom:16,padding:12,background:'#FEF3C7',borderRadius:8,fontSize:12,color:'#92400E',display:'flex',alignItems:'center',gap:8}}>
      <AlertCircle size={16}/>
      <span>Review the data below before importing. This will add {historyImportData.length} new orders{window.__pendingBulkGroups?.length ? ` + ${window.__pendingBulkGroups.length} bulk batches` : ''} to the system.</span>
    </div>

    <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden',maxHeight:400,overflowY:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead style={{position:'sticky',top:0,background:'#F8FAFB'}}>
          <tr>{['ID','Material No','Description','Qty','Price','Total','Order Date','Order By','Month','Status'].map(h=><th key={h} className="th" style={{padding:'10px 8px',fontSize:10}}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {historyImportData.slice(0,50).map((o,i)=>(
            <tr key={i} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
              <td className="td mono" style={{fontSize:10,color:'#4338CA'}}>{o.id}</td>
              <td className="td mono" style={{fontSize:10}}>{o.materialNo||'—'}</td>
              <td className="td" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</td>
              <td className="td" style={{textAlign:'center',fontWeight:600}}>{o.quantity}</td>
              <td className="td mono">{fmt(o.listPrice)}</td>
              <td className="td mono" style={{fontWeight:600}}>{fmt(o.totalCost)}</td>
              <td className="td" style={{color:'#64748B'}}>{o.orderDate}</td>
              <td className="td"><Pill bg="#DBEAFE" color="#2563EB">{o.orderBy}</Pill></td>
              <td className="td"><Pill bg="#E6F4ED" color="#0B7A3E">{o.month}</Pill></td>
              <td className="td"><Pill bg={o.status==='Received'?'#D1FAE5':o.status==='Back Order'?'#FEF3C7':'#F3F4F6'} color={o.status==='Received'?'#059669':o.status==='Back Order'?'#D97706':'#64748B'}>{o.status}</Pill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {historyImportData.length>50&&<div style={{textAlign:'center',padding:10,fontSize:11,color:'#64748B'}}>Showing first 50 of {historyImportData.length} records</div>}

    <div style={{marginTop:16,padding:14,background:'#F0FDF4',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{fontSize:12}}>
        <strong style={{color:'#059669'}}>Summary:</strong> {historyImportData.length} orders |
        Total Qty: {historyImportData.reduce((s,o)=>s+(Number(o.quantity)||0),0)} |
        Total Value: <strong className="mono">{fmt(historyImportData.reduce((s,o)=>s+(Number(o.totalCost)||0),0))}</strong>
      </div>
      <div style={{display:'flex',gap:10}}>
        <button onClick={()=>{setHistoryImportPreview(false);setHistoryImportData([]);}} style={{padding:'10px 20px',borderRadius:8,border:'1.5px solid #E2E8F0',background:'#fff',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
        <button onClick={confirmHistoryImport} style={{padding:'10px 24px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#059669,#10B981)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><Check size={16}/> Import {historyImportData.length} Orders</button>
      </div>
    </div>
  </div>
</div>)}

{/* ═══════════ SETTINGS ═══════════ */}

{/* ═══════════ AI BOT ADMIN (ADMIN ONLY) ═══════════ */}
{page==='aibot'&&hasPermission('aiBot')&&(<div>
  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
    <div style={{padding:10,background:'linear-gradient(135deg,#006837,#00A550)',borderRadius:12}}><Bot size={22} color="#fff"/></div>
    <div><h2 style={{fontSize:18,fontWeight:700}}>AI Bot Administration</h2><p style={{fontSize:12,color:'#94A3B8'}}>Configure knowledge base, bot behavior, and view conversation logs</p></div>
  </div>

  {/* Tabs */}
  <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'2px solid #E8ECF0',paddingBottom:2}}>
    {[{id:'knowledge',label:'Knowledge Base',icon:Database},{id:'config',label:'Bot Configuration',icon:Settings},{id:'logs',label:'Conversation Logs',icon:MessageCircle}].map(tab=>(
      <button key={tab.id} onClick={()=>setAiAdminTab(tab.id)} style={{
        display:'flex',alignItems:'center',gap:6,padding:'10px 16px',border:'none',
        background:aiAdminTab===tab.id?'#E6F4ED':'transparent',
        color:aiAdminTab===tab.id?'#0B7A3E':'#64748B',fontWeight:600,fontSize:13,
        borderRadius:'8px 8px 0 0',cursor:'pointer',fontFamily:'inherit',
        borderBottom:aiAdminTab===tab.id?'2px solid #0B7A3E':'2px solid transparent',marginBottom:-2
      }}><tab.icon size={15}/> {tab.label}</button>
    ))}
  </div>

  {/* Knowledge Base Tab */}
  {aiAdminTab==='knowledge'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Upload Documents</h3>
        <p style={{fontSize:12,color:'#64748B',marginBottom:16}}>Upload product manuals, spec sheets, and guides. The bot will use these to answer customer questions.</p>
        <label style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          padding:'32px 24px',border:'2px dashed #D1D5DB',borderRadius:12,
          background:'#F9FAFB',cursor:'pointer',transition:'all 0.2s'
        }}>
          <input type="file" multiple accept=".pdf,.xlsx,.csv,.docx,.txt" onChange={handleFileUpload} style={{display:'none'}}/>
          <Upload size={32} color="#9CA3AF" style={{marginBottom:12}}/>
          <span style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Drop files here or click to upload</span>
          <span style={{fontSize:12,color:'#9CA3AF'}}>PDF, XLSX, CSV, DOCX, TXT (max 10MB each)</span>
        </label>
      </div>

      {aiKnowledgeBase.length>0 && (
        <div>
          <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Uploaded Files ({aiKnowledgeBase.length})</h4>
          <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#F8FAFB'}}><th className="th">File Name</th><th className="th">Type</th><th className="th">Size</th><th className="th">Uploaded</th><th className="th" style={{width:60}}></th></tr></thead>
              <tbody>
                {aiKnowledgeBase.map(f=>(
                  <tr key={f.id} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
                    <td className="td" style={{display:'flex',alignItems:'center',gap:8}}><FileText size={14} color="#64748B"/>{f.name}</td>
                    <td className="td"><Pill bg="#EEF2FF" color="#4F46E5">{f.type}</Pill></td>
                    <td className="td" style={{color:'#64748B'}}>{f.size}</td>
                    <td className="td" style={{color:'#94A3B8',fontSize:11}}>{f.uploadedAt}</td>
                    <td className="td"><button onClick={()=>setAiKnowledgeBase(prev=>prev.filter(x=>x.id!==f.id))} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aiKnowledgeBase.length===0 && (
        <div style={{textAlign:'center',padding:'24px',background:'#F8FAFB',borderRadius:10}}>
          <Database size={32} color="#D1D5DB" style={{marginBottom:8}}/>
          <p style={{fontSize:13,color:'#9CA3AF'}}>No files uploaded yet. Upload documents to enhance the bot's knowledge.</p>
        </div>
      )}
    </div>
  )}

  {/* Bot Configuration Tab */}
  {aiAdminTab==='config'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{display:'grid',gap:20}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Preset Template</label>
          <select value={aiBotConfig.template} onChange={e=>setAiBotConfig(prev=>({...prev,template:e.target.value}))} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="sales">Friendly Sales Agent</option>
            <option value="support">Technical Support</option>
            <option value="orders">Order Processing Only</option>
            <option value="custom">Custom (Use instructions below)</option>
          </select>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>
            {aiBotConfig.template==='sales'&&'Professional and helpful, focuses on product information and sales.'}
            {aiBotConfig.template==='support'&&'Technical and detailed, focuses on troubleshooting and specs.'}
            {aiBotConfig.template==='orders'&&'Efficient and direct, focuses only on order-related queries.'}
            {aiBotConfig.template==='custom'&&'Fully customizable using your instructions below.'}
          </p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Custom Instructions</label>
          <textarea value={aiBotConfig.customInstructions} onChange={e=>setAiBotConfig(prev=>({...prev,customInstructions:e.target.value}))} placeholder="Add specific instructions for the bot behavior, rules, and response style..." rows={5} style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13,resize:'vertical',fontFamily:'inherit'}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>These instructions override the template defaults.</p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Greeting Message</label>
          <input type="text" value={aiBotConfig.greeting} onChange={e=>setAiBotConfig(prev=>({...prev,greeting:e.target.value}))} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>First message shown when users open the chat.</p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>AI API Key (for complex queries)</label>
          <input type="password" value={aiBotConfig.apiKey} onChange={e=>setAiBotConfig(prev=>({...prev,apiKey:e.target.value}))} placeholder="sk-..." style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13,fontFamily:'monospace'}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>Optional. Used for AI-powered responses to complex questions. Leave empty for rule-based only.</p>
        </div>

        <button className="bp" onClick={()=>{dbSync(api.setConfigKey('aiBotConfig',aiBotConfig),'Bot config not saved');dbSync(api.setConfigKey('waAutoReply',waAutoReply),'Auto-reply config not saved');notify('Settings Saved','Bot configuration saved to database','success');}} style={{width:'fit-content'}}><Check size={14}/> Save Configuration</button>
      </div>
    </div>
  )}

  {/* Conversation Logs Tab */}
  {aiAdminTab==='logs'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h3 style={{fontSize:15,fontWeight:700}}>Recent Conversations</h3>
        <span style={{fontSize:12,color:'#94A3B8'}}>{aiConversationLogs.length} queries logged</span>
      </div>

      {aiConversationLogs.length>0 ? (
        <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#F8FAFB'}}><th className="th">ID</th><th className="th">User</th><th className="th">Query</th><th className="th">Type</th><th className="th">Time</th></tr></thead>
            <tbody>
              {aiConversationLogs.slice().reverse().map(log=>(
                <tr key={log.id} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
                  <td className="td mono" style={{fontSize:11}}>{log.id}</td>
                  <td className="td">{log.user}</td>
                  <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.query}</td>
                  <td className="td"><Pill bg={log.type==='success'?'#D1FAE5':log.type==='price'?'#DBEAFE':'#F3F4F6'} color={log.type==='success'?'#059669':log.type==='price'?'#2563EB':'#64748B'}>{log.type}</Pill></td>
                  <td className="td" style={{color:'#94A3B8',fontSize:11}}>{new Date(log.time).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{textAlign:'center',padding:'32px',background:'#F8FAFB',borderRadius:10}}>
          <MessageCircle size={32} color="#D1D5DB" style={{marginBottom:8}}/>
          <p style={{fontSize:13,color:'#9CA3AF'}}>No conversations logged yet. Logs will appear here when users interact with the AI assistant.</p>
        </div>
      )}
    </div>
  )}
</div>)}

{page==='settings'&&hasPermission('settings')&&(<div style={{maxWidth:700}}>

  {/* Logo Settings - Admin Only */}
  {hasPermission('settings') && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>App Logo & Branding</h3>
    <div style={{display:'flex',gap:24,alignItems:'flex-start'}}>
      <div style={{width:80,height:80,borderRadius:16,background:customLogo?'#fff':'linear-gradient(135deg,#006837,#00A550)',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #E2E8F0',overflow:'hidden'}}>
        {customLogo ? <img src={customLogo} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/> : <Package size={36} color="#fff"/>}
      </div>
      <div style={{flex:1}}>
        <p style={{fontSize:12,color:'#64748B',marginBottom:12}}>Upload a custom logo (PNG, JPG, SVG). Recommended size: 200x200px</p>
        <div style={{display:'flex',gap:8}}>
          <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 16px',background:'#0B7A3E',color:'#fff',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            <input type="file" accept="image/*" onChange={(e)=>{
              const file = e.target.files[0];
              if(file) {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                  setCustomLogo(evt.target.result);
                  const ok = await api.setConfigKey('customLogo', evt.target.result);
                  if(ok){notify('Logo Updated','New logo saved','success');}else{notify('Upload Failed','Logo not saved to database','error');}
                };
                reader.readAsDataURL(file);
              }
            }} style={{display:'none'}}/>
            <Upload size={14}/> Upload Logo
          </label>
          {customLogo && <button className="bs" onClick={async ()=>{setCustomLogo(null);const ok=await api.setConfigKey('customLogo',null);if(ok){notify('Logo Reset','Default logo restored','info');}else{notify('Reset Failed','Logo not cleared from database','error');}}}><X size={14}/> Remove</button>}
        </div>
      </div>
    </div>
  </div>}

  <div className="card" style={{padding:'24px 28px',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>General</h3><div style={{display:'flex',flexDirection:'column',gap:16}}><div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Company</label><input type="text" defaultValue="Miltenyi Biotec Asia Pacific Pte Ltd" style={{width:'100%'}}/></div><div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Region</label><select defaultValue="Singapore" style={{width:'100%'}}><option>Singapore</option><option>Malaysia</option></select></div><div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Currency</label><select defaultValue="SGD" style={{width:'100%'}}><option>SGD</option><option>USD</option><option>EUR</option></select></div></div></div></div>
  <div className="card" style={{padding:'24px 28px',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>Price Config (Yearly Update)</h3><div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>{[{l:'Year',k:'year',s:1},{l:'EUR/SGD Rate',k:'exchangeRate',s:.01},{l:'SG Markup',k:'sgMarkup',s:.1},{l:'GST',k:'gst',s:.01},{l:'Dist Markup',k:'distMarkup',s:.1},{l:'Special Rate',k:'specialRate',s:.1}].map(f=><div key={f.k}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>{f.l}</label><input type="number" step={f.s} value={priceConfig[f.k]} onChange={e=>setPriceConfig(p=>({...p,[f.k]:parseFloat(e.target.value)}))} style={{width:'100%'}}/></div>)}</div></div>
  <div className="card" style={{padding:'24px 28px',marginBottom:16}}><h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>WhatsApp Baileys Config</h3><div style={{display:'flex',flexDirection:'column',gap:16}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:13}}>Session Status</span><Pill bg={waConnected?'#D1FAE5':'#FEE2E2'} color={waConnected?'#059669':'#DC2626'}>{waConnected?'Connected':'Disconnected'}</Pill></div><div style={{fontSize:12,color:'#64748B',lineHeight:1.6}}>Baileys WhiskeySockets connects to WhatsApp via the Multi-Device protocol. The admin must scan a QR code to authorize the session. Go to <button onClick={()=>setPage('whatsapp')} style={{background:'none',border:'none',color:'#0B7A3E',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600}}>WhatsApp page</button> to manage.</div></div></div>

  {/* Email Configuration - Admin Only */}
  {hasPermission('settings') && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>Email Sender Configuration</h3>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13}}>Email Notifications</span>
        <Toggle active={emailConfig.enabled} onClick={()=>setEmailConfig(prev=>({...prev,enabled:!prev.enabled}))} color="#0B7A3E"/>
      </div>
      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Sender Name</label>
          <input type="text" value={emailConfig.senderName} onChange={e=>setEmailConfig(prev=>({...prev,senderName:e.target.value}))} placeholder="Company Name" style={{width:'100%'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Sender Email</label>
          <input type="email" value={emailConfig.senderEmail} onChange={e=>setEmailConfig(prev=>({...prev,senderEmail:e.target.value}))} placeholder="noreply@company.com" style={{width:'100%'}}/>
        </div>
      </div>
      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>SMTP Host (Optional)</label>
          <input type="text" value={emailConfig.smtpHost} onChange={e=>setEmailConfig(prev=>({...prev,smtpHost:e.target.value}))} placeholder="smtp.gmail.com" style={{width:'100%'}}/>
        </div>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>SMTP Port</label>
          <input type="number" value={emailConfig.smtpPort} onChange={e=>setEmailConfig(prev=>({...prev,smtpPort:parseInt(e.target.value)}))} style={{width:'100%'}}/>
        </div>
      </div>
      <div style={{fontSize:11,color:'#94A3B8'}}>Email notifications will be sent from this address. Configure SMTP for production use.</div>
    </div>
  </div>}

  {/* Order Approval Email Configuration - Admin Only */}
  {hasPermission('settings') && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20,display:'flex',alignItems:'center',gap:10}}><Shield size={18} color="#7C3AED"/> Order Approval Workflow</h3>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <span style={{fontSize:13,fontWeight:500}}>Require Approval for Orders</span>
          <div style={{fontSize:11,color:'#64748B'}}>Orders require approval before processing</div>
        </div>
        <Toggle active={emailConfig.approvalEnabled} onClick={()=>setEmailConfig(prev=>({...prev,approvalEnabled:!prev.approvalEnabled}))} color="#7C3AED"/>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Approver Email (Hotmail/Outlook)</label>
        <input type="email" value={emailConfig.approverEmail||''} onChange={e=>setEmailConfig(prev=>({...prev,approverEmail:e.target.value}))} placeholder="approver@hotmail.com or approver@outlook.com" style={{width:'100%'}}/>
        <div style={{fontSize:11,color:'#64748B',marginTop:4}}>Approval requests will be sent to this email address</div>
      </div>
      <div>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Approval Trigger Keywords</label>
        <input type="text" value={(emailConfig.approvalKeywords||[]).join(', ')} onChange={e=>setEmailConfig(prev=>({...prev,approvalKeywords:e.target.value.split(',').map(k=>k.trim().toLowerCase()).filter(k=>k)}))} placeholder="approve, approved, yes, confirm" style={{width:'100%'}}/>
        <div style={{fontSize:11,color:'#64748B',marginTop:4}}>Keywords in reply that trigger approval (comma-separated)</div>
      </div>
      {pendingApprovals.length>0 && (
        <div style={{marginTop:8}}>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Pending Approvals ({pendingApprovals.filter(a=>a.status==='pending').length}){selApprovals.size>0&&<span style={{color:'#2563EB',marginLeft:8}}>{selApprovals.size} selected</span>}</label>
          {selApprovals.size>0 && <div style={{display:'flex',gap:6,marginBottom:8}}>
            <button onClick={()=>batchApprovalAction('approved')} style={{padding:'5px 12px',background:'#059669',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><CheckCircle size={12}/> Approve All ({selApprovals.size})</button>
            <button onClick={()=>batchApprovalAction('rejected')} style={{padding:'5px 12px',background:'#DC2626',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><X size={12}/> Reject All ({selApprovals.size})</button>
            <button onClick={()=>setSelApprovals(new Set())} style={{padding:'5px 12px',background:'#64748B',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>Clear</button>
          </div>}
          <div style={{maxHeight:250,overflow:'auto',border:'1px solid #E8ECF0',borderRadius:8}}>
            {pendingApprovals.filter(a=>a.status==='pending').map(a=>(
              <div key={a.id} style={{padding:12,borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',justifyContent:'space-between',background:selApprovals.has(a.id)?'#EDE9FE':'#fff'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <SelBox checked={selApprovals.has(a.id)} onChange={()=>toggleSel(selApprovals,setSelApprovals,a.id)}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600}}>{a.orderId} - {a.description}</div>
                    <div style={{fontSize:11,color:'#64748B'}}>By: {a.requestedBy} | Qty: {a.quantity} | S${a.totalCost?.toFixed(2)||'0.00'}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>handleApprovalAction(a.id,'approved')} style={{padding:'6px 12px',background:'#D1FAE5',color:'#059669',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>Approve</button>
                  <button onClick={()=>handleApprovalAction(a.id,'rejected')} style={{padding:'6px 12px',background:'#FEE2E2',color:'#DC2626',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{fontSize:11,color:'#94A3B8',background:'#F8FAFB',padding:12,borderRadius:8}}>
        <strong>How it works:</strong> When an order is created, an approval email opens in your mail client. The approver replies with a trigger keyword. Use the manual approval buttons above, or integrate with Microsoft Graph API for automatic reply detection.
      </div>
    </div>
  </div>}

  {/* Email & Notification Templates - Admin Only */}
  {hasPermission('settings') && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20,display:'flex',alignItems:'center',gap:10}}><FileText size={18} color="#2563EB"/> Email & Notification Templates</h3>
    <p style={{fontSize:12,color:'#64748B',marginBottom:16}}>Customize email templates for approvals, notifications, and alerts. Use {'{placeholder}'} variables that get replaced with actual data.</p>
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {(typeof emailTemplates === 'object' && emailTemplates ? Object.entries(emailTemplates) : []).map(([key, tmpl]) => {
        const labels = { orderApproval: 'Order Approval', bulkApproval: 'Bulk Order Approval', orderNotification: 'Order Notification', backOrderAlert: 'Back Order Alert', monthlySummary: 'Monthly Summary' };
        const icons = { orderApproval: Shield, bulkApproval: Layers, orderNotification: Bell, backOrderAlert: AlertTriangle, monthlySummary: BarChart3 };
        const Icon = icons[key] || Mail;
        return (
          <div key={key} style={{border:'1px solid #E8ECF0',borderRadius:10,overflow:'hidden'}}>
            <div onClick={()=>setEditingTemplate(editingTemplate===key?null:key)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',cursor:'pointer',background:editingTemplate===key?'#EEF2FF':'#F8FAFB'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <Icon size={14} color={editingTemplate===key?'#4338CA':'#64748B'}/>
                <span style={{fontSize:13,fontWeight:600,color:editingTemplate===key?'#4338CA':'#374151'}}>{labels[key]||key}</span>
              </div>
              <ChevronDown size={14} color="#64748B" style={{transform:editingTemplate===key?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>
            {editingTemplate===key && (
              <div style={{padding:16,borderTop:'1px solid #E8ECF0'}}>
                <div style={{marginBottom:12}}>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Subject Line</label>
                  <input value={tmpl.subject} onChange={e=>setEmailTemplates(prev=>({...prev,[key]:{...prev[key],subject:e.target.value}}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1.5px solid #E2E8F0',fontSize:12,boxSizing:'border-box'}}/>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Body</label>
                  <textarea value={tmpl.body} onChange={e=>setEmailTemplates(prev=>({...prev,[key]:{...prev[key],body:e.target.value}}))} rows={8} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1.5px solid #E2E8F0',fontSize:11,fontFamily:'monospace',resize:'vertical',boxSizing:'border-box',lineHeight:1.5}}/>
                </div>
                <div style={{padding:8,background:'#F0FDF4',borderRadius:6,fontSize:10,color:'#065F46'}}>
                  <strong>Variables:</strong> {'{orderId}'}, {'{description}'}, {'{materialNo}'}, {'{quantity}'}, {'{totalCost}'}, {'{orderBy}'}, {'{date}'}, {'{month}'}, {'{batchId}'}, {'{itemCount}'}, {'{received}'}, {'{pending}'}, {'{backOrders}'}, {'{totalOrders}'}, {'{totalValue}'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
    <div style={{marginTop:12,display:'flex',gap:8}}>
      <button className="bp" style={{fontSize:12}} onClick={async ()=>{const ok=await api.setConfigKey('emailTemplates',emailTemplates);if(ok){notify('Templates Saved','Email templates saved to database','success');}else{notify('Save Failed','Email templates not saved to database','error');}}}>Save Templates</button>
      <button className="bs" style={{fontSize:12}} onClick={()=>{setEmailTemplates({
        orderApproval: { subject: '[APPROVAL] Order {orderId} - {description}', body: 'Order Approval Request\n\nOrder ID: {orderId}\nDescription: {description}\nMaterial No: {materialNo}\nQuantity: {quantity}\nTotal: S${totalCost}\nRequested By: {orderBy}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG' },
        bulkApproval: { subject: '[APPROVAL] Bulk Order {batchId} - {month}', body: 'Bulk Order Approval Request\n\nBatch ID: {batchId}\nMonth: {month}\nItems: {itemCount}\nTotal Cost: S${totalCost}\nRequested By: {orderBy}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG' },
        orderNotification: { subject: 'New Order: {orderId} - {description}', body: 'A new order has been created.\n\nOrder ID: {orderId}\nItem: {description}\nMaterial: {materialNo}\nQuantity: {quantity}\nTotal: S${totalCost}\nOrdered By: {orderBy}\nDate: {date}\n\n-Miltenyi Inventory Hub SG' },
        backOrderAlert: { subject: 'Back Order Alert: {description}', body: 'Back Order Alert\n\nThe following item is on back order:\n\nOrder ID: {orderId}\nItem: {description}\nOrdered: {quantity}\nReceived: {received}\nPending: {pending}\n\nPlease follow up with HQ.\n\n-Miltenyi Inventory Hub SG' },
        monthlySummary: { subject: 'Monthly Summary - {month}', body: 'Monthly Inventory Summary\n\nMonth: {month}\nTotal Orders: {totalOrders}\nReceived: {received}\nPending: {pending}\nBack Orders: {backOrders}\nTotal Value: S${totalValue}\n\n-Miltenyi Inventory Hub SG' }
      });notify('Templates Reset','Restored default templates','info');}}>Reset Defaults</button>
    </div>
  </div>}

  {/* WhatsApp Sender Assignment - Admin Only */}
  {hasPermission('settings') && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <h3 style={{fontSize:15,fontWeight:600,marginBottom:20}}>WhatsApp Sender Assignment</h3>
    <p style={{fontSize:12,color:'#64748B',marginBottom:16}}>Assign users who can connect their WhatsApp to send notifications on behalf of the system.</p>

    <div style={{marginBottom:16}}>
      <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Allowed Senders</label>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
        {(Array.isArray(waAllowedSenders) ? waAllowedSenders : []).map(username => {
          const user = users.find(u => u.username === username);
          return (
            <div key={username} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:'#E6F4ED',borderRadius:20,fontSize:12}}>
              <span style={{fontWeight:600,color:'#0B7A3E'}}>{user?.name || username}</span>
              {username !== 'admin' && (
                <button onClick={()=>setWaAllowedSenders(prev=>prev.filter(u=>u!==username))} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:0,display:'flex'}}><X size={14}/></button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:8}}>
        <select id="addWaSender" style={{flex:1}} defaultValue="">
          <option value="" disabled>Select user to add...</option>
          {users.filter(u => u.status === 'active' && !waAllowedSenders.includes(u.username)).map(u => (
            <option key={u.id} value={u.username}>{u.name} ({u.username})</option>
          ))}
        </select>
        <button className="bp" style={{padding:'8px 16px'}} onClick={()=>{
          const select = document.getElementById('addWaSender');
          if(select.value) {
            setWaAllowedSenders(prev=>[...prev, select.value]);
            notify('Sender Added', `${select.value} can now connect WhatsApp`, 'success');
            select.value = '';
          }
        }}><Plus size={14}/> Add</button>
      </div>
    </div>

    <div style={{padding:12,background:'#F8FAFB',borderRadius:8,fontSize:12,color:'#64748B'}}>
      <strong>How it works:</strong> Assigned users can go to the WhatsApp page and scan QR code with their phone. Their WhatsApp will be used to send system notifications.
    </div>
  </div>}

  {/* History Data Import - Admin Only */}
  {hasPermission('settings') && <div className="card" style={{padding:'24px 28px',marginBottom:16}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
      <div style={{padding:8,background:'linear-gradient(135deg,#4338CA,#6366F1)',borderRadius:10}}><Database size={18} color="#fff"/></div>
      <div>
        <h3 style={{fontSize:15,fontWeight:600}}>Import Historical Data</h3>
        <p style={{fontSize:11,color:'#64748B'}}>Upload Excel/CSV files to import past order records</p>
      </div>
    </div>

    <div style={{marginBottom:16}}>
      <label style={{
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        padding:'28px 24px',border:'2px dashed #C7D2FE',borderRadius:12,
        background:'#EEF2FF',cursor:'pointer',transition:'all 0.2s'
      }}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleHistoryImport} style={{display:'none'}}/>
        <Upload size={28} color="#6366F1" style={{marginBottom:10}}/>
        <span style={{fontSize:13,fontWeight:600,color:'#4338CA',marginBottom:4}}>Drop Excel or CSV file to upload</span>
        <span style={{fontSize:11,color:'#6B7280'}}>Supports .xlsx (multi-sheet) and .csv formats</span>
      </label>
    </div>

    <div style={{padding:14,background:'#F8FAFB',borderRadius:10,fontSize:12}}>
      <div style={{fontWeight:600,marginBottom:8,color:'#374151'}}>Expected CSV Columns:</div>
      <div className="grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,fontSize:11,color:'#64748B'}}>
        <div>• Material No</div>
        <div>• Description</div>
        <div>• Quantity</div>
        <div>• Price / List Price</div>
        <div>• Total Cost</div>
        <div>• Order Date</div>
        <div>• Order By / Created By</div>
        <div>• Status</div>
        <div>• Month / Batch</div>
        <div>• Received / Qty Received</div>
        <div>• Arrival Date</div>
        <div>• Remark / Notes</div>
      </div>
      <div style={{marginTop:10,padding:8,background:'#DBEAFE',borderRadius:6,fontSize:11,color:'#1E40AF'}}>
        <strong>Excel multi-sheet:</strong> Each sheet tab name becomes a bulk order month batch. Orders are auto-grouped by sheet.
      </div>
      <div style={{marginTop:6,padding:8,background:'#FEF3C7',borderRadius:6,fontSize:11,color:'#92400E'}}>
        <strong>Tip:</strong> Column headers are flexible and auto-mapped. Use any of the expected column names above.
      </div>
    </div>

    {orders.length > 0 && (
      <div style={{marginTop:16,padding:12,background:'#E6F4ED',borderRadius:8,fontSize:12}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div><strong style={{color:'#0B7A3E'}}>{orders.length}</strong> orders currently in system | <strong style={{color:'#4338CA'}}>{bulkGroups.length}</strong> bulk batches</div>
          <div style={{color:'#64748B',fontSize:11}}>Last import will add to existing records</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={async ()=>{if(window.confirm('Clear ALL orders? This cannot be undone. Bulk group totals will be reset to 0.')){setOrders([]);setBulkGroups(prev=>prev.map(bg=>({...bg,items:0,totalCost:0})));const ok=await api.clearOrders();if(ok){bulkGroups.forEach(bg=>dbSync(api.updateBulkGroup(bg.id,{items:0,totalCost:0}),'Bulk group reset'));notify('Orders Cleared','All orders removed, bulk group totals reset','info');}else{notify('Clear Failed','Orders not cleared from database','error');}}}} style={{padding:'6px 14px',background:'#DC2626',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><Trash2 size={12}/> Clear All Orders</button>
          <button onClick={async ()=>{if(window.confirm('Clear ALL bulk batches and their linked orders? This cannot be undone.')){const bgOrderIds=orders.filter(o=>o.bulkGroupId).map(o=>o.id);setOrders(prev=>prev.filter(o=>!o.bulkGroupId));setBulkGroups([]);const deleteResults=await Promise.all([api.clearBulkGroups(),...bgOrderIds.map(id=>api.deleteOrder(id))]);const failed=deleteResults.filter(r=>!r).length;if(failed===0){notify('Bulk Orders Cleared',`All bulk batches + ${bgOrderIds.length} linked orders removed`,'info');}else{notify('Partial Clear',`Bulk batches cleared but ${failed} order deletes failed`,'warning');}}}} style={{padding:'6px 14px',background:'#7C3AED',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><Trash2 size={12}/> Clear Bulk Batches</button>
          <button onClick={async ()=>{if(window.confirm('Clear ALL data (orders + bulk batches + notifications)? This cannot be undone.')){setOrders([]);setBulkGroups([]);setNotifLog([]);setPendingApprovals([]);const results=await Promise.all([api.clearOrders(),api.clearBulkGroups(),api.clearNotifLog(),api.clearApprovals()]);Object.values(LS_KEYS).forEach(k=>localStorage.removeItem(k));const failed=results.filter(r=>!r).length;if(failed===0){notify('All Data Cleared','System reset complete','info');}else{notify('Partial Clear',`${results.length-failed}/${results.length} clears succeeded. Some data may not be cleared from database.`,'warning');}}}} style={{padding:'6px 14px',background:'#374151',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><RefreshCw size={12}/> Reset All Data</button>
        </div>
      </div>
    )}
  </div>}

  {/* ── Admin Parts Catalog Management ── */}
  {hasPermission('settings') && <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,.06)',marginBottom:20}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
      <div><h3 style={{fontSize:15,fontWeight:700,color:'#1E293B',margin:0}}>Parts Catalog Management</h3><div style={{fontSize:12,color:'#64748B',marginTop:4}}>Current catalog: {partsCatalog.length} parts</div></div>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <label style={{padding:'8px 16px',background:'linear-gradient(135deg,#4338CA,#6366F1)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
        <Upload size={14}/> Upload Catalog (.xlsx/.csv)
        <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={async(e)=>{
          const file=e.target.files[0]; if(!file) return;
          const data=await file.arrayBuffer();
          const wb=XLSX.read(data,{type:'array'});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json(ws);
          if(!rows.length){notify('Upload Failed','No data found in file','warning');e.target.value='';return;}
          const headers=Object.keys(rows[0]);
          const hm={'material no':'m','material_no':'m','materialno':'m','mat no':'m','material number':'m','part no':'m','part number':'m','description':'d','desc':'d','name':'d','category':'c','cat':'c','sg price':'sg','singapore price':'sg','sg_price':'sg','sgprice':'sg','dist price':'dist','distributor price':'dist','dist_price':'dist','distprice':'dist','transfer price':'tp','transfer_price':'tp','transferprice':'tp','rsp eur':'rsp','rsp_eur':'rsp','rspeur':'rsp','rsp':'rsp','list price':'tp','listprice':'tp','price':'tp','unit price':'tp'};
          const autoMap={m:'',d:'',c:'',sg:'',dist:'',tp:'',rsp:''};
          headers.forEach(h=>{const nk=hm[h.toLowerCase().trim()];if(nk&&!autoMap[nk])autoMap[nk]=h;});
          setCatalogMapperData({rows,headers,fileName:file.name});
          setCatalogColumnMap(autoMap);
          setShowCatalogMapper(true);
          e.target.value='';
        }}/>
      </label>
      <button onClick={async ()=>{if(window.confirm(`Clear all ${partsCatalog.length} parts from catalog? You will need to re-upload a catalog file.`)){setPartsCatalog([]);const ok=await api.clearCatalog();if(ok){notify('Catalog Cleared','Parts catalog cleared from database','success');}else{notify('Warning','Catalog cleared locally but failed to clear from database. Changes may not persist.','error');}}}} style={{padding:'8px 16px',background:'#DC2626',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Clear Catalog</button>
      <button onClick={async ()=>{const cat=await api.getCatalog();if(cat&&cat.length){setPartsCatalog(cat.map(p=>({m:p.materialNo,d:p.description,c:p.category,sg:p.sgPrice,dist:p.distPrice,tp:p.transferPrice,rsp:p.rspEur})));notify('Catalog Reloaded',`${cat.length} parts loaded from database`,'success');}else{notify('No Catalog','No parts found in database. Please upload a catalog file.','error');}}} style={{padding:'8px 16px',background:'#059669',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><RefreshCw size={14}/> Reload from DB</button>
    </div>
  </div>}

  <div style={{display:'flex',gap:10}}><button className="bp" onClick={async ()=>{const results=await Promise.all([api.setConfigKey('emailConfig',emailConfig),api.setConfigKey('emailTemplates',emailTemplates),api.setConfigKey('priceConfig',priceConfig),api.setConfigKey('waNotifyRules',waNotifyRules),api.setConfigKey('scheduledNotifs',scheduledNotifs),api.setConfigKey('customLogo',customLogo),api.setConfigKey('waAllowedSenders',waAllowedSenders)]);const failed=results.filter(r=>!r).length;if(failed===0){notify('Saved','All settings saved to database','success');}else if(failed===results.length){notify('Save Failed','Could not connect to database. Settings saved locally only.','error');}else{notify('Partial Save',`${results.length-failed}/${results.length} settings saved to database`,'warning');}}}>Save</button><button className="bs">Reset</button></div>
</div>)}

        </div>
      </main>

      {/* ═══ CATALOG COLUMN MAPPER MODAL ═══ */}
      {showCatalogMapper&&<div className="mo" onClick={()=>setShowCatalogMapper(false)}><div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:680,maxWidth:'94vw',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}><div><h2 style={{fontSize:18,fontWeight:700,margin:0}}>Map Column Headers</h2><div style={{fontSize:12,color:'#64748B',marginTop:4}}>File: <strong>{catalogMapperData.fileName}</strong> — {catalogMapperData.rows.length} rows detected</div></div><button onClick={()=>setShowCatalogMapper(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button></div>
        <div style={{fontSize:12,color:'#64748B',marginBottom:16,padding:'10px 14px',background:'#F0F9FF',border:'1px solid #BAE6FD',borderRadius:8}}>Match each catalog field to a column from your file. Fields marked * are required. Auto-detected mappings are pre-selected.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
          {[{key:'m',label:'Material No. *',required:true},{key:'d',label:'Description *',required:true},{key:'c',label:'Category'},{key:'sg',label:'SG Price'},{key:'dist',label:'Distributor Price'},{key:'tp',label:'Transfer Price'},{key:'rsp',label:'RSP EUR'}].map(f=>(
            <div key={f.key} style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:12,fontWeight:600,color:f.required?'#1E293B':'#475569'}}>{f.label}</label>
              <select value={catalogColumnMap[f.key]} onChange={e=>setCatalogColumnMap(prev=>({...prev,[f.key]:e.target.value}))} style={{padding:'8px 10px',borderRadius:6,border:catalogColumnMap[f.key]?'2px solid #059669':'1px solid #E2E8F0',fontSize:12,background:catalogColumnMap[f.key]?'#F0FDF4':'#fff'}}>
                <option value="">— Not mapped —</option>
                {catalogMapperData.headers.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>
        {/* Preview */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:8}}>Preview (first 5 rows)</div>
          <div style={{overflowX:'auto',border:'1px solid #E2E8F0',borderRadius:8}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead><tr style={{background:'#F8FAFB'}}>{['Material No','Description','Category','SG Price','Dist Price','Transfer Price','RSP EUR'].map(h=><th key={h} className="th" style={{whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
              <tbody>{catalogMapperData.rows.slice(0,5).map((r,i)=>{
                const cm=catalogColumnMap;
                return <tr key={i} style={{borderBottom:'1px solid #F0F2F5'}}>
                  <td className="td mono" style={{fontSize:10,color:'#0B7A3E'}}>{cm.m?r[cm.m]||'':''}</td>
                  <td className="td" style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cm.d?r[cm.d]||'':''}</td>
                  <td className="td">{cm.c?r[cm.c]||'':''}</td>
                  <td className="td mono" style={{textAlign:'right'}}>{cm.sg?r[cm.sg]||'':''}</td>
                  <td className="td mono" style={{textAlign:'right'}}>{cm.dist?r[cm.dist]||'':''}</td>
                  <td className="td mono" style={{textAlign:'right'}}>{cm.tp?r[cm.tp]||'':''}</td>
                  <td className="td mono" style={{textAlign:'right'}}>{cm.rsp?r[cm.rsp]||'':''}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button className="bs" onClick={()=>setShowCatalogMapper(false)}>Cancel</button>
          <button className="bp" disabled={!catalogColumnMap.m||!catalogColumnMap.d} onClick={async()=>{
            const cm=catalogColumnMap;
            const mapped=catalogMapperData.rows.map(r=>{
              const o={};
              if(cm.m)o.m=String(r[cm.m]||'');
              if(cm.d)o.d=String(r[cm.d]||'');
              if(cm.c)o.c=String(r[cm.c]||'');
              if(cm.sg)o.sg=parseFloat(r[cm.sg])||0;
              if(cm.dist)o.dist=parseFloat(r[cm.dist])||0;
              if(cm.tp)o.tp=parseFloat(r[cm.tp])||0;
              if(cm.rsp)o.rsp=parseFloat(r[cm.rsp])||0;
              return o;
            }).filter(p=>p.m&&p.d);
            if(!mapped.length){notify('Upload Failed','No valid parts found after mapping','warning');return;}
            setPartsCatalog(mapped);
            const uploadResult=await api.uploadCatalog(mapped.map(p=>({materialNo:p.m,description:p.d,category:p.c||'',sgPrice:p.sg||0,distPrice:p.dist||0,transferPrice:p.tp||0,rspEur:p.rsp||0})));
            if(uploadResult){notify('Catalog Uploaded',`${mapped.length} parts saved to database from ${catalogMapperData.fileName}`,'success');}else{notify('Upload Warning',`${mapped.length} parts loaded locally but failed to save to database`,'error');}
            setShowCatalogMapper(false);
          }} style={{opacity:(!catalogColumnMap.m||!catalogColumnMap.d)?0.5:1}}>Upload {catalogMapperData.rows.length} Parts</button>
        </div>
      </div></div>}

      {/* ═══ NEW ORDER MODAL ═══ */}
      {showNewOrder&&<div className="mo" onClick={()=>setShowNewOrder(false)}><div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:520,maxWidth:'94vw',maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:24}}><h2 style={{fontSize:18,fontWeight:700}}>New Order</h2><button onClick={()=>setShowNewOrder(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button></div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Material No. *</label><input value={newOrder.materialNo} onChange={e=>{setNewOrder(p=>({...p,materialNo:e.target.value}));if(e.target.value.length>=10)handleMaterialLookup(e.target.value);}} placeholder="e.g. 130-097-866" style={{width:'100%'}}/></div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Description</label><input value={newOrder.description} onChange={e=>setNewOrder(p=>({...p,description:e.target.value}))} style={{width:'100%'}}/></div>
          <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Quantity</label><input type="number" min="1" value={newOrder.quantity} onChange={e=>setNewOrder(p=>({...p,quantity:e.target.value}))} style={{width:'100%'}}/></div>
            <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Transfer Price</label><input type="number" step=".01" value={newOrder.listPrice} onChange={e=>setNewOrder(p=>({...p,listPrice:e.target.value}))} style={{width:'100%'}}/></div>
          </div>
          {newOrder.materialNo&&catalogLookup[newOrder.materialNo]&&<div style={{padding:12,borderRadius:8,background:'#F0FDF4',border:'1px solid #BBF7D0',fontSize:12}}><strong style={{color:'#0B7A3E'}}>✓ Catalog Match</strong><div className="grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:6}}>
            <div>SG: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].sg)}</strong></div><div>Dist: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].dist)}</strong></div><div>TP: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].tp)}</strong></div></div></div>}
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Order By</label><select value={newOrder.orderBy} onChange={e=>setNewOrder(p=>({...p,orderBy:e.target.value}))} style={{width:'100%'}}><option value="">— Select —</option>{users.filter(u=>u.status==='active').map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Link to Bulk Batch <span style={{fontWeight:400,color:'#94A3B8'}}>(optional)</span></label>
            <select value={newOrder.bulkGroupId||''} onChange={e=>{const v=e.target.value;if(v==='__new__'){setNewOrder(p=>({...p,bulkGroupId:'__new__'}));setNewBulkMonth(MONTH_OPTIONS[0]);}else{setNewOrder(p=>({...p,bulkGroupId:v}));setNewBulkMonth('');}}} style={{width:'100%'}}>
              <option value="">-- None (Individual Order) --</option>
              {bulkGroups.filter(bg=>bg.status!=='Completed').map(bg=><option key={bg.id} value={bg.id}>{bg.month} ({bg.id}) — {bg.items} items, {fmt(bg.totalCost)}</option>)}
              <option value="__new__">+ Create New Bulk Batch...</option>
            </select>
            {newOrder.bulkGroupId==='__new__'&&<div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
              <select value={newBulkMonth} onChange={e=>setNewBulkMonth(e.target.value)} style={{flex:1}}>{MONTH_OPTIONS.map(m=><option key={m}>{m}</option>)}</select>
              <button type="button" onClick={()=>{if(!newBulkMonth)return;const bgId=`BG-${String(bulkGroups.length+1).padStart(3,'0')}`;const bg={id:bgId,month:newBulkMonth,createdBy:currentUser?.name||'',items:0,totalCost:0,status:'Pending Approval',date:new Date().toISOString().slice(0,10)};setBulkGroups(prev=>[bg,...prev]);dbSync(api.createBulkGroup(bg),'New bulk group not saved');setNewOrder(p=>({...p,bulkGroupId:bgId}));setNewBulkMonth('');notify('Bulk Batch Created',`${bgId} — ${newBulkMonth}`,'success');}} style={{padding:'6px 14px',background:'#4338CA',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Create</button>
            </div>}
          </div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Remark</label><textarea value={newOrder.remark} onChange={e=>setNewOrder(p=>({...p,remark:e.target.value}))} rows={2} style={{width:'100%',resize:'vertical'}}/></div>

          <div style={{padding:10,borderRadius:8,background:'#EDE9FE',border:'1px solid #DDD6FE',fontSize:11,color:'#5B21B6',display:'flex',alignItems:'center',gap:6}}>
            <AlertCircle size={13}/> After creating, select orders and use <strong>"Order Approval & Notify"</strong> to send for approval.
          </div>

          <div style={{display:'flex',gap:10}}><button className="bp" onClick={handleSubmitOrder} disabled={isSubmitting} style={{flex:1,opacity:isSubmitting?.6:1}}><Plus size={14}/> {isSubmitting?'Creating...':'Create Order'}</button><button className="bs" onClick={()=>setShowNewOrder(false)}>Cancel</button></div>
        </div>
      </div></div>}

      {/* ═══ BULK ORDER MODAL ═══ */}
      {showBulkOrder&&<div className="mo" onClick={()=>setShowBulkOrder(false)}><div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:700,maxWidth:'94vw',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <div><h2 style={{fontSize:18,fontWeight:700}}>Create Monthly Bulk Order</h2><p style={{fontSize:12,color:'#94A3B8',marginTop:4}}>Group multiple items under one monthly batch</p></div>
          <button onClick={()=>setShowBulkOrder(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button>
        </div>
        <div className="grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Month Group *</label><select value={bulkMonth} onChange={e=>setBulkMonth(e.target.value)} style={{width:'100%'}}>{MONTH_OPTIONS.map(m=><option key={m}>{m}</option>)}</select></div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Order By</label><select value={bulkOrderBy} onChange={e=>setBulkOrderBy(e.target.value)} style={{width:'100%'}}><option value="">— Select —</option>{users.filter(u=>u.status==='active').map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Batch Remark</label><input value={bulkRemark} onChange={e=>setBulkRemark(e.target.value)} placeholder="e.g. Quarterly restock" style={{width:'100%'}}/></div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{fontWeight:600,fontSize:13}}>Order Items ({bulkItems.length})</span>
            <button className="bs" style={{padding:'6px 12px',fontSize:12}} onClick={addBulkItem}><Plus size={13}/> Add Item</button>
          </div>
          <div style={{maxHeight:340,overflow:'auto',border:'1px solid #E2E8F0',borderRadius:10}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#F8FAFB',position:'sticky',top:0}}><th className="th" style={{padding:'8px 10px'}}>Material No.</th><th className="th" style={{padding:'8px 10px'}}>Description</th><th className="th" style={{padding:'8px 10px',width:70}}>Qty</th><th className="th" style={{padding:'8px 10px',width:100}}>TP Price</th><th className="th" style={{padding:'8px 10px',width:100}}>Total</th><th className="th" style={{padding:'8px 10px',width:40}}></th></tr></thead>
              <tbody>{bulkItems.map((item,idx)=>(
                <tr key={idx} style={{borderBottom:'1px solid #F0F2F5'}}>
                  <td style={{padding:'8px 10px'}}><input value={item.materialNo} onChange={e=>updateBulkItem(idx,'materialNo',e.target.value)} placeholder="130-XXX-XXX" style={{width:'100%',padding:'6px 8px',fontSize:11}}/></td>
                  <td style={{padding:'8px 10px'}}><input value={item.description} onChange={e=>updateBulkItem(idx,'description',e.target.value)} placeholder="Auto-fills from catalog" style={{width:'100%',padding:'6px 8px',fontSize:11}}/></td>
                  <td style={{padding:'8px 10px'}}><input type="number" min="1" value={item.quantity} onChange={e=>updateBulkItem(idx,'quantity',e.target.value)} style={{width:'100%',padding:'6px 8px',fontSize:11,textAlign:'center'}}/></td>
                  <td style={{padding:'8px 10px'}}><input type="number" step=".01" value={item.listPrice} onChange={e=>updateBulkItem(idx,'listPrice',e.target.value)} style={{width:'100%',padding:'6px 8px',fontSize:11}}/></td>
                  <td className="mono" style={{padding:'8px 10px',textAlign:'right',fontSize:11,fontWeight:600}}>{fmt((parseFloat(item.listPrice)||0)*(parseInt(item.quantity)||0))}</td>
                  <td style={{padding:'8px 10px'}}>{bulkItems.length>1&&<button onClick={()=>removeBulkItem(idx)} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={13}/></button>}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',padding:'10px 0',fontSize:13,fontWeight:600}}>
            Batch Total: <span className="mono" style={{color:'#0B7A3E',marginLeft:8}}>{fmt(bulkItems.reduce((s,i)=>(s+(parseFloat(i.listPrice)||0)*(parseInt(i.quantity)||0)),0))}</span>
          </div>
        </div>

        {/* Auto-Notify Status */}
        <div style={{padding:12,borderRadius:8,background:'#F8FAFB',border:'1px solid #E2E8F0',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Auto-Notifications on Create:</div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
              <Mail size={12} color={emailConfig.enabled&&waNotifyRules.bulkOrderCreated?'#059669':'#9CA3AF'}/>
              <span style={{color:emailConfig.enabled&&waNotifyRules.bulkOrderCreated?'#059669':'#9CA3AF'}}>Email {emailConfig.enabled&&waNotifyRules.bulkOrderCreated?'✓':'Off'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
              <MessageSquare size={12} color={waConnected&&waNotifyRules.bulkOrderCreated?'#25D366':'#9CA3AF'}/>
              <span style={{color:waConnected&&waNotifyRules.bulkOrderCreated?'#25D366':'#9CA3AF'}}>WhatsApp {waConnected?waNotifyRules.bulkOrderCreated?'(All Engineers)':'Off':'Not Connected'}</span>
              {!waConnected&&<button onClick={()=>{setShowBulkOrder(false);setPage('whatsapp');}} style={{background:'none',border:'none',color:'#2563EB',fontSize:10,cursor:'pointer',textDecoration:'underline'}}>Connect</button>}
            </div>
          </div>
        </div>

        <div style={{padding:10,borderRadius:8,background:'#EDE9FE',border:'1px solid #DDD6FE',fontSize:11,color:'#5B21B6',display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
          <AlertCircle size={13}/> After creating, select the bulk batch and use <strong>"Order Approval & Notify"</strong> to send for approval.
        </div>
        <div style={{display:'flex',gap:10}}><button className="bp" onClick={handleBulkSubmit} disabled={isSubmitting} style={{flex:1,opacity:isSubmitting?.6:1}}><Layers size={14}/> {isSubmitting?'Creating...':'Create Bulk Order'} ({bulkItems.filter(i=>i.materialNo&&i.description).length} items)</button><button className="bs" onClick={()=>setShowBulkOrder(false)}>Cancel</button></div>
      </div></div>}

      {/* ═══ ORDER DETAIL MODAL ═══ */}
      {selectedOrder&&<div className="mo" onClick={()=>setSelectedOrder(null)}><div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:560,maxWidth:'94vw',maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><div><h2 style={{fontSize:17,fontWeight:700}}>{selectedOrder.description}</h2><span className="mono" style={{fontSize:12,color:'#94A3B8'}}>{selectedOrder.id} • {selectedOrder.materialNo||'—'}</span></div><button onClick={()=>setSelectedOrder(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button></div>
        <Badge status={selectedOrder.status}/>

        {/* Ordered By & Month Badge - Prominent Display */}
        <div style={{display:'flex',gap:12,marginTop:12,flexWrap:'wrap'}}>
          {selectedOrder.orderBy&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'#DBEAFE',borderRadius:8}}>
            <User size={14} color="#2563EB"/>
            <div><div style={{fontSize:10,color:'#64748B',fontWeight:600}}>ORDERED BY</div><div style={{fontSize:13,fontWeight:700,color:'#2563EB'}}>{selectedOrder.orderBy}</div></div>
          </div>}
          {selectedOrder.month&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'#E6F4ED',borderRadius:8}}>
            <Calendar size={14} color="#0B7A3E"/>
            <div><div style={{fontSize:10,color:'#64748B',fontWeight:600}}>MONTH BATCH</div><div style={{fontSize:13,fontWeight:700,color:'#0B7A3E'}}>{String(selectedOrder.month).replace('_',' ')}</div></div>
          </div>}
          {selectedOrder.bulkGroupId&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'#EDE9FE',borderRadius:8}}>
            <Layers size={14} color="#7C3AED"/>
            <div><div style={{fontSize:10,color:'#64748B',fontWeight:600}}>BULK BATCH</div><div style={{fontSize:13,fontWeight:700,color:'#7C3AED'}}>{selectedOrder.bulkGroupId}</div></div>
          </div>}
          {selectedOrder.orderDate&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'#F8FAFB',borderRadius:8}}>
            <Clock size={14} color="#64748B"/>
            <div><div style={{fontSize:10,color:'#64748B',fontWeight:600}}>ORDER DATE</div><div style={{fontSize:13,fontWeight:700,color:'#374151'}}>{fmtDate(selectedOrder.orderDate)}</div></div>
          </div>}
        </div>

        {selectedOrder.materialNo&&catalogLookup[selectedOrder.materialNo]&&<div style={{padding:12,borderRadius:8,background:'#EFF6FF',border:'1px solid #BFDBFE',marginTop:12,fontSize:12}}><strong style={{color:'#2563EB'}}>Catalog Price ({priceConfig.year})</strong><div className="grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:6}}><div>SG: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].sg)}</strong></div><div>Dist: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].dist)}</strong></div><div>TP: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].tp)}</strong></div></div></div>}

        {/* Update Received Quantity Section */}
        <div style={{padding:16,borderRadius:10,background:'#F0FDF4',border:'1px solid #BBF7D0',marginTop:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><Package size={16} color="#059669"/><span style={{fontWeight:600,fontSize:13,color:'#059669'}}>Update Received Quantity</span></div>
          <div className="grid-3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,alignItems:'end'}}>
            <div>
              <label style={{display:'block',fontSize:11,color:'#64748B',marginBottom:4}}>Ordered</label>
              <div className="mono" style={{fontSize:18,fontWeight:700}}>{selectedOrder.quantity}</div>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,color:'#64748B',marginBottom:4}}>Received</label>
              <input type="number" min="0" max={selectedOrder.quantity||0} value={selectedOrder.qtyReceived||0} onChange={e=>{
                const val = parseInt(e.target.value)||0;
                const newBackOrder = val - selectedOrder.quantity;
                const newStatus = val >= selectedOrder.quantity ? 'Received' : val > 0 ? 'Back Order' : 'Approved';
                const updatedOrder = {...selectedOrder, qtyReceived: val, backOrder: newBackOrder, status: newStatus, arrivalDate: val > 0 ? (selectedOrder.arrivalDate || new Date().toISOString().slice(0,10)) : selectedOrder.arrivalDate};
                const updatedOrders = orders.map(o=>o.id===selectedOrder.id ? updatedOrder : o);
                setOrders(updatedOrders);
                setSelectedOrder(updatedOrder);
                dbSync(api.updateOrder(selectedOrder.id, {qtyReceived:val, backOrder:newBackOrder, status:newStatus, arrivalDate:updatedOrder.arrivalDate}), 'Arrival update not saved');
                if(selectedOrder.bulkGroupId) checkBulkGroupCompletion(selectedOrder.bulkGroupId, updatedOrders);
              }} style={{width:'100%',padding:'8px 12px',fontSize:16,fontWeight:600,borderRadius:8,border:'1.5px solid #BBF7D0',textAlign:'center'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,color:'#64748B',marginBottom:4}}>Back Order</label>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:selectedOrder.backOrder<0?'#DC2626':'#059669'}}>{selectedOrder.backOrder<0?selectedOrder.backOrder:'✓ Full'}</div>
            </div>
          </div>
          {selectedOrder.backOrder<0 && <div style={{marginTop:12,padding:8,background:'#FEF2F2',borderRadius:6,fontSize:11,color:'#DC2626',display:'flex',alignItems:'center',gap:6}}><AlertCircle size={12}/> {Math.abs(selectedOrder.backOrder)} items still pending</div>}
          {selectedOrder.qtyReceived>=selectedOrder.quantity && <div style={{marginTop:12,padding:8,background:'#D1FAE5',borderRadius:6,fontSize:11,color:'#059669',display:'flex',alignItems:'center',gap:6}}><CheckCircle size={12}/> Order fully received</div>}
        </div>

        <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:14}}>{[{l:'Price',v:selectedOrder.listPrice>0?fmt(selectedOrder.listPrice):'—'},{l:'Total',v:selectedOrder.totalCost>0?fmt(selectedOrder.totalCost):'—'},{l:'Ordered',v:fmtDate(selectedOrder.orderDate)},{l:'By',v:selectedOrder.orderBy||'—'},{l:'Arrival',v:selectedOrder.arrivalDate?fmtDate(selectedOrder.arrivalDate):'—'},{l:'Engineer',v:selectedOrder.engineer||'—'},{l:'Month',v:selectedOrder.month?.replace('_',' ')||'—'},{l:'Remark',v:selectedOrder.remark||'—'}].map((f,i)=><div key={i} style={{padding:10,borderRadius:8,background:'#F8FAFB'}}><div style={{fontSize:10,color:'#94A3B8',fontWeight:600,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{f.l}</div><div style={{fontSize:13,fontWeight:600}}>{f.v}</div></div>)}</div>
        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button className="bp" onClick={async ()=>{const updatedOrders=orders.map(o=>o.id===selectedOrder.id?selectedOrder:o);setOrders(updatedOrders);const ok=await api.updateOrder(selectedOrder.id,selectedOrder);if(ok){notify('Order Updated',`${selectedOrder.id} saved to database`,'success');if(selectedOrder.bulkGroupId)recalcBulkGroupForMonths([selectedOrder.bulkGroupId],updatedOrders);}else{notify('Save Failed',`${selectedOrder.id} not saved to database`,'error');}setSelectedOrder(null);}}><Check size={14}/> Save & Close</button>
          <button className="be" onClick={()=>{notify('Email Sent','Update sent','success');setSelectedOrder(null);}}><Mail size={14}/> Email</button>
          {waConnected&&<button className="bw" onClick={()=>{notify('WhatsApp Sent','Alert sent','success');setSelectedOrder(null);}}><MessageSquare size={14}/> WhatsApp</button>}
          <button className="bs" onClick={()=>setSelectedOrder(null)}>Cancel</button>
        </div>
      </div></div>}

      {/* ═══ PART DETAIL MODAL ═══ */}
      {selectedPart&&<div className="mo" onClick={()=>setSelectedPart(null)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:520,maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><div><h2 style={{fontSize:17,fontWeight:700}}>{selectedPart.description}</h2><span className="mono" style={{fontSize:12,color:'#94A3B8'}}>{selectedPart.materialNo}</span></div><button onClick={()=>setSelectedPart(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8'}}><X size={20}/></button></div>
        <div style={{marginBottom:14}}><Pill bg={`${CATEGORIES[selectedPart.category]?.color||'#64748B'}12`} color={CATEGORIES[selectedPart.category]?.color||'#64748B'}>{CATEGORIES[selectedPart.category]?.label||selectedPart.category}</Pill></div>
        <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>{[{l:'SG Price',v:fmt(selectedPart.singaporePrice),c:'#0B7A3E'},{l:'Dist Price',v:fmt(selectedPart.distributorPrice),c:'#2563EB'},{l:'Transfer (SGD)',v:fmt(selectedPart.transferPrice),c:'#7C3AED'},{l:'RSP (EUR)',v:`€${selectedPart.rspEur?.toLocaleString()}`,c:'#D97706'},{l:'Margin',v:`${selectedPart.singaporePrice>0?((selectedPart.singaporePrice-selectedPart.distributorPrice)/selectedPart.singaporePrice*100).toFixed(1):0}%`,c:'#059669'},{l:'Year',v:priceConfig.year,c:'#64748B'}].map((f,i)=><div key={i} style={{padding:12,borderRadius:8,background:'#F8FAFB'}}><div style={{fontSize:10,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{f.l}</div><div className="mono" style={{fontSize:16,fontWeight:700,color:f.c}}>{f.v}</div></div>)}</div>
        <div style={{display:'flex',gap:10}}><button className="bp" onClick={()=>{setShowNewOrder(true);setNewOrder({materialNo:selectedPart.materialNo,description:selectedPart.description,quantity:1,listPrice:selectedPart.transferPrice,orderBy:'',remark:''});setSelectedPart(null);}}><ShoppingCart size={14}/> Order</button><button className="bs" onClick={()=>setSelectedPart(null)}>Close</button></div>
      </div></div>}

      {/* ═══════════ AI CHAT PANEL (SLIDE-IN) ═══════════ */}
      <div className={`ai-panel${aiPanelOpen?'':' closed'}`} style={{
        position: 'fixed',
        top: 0,
        right: aiPanelOpen ? 0 : -400,
        width: 380,
        maxWidth: '100vw',
        height: '100vh',
        background: '#fff',
        boxShadow: aiPanelOpen ? '-4px 0 20px rgba(0,0,0,0.1)' : 'none',
        transition: 'right 0.3s ease',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Sans', system-ui, sans-serif"
      }}>
        {/* Panel Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #006837, #00A550)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} color="#fff"/>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Miltenyi Inventory Bot</div>
            </div>
          </div>
          <button onClick={() => setAiPanelOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <X size={16} color="#fff"/>
          </button>
        </div>

        {/* Messages Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#F8FAFB' }}>
          {aiMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #006837, #00A550)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Sparkles size={28} color="#fff"/>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A202C', marginBottom: 8 }}>How can I help?</h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>{aiBotConfig.greeting}</p>
            </div>
          )}

          {aiMessages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 12, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, #006837, #00A550)' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#1A202C',
                fontSize: 13,
                lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7, textAlign: 'right' }}>{msg.time}</div>
              </div>
            </div>
          ))}

          {aiProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fff', borderRadius: 14, width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} color="#0B7A3E"/>
              <span style={{ fontSize: 12, color: '#64748B' }}>Thinking...</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #E8ECF0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'price', label: 'Check Price', icon: DollarSign },
            { key: 'status', label: 'Order Status', icon: Package },
            { key: 'order', label: 'Place Order', icon: ShoppingCart },
            { key: 'stock', label: 'Stock Levels', icon: Database }
          ].map(action => (
            <button key={action.key} onClick={() => handleAiQuickAction(action.key)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 16,
              border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, color: '#64748B',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s'
            }} onMouseOver={e => { e.currentTarget.style.borderColor = '#0B7A3E'; e.currentTarget.style.color = '#0B7A3E'; }}
               onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}>
              <action.icon size={12}/> {action.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ padding: 16, borderTop: '1px solid #E8ECF0', background: '#fff' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiSend()}
              placeholder="Ask about prices, orders, stock..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={handleAiSend} disabled={!aiInput.trim() || aiProcessing} style={{
              padding: '10px 14px', borderRadius: 10, border: 'none',
              background: aiInput.trim() ? 'linear-gradient(135deg, #006837, #00A550)' : '#E2E8F0',
              color: aiInput.trim() ? '#fff' : '#94A3B8', cursor: aiInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Send size={16}/>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
