import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  Search,
  Package,
  TrendingUp,
  Truck,
  Bell,
  MessageSquare,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Filter,
  Download,
  Mail,
  Phone,
  CheckCircle,
  AlertTriangle,
  Clock,
  X,
  Menu,
  Home,
  ClipboardList,
  BarChart3,
  Eye,
  Send,
  RefreshCw,
  Users,
  User,
  Calendar,
  DollarSign,
  Archive,
  AlertCircle,
  Check,
  ExternalLink,
  FileText,
  Database,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  Copy,
  Printer,
  ShoppingCart,
  UserPlus,
  Shield,
  Lock,
  LogOut,
  QrCode,
  Wifi,
  WifiOff,
  Layers,
  FolderPlus,
  ChevronLeft,
  Bot,
  Upload,
  Sparkles,
  FileUp,
  MessageCircle,
  Zap,
  Brain,
  PanelRightOpen,
  PanelRightClose,
  Briefcase,
  LayoutGrid,
  Wrench,
  ArrowRight,
  Activity,
  FileBarChart,
  HardDrive,
  Warehouse,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from './api.js';
import { PARTS_CATALOG, PRICE_CONFIG_DEFAULT, CATEGORIES, DEFAULT_USERS, MONTH_OPTIONS } from './constants.js';
import { fmt, fmtDate, fmtNum, applySortData, toggleSort, exportToFile, exportToPDF, fillTemplate } from './utils.js';
import {
  STATUS_CFG,
  Badge,
  ArrivalBadge,
  Pill,
  Toggle,
  Toast,
  BatchBar,
  BatchBtn,
  SortTh,
  ExportDropdown,
  SelBox,
  QRCodeCanvas,
} from './components/ui.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import WhatsAppPage from './pages/WhatsAppPage.jsx';
import DeliveryPage from './pages/DeliveryPage.jsx';
import ForecastingPage from './pages/ForecastingPage.jsx';
import StockCheckPage from './pages/StockCheckPage.jsx';
import AllOrdersPage from './pages/AllOrdersPage.jsx';
import AiBotPage from './pages/AiBotPage.jsx';
import ServicePage from './pages/ServicePage.jsx';
import LocalInventoryPage from './pages/LocalInventoryPage.jsx';

