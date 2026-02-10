const BASE = '';

// ─── Token Management ───

let _token = null;

function setToken(token) {
  _token = token;
  if (token) {
    localStorage.setItem('mih_token', token);
  } else {
    localStorage.removeItem('mih_token');
  }
}

function getToken() {
  if (!_token) {
    _token = localStorage.getItem('mih_token');
  }
  return _token;
}

function authHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function authHeadersGet() {
  const token = getToken();
  if (token) return { 'Authorization': `Bearer ${token}` };
  return {};
}

// Handle 401 responses (token expired/invalid)
let _onAuthError = null;
let _authErrorFired = false;
function onAuthError(callback) {
  _onAuthError = callback;
}
function resetAuthError() {
  _authErrorFired = false;
}

function handleResponse(res) {
  if (res.status === 401 || res.status === 403) {
    setToken(null);
    if (_onAuthError && !_authErrorFired) {
      _authErrorFired = true;
      _onAuthError();
    }
  }
  return res;
}

// ─── Auth (public - no token needed) ───

async function login(username, password) {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token) {
      setToken(data.token);
    }
    return data;
  } catch {
    return null;
  }
}

async function register(data) {
  try {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function logout() {
  setToken(null);
}

// Validate token and get fresh user data from DB
async function getMe() {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, { headers: authHeadersGet() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Public: fetch logo (no auth required)
async function getPublicLogo() {
  try {
    const res = await fetch(`${BASE}/api/public/logo`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.logo;
  } catch {
    return null;
  }
}

// ─── Orders (protected) ───

async function getOrders(filters = {}) {
  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== '' && v !== null && v !== undefined) params.append(k, v);
    }
    const qs = params.toString();
    const res = handleResponse(await fetch(`${BASE}/api/orders${qs ? `?${qs}` : ''}`, { headers: authHeadersGet() }));
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createOrder(order) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(order),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateOrder(id, updates) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/orders/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteOrder(id) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/orders/${id}`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

async function bulkUpdateOrderStatus(ids, status) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/orders/bulk-status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ ids, status }),
    }));
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Bulk Groups (protected) ───

async function getBulkGroups() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/bulk-groups`, { headers: authHeadersGet() }));
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createBulkGroup(group) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/bulk-groups`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(group),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateBulkGroup(id, updates) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/bulk-groups/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteBulkGroup(id) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/bulk-groups/${id}`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Users (admin-only) ───

async function getUsers() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/users`, { headers: authHeadersGet() }));
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createUser(user) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(user),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateUser(id, updates) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/users/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteUser(id) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/users/${id}`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Stock Checks (protected) ───

async function getStockChecks() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/stock-checks`, { headers: authHeadersGet() }));
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createStockCheck(check) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/stock-checks`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(check),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateStockCheck(id, updates) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/stock-checks/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Notifications (protected) ───

async function getNotifLog() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/notif-log`, { headers: authHeadersGet() }));
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createNotifEntry(entry) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/notif-log`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(entry),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Approvals (protected) ───

async function getApprovals(status) {
  try {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = handleResponse(await fetch(`${BASE}/api/pending-approvals${qs}`, { headers: authHeadersGet() }));
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createApproval(approval) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/pending-approvals`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(approval),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateApproval(id, updates) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/pending-approvals/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Config (admin-only) ───

async function getConfig() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/config`, { headers: authHeadersGet() }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getConfigKey(key) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/config/${encodeURIComponent(key)}`, { headers: authHeadersGet() }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function setConfigKey(key, value) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ value }),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Catalog (protected) ───

async function getCatalog() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/catalog`, { headers: authHeadersGet() }));
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function uploadCatalog(parts) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/catalog`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ parts }),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function clearCatalog() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/catalog`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Delete All (admin-only) ───

async function clearOrders() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/orders/all`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

async function clearBulkGroups() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/bulk-groups/all`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteStockCheck(id) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/stock-checks/${id}`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

async function clearStockChecks() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/stock-checks`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteNotifEntry(id) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/notif-log/${id}`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

async function clearNotifLog() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/notif-log`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

async function clearApprovals() {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/pending-approvals`, { method: 'DELETE', headers: authHeadersGet() }));
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Migration (admin-only) ───

async function migrateData(data) {
  try {
    const res = handleResponse(await fetch(`${BASE}/api/migrate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Export ───

const api = {
  setToken,
  getToken,
  logout,
  getMe,
  getPublicLogo,
  onAuthError,
  resetAuthError,
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  bulkUpdateOrderStatus,
  getBulkGroups,
  createBulkGroup,
  updateBulkGroup,
  deleteBulkGroup,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  login,
  register,
  getStockChecks,
  createStockCheck,
  updateStockCheck,
  getNotifLog,
  createNotifEntry,
  getApprovals,
  createApproval,
  updateApproval,
  getConfig,
  getConfigKey,
  setConfigKey,
  getCatalog,
  uploadCatalog,
  clearCatalog,
  clearOrders,
  clearBulkGroups,
  deleteStockCheck,
  clearStockChecks,
  deleteNotifEntry,
  clearNotifLog,
  clearApprovals,
  migrateData,
};

export default api;
