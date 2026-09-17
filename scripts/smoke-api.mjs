// End-to-end API smoke test. Run against a FRESH database (it seeds admin/admin123):
//   DATABASE_URL=postgres://... JWT_SECRET=x PORT=3001 node server/index.js &
//   SMOKE_BASE=http://localhost:3001 node scripts/smoke-api.mjs

const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
let fails = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : '  ← ' + extra}`);
  if (!cond) fails++;
};
async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// ── auth ──
let r = await call('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
ok(r.status === 200 && r.json.token, 'admin login', JSON.stringify(r.json));
const admin = r.json.token;

r = await call('POST', '/api/auth/register', { username: 'tech1', password: 'pw12345', name: 'Tech One', email: 't1@x.com', phone: '91112222' });
ok(r.status === 201 && r.json.id?.startsWith('U-') && r.json.status === 'pending', 'register creates pending user with generated id', JSON.stringify(r.json));
const techId = r.json.id;
r = await call('POST', '/api/auth/register', { username: 'tech1', password: 'pw12345' });
ok(r.status === 409, 'duplicate register → 409', String(r.status));
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
ok(r.status === 401, 'pending user cannot log in', String(r.status));

r = await call('GET', '/api/users?all=true', null, admin);
ok(r.status === 200 && r.json.data.some((u) => u.id === techId && u.status === 'pending'), 'admin sees pending user in list', JSON.stringify(r.json).slice(0, 200));
r = await call('PUT', `/api/users/${techId}`, { status: 'active', role: 'user', permissions: { orders: true, approvals: false, deleteOrders: false } }, admin);
ok(r.status === 200 && r.json.status === 'active', 'admin activates user', JSON.stringify(r.json));
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
ok(r.status === 200 && r.json.token, 'activated user can log in');
const tech = r.json.token;
r = await call('PUT', `/api/users/${techId}`, { role: 'superuser' }, admin);
ok(r.status === 400, 'invalid role rejected', String(r.status));
r = await call('DELETE', `/api/users/U001`, null, admin);
ok(r.status === 400, 'admin cannot delete self', String(r.status));
r = await call('PUT', `/api/users/U001`, { role: 'user' }, admin);
ok(r.status === 400, 'cannot demote the only admin', String(r.status));

// ── config: global keys, secrets ──
r = await call('PUT', '/api/config/emailConfig', { value: { smtpHost: 'smtp.x.com', smtpPort: 587, smtpUser: 'u', smtpPass: 'SECRET', senderEmail: 'a@x.com' } }, admin);
ok(r.status === 200, 'admin saves emailConfig');
r = await call('GET', '/api/config', null, admin);
ok(r.json.emailConfig?.smtpPass === 'SECRET', 'admin sees smtpPass');
r = await call('GET', '/api/config', null, tech);
ok(r.json.emailConfig?.smtpPass === '' && r.json.emailConfig?.smtpHost === 'smtp.x.com', 'non-admin gets emailConfig without secret', JSON.stringify(r.json.emailConfig));
r = await call('PUT', '/api/config/emailConfig', { value: { smtpHost: 'smtp.x.com', smtpPass: '' } }, admin);
r = await call('GET', '/api/config/emailConfig', null, admin);
ok(r.json.smtpPass === 'SECRET', 'blank secret on save keeps stored secret', JSON.stringify(r.json));
r = await call('PUT', '/api/config/scheduledNotifs', { value: { enabled: false } }, tech);
ok(r.status === 403, 'non-admin cannot write global settings', String(r.status));
r = await call('PUT', '/api/config/uiPrefs', { value: { theme: 'dark' } }, tech);
ok(r.status === 200, 'non-admin can write per-user key');

// ── orders ──
r = await call('POST', '/api/orders', { id: 'ORD-T1', materialNo: '130-001', description: 'Part A', quantity: 5, listPrice: 10, totalCost: 50, orderDate: '2026-09-17', status: 'Pending Approval', approvalStatus: 'pending', month: 'Sep 2026', year: '2026' }, tech);
ok(r.status === 201 && r.json.orderDate === '2026-09-17', 'create order; DATE returns YYYY-MM-DD', JSON.stringify(r.json));
r = await call('POST', '/api/orders', { id: 'ORD-T2', description: 'Part B', quantity: 2, orderDate: '', status: 'Pending Approval' }, tech);
ok(r.status === 201, 'create order with blank date ok', JSON.stringify(r.json));
r = await call('PUT', '/api/orders/ORD-T1', { qtyReceived: 3 }, tech);
ok(r.status === 403, 'arrival before approval blocked', String(r.status));
r = await call('PUT', '/api/orders/ORD-T1', { approvalStatus: 'approved', status: 'Approved' }, tech);
ok(r.status === 403, 'user without approvals perm cannot approve', String(r.status));
r = await call('PUT', '/api/orders/bulk-status', { ids: ['ORD-T1', 'ORD-T2'], status: 'Approved', approvalStatus: 'approved' }, tech);
ok(r.status === 403, 'bulk approve blocked without perm', String(r.status));
r = await call('PUT', '/api/orders/bulk-status', { ids: ['ORD-T1', 'ORD-T2'], status: 'Approved', approvalStatus: 'approved' }, admin);
ok(r.status === 200 && r.json.every((o) => o.approvalStatus === 'approved'), 'admin bulk approve sets approval_status', JSON.stringify(r.json).slice(0, 200));
r = await call('PUT', '/api/orders/ORD-T1', { qtyReceived: 3, backOrder: -2, arrivalDate: '2026-09-17T16:00:00.000Z' }, tech);
ok(r.status === 200 && r.json.qtyReceived === 3 && r.json.arrivalDate === '2026-09-17', 'arrival after approval; ISO timestamp normalised to date', JSON.stringify(r.json));
r = await call('DELETE', '/api/orders/ORD-T2', null, tech);
ok(r.status === 403, 'delete blocked without deleteOrders perm', String(r.status));
for (let i = 0; i < 60; i++) await call('POST', '/api/orders', { id: `ORD-P${i}`, description: 'bulk', quantity: 1, orderDate: '2026-08-01' }, admin);
r = await call('GET', '/api/orders', null, admin);
ok(r.json.data.length === 50 && r.json.total === 62, 'default page = 50 rows, total = 62', `${r.json.data?.length}/${r.json.total}`);
r = await call('GET', '/api/orders?all=true', null, admin);
ok(r.json.data.length === 62, 'all=true returns every row', String(r.json.data?.length));
r = await call('GET', '/api/orders/stats', null, tech);
ok(r.status === 200 && r.json.totals.total === 62 && Array.isArray(r.json.byMonth) && r.json.byMonth.length === 2, 'stats endpoint aggregates', JSON.stringify(r.json).slice(0, 300));

// ── approvals (JSONB order_ids) ──
r = await call('POST', '/api/pending-approvals', { id: 'APR-1', orderId: 'ORD-P1, ORD-P2', orderType: 'batch', description: 'batch', requestedBy: 'tech', quantity: 2, totalCost: 0, sentDate: '2026-09-17', status: 'pending', orderIds: ['ORD-P1', 'ORD-P2'] }, tech);
ok(r.status === 201 && Array.isArray(r.json.orderIds) && r.json.orderIds.length === 2, 'batch approval persists order_ids JSONB', JSON.stringify(r.json));
r = await call('PUT', '/api/pending-approvals/APR-1', { status: 'approved', actionDate: '2026-09-17' }, tech);
ok(r.status === 403, 'approval decision blocked without perm', String(r.status));
r = await call('PUT', '/api/pending-approvals/APR-1', { status: 'approved', actionDate: '2026-09-17' }, admin);
ok(r.status === 200 && r.json.status === 'approved', 'admin actions approval');
r = await call('GET', '/api/pending-approvals?status=pending', null, tech);
ok(r.status === 200 && r.json.data.length === 0, 'approval status filter works');

// ── machines ──
r = await call('POST', '/api/machines', { name: 'Prodigy 1', modality: 'Prodigy', installDate: '', price: '', contractEnd: '2027-01-01' }, tech);
ok(r.status === 201 && r.json.contractEnd === '2027-01-01', 'machine with blank date/price creates', JSON.stringify(r.json));
const mid = r.json.id;
r = await call('PUT', `/api/machines/${mid}`, { contractEnd: '', price: null, notes: 'x' }, tech);
ok(r.status === 200 && r.json.contractEnd === null && r.json.price === null && r.json.notes === 'x', 'machine update clears date/price', JSON.stringify(r.json));
r = await call('GET', '/api/machines?all=true', null, tech);
ok(r.json.data.length === 1, 'machines list');

// ── local inventory transactions ──
r = await call('POST', '/api/local-inventory/bulk', { items: [{ materialNo: 'M1', description: 'A', quantity: 10 }, { materialNo: '', quantity: 1 }, { materialNo: 'M2', quantity: 'abc' }] }, tech);
ok(r.status === 201 && r.json.inserted === 2 && r.json.errors.length === 1, 'bulk import: 2 inserted, 1 row error, rest committed', JSON.stringify(r.json).slice(0, 200));
r = await call('POST', '/api/local-inventory/charge-out', { items: [{ materialNo: 'M1', quantity: 4 }, { materialNo: 'NOPE', quantity: 1 }, { materialNo: 'M1', quantity: 100 }] }, tech);
ok(r.status === 200 && r.json.processed === 1 && r.json.errors.length === 2, 'charge-out: good row committed, bad rows reported', JSON.stringify(r.json).slice(0, 200));
r = await call('GET', '/api/local-inventory?all=true', null, tech);
const m1 = r.json.data.find((x) => x.materialNo === 'M1');
ok(m1?.quantity === 6, 'M1 quantity 10-4=6 persisted', String(m1?.quantity));
r = await call('POST', '/api/local-inventory/arrival', { items: [{ materialNo: 'M1', quantity: 2 }, { materialNo: 'M9', description: 'new', quantity: 3 }] }, tech);
ok(r.status === 200 && r.json.processed === 2, 'arrival upsert');
r = await call('PUT', `/api/local-inventory/${m1.id}`, { quantity: 999, description: 'renamed' }, tech);
r = await call('GET', `/api/local-inventory?all=true`, null, tech);
const m1b = r.json.data.find((x) => x.materialNo === 'M1');
ok(m1b.quantity === 8 && m1b.description === 'renamed', 'PUT cannot change quantity (8), metadata updated', JSON.stringify(m1b));
r = await call('POST', '/api/local-inventory/adjust', { items: [{ materialNo: 'M1', quantity: -3 }] }, tech);
ok(r.status === 403, 'adjust admin-only', String(r.status));
r = await call('GET', '/api/local-inventory/transactions', null, tech);
ok(r.json.total === 5, '5 inventory transactions logged (2 import, 1 charge-out, 2 arrival)', String(r.json.total));

// ── catalog / audit / misc ──
r = await call('DELETE', '/api/catalog', null, tech);
ok(r.status === 403, 'catalog wipe admin-only', String(r.status));
r = await call('POST', '/api/catalog', { parts: [{ materialNo: '130-001', description: 'Part A', sgPrice: 12 }] }, admin);
ok(r.status === 200, 'catalog upsert');
r = await call('GET', '/api/audit-log', null, tech);
ok(r.status === 403, 'audit log needs auditTrail perm', String(r.status));
r = await call('POST', '/api/whatsapp/connect', {}, tech);
ok(r.status === 403, 'whatsapp connect admin-only', String(r.status));
r = await call('POST', '/api/send-email', { to: 'a@b.c', subject: 's', html: '<p>x</p>', smtp: { host: 'evil.example', user: 'x', pass: 'y' } }, tech);
ok(r.status !== 400 || !/smtp/i.test(r.json?.error || ''), 'send-email ignores client smtp and uses stored config (fails at SMTP connect, not validation)', JSON.stringify(r.json));
r = await call('GET', '/api/nope', null, admin);
ok(r.status === 404 && r.json?.error, 'unknown api route → JSON 404', String(r.status));
r = await call('GET', '/api/orders', null, 'bad.token.here');
ok(r.status === 403, 'tampered token 403');
r = await call('GET', '/api/public/logo');
ok(r.status === 200, 'public logo');

console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