// UI components, constants, and utils imported from separate files

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
    try {
      const u = localStorage.getItem('mih_currentUser');
      const t = localStorage.getItem('mih_token');
      if (u && t) return JSON.parse(u);
      return null;
    } catch {
      return null;
    }
  });
  const [authView, setAuthView] = useState('login'); // login | register
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ username: '', password: '', name: '', email: '', phone: '' });
  const [pendingUsers, setPendingUsers] = useState([]);

  // ── App State ──
  const [activeModule, setActiveModule] = useState(() => {
    try {
      return localStorage.getItem('mih_activeModule') || null;
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState(() => {
    const mod = localStorage.getItem('mih_activeModule');
    return mod === 'service' ? 'service' : 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [singleOrderMonth, setSingleOrderMonth] = useState('All');
  const [orderByFilter, setOrderByFilter] = useState('All');
  const [bulkCreatedByFilter, setBulkCreatedByFilter] = useState('All');
  const [arrivalOrderByFilter, setArrivalOrderByFilter] = useState('All');
  const [arrivalMonthFilter, setArrivalMonthFilter] = useState('All');
  const [allOrdersTypeFilter, setAllOrdersTypeFilter] = useState('All');
  const [allOrdersMonth, setAllOrdersMonth] = useState('All');
  const [allOrdersStatus, setAllOrdersStatus] = useState('All');
  const [allOrdersUserFilter, setAllOrdersUserFilter] = useState('All');
  const [allOrdersSort, setAllOrdersSort] = useState({ key: null, dir: 'asc' });
  const [singleOrderPage, setSingleOrderPage] = useState(0);
  const [singleOrderPageSize, setSingleOrderPageSize] = useState(50);
  const [bulkOrderPage, setBulkOrderPage] = useState(0);
  const [bulkOrderPageSize, setBulkOrderPageSize] = useState(50);
  const [bulkMonthFilter, setBulkMonthFilter] = useState('All');
  const [allOrdersPage, setAllOrdersPage] = useState(0);
  const [allOrdersPageSize, setAllOrdersPageSize] = useState(50);
  const [expandedAllMonth, setExpandedAllMonth] = useState(null);
  const [expandedAllBulkGroup, setExpandedAllBulkGroup] = useState(null);
  const [catFilter, setCatFilter] = useState('All');
  const [notifs, setNotifs] = useState([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [showPriceFinder, setShowPriceFinder] = useState(false);
  const [priceFinderInput, setPriceFinderInput] = useState('');
  const [priceFinderResults, setPriceFinderResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBulkGroup, setSelectedBulkGroup] = useState(null);
  const [expandedBulkGroup, setExpandedBulkGroup] = useState(null);
  const [historyImportData, setHistoryImportData] = useState([]);
  const [historyImportPreview, setHistoryImportPreview] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [machineSearch, setMachineSearch] = useState('');
  const [notifSearch, setNotifSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [stockCheckSearch, setStockCheckSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState({ key: 'sg', dir: 'desc' });
  const [orderSort, setOrderSort] = useState({ key: null, dir: 'asc' });
  const [bulkSort, setBulkSort] = useState({ key: null, dir: 'asc' });
  const [arrivalSort, setArrivalSort] = useState({ key: 'approvalSentDate', dir: 'desc' });
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [priceConfig, setPriceConfig] = useState(PRICE_CONFIG_DEFAULT);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogPageSize, setCatalogPageSize] = useState(50);
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
  const [waRecipientPicker, setWaRecipientPicker] = useState(null); // { selected: Set<userId>, message: string, subject: string, title: string }
  const [waSending, setWaSending] = useState(false);

  // ── Bulk Order State ──
  const [showBulkOrder, setShowBulkOrder] = useState(false);
  const [bulkMonth, setBulkMonth] = useState('Feb 2026');
  const [bulkItems, setBulkItems] = useState([{ materialNo: '', description: '', quantity: 1, listPrice: 0 }]);
  const [bulkOrderBy, setBulkOrderBy] = useState('');
  const [bulkRemark, setBulkRemark] = useState('');
  const [bulkGroups, setBulkGroups] = useState([]); // Cleared for history import

  // ── Stock Check & Notif Log ──
  const [stockChecks, setStockChecks] = useState([]);

  // ── Part Arrival Check State ──
  const [arrivalCheckMode, setArrivalCheckMode] = useState(false);
  const [selectedBulkForArrival, setSelectedBulkForArrival] = useState(null);
  const [arrivalItems, setArrivalItems] = useState([]);
  const [arrivalStatusFilter, setArrivalStatusFilter] = useState('All');
  const [arrivalTypeFilter, setArrivalTypeFilter] = useState('All');
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
    setNotifs((prev) => [...prev, { title, message, type }]);
    setTimeout(() => setNotifs((prev) => prev.slice(1)), 4000);
  }, []);

  // DB sync wrapper: shows toast on API failure (non-blocking)
  const dbSync = useCallback((promise, msg) => {
    Promise.resolve(promise)
      .then((r) => {
        if (r === null || r === false)
          notify('Save Failed', msg || 'Failed to save to database. Please retry.', 'error');
      })
      .catch(() => notify('Save Failed', msg || 'Failed to save to database. Please retry.', 'error'));
  }, []);

  // Persist helpers: update local state AND save to DB
  const addNotifEntry = useCallback(
    (entry) => {
      setNotifLog((prev) => [entry, ...prev]);
      dbSync(api.createNotifEntry(entry), 'Notification log not saved');
    },
    [dbSync],
  );
  const addApproval = useCallback(
    (entry) => {
      setPendingApprovals((prev) => [entry, ...prev]);
      dbSync(api.createApproval(entry), 'Approval not saved');
    },
    [dbSync],
  );
  const logAction = useCallback(
    (action, entityType, entityId, details) => {
      const entry = { userId: currentUser?.id, userName: currentUser?.name, action, entityType, entityId, details };
      setAuditLog((prev) => [{ ...entry, createdAt: new Date().toISOString(), id: Date.now() }, ...prev]);
      api.createAuditEntry(entry).catch(() => {});
    },
    [currentUser],
  );
  const addStockCheck = useCallback(
    (entry) => {
      setStockChecks((prev) => [entry, ...prev]);
      dbSync(api.createStockCheck(entry), 'Stock check not saved');
    },
    [dbSync],
  );

  // Numeric coercion helpers — PostgreSQL NUMERIC(12,2) returns strings
  const numOrders = (arr) =>
    arr.map((o) => ({
      ...o,
      totalCost: Number(o.totalCost) || 0,
      quantity: Number(o.quantity) || 0,
      qtyReceived: Number(o.qtyReceived) || 0,
      backOrder: Number(o.backOrder) || 0,
      listPrice: Number(o.listPrice) || 0,
    }));
  const numBulk = (arr) => arr.map((g) => ({ ...g, totalCost: Number(g.totalCost) || 0, items: Number(g.items) || 0 }));
  const numApprovals = (arr) =>
    arr.map((a) => ({ ...a, totalCost: Number(a.totalCost) || 0, quantity: Number(a.quantity) || 0 }));
  const numCatalog = (arr) =>
    arr.map((p) => ({
      ...p,
      sgPrice: Number(p.sgPrice) || 0,
      distPrice: Number(p.distPrice) || 0,
      transferPrice: Number(p.transferPrice) || 0,
      rspEur: Number(p.rspEur) || 0,
    }));
  const numStockChecks = (arr) => arr.map((c) => ({ ...c, items: Number(c.items) || 0, disc: Number(c.disc) || 0 }));

  // Helper: recalculate bulk group items/totalCost for affected bulk group IDs after order changes
  const recalcBulkGroupForMonths = useCallback(
    (bgIds, ordersAfterChange) => {
      const idSet = new Set(bgIds.filter(Boolean));
      if (!idSet.size) return;
      setBulkGroups((prev) =>
        prev.map((bg) => {
          if (!idSet.has(bg.id)) return bg;
          const bgOrders = ordersAfterChange.filter((o) => o.bulkGroupId === bg.id);
          const newItems = bgOrders.length;
          const newTotalCost = bgOrders.reduce((s, o) => s + (o.totalCost || 0), 0);
          if (bg.items !== newItems || Math.abs((bg.totalCost || 0) - newTotalCost) > 0.01) {
            dbSync(api.updateBulkGroup(bg.id, { items: newItems, totalCost: newTotalCost }), 'Bulk group tally sync');
            return { ...bg, items: newItems, totalCost: newTotalCost };
          }
          return bg;
        }),
      );
    },
    [dbSync],
  );

  // Helper: auto-complete bulk group when all orders received
  const checkBulkGroupCompletion = useCallback(
    (bulkGroupId, ordersAfterChange) => {
      if (!bulkGroupId) return;
      setBulkGroups((prev) =>
        prev.map((bg) => {
          if (bg.id !== bulkGroupId || bg.status === 'Completed') return bg;
          const bgOrders = ordersAfterChange.filter((o) => o.bulkGroupId === bg.id);
          if (bgOrders.length > 0 && bgOrders.every((o) => (o.qtyReceived || 0) >= o.quantity)) {
            dbSync(api.updateBulkGroup(bg.id, { status: 'Completed' }), 'Bulk group completion sync');
            return { ...bg, status: 'Completed' };
          }
          return bg;
        }),
      );
    },
    [dbSync],
  );

  // ── State needed by sendArrivalReport (must be declared before the callback) ──
  const [waNotifyRules, setWaNotifyRules] = useState({
    orderCreated: true,
    bulkOrderCreated: true,
    partArrivalDone: true,
    deliveryArrival: true,
    backOrderUpdate: true,
    lowStockAlert: false,
    monthlySummary: false,
    urgentRequest: true,
  });
  const [waMessageTemplates, setWaMessageTemplates] = useState({
    orderApproval: {
      label: 'Order Approval Request',
      message:
        '*📋 Order Approval Request*\n\nRequested By: {orderBy}\nDate: {date}\nOrders: {orderCount}\nTotal Qty: {totalQty} units\nTotal: *S${totalCost}*\n\n{orderTable}\n\n_Reply *APPROVE* or *REJECT*_\n_Miltenyi Inventory Hub SG_',
    },
    bulkApproval: {
      label: 'Bulk Order Approval',
      message:
        '*📋 Bulk Order Approval Request*\n\nRequested By: {orderBy}\nDate: {date}\nBatches: {batchCount}\nItems: {itemCount}\nTotal Qty: {totalQty} units\nTotal: *S${totalCost}*\n\n{orderTable}\n\n_Reply *APPROVE* or *REJECT*_\n_Miltenyi Inventory Hub SG_',
    },
    backOrder: {
      label: 'Back Order Alert',
      message:
        '⚠️ *Back Order Alert*\n\nThe following items are on back order:\n{items}\n\nPlease follow up with HQ.\n\n_Miltenyi Biotec SG Service_',
    },
    deliveryArrived: {
      label: 'Delivery Arrived',
      message:
        '📦 *Delivery Arrived*\n\nA new shipment has arrived at the warehouse. Please verify the items against the order list.\n\nCheck the Inventory Hub for details.\n\n_Miltenyi Biotec SG Service_',
    },
    stockAlert: {
      label: 'Stock Level Warning',
      message:
        '🔔 *Stock Level Warning*\n\n{item} is running low.\nCurrent stock: Below threshold\n\nPlease initiate reorder.\n\n_Miltenyi Biotec SG Service_',
    },
    monthlyUpdate: {
      label: 'Monthly Update',
      message:
        '📊 *Monthly Inventory Update — {month}*\n\nAll received orders have been verified.\nBack orders: See Inventory Hub\n\nPlease review and confirm.\n\n_Miltenyi Biotec SG Service_',
    },
    partArrival: {
      label: 'Part Arrival Verified',
      message:
        '✅ *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}\n\n_Miltenyi Biotec SG Service_',
    },
  });
  const [emailConfig, setEmailConfig] = useState({
    senderEmail: 'inventory@miltenyibiotec.com',
    senderName: 'Miltenyi Inventory Hub',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    enabled: true,
    approverEmail: '',
    approvalEnabled: true,
    approvalKeywords: ['approve', 'approved', 'yes', 'confirm', 'confirmed', 'ok', 'accept', 'accepted'],
    approvalAutoEmail: true,
    approvalAutoWhatsApp: true,
  });
  const [emailTemplates, setEmailTemplates] = useState({
    orderApproval: {
      subject: '[APPROVAL] Batch Order Request - {orderCount} Orders (S${totalCost})',
      body: 'Order Approval Request\n\nRequested By: {orderBy}\nDate: {date}\nTotal Orders: {orderCount}\nTotal Quantity: {totalQty}\nTotal Cost: S${totalCost}\n\n{orderTable}\n\nReply APPROVE to approve all orders or REJECT to decline.\n\n-Miltenyi Inventory Hub SG',
    },
    bulkApproval: {
      subject: '[APPROVAL] Bulk Order Batch - {batchCount} Batches (S${totalCost})',
      body: 'Bulk Order Approval Request\n\nRequested By: {orderBy}\nDate: {date}\nBatches: {batchCount}\nTotal Items: {itemCount}\nTotal Cost: S${totalCost}\n\n{orderTable}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG',
    },
    orderNotification: {
      subject: 'New Order: {orderId} - {description}',
      body: 'A new order has been created.\n\nOrder ID: {orderId}\nItem: {description}\nMaterial: {materialNo}\nQuantity: {quantity}\nTotal: S${totalCost}\nOrdered By: {orderBy}\nDate: {date}\n\n-Miltenyi Inventory Hub SG',
    },
    backOrderAlert: {
      subject: 'Back Order Alert: {description}',
      body: 'Back Order Alert\n\nThe following item is on back order:\n\nOrder ID: {orderId}\nItem: {description}\nOrdered: {quantity}\nReceived: {received}\nPending: {pending}\n\nPlease follow up with HQ.\n\n-Miltenyi Inventory Hub SG',
    },
    monthlySummary: {
      subject: 'Monthly Summary - {month}',
      body: 'Monthly Inventory Summary\n\nMonth: {month}\nTotal Orders: {totalOrders}\nReceived: {received}\nPending: {pending}\nBack Orders: {backOrders}\nTotal Value: S${totalValue}\n\n-Miltenyi Inventory Hub SG',
    },
    partArrivalDone: {
      subject: 'Part Arrival Verified - {month}',
      body: 'Part Arrival Verified\n\nMonth: {month}\nTotal Items: {totalItems}\nFully Received: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\nDate: {date}\n\nItems:\n{itemsList}\n\n-Miltenyi Inventory Hub SG',
    },
  });

  // Helper: send auto-notification after arrival confirmation
  const sendArrivalReport = useCallback(
    async (confirmedOrders) => {
      if (!confirmedOrders.length) return;
      const now = new Date().toISOString().slice(0, 10);
      const received = confirmedOrders.filter((o) => o.qtyReceived >= o.quantity).length;
      const backOrders = confirmedOrders.filter((o) => o.qtyReceived < o.quantity).length;
      const itemsList =
        confirmedOrders
          .slice(0, 10)
          .map(
            (o) =>
              `\u2022 ${(o.description || '').slice(0, 35)}: ${o.qtyReceived}/${o.quantity}${o.qtyReceived >= o.quantity ? ' \u2713' : ' (B/O: ' + (o.quantity - o.qtyReceived) + ')'}`,
          )
          .join('\n') + (confirmedOrders.length > 10 ? `\n...and ${confirmedOrders.length - 10} more` : '');
      const month = confirmedOrders[0]?.month || now;

      // WhatsApp auto-report
      if (waConnected && waNotifyRules.deliveryArrival) {
        const waMsg = fillTemplate(
          waMessageTemplates.partArrival?.message ||
            '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}',
          {
            month,
            totalItems: confirmedOrders.length,
            received,
            backOrders,
            verifiedBy: currentUser?.name || 'Admin',
            date: now,
            itemsList,
          },
        );
        const recipients = users.filter((u) => u.status === 'active' && u.phone);
        let waSent = 0;
        for (const u of recipients) {
          try {
            const r = await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` },
              body: JSON.stringify({ phone: u.phone, template: 'custom', data: { message: waMsg } }),
            });
            const result = await r.json().catch(() => ({}));
            if (r.ok && result.success) waSent++;
          } catch (e) {
            /* non-blocking per-user failure */
          }
        }
        if (recipients.length > 0) {
          addNotifEntry({
            id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'whatsapp',
            to: `${recipients.length} user(s)`,
            subject: `Arrival Confirmed: ${confirmedOrders.length} item(s) - ${received} full, ${backOrders} B/O`,
            date: now,
            status: waSent === recipients.length ? 'Delivered' : waSent > 0 ? 'Partial' : 'Failed',
          });
        }
      }

      // Email auto-report
      if (emailConfig.enabled) {
        try {
          const tpl = emailTemplates.partArrivalDone || {};
          const subject = (tpl.subject || 'Part Arrival Verified - {month}').replace(/\{month\}/g, month);
          const body = (
            tpl.body ||
            'Part Arrival Verified\n\nMonth: {month}\nTotal Items: {totalItems}\nFully Received: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\nDate: {date}\n\nItems:\n{itemsList}'
          )
            .replace(/\{month\}/g, month)
            .replace(/\{totalItems\}/g, confirmedOrders.length)
            .replace(/\{received\}/g, received)
            .replace(/\{backOrders\}/g, backOrders)
            .replace(/\{verifiedBy\}/g, currentUser?.name || 'Admin')
            .replace(/\{date\}/g, now)
            .replace(/\{itemsList\}/g, itemsList);
          const html = body.replace(/\n/g, '<br>');
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` },
            body: JSON.stringify({
              to: emailConfig.approverEmail || emailConfig.senderEmail,
              subject,
              html,
              smtp: {
                host: emailConfig.smtpHost,
                port: emailConfig.smtpPort,
                user: emailConfig.smtpUser || emailConfig.senderEmail,
                pass: emailConfig.smtpPass || '',
                from: `"${emailConfig.senderName}" <${emailConfig.senderEmail}>`,
              },
            }),
          });
          addNotifEntry({
            id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'email',
            to: emailConfig.approverEmail || emailConfig.senderEmail,
            subject,
            date: now,
            status: 'Sent',
          });
        } catch (e) {
          /* Email send error — non-blocking */
        }
      }
    },
    [waConnected, waNotifyRules, waMessageTemplates, emailConfig, emailTemplates, currentUser, users, addNotifEntry],
  );

  // Helper: send event-driven WA notification when waNotifyRules flag is enabled
  const sendAutoWaNotify = useCallback(
    async (ruleKey, templateKey, data, subject) => {
      if (!waConnected || !waNotifyRules[ruleKey]) return;
      const tpl = waMessageTemplates[templateKey];
      const message = fillTemplate(tpl?.message || data.message || '', data);
      if (!message) return;
      const recipients = users.filter((u) => u.status === 'active' && u.phone);
      let sent = 0;
      for (const u of recipients) {
        try {
          const r = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` },
            body: JSON.stringify({ phone: u.phone, template: 'custom', data: { message } }),
          });
          const result = await r.json().catch(() => ({}));
          if (r.ok && result.success) sent++;
        } catch (e) {
          /* non-blocking */
        }
      }
      if (recipients.length > 0) {
        addNotifEntry({
          id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'whatsapp',
          to: `${recipients.length} user(s)`,
          subject: subject || `Auto-notification: ${ruleKey}`,
          date: new Date().toISOString().slice(0, 10),
          status: sent === recipients.length ? 'Delivered' : sent > 0 ? 'Partial' : 'Failed',
        });
      }
    },
    [waConnected, waNotifyRules, waMessageTemplates, users, addNotifEntry],
  );

  // Helper: confirm arrival for a single order — only sets Received when full qty; keeps current status for partial
  const confirmArrival = useCallback(
    (orderId) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const pending = pendingArrival[orderId];
      const val = pending ? pending.qtyReceived : order.qtyReceived || 0;
      const status = val >= order.quantity ? 'Received' : order.status;
      const updates = {
        qtyReceived: val,
        backOrder: val - order.quantity,
        status,
        arrivalDate: new Date().toISOString().slice(0, 10),
      };
      const updatedOrder = { ...order, ...updates };
      const updatedOrders = orders.map((x) => (x.id === orderId ? updatedOrder : x));
      setOrders(updatedOrders);
      dbSync(api.updateOrder(orderId, updates), 'Arrival update not saved');
      if (order.bulkGroupId) checkBulkGroupCompletion(order.bulkGroupId, updatedOrders);
      setPendingArrival((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      setArrivalSelected((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      logAction('Confirm Arrival', 'order', orderId, { qtyReceived: val, status });
      notify('Arrival Confirmed', `${order.description || orderId}: ${val}/${order.quantity} received`, 'success');
      sendArrivalReport([updatedOrder]);
    },
    [orders, pendingArrival, checkBulkGroupCompletion, dbSync, logAction, notify, sendArrivalReport],
  );

  // Helper: batch confirm — confirms all provided orderIds (or all with pending values)
  const batchConfirmArrival = useCallback(
    (orderIds) => {
      if (!orderIds || orderIds.length === 0) return;
      let updatedOrders = [...orders];
      const confirmedIds = [];
      const confirmedOrdersList = [];
      const updates = [];
      orderIds.forEach((orderId) => {
        const order = updatedOrders.find((o) => o.id === orderId);
        if (!order || order.status === 'Received') return;
        const pending = pendingArrival[orderId];
        const val = pending ? pending.qtyReceived : order.qtyReceived || 0;
        const status = val >= order.quantity ? 'Received' : order.status;
        const upd = {
          qtyReceived: val,
          backOrder: val - order.quantity,
          status,
          arrivalDate: new Date().toISOString().slice(0, 10),
        };
        const updatedOrder = { ...order, ...upd };
        updatedOrders = updatedOrders.map((x) => (x.id === orderId ? updatedOrder : x));
        updates.push({ orderId, upd, bulkGroupId: order.bulkGroupId });
        confirmedIds.push(orderId);
        confirmedOrdersList.push(updatedOrder);
      });
      if (confirmedIds.length === 0) return;
      setOrders(updatedOrders);
      updates.forEach(({ orderId, upd, bulkGroupId }) => {
        dbSync(api.updateOrder(orderId, upd), 'Arrival update not saved');
        if (bulkGroupId) checkBulkGroupCompletion(bulkGroupId, updatedOrders);
      });
      setPendingArrival((prev) => {
        const next = { ...prev };
        confirmedIds.forEach((id) => delete next[id]);
        return next;
      });
      setArrivalSelected(new Set());
      logAction('Batch Confirm Arrival', 'order', confirmedIds.join(','), { count: confirmedIds.length });
      notify('Arrival Confirmed', `${confirmedIds.length} order(s) status updated`, 'success');
      sendArrivalReport(confirmedOrdersList);
    },
    [orders, pendingArrival, checkBulkGroupCompletion, dbSync, logAction, notify, sendArrivalReport],
  );

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
  const DEFAULT_USER_PERMS = {
    dashboard: true,
    catalog: true,
    orders: true,
    bulkOrders: true,
    analytics: true,
    stockCheck: true,
    delivery: true,
    whatsapp: true,
    notifications: true,
    auditTrail: false,
    editAllOrders: false,
    deleteOrders: false,
    editAllBulkOrders: false,
    deleteBulkOrders: false,
    deleteStockChecks: false,
    deleteNotifications: false,
    approvals: false,
    users: false,
    settings: false,
    aiBot: false,
  };
  const hasPermission = useCallback(
    (key) => {
      if (isAdmin) return true;
      const perms = currentUser?.permissions || DEFAULT_USER_PERMS;
      return perms[key] === true;
    },
    [currentUser, isAdmin],
  );

  // ── Catalog ──
  const catalogLookup = useMemo(() => {
    const m = {};
    partsCatalog.forEach((p) => {
      m[p.m] = p;
    });
    return m;
  }, [partsCatalog]);
  const catalog = useMemo(() => {
    let items = partsCatalog.map((p) => ({
      materialNo: p.m,
      description: p.d,
      category: p.c,
      singaporePrice: p.sg,
      distributorPrice: p.dist,
      transferPrice: p.tp,
      rspEur: p.rsp,
    }));
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      items = items.filter((p) => p.materialNo.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (catFilter !== 'All') items = items.filter((p) => p.category === catFilter);
    const key =
      catalogSort.key === 'sg'
        ? 'singaporePrice'
        : catalogSort.key === 'dist'
          ? 'distributorPrice'
          : catalogSort.key === 'tp'
            ? 'transferPrice'
            : 'description';
    items.sort((a, b) => {
      const va = a[key],
        vb = b[key];
      return catalogSort.dir === 'asc' ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
    });
    return items;
  }, [partsCatalog, catalogSearch, catFilter, catalogSort]);

  // ── Stats ──
  const stats = useMemo(() => {
    const t = orders.length,
      r = orders.filter((o) => o.status === 'Received').length,
      b = orders.filter((o) => o.arrivalDate && (o.qtyReceived || 0) < o.quantity).length;
    const pa = orders.filter((o) => o.status === 'Pending Approval').length,
      ap = orders.filter((o) => o.status === 'Approved').length;
    const rej = orders.filter((o) => o.status === 'Rejected').length;
    const tc = orders.reduce((s, o) => {
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      return s + (price > 0 ? price * o.quantity : Number(o.totalCost) || 0);
    }, 0);
    const tq = orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0),
      tr = orders.reduce((s, o) => s + (Number(o.qtyReceived) || 0), 0);
    return {
      total: t,
      received: r,
      backOrder: b,
      pendingApproval: pa,
      approved: ap,
      rejected: rej,
      pending: pa + ap,
      totalCost: tc,
      fulfillmentRate: tq > 0 ? ((tr / tq) * 100).toFixed(1) : 0,
    };
  }, [orders, catalogLookup]);
  const singleOrderMonths = useMemo(
    () =>
      [
        ...new Set(
          orders
            .filter((o) => !o.bulkGroupId)
            .map((o) => o.month)
            .filter(Boolean),
        ),
      ].sort(),
    [orders],
  );
  const orderByUsers = useMemo(
    () =>
      [
        ...new Set(
          orders
            .filter((o) => !o.bulkGroupId)
            .map((o) => o.orderBy)
            .filter(Boolean),
        ),
      ].sort(),
    [orders],
  );
  const bulkCreatedByUsers = useMemo(
    () => [...new Set(bulkGroups.map((g) => g.createdBy).filter(Boolean))].sort(),
    [bulkGroups],
  );
  const bulkMonths = useMemo(() => [...new Set(bulkGroups.map((g) => g.month).filter(Boolean))].sort(), [bulkGroups]);
  const arrivalOrderByUsers = useMemo(
    () =>
      [
        ...new Set(
          orders
            .filter((o) => o.approvalStatus === 'approved')
            .map((o) => o.orderBy)
            .filter(Boolean),
        ),
      ].sort(),
    [orders],
  );
  const filteredOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (o.bulkGroupId) return false;
        const ms =
          !search ||
          o.materialNo.toLowerCase().includes(search.toLowerCase()) ||
          o.description.toLowerCase().includes(search.toLowerCase()) ||
          o.orderBy.toLowerCase().includes(search.toLowerCase());
        const mm = singleOrderMonth === 'All' || o.month === singleOrderMonth;
        const mu = orderByFilter === 'All' || o.orderBy === orderByFilter;
        return ms && mm && mu && (statusFilter === 'All' || o.status === statusFilter);
      }),
    [orders, search, statusFilter, singleOrderMonth, orderByFilter],
  );
  const monthlyData = useMemo(() => {
    const monthMap = {};
    orders.forEach((o) => {
      if (!o.month) return;
      const norm = o.month.replace(/^\d+_/, '').replace(/_/g, ' ');
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0, 3)} '${parts[1].slice(2)}` : norm;
      if (!monthMap[shortLabel])
        monthMap[shortLabel] = {
          name: shortLabel,
          orders: 0,
          cost: 0,
          received: 0,
          backOrder: 0,
          pending: 0,
          approved: 0,
          _sortKey: norm,
        };
      monthMap[shortLabel].orders++;
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      monthMap[shortLabel].cost += price > 0 ? price * (Number(o.quantity) || 0) : Number(o.totalCost) || 0;
      if (o.status === 'Received') monthMap[shortLabel].received++;
      if (o.arrivalDate && (o.qtyReceived || 0) < o.quantity) monthMap[shortLabel].backOrder++;
      if (o.status === 'Pending Approval') monthMap[shortLabel].pending++;
      if (o.status === 'Approved') monthMap[shortLabel].approved++;
    });
    // Sort chronologically
    const monthOrder = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    return Object.values(monthMap).sort((a, b) => {
      const [am, ay] = a._sortKey.toLowerCase().split(' ');
      const [bm, by] = b._sortKey.toLowerCase().split(' ');
      return (
        (parseInt(ay) || 0) - (parseInt(by) || 0) ||
        (monthOrder[am?.slice(0, 3)] || 0) - (monthOrder[bm?.slice(0, 3)] || 0)
      );
    });
  }, [orders, catalogLookup]);
  const statusPieData = useMemo(
    () =>
      [
        { name: 'Received', value: stats.received, color: '#0B7A3E' },
        { name: 'Approved', value: stats.approved, color: '#059669' },
        { name: 'Pending Approval', value: stats.pendingApproval, color: '#D97706' },
        { name: 'Rejected', value: stats.rejected, color: '#991B1B' },
      ].filter((s) => s.value > 0),
    [stats],
  );
  const allOrdersMonths = useMemo(
    () => [...new Set([...orders.map((o) => o.month), ...bulkGroups.map((g) => g.month)].filter(Boolean))].sort(),
    [orders, bulkGroups],
  );
  const allOrdersUsers = useMemo(() => [...new Set(orders.map((o) => o.orderBy).filter(Boolean))].sort(), [orders]);
  const allOrdersCombined = useMemo(() => {
    let combined = orders.map((o) => ({ ...o, orderType: o.bulkGroupId ? 'Bulk' : 'Single' }));
    if (allOrdersTypeFilter !== 'All')
      combined = combined.filter((o) => o.orderType === (allOrdersTypeFilter === 'Single Orders' ? 'Single' : 'Bulk'));
    if (allOrdersMonth !== 'All') combined = combined.filter((o) => o.month === allOrdersMonth);
    if (allOrdersStatus !== 'All') combined = combined.filter((o) => o.status === allOrdersStatus);
    if (allOrdersUserFilter !== 'All') combined = combined.filter((o) => o.orderBy === allOrdersUserFilter);
    return combined;
  }, [orders, allOrdersTypeFilter, allOrdersMonth, allOrdersStatus, allOrdersUserFilter]);
  const topItems = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      if (!m[o.description])
        m[o.description] = {
          name: o.description.length > 30 ? o.description.slice(0, 30) + '...' : o.description,
          qty: 0,
          cost: 0,
        };
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      m[o.description].qty += Number(o.quantity) || 0;
      m[o.description].cost += price > 0 ? price * (Number(o.quantity) || 0) : Number(o.totalCost) || 0;
    });
    return Object.values(m)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);
  }, [orders, catalogLookup]);
  const catPriceData = useMemo(
    () =>
      Object.entries(CATEGORIES)
        .map(([k, c]) => {
          const i = partsCatalog.filter((p) => p.c === k);
          if (!i.length) return null;
          return {
            name: c.short,
            sg: Math.round(i.reduce((s, p) => s + p.sg, 0) / i.length),
            dist: Math.round(i.reduce((s, p) => s + p.dist, 0) / i.length),
            count: i.length,
            color: c.color,
          };
        })
        .filter(Boolean),
    [partsCatalog],
  );
  const catalogStats = useMemo(() => {
    const t = partsCatalog.length;
    const cc = {};
    partsCatalog.forEach((p) => {
      cc[p.c] = (cc[p.c] || 0) + 1;
    });
    return {
      total: t,
      avgSg: t > 0 ? partsCatalog.reduce((s, p) => s + p.sg, 0) / t : 0,
      avgDist: t > 0 ? partsCatalog.reduce((s, p) => s + p.dist, 0) / t : 0,
      catCounts: cc,
    };
  }, [partsCatalog]);

  // ── Advanced Analytics Memos ──
  const leadTimeData = useMemo(() => {
    const monthMap = {};
    orders.forEach((o) => {
      if (!o.orderDate || !o.arrivalDate || o.status !== 'Received') return;
      const diff = Math.round((new Date(o.arrivalDate) - new Date(o.orderDate)) / 86400000);
      if (diff < 0 || diff > 365) return;
      const norm = o.month?.replace(/^\d+_/, '').replace(/_/g, ' ') || 'Unknown';
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0, 3)} '${parts[1].slice(2)}` : norm;
      if (!monthMap[shortLabel]) monthMap[shortLabel] = { name: shortLabel, totalDays: 0, count: 0, _sortKey: norm };
      monthMap[shortLabel].totalDays += diff;
      monthMap[shortLabel].count++;
    });
    return Object.values(monthMap)
      .map((m) => ({ ...m, avgDays: Math.round(m.totalDays / m.count) }))
      .sort((a, b) => {
        const mo = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const [am, ay] = a._sortKey.toLowerCase().split(' ');
        const [bm, by] = b._sortKey.toLowerCase().split(' ');
        return (parseInt(ay) || 0) - (parseInt(by) || 0) || (mo[am?.slice(0, 3)] || 0) - (mo[bm?.slice(0, 3)] || 0);
      });
  }, [orders]);

  const statusTrendData = useMemo(() => {
    const monthMap = {};
    orders.forEach((o) => {
      if (!o.month) return;
      const norm = o.month.replace(/^\d+_/, '').replace(/_/g, ' ');
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0, 3)} '${parts[1].slice(2)}` : norm;
      if (!monthMap[shortLabel])
        monthMap[shortLabel] = {
          name: shortLabel,
          'Pending Approval': 0,
          Approved: 0,
          Received: 0,
          Rejected: 0,
          _sortKey: norm,
        };
      if (monthMap[shortLabel][o.status] !== undefined) monthMap[shortLabel][o.status]++;
    });
    const mo = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return Object.values(monthMap).sort((a, b) => {
      const [am, ay] = a._sortKey.toLowerCase().split(' ');
      const [bm, by] = b._sortKey.toLowerCase().split(' ');
      return (parseInt(ay) || 0) - (parseInt(by) || 0) || (mo[am?.slice(0, 3)] || 0) - (mo[bm?.slice(0, 3)] || 0);
    });
  }, [orders]);

  const materialFrequency = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      const key = o.materialNo || o.description;
      if (!m[key])
        m[key] = {
          name: (o.description || key).length > 25 ? (o.description || key).slice(0, 25) + '...' : o.description || key,
          materialNo: o.materialNo,
          qty: 0,
          cost: 0,
          orderCount: 0,
        };
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      m[key].qty += Number(o.quantity) || 0;
      m[key].cost += price > 0 ? price * (Number(o.quantity) || 0) : Number(o.totalCost) || 0;
      m[key].orderCount++;
    });
    return Object.values(m)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
  }, [orders, catalogLookup]);

  const categorySpendData = useMemo(() => {
    const catMap = {};
    orders.forEach((o) => {
      const cp = catalogLookup[o.materialNo];
      const cat = cp ? cp : null;
      const catName = cat ? CATEGORIES[cat.c]?.short || cat.c || 'Unknown' : 'Unknown';
      const catColor = cat ? CATEGORIES[cat.c]?.color || '#94A3B8' : '#94A3B8';
      if (!catMap[catName]) catMap[catName] = { name: catName, value: 0, count: 0, qty: 0, color: catColor };
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      catMap[catName].value += price > 0 ? price * (Number(o.quantity) || 0) : Number(o.totalCost) || 0;
      catMap[catName].qty += Number(o.quantity) || 0;
      catMap[catName].count++;
    });
    return Object.values(catMap).sort((a, b) => b.value - a.value);
  }, [orders, catalogLookup]);

  // ── New Order ──

  // ── AI Bot State ──
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState([]);
  const [aiBotConfig, setAiBotConfig] = useState({
    template: 'sales',
    customInstructions: '',
    greeting: "Hi! I'm your Miltenyi inventory assistant. I can help with pricing, orders, and stock checks.",
    apiKey: '',
  });
  const [customLogo, setCustomLogo] = useState(() => {
    try {
      const v = localStorage.getItem('mih_customLogo');
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  });
  const [waAutoReply, setWaAutoReply] = useState(false);
  const [scheduledNotifs, setScheduledNotifs] = useState({
    enabled: true,
    frequency: 'weekly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: '09:00',
    lastRun: null,
    recipients: [],
    emailEnabled: true,
    whatsappEnabled: true,
    reports: {
      monthlySummary: true,
      backOrderReport: true,
      lowStockAlert: true,
      pendingApprovals: true,
      orderStats: true,
    },
  });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [waAllowedSenders, setWaAllowedSenders] = useState(['admin']); // usernames allowed to connect WhatsApp
  const [aiConversationLogs, setAiConversationLogs] = useState([]);
  const [aiAdminTab, setAiAdminTab] = useState('knowledge');
  const [forecastTab, setForecastTab] = useState('forecast');
  const [forecastMaterial, setForecastMaterial] = useState('');
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [newMachine, setNewMachine] = useState({
    name: '',
    modality: '',
    location: '',
    installDate: '',
    status: 'Active',
    notes: '',
  });

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
      if (currentUser) {
        localStorage.setItem('mih_currentUser', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('mih_currentUser');
      }
    } catch (e) {
      /* ignore */
    }
  }, [currentUser]);

  // ── Persist activeModule to localStorage ──
  useEffect(() => {
    try {
      if (activeModule) localStorage.setItem('mih_activeModule', activeModule);
      else localStorage.removeItem('mih_activeModule');
    } catch {
      /* ignore */
    }
  }, [activeModule]);

  // ── Auto-logout on token expiry ──
  useEffect(() => {
    api.onAuthError(() => {
      setCurrentUser(null);
      setActiveModule(null);
      notify('Session Expired', 'Please log in again', 'warning');
    });
  }, []);

  // ── localStorage Persistence ──
  const LS_KEYS = {
    orders: 'mih_orders',
    bulkGroups: 'mih_bulkGroups',
    emailConfig: 'mih_emailConfig',
    emailTemplates: 'mih_emailTemplates',
    priceConfig: 'mih_priceConfig',
    notifLog: 'mih_notifLog',
    pendingApprovals: 'mih_pendingApprovals',
    users: 'mih_users',
    waNotifyRules: 'mih_waNotifyRules',
    scheduledNotifs: 'mih_scheduledNotifs',
    customLogo: 'mih_customLogo',
    stockChecks: 'mih_stockChecks',
    waMessageTemplates: 'mih_waMessageTemplates',
  };

  // Shared function to load all app data from DB
  // Uses !== null checks: null = API failed (skip), [] = DB empty (set empty state)
  const loadAppData = useCallback(async () => {
    try {
      const [
        apiOrders,
        apiBulk,
        apiUsers,
        apiChecks,
        apiNotifs,
        apiApprovals,
        apiConfig,
        apiCatalog,
        apiAudit,
        apiMachines,
      ] = await Promise.all([
        api.getOrders(),
        api.getBulkGroups(),
        api.getUsers(),
        api.getStockChecks(),
        api.getNotifLog(),
        api.getApprovals(),
        api.getConfig(),
        api.getCatalog(),
        api.getAuditLog(),
        api.getMachines(),
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
        if (apiConfig.emailConfig && typeof apiConfig.emailConfig === 'object')
          setEmailConfig((prev) => ({ ...prev, ...apiConfig.emailConfig }));
        if (apiConfig.emailTemplates && typeof apiConfig.emailTemplates === 'object')
          setEmailTemplates((prev) => ({ ...prev, ...apiConfig.emailTemplates }));
        if (apiConfig.priceConfig && typeof apiConfig.priceConfig === 'object')
          setPriceConfig((prev) => ({ ...prev, ...apiConfig.priceConfig }));
        if (apiConfig.waNotifyRules && typeof apiConfig.waNotifyRules === 'object')
          setWaNotifyRules((prev) => ({ ...prev, ...apiConfig.waNotifyRules }));
        if (apiConfig.waMessageTemplates && typeof apiConfig.waMessageTemplates === 'object')
          setWaMessageTemplates((prev) => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(apiConfig.waMessageTemplates)) {
              if (v && typeof v === 'object') merged[k] = { ...(prev[k] || {}), ...v };
            }
            return merged;
          });
        if (apiConfig.scheduledNotifs && typeof apiConfig.scheduledNotifs === 'object')
          setScheduledNotifs((prev) => ({
            ...prev,
            ...apiConfig.scheduledNotifs,
            reports: { ...prev.reports, ...(apiConfig.scheduledNotifs.reports || {}) },
          }));
        if (apiConfig.customLogo) setCustomLogo(apiConfig.customLogo);
        if (apiConfig.aiBotConfig && typeof apiConfig.aiBotConfig === 'object')
          setAiBotConfig((prev) => ({ ...prev, ...apiConfig.aiBotConfig }));
        if (apiConfig.waAutoReply !== undefined) setWaAutoReply(apiConfig.waAutoReply);
        if (Array.isArray(apiConfig.waAllowedSenders)) setWaAllowedSenders(apiConfig.waAllowedSenders);
      }
      if (apiCatalog !== null) {
        const nc = numCatalog(apiCatalog);
        setPartsCatalog(
          nc.map((p) => ({
            m: p.materialNo,
            d: p.description,
            c: p.category,
            sg: p.sgPrice,
            dist: p.distPrice,
            tp: p.transferPrice,
            rsp: p.rspEur,
          })),
        );
      }
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
      } catch {
        /* ignore */
      }

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
            setActiveModule(null);
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
        Object.entries(LS_KEYS).forEach(([key, lsKey]) => {
          const v = localStorage.getItem(lsKey);
          if (v) saved[key] = JSON.parse(v);
        });
        if (saved.orders?.length) setOrders(saved.orders);
        if (saved.bulkGroups?.length) setBulkGroups(saved.bulkGroups);
        if (saved.emailConfig) setEmailConfig(saved.emailConfig);
        if (saved.emailTemplates) setEmailTemplates(saved.emailTemplates);
        if (saved.priceConfig) setPriceConfig(saved.priceConfig);
        if (saved.notifLog?.length) setNotifLog(saved.notifLog);
        if (saved.pendingApprovals?.length) setPendingApprovals(saved.pendingApprovals);
        if (saved.users?.length) setUsers(saved.users);
        if (saved.waNotifyRules) setWaNotifyRules(saved.waNotifyRules);
        if (saved.waMessageTemplates) setWaMessageTemplates((prev) => ({ ...prev, ...saved.waMessageTemplates }));
        if (saved.scheduledNotifs) setScheduledNotifs(saved.scheduledNotifs);
        if (saved.customLogo) setCustomLogo(saved.customLogo);
        if (saved.stockChecks?.length) setStockChecks(saved.stockChecks);
      } catch (e) {
        console.warn('Failed to load saved data:', e);
      }

      // 4. Check WhatsApp connection status on load
      try {
        const waRes = await fetch('/api/whatsapp/status', { headers: { Authorization: `Bearer ${api.getToken()}` } });
        const waData = await waRes.json();
        if (waData.status === 'connected') {
          setWaConnected(true);
          setWaSessionInfo(waData.sessionInfo);
        }
      } catch {
        /* ignore */
      }
    }
    loadOnMount().finally(() => setIsLoading(false));
  }, []);

  // Periodic WhatsApp status sync (every 30s) — keeps sidebar indicator accurate
  // Uses a miss counter so transient blips don't flicker the UI
  const waStatusMisses = useRef(0);
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch('/api/whatsapp/status', { headers: { Authorization: `Bearer ${api.getToken()}` } });
        const d = await r.json();
        if (d.status === 'connected') {
          waStatusMisses.current = 0;
          if (!waConnected) {
            setWaConnected(true);
            setWaSessionInfo(d.sessionInfo);
          }
        } else if (waConnected) {
          // Only flip to disconnected after 3 consecutive non-connected polls (~90s)
          waStatusMisses.current++;
          if (waStatusMisses.current >= 3) {
            setWaConnected(false);
            setWaSessionInfo(null);
          }
        }
      } catch {
        /* ignore — network blip, don't count as a miss */
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [waConnected]);

  // Targeted data refresh when switching tabs
  const refreshPageData = useCallback(async (pageId) => {
    try {
      switch (pageId) {
        case 'dashboard': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o));
          if (b) setBulkGroups(numBulk(b));
          break;
        }
        case 'orders': {
          const o = await api.getOrders();
          if (o) setOrders(numOrders(o));
          break;
        }
        case 'bulkorders': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o));
          if (b) setBulkGroups(numBulk(b));
          break;
        }
        case 'stockcheck': {
          const c = await api.getStockChecks();
          if (c) setStockChecks(numStockChecks(c));
          break;
        }
        case 'delivery': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o));
          if (b) setBulkGroups(numBulk(b));
          break;
        }
        case 'analytics': {
          const [o, b] = await Promise.all([api.getOrders(), api.getBulkGroups()]);
          if (o) setOrders(numOrders(o));
          if (b) setBulkGroups(numBulk(b));
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
            if (cfg.emailConfig && typeof cfg.emailConfig === 'object')
              setEmailConfig((prev) => ({ ...prev, ...cfg.emailConfig }));
            if (cfg.emailTemplates && typeof cfg.emailTemplates === 'object')
              setEmailTemplates((prev) => ({ ...prev, ...cfg.emailTemplates }));
            if (cfg.priceConfig && typeof cfg.priceConfig === 'object')
              setPriceConfig((prev) => ({ ...prev, ...cfg.priceConfig }));
            if (cfg.waNotifyRules && typeof cfg.waNotifyRules === 'object')
              setWaNotifyRules((prev) => ({ ...prev, ...cfg.waNotifyRules }));
            if (cfg.waMessageTemplates && typeof cfg.waMessageTemplates === 'object')
              setWaMessageTemplates((prev) => {
                const merged = { ...prev };
                for (const [k, v] of Object.entries(cfg.waMessageTemplates)) {
                  if (v && typeof v === 'object') merged[k] = { ...(prev[k] || {}), ...v };
                }
                return merged;
              });
            if (cfg.scheduledNotifs && typeof cfg.scheduledNotifs === 'object')
              setScheduledNotifs((prev) => ({
                ...prev,
                ...cfg.scheduledNotifs,
                reports: { ...prev.reports, ...(cfg.scheduledNotifs.reports || {}) },
              }));
            if (cfg.customLogo) setCustomLogo(cfg.customLogo);
            if (cfg.aiBotConfig && typeof cfg.aiBotConfig === 'object')
              setAiBotConfig((prev) => ({ ...prev, ...cfg.aiBotConfig }));
            if (cfg.waAutoReply !== undefined) setWaAutoReply(cfg.waAutoReply);
            if (Array.isArray(cfg.waAllowedSenders)) setWaAllowedSenders(cfg.waAllowedSenders);
          }
          break;
        }
        case 'service': {
          const m = await api.getMachines();
          if (m) setMachines(m);
          break;
        }
        case 'catalog': {
          const cat = await api.getCatalog();
          if (cat !== null) {
            const nc = numCatalog(cat);
            setPartsCatalog(
              nc.map((p) => ({
                m: p.materialNo,
                d: p.description,
                c: p.category,
                sg: p.sgPrice,
                dist: p.distPrice,
                tp: p.transferPrice,
                rsp: p.rspEur,
              })),
            );
          }
          break;
        }
        default:
          break;
      }
    } catch (e) {
      console.log('Tab refresh:', e.message);
    }
  }, []);

  // Refresh data when tab changes
  useEffect(() => {
    if (currentUser && page) refreshPageData(page);
  }, [page, refreshPageData, currentUser]);

  // Save to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.orders, JSON.stringify(orders));
    } catch (e) {
      /* ignore */
    }
  }, [orders]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.bulkGroups, JSON.stringify(bulkGroups));
    } catch (e) {
      /* ignore */
    }
  }, [bulkGroups]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.emailConfig, JSON.stringify(emailConfig));
    } catch (e) {
      /* ignore */
    }
  }, [emailConfig]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.emailTemplates, JSON.stringify(emailTemplates));
    } catch (e) {
      /* ignore */
    }
  }, [emailTemplates]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.priceConfig, JSON.stringify(priceConfig));
    } catch (e) {
      /* ignore */
    }
  }, [priceConfig]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.notifLog, JSON.stringify(notifLog));
    } catch (e) {
      /* ignore */
    }
  }, [notifLog]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.pendingApprovals, JSON.stringify(pendingApprovals));
    } catch (e) {
      /* ignore */
    }
  }, [pendingApprovals]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.users, JSON.stringify(users));
    } catch (e) {
      /* ignore */
    }
  }, [users]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.waNotifyRules, JSON.stringify(waNotifyRules));
    } catch (e) {
      /* ignore */
    }
  }, [waNotifyRules]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.scheduledNotifs, JSON.stringify(scheduledNotifs));
    } catch (e) {
      /* ignore */
    }
  }, [scheduledNotifs]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.customLogo, JSON.stringify(customLogo));
    } catch (e) {
      /* ignore */
    }
  }, [customLogo]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.stockChecks, JSON.stringify(stockChecks));
    } catch (e) {
      /* ignore */
    }
  }, [stockChecks]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.waMessageTemplates, JSON.stringify(waMessageTemplates));
    } catch (e) {
      /* ignore */
    }
  }, [waMessageTemplates]);

  // ── Open Order in New Tab ──
  const openOrderInNewTab = (order) => {
    localStorage.setItem('viewOrderDetail', JSON.stringify(order));
    window.open(
      `${window.location.origin}${window.location.pathname}?orderDetail=true`,
      '_blank',
      'width=700,height=800,scrollbars=yes,resizable=yes',
    );
  };

  // ── New Order ──
  const [newOrder, setNewOrder] = useState({
    materialNo: '',
    description: '',
    quantity: 1,
    listPrice: 0,
    orderBy: '',
    remark: '',
    bulkGroupId: '',
  });
  const [newBulkMonth, setNewBulkMonth] = useState(''); // for "+ Create New Bulk Batch" inline picker
  const handleMaterialLookup = (matNo) => {
    const p = catalogLookup[matNo];
    if (p) {
      setNewOrder((prev) => ({ ...prev, materialNo: matNo, description: p.d, listPrice: p.sg || p.tp || p.dist || 0 }));
      notify('Part Found', `${p.d}`, 'success');
    }
  };
  const handleSubmitOrder = async () => {
    if (!newOrder.materialNo?.trim()) {
      notify('Missing Field', 'Material No. is required', 'warning');
      return;
    }
    if (!newOrder.description?.trim()) {
      notify('Missing Field', 'Description is required', 'warning');
      return;
    }
    if (!parseInt(newOrder.quantity) || parseInt(newOrder.quantity) < 1) {
      notify('Invalid Quantity', 'Quantity must be at least 1', 'warning');
      return;
    }
    if (!newOrder.orderBy) {
      notify('Missing Field', 'Order By is required', 'warning');
      return;
    }
    setIsSubmitting(true);
    const now = new Date();
    const monthStr = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${now.getFullYear()}`;
    const linkedBg = newOrder.bulkGroupId ? bulkGroups.find((bg) => bg.id === newOrder.bulkGroupId) : null;
    const o = {
      id: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...newOrder,
      bulkGroupId: linkedBg ? linkedBg.id : null,
      quantity: parseInt(newOrder.quantity),
      listPrice: parseFloat(newOrder.listPrice) || 0,
      totalCost: (parseFloat(newOrder.listPrice) || 0) * parseInt(newOrder.quantity),
      orderDate: now.toISOString().slice(0, 10),
      arrivalDate: null,
      qtyReceived: 0,
      backOrder: -parseInt(newOrder.quantity),
      engineer: '',
      emailFull: '',
      emailBack: '',
      status: 'Pending Approval',
      approvalStatus: 'pending',
      approvalSentDate: null,
      month: linkedBg ? linkedBg.month : monthStr,
      year: String(now.getFullYear()),
    };
    const created = await api.createOrder(o);
    setIsSubmitting(false);
    if (!created) {
      notify('Save Failed', 'Order not saved to database. Please retry.', 'error');
      return;
    }
    setOrders((prev) => [o, ...prev]);
    setShowNewOrder(false);
    setNewOrder({
      materialNo: '',
      description: '',
      quantity: 1,
      listPrice: 0,
      orderBy: '',
      remark: '',
      bulkGroupId: '',
    });
    setNewBulkMonth('');
    if (linkedBg) recalcBulkGroupForMonths([linkedBg.id], [o, ...orders]);
    notify(
      'Order Created',
      `${o.description} — ${o.quantity} units. Select and use "Order Approval & Notify" to send for approval.`,
      'success',
    );
    logAction('create', 'order', o.id, { description: o.description, quantity: o.quantity, totalCost: o.totalCost });
    // Auto-notify: order created
    sendAutoWaNotify(
      'orderCreated',
      'orderApproval',
      {
        orderId: o.id,
        description: (o.description || '').slice(0, 40),
        materialNo: o.materialNo || 'N/A',
        quantity: o.quantity,
        totalCost: (o.totalCost || 0).toFixed(2),
        orderBy: currentUser?.name || 'System',
        date: o.orderDate,
      },
      `New Order: ${o.description}`,
    );
  };

  // ── Duplicate Order ──
  const handleDuplicateOrder = async (sourceOrder) => {
    // Strip existing [Copy] or [Copy-N] prefix to get base name
    const baseName = sourceOrder.description.replace(/^\[Copy(?:-\d+)?\]\s*/, '');
    // Count existing copies of this base name
    const copyCount = orders.filter((o) => {
      const stripped = o.description.replace(/^\[Copy(?:-\d+)?\]\s*/, '');
      return stripped === baseName && o.description !== baseName;
    }).length;
    const copyNum = copyCount + 1;
    const copy = {
      ...sourceOrder,
      id: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: `[Copy-${copyNum}] ${baseName}`,
      orderDate: new Date().toISOString().slice(0, 10),
      arrivalDate: null,
      qtyReceived: 0,
      backOrder: -sourceOrder.quantity,
      status: 'Pending Approval',
      approvalStatus: 'pending',
      approvalSentDate: null,
      emailFull: '',
      emailBack: '',
    };
    const saved = await api.createOrder(copy);
    if (!saved) {
      notify('Save Failed', 'Duplicated order not saved to database', 'error');
      return;
    }
    setOrders((prev) => [copy, ...prev]);
    notify('Order Duplicated', `[Copy-${copyNum}] ${baseName}`, 'success');
  };

  // ── Approval Action Handler ──
  const handleApprovalAction = (approvalId, action) => {
    const approval = pendingApprovals.find((a) => a.id === approvalId);
    if (!approval) return;

    setPendingApprovals((prev) =>
      prev.map((a) =>
        a.id === approvalId ? { ...a, status: action, actionDate: new Date().toISOString().slice(0, 10) } : a,
      ),
    );
    dbSync(
      api.updateApproval(approvalId, { status: action, actionDate: new Date().toISOString().slice(0, 10) }),
      'Approval update not saved',
    );

    if (action === 'approved') {
      // Update order status to Approved
      if (approval.orderType === 'single') {
        setOrders((prev) =>
          prev.map((o) => (o.id === approval.orderId ? { ...o, status: 'Approved', approvalStatus: 'approved' } : o)),
        );
        dbSync(
          api.updateOrder(approval.orderId, { status: 'Approved', approvalStatus: 'approved' }),
          'Order approval not saved',
        );
      } else if (approval.orderType === 'bulk' && approval.orderIds) {
        setOrders((prev) =>
          prev.map((o) =>
            approval.orderIds.includes(o.id) ? { ...o, status: 'Approved', approvalStatus: 'approved' } : o,
          ),
        );
        setBulkGroups((prev) => prev.map((g) => (g.id === approval.orderId ? { ...g, status: 'Approved' } : g)));
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Approved'), 'Bulk order status not saved');
        dbSync(api.updateBulkGroup(approval.orderId, { status: 'Approved' }), 'Bulk group approval not saved');
      } else if (approval.orderType === 'batch' && approval.orderIds) {
        setOrders((prev) =>
          prev.map((o) =>
            approval.orderIds.includes(o.id) ? { ...o, status: 'Approved', approvalStatus: 'approved' } : o,
          ),
        );
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Approved'), 'Batch order approval not saved');
      }
      addNotifEntry({
        id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'email',
        to: approval.requestedBy,
        subject: `Order ${approval.orderId} Approved`,
        date: new Date().toISOString().slice(0, 10),
        status: 'Approved',
      });
      notify('Order Approved', `${approval.orderId} has been approved`, 'success');
    } else {
      // Update order status to Rejected
      if (approval.orderType === 'single') {
        setOrders((prev) =>
          prev.map((o) => (o.id === approval.orderId ? { ...o, status: 'Rejected', approvalStatus: 'rejected' } : o)),
        );
        dbSync(
          api.updateOrder(approval.orderId, { status: 'Rejected', approvalStatus: 'rejected' }),
          'Order rejection not saved',
        );
      } else if (approval.orderType === 'bulk' && approval.orderIds) {
        setOrders((prev) =>
          prev.map((o) =>
            approval.orderIds.includes(o.id) ? { ...o, status: 'Rejected', approvalStatus: 'rejected' } : o,
          ),
        );
        setBulkGroups((prev) => prev.map((g) => (g.id === approval.orderId ? { ...g, status: 'Rejected' } : g)));
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Rejected'), 'Bulk order rejection not saved');
        dbSync(api.updateBulkGroup(approval.orderId, { status: 'Rejected' }), 'Bulk group rejection not saved');
      } else if (approval.orderType === 'batch' && approval.orderIds) {
        setOrders((prev) =>
          prev.map((o) =>
            approval.orderIds.includes(o.id) ? { ...o, status: 'Rejected', approvalStatus: 'rejected' } : o,
          ),
        );
        dbSync(api.bulkUpdateOrderStatus(approval.orderIds, 'Rejected'), 'Batch order rejection not saved');
      }
      addNotifEntry({
        id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'email',
        to: approval.requestedBy,
        subject: `Order ${approval.orderId} Rejected`,
        date: new Date().toISOString().slice(0, 10),
        status: 'Rejected',
      });
      notify('Order Rejected', `${approval.orderId} has been rejected`, 'warning');
    }
  };

  // ── Batch Selection Helpers ──
  const toggleSel = (set, setter, id) =>
    setter((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = (set, setter, ids) => setter((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));

  // Batch Actions — Orders
  const batchDeleteOrders = () => {
    if (!selOrders.size || !window.confirm(`Delete ${selOrders.size} selected order(s)?`)) return;
    const ids = [...selOrders];
    const deletedOrders = orders.filter((o) => selOrders.has(o.id));
    const remainingOrders = orders.filter((o) => !selOrders.has(o.id));
    setOrders(remainingOrders);
    ids.forEach((id) => dbSync(api.deleteOrder(id), 'Order delete not saved'));
    // Recalculate affected bulk group totals
    const affectedBgIds = [...new Set(deletedOrders.map((o) => o.bulkGroupId).filter(Boolean))];
    if (affectedBgIds.length) recalcBulkGroupForMonths(affectedBgIds, remainingOrders);
    notify('Batch Delete', `${ids.length} orders deleted`, 'success');
    setSelOrders(new Set());
  };
  const batchStatusOrders = (status) => {
    if (!selOrders.size) return;
    const ids = [...selOrders];
    const approvalStatus = status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : undefined;
    setOrders((prev) =>
      prev.map((o) => (selOrders.has(o.id) ? { ...o, status, ...(approvalStatus ? { approvalStatus } : {}) } : o)),
    );
    dbSync(api.bulkUpdateOrderStatus(ids, status, approvalStatus), 'Order status update not saved');
    notify('Batch Update', `${ids.length} orders → ${status}`, 'success');
    setSelOrders(new Set());
  };

  // Batch Actions — Bulk Groups
  const batchDeleteBulk = () => {
    if (!selBulk.size || !window.confirm(`Delete ${selBulk.size} bulk group(s) and their orders?`)) return;
    const ids = [...selBulk];
    // Cascade delete orders linked to these bulk groups
    const orphanedOrders = orders.filter((o) => o.bulkGroupId && selBulk.has(o.bulkGroupId));
    if (orphanedOrders.length) {
      setOrders((prev) => prev.filter((o) => !(o.bulkGroupId && selBulk.has(o.bulkGroupId))));
      orphanedOrders.forEach((o) => dbSync(api.deleteOrder(o.id), 'Orphaned order delete not saved'));
    }
    setBulkGroups((prev) => prev.filter((g) => !selBulk.has(g.id)));
    ids.forEach((id) => dbSync(api.deleteBulkGroup(id), 'Bulk group delete not saved'));
    notify('Batch Delete', `${ids.length} bulk groups + ${orphanedOrders.length} orders deleted`, 'success');
    setSelBulk(new Set());
  };
  const batchStatusBulk = (status) => {
    if (!selBulk.size) return;
    const ids = [...selBulk];
    const idSet = new Set(ids);
    setBulkGroups((prev) => prev.map((g) => (selBulk.has(g.id) ? { ...g, status } : g)));
    ids.forEach((id) => dbSync(api.updateBulkGroup(id, { status }), 'Bulk group status not saved'));
    // Cascade approval status to all linked orders
    if (status === 'Approved' || status === 'Rejected') {
      const approvalStatus = status === 'Approved' ? 'approved' : 'rejected';
      const linkedOrders = orders.filter((o) => o.bulkGroupId && idSet.has(o.bulkGroupId));
      setOrders((prev) =>
        prev.map((o) => (o.bulkGroupId && idSet.has(o.bulkGroupId) ? { ...o, status, approvalStatus } : o)),
      );
      linkedOrders.forEach((o) =>
        dbSync(api.updateOrder(o.id, { status, approvalStatus }), 'Order approval cascade failed'),
      );
    }
    notify('Batch Update', `${ids.length} bulk groups → ${status}`, 'success');
    setSelBulk(new Set());
  };

  // ── HTML Email Builder ──
  const buildApprovalHtml = ({ title, headerFields, sections, footer }) => {
    const thStyle =
      'padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#4A5568;background:#F8FAFB;border-bottom:2px solid #E2E8F0;white-space:nowrap;';
    const tdStyle = 'padding:9px 14px;font-size:12px;color:#1A202C;border-bottom:1px solid #F0F2F5;';
    const tdMono = tdStyle + 'font-family:Consolas,monospace;font-weight:600;color:#0B7A3E;';
    const tdRight = tdStyle + 'text-align:right;font-weight:600;';
    const renderTable = (cols, rows, totals) => {
      let html =
        '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin:16px 0;">';
      html += '<thead><tr>' + cols.map((c) => `<th style="${thStyle}">${c}</th>`).join('') + '</tr></thead><tbody>';
      rows.forEach((r, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#FCFCFD';
        html +=
          `<tr style="background:${bg}">` +
          r
            .map((v, ci) => `<td style="${ci === 0 ? tdMono : ci === r.length - 1 ? tdRight : tdStyle}">${v}</td>`)
            .join('') +
          '</tr>';
      });
      if (totals) {
        html +=
          `<tr style="background:#F0FDF4;font-weight:700;">` +
          totals
            .map(
              (v, ci) =>
                `<td style="${ci === totals.length - 1 ? tdRight + 'color:#0B7A3E;' : tdStyle + 'font-weight:700;'}">${v}</td>`,
            )
            .join('') +
          '</tr>';
      }
      html += '</tbody></table>';
      return html;
    };
    let body = `<div style="max-width:700px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A202C;">`;
    body += `<div style="background:linear-gradient(135deg,#006837,#00A550);padding:28px 32px;border-radius:12px 12px 0 0;"><h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;">${title}</h1></div>`;
    body += `<div style="padding:28px 32px;background:#fff;border:1px solid #E8ECF0;border-top:none;">`;
    body +=
      `<table style="margin-bottom:20px;">` +
      headerFields
        .map(
          ([l, v]) =>
            `<tr><td style="padding:4px 16px 4px 0;font-size:12px;color:#64748B;font-weight:600;">${l}</td><td style="padding:4px 0;font-size:13px;font-weight:600;">${v}</td></tr>`,
        )
        .join('') +
      `</table>`;
    sections.forEach((s) => {
      if (s.heading)
        body += `<h3 style="font-size:14px;font-weight:700;color:#1E293B;margin:24px 0 8px;border-bottom:2px solid #E2E8F0;padding-bottom:6px;">${s.heading}</h3>`;
      body += renderTable(s.cols, s.rows, s.totals);
    });
    body += `<div style="margin-top:28px;padding:20px;background:#FEF3C7;border-radius:10px;border-left:4px solid #D97706;">`;
    body += `<p style="margin:0;font-size:13px;color:#92400E;font-weight:600;">Reply <strong>APPROVE</strong> to approve or <strong>REJECT</strong> to decline.</p></div>`;
    body += `</div><div style="padding:16px 32px;background:#F8FAFB;border:1px solid #E8ECF0;border-top:none;border-radius:0 0 12px 12px;text-align:center;">`;
    body += `<p style="margin:0;font-size:11px;color:#94A3B8;">${footer || 'Miltenyi Inventory Hub SG'}</p></div></div>`;
    return body;
  };

  const trySendHtmlEmail = async (to, subject, html) => {
    if (!emailConfig.smtpHost) return false;
    try {
      const ok = await api.sendEmail({
        to,
        subject,
        html,
        smtp: {
          host: emailConfig.smtpHost,
          port: emailConfig.smtpPort,
          user: emailConfig.smtpUser || '',
          pass: emailConfig.smtpPass || '',
          from: `"${emailConfig.senderName}" <${emailConfig.senderEmail}>`,
        },
      });
      return ok;
    } catch {
      return false;
    }
  };

  // ── Batch Approval & Notify — Single Orders ──
  const batchApprovalNotifyOrders = async () => {
    if (!selOrders.size) return;
    if (!emailConfig.enabled || !emailConfig.approvalEnabled || !emailConfig.approverEmail) {
      notify('Config Required', 'Enable approval emails and set approver email in Settings', 'warning');
      return;
    }
    const selected = orders.filter((o) => selOrders.has(o.id));
    if (!selected.length) return;
    const now = new Date().toISOString().slice(0, 10);
    const approvalId = `APR-${Date.now()}`;
    const orderIds = selected.map((o) => o.id);
    // Use catalog prices (same as UI display) for consistency
    const getEffectiveTotal = (o) => {
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      return price > 0 ? price * (Number(o.quantity) || 0) : Number(o.totalCost) || 0;
    };
    const getEffectivePrice = (o) => {
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      return price > 0 ? price : Number(o.listPrice) || 0;
    };
    const totalCost = selected.reduce((s, o) => s + getEffectiveTotal(o), 0);
    const totalQty = selected.reduce((s, o) => s + (Number(o.quantity) || 0), 0);

    // Create batch approval record
    addApproval({
      id: approvalId,
      orderId: orderIds.join(', '),
      orderType: 'batch',
      description: `Batch Approval - ${selected.length} orders`,
      requestedBy: currentUser?.name || 'System',
      quantity: totalQty,
      totalCost,
      sentDate: now,
      status: 'pending',
      orderIds,
    });

    // Update approvalSentDate
    setOrders((prev) => prev.map((o) => (selOrders.has(o.id) ? { ...o, approvalSentDate: now } : o)));
    orderIds.forEach((id) => dbSync(api.updateOrder(id, { approvalSentDate: now }), 'Approval date not saved'));

    // Build plain-text table
    const hdr =
      'No. | Order ID     | Material No.     | Description                        | Qty  | Unit Price  | Total (SGD)';
    const sep =
      '----|--------------|------------------|------------------------------------|------|-------------|------------';
    const rows = selected.map(
      (o, i) =>
        `${String(i + 1).padEnd(3)} | ${(o.id || '').padEnd(12)} | ${(o.materialNo || 'N/A').padEnd(16)} | ${(o.description || '').substring(0, 34).padEnd(34)} | ${String(o.quantity || 0).padEnd(4)} | S$${getEffectivePrice(o).toFixed(2).padStart(8)} | S$${getEffectiveTotal(o).toFixed(2)}`,
    );
    const table = [
      hdr,
      sep,
      ...rows,
      sep,
      `TOTAL: ${selected.length} orders | ${totalQty} units | S$${totalCost.toFixed(2)}`,
    ].join('\n');

    // Compose email — build data object with ALL available fields for template substitution
    const tmpl = emailTemplates.orderApproval || {};
    const templateData = {
      orderBy: currentUser?.name || 'System',
      date: now,
      orderCount: selected.length,
      totalQty,
      totalCost: totalCost.toFixed(2),
      orderTable: table,
      orderId: selected[0]?.id || '',
      description: selected.map((o) => o.description || '').join(', '),
      materialNo: selected.map((o) => o.materialNo || '').join(', '),
      quantity: selected.reduce((s, o) => s + (Number(o.quantity) || 0), 0),
    };
    const replacePlaceholders = (s) => fillTemplate(s, templateData);
    const subject = replacePlaceholders(
      tmpl.subject || '[APPROVAL] Batch Order Request - {orderCount} Orders (S${totalCost})',
    );

    const sentChannels = [];

    // Email — auto-send if enabled
    if (emailConfig.approvalAutoEmail !== false) {
      const htmlEmail = buildApprovalHtml({
        title: '📋 Order Approval Request',
        headerFields: [
          ['Requested By', currentUser?.name || 'System'],
          ['Date', now],
          ['Total Orders', selected.length],
          ['Total Quantity', `${totalQty} units`],
          ['Total Cost', `S$${totalCost.toFixed(2)}`],
        ],
        sections: [
          {
            cols: ['No.', 'Order ID', 'Material No.', 'Description', 'Qty', 'Unit Price', 'Total (SGD)'],
            rows: selected.map((o, i) => [
              i + 1,
              o.id || '',
              o.materialNo || 'N/A',
              (o.description || '').slice(0, 40),
              o.quantity || 0,
              `S$${getEffectivePrice(o).toFixed(2)}`,
              `S$${getEffectiveTotal(o).toFixed(2)}`,
            ]),
            totals: ['', '', '', `${selected.length} orders`, `${totalQty} units`, '', `S$${totalCost.toFixed(2)}`],
          },
        ],
      });
      const htmlSent = await trySendHtmlEmail(emailConfig.approverEmail, subject, htmlEmail);
      if (!htmlSent) {
        const body = replacePlaceholders(tmpl.body || 'Order Approval Request\n\n{orderTable}');
        const mailtoUrl = `mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        if (mailtoUrl.length > 2000) {
          window.open(
            `mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.substring(0, 1400) + '\n\n[... see full details in Inventory Hub]')}`,
            '_blank',
          );
        } else {
          window.open(mailtoUrl, '_blank');
        }
        sentChannels.push('Email (mailto)');
      } else {
        sentChannels.push('Email (SMTP)');
      }
      addNotifEntry({
        id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'email',
        to: emailConfig.approverEmail,
        subject,
        date: now,
        status: htmlSent ? 'Sent' : 'Sent',
      });
    }

    // WhatsApp — auto-send if enabled and connected
    if (emailConfig.approvalAutoWhatsApp !== false && waConnected) {
      const waTable =
        '```\n' +
        `No │ Material No.    │ Description            │ Qty │ Total\n` +
        `───┼─────────────────┼────────────────────────┼─────┼──────────\n` +
        selected
          .map(
            (o, i) =>
              `${String(i + 1).padEnd(3)}│ ${(o.materialNo || 'N/A').padEnd(16)}│ ${(o.description || '').slice(0, 22).padEnd(22)}│ ${String(o.quantity || 0).padStart(3)} │ S$${getEffectiveTotal(o).toFixed(2)}`,
          )
          .join('\n') +
        '\n' +
        `───┼─────────────────┼────────────────────────┼─────┼──────────\n` +
        `   │ ${selected.length} order(s)       │ TOTAL                  │ ${String(totalQty).padStart(3)} │ S$${totalCost.toFixed(2)}\n` +
        '```';
      const waMsg = fillTemplate(
        waMessageTemplates.orderApproval?.message ||
          '*📋 Order Approval Request*\n\n{orderTable}\n\n_Reply *APPROVE* or *REJECT*_',
        { ...templateData, orderTable: waTable },
      );
      // Pre-select the approver user
      const approverUser = users.find((u) => u.email === emailConfig.approverEmail);
      const preSelected = new Set(approverUser ? [approverUser.id] : []);
      setWaRecipientPicker({
        title: `WhatsApp — ${selected.length} Order Approval`,
        selected: preSelected,
        message: waMsg,
        subject,
      });
      sentChannels.push('WhatsApp (picker shown)');
    }

    notify(
      'Approval Sent',
      `${selected.length} orders sent via ${sentChannels.filter((c) => c !== 'WhatsApp (picker shown)').join(' + ') || 'Email'} to ${emailConfig.approverEmail}${sentChannels.includes('WhatsApp (picker shown)') ? ' — select WhatsApp recipients' : ''}`,
      'success',
    );
    setSelOrders(new Set());
  };

  // ── Batch Approval & Notify — Bulk Orders ──
  const batchApprovalNotifyBulk = async () => {
    if (!selBulk.size) return;
    if (!emailConfig.enabled || !emailConfig.approvalEnabled || !emailConfig.approverEmail) {
      notify('Config Required', 'Enable approval emails and set approver email in Settings', 'warning');
      return;
    }
    const selectedGroups = bulkGroups.filter((g) => selBulk.has(g.id));
    if (!selectedGroups.length) return;
    const now = new Date().toISOString().slice(0, 10);
    const linkedOrders = orders.filter((o) => o.bulkGroupId && selBulk.has(o.bulkGroupId));
    // Use catalog prices (same as UI display) for consistency
    const getEffectiveTotal = (o) => {
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      return price > 0 ? price * (Number(o.quantity) || 0) : Number(o.totalCost) || 0;
    };
    const getEffectivePrice = (o) => {
      const cp = catalogLookup[o.materialNo];
      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
      return price > 0 ? price : Number(o.listPrice) || 0;
    };
    const totalCost = linkedOrders.reduce((s, o) => s + getEffectiveTotal(o), 0);
    const totalQty = linkedOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);

    // Create approval per bulk group
    selectedGroups.forEach((bg) => {
      const bgOrders = orders.filter((o) => o.bulkGroupId === bg.id);
      const bgCost = bgOrders.reduce((s, o) => s + getEffectiveTotal(o), 0);
      const bgQty = bgOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
      addApproval({
        id: `APR-${Date.now()}-${bg.id}`,
        orderId: bg.id,
        orderType: 'bulk',
        description: `Bulk Order - ${bg.month}`,
        requestedBy: bg.createdBy || currentUser?.name || 'System',
        quantity: bgQty,
        totalCost: bgCost,
        sentDate: now,
        status: 'pending',
        orderIds: bgOrders.map((o) => o.id),
      });
    });

    // Update approvalSentDate on all linked orders
    const linkedIds = new Set(linkedOrders.map((o) => o.id));
    setOrders((prev) => prev.map((o) => (linkedIds.has(o.id) ? { ...o, approvalSentDate: now } : o)));
    linkedOrders.forEach((o) => dbSync(api.updateOrder(o.id, { approvalSentDate: now }), 'Approval date not saved'));

    // Build grouped plain-text table
    let lines = [];
    selectedGroups.forEach((bg) => {
      const bgOrders = orders.filter((o) => o.bulkGroupId === bg.id);
      const bgCost = bgOrders.reduce((s, o) => s + getEffectiveTotal(o), 0);
      lines.push(`\n=== ${bg.id} | ${bg.month} | By: ${bg.createdBy || 'N/A'} ===`);
      lines.push('No. | Material No.     | Description                        | Qty  | Unit Price  | Total (SGD)');
      lines.push('----|------------------|------------------------------------|------|-------------|------------');
      bgOrders.forEach((o, i) => {
        lines.push(
          `${String(i + 1).padEnd(3)} | ${(o.materialNo || 'N/A').padEnd(16)} | ${(o.description || '').substring(0, 34).padEnd(34)} | ${String(o.quantity || 0).padEnd(4)} | S$${getEffectivePrice(o).toFixed(2).padStart(8)} | S$${getEffectiveTotal(o).toFixed(2)}`,
        );
      });
      const bgTotalQty = bgOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
      lines.push(`Batch Subtotal: ${bgOrders.length} items | ${bgTotalQty} units | S$${bgCost.toFixed(2)}`);
    });
    lines.push(
      `\nGRAND TOTAL: ${selectedGroups.length} batches | ${linkedOrders.length} items | ${totalQty} units | S$${totalCost.toFixed(2)}`,
    );
    const table = lines.join('\n');

    // Compose email
    const tmplB = emailTemplates.bulkApproval || {};
    const bulkTemplateData = {
      orderBy: currentUser?.name || 'System',
      date: now,
      batchCount: selectedGroups.length,
      itemCount: linkedOrders.length,
      totalQty,
      totalCost: totalCost.toFixed(2),
      orderTable: table,
      month: selectedGroups.map((bg) => bg.month).join(', '),
      orderCount: linkedOrders.length,
    };
    const replaceBulk = (s) => fillTemplate(s, bulkTemplateData);
    const subject = replaceBulk(tmplB.subject || '[APPROVAL] Bulk Order Batch - {batchCount} Batches (S${totalCost})');

    const sentChannels = [];

    // Email — auto-send if enabled
    if (emailConfig.approvalAutoEmail !== false) {
      const bulkSections = selectedGroups.map((bg) => {
        const bgOrders = orders.filter((o) => o.bulkGroupId === bg.id);
        const bgCost = bgOrders.reduce((s, o) => s + getEffectiveTotal(o), 0);
        const bgTotalQty = bgOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
        return {
          heading: `${bg.id} — ${bg.month} (By: ${bg.createdBy || 'N/A'})`,
          cols: ['No.', 'Material No.', 'Description', 'Qty', 'Unit Price', 'Total (SGD)'],
          rows: bgOrders.map((o, i) => [
            i + 1,
            o.materialNo || 'N/A',
            (o.description || '').slice(0, 40),
            o.quantity || 0,
            `S$${getEffectivePrice(o).toFixed(2)}`,
            `S$${getEffectiveTotal(o).toFixed(2)}`,
          ]),
          totals: ['', '', `${bgOrders.length} items`, `${bgTotalQty} units`, '', `S$${bgCost.toFixed(2)}`],
        };
      });
      const htmlEmail = buildApprovalHtml({
        title: '📋 Bulk Order Approval Request',
        headerFields: [
          ['Requested By', currentUser?.name || 'System'],
          ['Date', now],
          ['Batches', selectedGroups.length],
          ['Total Items', linkedOrders.length],
          ['Total Quantity', `${totalQty} units`],
          ['Total Cost', `S$${totalCost.toFixed(2)}`],
        ],
        sections: bulkSections,
        footer: `Grand Total: ${selectedGroups.length} batches | ${linkedOrders.length} items | ${totalQty} units | S$${totalCost.toFixed(2)} — Miltenyi Inventory Hub SG`,
      });
      const htmlSent = await trySendHtmlEmail(emailConfig.approverEmail, subject, htmlEmail);
      if (!htmlSent) {
        const body = replaceBulk(tmplB.body || 'Bulk Order Approval Request\n\n{orderTable}');
        const mailtoUrl = `mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        if (mailtoUrl.length > 2000) {
          window.open(
            `mailto:${emailConfig.approverEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.substring(0, 1400) + '\n\n[... see full details in Inventory Hub]')}`,
            '_blank',
          );
        } else {
          window.open(mailtoUrl, '_blank');
        }
        sentChannels.push('Email (mailto)');
      } else {
        sentChannels.push('Email (SMTP)');
      }
      addNotifEntry({
        id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'email',
        to: emailConfig.approverEmail,
        subject,
        date: now,
        status: 'Sent',
      });
    }

    // WhatsApp — auto-send if enabled and connected
    if (emailConfig.approvalAutoWhatsApp !== false && waConnected) {
      const waSections = selectedGroups
        .map((bg) => {
          const bgOrders = orders.filter((o) => o.bulkGroupId === bg.id);
          const bgCost = bgOrders.reduce((s, o) => s + getEffectiveTotal(o), 0);
          const bgTotalQty = bgOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
          const bgRows = bgOrders
            .map(
              (o, i) =>
                `${String(i + 1).padEnd(3)}│ ${(o.materialNo || 'N/A').padEnd(16)}│ ${(o.description || '').slice(0, 22).padEnd(22)}│ ${String(o.quantity || 0).padStart(3)} │ S$${getEffectiveTotal(o).toFixed(2)}`,
            )
            .join('\n');
          return (
            `*${bg.id} — ${bg.month}*\n` +
            '```\n' +
            `No │ Material No.    │ Description            │ Qty │ Total\n` +
            `───┼─────────────────┼────────────────────────┼─────┼──────────\n` +
            bgRows +
            '\n' +
            `───┼─────────────────┼────────────────────────┼─────┼──────────\n` +
            `   │ Subtotal: ${String(bgOrders.length + ' items, ' + bgTotalQty + ' units').padEnd(30)} │ S$${bgCost.toFixed(2)}\n` +
            '```'
          );
        })
        .join('\n\n');
      const waTableBulk =
        waSections +
        `\n\n*Grand Total: ${selectedGroups.length} batches │ ${linkedOrders.length} items │ ${totalQty} units │ S$${totalCost.toFixed(2)}*`;
      const waMsg = fillTemplate(
        waMessageTemplates.bulkApproval?.message ||
          '*📋 Bulk Order Approval Request*\n\n{orderTable}\n\n_Reply *APPROVE* or *REJECT*_',
        { ...bulkTemplateData, orderTable: waTableBulk },
      );
      const approverUser = users.find((u) => u.email === emailConfig.approverEmail);
      const preSelected = new Set(approverUser ? [approverUser.id] : []);
      setWaRecipientPicker({
        title: `WhatsApp — ${selectedGroups.length} Bulk Batch Approval`,
        selected: preSelected,
        message: waMsg,
        subject,
      });
      sentChannels.push('WhatsApp (picker shown)');
    }

    notify(
      'Approval Sent',
      `${selectedGroups.length} bulk batches sent via ${sentChannels.filter((c) => c !== 'WhatsApp (picker shown)').join(' + ') || 'Email'} to ${emailConfig.approverEmail}${sentChannels.includes('WhatsApp (picker shown)') ? ' — select WhatsApp recipients' : ''}`,
      'success',
    );
    setSelBulk(new Set());
  };

  // Batch Actions — Users
  const batchDeleteUsers = () => {
    if (!selUsers.size || !window.confirm(`Delete ${selUsers.size} user(s)?`)) return;
    const ids = [...selUsers];
    setUsers((prev) => prev.filter((u) => !selUsers.has(u.id)));
    ids.forEach((id) => dbSync(api.deleteUser(id), 'User delete not saved'));
    notify('Batch Delete', `${ids.length} users deleted`, 'success');
    setSelUsers(new Set());
  };
  const batchRoleUsers = (role) => {
    if (!selUsers.size) return;
    const ids = [...selUsers];
    setUsers((prev) => prev.map((u) => (selUsers.has(u.id) ? { ...u, role } : u)));
    ids.forEach((id) => dbSync(api.updateUser(id, { role }), 'User role update not saved'));
    notify('Batch Update', `${ids.length} users → ${role}`, 'success');
    setSelUsers(new Set());
  };
  const batchStatusUsers = (status) => {
    if (!selUsers.size) return;
    const ids = [...selUsers];
    setUsers((prev) => prev.map((u) => (selUsers.has(u.id) ? { ...u, status } : u)));
    ids.forEach((id) => dbSync(api.updateUser(id, { status }), 'User status not saved'));
    notify('Batch Update', `${ids.length} users → ${status}`, 'success');
    setSelUsers(new Set());
  };

  // Batch Actions — Stock Checks
  const batchDeleteStockChecks = () => {
    if (!selStockChecks.size || !window.confirm(`Delete ${selStockChecks.size} stock check(s)?`)) return;
    const ids = [...selStockChecks];
    setStockChecks((prev) => prev.filter((s) => !selStockChecks.has(s.id)));
    ids.forEach((id) => dbSync(api.deleteStockCheck(id), 'Stock check delete not saved'));
    notify('Batch Delete', `${selStockChecks.size} stock checks deleted`, 'success');
    setSelStockChecks(new Set());
  };

  // Batch Actions — Notifications
  const batchDeleteNotifs = () => {
    if (!selNotifs.size || !window.confirm(`Delete ${selNotifs.size} notification(s)?`)) return;
    const ids = [...selNotifs];
    setNotifLog((prev) => prev.filter((n) => !selNotifs.has(n.id)));
    ids.forEach((id) => dbSync(api.deleteNotifEntry(id), 'Notification delete not saved'));
    notify('Batch Delete', `${selNotifs.size} notifications deleted`, 'success');
    setSelNotifs(new Set());
  };

  // Batch Actions — Approvals
  const batchApprovalAction = (action) => {
    if (!selApprovals.size) return;
    const ids = [...selApprovals];
    ids.forEach((id) => handleApprovalAction(id, action));
    notify(
      `Batch ${action === 'approved' ? 'Approve' : 'Reject'}`,
      `${ids.length} approvals ${action}`,
      action === 'approved' ? 'success' : 'warning',
    );
    setSelApprovals(new Set());
  };

  // ── WhatsApp Baileys functions ──
  // WhatsApp API Base URL
  const WA_API_URL = '/api/whatsapp';
  // Auth headers for WA API calls
  const waHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` });

  // Send WhatsApp to selected recipients from picker modal
  const sendWaPickerMessages = async () => {
    if (!waRecipientPicker || waSending) return;
    const { selected, message, subject } = waRecipientPicker;
    const recipients = users.filter((u) => selected.has(u.id) && u.phone);
    if (!recipients.length) {
      notify('No Recipients', 'No recipients with phone numbers selected', 'warning');
      return;
    }
    setWaSending(true);
    const now = new Date().toISOString().slice(0, 10);
    let waSent = 0;
    const failures = [];
    for (const u of recipients) {
      try {
        const res = await fetch(`${WA_API_URL}/send`, {
          method: 'POST',
          headers: waHeaders(),
          body: JSON.stringify({ phone: u.phone, template: 'custom', data: { message } }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.success) {
          failures.push(`${u.name}: ${result.error || `HTTP ${res.status}`}`);
          addNotifEntry({
            id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'whatsapp',
            to: `${u.phone} (${u.name})`,
            subject: subject || 'WhatsApp Notification',
            date: now,
            status: 'Failed',
          });
          continue;
        }
        addNotifEntry({
          id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'whatsapp',
          to: `${u.phone} (${u.name})`,
          subject: subject || 'WhatsApp Notification',
          date: now,
          status: 'Delivered',
        });
        waSent++;
      } catch (e) {
        failures.push(`${u.name}: ${e.message}`);
      }
    }
    if (waSent > 0) {
      notify('WhatsApp Sent', `Sent to ${waSent} of ${recipients.length} recipient(s)`, 'success');
    }
    if (failures.length > 0) {
      notify('WhatsApp Send Failed', failures.join(', '), 'error');
    }
    setWaSending(false);
    setWaRecipientPicker(null);
  };

  // Poll for WhatsApp status
  const pollWaStatus = async () => {
    try {
      const res = await fetch(`${WA_API_URL}/status`, { headers: { Authorization: `Bearer ${api.getToken()}` } });
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
    setWaQrCode('');
    setWaQrVisible(true); // show QR panel immediately with loading state
    try {
      const res = await fetch(`${WA_API_URL}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const data = await res.json();

      if (data.success) {
        // Server may return QR inline (waited up to 15s)
        if (data.qrCode) {
          setWaQrCode(data.qrCode);
        }
        if (data.status === 'connected') {
          setWaConnected(true);
          setWaConnecting(false);
          setWaQrVisible(false);
          setWaSessionInfo(data.sessionInfo);
          notify('WhatsApp Connected', 'Session already active', 'success');
          return;
        }

        notify('Scan QR Code', 'Open WhatsApp → Linked Devices → Link a Device', 'info');

        // Fast poll: 800ms for first 20s, then 2s after
        let pollCount = 0;
        const pollInterval = setInterval(
          async () => {
            pollCount++;
            const status = await pollWaStatus();
            if (status === 'connected' || status === 'error') {
              clearInterval(pollInterval);
              setWaConnecting(false);
              if (status === 'error') {
                setWaQrVisible(false);
                notify('Connection Failed', 'WhatsApp connection error. Try again.', 'warning');
              }
            }
          },
          pollCount < 25 ? 800 : 2000,
        );

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (!waConnected) {
            setWaConnecting(false);
            setWaQrVisible(false);
            notify('QR Expired', 'QR code timed out. Press Scan QR Code to try again.', 'warning');
          }
        }, 120000);
      } else {
        setWaConnecting(false);
        setWaQrVisible(false);
        notify('Connection Failed', data.error || 'Server returned an error', 'warning');
      }
    } catch (err) {
      setWaConnecting(false);
      setWaQrVisible(false);
      notify('Connection Failed', 'Make sure the server is running', 'warning');
    }
  };

  const handleWaDisconnect = async () => {
    try {
      await fetch(`${WA_API_URL}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
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
        headers: waHeaders(),
        body: JSON.stringify({
          phone,
          template: waTemplate !== 'custom' ? waTemplate : null,
          data: waTemplate === 'custom' ? { message: waMessageText } : getTemplateData(waTemplate),
        }),
      });

      const data = await res.json();

      if (data.success) {
        const msg = {
          id: `WA-${String(waMessages.length + 1).padStart(3, '0')}`,
          to: waRecipient,
          message: waMessageText,
          time: new Date().toLocaleString(),
          status: 'sent',
        };
        setWaMessages((prev) => [msg, ...prev]);
        addNotifEntry({
          id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'whatsapp',
          to: waRecipient,
          subject: waMessageText.slice(0, 50),
          date: new Date().toISOString().slice(0, 10),
          status: 'Delivered',
        });
        setWaRecipient('');
        setWaMessageText('');
        setWaTemplate('custom');
        notify('WhatsApp Sent', `Message delivered to ${phone}`, 'success');

        // Update message status
        setTimeout(
          () => setWaMessages((prev) => prev.map((m, i) => (i === 0 ? { ...m, status: 'delivered' } : m))),
          2000,
        );
        setTimeout(() => setWaMessages((prev) => prev.map((m, i) => (i === 0 ? { ...m, status: 'read' } : m))), 5000);
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
    switch (templateId) {
      case 'orderCreated':
        return {
          orderId: orders[0]?.id || 'ORD-XXX',
          description: orders[0]?.description || 'Item',
          materialNo: orders[0]?.materialNo || '130-XXX-XXX',
          quantity: orders[0]?.quantity || 1,
          total: fmt(orders[0]?.totalCost || 0),
          orderBy: orders[0]?.orderBy || currentUser?.name,
          date: now.toLocaleDateString(),
        };
      case 'backorderReceived': {
        const boOrder = orders.find((o) => o.backOrder < 0);
        return {
          orderId: boOrder?.id || 'ORD-XXX',
          description: boOrder?.description || 'Item',
          received: boOrder?.qtyReceived || 0,
          ordered: boOrder?.quantity || 0,
          remaining: Math.abs(boOrder?.backOrder || 0),
        };
      }
      case 'deliveryArrival':
        return {
          month: bulkGroups[0]?.month || 'Current Month',
          itemCount: bulkGroups[0]?.items || 0,
          totalValue: fmt(bulkGroups[0]?.totalCost || 0),
        };
      case 'stockAlert':
        return {
          checkId: stockChecks[0]?.id || 'SC-XXX',
          discrepancies: stockChecks[0]?.disc || 0,
          checkedBy: stockChecks[0]?.checkedBy || currentUser?.name,
          date: now.toLocaleDateString(),
        };
      case 'monthlyUpdate':
        return {
          month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
          totalOrders: orders.length,
          received: orders.filter((o) => o.status === 'Received').length,
          pending: orders.filter((o) => o.status === 'Pending Approval' || o.status === 'Approved').length,
          backOrders: orders.filter((o) => o.arrivalDate && (o.qtyReceived || 0) < o.quantity).length,
          totalValue: fmt(orders.reduce((s, o) => s + o.totalCost, 0)),
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
          headers: waHeaders(),
          body: JSON.stringify({ phone, template, data }),
        });
      } catch (err) {
        console.error('Auto-notify error:', err);
      }
    }
  };

  // Use editable waMessageTemplates for template previews in Send Message dropdown
  const waTemplates = {
    backOrder: () =>
      (waMessageTemplates.backOrder?.message || '').replace(
        /\{items\}/g,
        '- Yearly Maintenance Kit, MACSima (5 units)',
      ),
    deliveryArrived: () => waMessageTemplates.deliveryArrived?.message || '',
    stockAlert: () => (waMessageTemplates.stockAlert?.message || '').replace(/\{item\}/g, 'Pump Syringe Hamilton 5ml'),
    monthlyUpdate: () =>
      (waMessageTemplates.monthlyUpdate?.message || '').replace(
        /\{month\}/g,
        new Date().toLocaleString('en', { month: 'short', year: 'numeric' }),
      ),
  };

  // ── Bulk Order ──
  const addBulkItem = () =>
    setBulkItems((prev) => [...prev, { materialNo: '', description: '', quantity: 1, listPrice: 0 }]);
  const removeBulkItem = (idx) => setBulkItems((prev) => prev.filter((_, i) => i !== idx));
  const updateBulkItem = (idx, field, val) => {
    setBulkItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        if (field === 'materialNo' && val.length >= 10) {
          const p = catalogLookup[val];
          if (p) return { ...updated, description: p.d, listPrice: p.sg || p.tp || p.dist || 0 };
        }
        return updated;
      }),
    );
  };
  const handleBulkSubmit = async () => {
    const validItems = bulkItems.filter((i) => i.materialNo && i.description);
    if (!validItems.length) {
      notify('No Valid Items', 'Each item needs Material No. and Description', 'warning');
      return;
    }
    if (!bulkOrderBy) {
      notify('Missing Field', 'Order By is required', 'warning');
      return;
    }
    setIsSubmitting(true);
    const bgId = `BG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newOrders = validItems.map((item, idx) => ({
      id: `ORD-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      materialNo: item.materialNo,
      description: item.description,
      quantity: parseInt(item.quantity) || 1,
      listPrice: parseFloat(item.listPrice) || 0,
      totalCost: (parseFloat(item.listPrice) || 0) * (parseInt(item.quantity) || 1),
      orderDate: new Date().toISOString().slice(0, 10),
      orderBy: bulkOrderBy,
      remark: `Bulk: ${bulkMonth} — ${bulkRemark}`,
      arrivalDate: null,
      qtyReceived: 0,
      backOrder: -(parseInt(item.quantity) || 1),
      engineer: '',
      emailFull: '',
      emailBack: '',
      status: 'Pending Approval',
      month: bulkMonth,
      year: String(new Date().getFullYear()),
      bulkGroupId: bgId,
    }));
    const totalCost = newOrders.reduce((s, o) => s + o.totalCost, 0);
    const bg = {
      id: bgId,
      month: bulkMonth,
      createdBy: bulkOrderBy,
      items: newOrders.length,
      totalCost,
      status: 'Pending Approval',
      date: new Date().toISOString().slice(0, 10),
    };
    // Save to DB first, then update local state
    const bgCreated = await api.createBulkGroup(bg);
    if (!bgCreated) {
      setIsSubmitting(false);
      notify('Save Failed', 'Bulk group not saved to database. Please retry.', 'error');
      return;
    }
    const orderResults = await Promise.all(newOrders.map((o) => api.createOrder(o)));
    const failCount = orderResults.filter((r) => !r).length;
    if (failCount)
      notify('Partial Save', `${failCount} of ${newOrders.length} items failed to save. Please check.`, 'warning');
    setOrders((prev) => [...newOrders, ...prev]);
    setBulkGroups((prev) => [bg, ...prev]);
    setShowBulkOrder(false);
    setBulkItems([{ materialNo: '', description: '', quantity: 1, listPrice: 0 }]);
    setBulkRemark('');
    setIsSubmitting(false);
    notify(
      'Bulk Order Created',
      `${newOrders.length} items for ${bulkMonth}. Select and use "Order Approval & Notify" to send for approval.`,
      'success',
    );
    logAction('create', 'bulk_group', bg.id, { month: bulkMonth, items: newOrders.length, totalCost: bg.totalCost });
    // Auto-notify: bulk order created
    sendAutoWaNotify(
      'bulkOrderCreated',
      'bulkApproval',
      {
        batchCount: 1,
        itemCount: newOrders.length,
        totalQty: newOrders.reduce((s, o) => s + (o.quantity || 0), 0),
        totalCost: totalCost.toFixed(2),
        orderBy: bulkOrderBy || currentUser?.name || 'System',
        date: new Date().toISOString().slice(0, 10),
      },
      `Bulk Order: ${newOrders.length} items for ${bulkMonth}`,
    );
  };

  // ── Auth Handlers ──
  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      notify('Missing Fields', 'Please enter username and password', 'warning');
      return;
    }
    setIsSubmitting(true);
    const result = await api.login(loginForm.username, loginForm.password);
    setIsSubmitting(false);
    if (result && result.user) {
      setCurrentUser(result.user);
      setActiveModule(null); // show module picker on fresh login
      api.resetAuthError(); // allow future session-expired toasts
      await loadAppData(); // fetch all data from DB after login
      notify(
        `Welcome back, ${result.user.name}`,
        result.user.role === 'admin' ? 'Admin access granted' : 'User access granted',
        'success',
      );
    } else {
      // Fallback: local login when backend/DB is unavailable
      const localUser = users.find((u) => u.username === loginForm.username && u.status === 'active');
      if (localUser && loginForm.password === 'admin123' && localUser.role === 'admin') {
        setCurrentUser(localUser);
        setActiveModule(null); // show module picker on fresh login
        notify(`Welcome back, ${localUser.name}`, 'Admin access granted (offline mode)', 'success');
      } else {
        notify('Login Failed', 'Invalid credentials or account not approved', 'warning');
      }
    }
  };
  const handleRegister = async () => {
    if (!regForm.username || !regForm.password || !regForm.name || !regForm.email) {
      notify('Missing Fields', 'Please fill all required fields', 'warning');
      return;
    }
    if (
      users.find((u) => u.username === regForm.username) ||
      pendingUsers.find((u) => u.username === regForm.username)
    ) {
      notify('Username Taken', 'Choose a different username', 'warning');
      return;
    }
    const result = await api.register({
      username: regForm.username,
      password: regForm.password,
      name: regForm.name,
      email: regForm.email,
      phone: regForm.phone,
    });
    if (result) {
      setPendingUsers((prev) => [
        ...prev,
        {
          id: result.id || `P${String(prev.length + 2).padStart(3, '0')}`,
          username: regForm.username,
          name: regForm.name,
          email: regForm.email,
          phone: regForm.phone,
          requestDate: new Date().toISOString().slice(0, 10),
        },
      ]);
    } else {
      setPendingUsers((prev) => [
        ...prev,
        {
          id: `P${String(prev.length + 2).padStart(3, '0')}`,
          username: regForm.username,
          name: regForm.name,
          email: regForm.email,
          phone: regForm.phone,
          requestDate: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    setRegForm({ username: '', password: '', name: '', email: '', phone: '' });
    setAuthView('login');
    notify('Registration Submitted', 'Your account is pending admin approval', 'info');
  };
  const handleApproveUser = async (pending) => {
    const newUser = {
      id: `U-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: pending.username,
      name: pending.name,
      email: pending.email,
      phone: pending.phone || '',
      role: 'user',
      status: 'active',
      password: 'temp123',
      permissions: { ...DEFAULT_USER_PERMS },
    };
    const created = await api.createUser(newUser);
    if (created) {
      setUsers((prev) => [...prev, created]);
    } else {
      setUsers((prev) => [...prev, { ...newUser, created: new Date().toISOString().slice(0, 10) }]);
    }
    setPendingUsers((prev) => prev.filter((u) => u.id !== pending.id));
    notify('User Approved', `${pending.name} can now login (temp password: temp123)`, 'success');
  };
  const handleRejectUser = (id) => {
    setPendingUsers((prev) => prev.filter((u) => u.id !== id));
    notify('Registration Rejected', 'User has been denied access', 'warning');
  };
  const handleCreateUser = async (form) => {
    const perms =
      form.role === 'admin'
        ? Object.fromEntries(Object.keys(DEFAULT_USER_PERMS).map((k) => [k, true]))
        : { ...DEFAULT_USER_PERMS };
    const newUser = {
      id: `U-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      setUsers((prev) => [...prev, created]);
    } else {
      setUsers((prev) => [...prev, { ...newUser, created: new Date().toISOString().slice(0, 10) }]);
    }
    notify('User Created', `${form.name} (${form.role}) added`, 'success');
  };

  // ── Nav ──
  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, perm: 'dashboard', module: 'inventory' },
    { id: 'catalog', label: 'Parts Catalog', icon: Database, perm: 'catalog', module: 'inventory' },
    { id: 'allorders', label: 'All Orders', icon: ShoppingCart, perm: 'orders', module: 'inventory' },
    { id: 'orders', label: 'Single Orders', icon: Package, perm: 'orders', module: 'inventory' },
    { id: 'bulkorders', label: 'Bulk Orders', icon: Layers, perm: 'bulkOrders', module: 'inventory' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, perm: 'analytics', module: 'inventory' },
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp, perm: 'analytics', module: 'inventory' },
    { id: 'stockcheck', label: 'Stock Check', icon: ClipboardList, perm: 'stockCheck', module: 'inventory' },
    { id: 'delivery', label: 'Part Arrival', icon: Truck, perm: 'delivery', module: 'inventory' },
    { id: 'service', label: 'Service', icon: Briefcase, perm: 'dashboard', module: 'service' },
    { id: 'localinventory', label: 'Local Inventory', icon: Warehouse, perm: 'dashboard', module: 'service' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, perm: 'whatsapp', module: 'shared' },
    { id: 'notifications', label: 'Notifications', icon: Bell, perm: 'notifications', module: 'shared' },
    { id: 'audit', label: 'Audit Trail', icon: Shield, perm: 'auditTrail', module: 'shared' },
    { id: 'aibot', label: 'AI Bot Admin', icon: Bot, perm: 'aiBot', module: 'shared' },
    { id: 'users', label: 'User Management', icon: Users, perm: 'users', module: 'shared' },
    { id: 'settings', label: 'Settings', icon: Settings, perm: 'settings', module: 'shared' },
  ];
  const navItems = allNavItems.filter(
    (n) => (n.module === activeModule || n.module === 'shared') && hasPermission(n.perm),
  );

  // ════════════════════════════ AI BOT PROCESSING ════════════════════════════
  const processAiMessage = async (userMessage) => {
    const msg = userMessage.toLowerCase().trim();
    const catalogLookupLocal = partsCatalog.reduce((acc, p) => {
      acc[p.m] = p;
      return acc;
    }, {});

    // Price check pattern
    const priceMatch = msg.match(/price.*?(\d{3}-\d{3}-\d{3})|^(\d{3}-\d{3}-\d{3})/);
    if (priceMatch || msg.includes('price')) {
      const matNo = priceMatch ? priceMatch[1] || priceMatch[2] : null;
      if (matNo && catalogLookupLocal[matNo]) {
        const p = catalogLookupLocal[matNo];
        return {
          type: 'price',
          text: `📦 **${p.d}** (${matNo})\n\n💰 **Prices (${priceConfig.year}):**\n• Unit Price: ${fmt(p.sg)}\n• Distributor: ${fmt(p.dist)}\n• Transfer: ${fmt(p.tp)}\n\nWould you like to place an order?`,
        };
      }
      if (matNo)
        return {
          type: 'not_found',
          text: `I couldn't find part number **${matNo}** in the catalog. Please verify the material number.`,
        };
      return { type: 'prompt', text: 'Please provide a material number (e.g., 130-095-005) to check the price.' };
    }

    // Order status pattern
    const orderMatch = msg.match(/status.*?(ord-\d+)|(ord-\d+).*status|order.*(ord-\d+)/i);
    if (orderMatch || msg.includes('status') || msg.includes('track')) {
      const orderId = orderMatch ? (orderMatch[1] || orderMatch[2] || orderMatch[3])?.toUpperCase() : null;
      if (orderId) {
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          return {
            type: 'order',
            text: `📋 **Order ${order.id}**\n\n• Item: ${order.description}\n• Qty: ${order.quantity}\n• Status: **${order.status}**\n• Ordered: ${fmtDate(order.orderDate)}\n• Arrival: ${order.arrivalDate ? fmtDate(order.arrivalDate) : 'Pending'}\n• Received: ${order.qtyReceived}/${order.quantity}`,
          };
        }
        return { type: 'not_found', text: `Order **${orderId}** not found. Please check the order ID.` };
      }
      return { type: 'prompt', text: 'Please provide an order ID (e.g., ORD-027) to check the status.' };
    }

    // Stock check pattern
    if (msg.includes('stock') || msg.includes('inventory') || msg.includes('available')) {
      const stockItems = stockChecks.slice(0, 3);
      return {
        type: 'stock',
        text: `📊 **Recent Stock Checks:**\n\n${stockItems.map((s) => `• ${s.id}: ${s.items} items checked, ${s.disc} discrepancies (${s.status})`).join('\n')}\n\nFor detailed stock info, check the Stock Check page.`,
      };
    }

    // Place order pattern
    const placeOrderMatch =
      msg.match(/order\s*(\d+)?\s*[x×]?\s*(\d{3}-\d{3}-\d{3})/i) ||
      msg.match(/(\d{3}-\d{3}-\d{3})\s*[x×]?\s*(\d+)?.*order/i);
    if (msg.includes('place order') || msg.includes('create order') || placeOrderMatch) {
      if (placeOrderMatch) {
        const matNo = placeOrderMatch[2] || placeOrderMatch[1];
        const qty = placeOrderMatch[1] || placeOrderMatch[2] || 1;
        if (catalogLookupLocal[matNo]) {
          const p = catalogLookupLocal[matNo];
          return {
            type: 'order_confirm',
            text: `🛒 **Ready to order:**\n\n• Part: ${p.d}\n• Material: ${matNo}\n• Quantity: ${qty}\n• Unit Price: ${fmt(p.sg || p.tp || p.dist || 0)}\n• Total: ${fmt((p.sg || p.tp || p.dist || 0) * parseInt(qty))}\n\nType "confirm" to place this order or "cancel" to abort.`,
            pendingOrder: {
              materialNo: matNo,
              description: p.d,
              quantity: parseInt(qty),
              listPrice: p.sg || p.tp || p.dist || 0,
            },
          };
        }
      }
      return {
        type: 'prompt',
        text: 'To place an order, tell me the part number and quantity.\nExample: "Order 2x 130-095-005"',
      };
    }

    // Confirm order
    if (msg === 'confirm' && aiMessages.length > 0) {
      const lastBotMsg = [...aiMessages].reverse().find((m) => m.role === 'bot' && m.pendingOrder);
      if (lastBotMsg?.pendingOrder) {
        const po = lastBotMsg.pendingOrder;
        const aiNow = new Date();
        const aiMonth = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][aiNow.getMonth()]} ${aiNow.getFullYear()}`;
        const newOrd = {
          id: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...po,
          totalCost: po.listPrice * po.quantity,
          orderDate: aiNow.toISOString().slice(0, 10),
          arrivalDate: null,
          qtyReceived: 0,
          backOrder: -po.quantity,
          engineer: '',
          emailFull: '',
          emailBack: '',
          status: 'Pending',
          orderBy: currentUser.name,
          month: aiMonth,
          year: String(aiNow.getFullYear()),
          remark: 'Created via AI Assistant',
        };
        const aiCreated = await api.createOrder(newOrd);
        if (!aiCreated) {
          notify('Save Failed', 'Order not saved to database', 'error');
          return { type: 'error', text: 'Failed to save order. Please try again.' };
        }
        setOrders((prev) => [newOrd, ...prev]);
        notify('Order Created', `${po.description} × ${po.quantity}`, 'success');
        return {
          type: 'success',
          text: `✅ **Order Created Successfully!**\n\n• Order ID: ${newOrd.id}\n• Item: ${po.description}\n• Quantity: ${po.quantity}\n• Total: ${fmt(newOrd.totalCost)}\n\nYou can track this order by asking "Status ${newOrd.id}"`,
        };
      }
    }

    // Cancel
    if (msg === 'cancel') {
      return { type: 'info', text: 'Order cancelled. How else can I help you?' };
    }

    // Help
    if (msg.includes('help') || msg === 'hi' || msg === 'hello') {
      return {
        type: 'help',
        text: `👋 ${aiBotConfig.greeting}\n\n**I can help you with:**\n• 💰 Check prices - "Price for 130-095-005"\n• 📦 Track orders - "Status ORD-027"\n• 🛒 Place orders - "Order 2x 130-095-005"\n• 📊 Stock levels - "Check stock"\n\nHow can I assist you today?`,
      };
    }

    // Default - would go to AI API in real implementation
    return {
      type: 'ai',
      text: `I understand you're asking about: "${userMessage}"\n\nThis query would be processed by the AI API for a detailed response. For now, try:\n• Price checks\n• Order status\n• Placing orders\n• Stock information\n\nOr type "help" for available commands.`,
    };
  };

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    const userMsg = { id: Date.now(), role: 'user', text: aiInput, time: new Date().toLocaleTimeString() };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput('');
    setAiProcessing(true);

    setTimeout(async () => {
      const response = await processAiMessage(aiInput);
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        text: response.text,
        type: response.type,
        time: new Date().toLocaleTimeString(),
        pendingOrder: response.pendingOrder,
      };
      setAiMessages((prev) => [...prev, botMsg]);
      setAiProcessing(false);
      setAiConversationLogs((prev) => [
        ...prev,
        {
          id: `AI-${String(prev.length + 1).padStart(3, '0')}`,
          user: currentUser.name,
          query: aiInput,
          response: response.text.slice(0, 100),
          time: new Date().toISOString(),
          type: response.type,
        },
      ]);
    }, 500);
  };

  const handleAiQuickAction = (action) => {
    const prompts = {
      price: 'I want to check a price',
      status: 'Check order status',
      order: 'I want to place an order',
      stock: 'Show stock levels',
    };
    setAiInput(prompts[action] || '');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map((f) => ({
      id: `KB-${String(aiKnowledgeBase.length + 1).padStart(3, '0')}`,
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      type: f.name.split('.').pop().toUpperCase(),
      uploadedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: currentUser.name,
    }));
    setAiKnowledgeBase((prev) => [...prev, ...newFiles]);
    notify('Files Uploaded', `${files.length} file(s) added to knowledge base`, 'success');
  };

  // ── Header mapping for CSV/Excel import ──
  const HEADER_MAP = {
    id: 'id',
    'order id': 'id',
    orderid: 'id',
    order_id: 'id',
    material: 'materialNo',
    'material no': 'materialNo',
    materialno: 'materialNo',
    material_no: 'materialNo',
    'part number': 'materialNo',
    'part no': 'materialNo',
    partno: 'materialNo',
    'mat no': 'materialNo',
    description: 'description',
    desc: 'description',
    item: 'description',
    'item description': 'description',
    product: 'description',
    'product name': 'description',
    name: 'description',
    quantity: 'quantity',
    qty: 'quantity',
    ordered: 'quantity',
    'order qty': 'quantity',
    'ordered qty': 'quantity',
    price: 'listPrice',
    'list price': 'listPrice',
    listprice: 'listPrice',
    'unit price': 'listPrice',
    'transfer price': 'listPrice',
    tp: 'listPrice',
    cost: 'listPrice',
    total: 'totalCost',
    'total cost': 'totalCost',
    totalcost: 'totalCost',
    amount: 'totalCost',
    'total amount': 'totalCost',
    'ext price': 'totalCost',
    'extended price': 'totalCost',
    'order date': 'orderDate',
    orderdate: 'orderDate',
    date: 'orderDate',
    created: 'orderDate',
    'created date': 'orderDate',
    order_date: 'orderDate',
    'order by': 'orderBy',
    orderby: 'orderBy',
    'ordered by': 'orderBy',
    user: 'orderBy',
    'created by': 'orderBy',
    requestor: 'orderBy',
    requester: 'orderBy',
    remark: 'remark',
    remarks: 'remark',
    note: 'remark',
    notes: 'remark',
    comment: 'remark',
    comments: 'remark',
    arrival: 'arrivalDate',
    'arrival date': 'arrivalDate',
    arrivaldate: 'arrivalDate',
    'received date': 'arrivalDate',
    'delivery date': 'arrivalDate',
    received: 'qtyReceived',
    'qty received': 'qtyReceived',
    qtyreceived: 'qtyReceived',
    'received qty': 'qtyReceived',
    'back order': 'backOrder',
    backorder: 'backOrder',
    pending: 'backOrder',
    back_order: 'backOrder',
    engineer: 'engineer',
    assigned: 'engineer',
    'assigned to': 'engineer',
    technician: 'engineer',
    status: 'status',
    month: 'month',
    batch: 'month',
    'month batch': 'month',
    period: 'month',
    year: 'year',
    category: 'category',
    cat: 'category',
    type: 'category',
  };

  // Parse rows from a 2D array (headers + data) into order objects
  const parseRowsToOrders = (headers, rows, sheetMonth) => {
    const colMap = {};
    headers.forEach((h, i) => {
      const key = String(h || '')
        .trim()
        .toLowerCase()
        .replace(/['"]/g, '');
      if (HEADER_MAP[key]) colMap[HEADER_MAP[key]] = i;
    });

    const existingIds = new Set(orders.map((o) => o.id));
    let nextId = Math.max(0, ...orders.map((o) => parseInt(o.id.replace('ORD-', '')) || 0)) + 1;
    const parsed = [];

    for (const row of rows) {
      const getValue = (field) => {
        const idx = colMap[field];
        if (idx === undefined) return '';
        const val = row[idx];
        return val != null
          ? String(val)
              .trim()
              .replace(/^["']|["']$/g, '')
          : '';
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
        emailFull: '',
        emailBack: '',
        status: getValue('status') || (received >= qty && qty > 0 ? 'Received' : 'Pending Approval'),
        month: getValue('month') || sheetMonth || 'Import ' + new Date().toISOString().slice(0, 7),
        year: getValue('year') || new Date().getFullYear().toString(),
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

        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (jsonData.length < 2) return;

          const headers = jsonData[0];
          const rows = jsonData.slice(1).filter((r) => r.some((cell) => cell !== ''));
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
              date: new Date().toISOString().slice(0, 10),
            });
          }
        });

        if (allOrders.length > 0) {
          setHistoryImportData(allOrders);
          setHistoryImportPreview(true);
          // Store bulk groups to add on confirm
          setHistoryImportData((prev) => {
            prev._bulkGroups = newBulkGroups;
            return [...allOrders];
          });
          setHistoryImportData(allOrders);
          // Temporarily store bulk groups
          window.__pendingBulkGroups = newBulkGroups;
          notify(
            'Excel Parsed',
            allOrders.length + ' orders from ' + wb.SheetNames.length + ' sheet(s) ready to import',
            'success',
          );
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
        const lines = text.split('\n').filter((line) => line.trim());
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
            else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else current += char;
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
    setOrders((prev) => [...prev, ...historyImportData]);
    historyImportData.forEach((o) => dbSync(api.createOrder(o), 'History order not saved'));
    // Also add any bulk groups from Excel sheets
    if (window.__pendingBulkGroups && window.__pendingBulkGroups.length > 0) {
      setBulkGroups((prev) => [...window.__pendingBulkGroups, ...prev]);
      window.__pendingBulkGroups.forEach((g) => dbSync(api.createBulkGroup(g), 'History bulk group not saved'));
      notify(
        'History Imported',
        historyImportData.length + ' orders + ' + window.__pendingBulkGroups.length + ' bulk batches added',
        'success',
      );
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
      <div
        style={{
          minHeight: '100vh',
          background: '#F4F6F8',
          fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
          padding: 24,
        }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap'); .mono{font-family:'JetBrains Mono',monospace}`}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg,#006837,#00A550)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Order Details</h1>
              <span className="mono" style={{ fontSize: 12, color: '#64748B' }}>
                {o.id}
              </span>
            </div>
          </div>
          <button
            onClick={() => window.close()}
            style={{
              padding: '10px 20px',
              background: '#E2E8F0',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <X size={16} /> Close Window
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          {/* Title & Status */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{o.description}</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Badge status={o.status} />
              <span
                className="mono"
                style={{ fontSize: 12, color: '#64748B', padding: '4px 10px', background: '#F8FAFB', borderRadius: 6 }}
              >
                {o.materialNo || '—'}
              </span>
            </div>
          </div>

          {/* Key Info Badges */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {o.orderBy && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: '#DBEAFE',
                  borderRadius: 10,
                }}
              >
                <User size={16} color="#2563EB" />
                <div>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>ORDERED BY</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>{o.orderBy}</div>
                </div>
              </div>
            )}
            {o.month && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: '#E6F4ED',
                  borderRadius: 10,
                }}
              >
                <Calendar size={16} color="#0B7A3E" />
                <div>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>MONTH BATCH</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0B7A3E' }}>
                    {String(o.month).replace('_', ' ')}
                  </div>
                </div>
              </div>
            )}
            {o.orderDate && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: '#F8FAFB',
                  borderRadius: 10,
                }}
              >
                <Clock size={16} color="#64748B" />
                <div>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>ORDER DATE</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{fmtDate(o.orderDate)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Quantity Info */}
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Package size={18} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>Quantity Status</span>
            </div>
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Ordered</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>
                  {o.quantity}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Received</div>
                <div
                  className="mono"
                  style={{ fontSize: 28, fontWeight: 700, color: o.qtyReceived >= o.quantity ? '#059669' : '#D97706' }}
                >
                  {o.qtyReceived || 0}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Back Order</div>
                <div
                  className="mono"
                  style={{ fontSize: 28, fontWeight: 700, color: (o.backOrder || 0) < 0 ? '#DC2626' : '#059669' }}
                >
                  {(o.backOrder || 0) < 0 ? o.backOrder : '✓ Full'}
                </div>
              </div>
            </div>
            {(o.backOrder || 0) < 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: 10,
                  background: '#FEF2F2',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={14} /> {Math.abs(o.backOrder)} items still pending
              </div>
            )}
            {o.qtyReceived >= o.quantity && o.quantity > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: 10,
                  background: '#D1FAE5',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle size={14} /> Order fully received
              </div>
            )}
          </div>

          {/* Price & Details Grid */}
          <div
            className="grid-2"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}
          >
            {[
              { l: 'Unit Price', v: o.listPrice > 0 ? fmt(o.listPrice) : '—', icon: DollarSign, c: '#0B7A3E' },
              { l: 'Total Cost', v: o.totalCost > 0 ? fmt(o.totalCost) : '—', icon: DollarSign, c: '#2563EB' },
              { l: 'Arrival Date', v: o.arrivalDate ? fmtDate(o.arrivalDate) : 'Pending', icon: Truck, c: '#7C3AED' },
              { l: 'Engineer', v: o.engineer || 'Not Assigned', icon: User, c: '#D97706' },
              { l: 'Email Full Sent', v: o.emailFull || '—', icon: Mail, c: '#64748B' },
              { l: 'Email B/O Sent', v: o.emailBack || '—', icon: Mail, c: '#64748B' },
            ].map((f, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: '#F8FAFB',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ padding: 8, background: `${f.c}15`, borderRadius: 8 }}>
                  <f.icon size={16} color={f.c} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>
                    {f.l}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{f.v}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Remark */}
          {o.remark && (
            <div style={{ padding: 16, background: '#FEF3C7', borderRadius: 10, marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>REMARK</div>
              <div style={{ fontSize: 13, color: '#78350F' }}>{o.remark}</div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid #E8ECF0' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg,#006837,#00A550)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FileText size={16} /> Print
            </button>
            <button
              onClick={() => window.close()}
              style={{
                padding: '12px 24px',
                background: '#E2E8F0',
                color: '#64748B',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#94A3B8' }}>
          Miltenyi Inventory Hub — Singapore • Generated {new Date().toLocaleString()}
        </div>
      </div>
    );
  }

  // ════════════════════════════ LOADING SCREEN ═══════════════════════
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #003020 0%, #006837 40%, #00A550 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}
      >
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 600 }}>Miltenyi Inventory Hub</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>Loading...</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ════════════════════════════ LOGIN SCREEN ═════════════════════════
  if (!currentUser) {
    // Miltenyi Biotec product data for 3D carousel
    const miltenyiProducts = [
      {
        name: 'MACSQuant Analyzer 16',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_n8v15e6un15d7oqj2utjh91ia5/MACSQuant-Analyzer-16-background-image.png',
        color: '#00A550',
      },
      {
        name: 'gentleMACS Octo Dissociator',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_d8rr4h80cqqjt3r1bnl9e7e2v6/gentleMACS-Octo-Dissociator-with-Heaters.png',
        color: '#006837',
      },
      {
        name: 'CliniMACS Prodigy',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_6lhcj1t1b1kfq1qsb2g4rh3i15/CliniMACS-Prodigy-background-image.png',
        color: '#00C853',
      },
      {
        name: 'MACSQuant Tyto',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_h1s2lq6ed1kbhaqolj2djt5ifs/MACSQuant-Tyto-background-image.png',
        color: '#43A047',
      },
      {
        name: 'MACS MicroBeads',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_b1qfgt49b5odr5l0aemeh6c5cd/CD4-MicroBeads-human.png',
        color: '#2E7D32',
      },
      {
        name: 'MACSima Imaging',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_oijt0l5j7t05bnpvr7ss1c0m5e/MACSima-Imaging-System-background-image.png',
        color: '#1565C0',
      },
      {
        name: 'UltraMicroscope',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_cpii0p39bkitccn4s5qvd17q4c/UltraMicroscope-Blaze-background-image.png',
        color: '#7B1FA2',
      },
      // Inner ring
      {
        name: 'MultiMACS M96',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_fmui4o2ru1b7h0f4ehj7dh1p3d/MultiMACS-M96-background-image.png',
        color: '#1B5E20',
      },
      {
        name: 'MACSQuant X',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_u0p9jfp72t7mu7sfp4cjr1ia6a/MACSQuant-X-background-image.png',
        color: '#388E3C',
      },
      {
        name: 'gentleMACS Dissociator',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_eoei7gq4o9c6d2jj4h1bia6g30/gentleMACS-Dissociator-background-image.png',
        color: '#4CAF50',
      },
      {
        name: 'CliniMACS Plus',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_qjkh16r9b9fn9oqhk2p6l1a74u/CliniMACS-Plus-background-image.png',
        color: '#E65100',
      },
      {
        name: 'autoMACS Neo',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_h7hqt4b9v5qf9e6p7rn8q5m2vd/autoMACS-Neo-background-image.png',
        color: '#00838F',
      },
      {
        name: 'CellCelector',
        img: 'https://static.miltenyibiotec.com/asset/150655405641/document_1b0f5v2pu3h5c9mp3p67qhk4h4/CellCelector-background-image.png',
        color: '#AD1457',
      },
    ];

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans',system-ui,sans-serif",
          overflow: 'hidden',
          position: 'relative',
          animation: 'colorCycleBase 12s ease-in-out infinite',
        }}
      >
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
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="login-particle"
              style={{
                width: 2 + Math.random() * 4,
                height: 2 + Math.random() * 4,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 6}s`,
                opacity: 0.1 + Math.random() * 0.3,
              }}
            />
          ))}
        </div>

        {/* Ambient glow orbs */}
        <div
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            top: '10%',
            left: '5%',
            animation: 'colorCycleGlow1 12s ease-in-out infinite, pulse-glow 6s ease-in-out infinite',
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            bottom: '15%',
            right: '10%',
            animation: 'colorCycleGlow2 12s ease-in-out infinite, pulse-glow 8s ease-in-out infinite 2s',
            zIndex: 1,
          }}
        />

        {/* 3D Product Orbit */}
        <div className="product-orbit-container">
          <div className="product-orbit-ring">
            {miltenyiProducts.slice(0, 7).map((p, i) => (
              <div
                key={i}
                className="product-card-3d"
                style={{
                  animation: `orbit3d 45s linear infinite`,
                  animationDelay: `${i * -(45 / 7)}s`,
                }}
              >
                <div className="product-card-3d-inner">
                  <img
                    src={p.img}
                    alt={p.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="product-label">{p.name}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="product-orbit-ring-2">
            {miltenyiProducts.slice(7).map((p, i) => (
              <div
                key={i}
                className="product-card-3d"
                style={{
                  animation: `orbit3d-reverse 35s linear infinite`,
                  animationDelay: `${i * -(35 / 6)}s`,
                }}
              >
                <div className="product-card-3d-inner">
                  <img
                    src={p.img}
                    alt={p.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="product-label">{p.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Login Card */}
        <div className="login-card-glass">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="login-header-line" />
            <div
              className={customLogo ? '' : 'login-logo-box'}
              style={
                customLogo
                  ? {
                      width: 64,
                      height: 64,
                      borderRadius: 18,
                      background: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                      overflow: 'hidden',
                      border: '2px solid #E8EDF2',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    }
                  : {}
              }
            >
              {customLogo ? (
                <img src={customLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Package size={30} color="#fff" />
              )}
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#0F172A',
                letterSpacing: -0.5,
                fontFamily: "'Sora','DM Sans',sans-serif",
                margin: 0,
              }}
            >
              Miltenyi Singapore Hub
            </h1>
            <p
              style={{
                fontSize: 10,
                color: '#94A3B8',
                marginTop: 6,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              Service Singapore Management
            </p>
          </div>

          {authView === 'login' ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#4A5568',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Username
                </label>
                <input
                  className="login-input"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="Enter username"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#4A5568',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Password
                </label>
                <input
                  className="login-input"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Enter password"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={isSubmitting}
                className="login-btn-primary"
                style={{ opacity: isSubmitting ? 0.6 : 1 }}
              >
                <Lock size={16} /> {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748B' }}>
                Don't have an account?{' '}
                <button onClick={() => setAuthView('register')} className="login-link">
                  Register here
                </button>
              </div>
              <div
                style={{
                  marginTop: 24,
                  padding: 12,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg,#F0FFF4,#F8FAFB)',
                  fontSize: 11,
                  color: '#94A3B8',
                  border: '1px solid #E8F5E9',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 4,
                    color: '#4CAF50',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Getting Started
                </div>
                <div>Contact your administrator for login credentials</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#4A5568',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Full Name *
                </label>
                <input
                  className="login-input"
                  value={regForm.name}
                  onChange={(e) => setRegForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#4A5568',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Email *
                </label>
                <input
                  className="login-input"
                  type="email"
                  value={regForm.email}
                  onChange={(e) => setRegForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@miltenyibiotec.com"
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#4A5568',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Phone
                </label>
                <input
                  className="login-input"
                  value={regForm.phone}
                  onChange={(e) => setRegForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+65 9XXX XXXX"
                />
              </div>
              <div
                className="grid-2"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#4A5568',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Username *
                  </label>
                  <input
                    className="login-input"
                    value={regForm.username}
                    onChange={(e) => setRegForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="Choose username"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#4A5568',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Password *
                  </label>
                  <input
                    className="login-input"
                    type="password"
                    value={regForm.password}
                    onChange={(e) => setRegForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Create password"
                  />
                </div>
              </div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
                  fontSize: 11,
                  color: '#92400E',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid #FDE68A',
                }}
              >
                <AlertTriangle size={13} /> Your account will need admin approval before you can login.
              </div>
              <button onClick={handleRegister} className="login-btn-primary">
                <UserPlus size={16} /> Request Account
              </button>
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#64748B' }}>
                Already have an account?{' '}
                <button onClick={() => setAuthView('login')} className="login-link">
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>
        <Toast items={notifs} onDismiss={(i) => setNotifs((p) => p.filter((_, j) => j !== i))} />
      </div>
    );
  }

  // ════════════════════════════ MODULE PICKER ══════════════════════
  if (!activeModule) {
    const moduleCards = [
      {
        key: 'inventory',
        label: 'Inventory',
        desc: 'Manage orders, parts and stock levels',
        icon: Package,
        defaultPage: 'dashboard',
        gradient: 'linear-gradient(135deg, #006837, #00A550)',
        glow: 'rgba(11,122,62,',
        accent: '#4ade80',
        features: [
          { icon: ShoppingCart, text: 'Orders & Approvals' },
          { icon: Database, text: 'Parts Catalog' },
          { icon: ClipboardList, text: 'Stock Check' },
          { icon: BarChart3, text: 'Analytics & Forecasting' },
          { icon: Truck, text: 'Part Arrival Tracking' },
        ],
      },
      {
        key: 'service',
        label: 'Service',
        desc: 'Track machines, maintenance & contracts',
        icon: Wrench,
        defaultPage: 'service',
        gradient: 'linear-gradient(135deg, #4f46e5, #818cf8)',
        glow: 'rgba(99,102,241,',
        accent: '#a5b4fc',
        features: [
          { icon: HardDrive, text: 'Machine Registry' },
          { icon: Activity, text: 'Maintenance Schedules' },
          { icon: FileBarChart, text: 'Contract Management' },
          { icon: Search, text: 'Serial Number Lookup' },
        ],
      },
    ];

    return (
      <div
        style={{
          fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
          minHeight: '100vh',
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: '#f1f5f9',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <style>{`
          @keyframes mpFadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
          @keyframes mpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
          @keyframes mpGlow{0%,100%{opacity:.3}50%{opacity:.6}}
          .mp-card{position:relative;width:320px;padding:32px 28px 28px;border-radius:20px;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1);text-align:left;overflow:hidden;backdrop-filter:blur(12px)}
          .mp-card:hover{transform:translateY(-8px) scale(1.02)}
          .mp-card::before{content:'';position:absolute;inset:0;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(255,255,255,.15),rgba(255,255,255,.03));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
          .mp-feat{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;color:#94a3b8;transition:color .2s}
          .mp-card:hover .mp-feat{color:#cbd5e1}
          .mp-enter{display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:8px 18px;border-radius:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:inherit}
          .mp-enter:hover{transform:translateX(4px)}
          @media(max-width:700px){.mp-cards{flex-direction:column!important}.mp-card{width:100%!important;max-width:360px}}
        `}</style>

        {/* Background glow orbs */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '15%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(11,122,62,.08) 0%, transparent 70%)',
            animation: 'mpGlow 4s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '15%',
            right: '15%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,.08) 0%, transparent 70%)',
            animation: 'mpGlow 4s ease-in-out infinite 2s',
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 48,
            animation: 'mpFadeUp .6s ease-out',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #006837, #00A550)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 8px 32px rgba(11,122,62,.25)',
            }}
          >
            {customLogo ? (
              <img
                src={customLogo}
                alt="Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 16 }}
              />
            ) : (
              <Package size={28} color="#fff" />
            )}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Miltenyi Hub</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>
            Welcome back, <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{currentUser?.name || 'User'}</span>
          </p>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Select a module to get started</p>
        </div>

        {/* Module cards */}
        <div
          className="mp-cards"
          style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {moduleCards.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.key}
                className="mp-card"
                onClick={() => {
                  setActiveModule(mod.key);
                  setPage(mod.defaultPage);
                }}
                style={{
                  background: `linear-gradient(135deg, ${mod.glow}0.1), ${mod.glow}0.04))`,
                  animation: `mpFadeUp .6s ease-out ${0.15 + idx * 0.12}s both`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 20px 60px ${mod.glow}0.2), 0 0 0 1px ${mod.glow}0.2)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: mod.gradient,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    boxShadow: `0 8px 24px ${mod.glow}0.3)`,
                  }}
                >
                  <Icon size={26} color="#fff" />
                </div>

                {/* Title & desc */}
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: mod.accent }}>{mod.label}</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.4 }}>{mod.desc}</p>

                {/* Feature list */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12 }}>
                  {mod.features.map((f, fi) => {
                    const FIcon = f.icon;
                    return (
                      <div key={fi} className="mp-feat">
                        <FIcon size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                        <span>{f.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Enter button */}
                <button className="mp-enter" style={{ background: mod.gradient, color: '#fff' }} tabIndex={-1}>
                  Open {mod.label} <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 48,
            animation: 'mpFadeUp .6s ease-out .4s both',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 12, color: '#334155' }}>
            Signed in as {currentUser?.role === 'admin' ? 'Admin' : 'User'}
          </span>
          <span style={{ color: '#1e293b' }}>|</span>
          <button
            onClick={() => {
              setCurrentUser(null);
              setActiveModule(null);
              localStorage.removeItem('mih_token');
              localStorage.removeItem('mih_currentUser');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'inherit',
              padding: 0,
              transition: 'color .2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
        <Toast items={notifs} onDismiss={(i) => setNotifs((p) => p.filter((_, j) => j !== i))} />
      </div>
    );
  }

  // ════════════════════════════ MAIN APP RENDER ══════════════════════
  return (
    <div
      className={activeModule === 'service' ? 'svc' : ''}
      style={{
        fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
        background: '#F4F6F8',
        minHeight: '100vh',
        display: 'flex',
        color: '#1A202C',
      }}
    >
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
        .svc .ni:hover{background:rgba(99,102,241,.06);color:#6366f1} .svc .ni.a{background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(129,140,248,.08));color:#6366f1}
        .svc .bp{background:linear-gradient(135deg,#4f46e5,#6366f1 50%,#818cf8)} .svc .bp:hover{box-shadow:0 4px 12px rgba(99,102,241,.3)}
        .mo{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}
        .th{padding:12px 14px;text-align:left;font-weight:600;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #E8ECF0;white-space:nowrap}
        .td{padding:10px 14px} .mono{font-family:'JetBrains Mono',monospace}
        .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .sc{position:relative;overflow:hidden;border-radius:14px;padding:20px 22px;color:#fff}
        .sc::after{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.1)}
      `}</style>

      <Toast items={notifs} onDismiss={(i) => setNotifs((p) => p.filter((_, j) => j !== i))} />

      {/* MOBILE SIDEBAR OVERLAY */}
      <div className={`sidebar-overlay${sidebarOpen ? '' : ' hidden'}`} onClick={() => setSidebarOpen(false)} />

      {/* SIDEBAR */}
      <aside
        className={`app-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          width: sidebarOpen ? 250 : 68,
          background: '#fff',
          borderRight: '1px solid #E8ECF0',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width .25s',
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            padding: sidebarOpen ? '20px 18px 16px' : '20px 12px 16px',
            borderBottom: '1px solid #F0F2F5',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: customLogo
                ? '#fff'
                : activeModule === 'service'
                  ? 'linear-gradient(135deg,#4f46e5,#818cf8)'
                  : 'linear-gradient(135deg,#006837,#00A550)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              transition: 'background .3s',
            }}
          >
            {customLogo ? (
              <img src={customLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : activeModule === 'service' ? (
              <Wrench size={18} color="#fff" />
            ) : (
              <Package size={18} color="#fff" />
            )}
          </div>
          {sidebarOpen && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: activeModule === 'service' ? '#6366f1' : '#006837' }}>
                Miltenyi
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#94A3B8',
                  fontWeight: 500,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {activeModule === 'service' ? 'Service Module' : 'Inventory Hub SG'}
              </div>
            </div>
          )}
          {sidebarOpen && (
            <div
              title="Switch module"
              onClick={() => setActiveModule(null)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: activeModule === 'service' ? 'rgba(99,102,241,.08)' : 'rgba(11,122,62,.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  activeModule === 'service' ? 'rgba(99,102,241,.15)' : 'rgba(11,122,62,.12)';
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  activeModule === 'service' ? 'rgba(99,102,241,.08)' : 'rgba(11,122,62,.06)';
                e.currentTarget.style.transform = '';
              }}
            >
              <LayoutGrid size={14} color={activeModule === 'service' ? '#6366f1' : '#0B7A3E'} />
            </div>
          )}
        </div>
        <nav style={{ padding: '12px 10px', flex: 1, overflowY: 'auto' }}>
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`ni ${page === item.id ? 'a' : ''}`}
              onClick={() => {
                setPage(item.id);
                setCatalogPage(0);
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}
              title={item.label}
            >
              <item.icon size={18} />
              {sidebarOpen && <span>{item.label}</span>}
              {item.id === 'catalog' && sidebarOpen && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    background: '#E6F4ED',
                    color: '#0B7A3E',
                    padding: '2px 6px',
                    borderRadius: 8,
                    fontWeight: 700,
                  }}
                >
                  {partsCatalog.length}
                </span>
              )}
              {item.id === 'whatsapp' && sidebarOpen && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: waConnected ? '#25D366' : '#E2E8F0',
                  }}
                />
              )}
              {item.id === 'users' && sidebarOpen && pendingUsers.length > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    background: '#FEE2E2',
                    color: '#DC2626',
                    padding: '2px 6px',
                    borderRadius: 8,
                    fontWeight: 700,
                  }}
                >
                  {pendingUsers.length}
                </span>
              )}
            </div>
          ))}
        </nav>
        <div style={{ padding: '12px 10px', borderTop: '1px solid #F0F2F5' }}>
          <div className="ni" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={18} />
            {sidebarOpen && <span style={{ fontSize: 12 }}>Collapse</span>}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: 'auto', maxHeight: '100vh' }}>
        <header
          className="app-header"
          style={{
            background: '#fff',
            borderBottom: '1px solid #E8ECF0',
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Menu size={22} color="#0F172A" />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: -0.5 }}>
                {navItems.find((n) => n.id === page)?.label || 'Dashboard'}
              </h1>
              <p className="header-subtitle" style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                Logged in as <strong style={{ color: '#0B7A3E' }}>{currentUser.name}</strong> ({currentUser.role}) •
                Prices {priceConfig.year}
              </p>
            </div>
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
              <input
                className="header-search"
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32, width: 220, height: 36 }}
              />
            </div>
            {isAdmin && (
              <span className="admin-pill">
                <Pill bg="#DBEAFE" color="#2563EB">
                  <Shield size={11} /> Admin
                </Pill>
              </span>
            )}
            <button
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className="bs"
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: aiPanelOpen ? '#E6F4ED' : '#F8FAFB',
                border: aiPanelOpen ? '1.5px solid #0B7A3E' : '1.5px solid #E2E8F0',
              }}
              title="AI Assistant"
            >
              {aiPanelOpen ? <PanelRightClose size={16} color="#0B7A3E" /> : <Bot size={16} />}{' '}
              <span
                className="ai-label"
                style={{ fontSize: 12, fontWeight: 600, color: aiPanelOpen ? '#0B7A3E' : '#64748B' }}
              >
                AI
              </span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#006837,#00A550)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {currentUser.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
              </div>
              <button
                className="bs"
                style={{ padding: '8px 12px', fontSize: 12 }}
                onClick={() => {
                  api.logout();
                  setCurrentUser(null);
                  setActiveModule(null);
                  setLoginForm({ username: '', password: '' });
                }}
              >
                <LogOut size={14} />
                <span className="logout-text">{sidebarOpen ? 'Logout' : ''}</span>
              </button>
            </div>
          </div>
        </header>

        <div className="app-content" style={{ padding: '24px 28px', animation: 'fadeIn .3s' }}>
          {/* ═══════════ DASHBOARD ═══════════ */}
          {page === 'dashboard' && (
            <div>
              <div
                className="grid-5"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}
              >
                {[
                  {
                    l: 'Catalog',
                    v: fmtNum(partsCatalog.length),
                    i: Database,
                    bg: 'linear-gradient(135deg,#4338CA,#6366F1)',
                  },
                  { l: 'Total Orders', v: stats.total, i: Package, bg: 'linear-gradient(135deg,#006837,#0B9A4E)' },
                  { l: 'Spend', v: fmt(stats.totalCost), i: DollarSign, bg: 'linear-gradient(135deg,#1E40AF,#3B82F6)' },
                  {
                    l: 'Fulfillment',
                    v: `${stats.fulfillmentRate}%`,
                    i: TrendingUp,
                    bg: 'linear-gradient(135deg,#047857,#10B981)',
                  },
                  {
                    l: 'Back Orders',
                    v: stats.backOrder,
                    i: AlertTriangle,
                    bg: 'linear-gradient(135deg,#B91C1C,#EF4444)',
                  },
                ].map((s, i) => (
                  <div key={i} className="sc" style={{ background: s.bg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            opacity: 0.85,
                            marginBottom: 6,
                            textTransform: 'uppercase',
                            letterSpacing: 0.8,
                          }}
                        >
                          {s.l}
                        </div>
                        <div className="mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: -1 }}>
                          {s.v}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: 8 }}>
                        <s.i size={18} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="grid-2"
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}
              >
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>Monthly Trends</h3>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>
                      {monthlyData.length > 0
                        ? `${monthlyData[0].name} — ${monthlyData[monthlyData.length - 1].name}`
                        : ''}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0B7A3E" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#0B7A3E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
                      <Area
                        type="monotone"
                        dataKey="received"
                        stroke="#0B7A3E"
                        fillOpacity={1}
                        fill="url(#g1)"
                        name="Received"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="backOrder"
                        stroke="#DC2626"
                        fillOpacity={1}
                        fill="url(#g2)"
                        name="Back Order"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Status</h3>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {statusPieData.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 8 }}>
                    {statusPieData.map((s, i) => (
                      <div
                        key={i}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                        {s.name} ({s.value})
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Top Items by Cost</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topItems} layout="vertical" margin={{ left: 140 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#4A5568' }}
                        axisLine={false}
                        tickLine={false}
                        width={135}
                      />
                      <Tooltip
                        formatter={(v) => fmt(v)}
                        contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }}
                      />
                      <Bar dataKey="cost" fill="#0B7A3E" radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
                    Avg Price: Unit Price vs Distributor
                  </h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={catPriceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(v) => fmt(v)}
                        contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }}
                      />
                      <Bar dataKey="sg" name="Unit Price" fill="#0B7A3E" radius={[4, 4, 0, 0]} barSize={14} />
                      <Bar dataKey="dist" name="Distributor" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={14} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ CATALOG ═══════════ */}
          {page === 'catalog' && (
            <div>
              <div
                className="grid-4"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}
              >
                {[
                  { l: 'Total Parts', v: fmtNum(catalogStats.total), i: Database, c: '#4338CA' },
                  { l: 'Avg Unit Price', v: fmt(catalogStats.avgSg), i: DollarSign, c: '#0B7A3E' },
                  { l: 'Avg Dist', v: fmt(catalogStats.avgDist), i: Tag, c: '#2563EB' },
                  { l: 'Categories', v: Object.keys(catalogStats.catCounts).length, i: Archive, c: '#D97706' },
                ].map((s, i) => (
                  <div key={i} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#94A3B8',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          {s.l}
                        </div>
                        <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: s.c }}>
                          {s.v}
                        </div>
                      </div>
                      <div style={{ padding: 10, background: `${s.c}10`, borderRadius: 10 }}>
                        <s.i size={18} color={s.c} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
                  <input
                    placeholder="Search material no. or description..."
                    value={catalogSearch}
                    onChange={(e) => {
                      setCatalogSearch(e.target.value);
                      setCatalogPage(0);
                    }}
                    style={{ paddingLeft: 32, width: '100%', height: 36 }}
                  />
                </div>
                <select
                  value={catFilter}
                  onChange={(e) => {
                    setCatFilter(e.target.value);
                    setCatalogPage(0);
                  }}
                  style={{ height: 36 }}
                >
                  <option value="All">All Categories</option>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label} ({catalogStats.catCounts[k] || 0})
                    </option>
                  ))}
                </select>
                <button
                  className="bp"
                  style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    setShowPriceFinder(true);
                    setPriceFinderInput('');
                    setPriceFinderResults([]);
                  }}
                >
                  <Search size={14} /> Price Finder
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>{catalog.length} parts</span>
                  <select
                    value={catalogPageSize}
                    onChange={(e) => {
                      setCatalogPageSize(Number(e.target.value));
                      setCatalogPage(0);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      color: '#1A202C',
                    }}
                  >
                    {[20, 50, 100, 200].map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFB' }}>
                        <th className="th" style={{ width: 120 }}>
                          Material No.
                        </th>
                        <th className="th">Description</th>
                        <th className="th" style={{ width: 120 }}>
                          Category
                        </th>
                        {[
                          { k: 'tp', l: 'Transfer' },
                          { k: 'sg', l: 'Unit Price' },
                          { k: 'dist', l: 'Dist Price' },
                        ].map((h) => (
                          <th
                            key={h.k}
                            className="th"
                            style={{ width: 110, textAlign: 'right', cursor: 'pointer' }}
                            onClick={() =>
                              setCatalogSort((s) => ({
                                key: h.k,
                                dir: s.key === h.k && s.dir === 'desc' ? 'asc' : 'desc',
                              }))
                            }
                          >
                            {h.l} {catalogSort.key === h.k ? (catalogSort.dir === 'desc' ? '↓' : '↑') : ''}
                          </th>
                        ))}
                        <th className="th" style={{ width: 70, textAlign: 'right' }}>
                          Margin
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalog.slice(catalogPage * catalogPageSize, (catalogPage + 1) * catalogPageSize).map((p, i) => {
                        const margin =
                          p.singaporePrice > 0
                            ? (((p.singaporePrice - p.distributorPrice) / p.singaporePrice) * 100).toFixed(1)
                            : 0;
                        const cc = CATEGORIES[p.category];
                        return (
                          <tr
                            key={p.materialNo + i}
                            className="tr"
                            style={{ borderBottom: '1px solid #F7FAFC', background: i % 2 === 0 ? '#fff' : '#FCFCFD' }}
                            onClick={() => setSelectedPart(p)}
                          >
                            <td className="td mono" style={{ fontSize: 11, color: '#0B7A3E', fontWeight: 500 }}>
                              {p.materialNo}
                            </td>
                            <td
                              className="td"
                              style={{
                                maxWidth: 260,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.description}
                            </td>
                            <td className="td">
                              <Pill bg={`${cc?.color || '#64748B'}12`} color={cc?.color || '#64748B'}>
                                {cc?.short || '—'}
                              </Pill>
                            </td>
                            <td className="td mono" style={{ textAlign: 'right', fontSize: 11 }}>
                              {p.transferPrice > 0 ? fmt(p.transferPrice) : '—'}
                            </td>
                            <td className="td mono" style={{ textAlign: 'right', fontSize: 11, fontWeight: 600 }}>
                              {p.singaporePrice > 0 ? fmt(p.singaporePrice) : '—'}
                            </td>
                            <td className="td mono" style={{ textAlign: 'right', fontSize: 11 }}>
                              {p.distributorPrice > 0 ? fmt(p.distributorPrice) : '—'}
                            </td>
                            <td
                              className="td mono"
                              style={{
                                textAlign: 'right',
                                fontSize: 11,
                                color: margin > 30 ? '#0B7A3E' : margin > 15 ? '#D97706' : '#DC2626',
                              }}
                            >
                              {margin}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #F0F2F5',
                    display: 'flex',
                    justifyContent: 'space-between',
                    background: '#FCFCFD',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    Showing {Math.min(catalogPage * catalogPageSize + 1, catalog.length)}–
                    {Math.min((catalogPage + 1) * catalogPageSize, catalog.length)} of {catalog.length}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="bs"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      disabled={catalogPage === 0}
                      onClick={() => setCatalogPage((p) => p - 1)}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      Page {catalogPage + 1}/{Math.max(1, Math.ceil(catalog.length / catalogPageSize))}
                    </span>
                    <button
                      className="bs"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      disabled={(catalogPage + 1) * catalogPageSize >= catalog.length}
                      onClick={() => setCatalogPage((p) => p + 1)}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SERVICE MODULE */}
          {page === 'service' && (
            <ServicePage isAdmin={isAdmin} notify={notify} machines={machines} setMachines={setMachines} />
          )}

          {/* LOCAL INVENTORY */}
          {page === 'localinventory' && (
            <LocalInventoryPage isAdmin={isAdmin} currentUser={currentUser} notify={notify} />
          )}

          {/* ALL ORDERS */}
          {page === 'allorders' && (
            <AllOrdersPage
              {...{
                orders,
                bulkGroups,
                catalogLookup,
                currentUser,
                allOrdersCombined,
                allOrdersSort,
                setAllOrdersSort,
                allOrdersTypeFilter,
                setAllOrdersTypeFilter,
                allOrdersMonth,
                setAllOrdersMonth,
                allOrdersMonths,
                allOrdersStatus,
                setAllOrdersStatus,
                allOrdersUserFilter,
                setAllOrdersUserFilter,
                allOrdersUsers,
                expandedAllMonth,
                setExpandedAllMonth,
                expandedAllBulkGroup,
                setExpandedAllBulkGroup,
                openOrderInNewTab,
                allOrdersPage,
                setAllOrdersPage,
                allOrdersPageSize,
                setAllOrdersPageSize,
              }}
            />
          )}

          {/* ═══════════ SINGLE ORDERS ═══════════ */}
          {page === 'orders' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {['All', 'Pending Approval', 'Approved', 'Received', 'Rejected'].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setSingleOrderPage(0);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: statusFilter === s ? 'none' : '1px solid #E2E8F0',
                        background: statusFilter === s ? '#0B7A3E' : '#fff',
                        color: statusFilter === s ? '#fff' : '#64748B',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {s} (
                      {s === 'All'
                        ? orders.filter((o) => !o.bulkGroupId).length
                        : orders.filter((o) => !o.bulkGroupId && o.status === s).length}
                      )
                    </button>
                  ))}
                  <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
                  <select
                    value={singleOrderMonth}
                    onChange={(e) => {
                      setSingleOrderMonth(e.target.value);
                      setSingleOrderPage(0);
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      color: '#1A202C',
                    }}
                  >
                    <option value="All">All Months</option>
                    {singleOrderMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={orderByFilter}
                    onChange={(e) => {
                      setOrderByFilter(e.target.value);
                      setSingleOrderPage(0);
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      color: '#1A202C',
                    }}
                  >
                    <option value="All">All Users</option>
                    {currentUser?.name && (
                      <option value={currentUser.name}>
                        My Orders ({orders.filter((o) => !o.bulkGroupId && o.orderBy === currentUser.name).length})
                      </option>
                    )}
                    {orderByUsers
                      .filter((u) => u !== currentUser?.name)
                      .map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={singleOrderPageSize}
                    onChange={(e) => {
                      setSingleOrderPageSize(Number(e.target.value));
                      setSingleOrderPage(0);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      color: '#1A202C',
                    }}
                  >
                    {[20, 50, 100, 200].map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                  <ExportDropdown
                    data={filteredOrders}
                    columns={[
                      { key: 'id', label: 'Order ID' },
                      { key: 'materialNo', label: 'Material No' },
                      { key: 'description', label: 'Description' },
                      { key: 'quantity', label: 'Qty' },
                      { key: 'listPrice', label: 'List Price', fmt: (v) => (v > 0 ? fmt(v) : '') },
                      { key: 'totalCost', label: 'Total Cost', fmt: (v) => (v > 0 ? fmt(v) : '') },
                      { key: 'orderDate', label: 'Order Date', fmt: (v) => fmtDate(v) },
                      { key: 'orderBy', label: 'Ordered By' },
                      { key: 'engineer', label: 'Engineer' },
                      { key: 'status', label: 'Status' },
                    ]}
                    filename="single-orders"
                    title="Single Orders Export"
                  />
                  <button className="bp" onClick={() => setShowNewOrder(true)}>
                    <Plus size={14} /> New Order
                  </button>
                </div>
              </div>
              {hasPermission('deleteOrders') && (
                <BatchBar count={selOrders.size} onClear={() => setSelOrders(new Set())}>
                  <BatchBtn onClick={batchApprovalNotifyOrders} bg="#7C3AED" icon={Send}>
                    Order Approval & Notify {emailConfig.approvalAutoEmail !== false && '📧'}
                    {emailConfig.approvalAutoWhatsApp !== false && waConnected && '💬'}
                  </BatchBtn>
                  <BatchBtn onClick={() => batchStatusOrders('Pending Approval')} bg="#D97706" icon={Clock}>
                    Pending Approval
                  </BatchBtn>
                  <BatchBtn onClick={() => batchStatusOrders('Approved')} bg="#059669" icon={Check}>
                    Approved
                  </BatchBtn>
                  <BatchBtn onClick={() => batchStatusOrders('Rejected')} bg="#991B1B" icon={X}>
                    Rejected
                  </BatchBtn>
                  <BatchBtn onClick={batchDeleteOrders} bg="#DC2626" icon={Trash2}>
                    Delete
                  </BatchBtn>
                </BatchBar>
              )}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFB' }}>
                        {hasPermission('deleteOrders') && (
                          <th className="th" style={{ width: 36 }}>
                            {(() => {
                              const sorted = applySortData(filteredOrders, orderSort);
                              const pageItems = sorted.slice(
                                singleOrderPage * singleOrderPageSize,
                                (singleOrderPage + 1) * singleOrderPageSize,
                              );
                              return (
                                <SelBox
                                  checked={pageItems.length > 0 && pageItems.every((o) => selOrders.has(o.id))}
                                  onChange={() =>
                                    toggleAll(
                                      selOrders,
                                      setSelOrders,
                                      pageItems.map((o) => o.id),
                                    )
                                  }
                                />
                              );
                            })()}
                          </th>
                        )}
                        {[
                          { l: 'Material No.', k: 'materialNo' },
                          { l: 'Description', k: 'description' },
                          { l: 'Qty', k: 'quantity' },
                          { l: 'Unit Price', k: 'listPrice' },
                          { l: 'Total', k: 'totalCost' },
                          { l: 'Ordered', k: 'orderDate' },
                          { l: 'By', k: 'orderBy' },
                          { l: 'Status', k: 'status' },
                          { l: 'Arrival', k: 'arrivalDate' },
                        ].map((h) => (
                          <SortTh
                            key={h.k}
                            label={h.l}
                            sortKey={h.k}
                            sortCfg={orderSort}
                            onSort={(k) => toggleSort(setOrderSort, k)}
                          />
                        ))}
                        <th className="th">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applySortData(filteredOrders, orderSort)
                        .slice(singleOrderPage * singleOrderPageSize, (singleOrderPage + 1) * singleOrderPageSize)
                        .map((o, i) => (
                          <tr
                            key={o.id}
                            className="tr"
                            style={{
                              borderBottom: '1px solid #F7FAFC',
                              background: selOrders.has(o.id) ? '#E6F4ED' : i % 2 === 0 ? '#fff' : '#FCFCFD',
                              cursor: 'pointer',
                            }}
                            onClick={() => openOrderInNewTab(o)}
                          >
                            {hasPermission('deleteOrders') && (
                              <td className="td" onClick={(e) => e.stopPropagation()}>
                                <SelBox
                                  checked={selOrders.has(o.id)}
                                  onChange={() => toggleSel(selOrders, setSelOrders, o.id)}
                                />
                              </td>
                            )}
                            <td className="td mono" style={{ fontSize: 11, color: '#0B7A3E', fontWeight: 500 }}>
                              {o.materialNo || '—'}
                            </td>
                            <td
                              className="td"
                              style={{
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {o.description}
                            </td>
                            <td className="td" style={{ fontWeight: 600, textAlign: 'center' }}>
                              {o.quantity}
                            </td>
                            <td className="td mono" style={{ fontSize: 11 }}>
                              {(() => {
                                const cp = catalogLookup[o.materialNo];
                                const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                                return price > 0 ? fmt(price) : '—';
                              })()}
                            </td>
                            <td className="td mono" style={{ fontSize: 11, fontWeight: 600 }}>
                              {(() => {
                                const cp = catalogLookup[o.materialNo];
                                const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                                const total = price > 0 ? price * o.quantity : o.totalCost;
                                return total > 0 ? fmt(total) : '—';
                              })()}
                            </td>
                            <td className="td" style={{ color: '#94A3B8', fontSize: 11 }}>
                              {fmtDate(o.orderDate)}
                            </td>
                            <td className="td" style={{ fontSize: 11 }}>
                              {o.orderBy || '—'}
                            </td>
                            <td className="td">
                              <Badge status={o.status} />
                            </td>
                            <td className="td">
                              <ArrivalBadge order={o} />
                            </td>
                            <td className="td">
                              <div style={{ display: 'flex', gap: 4 }}>
                                {(hasPermission('editAllOrders') || o.orderBy === currentUser?.name) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingOrder({ ...o });
                                    }}
                                    style={{
                                      background: '#2563EB',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '4px 8px',
                                      fontSize: 10,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    <Edit3 size={11} /> Edit
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateOrder(o);
                                  }}
                                  style={{
                                    background: '#7C3AED',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '4px 8px',
                                    fontSize: 10,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <Copy size={11} />
                                </button>
                                {hasPermission('deleteOrders') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`Delete order ${o.id}?`)) {
                                        const remaining = orders.filter((x) => x.id !== o.id);
                                        setOrders(remaining);
                                        dbSync(api.deleteOrder(o.id), 'Order delete not saved');
                                        if (o.bulkGroupId) recalcBulkGroupForMonths([o.bulkGroupId], remaining);
                                        notify('Deleted', o.id, 'success');
                                      }
                                    }}
                                    style={{
                                      background: '#DC2626',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '4px 8px',
                                      fontSize: 10,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #F0F2F5',
                    display: 'flex',
                    justifyContent: 'space-between',
                    background: '#FCFCFD',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    Showing {Math.min(singleOrderPage * singleOrderPageSize + 1, filteredOrders.length)}–
                    {Math.min((singleOrderPage + 1) * singleOrderPageSize, filteredOrders.length)} of{' '}
                    {filteredOrders.length}
                    {selOrders.size > 0 && ` • ${selOrders.size} selected`}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      {fmt(filteredOrders.reduce((s, o) => s + o.totalCost, 0))}
                    </span>
                    <div style={{ width: 1, height: 16, background: '#E2E8F0' }} />
                    <button
                      className="bs"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      disabled={singleOrderPage === 0}
                      onClick={() => setSingleOrderPage((p) => p - 1)}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      Page {singleOrderPage + 1}/{Math.max(1, Math.ceil(filteredOrders.length / singleOrderPageSize))}
                    </span>
                    <button
                      className="bs"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      disabled={(singleOrderPage + 1) * singleOrderPageSize >= filteredOrders.length}
                      onClick={() => setSingleOrderPage((p) => p + 1)}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ BULK ORDERS ═══════════ */}
          {page === 'bulkorders' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#64748B' }}>
                  Create and manage monthly grouped bulk orders for easier tracking
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ExportDropdown
                    data={bulkGroups}
                    columns={[
                      { key: 'id', label: 'Batch ID' },
                      { key: 'month', label: 'Month' },
                      { key: 'createdBy', label: 'Created By' },
                      { key: 'items', label: 'Items' },
                      { key: 'totalCost', label: 'Total Cost', fmt: (v) => (v > 0 ? fmt(v) : '') },
                      { key: 'status', label: 'Status' },
                      { key: 'date', label: 'Date', fmt: (v) => fmtDate(v) },
                    ]}
                    filename="bulk-orders"
                    title="Bulk Orders Export"
                  />
                  <button className="bp" onClick={() => setShowBulkOrder(true)}>
                    <FolderPlus size={14} /> Create Bulk Order
                  </button>
                </div>
              </div>
              <div
                className="grid-3"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}
              >
                {[
                  { l: 'Total Batches', v: bulkGroups.length, i: Layers, c: '#4338CA' },
                  { l: 'Total Items', v: bulkGroups.reduce((s, g) => s + g.items, 0), i: Package, c: '#0B7A3E' },
                  {
                    l: 'Total Value',
                    v: fmt(bulkGroups.reduce((s, g) => s + g.totalCost, 0)),
                    i: DollarSign,
                    c: '#2563EB',
                  },
                ].map((s, i) => (
                  <div key={i} className="card" style={{ padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#94A3B8',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          {s.l}
                        </div>
                        <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: s.c }}>
                          {s.v}
                        </div>
                      </div>
                      <div style={{ padding: 10, background: `${s.c}10`, borderRadius: 10 }}>
                        <s.i size={20} color={s.c} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {hasPermission('deleteBulkOrders') && (
                <BatchBar count={selBulk.size} onClear={() => setSelBulk(new Set())}>
                  <BatchBtn onClick={batchApprovalNotifyBulk} bg="#7C3AED" icon={Send}>
                    Order Approval & Notify {emailConfig.approvalAutoEmail !== false && '📧'}
                    {emailConfig.approvalAutoWhatsApp !== false && waConnected && '💬'}
                  </BatchBtn>
                  <BatchBtn onClick={() => batchStatusBulk('Pending Approval')} bg="#D97706" icon={Clock}>
                    Pending Approval
                  </BatchBtn>
                  <BatchBtn onClick={() => batchStatusBulk('Approved')} bg="#059669" icon={Check}>
                    Approved
                  </BatchBtn>
                  <BatchBtn onClick={() => batchStatusBulk('Rejected')} bg="#991B1B" icon={X}>
                    Rejected
                  </BatchBtn>
                  <BatchBtn onClick={batchDeleteBulk} bg="#DC2626" icon={Trash2}>
                    Delete
                  </BatchBtn>
                </BatchBar>
              )}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #E8ECF0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Monthly Bulk Order Batches</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      value={bulkMonthFilter}
                      onChange={(e) => {
                        setBulkMonthFilter(e.target.value);
                        setBulkOrderPage(0);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        color: '#1A202C',
                      }}
                    >
                      <option value="All">All Months</option>
                      {bulkMonths.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={bulkCreatedByFilter}
                      onChange={(e) => {
                        setBulkCreatedByFilter(e.target.value);
                        setBulkOrderPage(0);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        color: '#1A202C',
                      }}
                    >
                      <option value="All">All Users</option>
                      {currentUser?.name && (
                        <option value={currentUser.name}>
                          My Batches ({bulkGroups.filter((g) => g.createdBy === currentUser.name).length})
                        </option>
                      )}
                      {bulkCreatedByUsers
                        .filter((u) => u !== currentUser?.name)
                        .map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                    </select>
                    <select
                      value={bulkOrderPageSize}
                      onChange={(e) => {
                        setBulkOrderPageSize(Number(e.target.value));
                        setBulkOrderPage(0);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #E2E8F0',
                        fontSize: 11,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        color: '#1A202C',
                      }}
                    >
                      {[20, 50, 100, 200].map((n) => (
                        <option key={n} value={n}>
                          {n} / page
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB' }}>
                      {hasPermission('deleteBulkOrders') && (
                        <th className="th" style={{ width: 36 }}>
                          {(() => {
                            const filtered = bulkGroups.filter(
                              (g) =>
                                (bulkMonthFilter === 'All' || g.month === bulkMonthFilter) &&
                                (bulkCreatedByFilter === 'All' || g.createdBy === bulkCreatedByFilter),
                            );
                            const sorted = applySortData(filtered, bulkSort);
                            const pageItems = sorted.slice(
                              bulkOrderPage * bulkOrderPageSize,
                              (bulkOrderPage + 1) * bulkOrderPageSize,
                            );
                            return (
                              <SelBox
                                checked={pageItems.length > 0 && pageItems.every((g) => selBulk.has(g.id))}
                                onChange={() =>
                                  toggleAll(
                                    selBulk,
                                    setSelBulk,
                                    pageItems.map((g) => g.id),
                                  )
                                }
                              />
                            );
                          })()}
                        </th>
                      )}
                      {[
                        { l: 'Batch ID', k: 'id' },
                        { l: 'Month', k: 'month' },
                        { l: 'Created By', k: 'createdBy' },
                        { l: 'Items', k: 'items' },
                        { l: 'Total Cost', k: 'totalCost' },
                        { l: 'Status', k: 'status' },
                        { l: 'Date', k: 'date' },
                      ].map((h) => (
                        <SortTh
                          key={h.k}
                          label={h.l}
                          sortKey={h.k}
                          sortCfg={bulkSort}
                          onSort={(k) => toggleSort(setBulkSort, k)}
                        />
                      ))}
                      <th className="th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = bulkGroups.filter(
                        (g) =>
                          (bulkMonthFilter === 'All' || g.month === bulkMonthFilter) &&
                          (bulkCreatedByFilter === 'All' || g.createdBy === bulkCreatedByFilter),
                      );
                      return applySortData(filtered, bulkSort).slice(
                        bulkOrderPage * bulkOrderPageSize,
                        (bulkOrderPage + 1) * bulkOrderPageSize,
                      );
                    })().map((g) => (
                      <tr
                        key={g.id}
                        className="tr"
                        style={{
                          borderBottom: '1px solid #F7FAFC',
                          background: selBulk.has(g.id) ? '#EDE9FE' : '#fff',
                        }}
                      >
                        {hasPermission('deleteBulkOrders') && (
                          <td className="td">
                            <SelBox checked={selBulk.has(g.id)} onChange={() => toggleSel(selBulk, setSelBulk, g.id)} />
                          </td>
                        )}
                        <td className="td mono" style={{ fontSize: 11, fontWeight: 600, color: '#4338CA' }}>
                          {g.id}
                        </td>
                        <td className="td" style={{ fontWeight: 600 }}>
                          <Pill bg="#E6F4ED" color="#0B7A3E">
                            <Calendar size={11} /> {g.month}
                          </Pill>
                        </td>
                        <td className="td">{g.createdBy}</td>
                        <td className="td" style={{ fontWeight: 600, textAlign: 'center' }}>
                          {g.items}
                        </td>
                        <td className="td mono" style={{ fontWeight: 600, fontSize: 11 }}>
                          {fmt(g.totalCost)}
                        </td>
                        <td className="td">
                          <Pill
                            bg={
                              g.status === 'Completed'
                                ? '#E6F4ED'
                                : g.status === 'Approved'
                                  ? '#D1FAE5'
                                  : g.status === 'Rejected'
                                    ? '#FEE2E2'
                                    : '#FEF3C7'
                            }
                            color={
                              g.status === 'Completed'
                                ? '#0B7A3E'
                                : g.status === 'Approved'
                                  ? '#059669'
                                  : g.status === 'Rejected'
                                    ? '#DC2626'
                                    : '#D97706'
                            }
                          >
                            {g.status}
                          </Pill>
                        </td>
                        <td className="td" style={{ color: '#94A3B8', fontSize: 11 }}>
                          {fmtDate(g.date)}
                        </td>
                        <td className="td">
                          <div style={{ display: 'flex', gap: 6 }}>
                            {(hasPermission('editAllBulkOrders') || g.createdBy === currentUser?.name) && (
                              <button
                                onClick={() => setSelectedBulkGroup({ ...g })}
                                style={{
                                  background: '#2563EB',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <Edit3 size={11} /> Edit
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedBulkGroup(expandedBulkGroup === g.id ? null : g.id)}
                              style={{
                                background: expandedBulkGroup === g.id ? '#064E3B' : '#0B7A3E',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 10,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <Eye size={11} /> {expandedBulkGroup === g.id ? 'Hide' : 'View'}
                            </button>
                            {hasPermission('deleteBulkOrders') && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete bulk group ${g.id} and its linked orders?`)) {
                                    const orphaned = orders.filter((o) => o.bulkGroupId === g.id);
                                    if (orphaned.length) {
                                      setOrders((prev) => prev.filter((o) => o.bulkGroupId !== g.id));
                                      orphaned.forEach((o) => dbSync(api.deleteOrder(o.id), 'Orphaned order delete'));
                                    }
                                    setBulkGroups((prev) => prev.filter((x) => x.id !== g.id));
                                    dbSync(api.deleteBulkGroup(g.id), 'Bulk group delete not saved');
                                    notify('Deleted', `${g.id} + ${orphaned.length} orders`, 'success');
                                  }
                                }}
                                style={{
                                  background: '#DC2626',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(() => {
                  const filtered = bulkGroups.filter(
                    (g) =>
                      (bulkMonthFilter === 'All' || g.month === bulkMonthFilter) &&
                      (bulkCreatedByFilter === 'All' || g.createdBy === bulkCreatedByFilter),
                  );
                  const totalPages = Math.max(1, Math.ceil(filtered.length / bulkOrderPageSize));
                  return (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderTop: '1px solid #F0F2F5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#FCFCFD',
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>
                        Showing {Math.min(bulkOrderPage * bulkOrderPageSize + 1, filtered.length)}–
                        {Math.min((bulkOrderPage + 1) * bulkOrderPageSize, filtered.length)} of {filtered.length}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="bs"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          disabled={bulkOrderPage === 0}
                          onClick={() => setBulkOrderPage((p) => p - 1)}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: 12, color: '#64748B' }}>
                          Page {bulkOrderPage + 1}/{totalPages}
                        </span>
                        <button
                          className="bs"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          disabled={(bulkOrderPage + 1) * bulkOrderPageSize >= filtered.length}
                          onClick={() => setBulkOrderPage((p) => p + 1)}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* Orders grouped by bulk group */}
              <div className="card" style={{ padding: '20px 24px', marginTop: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
                  Orders by Bulk Group{' '}
                  <span style={{ fontWeight: 400, fontSize: 12, color: '#64748B' }}>(Click to view orders)</span>
                </h3>
                <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[...new Set(orders.filter((o) => o.bulkGroupId).map((o) => o.bulkGroupId))]
                    .slice(0, 16)
                    .map((bgId) => {
                      const bg = bulkGroups.find((g) => g.id === bgId);
                      const mo = orders.filter((o) => o.bulkGroupId === bgId);
                      const createdByUsers = [...new Set(mo.map((o) => o.orderBy).filter(Boolean))];
                      const bgMonth = bg?.month || mo[0]?.month || '—';
                      return (
                        <div
                          key={bgId}
                          onClick={() => setExpandedBulkGroup(expandedBulkGroup === bgId ? null : bgId)}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            background: expandedBulkGroup === bgId ? '#E6F4ED' : '#F8FAFB',
                            border: expandedBulkGroup === bgId ? '2px solid #0B7A3E' : '1px solid #E8ECF0',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: '#4338CA' }}>{bgId}</div>
                          <div
                            style={{
                              fontSize: 11,
                              marginBottom: 8,
                              color: '#0B7A3E',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Calendar size={12} /> {bgMonth}
                          </div>
                          <div
                            className="grid-2"
                            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}
                          >
                            <div>
                              Orders: <strong>{mo.length}</strong>
                            </div>
                            <div>
                              Qty: <strong>{mo.reduce((s, o) => s + o.quantity, 0)}</strong>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                              Cost: <strong className="mono">{fmt(mo.reduce((s, o) => s + o.totalCost, 0))}</strong>
                            </div>
                            {createdByUsers.length > 0 && (
                              <div style={{ gridColumn: 'span 2', marginTop: 4, fontSize: 10, color: '#64748B' }}>
                                By: {createdByUsers.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Expanded Bulk Group Orders View */}
              {expandedBulkGroup &&
                (() => {
                  const bgOrders = orders.filter((o) => o.bulkGroupId === expandedBulkGroup);
                  const bg = bulkGroups.find((g) => g.id === expandedBulkGroup);
                  const bgLabel = `${expandedBulkGroup}${bg?.month ? ' — ' + bg.month : ''}`;
                  return (
                    <div className="card" style={{ padding: '20px 24px', marginTop: 16 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 16,
                        }}
                      >
                        <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Calendar size={16} color="#0B7A3E" /> Orders for: {bgLabel}
                        </h3>
                        <button
                          onClick={() => setExpandedBulkGroup(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <X size={18} color="#64748B" />
                        </button>
                      </div>
                      {hasPermission('deleteOrders') &&
                        (() => {
                          const monthIds = bgOrders.filter((o) => selOrders.has(o.id));
                          return monthIds.length > 0 ? (
                            <BatchBar
                              count={monthIds.length}
                              onClear={() =>
                                setSelOrders((prev) => {
                                  const n = new Set(prev);
                                  bgOrders.forEach((o) => n.delete(o.id));
                                  return n;
                                })
                              }
                            >
                              <BatchBtn onClick={batchApprovalNotifyOrders} bg="#7C3AED" icon={Send}>
                                Order Approval & Notify {emailConfig.approvalAutoEmail !== false && '📧'}
                                {emailConfig.approvalAutoWhatsApp !== false && waConnected && '💬'}
                              </BatchBtn>
                              <BatchBtn onClick={() => batchStatusOrders('Pending Approval')} bg="#D97706" icon={Clock}>
                                Pending Approval
                              </BatchBtn>
                              <BatchBtn onClick={() => batchStatusOrders('Approved')} bg="#059669" icon={Check}>
                                Approved
                              </BatchBtn>
                              <BatchBtn onClick={() => batchStatusOrders('Rejected')} bg="#991B1B" icon={X}>
                                Rejected
                              </BatchBtn>
                              <BatchBtn onClick={batchDeleteOrders} bg="#DC2626" icon={Trash2}>
                                Delete
                              </BatchBtn>
                            </BatchBar>
                          ) : null;
                        })()}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#F8FAFB' }}>
                            {hasPermission('deleteOrders') && (
                              <th className="th" style={{ width: 36 }}>
                                {(() => {
                                  return (
                                    <SelBox
                                      checked={bgOrders.length > 0 && bgOrders.every((o) => selOrders.has(o.id))}
                                      onChange={() => {
                                        const ids = bgOrders.map((o) => o.id);
                                        setSelOrders((prev) => {
                                          const n = new Set(prev);
                                          const allSel = ids.every((id) => prev.has(id));
                                          ids.forEach((id) => (allSel ? n.delete(id) : n.add(id)));
                                          return n;
                                        });
                                      }}
                                    />
                                  );
                                })()}
                              </th>
                            )}
                            {[
                              'Order ID',
                              'Material No',
                              'Description',
                              'Qty',
                              'Unit Price',
                              'Total',
                              'Ordered By',
                              'Order Date',
                              'Status',
                              'Arrival',
                              'Actions',
                            ].map((h) => (
                              <th key={h} className="th">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bgOrders.map((o) => (
                            <tr
                              key={o.id}
                              className="tr"
                              onClick={() => openOrderInNewTab(o)}
                              style={{
                                borderBottom: '1px solid #F7FAFC',
                                cursor: 'pointer',
                                background: selOrders.has(o.id) ? '#E6F4ED' : '#fff',
                              }}
                            >
                              {hasPermission('deleteOrders') && (
                                <td className="td" onClick={(e) => e.stopPropagation()}>
                                  <SelBox
                                    checked={selOrders.has(o.id)}
                                    onChange={() => toggleSel(selOrders, setSelOrders, o.id)}
                                  />
                                </td>
                              )}
                              <td className="td mono" style={{ fontSize: 11, fontWeight: 600, color: '#4338CA' }}>
                                {o.id}
                              </td>
                              <td className="td mono" style={{ fontSize: 10 }}>
                                {o.materialNo || '—'}
                              </td>
                              <td className="td" style={{ fontSize: 11, maxWidth: 200 }}>
                                {o.description}
                              </td>
                              <td className="td" style={{ fontWeight: 600, textAlign: 'center' }}>
                                {o.quantity}
                              </td>
                              <td className="td mono" style={{ fontSize: 11 }}>
                                {(() => {
                                  const cp = catalogLookup[o.materialNo];
                                  const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                                  return price > 0 ? fmt(price) : '—';
                                })()}
                              </td>
                              <td className="td mono" style={{ fontSize: 11, fontWeight: 600 }}>
                                {(() => {
                                  const cp = catalogLookup[o.materialNo];
                                  const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                                  const total = price > 0 ? price * o.quantity : o.totalCost;
                                  return total > 0 ? fmt(total) : '—';
                                })()}
                              </td>
                              <td className="td">
                                <Pill bg="#DBEAFE" color="#2563EB">
                                  <User size={10} /> {o.orderBy || '—'}
                                </Pill>
                              </td>
                              <td className="td" style={{ color: '#64748B', fontSize: 11 }}>
                                {fmtDate(o.orderDate)}
                              </td>
                              <td className="td">
                                <Badge status={o.status} />
                              </td>
                              <td className="td">
                                <ArrivalBadge order={o} />
                              </td>
                              <td className="td">
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {(hasPermission('editAllOrders') || o.orderBy === currentUser?.name) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingOrder({ ...o });
                                      }}
                                      style={{
                                        background: '#2563EB',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '4px 8px',
                                        fontSize: 10,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 3,
                                      }}
                                    >
                                      <Edit3 size={11} /> Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDuplicateOrder(o);
                                    }}
                                    style={{
                                      background: '#7C3AED',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '4px 8px',
                                      fontSize: 10,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    <Copy size={11} />
                                  </button>
                                  {hasPermission('deleteOrders') && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Delete ${o.id}?`)) {
                                          const remaining = orders.filter((x) => x.id !== o.id);
                                          setOrders(remaining);
                                          dbSync(api.deleteOrder(o.id), 'Order delete not saved');
                                          if (o.bulkGroupId) recalcBulkGroupForMonths([o.bulkGroupId], remaining);
                                          notify('Deleted', o.id, 'success');
                                        }
                                      }}
                                      style={{
                                        background: '#DC2626',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '4px 8px',
                                        fontSize: 10,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 12, padding: 12, background: '#F8FAFB', borderRadius: 8, fontSize: 12 }}>
                        <strong>Summary:</strong> {bgOrders.length} orders | Total Qty:{' '}
                        {bgOrders.reduce((s, o) => s + o.quantity, 0)} | Total Cost:{' '}
                        <strong className="mono">
                          {fmt(
                            bgOrders.reduce((s, o) => {
                              const cp = catalogLookup[o.materialNo];
                              const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                              return s + (price > 0 ? price * o.quantity : o.totalCost);
                            }, 0),
                          )}
                        </strong>
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* ═══════════ ANALYTICS ═══════════ */}
          {page === 'analytics' && (
            <div>
              {/* Summary Cards */}
              {(() => {
                const avgOrderVal = stats.total > 0 ? stats.totalCost / stats.total : 0;
                const approvalRate =
                  stats.total > 0 ? (((stats.received + stats.approved) / stats.total) * 100).toFixed(1) : 0;
                const avgLead =
                  leadTimeData.length > 0
                    ? Math.round(leadTimeData.reduce((s, d) => s + d.avgDays, 0) / leadTimeData.length)
                    : null;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
                    {[
                      {
                        l: 'Total Orders',
                        v: fmtNum(stats.total),
                        sub: `${stats.received} received`,
                        bg: 'linear-gradient(135deg,#006837,#0B9A4E)',
                        i: Package,
                      },
                      {
                        l: 'Total Spend',
                        v: fmt(stats.totalCost),
                        sub: `Avg ${fmt(avgOrderVal)}/order`,
                        bg: 'linear-gradient(135deg,#1E40AF,#3B82F6)',
                        i: DollarSign,
                      },
                      {
                        l: 'Fulfillment',
                        v: `${stats.fulfillmentRate}%`,
                        sub: `${stats.backOrder} back orders`,
                        bg: 'linear-gradient(135deg,#5B21B6,#7C3AED)',
                        i: TrendingUp,
                      },
                      {
                        l: 'Approval Rate',
                        v: `${approvalRate}%`,
                        sub: `${stats.pendingApproval} pending`,
                        bg: 'linear-gradient(135deg,#047857,#10B981)',
                        i: CheckCircle,
                      },
                      {
                        l: 'Avg Lead Time',
                        v: avgLead != null ? `${avgLead} days` : '—',
                        sub: avgLead != null ? `${leadTimeData.length} months tracked` : 'No data yet',
                        bg: 'linear-gradient(135deg,#92400E,#D97706)',
                        i: Clock,
                      },
                    ].map((s, i) => (
                      <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '20px 22px', color: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                opacity: 0.8,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                marginBottom: 6,
                              }}
                            >
                              {s.l}
                            </div>
                            <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>
                              {s.v}
                            </div>
                            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{s.sub}</div>
                          </div>
                          <div style={{ padding: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 8 }}>
                            <s.i size={18} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Row 1: Monthly Spend + Order Volume */}
              <div
                className="grid-2"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
              >
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Monthly Spend</h3>
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(v) => fmt(v)}
                        contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }}
                      />
                      <Bar dataKey="cost" radius={[6, 6, 0, 0]} barSize={22}>
                        {monthlyData.map((_, i) => (
                          <Cell key={i} fill={i === monthlyData.length - 1 ? '#00A550' : '#0B7A3E'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Order Volume vs Received</h3>
                  <ResponsiveContainer width="100%" height={270}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="orders"
                        stroke="#0B7A3E"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        name="Orders"
                      />
                      <Line
                        type="monotone"
                        dataKey="received"
                        stroke="#2563EB"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        name="Received"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Row 2: Status Distribution + Top 10 Materials */}
              <div
                className="grid-2"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
              >
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Status Distribution by Month</h3>
                  {statusTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={270}>
                      <BarChart data={statusTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#94A3B8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="Received" stackId="a" fill="#0B7A3E" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Approved" stackId="a" fill="#059669" />
                        <Bar dataKey="Pending Approval" stackId="a" fill="#7C3AED" />
                        <Bar dataKey="Rejected" stackId="a" fill="#F87171" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: 270,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        fontSize: 13,
                      }}
                    >
                      No data available
                    </div>
                  )}
                </div>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Top 10 Ordered Materials</h3>
                  {materialFrequency.length > 0 ? (
                    <div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={materialFrequency} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: '#94A3B8' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={120}
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip formatter={(v, n) => (n === 'cost' ? fmt(v) : v)} />
                          <Bar dataKey="orderCount" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={14} name="Orders" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {materialFrequency.slice(0, 5).map((m, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              background: '#EFF6FF',
                              fontSize: 10,
                              color: '#2563EB',
                            }}
                          >
                            <strong>{m.materialNo}</strong> — {m.qty} units, {fmt(m.cost)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        height: 270,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        fontSize: 13,
                      }}
                    >
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Lead Time Trend + Category Spend */}
              <div
                className="grid-2"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
              >
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Average Lead Time (Days)</h3>
                  {leadTimeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={270}>
                      <AreaChart data={leadTimeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#94A3B8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="d" />
                        <Tooltip formatter={(v) => `${v} days`} />
                        <Area
                          type="monotone"
                          dataKey="avgDays"
                          stroke="#D97706"
                          fill="#FEF3C7"
                          strokeWidth={2.5}
                          name="Avg Days"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: 270,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        fontSize: 13,
                      }}
                    >
                      No lead time data — requires orders with both order date and arrival date
                    </div>
                  )}
                </div>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Spend by Category</h3>
                  {categorySpendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={270}>
                      <PieChart>
                        <Pie
                          data={categorySpendData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {categorySpendData.map((e, i) => (
                            <Cell key={i} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: 270,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        fontSize: 13,
                      }}
                    >
                      No category data available
                    </div>
                  )}
                  {categorySpendData.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      {categorySpendData.slice(0, 6).map((s, i) => (
                        <div
                          key={i}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748B' }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                          {s.name} ({fmt(s.value)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 4: Engineer Activity */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Engineer Activity</h3>
                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[...new Set(orders.flatMap((o) => [o.orderBy, o.engineer]).filter(Boolean))].map((eng) => {
                    const eo = orders.filter((o) => o.orderBy === eng || o.engineer === eng);
                    const engValue = eo.reduce((s, o) => {
                      const cp = catalogLookup[o.materialNo];
                      const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
                      return s + (price > 0 ? price * (Number(o.quantity) || 0) : Number(o.totalCost) || 0);
                    }, 0);
                    const rcvd = eo.filter((o) => o.status === 'Received').length;
                    return (
                      <div key={eng} style={{ padding: 16, borderRadius: 12, background: '#F8FAFB' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg,#006837,#00A550)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {eng
                              .split(' ')
                              .map((w) => w[0])
                              .join('')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{eng}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{eo.length} orders</div>
                          </div>
                        </div>
                        <div
                          className="grid-4"
                          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}
                        >
                          <div>
                            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Orders</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                              {eo.length}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Received</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#0B7A3E' }}>
                              {rcvd}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Pending</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>
                              {eo.length - rcvd}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Value</div>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                              {fmt(engValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* FORECASTING */}
          {page === 'forecasting' && hasPermission('analytics') && (
            <ForecastingPage
              {...{
                orders,
                machines,
                setMachines,
                forecastMaterial,
                setForecastMaterial,
                forecastTab,
                setForecastTab,
                machineSearch,
                setMachineSearch,
                showAddMachine,
                setShowAddMachine,
                newMachine,
                setNewMachine,
                notify,
                logAction,
                dbSync,
                api,
              }}
            />
          )}

          {/* STOCK CHECK */}
          {page === 'stockcheck' && (
            <StockCheckPage
              {...{
                stockChecks,
                setStockChecks,
                stockCheckMode,
                setStockCheckMode,
                stockInventoryList,
                setStockInventoryList,
                stockCheckSearch,
                setStockCheckSearch,
                selStockChecks,
                setSelStockChecks,
                currentUser,
                addStockCheck,
                notify,
                dbSync,
                api,
                batchDeleteStockChecks,
                toggleSel,
                toggleAll,
                hasPermission,
              }}
            />
          )}

          {/* PART ARRIVAL CHECK */}
          {page === 'delivery' && (
            <DeliveryPage
              {...{
                orders,
                bulkGroups,
                setBulkGroups,
                arrivalMonthFilter,
                setArrivalMonthFilter,
                arrivalOrderByFilter,
                setArrivalOrderByFilter,
                arrivalOrderByUsers,
                selectedBulkForArrival,
                setSelectedBulkForArrival,
                arrivalItems,
                setArrivalItems,
                pendingArrival,
                setPendingArrival,
                arrivalSelected,
                setArrivalSelected,
                arrivalSort,
                setArrivalSort,
                arrivalStatusFilter,
                setArrivalStatusFilter,
                arrivalTypeFilter,
                setArrivalTypeFilter,
                waConnected,
                waMessageTemplates,
                waNotifyRules,
                currentUser,
                users,
                WA_API_URL,
                confirmArrival,
                batchConfirmArrival,
                notify,
                addNotifEntry,
                dbSync,
                api,
                setPage,
              }}
            />
          )}

          {/* ═══════════ WHATSAPP BAILEYS ═══════════ */}
          {page === 'whatsapp' && (
            <WhatsAppPage
              {...{
                waConnected,
                waConnecting,
                waQrVisible,
                waQrCode,
                waSessionInfo,
                waMessages,
                waRecipient,
                setWaRecipient,
                waMessageText,
                setWaMessageText,
                waTemplate,
                setWaTemplate,
                waTemplates,
                waNotifyRules,
                setWaNotifyRules,
                scheduledNotifs,
                setScheduledNotifs,
                waAutoReply,
                setWaAutoReply,
                waAllowedSenders,
                currentUser,
                users,
                hasPermission,
                handleWaConnect,
                handleWaDisconnect,
                handleWaSend,
                addNotifEntry,
                notify,
              }}
            />
          )}

          {/* ═══════════ NOTIFICATIONS ═══════════ */}
          {page === 'notifications' && (
            <div>
              <div
                className="grid-2"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ padding: 8, background: '#DBEAFE', borderRadius: 10 }}>
                      <Mail size={18} color="#2563EB" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>Email Notifications</h3>
                    </div>
                  </div>
                  <div className="card" style={{ padding: '18px 20px', marginBottom: 12 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Quick Compose</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <select style={{ width: '100%' }}>
                        <option>Monthly Full Received</option>
                        <option>Back Order Alert</option>
                        <option>Delivery Confirmation</option>
                        <option>Price List Update</option>
                      </select>
                      <input type="email" placeholder="Recipients" style={{ width: '100%' }} />
                      <textarea placeholder="Notes..." rows={3} style={{ width: '100%', resize: 'vertical' }} />
                      <button
                        className="be"
                        onClick={() => {
                          notify('Email Sent', 'Dispatched', 'success');
                          setNotifLog((p) => [
                            {
                              id: `N-${String(p.length + 1).padStart(3, '0')}`,
                              type: 'email',
                              to: 'service-sg@miltenyibiotec.com',
                              subject: 'Update',
                              date: new Date().toISOString().slice(0, 10),
                              status: 'Sent',
                            },
                            ...p,
                          ]);
                        }}
                      >
                        <Send size={14} /> Send
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ padding: 8, background: '#D1FAE5', borderRadius: 10 }}>
                      <MessageSquare size={18} color="#059669" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>WhatsApp (Baileys)</h3>
                      <p style={{ fontSize: 11, color: '#94A3B8' }}>
                        {waConnected ? '✓ Connected' : '✗ Not connected'} —{' '}
                        <button
                          onClick={() => setPage('whatsapp')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0B7A3E',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Manage →
                        </button>
                      </p>
                    </div>
                  </div>
                  <div className="card" style={{ padding: '18px 20px' }}>
                    <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                      WhatsApp messaging is handled through the <strong>Baileys WhiskeySockets</strong> integration. Go
                      to the WhatsApp page to connect your session, manage templates, and send messages.
                      <br />
                      <br />
                      Admin must scan QR code to authorize the session.
                    </p>
                  </div>
                </div>
              </div>
              {hasPermission('deleteNotifications') && (
                <BatchBar count={selNotifs.size} onClear={() => setSelNotifs(new Set())}>
                  <BatchBtn onClick={batchDeleteNotifs} bg="#DC2626" icon={Trash2}>
                    Delete Selected
                  </BatchBtn>
                </BatchBar>
              )}
              {(() => {
                const fn = notifLog.filter(
                  (n) =>
                    !notifSearch ||
                    [n.id, n.type, n.to, n.subject, n.status]
                      .join(' ')
                      .toLowerCase()
                      .includes(notifSearch.toLowerCase()),
                );
                return (
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #E8ECF0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>All Notification History</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
                          <input
                            className="header-search"
                            type="text"
                            placeholder="Search notifications..."
                            value={notifSearch}
                            onChange={(e) => setNotifSearch(e.target.value)}
                            style={{ paddingLeft: 32, width: 200, height: 36 }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>
                          {fn.length} records{selNotifs.size > 0 && ` • ${selNotifs.size} selected`}
                        </span>
                      </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFB' }}>
                          {hasPermission('deleteNotifications') && (
                            <th className="th" style={{ width: 36 }}>
                              <SelBox
                                checked={selNotifs.size === fn.length && fn.length > 0}
                                onChange={() =>
                                  toggleAll(
                                    selNotifs,
                                    setSelNotifs,
                                    fn.map((n) => n.id),
                                  )
                                }
                              />
                            </th>
                          )}
                          {[
                            'ID',
                            'Channel',
                            'To',
                            'Subject',
                            'Date',
                            'Status',
                            hasPermission('deleteNotifications') ? 'Actions' : null,
                          ]
                            .filter(Boolean)
                            .map((h) => (
                              <th key={h} className="th">
                                {h}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fn.length === 0 ? (
                          <tr>
                            <td
                              colSpan={hasPermission('deleteNotifications') ? 8 : 7}
                              style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}
                            >
                              {notifLog.length === 0 ? 'No notifications yet' : 'No notifications match your search.'}
                            </td>
                          </tr>
                        ) : (
                          fn.map((n) => (
                            <tr
                              key={n.id}
                              className="tr"
                              style={{
                                borderBottom: '1px solid #F7FAFC',
                                background: selNotifs.has(n.id) ? '#EDE9FE' : '#fff',
                              }}
                            >
                              {hasPermission('deleteNotifications') && (
                                <td className="td">
                                  <SelBox
                                    checked={selNotifs.has(n.id)}
                                    onChange={() => toggleSel(selNotifs, setSelNotifs, n.id)}
                                  />
                                </td>
                              )}
                              <td className="td mono" style={{ fontSize: 11, fontWeight: 500 }}>
                                {n.id}
                              </td>
                              <td className="td">
                                <Pill
                                  bg={n.type === 'email' ? '#DBEAFE' : '#D1FAE5'}
                                  color={n.type === 'email' ? '#2563EB' : '#059669'}
                                >
                                  {n.type === 'email' ? <Mail size={11} /> : <MessageSquare size={11} />}{' '}
                                  {n.type === 'email' ? 'Email' : 'WhatsApp'}
                                </Pill>
                              </td>
                              <td className="td" style={{ fontSize: 12, color: '#64748B' }}>
                                {n.to}
                              </td>
                              <td
                                className="td"
                                style={{
                                  maxWidth: 250,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {n.subject}
                              </td>
                              <td className="td" style={{ color: '#94A3B8', fontSize: 11 }}>
                                {fmtDate(n.date)}
                              </td>
                              <td className="td">
                                <Pill bg="#E6F4ED" color="#0B7A3E">
                                  <Check size={11} /> {n.status}
                                </Pill>
                              </td>
                              {hasPermission('deleteNotifications') && (
                                <td className="td">
                                  <button
                                    onClick={() => {
                                      if (window.confirm('Delete this notification?')) {
                                        setNotifLog((prev) => prev.filter((x) => x.id !== n.id));
                                        dbSync(api.deleteNotifEntry(n.id), 'Notification delete not saved');
                                        notify('Deleted', n.id, 'success');
                                      }
                                    }}
                                    style={{
                                      background: '#DC2626',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '4px 8px',
                                      fontSize: 10,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══════════ AUDIT TRAIL ═══════════ */}
          {page === 'audit' &&
            hasPermission('auditTrail') &&
            (() => {
              const AUDIT_COLORS = {
                create: '#059669',
                update: '#2563EB',
                delete: '#DC2626',
                approve: '#7C3AED',
                reject: '#DC2626',
                login: '#64748B',
                export: '#D97706',
                batch_approve: '#7C3AED',
              };
              const actions = ['All', ...new Set(auditLog.map((a) => a.action))];
              const entityTypes = ['All', ...new Set(auditLog.map((a) => a.entityType).filter(Boolean))];
              const auditUsers = ['All', ...new Set(auditLog.map((a) => a.userName).filter(Boolean))];
              const filtered = auditLog.filter((a) => {
                if (auditFilter.action !== 'All' && a.action !== auditFilter.action) return false;
                if (auditFilter.user !== 'All' && a.userName !== auditFilter.user) return false;
                if (auditFilter.entityType !== 'All' && a.entityType !== auditFilter.entityType) return false;
                if (auditSearch) {
                  const q = auditSearch.toLowerCase();
                  if (
                    ![a.userName, a.action, a.entityType, a.entityId, a.details ? JSON.stringify(a.details) : '']
                      .join(' ')
                      .toLowerCase()
                      .includes(q)
                  )
                    return false;
                }
                return true;
              });
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div
                      style={{ padding: 10, background: 'linear-gradient(135deg,#4338CA,#6366F1)', borderRadius: 12 }}
                    >
                      <Shield size={22} color="#fff" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Audit Trail</h2>
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                        Track all user actions and changes across the system
                      </p>
                    </div>
                  </div>

                  <div
                    className="grid-4"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}
                  >
                    {[
                      { l: 'Total Events', v: auditLog.length, c: '#4338CA' },
                      { l: 'Creates', v: auditLog.filter((a) => a.action === 'create').length, c: '#059669' },
                      { l: 'Updates', v: auditLog.filter((a) => a.action === 'update').length, c: '#2563EB' },
                      { l: 'Deletes', v: auditLog.filter((a) => a.action === 'delete').length, c: '#DC2626' },
                    ].map((s, i) => (
                      <div key={i} className="card" style={{ padding: '18px 22px', borderLeft: `3px solid ${s.c}` }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#94A3B8',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          {s.l}
                        </div>
                        <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: s.c }}>
                          {s.v}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className="card"
                    style={{
                      padding: '14px 20px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                        Action
                      </span>
                      <select
                        value={auditFilter.action}
                        onChange={(e) => setAuditFilter((p) => ({ ...p, action: e.target.value }))}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          fontSize: 11,
                          fontFamily: 'inherit',
                        }}
                      >
                        {actions.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                        User
                      </span>
                      <select
                        value={auditFilter.user}
                        onChange={(e) => setAuditFilter((p) => ({ ...p, user: e.target.value }))}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          fontSize: 11,
                          fontFamily: 'inherit',
                        }}
                      >
                        {auditUsers.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                        Entity
                      </span>
                      <select
                        value={auditFilter.entityType}
                        onChange={(e) => setAuditFilter((p) => ({ ...p, entityType: e.target.value }))}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          fontSize: 11,
                          fontFamily: 'inherit',
                        }}
                      >
                        {entityTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
                      <input
                        className="header-search"
                        type="text"
                        placeholder="Search..."
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        style={{ paddingLeft: 32, width: 180, height: 36 }}
                      />
                    </div>
                    <div style={{ flex: 1 }} />
                    <ExportDropdown
                      data={filtered}
                      columns={[
                        {
                          key: 'createdAt',
                          label: 'Timestamp',
                          fmt: (v) => (v ? new Date(v).toLocaleString('en-SG') : ''),
                        },
                        { key: 'userName', label: 'User' },
                        { key: 'action', label: 'Action' },
                        { key: 'entityType', label: 'Entity Type' },
                        { key: 'entityId', label: 'Entity ID' },
                        { key: 'details', label: 'Details', fmt: (v) => (v ? JSON.stringify(v) : '') },
                      ]}
                      filename="audit-trail"
                      title="Audit Trail Export"
                    />
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} events</span>
                  </div>

                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: '#F8FAFB', position: 'sticky', top: 0, zIndex: 1 }}>
                            {['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'].map((h) => (
                              <th key={h} className="th">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}
                              >
                                No audit events found
                              </td>
                            </tr>
                          ) : (
                            filtered.slice(0, 200).map((a, i) => (
                              <tr
                                key={a.id || i}
                                className="tr"
                                style={{
                                  borderBottom: '1px solid #F7FAFC',
                                  background: i % 2 === 0 ? '#fff' : '#FCFCFD',
                                }}
                              >
                                <td className="td" style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                                  {a.createdAt ? new Date(a.createdAt).toLocaleString('en-SG') : ''}
                                </td>
                                <td className="td" style={{ fontWeight: 500 }}>
                                  {a.userName || '—'}
                                </td>
                                <td className="td">
                                  <Pill
                                    bg={`${AUDIT_COLORS[a.action] || '#64748B'}18`}
                                    color={AUDIT_COLORS[a.action] || '#64748B'}
                                  >
                                    {a.action}
                                  </Pill>
                                </td>
                                <td className="td">
                                  <Pill bg="#F3F4F6" color="#4A5568">
                                    {a.entityType || '—'}
                                  </Pill>
                                </td>
                                <td className="td mono" style={{ fontSize: 11, fontWeight: 600 }}>
                                  {a.entityId || '—'}
                                </td>
                                <td
                                  className="td"
                                  style={{
                                    fontSize: 11,
                                    color: '#64748B',
                                    maxWidth: 300,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {a.details ? JSON.stringify(a.details) : ''}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filtered.length > 200 && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderTop: '1px solid #F0F2F5',
                          textAlign: 'center',
                          fontSize: 11,
                          color: '#94A3B8',
                        }}
                      >
                        Showing first 200 of {filtered.length} events. Use export to see all.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* ═══════════ USER MANAGEMENT (ADMIN ONLY) ═══════════ */}
          {page === 'users' && hasPermission('users') && (
            <div>
              {/* Pending Approvals */}
              {pendingUsers.length > 0 && (
                <div
                  className="card"
                  style={{ padding: '20px 24px', marginBottom: 24, border: '2px solid #FDE68A', background: '#FFFBEB' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <AlertTriangle size={18} color="#D97706" />
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#92400E' }}>
                      Pending Approvals ({pendingUsers.length})
                    </h3>
                  </div>
                  {pendingUsers.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: '#fff',
                        borderRadius: 10,
                        marginBottom: 8,
                        border: '1px solid #FDE68A',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg,#D97706,#F59E0B)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {u.name
                            .split(' ')
                            .map((w) => w[0])
                            .join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>
                            {u.email} • {u.username} • Requested: {fmtDate(u.requestDate)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="bp" style={{ padding: '7px 16px' }} onClick={() => handleApproveUser(u)}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="bd" style={{ padding: '7px 16px' }} onClick={() => handleRejectUser(u.id)}>
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Users */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>All Users</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
                    <input
                      className="header-search"
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      style={{ paddingLeft: 32, width: 200, height: 36 }}
                    />
                  </div>
                  <button
                    className="bp"
                    onClick={() => {
                      const name = window.prompt('Full Name:');
                      if (!name) return;
                      const username = window.prompt('Username:');
                      if (!username) return;
                      const email = window.prompt('Email:');
                      const role = window.prompt('Role (admin/user):', 'user');
                      handleCreateUser({
                        name,
                        username,
                        password: 'temp123',
                        email: email || '',
                        role: role || 'user',
                        phone: '',
                      });
                    }}
                  >
                    <UserPlus size={14} /> Create User
                  </button>
                </div>
              </div>
              <BatchBar count={selUsers.size} onClear={() => setSelUsers(new Set())}>
                <BatchBtn onClick={() => batchRoleUsers('admin')} bg="#2563EB" icon={Shield}>
                  Set Admin
                </BatchBtn>
                <BatchBtn onClick={() => batchRoleUsers('user')} bg="#059669" icon={Users}>
                  Set User
                </BatchBtn>
                <BatchBtn onClick={() => batchStatusUsers('active')} bg="#059669" icon={CheckCircle}>
                  Activate
                </BatchBtn>
                <BatchBtn onClick={() => batchStatusUsers('suspended')} bg="#D97706" icon={AlertTriangle}>
                  Suspend
                </BatchBtn>
                <BatchBtn onClick={batchDeleteUsers} bg="#DC2626" icon={Trash2}>
                  Delete
                </BatchBtn>
              </BatchBar>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB' }}>
                      <th className="th" style={{ width: 36 }}>
                        <SelBox
                          checked={selUsers.size === users.length && users.length > 0}
                          onChange={() =>
                            toggleAll(
                              selUsers,
                              setSelUsers,
                              users.map((u) => u.id),
                            )
                          }
                        />
                      </th>
                      {['ID', 'Name', 'Username', 'Email', 'Role', 'Status', 'Created', 'Phone', 'Actions'].map((h) => (
                        <th key={h} className="th">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const fu = users.filter(
                        (u) =>
                          !userSearch ||
                          [u.name, u.username, u.email, u.role, u.phone || '']
                            .join(' ')
                            .toLowerCase()
                            .includes(userSearch.toLowerCase()),
                      );
                      return fu.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                            {users.length === 0 ? 'No users found' : 'No users match your search.'}
                          </td>
                        </tr>
                      ) : (
                        fu.map((u) => (
                          <tr
                            key={u.id}
                            className="tr"
                            style={{
                              borderBottom: '1px solid #F7FAFC',
                              background: selUsers.has(u.id) ? '#DBEAFE' : '#fff',
                            }}
                          >
                            <td className="td">
                              <SelBox
                                checked={selUsers.has(u.id)}
                                onChange={() => toggleSel(selUsers, setSelUsers, u.id)}
                              />
                            </td>
                            <td className="td mono" style={{ fontSize: 11, fontWeight: 500 }}>
                              {u.id}
                            </td>
                            <td className="td">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background:
                                      u.role === 'admin'
                                        ? 'linear-gradient(135deg,#1E40AF,#3B82F6)'
                                        : 'linear-gradient(135deg,#006837,#00A550)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  {u.name
                                    .split(' ')
                                    .map((w) => w[0])
                                    .join('')}
                                </div>
                                {u.name}
                              </div>
                            </td>
                            <td className="td mono" style={{ fontSize: 11 }}>
                              {u.username}
                            </td>
                            <td className="td" style={{ fontSize: 11, color: '#64748B' }}>
                              {u.email}
                            </td>
                            <td className="td">
                              <Pill
                                bg={u.role === 'admin' ? '#DBEAFE' : '#E6F4ED'}
                                color={u.role === 'admin' ? '#2563EB' : '#0B7A3E'}
                              >
                                <Shield size={10} /> {u.role}
                              </Pill>
                            </td>
                            <td className="td">
                              <Pill
                                bg={u.status === 'active' ? '#E6F4ED' : '#FEE2E2'}
                                color={u.status === 'active' ? '#0B7A3E' : '#DC2626'}
                              >
                                {u.status}
                              </Pill>
                            </td>
                            <td className="td" style={{ fontSize: 11, color: '#94A3B8' }}>
                              {fmtDate(u.created)}
                            </td>
                            <td className="td mono" style={{ fontSize: 11 }}>
                              {u.phone || '—'}
                            </td>
                            <td className="td">
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  onClick={() => setSelectedUser({ ...u })}
                                  style={{
                                    background: '#2563EB',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Edit3 size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Delete user ${u.name}?`)) {
                                      setUsers((prev) => prev.filter((x) => x.id !== u.id));
                                      dbSync(api.deleteUser(u.id), 'User delete not saved');
                                      notify('Deleted', u.name, 'success');
                                    }
                                  }}
                                  style={{
                                    background: '#DC2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '4px 8px',
                                    fontSize: 10,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {selectedUser && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
              onClick={() => setSelectedUser(null)}
            >
              <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 24,
                  width: 540,
                  maxWidth: '94vw',
                  maxHeight: '85vh',
                  overflow: 'auto',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Edit User Profile</h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={20} color="#64748B" />
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <label
                      style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                    >
                      Full Name
                    </label>
                    <input
                      value={selectedUser.name}
                      onChange={(e) => setSelectedUser((prev) => ({ ...prev, name: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                    >
                      Username
                    </label>
                    <input
                      value={selectedUser.username}
                      onChange={(e) => setSelectedUser((prev) => ({ ...prev, username: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      value={selectedUser.email}
                      onChange={(e) => setSelectedUser((prev) => ({ ...prev, email: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                    >
                      Phone Number
                    </label>
                    <input
                      value={selectedUser.phone || ''}
                      onChange={(e) => setSelectedUser((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+65 XXXX XXXX"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                    >
                      Set New Password{' '}
                      <span style={{ fontWeight: 400, color: '#94A3B8' }}>(leave blank to keep current)</span>
                    </label>
                    <input
                      type="password"
                      value={selectedUser._newPassword || ''}
                      onChange={(e) => setSelectedUser((prev) => ({ ...prev, _newPassword: e.target.value }))}
                      placeholder="Enter new password"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                    {selectedUser._newPassword && selectedUser._newPassword.length < 6 && (
                      <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                        Password must be at least 6 characters
                      </div>
                    )}
                  </div>
                  <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Role
                      </label>
                      <select
                        value={selectedUser.role}
                        onChange={(e) => {
                          const newRole = e.target.value;
                          if (selectedUser.id === currentUser?.id && newRole !== 'admin') {
                            notify('Cannot Change', 'You cannot demote your own admin role', 'error');
                            return;
                          }
                          if (selectedUser.role === 'admin' && newRole !== 'admin') {
                            const adminCount = users.filter((u) => u.role === 'admin' && u.status === 'active').length;
                            if (adminCount <= 1) {
                              notify('Cannot Change', 'At least one admin must remain', 'error');
                              return;
                            }
                          }
                          setSelectedUser((prev) => ({ ...prev, role: newRole }));
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                      </select>
                      {selectedUser.id === currentUser?.id && (
                        <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                          You cannot change your own role
                        </div>
                      )}
                    </div>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Status
                      </label>
                      <select
                        value={selectedUser.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          if (selectedUser.id === currentUser?.id && newStatus !== 'active') {
                            notify('Cannot Change', 'You cannot deactivate your own account', 'error');
                            return;
                          }
                          setSelectedUser((prev) => ({ ...prev, status: newStatus }));
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>
                  {/* Feature Permissions */}
                  {selectedUser.role !== 'admin' && (
                    <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: 16 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#1A202C' }}>Feature Permissions</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() =>
                              setSelectedUser((prev) => ({
                                ...prev,
                                permissions: Object.fromEntries(Object.keys(DEFAULT_USER_PERMS).map((k) => [k, true])),
                              }))
                            }
                            style={{
                              padding: '3px 10px',
                              fontSize: 10,
                              fontWeight: 600,
                              border: '1px solid #059669',
                              background: '#D1FAE5',
                              color: '#059669',
                              borderRadius: 6,
                              cursor: 'pointer',
                            }}
                          >
                            All
                          </button>
                          <button
                            onClick={() =>
                              setSelectedUser((prev) => ({ ...prev, permissions: { ...DEFAULT_USER_PERMS } }))
                            }
                            style={{
                              padding: '3px 10px',
                              fontSize: 10,
                              fontWeight: 600,
                              border: '1px solid #D97706',
                              background: '#FEF3C7',
                              color: '#D97706',
                              borderRadius: 6,
                              cursor: 'pointer',
                            }}
                          >
                            Default
                          </button>
                          <button
                            onClick={() =>
                              setSelectedUser((prev) => ({
                                ...prev,
                                permissions: Object.fromEntries(Object.keys(DEFAULT_USER_PERMS).map((k) => [k, false])),
                              }))
                            }
                            style={{
                              padding: '3px 10px',
                              fontSize: 10,
                              fontWeight: 600,
                              border: '1px solid #DC2626',
                              background: '#FEE2E2',
                              color: '#DC2626',
                              borderRadius: 6,
                              cursor: 'pointer',
                            }}
                          >
                            None
                          </button>
                        </div>
                      </div>
                      {['Pages', 'Actions', 'Admin'].map((group) => (
                        <div key={group} style={{ marginBottom: 10 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#64748B',
                              marginBottom: 6,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {group}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                            {FEATURE_PERMISSIONS.filter((p) => p.group === group).map((p) => {
                              const perms = selectedUser.permissions || DEFAULT_USER_PERMS;
                              const enabled = perms[p.key] === true;
                              return (
                                <label
                                  key={p.key}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    background: enabled ? '#F0FDF4' : '#F8FAFB',
                                    border: enabled ? '1px solid #BBF7D0' : '1px solid #E8ECF0',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={() =>
                                      setSelectedUser((prev) => ({
                                        ...prev,
                                        permissions: { ...(prev.permissions || DEFAULT_USER_PERMS), [p.key]: !enabled },
                                      }))
                                    }
                                    style={{ accentColor: '#059669' }}
                                  />
                                  <span
                                    style={{ fontWeight: enabled ? 600 : 400, color: enabled ? '#065F46' : '#94A3B8' }}
                                  >
                                    {p.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedUser.role === 'admin' && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: '#DBEAFE',
                        border: '1px solid #93C5FD',
                        fontSize: 12,
                        color: '#1E40AF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Shield size={14} /> Admin role has full access to all features.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button
                      onClick={() => setSelectedUser(null)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        background: '#fff',
                        color: '#64748B',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (selectedUser._newPassword && selectedUser._newPassword.length < 6) {
                          notify('Error', 'Password must be at least 6 characters', 'error');
                          return;
                        }
                        const payload = { ...selectedUser };
                        if (payload._newPassword) {
                          payload.password = payload._newPassword;
                        }
                        delete payload._newPassword;
                        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? selectedUser : u)));
                        api.updateUser(selectedUser.id, payload);
                        setSelectedUser(null);
                        notify(
                          'User Updated',
                          payload.password ? 'Password and profile saved to database' : 'Changes saved to database',
                          'success',
                        );
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg,#006837,#00A550)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Bulk Order Modal */}
          {selectedBulkGroup &&
            (() => {
              const bgOrders = orders.filter((o) => o.bulkGroupId === selectedBulkGroup.id);
              const actualItems = bgOrders.length;
              const actualCost = bgOrders.reduce((s, o) => s + (o.totalCost || 0), 0);
              return (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                  }}
                  onClick={() => setSelectedBulkGroup(null)}
                >
                  <div
                    className="modal-box"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: '#fff',
                      borderRadius: 16,
                      padding: 24,
                      width: 500,
                      maxWidth: '94vw',
                      maxHeight: '80vh',
                      overflow: 'auto',
                      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 20,
                      }}
                    >
                      <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={18} color="#4338CA" /> Edit Bulk Order
                      </h3>
                      <button
                        onClick={() => setSelectedBulkGroup(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <X size={20} color="#64748B" />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: 16 }}>
                      <div
                        style={{
                          padding: 12,
                          background: '#F8FAFB',
                          borderRadius: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Batch ID</div>
                          <div className="mono" style={{ fontWeight: 700, color: '#4338CA' }}>
                            {selectedBulkGroup.id}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Actual from Orders</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {actualItems} items | {fmt(actualCost)}
                          </div>
                        </div>
                      </div>
                      {(selectedBulkGroup.items !== actualItems ||
                        Math.abs((selectedBulkGroup.totalCost || 0) - actualCost) > 0.01) && (
                        <div
                          style={{
                            padding: 10,
                            background: '#FEF3C7',
                            borderRadius: 8,
                            fontSize: 11,
                            color: '#92400E',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>
                            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            Items/cost mismatch with actual orders
                          </span>
                          <button
                            onClick={() =>
                              setSelectedBulkGroup((prev) => ({ ...prev, items: actualItems, totalCost: actualCost }))
                            }
                            style={{
                              padding: '4px 10px',
                              background: '#D97706',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Sync
                          </button>
                        </div>
                      )}
                      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 6,
                            }}
                          >
                            Month
                          </label>
                          <input
                            value={selectedBulkGroup.month}
                            onChange={(e) => setSelectedBulkGroup((prev) => ({ ...prev, month: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 6,
                            }}
                          >
                            Created By
                          </label>
                          <select
                            value={selectedBulkGroup.createdBy}
                            onChange={(e) => setSelectedBulkGroup((prev) => ({ ...prev, createdBy: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 13,
                            }}
                          >
                            {users
                              .filter((u) => u.status === 'active')
                              .map((u) => (
                                <option key={u.id} value={u.name}>
                                  {u.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 6,
                            }}
                          >
                            Items Count
                          </label>
                          <input
                            type="number"
                            value={selectedBulkGroup.items}
                            onChange={(e) =>
                              setSelectedBulkGroup((prev) => ({ ...prev, items: parseInt(e.target.value) || 0 }))
                            }
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 6,
                            }}
                          >
                            Total Cost (S$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={selectedBulkGroup.totalCost}
                            onChange={(e) =>
                              setSelectedBulkGroup((prev) => ({ ...prev, totalCost: parseFloat(e.target.value) || 0 }))
                            }
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 6,
                            }}
                          >
                            Status
                          </label>
                          <select
                            value={selectedBulkGroup.status}
                            onChange={(e) => setSelectedBulkGroup((prev) => ({ ...prev, status: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 13,
                            }}
                          >
                            <option value="Pending Approval">Pending Approval</option>
                            <option value="Approved">Approved</option>
                            <option value="Processing">Processing</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 6,
                            }}
                          >
                            Date
                          </label>
                          <input
                            type="date"
                            value={selectedBulkGroup.date}
                            onChange={(e) => setSelectedBulkGroup((prev) => ({ ...prev, date: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button
                          onClick={() => setSelectedBulkGroup(null)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 8,
                            border: '1.5px solid #E2E8F0',
                            background: '#fff',
                            color: '#64748B',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            const origGroup = bulkGroups.find((g) => g.id === selectedBulkGroup.id);
                            const oldMonth = origGroup?.month || '';
                            const newMonth = selectedBulkGroup.month;
                            const oldStatus = origGroup?.status || '';
                            const newStatus = selectedBulkGroup.status;
                            setBulkGroups((prev) =>
                              prev.map((g) => (g.id === selectedBulkGroup.id ? selectedBulkGroup : g)),
                            );
                            dbSync(
                              api.updateBulkGroup(selectedBulkGroup.id, selectedBulkGroup),
                              'Bulk group edit not saved',
                            );
                            // If month changed, update orders linked to this bulk group
                            if (oldMonth && newMonth && oldMonth !== newMonth) {
                              setOrders((prev) =>
                                prev.map((o) =>
                                  o.bulkGroupId === selectedBulkGroup.id ? { ...o, month: newMonth } : o,
                                ),
                              );
                              orders
                                .filter((o) => o.bulkGroupId === selectedBulkGroup.id)
                                .forEach((o) => {
                                  dbSync(api.updateOrder(o.id, { month: newMonth }), 'Order month sync failed');
                                });
                            }
                            // If status changed to Approved/Rejected, cascade to all linked orders
                            if (oldStatus !== newStatus && (newStatus === 'Approved' || newStatus === 'Rejected')) {
                              const approvalStatus = newStatus === 'Approved' ? 'approved' : 'rejected';
                              const linkedOrders = orders.filter((o) => o.bulkGroupId === selectedBulkGroup.id);
                              setOrders((prev) =>
                                prev.map((o) =>
                                  o.bulkGroupId === selectedBulkGroup.id
                                    ? { ...o, status: newStatus, approvalStatus }
                                    : o,
                                ),
                              );
                              linkedOrders.forEach((o) =>
                                dbSync(
                                  api.updateOrder(o.id, { status: newStatus, approvalStatus }),
                                  'Order approval cascade failed',
                                ),
                              );
                            }
                            // If manually set to Completed, mark all linked orders as Received with full arrival data
                            if (oldStatus !== newStatus && newStatus === 'Completed') {
                              const today = new Date().toISOString().slice(0, 10);
                              const linkedOrders = orders.filter((o) => o.bulkGroupId === selectedBulkGroup.id);
                              setOrders((prev) =>
                                prev.map((o) =>
                                  o.bulkGroupId === selectedBulkGroup.id
                                    ? {
                                        ...o,
                                        status: 'Received',
                                        approvalStatus: 'approved',
                                        qtyReceived: o.quantity,
                                        backOrder: 0,
                                        arrivalDate: o.arrivalDate || today,
                                      }
                                    : o,
                                ),
                              );
                              linkedOrders.forEach((o) =>
                                dbSync(
                                  api.updateOrder(o.id, {
                                    status: 'Received',
                                    approvalStatus: 'approved',
                                    qtyReceived: o.quantity,
                                    backOrder: 0,
                                    arrivalDate: o.arrivalDate || today,
                                  }),
                                  'Order received cascade failed',
                                ),
                              );
                            }
                            setSelectedBulkGroup(null);
                            notify('Bulk Order Updated', 'Changes saved to database', 'success');
                          }}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(135deg,#4338CA,#6366F1)',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Save Changes
                        </button>
                        {selectedBulkGroup.status === 'Pending Approval' && (
                          <div
                            style={{
                              gridColumn: 'span 2',
                              marginTop: 8,
                              padding: 12,
                              background: '#FEF3C7',
                              borderRadius: 8,
                              fontSize: 11,
                              color: '#92400E',
                            }}
                          >
                            <strong>Tip:</strong> If you made changes to a pending order, consider resending the
                            approval email to notify the approver of the updates.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Edit Order Modal */}
          {editingOrder && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
              onClick={() => setEditingOrder(null)}
            >
              <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 24,
                  width: 600,
                  maxWidth: '94vw',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Edit3 size={18} color="#2563EB" /> Edit Order
                  </h3>
                  <button
                    onClick={() => setEditingOrder(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={20} color="#64748B" />
                  </button>
                </div>

                {/* Warning for pending approval orders */}
                {(editingOrder.status === 'Pending Approval' || editingOrder.approvalStatus === 'pending') && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 14,
                      background: '#FEF3C7',
                      borderRadius: 10,
                      border: '1px solid #FCD34D',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <AlertTriangle size={16} color="#D97706" />
                      <strong style={{ fontSize: 13, color: '#92400E' }}>Order Pending Approval</strong>
                    </div>
                    <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                      This order is awaiting approval. If you make changes, it's recommended to{' '}
                      <strong>resend the approval email</strong> to notify the approver of the updates.
                    </p>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 14 }}>
                  <div
                    style={{
                      padding: 12,
                      background: '#F8FAFB',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Order ID</div>
                      <div className="mono" style={{ fontWeight: 700, color: '#2563EB' }}>
                        {editingOrder.id}
                      </div>
                    </div>
                    <Badge status={editingOrder.status} />
                  </div>

                  <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Material No
                      </label>
                      <input
                        value={editingOrder.materialNo || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditingOrder((prev) => ({ ...prev, materialNo: v }));
                          if (v.length >= 10) {
                            const p = catalogLookup[v];
                            if (p) {
                              const price = p.sg || p.tp || p.dist || 0;
                              setEditingOrder((prev) => ({
                                ...prev,
                                description: p.d,
                                listPrice: price,
                                totalCost: price * (prev.quantity || 1),
                              }));
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                          boxSizing: 'border-box',
                        }}
                        placeholder="130-XXX-XXX"
                      />
                    </div>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Description
                      </label>
                      <input
                        value={editingOrder.description || ''}
                        onChange={(e) => setEditingOrder((prev) => ({ ...prev, description: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editingOrder.quantity || 1}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          setEditingOrder((prev) => ({
                            ...prev,
                            quantity: qty,
                            totalCost: qty * (prev.listPrice || 0),
                            backOrder: (prev.qtyReceived || 0) - qty,
                          }));
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Unit Price (S$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingOrder.listPrice || 0}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0;
                          setEditingOrder((prev) => ({
                            ...prev,
                            listPrice: price,
                            totalCost: price * (prev.quantity || 1),
                          }));
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Total Cost
                      </label>
                      <div
                        className="mono"
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: '#E6F4ED',
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#0B7A3E',
                        }}
                      >
                        {fmt(editingOrder.totalCost || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Ordered By
                      </label>
                      <select
                        value={editingOrder.orderBy || ''}
                        onChange={(e) => setEditingOrder((prev) => ({ ...prev, orderBy: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                        }}
                      >
                        <option value="">Select User</option>
                        {users
                          .filter((u) => u.status === 'active')
                          .map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Status
                      </label>
                      <select
                        value={editingOrder.status || 'Pending Approval'}
                        onChange={(e) => {
                          const s = e.target.value;
                          const approvalSync =
                            s === 'Approved' ? 'approved' : s === 'Rejected' ? 'rejected' : undefined;
                          setEditingOrder((prev) => ({
                            ...prev,
                            status: s,
                            ...(approvalSync ? { approvalStatus: approvalSync } : {}),
                          }));
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                        }}
                      >
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Approved">Approved</option>
                        <option value="Received">Received</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Order Date
                      </label>
                      <input
                        type="date"
                        value={editingOrder.orderDate || ''}
                        onChange={(e) => setEditingOrder((prev) => ({ ...prev, orderDate: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                      >
                        Linked Bulk Batch
                      </label>
                      <select
                        value={editingOrder.bulkGroupId || ''}
                        onChange={(e) => {
                          const bgId = e.target.value || null;
                          const bg = bulkGroups.find((g) => g.id === bgId);
                          setEditingOrder((prev) => ({
                            ...prev,
                            bulkGroupId: bgId,
                            month: bg ? bg.month : prev.month,
                          }));
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #E2E8F0',
                          fontSize: 13,
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="">-- None (Individual) --</option>
                        {bulkGroups.map((bg) => (
                          <option key={bg.id} value={bg.id}>
                            {bg.month} ({bg.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}
                    >
                      Remark
                    </label>
                    <textarea
                      value={editingOrder.remark || ''}
                      onChange={(e) => setEditingOrder((prev) => ({ ...prev, remark: e.target.value }))}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button
                      onClick={() => setEditingOrder(null)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        background: '#fff',
                        color: '#64748B',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // If manually set to Received, auto-fill arrival fields so it skips Part Arrival
                        const isManualReceived = editingOrder.status === 'Received';
                        const finalOrder = isManualReceived
                          ? {
                              ...editingOrder,
                              qtyReceived: editingOrder.quantity,
                              backOrder: 0,
                              arrivalDate: editingOrder.arrivalDate || new Date().toISOString().slice(0, 10),
                              approvalStatus: 'approved',
                            }
                          : editingOrder;
                        const updatedOrders = orders.map((o) => (o.id === editingOrder.id ? finalOrder : o));
                        setOrders(updatedOrders);
                        const { qtyReceived, backOrder, arrivalDate, ...editFields } = finalOrder;
                        // Include arrival fields when manually marking as Received
                        const payload = isManualReceived
                          ? { ...editFields, qtyReceived, backOrder, arrivalDate }
                          : editFields;
                        dbSync(api.updateOrder(editingOrder.id, payload), 'Order edit not saved');
                        // Recalculate parent bulk group totals if this order belongs to one
                        if (editingOrder.bulkGroupId) {
                          const bg = bulkGroups.find((g) => g.id === editingOrder.bulkGroupId);
                          if (bg) {
                            const bgOrders = updatedOrders.filter((o) => o.bulkGroupId === bg.id);
                            const newItems = bgOrders.length;
                            const newTotalCost = bgOrders.reduce((s, o) => s + (o.totalCost || 0), 0);
                            if (bg.items !== newItems || bg.totalCost !== newTotalCost) {
                              const updatedBg = { ...bg, items: newItems, totalCost: newTotalCost };
                              setBulkGroups((prev) => prev.map((g) => (g.id === bg.id ? updatedBg : g)));
                              dbSync(
                                api.updateBulkGroup(bg.id, { items: newItems, totalCost: newTotalCost }),
                                'Bulk group tally not synced',
                              );
                            }
                          }
                        }
                        notify('Order Updated', editingOrder.id + ' has been updated', 'success');
                        setEditingOrder(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg,#2563EB,#3B82F6)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History Import Preview Modal */}
          {historyImportPreview && historyImportData.length > 0 && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
              onClick={() => {
                setHistoryImportPreview(false);
                setHistoryImportData([]);
              }}
            >
              <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 24,
                  width: '90%',
                  maxWidth: 1000,
                  maxHeight: '85vh',
                  overflow: 'auto',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{ padding: 10, background: 'linear-gradient(135deg,#4338CA,#6366F1)', borderRadius: 12 }}
                    >
                      <Database size={20} color="#fff" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 700 }}>Import Preview</h3>
                      <p style={{ fontSize: 12, color: '#64748B' }}>
                        {historyImportData.length} orders ready to import
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setHistoryImportPreview(false);
                      setHistoryImportData([]);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={22} color="#64748B" />
                  </button>
                </div>

                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: '#FEF3C7',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#92400E',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertCircle size={16} />
                  <span>
                    Review the data below before importing. This will add {historyImportData.length} new orders
                    {window.__pendingBulkGroups?.length
                      ? ` + ${window.__pendingBulkGroups.length} bulk batches`
                      : ''}{' '}
                    to the system.
                  </span>
                </div>

                <div
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    overflow: 'hidden',
                    maxHeight: 400,
                    overflowY: 'auto',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#F8FAFB' }}>
                      <tr>
                        {[
                          'ID',
                          'Material No',
                          'Description',
                          'Qty',
                          'Unit Price',
                          'Total',
                          'Order Date',
                          'Order By',
                          'Month',
                          'Status',
                        ].map((h) => (
                          <th key={h} className="th" style={{ padding: '10px 8px', fontSize: 10 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyImportData.slice(0, 50).map((o, i) => (
                        <tr key={i} className="tr" style={{ borderBottom: '1px solid #F0F2F5' }}>
                          <td className="td mono" style={{ fontSize: 10, color: '#4338CA' }}>
                            {o.id}
                          </td>
                          <td className="td mono" style={{ fontSize: 10 }}>
                            {o.materialNo || '—'}
                          </td>
                          <td
                            className="td"
                            style={{
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {o.description}
                          </td>
                          <td className="td" style={{ textAlign: 'center', fontWeight: 600 }}>
                            {o.quantity}
                          </td>
                          <td className="td mono">{fmt(o.listPrice)}</td>
                          <td className="td mono" style={{ fontWeight: 600 }}>
                            {fmt(o.totalCost)}
                          </td>
                          <td className="td" style={{ color: '#64748B' }}>
                            {o.orderDate}
                          </td>
                          <td className="td">
                            <Pill bg="#DBEAFE" color="#2563EB">
                              {o.orderBy}
                            </Pill>
                          </td>
                          <td className="td">
                            <Pill bg="#E6F4ED" color="#0B7A3E">
                              {o.month}
                            </Pill>
                          </td>
                          <td className="td">
                            <Badge status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {historyImportData.length > 50 && (
                  <div style={{ textAlign: 'center', padding: 10, fontSize: 11, color: '#64748B' }}>
                    Showing first 50 of {historyImportData.length} records
                  </div>
                )}

                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    background: '#F0FDF4',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: 12 }}>
                    <strong style={{ color: '#059669' }}>Summary:</strong> {historyImportData.length} orders | Total
                    Qty: {historyImportData.reduce((s, o) => s + (Number(o.quantity) || 0), 0)} | Total Value:{' '}
                    <strong className="mono">
                      {fmt(historyImportData.reduce((s, o) => s + (Number(o.totalCost) || 0), 0))}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => {
                        setHistoryImportPreview(false);
                        setHistoryImportData([]);
                      }}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        background: '#fff',
                        color: '#64748B',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmHistoryImport}
                      style={{
                        padding: '10px 24px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg,#059669,#10B981)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Check size={16} /> Import {historyImportData.length} Orders
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI BOT ADMIN */}
          {page === 'aibot' && hasPermission('aiBot') && (
            <AiBotPage
              {...{
                aiAdminTab,
                setAiAdminTab,
                aiKnowledgeBase,
                setAiKnowledgeBase,
                aiBotConfig,
                setAiBotConfig,
                aiConversationLogs,
                waAutoReply,
                handleFileUpload,
                notify,
                dbSync,
                api,
              }}
            />
          )}

          {page === 'settings' && hasPermission('settings') && (
            <SettingsPage
              {...{
                customLogo,
                setCustomLogo,
                emailConfig,
                setEmailConfig,
                priceConfig,
                setPriceConfig,
                waConnected,
                waMessageTemplates,
                setWaMessageTemplates,
                waAllowedSenders,
                setWaAllowedSenders,
                partsCatalog,
                setPartsCatalog,
                showCatalogMapper,
                setShowCatalogMapper,
                catalogColumnMap,
                setCatalogColumnMap,
                catalogMapperData,
                setCatalogMapperData,
                editingTemplate,
                setEditingTemplate,
                emailTemplates,
                setEmailTemplates,
                pendingApprovals,
                selApprovals,
                setSelApprovals,
                orders,
                setOrders,
                bulkGroups,
                setBulkGroups,
                notifLog,
                setNotifLog,
                setPendingApprovals,
                currentUser,
                users,
                hasPermission,
                notify,
                dbSync,
                handleApprovalAction,
                batchApprovalAction,
                toggleSel,
                toggleAll,
                handleHistoryImport,
                setPage,
                waNotifyRules,
                scheduledNotifs,
                LS_KEYS,
                api,
              }}
            />
          )}
        </div>
      </main>

      {/* ═══ CATALOG COLUMN MAPPER MODAL ═══ */}
      {showCatalogMapper && (
        <div className="mo" onClick={() => setShowCatalogMapper(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 680,
              maxWidth: '94vw',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Map Column Headers</h2>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  File: <strong>{catalogMapperData.fileName}</strong> — {catalogMapperData.rows.length} rows detected
                </div>
              </div>
              <button
                onClick={() => setShowCatalogMapper(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#64748B',
                marginBottom: 16,
                padding: '10px 14px',
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: 8,
              }}
            >
              Match each catalog field to a column from your file. Fields marked * are required. Auto-detected mappings
              are pre-selected.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { key: 'm', label: 'Material No. *', required: true },
                { key: 'd', label: 'Description *', required: true },
                { key: 'c', label: 'Category' },
                { key: 'sg', label: 'Unit Price (SG)' },
                { key: 'dist', label: 'Distributor Price' },
                { key: 'tp', label: 'Transfer Price' },
                { key: 'rsp', label: 'RSP EUR' },
              ].map((f) => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: f.required ? '#1E293B' : '#475569' }}>
                    {f.label}
                  </label>
                  <select
                    value={catalogColumnMap[f.key]}
                    onChange={(e) => setCatalogColumnMap((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: catalogColumnMap[f.key] ? '2px solid #059669' : '1px solid #E2E8F0',
                      fontSize: 12,
                      background: catalogColumnMap[f.key] ? '#F0FDF4' : '#fff',
                    }}
                  >
                    <option value="">— Not mapped —</option>
                    {catalogMapperData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {/* Preview */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                Preview (first 5 rows)
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB' }}>
                      {[
                        'Material No',
                        'Description',
                        'Category',
                        'Unit Price',
                        'Dist Price',
                        'Transfer Price',
                        'RSP EUR',
                      ].map((h) => (
                        <th key={h} className="th" style={{ whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catalogMapperData.rows.slice(0, 5).map((r, i) => {
                      const cm = catalogColumnMap;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F0F2F5' }}>
                          <td className="td mono" style={{ fontSize: 10, color: '#0B7A3E' }}>
                            {cm.m ? r[cm.m] || '' : ''}
                          </td>
                          <td
                            className="td"
                            style={{
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {cm.d ? r[cm.d] || '' : ''}
                          </td>
                          <td className="td">{cm.c ? r[cm.c] || '' : ''}</td>
                          <td className="td mono" style={{ textAlign: 'right' }}>
                            {cm.sg ? r[cm.sg] || '' : ''}
                          </td>
                          <td className="td mono" style={{ textAlign: 'right' }}>
                            {cm.dist ? r[cm.dist] || '' : ''}
                          </td>
                          <td className="td mono" style={{ textAlign: 'right' }}>
                            {cm.tp ? r[cm.tp] || '' : ''}
                          </td>
                          <td className="td mono" style={{ textAlign: 'right' }}>
                            {cm.rsp ? r[cm.rsp] || '' : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="bs" onClick={() => setShowCatalogMapper(false)}>
                Cancel
              </button>
              <button
                className="bp"
                disabled={!catalogColumnMap.m || !catalogColumnMap.d}
                onClick={async () => {
                  const cm = catalogColumnMap;
                  const mapped = catalogMapperData.rows
                    .map((r) => {
                      const o = {};
                      if (cm.m) o.m = String(r[cm.m] || '');
                      if (cm.d) o.d = String(r[cm.d] || '');
                      if (cm.c) o.c = String(r[cm.c] || '');
                      if (cm.sg) o.sg = parseFloat(r[cm.sg]) || 0;
                      if (cm.dist) o.dist = parseFloat(r[cm.dist]) || 0;
                      if (cm.tp) o.tp = parseFloat(r[cm.tp]) || 0;
                      if (cm.rsp) o.rsp = parseFloat(r[cm.rsp]) || 0;
                      return o;
                    })
                    .filter((p) => p.m && p.d);
                  if (!mapped.length) {
                    notify('Upload Failed', 'No valid parts found after mapping', 'warning');
                    return;
                  }
                  setPartsCatalog(mapped);
                  const uploadResult = await api.uploadCatalog(
                    mapped.map((p) => ({
                      materialNo: p.m,
                      description: p.d,
                      category: p.c || '',
                      sgPrice: p.sg || 0,
                      distPrice: p.dist || 0,
                      transferPrice: p.tp || 0,
                      rspEur: p.rsp || 0,
                    })),
                  );
                  if (uploadResult) {
                    notify(
                      'Catalog Uploaded',
                      `${mapped.length} parts saved to database from ${catalogMapperData.fileName}`,
                      'success',
                    );
                  } else {
                    notify(
                      'Upload Warning',
                      `${mapped.length} parts loaded locally but failed to save to database`,
                      'error',
                    );
                  }
                  setShowCatalogMapper(false);
                }}
                style={{ opacity: !catalogColumnMap.m || !catalogColumnMap.d ? 0.5 : 1 }}
              >
                Upload {catalogMapperData.rows.length} Parts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PRICE FINDER MODAL ═══ */}
      {showPriceFinder && (
        <div className="mo" onClick={() => setShowPriceFinder(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 760,
              maxWidth: '94vw',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Part Price Finder</h2>
              <button
                onClick={() => setShowPriceFinder(false)}
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
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: 8,
              }}
            >
              Paste material numbers separated by commas, line breaks, or semicolons. Up to 500 at a time.
            </div>
            <textarea
              value={priceFinderInput}
              onChange={(e) => setPriceFinderInput(e.target.value)}
              placeholder={'e.g.\n130-095-005\n130-096-602, 170-076-104'}
              rows={5}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: 12,
                padding: 12,
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 16, alignItems: 'center' }}>
              <button
                className="bp"
                disabled={!priceFinderInput.trim()}
                onClick={() => {
                  const raw = priceFinderInput.trim();
                  if (!raw) return;
                  const parts = raw
                    .split(/[\n,;\t]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const results = parts.map((partNo) => {
                    const match = catalogLookup[partNo];
                    if (match) {
                      return {
                        materialNo: partNo,
                        description: match.d,
                        sgPrice: Number(match.sg) || 0,
                        distPrice: Number(match.dist) || 0,
                        transferPrice: Number(match.tp) || 0,
                        rspEur: Number(match.rsp) || 0,
                        found: true,
                      };
                    }
                    return { materialNo: partNo, found: false };
                  });
                  setPriceFinderResults(results);
                }}
              >
                Search Prices
              </button>
              <button
                className="bs"
                onClick={() => {
                  setPriceFinderInput('');
                  setPriceFinderResults([]);
                }}
              >
                Clear
              </button>
              {priceFinderResults.length > 0 && (
                <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>
                  {priceFinderResults.filter((r) => r.found).length}/{priceFinderResults.length} found
                </span>
              )}
            </div>
            {priceFinderResults.length > 0 && (
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB' }}>
                      <th className="th">Material No.</th>
                      <th className="th">Description</th>
                      <th className="th" style={{ textAlign: 'right' }}>
                        Transfer
                      </th>
                      <th className="th" style={{ textAlign: 'right' }}>
                        Unit Price
                      </th>
                      <th className="th" style={{ textAlign: 'right' }}>
                        Dist Price
                      </th>
                      <th className="th" style={{ textAlign: 'right' }}>
                        RSP EUR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceFinderResults.map((r, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid #F0F2F5',
                          background: r.found ? (i % 2 === 0 ? '#fff' : '#FCFCFD') : '#FEF2F2',
                        }}
                      >
                        <td
                          className="td mono"
                          style={{ fontSize: 11, color: r.found ? '#0B7A3E' : '#DC2626', fontWeight: 500 }}
                        >
                          {r.materialNo}
                        </td>
                        <td
                          className="td"
                          style={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.found ? r.description : 'Not found in catalog'}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {r.found && r.transferPrice > 0 ? fmt(r.transferPrice) : '\u2014'}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {r.found && r.sgPrice > 0 ? fmt(r.sgPrice) : '\u2014'}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {r.found && r.distPrice > 0 ? fmt(r.distPrice) : '\u2014'}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {r.found && r.rspEur > 0 ? `\u20AC${r.rspEur.toLocaleString()}` : '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ NEW ORDER MODAL ═══ */}
      {showNewOrder && (
        <div className="mo" onClick={() => setShowNewOrder(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 520,
              maxWidth: '94vw',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Order</h2>
              <button
                onClick={() => setShowNewOrder(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Material No. *
                </label>
                <input
                  value={newOrder.materialNo}
                  onChange={(e) => {
                    setNewOrder((p) => ({ ...p, materialNo: e.target.value }));
                    if (e.target.value.length >= 10) handleMaterialLookup(e.target.value);
                  }}
                  placeholder="e.g. 130-097-866"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Description
                </label>
                <input
                  value={newOrder.description}
                  onChange={(e) => setNewOrder((p) => ({ ...p, description: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newOrder.quantity}
                    onChange={(e) => setNewOrder((p) => ({ ...p, quantity: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                    Unit Price (S$)
                  </label>
                  <div
                    className="mono"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: newOrder.listPrice > 0 ? '#E6F4ED' : '#F8FAFB',
                      border: '1.5px solid #E2E8F0',
                      fontSize: 13,
                      fontWeight: 600,
                      color: newOrder.listPrice > 0 ? '#0B7A3E' : '#94A3B8',
                    }}
                  >
                    {newOrder.listPrice > 0 ? fmt(newOrder.listPrice) : 'Auto from catalog'}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                    Total Cost
                  </label>
                  <div
                    className="mono"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: newOrder.listPrice > 0 ? '#E6F4ED' : '#F8FAFB',
                      border: '1.5px solid #E2E8F0',
                      fontSize: 13,
                      fontWeight: 600,
                      color: newOrder.listPrice > 0 ? '#0B7A3E' : '#94A3B8',
                    }}
                  >
                    {newOrder.listPrice > 0
                      ? fmt((parseFloat(newOrder.listPrice) || 0) * (parseInt(newOrder.quantity) || 1))
                      : '—'}
                  </div>
                </div>
              </div>
              {newOrder.materialNo && catalogLookup[newOrder.materialNo] && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    fontSize: 12,
                  }}
                >
                  <strong style={{ color: '#0B7A3E' }}>Catalog Match</strong>
                  <div
                    className="grid-3"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}
                  >
                    <div>
                      Unit Price: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].sg)}</strong>
                    </div>
                    <div>
                      Dist: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].dist)}</strong>
                    </div>
                    <div>
                      TP: <strong className="mono">{fmt(catalogLookup[newOrder.materialNo].tp)}</strong>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Order By
                </label>
                <select
                  value={newOrder.orderBy}
                  onChange={(e) => setNewOrder((p) => ({ ...p, orderBy: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="">— Select —</option>
                  {users
                    .filter((u) => u.status === 'active')
                    .map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Link to Bulk Batch <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span>
                </label>
                <select
                  value={newOrder.bulkGroupId || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__new__') {
                      setNewOrder((p) => ({ ...p, bulkGroupId: '__new__' }));
                      setNewBulkMonth(MONTH_OPTIONS[0]);
                    } else {
                      setNewOrder((p) => ({ ...p, bulkGroupId: v }));
                      setNewBulkMonth('');
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="">-- None (Individual Order) --</option>
                  {bulkGroups
                    .filter((bg) => bg.status !== 'Completed')
                    .map((bg) => (
                      <option key={bg.id} value={bg.id}>
                        {bg.month} ({bg.id}) — {bg.items} items, {fmt(bg.totalCost)}
                      </option>
                    ))}
                  <option value="__new__">+ Create New Bulk Batch...</option>
                </select>
                {newOrder.bulkGroupId === '__new__' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <select value={newBulkMonth} onChange={(e) => setNewBulkMonth(e.target.value)} style={{ flex: 1 }}>
                      {MONTH_OPTIONS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newBulkMonth) return;
                        const bgId = `BG-${String(bulkGroups.length + 1).padStart(3, '0')}`;
                        const bg = {
                          id: bgId,
                          month: newBulkMonth,
                          createdBy: currentUser?.name || '',
                          items: 0,
                          totalCost: 0,
                          status: 'Pending Approval',
                          date: new Date().toISOString().slice(0, 10),
                        };
                        setBulkGroups((prev) => [bg, ...prev]);
                        dbSync(api.createBulkGroup(bg), 'New bulk group not saved');
                        setNewOrder((p) => ({ ...p, bulkGroupId: bgId }));
                        setNewBulkMonth('');
                        notify('Bulk Batch Created', `${bgId} — ${newBulkMonth}`, 'success');
                      }}
                      style={{
                        padding: '6px 14px',
                        background: '#4338CA',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Create
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Remark
                </label>
                <textarea
                  value={newOrder.remark}
                  onChange={(e) => setNewOrder((p) => ({ ...p, remark: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: '#EDE9FE',
                  border: '1px solid #DDD6FE',
                  fontSize: 11,
                  color: '#5B21B6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle size={13} /> After creating, select orders and use{' '}
                <strong>"Order Approval & Notify"</strong> to send for approval.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="bp"
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  style={{ flex: 1, opacity: isSubmitting ? 0.6 : 1 }}
                >
                  <Plus size={14} /> {isSubmitting ? 'Creating...' : 'Create Order'}
                </button>
                <button className="bs" onClick={() => setShowNewOrder(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BULK ORDER MODAL ═══ */}
      {showBulkOrder && (
        <div className="mo" onClick={() => setShowBulkOrder(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 700,
              maxWidth: '94vw',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Monthly Bulk Order</h2>
                <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                  Group multiple items under one monthly batch
                </p>
              </div>
              <button
                onClick={() => setShowBulkOrder(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>
            <div
              className="grid-3"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Month Group *
                </label>
                <select value={bulkMonth} onChange={(e) => setBulkMonth(e.target.value)} style={{ width: '100%' }}>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Order By
                </label>
                <select value={bulkOrderBy} onChange={(e) => setBulkOrderBy(e.target.value)} style={{ width: '100%' }}>
                  <option value="">— Select —</option>
                  {users
                    .filter((u) => u.status === 'active')
                    .map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Batch Remark
                </label>
                <input
                  value={bulkRemark}
                  onChange={(e) => setBulkRemark(e.target.value)}
                  placeholder="e.g. Quarterly restock"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Order Items ({bulkItems.length})</span>
                <button className="bs" style={{ padding: '6px 12px', fontSize: 12 }} onClick={addBulkItem}>
                  <Plus size={13} /> Add Item
                </button>
              </div>
              <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB', position: 'sticky', top: 0 }}>
                      <th className="th" style={{ padding: '8px 10px' }}>
                        Material No.
                      </th>
                      <th className="th" style={{ padding: '8px 10px' }}>
                        Description
                      </th>
                      <th className="th" style={{ padding: '8px 10px', width: 70 }}>
                        Qty
                      </th>
                      <th className="th" style={{ padding: '8px 10px', width: 100 }}>
                        Unit Price
                      </th>
                      <th className="th" style={{ padding: '8px 10px', width: 100 }}>
                        Total
                      </th>
                      <th className="th" style={{ padding: '8px 10px', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F0F2F5' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            value={item.materialNo}
                            onChange={(e) => updateBulkItem(idx, 'materialNo', e.target.value)}
                            placeholder="130-XXX-XXX"
                            style={{ width: '100%', padding: '6px 8px', fontSize: 11 }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            value={item.description}
                            onChange={(e) => updateBulkItem(idx, 'description', e.target.value)}
                            placeholder="Auto-fills from catalog"
                            style={{ width: '100%', padding: '6px 8px', fontSize: 11 }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateBulkItem(idx, 'quantity', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: 11, textAlign: 'center' }}
                          />
                        </td>
                        <td
                          className="mono"
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontSize: 11,
                            fontWeight: 600,
                            color: item.listPrice > 0 ? '#0B7A3E' : '#94A3B8',
                          }}
                        >
                          {item.listPrice > 0 ? fmt(item.listPrice) : '—'}
                        </td>
                        <td
                          className="mono"
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontSize: 11,
                            fontWeight: 600,
                            color: item.listPrice > 0 ? '#0B7A3E' : '#94A3B8',
                          }}
                        >
                          {item.listPrice > 0
                            ? fmt((parseFloat(item.listPrice) || 0) * (parseInt(item.quantity) || 0))
                            : '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {bulkItems.length > 1 && (
                            <button
                              onClick={() => removeBulkItem(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Grand Total:{' '}
                <span className="mono" style={{ color: '#0B7A3E', marginLeft: 8, fontSize: 15 }}>
                  {fmt(bulkItems.reduce((s, i) => s + (parseFloat(i.listPrice) || 0) * (parseInt(i.quantity) || 0), 0))}
                </span>
              </div>
            </div>

            {/* Auto-Notify Status */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#F8FAFB',
                border: '1px solid #E2E8F0',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
                Auto-Notifications on Create:
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <Mail
                    size={12}
                    color={emailConfig.enabled && waNotifyRules.bulkOrderCreated ? '#059669' : '#9CA3AF'}
                  />
                  <span
                    style={{ color: emailConfig.enabled && waNotifyRules.bulkOrderCreated ? '#059669' : '#9CA3AF' }}
                  >
                    Email {emailConfig.enabled && waNotifyRules.bulkOrderCreated ? '✓' : 'Off'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <MessageSquare
                    size={12}
                    color={waConnected && waNotifyRules.bulkOrderCreated ? '#25D366' : '#9CA3AF'}
                  />
                  <span style={{ color: waConnected && waNotifyRules.bulkOrderCreated ? '#25D366' : '#9CA3AF' }}>
                    WhatsApp{' '}
                    {waConnected ? (waNotifyRules.bulkOrderCreated ? '(All Engineers)' : 'Off') : 'Not Connected'}
                  </span>
                  {!waConnected && (
                    <button
                      onClick={() => {
                        setShowBulkOrder(false);
                        setPage('whatsapp');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563EB',
                        fontSize: 10,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: '#EDE9FE',
                border: '1px solid #DDD6FE',
                fontSize: 11,
                color: '#5B21B6',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
              }}
            >
              <AlertCircle size={13} /> After creating, select the bulk batch and use{' '}
              <strong>"Order Approval & Notify"</strong> to send for approval.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="bp"
                onClick={handleBulkSubmit}
                disabled={isSubmitting}
                style={{ flex: 1, opacity: isSubmitting ? 0.6 : 1 }}
              >
                <Layers size={14} /> {isSubmitting ? 'Creating...' : 'Create Bulk Order'} (
                {bulkItems.filter((i) => i.materialNo && i.description).length} items)
              </button>
              <button className="bs" onClick={() => setShowBulkOrder(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ORDER DETAIL MODAL ═══ */}
      {selectedOrder && (
        <div className="mo" onClick={() => setSelectedOrder(null)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 560,
              maxWidth: '94vw',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>{selectedOrder.description}</h2>
                <span className="mono" style={{ fontSize: 12, color: '#94A3B8' }}>
                  {selectedOrder.id} • {selectedOrder.materialNo || '—'}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>
            <Badge status={selectedOrder.status} />

            {/* Ordered By & Month Badge - Prominent Display */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {selectedOrder.orderBy && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    background: '#DBEAFE',
                    borderRadius: 8,
                  }}
                >
                  <User size={14} color="#2563EB" />
                  <div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>ORDERED BY</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>{selectedOrder.orderBy}</div>
                  </div>
                </div>
              )}
              {selectedOrder.month && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    background: '#E6F4ED',
                    borderRadius: 8,
                  }}
                >
                  <Calendar size={14} color="#0B7A3E" />
                  <div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>MONTH BATCH</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0B7A3E' }}>
                      {String(selectedOrder.month).replace('_', ' ')}
                    </div>
                  </div>
                </div>
              )}
              {selectedOrder.bulkGroupId && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    background: '#EDE9FE',
                    borderRadius: 8,
                  }}
                >
                  <Layers size={14} color="#7C3AED" />
                  <div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>BULK BATCH</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{selectedOrder.bulkGroupId}</div>
                  </div>
                </div>
              )}
              {selectedOrder.orderDate && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    background: '#F8FAFB',
                    borderRadius: 8,
                  }}
                >
                  <Clock size={14} color="#64748B" />
                  <div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>ORDER DATE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                      {fmtDate(selectedOrder.orderDate)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedOrder.materialNo && catalogLookup[selectedOrder.materialNo] && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  marginTop: 12,
                  fontSize: 12,
                }}
              >
                <strong style={{ color: '#2563EB' }}>Catalog Price ({priceConfig.year})</strong>
                <div
                  className="grid-3"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}
                >
                  <div>
                    Unit Price: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].sg)}</strong>
                  </div>
                  <div>
                    Dist: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].dist)}</strong>
                  </div>
                  <div>
                    TP: <strong className="mono">{fmt(catalogLookup[selectedOrder.materialNo].tp)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Update Received Quantity Section */}
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                marginTop: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Package size={16} color="#059669" />
                <span style={{ fontWeight: 600, fontSize: 13, color: '#059669' }}>Update Received Quantity</span>
              </div>
              <div
                className="grid-3"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }}>Ordered</label>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                    {selectedOrder.quantity}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }}>Received</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedOrder.quantity || 0}
                    value={selectedOrder.qtyReceived || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const newBackOrder = val - selectedOrder.quantity;
                      const newStatus = val >= selectedOrder.quantity ? 'Received' : selectedOrder.status;
                      const updatedOrder = {
                        ...selectedOrder,
                        qtyReceived: val,
                        backOrder: newBackOrder,
                        status: newStatus,
                        arrivalDate: selectedOrder.arrivalDate || new Date().toISOString().slice(0, 10),
                      };
                      const updatedOrders = orders.map((o) => (o.id === selectedOrder.id ? updatedOrder : o));
                      setOrders(updatedOrders);
                      setSelectedOrder(updatedOrder);
                      dbSync(
                        api.updateOrder(selectedOrder.id, {
                          qtyReceived: val,
                          backOrder: newBackOrder,
                          status: newStatus,
                          arrivalDate: updatedOrder.arrivalDate,
                        }),
                        'Arrival update not saved',
                      );
                      if (selectedOrder.bulkGroupId) checkBulkGroupCompletion(selectedOrder.bulkGroupId, updatedOrders);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: '1.5px solid #BBF7D0',
                      textAlign: 'center',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                    Back Order
                  </label>
                  <div
                    className="mono"
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: selectedOrder.backOrder < 0 ? '#DC2626' : '#059669',
                    }}
                  >
                    {selectedOrder.backOrder < 0 ? selectedOrder.backOrder : '✓ Full'}
                  </div>
                </div>
              </div>
              {selectedOrder.backOrder < 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 8,
                    background: '#FEF2F2',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertCircle size={12} /> {Math.abs(selectedOrder.backOrder)} items still pending
                </div>
              )}
              {selectedOrder.qtyReceived >= selectedOrder.quantity && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 8,
                    background: '#D1FAE5',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <CheckCircle size={12} /> Order fully received
                </div>
              )}
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              {[
                { l: 'Price', v: selectedOrder.listPrice > 0 ? fmt(selectedOrder.listPrice) : '—' },
                { l: 'Total', v: selectedOrder.totalCost > 0 ? fmt(selectedOrder.totalCost) : '—' },
                { l: 'Ordered', v: fmtDate(selectedOrder.orderDate) },
                { l: 'By', v: selectedOrder.orderBy || '—' },
                { l: 'Arrival', v: selectedOrder.arrivalDate ? fmtDate(selectedOrder.arrivalDate) : '—' },
                { l: 'Engineer', v: selectedOrder.engineer || '—' },
                { l: 'Month', v: selectedOrder.month?.replace('_', ' ') || '—' },
                { l: 'Remark', v: selectedOrder.remark || '—' },
              ].map((f, i) => (
                <div key={i} style={{ padding: 10, borderRadius: 8, background: '#F8FAFB' }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94A3B8',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 3,
                    }}
                  >
                    {f.l}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                className="bp"
                onClick={async () => {
                  const updatedOrders = orders.map((o) => (o.id === selectedOrder.id ? selectedOrder : o));
                  setOrders(updatedOrders);
                  const ok = await api.updateOrder(selectedOrder.id, selectedOrder);
                  if (ok) {
                    notify('Order Updated', `${selectedOrder.id} saved to database`, 'success');
                    if (selectedOrder.bulkGroupId) recalcBulkGroupForMonths([selectedOrder.bulkGroupId], updatedOrders);
                  } else {
                    notify('Save Failed', `${selectedOrder.id} not saved to database`, 'error');
                  }
                  setSelectedOrder(null);
                }}
              >
                <Check size={14} /> Save & Close
              </button>
              <button
                className="be"
                onClick={() => {
                  notify('Email Sent', 'Update sent', 'success');
                  setSelectedOrder(null);
                }}
              >
                <Mail size={14} /> Email
              </button>
              {waConnected && (
                <button
                  className="bw"
                  onClick={() => {
                    notify('WhatsApp Sent', 'Alert sent', 'success');
                    setSelectedOrder(null);
                  }}
                >
                  <MessageSquare size={14} /> WhatsApp
                </button>
              )}
              <button className="bs" onClick={() => setSelectedOrder(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PART DETAIL MODAL ═══ */}
      {selectedPart && (
        <div className="mo" onClick={() => setSelectedPart(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 520,
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>{selectedPart.description}</h2>
                <span className="mono" style={{ fontSize: 12, color: '#94A3B8' }}>
                  {selectedPart.materialNo}
                </span>
              </div>
              <button
                onClick={() => setSelectedPart(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <Pill
                bg={`${CATEGORIES[selectedPart.category]?.color || '#64748B'}12`}
                color={CATEGORIES[selectedPart.category]?.color || '#64748B'}
              >
                {CATEGORIES[selectedPart.category]?.label || selectedPart.category}
              </Pill>
            </div>
            <div
              className="grid-2"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}
            >
              {[
                { l: 'Unit Price', v: fmt(selectedPart.singaporePrice), c: '#0B7A3E' },
                { l: 'Dist Price', v: fmt(selectedPart.distributorPrice), c: '#2563EB' },
                { l: 'Transfer (SGD)', v: fmt(selectedPart.transferPrice), c: '#7C3AED' },
                { l: 'RSP (EUR)', v: `€${selectedPart.rspEur?.toLocaleString()}`, c: '#D97706' },
                {
                  l: 'Margin',
                  v: `${selectedPart.singaporePrice > 0 ? (((selectedPart.singaporePrice - selectedPart.distributorPrice) / selectedPart.singaporePrice) * 100).toFixed(1) : 0}%`,
                  c: '#059669',
                },
                { l: 'Year', v: priceConfig.year, c: '#64748B' },
              ].map((f, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 8, background: '#F8FAFB' }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}
                  >
                    {f.l}
                  </div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: f.c }}>
                    {f.v}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="bp"
                onClick={() => {
                  setShowNewOrder(true);
                  setNewOrder({
                    materialNo: selectedPart.materialNo,
                    description: selectedPart.description,
                    quantity: 1,
                    listPrice:
                      selectedPart.singaporePrice || selectedPart.transferPrice || selectedPart.distributorPrice || 0,
                    orderBy: '',
                    remark: '',
                  });
                  setSelectedPart(null);
                }}
              >
                <ShoppingCart size={14} /> Order
              </button>
              <button className="bs" onClick={() => setSelectedPart(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ AI CHAT PANEL (SLIDE-IN) ═══════════ */}
      <div
        className={`ai-panel${aiPanelOpen ? '' : ' closed'}`}
        style={{
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
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E8ECF0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #006837, #00A550)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Miltenyi Inventory Bot</div>
            </div>
          </div>
          <button
            onClick={() => setAiPanelOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={16} color="#fff" />
          </button>
        </div>

        {/* Messages Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#F8FAFB' }}>
          {aiMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #006837, #00A550)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Sparkles size={28} color="#fff" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A202C', marginBottom: 8 }}>How can I help?</h3>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>{aiBotConfig.greeting}</p>
            </div>
          )}

          {aiMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #006837, #00A550)' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#1A202C',
                  fontSize: 13,
                  lineHeight: 1.5,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
                <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7, textAlign: 'right' }}>{msg.time}</div>
              </div>
            </div>
          ))}

          {aiProcessing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: '#fff',
                borderRadius: 14,
                width: 'fit-content',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} color="#0B7A3E" />
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
            { key: 'stock', label: 'Stock Levels', icon: Database },
          ].map((action) => (
            <button
              key={action.key}
              onClick={() => handleAiQuickAction(action.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                background: '#fff',
                fontSize: 11,
                color: '#64748B',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#0B7A3E';
                e.currentTarget.style.color = '#0B7A3E';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.color = '#64748B';
              }}
            >
              <action.icon size={12} /> {action.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ padding: 16, borderTop: '1px solid #E8ECF0', background: '#fff' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
              placeholder="Ask about prices, orders, stock..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleAiSend}
              disabled={!aiInput.trim() || aiProcessing}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: aiInput.trim() ? 'linear-gradient(135deg, #006837, #00A550)' : '#E2E8F0',
                color: aiInput.trim() ? '#fff' : '#94A3B8',
                cursor: aiInput.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Recipient Picker Modal */}
      {waRecipientPicker && (
        <div
          className="mo"
          onClick={() => setWaRecipientPicker(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '24px 28px',
              width: 420,
              maxWidth: '94vw',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} color="#25D366" /> {waRecipientPicker.title || 'Select WhatsApp Recipients'}
              </h3>
              <button
                onClick={() => setWaRecipientPicker(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color="#64748B" />
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              Select users to receive this WhatsApp notification:
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button
                onClick={() =>
                  setWaRecipientPicker((prev) => ({
                    ...prev,
                    selected: new Set(users.filter((u) => u.phone && u.status === 'active').map((u) => u.id)),
                  }))
                }
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFB',
                  fontSize: 11,
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                Select All
              </button>
              <button
                onClick={() => setWaRecipientPicker((prev) => ({ ...prev, selected: new Set() }))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFB',
                  fontSize: 11,
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                Clear All
              </button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #E8ECF0', borderRadius: 10 }}>
              {users
                .filter((u) => u.status === 'active')
                .map((u) => (
                  <label
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: '1px solid #F0F2F5',
                      cursor: u.phone ? 'pointer' : 'default',
                      opacity: u.phone ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!u.phone}
                      checked={waRecipientPicker.selected.has(u.id)}
                      onChange={() =>
                        setWaRecipientPicker((prev) => {
                          const next = new Set(prev.selected);
                          next.has(u.id) ? next.delete(u.id) : next.add(u.id);
                          return { ...prev, selected: next };
                        })
                      }
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {u.name} <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>({u.role})</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {u.phone || 'No phone number'}
                        {u.email ? ` • ${u.email}` : ''}
                      </div>
                    </div>
                    {u.phone && <span style={{ fontSize: 10, color: '#25D366', fontWeight: 600 }}>WhatsApp</span>}
                  </label>
                ))}
              {users.filter((u) => u.status === 'active').length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                  No active users found
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 12, textAlign: 'center' }}>
              WhatsApp notification is optional — skip if not needed
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
              <button
                className="bs"
                onClick={() => setWaRecipientPicker(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <X size={12} /> Skip WhatsApp
              </button>
              <button
                className="bp"
                disabled={waRecipientPicker.selected.size === 0 || waSending}
                onClick={sendWaPickerMessages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: waRecipientPicker.selected.size > 0 && !waSending ? 1 : 0.5,
                }}
              >
                {waSending ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Send to {waRecipientPicker.selected.size} Recipient
                    {waRecipientPicker.selected.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
