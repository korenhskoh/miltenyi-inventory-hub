const BASE = '';

// ─── Orders ───

async function getOrders(filters = {}) {
  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== '' && v !== null && v !== undefined) params.append(k, v);
    }
    const qs = params.toString();
    const res = await fetch(`${BASE}/api/orders${qs ? `?${qs}` : ''}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createOrder(order) {
  try {
    const res = await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateOrder(id, updates) {
  try {
    const res = await fetch(`${BASE}/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteOrder(id) {
  try {
    const res = await fetch(`${BASE}/api/orders/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

async function bulkUpdateOrderStatus(ids, status) {
  try {
    const res = await fetch(`${BASE}/api/orders/bulk-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Bulk Groups ───

async function getBulkGroups() {
  try {
    const res = await fetch(`${BASE}/api/bulk-groups`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createBulkGroup(group) {
  try {
    const res = await fetch(`${BASE}/api/bulk-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateBulkGroup(id, updates) {
  try {
    const res = await fetch(`${BASE}/api/bulk-groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteBulkGroup(id) {
  try {
    const res = await fetch(`${BASE}/api/bulk-groups/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Users ───

async function getUsers() {
  try {
    const res = await fetch(`${BASE}/api/users`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createUser(user) {
  try {
    const res = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateUser(id, updates) {
  try {
    const res = await fetch(`${BASE}/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteUser(id) {
  try {
    const res = await fetch(`${BASE}/api/users/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Auth ───

async function login(username, password) {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    return await res.json();
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

// ─── Stock Checks ───

async function getStockChecks() {
  try {
    const res = await fetch(`${BASE}/api/stock-checks`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createStockCheck(check) {
  try {
    const res = await fetch(`${BASE}/api/stock-checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(check),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateStockCheck(id, updates) {
  try {
    const res = await fetch(`${BASE}/api/stock-checks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Notifications ───

async function getNotifLog() {
  try {
    const res = await fetch(`${BASE}/api/notifications`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createNotifEntry(entry) {
  try {
    const res = await fetch(`${BASE}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Approvals ───

async function getApprovals(status) {
  try {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${BASE}/api/pending-approvals${qs}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function createApproval(approval) {
  try {
    const res = await fetch(`${BASE}/api/pending-approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approval),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateApproval(id, updates) {
  try {
    const res = await fetch(`${BASE}/api/pending-approvals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Config ───

async function getConfig() {
  try {
    const res = await fetch(`${BASE}/api/config`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getConfigKey(key) {
  try {
    const res = await fetch(`${BASE}/api/config/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function setConfigKey(key, value) {
  try {
    const res = await fetch(`${BASE}/api/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Catalog ───

async function getCatalog() {
  try {
    const res = await fetch(`${BASE}/api/catalog`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function uploadCatalog(parts) {
  try {
    const res = await fetch(`${BASE}/api/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function clearCatalog() {
  try {
    const res = await fetch(`${BASE}/api/catalog`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Migration ───

async function migrateData(data) {
  try {
    const res = await fetch(`${BASE}/api/migrate`, {
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

// ─── Export ───

const api = {
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
  migrateData,
};

export default api;
