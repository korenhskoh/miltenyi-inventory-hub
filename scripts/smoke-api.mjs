// End-to-end API smoke test. Run against a FRESH database. The first admin's
// password comes from ADMIN_PASSWORD (default 'admin123' for local runs):
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
// The seeder takes the first admin's password from ADMIN_PASSWORD; the suite
// must use the same one rather than a hard-coded default.
const ADMIN_PW = process.env.ADMIN_PASSWORD || 'admin123';
let r = await call('POST', '/api/auth/login', { username: 'admin', password: ADMIN_PW });
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
ok(r.status === 400 && /adjust/i.test(r.json?.error || ''), 'PUT rejects a quantity edit instead of silently dropping it', JSON.stringify(r.json));
r = await call('PUT', `/api/local-inventory/${m1.id}`, { description: 'renamed' }, tech);
ok(r.status === 200, 'PUT updates metadata');
r = await call('GET', `/api/local-inventory?all=true`, null, tech);
const m1b = r.json.data.find((x) => x.materialNo === 'M1');
ok(m1b.quantity === 8 && m1b.description === 'renamed', 'quantity untouched (8), description updated', JSON.stringify(m1b));
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

// ── regression guards for previously-found holes ──
r = await call('POST', '/api/local-inventory', { materialNo: 'M1', quantity: 500 }, tech);
ok(r.status === 409 && /already exists/i.test(r.json?.error || ''), 'add refuses to silently overwrite existing stock', JSON.stringify(r.json));
r = await call('GET', '/api/local-inventory?all=true', null, tech);
ok(r.json.data.find((x) => x.materialNo === 'M1').quantity === 8, 'stock still 8 after refused overwrite');
r = await call('POST', '/api/local-inventory', { materialNo: 'M-NEW', description: 'fresh', quantity: 4 }, tech);
ok(r.status === 201, 'add creates a genuinely new item');
r = await call('GET', '/api/local-inventory/transactions?materialNo=M-NEW', null, tech);
ok(r.json.total === 1, 'creating an item logs a transaction', String(r.json.total));

r = await call('POST', '/api/orders', { id: 'ORD-ESC1', description: 'escalate', quantity: 1, status: 'Approved', approvalStatus: 'approved' }, tech);
ok(r.status === 403, 'cannot create an order that is already approved', String(r.status));
r = await call('POST', '/api/orders', { id: 'ORD-ESC2', description: 'escalate', quantity: 1, status: 'Received' }, tech);
ok(r.status === 403, 'cannot create an order that is already received', String(r.status));
await call('POST', '/api/orders', { id: 'ORD-UNAPP', description: 'not approved', quantity: 1 }, tech);
r = await call('PUT', '/api/orders/ORD-UNAPP', { status: 'Received' }, tech);
ok(r.status === 403, 'cannot mark an unapproved order Received', String(r.status));
r = await call('PUT', '/api/orders/bulk-status', { ids: ['ORD-UNAPP'], status: 'Received' }, tech);
ok(r.status === 207 && r.json.length === 0, 'bulk close-out skips unapproved orders (207)', `${r.status} ${JSON.stringify(r.json)}`);
r = await call('PUT', '/api/orders/ORD-T2', { approvalStatus: 'APPROVED' }, tech);
ok(r.status === 403, 'approval check is case-insensitive (approval_status)', String(r.status));
r = await call('PUT', '/api/orders/ORD-T2', { status: 'approved' }, tech);
ok(r.status === 403, 'approval check is case-insensitive (status)', String(r.status));

r = await call('POST', '/api/audit-log', { userId: 'U001', userName: 'System Admin', action: 'delete' }, tech);
ok(r.status === 201 && r.json.userName !== 'System Admin', 'audit entries cannot forge another identity', JSON.stringify(r.json));

r = await call('PUT', '/api/config/emailConfig', { value: { smtpHost: 'smtp.x.com', smtpPass: '' } }, admin);
ok(r.status === 200 && r.json.value.smtpPass === 'SECRET', 'admin PUT echoes the kept secret');
r = await call('PUT', '/api/users/U001', { role: 'user' }, admin);
ok(r.status === 400, 'the only active admin cannot be demoted', String(r.status));
r = await call('DELETE', '/api/machines/1', null, tech);
ok(r.status === 403, 'deleting an instrument is admin-only', String(r.status));
r = await call('POST', '/api/machines/bulk', { machines: [{ name: 'x', modality: 'y' }] }, tech);
ok(r.status === 403, 'bulk instrument import is admin-only', String(r.status));
r = await call('DELETE', '/api/local-inventory/999999', null, tech);
ok(r.status === 403, 'deleting inventory is admin-only', String(r.status));

// A demoted account must lose its rights immediately, not when its token expires.
r = await call('POST', '/api/users', { username: 'admin2', password: 'pw12345', name: 'Admin Two', role: 'admin', status: 'active' }, admin);
ok(r.status === 201, 'create second admin');
const admin2Id = r.json.id;
r = await call('POST', '/api/auth/login', { username: 'admin2', password: 'pw12345' });
const admin2 = r.json.token;
r = await call('GET', '/api/users?all=true', null, admin2);
ok(r.status === 200, 'second admin can read users');
await call('PUT', `/api/users/${admin2Id}`, { role: 'user' }, admin);
r = await call('GET', '/api/users?all=true', null, admin2);
ok(r.status === 403, 'demoted admin loses access immediately with the same token', String(r.status));

// ── stock-check reconciliation (charge in / charge out / counted balance) ──
await call('POST', '/api/local-inventory/bulk', { items: [
  { materialNo: 'SC-A', description: 'Calib beads', quantity: 10 },
  { materialNo: 'SC-B', description: 'Pump head', quantity: 4 },
  { materialNo: 'SC-C', description: 'Bio tubing', quantity: 6 },
]}, admin);
const sheet = [
  { materialNo: 'SC-A', chargeIn: 5, chargeOut: 3, countedQty: 12 }, // 10+5-3=12, count agrees
  { materialNo: 'SC-B', chargeIn: 0, chargeOut: 2, countedQty: 1 },  // expected 2, counted 1 -> variance -1
  { materialNo: 'SC-C', chargeIn: 2, chargeOut: 0 },                 // movements only -> 8
  { materialNo: 'SC-NEW', description: 'Found on shelf', countedQty: 3 },
  { materialNo: 'SC-B', chargeOut: 999 },                            // impossible -> error row
];
r = await call('POST', '/api/local-inventory/reconcile', { items: sheet, dryRun: true, reference: 'Wk38' }, admin);
ok(r.status === 200 && r.json.dryRun === true, 'reconcile preview runs');
ok(r.json.rows[0].target === 12 && r.json.rows[0].variance === 0, 'preview: 10 +5 -3 = 12', JSON.stringify(r.json.rows[0]));
ok(r.json.rows[1].variance === -1 && r.json.rows[1].target === 1, 'preview: counted balance wins over expected', JSON.stringify(r.json.rows[1]));
ok(r.json.rows[2].target === 8 && r.json.rows[2].counted === null, 'preview: movements only when no count', JSON.stringify(r.json.rows[2]));
ok(r.json.rows[3].status === 'new', 'preview: unknown material flagged as new');
ok(r.json.rows[4].status === 'error', 'preview: impossible result reported, not clamped');
r = await call('GET', '/api/local-inventory?all=true', null, admin);
ok(r.json.data.find((x) => x.materialNo === 'SC-A').quantity === 10, 'preview writes nothing');

r = await call('POST', '/api/local-inventory/reconcile', { items: sheet, dryRun: false, reference: 'Wk38' }, admin);
ok(r.json.applied === 4 && r.json.created === 1 && r.json.errors === 1, 'apply: 4 applied, 1 created, 1 skipped', JSON.stringify(r.json).slice(0, 120));
r = await call('GET', '/api/local-inventory?all=true', null, admin);
const stock = (m) => r.json.data.find((x) => x.materialNo === m)?.quantity;
ok(stock('SC-A') === 12 && stock('SC-B') === 1 && stock('SC-C') === 8 && stock('SC-NEW') === 3, 'stock levels after reconcile', `${stock('SC-A')}/${stock('SC-B')}/${stock('SC-C')}/${stock('SC-NEW')}`);
r = await call('GET', '/api/local-inventory/transactions?materialNo=SC-A', null, admin);
const kinds = r.json.data.map((x) => `${x.type}:${x.quantityChange}`);
ok(kinds.includes('arrival:5') && kinds.includes('charge_out:-3'), 'charge in and charge out logged as separate movements', JSON.stringify(kinds));
r = await call('GET', '/api/local-inventory/transactions?materialNo=SC-B', null, admin);
ok(r.json.data.some((x) => x.type === 'adjustment' && x.quantityChange === -1), 'count variance logged as its own adjustment');
r = await call('POST', '/api/local-inventory/reconcile', { items: sheet, dryRun: true }, tech);
ok(r.status === 403, 'reconcile is admin-only', String(r.status));

// ── WhatsApp send/broadcast authorisation ──
// These endpoints used to require only a valid token, so any logged-in user
// could message any number from the company WhatsApp.
r = await call('PUT', `/api/users/${techId}`, { permissions: { orders: true, whatsapp: false } }, admin);
ok(r.status === 200, 'revoke whatsapp permission from tech1');
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
const techNoWa = r.json.token;

r = await call('POST', '/api/whatsapp/send', { phone: '91234567', data: { message: 'hi' } }, techNoWa);
ok(r.status === 403, 'send is refused without the whatsapp permission', String(r.status));
r = await call('POST', '/api/whatsapp/broadcast', { phones: ['91234567'], data: { message: 'hi' } }, techNoWa);
ok(r.status === 403, 'broadcast is refused without the whatsapp permission', String(r.status));
r = await call('POST', '/api/whatsapp/send', { phone: '91234567', data: { message: 'hi' } }, null);
ok(r.status === 401, 'send is refused without a token', String(r.status));

// Broadcast size cap — an unbounded list sleeps 1s per recipient.
const many = Array.from({ length: 101 }, (_, i) => `9${String(i).padStart(7, '0')}`);
r = await call('POST', '/api/whatsapp/broadcast', { phones: many, data: { message: 'hi' } }, admin);
ok(r.status === 400 && /Too many recipients/.test(r.json.error || ''), 'broadcast caps the recipient list', JSON.stringify(r.json).slice(0, 120));
r = await call('POST', '/api/whatsapp/broadcast', { phones: [], data: { message: 'hi' } }, admin);
ok(r.status === 400 && /At least one/.test(r.json.error || ''), 'broadcast rejects an empty recipient list', JSON.stringify(r.json).slice(0, 120));

// ── Service module: instrument registry, summary tiles, duplicate import ──
const dayOffset = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
await call('DELETE', '/api/machines/all', null, admin);

const fleet = [
  // contract well in the future -> Active, maintenance far off -> OK
  { name: 'gM-A', serialNumber: 'SN-A', modality: 'gM', contractEnd: dayOffset(200), nextMaintenanceDate: dayOffset(200) },
  // contract inside the 30-day window -> Expiring (must NOT also count Active)
  { name: 'gM-B', serialNumber: 'SN-B', modality: 'gM', contractEnd: dayOffset(10), nextMaintenanceDate: dayOffset(200) },
  // contract past -> Expired
  { name: 'gM-C', serialNumber: 'SN-C', modality: 'gM', contractEnd: dayOffset(-10), nextMaintenanceDate: dayOffset(200) },
  // maintenance past -> Overdue
  { name: 'gM-D', serialNumber: 'SN-D', modality: 'gM', contractEnd: dayOffset(200), nextMaintenanceDate: dayOffset(-5) },
  // maintenance soon -> Upcoming
  { name: 'gM-E', serialNumber: 'SN-E', modality: 'gM', contractEnd: dayOffset(200), nextMaintenanceDate: dayOffset(10) },
  // no contract, no maintenance date at all
  { name: 'gM-F', serialNumber: 'SN-F', modality: 'gM' },
];
r = await call('POST', '/api/machines/bulk', { machines: fleet }, admin);
ok(r.status === 201 && r.json.inserted === 6, 'six instruments imported', JSON.stringify(r.json).slice(0, 120));

r = await call('GET', '/api/machines/summary', null, admin);
const sum = r.json;
ok(sum.total === 6, 'summary counts every instrument', String(sum.total));
ok(sum.expiringContracts === 1, 'one expiring contract', String(sum.expiringContracts));
ok(sum.expiredContracts === 1, 'one expired contract', String(sum.expiredContracts));
// The bug: Active used to be contract_end >= today, so the expiring one was
// counted twice and Active came back as 4 instead of 3.
ok(sum.activeContracts === 3, 'active excludes the expiring contract', String(sum.activeContracts));
ok(sum.activeContracts + sum.expiringContracts + sum.expiredContracts === 5, 'contract tiles do not overlap', `${sum.activeContracts}+${sum.expiringContracts}+${sum.expiredContracts}`);
ok(sum.overdueMaintenance === 1, 'one overdue maintenance', String(sum.overdueMaintenance));
ok(sum.upcomingMaintenance === 1, 'one upcoming maintenance', String(sum.upcomingMaintenance));

// List filters must agree with the tiles.
r = await call('GET', '/api/machines?contractStatus=Active&all=true', null, admin);
ok(r.json.data.length === sum.activeContracts, 'Active filter matches the Active tile', `${r.json.data.length} vs ${sum.activeContracts}`);
r = await call('GET', '/api/machines?contractStatus=Expiring&all=true', null, admin);
ok(r.json.data.length === 1 && r.json.data[0].serialNumber === 'SN-B', 'Expiring filter returns the expiring instrument');
r = await call('GET', '/api/machines?maintenanceDue=None&all=true', null, admin);
ok(r.json.data.length === 1 && r.json.data[0].serialNumber === 'SN-F', 'unscheduled maintenance is its own filter', JSON.stringify(r.json.data.map((m) => m.serialNumber)));
r = await call('GET', '/api/machines?maintenanceDue=OK&all=true', null, admin);
ok(!r.json.data.some((m) => m.serialNumber === 'SN-F'), 'OK no longer includes never-scheduled instruments');

// A repeated ?all=true arrives as an array — it must still return everything.
r = await call('GET', '/api/machines?all=true&all=true', null, admin);
ok(r.json.data.length === 6, 'repeated all=true still returns every row', String(r.json.data.length));

// Re-importing the same sheet must not double the registry.
r = await call('POST', '/api/machines/bulk', { machines: fleet }, admin);
ok(r.json.inserted === 0 && r.json.skipped?.length === 6, 're-import skips known serial numbers', JSON.stringify(r.json).slice(0, 140));
r = await call('GET', '/api/machines/summary', null, admin);
ok(r.json.total === 6, 'registry size unchanged after re-import', String(r.json.total));

// Repeats inside one upload are caught too.
r = await call('POST', '/api/machines/bulk', { machines: [
  { name: 'dup', serialNumber: 'SN-NEW', modality: 'gM' },
  { name: 'dup again', serialNumber: 'SN-NEW', modality: 'gM' },
] }, admin);
ok(r.json.inserted === 1 && r.json.skipped?.length === 1, 'duplicate rows within one upload are skipped', JSON.stringify(r.json).slice(0, 140));

r = await call('POST', '/api/machines/bulk', { machines: [{ name: 'forced', serialNumber: 'SN-A', modality: 'gM' }], allowDuplicates: true }, admin);
ok(r.json.inserted === 1, 'allowDuplicates still permits an intentional re-add');

// ── Deep-review regressions ──

// Approval records for 3+ orders overflowed pending_approvals.order_id
// (VARCHAR(50)); the row was never stored and the approval silently vanished.
const longIds = ['ORD-1789911112865-ab12', 'ORD-1789911112866-cd34', 'ORD-1789911112867-ef56'];
ok(longIds.join(', ').length > 50, 'three joined order ids exceed the old 50-char column', String(longIds.join(', ').length));
r = await call('POST', '/api/pending-approvals', { id: `A-${Date.now()}`, orderId: longIds.join(', '), orderIds: longIds, orderType: 'batch', requestedBy: 'Tech One', status: 'pending' }, admin);
ok(r.status === 201, 'a 3-order batch approval is stored', JSON.stringify(r.json).slice(0, 140));

// Stock-check physical counts were dropped by the server field allow-list.
const scId = `SC-${Date.now()}`;
r = await call('POST', '/api/stock-checks', { id: scId, date: '2026-09-20', checkedBy: 'Tech One', items: 2, disc: 1, status: 'Completed', notes: 'deep review', inventory: [{ materialNo: 'X-1', system: 10, physical: 9 }, { materialNo: 'X-2', system: 5, physical: 5 }] }, admin);
ok(r.status === 201, 'stock check saved');
r = await call('GET', '/api/stock-checks?all=true', null, admin);
const saved = r.json.data.find((c) => c.id === scId);
ok(Array.isArray(saved?.inventory) && saved.inventory.length === 2, 'per-material counts survive a round trip', JSON.stringify(saved?.inventory));
ok(saved.inventory[0].physical === 9, 'the physical count itself is preserved', JSON.stringify(saved.inventory[0]));

// /adjust must be admin-only and must log the change that actually happened.
r = await call('POST', '/api/local-inventory', { materialNo: 'ADJ-1', description: 'clamp test', quantity: 2 }, admin);
ok(r.status === 201 || r.status === 409, 'adjust fixture created', String(r.status));
r = await call('POST', '/api/local-inventory/adjust', { items: [{ materialNo: 'ADJ-1', quantity: -5 }] }, admin);
ok(r.status === 200, 'admin can adjust', String(r.status));
r = await call('GET', '/api/local-inventory/transactions?materialNo=ADJ-1', null, admin);
const adj = r.json.data.find((t) => t.type === 'adjustment');
ok(adj && adj.quantityAfter === 0, 'stock clamped at zero', JSON.stringify(adj));
// The requested -5 was logged even though only -2 could happen, so replaying
// the ledger drifted permanently below the stored quantity.
ok(adj.quantityChange === -2, 'ledger records the clamped change, not the requested one', String(adj.quantityChange));

// Stock-raising endpoints must not be open to every logged-in user.
r = await call('POST', '/api/local-inventory/adjust', { items: [{ materialNo: 'ADJ-1', quantity: 99 }] }, tech);
ok(r.status === 403, 'adjust refuses a non-admin', String(r.status));
r = await call('PUT', `/api/users/${techId}`, { permissions: { orders: true, delivery: false } }, admin);
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
const techNoDelivery = r.json.token;
r = await call('POST', '/api/local-inventory/arrival', { items: [{ materialNo: 'ADJ-1', quantity: 999 }] }, techNoDelivery);
ok(r.status === 403, 'arrival refuses a user without the delivery permission', String(r.status));

// Order edits: the server enforced nothing, so anyone could rewrite any order.
r = await call('PUT', `/api/users/${techId}`, { permissions: { orders: true, delivery: true, editAllOrders: false, approvals: false } }, admin);
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
const techPlain = r.json.token;
const foreignId = `ORD-${Date.now()}-zz99`;
r = await call('POST', '/api/orders', { id: foreignId, materialNo: 'M-1', description: 'someone elses order', quantity: 2, listPrice: 100, totalCost: 200, orderBy: 'System Admin', status: 'Pending Approval', approvalStatus: 'pending' }, admin);
ok(r.status === 201, 'order created by admin', JSON.stringify(r.json).slice(0, 120));
r = await call('PUT', `/api/orders/${foreignId}`, { quantity: 500, listPrice: 0.01, totalCost: 5 }, techPlain);
ok(r.status === 403, "a user without editAllOrders cannot rewrite someone else's order", String(r.status));
const fetchOrder = async () => {
  const res = await call('GET', '/api/orders?all=true', null, admin);
  return (res.json.data || []).find((o) => o.id === foreignId);
};
let fo = await fetchOrder();
ok(Number(fo?.quantity) === 2, 'the order was left untouched', String(fo?.quantity));

// Pulling an approval back is an approval action.
r = await call('PUT', '/api/orders/bulk-status', { ids: [foreignId], status: 'Pending Approval', approvalStatus: 'pending' }, techPlain);
ok(r.status === 403, 'un-approving requires the approvals permission', String(r.status));
r = await call('PUT', `/api/orders/${foreignId}`, { approvalStatus: 'approved', status: 'Approved' }, admin);
ok(r.status === 200, 'admin approves the order');
r = await call('PUT', '/api/orders/bulk-status', { ids: [foreignId], status: 'Pending Approval', approvalStatus: 'pending' }, admin);
ok(r.status === 200, 'admin can pull the approval back');
fo = await fetchOrder();
// Reverting used to leave approval_status='approved', so the order could still
// be received and paid for after being pulled back.
ok(fo?.approvalStatus === 'pending', 'reverting clears the approval decision', String(fo?.approvalStatus));
r = await call('PUT', `/api/orders/${foreignId}`, { qtyReceived: 2, status: 'Received' }, admin);
ok(r.status === 403, 'a pulled-back order can no longer be received', String(r.status));

// A non-numeric count must not be read as a counted zero.
await call('POST', '/api/local-inventory', { materialNo: 'CNT-1', description: 'count marker', quantity: 40 }, admin);
r = await call('POST', '/api/local-inventory/reconcile', { items: [{ materialNo: 'CNT-1', countedQty: '-' }], dryRun: true }, admin);
ok(r.json.rows[0].counted === null && r.json.rows[0].target === 40, "'-' in the count column leaves stock alone", JSON.stringify(r.json.rows[0]));
r = await call('POST', '/api/local-inventory/reconcile', { items: [{ materialNo: 'CNT-1', countedQty: 'n/a' }], dryRun: true }, admin);
ok(r.json.rows[0].target === 40, "'n/a' in the count column leaves stock alone", JSON.stringify(r.json.rows[0]));
r = await call('POST', '/api/local-inventory/reconcile', { items: [{ materialNo: 'CNT-1', countedQty: 0 }], dryRun: true }, admin);
ok(r.json.rows[0].counted === 0 && r.json.rows[0].target === 0, 'a real counted zero still zeroes the item', JSON.stringify(r.json.rows[0]));

// Unhandled errors must return a string error, not an object the SPA renders.
r = await call('GET', '/api/machines/summary?region=' + encodeURIComponent('x'.repeat(200)), null, admin);
ok(typeof (r.json.error ?? '') === 'string', 'error payloads are strings, never objects', JSON.stringify(r.json).slice(0, 120));

// ── Atomic part arrival ──
// The old client-side sequence computed the delta from its own copy of
// qtyReceived and fired the inventory POST without waiting for the order
// update, so a repeat confirmation booked the stock in twice.
const arrId = `ORD-${Date.now()}-arr1`;
await call('POST', '/api/local-inventory', { materialNo: 'ARR-1', description: 'arrival test', quantity: 0 }, admin);
r = await call('POST', '/api/orders', { id: arrId, materialNo: 'ARR-1', description: 'arrival test', quantity: 5, orderBy: 'System Admin', status: 'Pending Approval', approvalStatus: 'pending' }, admin);
ok(r.status === 201, 'arrival order created', JSON.stringify(r.json).slice(0, 120));

r = await call('POST', `/api/orders/${arrId}/arrival`, { qtyReceived: 5 }, admin);
ok(r.status === 403, 'arrival refused while the order is unapproved', String(r.status));

await call('PUT', `/api/orders/${arrId}`, { approvalStatus: 'approved', status: 'Approved' }, admin);
const stockOf = async (mat) => {
  const res = await call('GET', '/api/local-inventory?all=true', null, admin);
  return res.json.data.find((x) => x.materialNo === mat)?.quantity;
};
ok((await stockOf('ARR-1')) === 0, 'stock starts at zero');

r = await call('POST', `/api/orders/${arrId}/arrival`, { qtyReceived: 5 }, admin);
ok(r.status === 200 && r.json.delta === 5, 'first confirmation books in 5', JSON.stringify(r.json).slice(0, 120));
ok((await stockOf('ARR-1')) === 5, 'stock is 5 after one confirmation', String(await stockOf('ARR-1')));

// The key regression: confirming the same figure again must change nothing.
r = await call('POST', `/api/orders/${arrId}/arrival`, { qtyReceived: 5 }, admin);
ok(r.status === 200 && r.json.delta === 0 && r.json.alreadyRecorded === true, 'a repeat confirmation is a no-op', JSON.stringify(r.json).slice(0, 120));
ok((await stockOf('ARR-1')) === 5, 'stock is still 5, not doubled', String(await stockOf('ARR-1')));

// Two concurrent confirmations of the same delivery must not both apply.
const both = await Promise.all([
  call('POST', `/api/orders/${arrId}/arrival`, { qtyReceived: 5 }, admin),
  call('POST', `/api/orders/${arrId}/arrival`, { qtyReceived: 5 }, admin),
]);
ok(both.every((x) => x.status === 200), 'concurrent confirmations both answered');
ok((await stockOf('ARR-1')) === 5, 'concurrent confirmations did not double-count', String(await stockOf('ARR-1')));

// Partial then top-up books only the difference.
const arrId2 = `ORD-${Date.now()}-arr2`;
await call('POST', '/api/orders', { id: arrId2, materialNo: 'ARR-2', description: 'partial', quantity: 10, orderBy: 'System Admin', status: 'Pending Approval', approvalStatus: 'pending' }, admin);
await call('PUT', `/api/orders/${arrId2}`, { approvalStatus: 'approved', status: 'Approved' }, admin);
r = await call('POST', `/api/orders/${arrId2}/arrival`, { qtyReceived: 4 }, admin);
ok(r.json.delta === 4 && r.json.order.status !== 'Received', 'a partial arrival does not close the order', JSON.stringify(r.json.order?.status));
r = await call('POST', `/api/orders/${arrId2}/arrival`, { qtyReceived: 10 }, admin);
ok(r.json.delta === 6, 'topping up books only the difference', String(r.json.delta));
ok((await stockOf('ARR-2')) === 10, 'stock totals 10, not 14', String(await stockOf('ARR-2')));
ok(r.json.order.status === 'Received', 'a full arrival closes the order', String(r.json.order.status));

r = await call('POST', `/api/orders/${arrId2}/arrival`, { qtyReceived: 99 }, admin);
ok(r.status === 400, 'cannot receive more than was ordered', String(r.status));
r = await call('POST', `/api/orders/${arrId2}/arrival`, { qtyReceived: 2 }, admin);
ok(r.status === 400, 'cannot silently reduce a recorded arrival', String(r.status));
// tech1's permissions were changed again after techNoDelivery was minted, and
// the permission check reads the database, so revoke it afresh here.
await call('PUT', `/api/users/${techId}`, { permissions: { orders: true, delivery: false } }, admin);
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
const techNoDelivery2 = r.json.token;
r = await call('POST', `/api/orders/${arrId2}/arrival`, { qtyReceived: 1 }, techNoDelivery2);
ok(r.status === 403, 'arrival needs the delivery permission', String(r.status));

// ── Unified metrics + service permission ──

// Back Orders must mean "delivered short", not "every order ever raised".
await call('DELETE', '/api/orders/all', null, admin);
const boBase = Date.now();
await call('POST', '/api/orders', { id: `ORD-${boBase}-bo1`, materialNo: 'BO-1', description: 'awaiting approval', quantity: 10, listPrice: 10, totalCost: 100, orderBy: 'System Admin', status: 'Pending Approval', approvalStatus: 'pending', backOrder: -10 }, admin);
await call('POST', '/api/orders', { id: `ORD-${boBase}-bo2`, materialNo: 'BO-2', description: 'rejected', quantity: 4, listPrice: 10, totalCost: 40, orderBy: 'System Admin', status: 'Rejected', approvalStatus: 'rejected', backOrder: -4 }, admin);
const shortId = `ORD-${boBase}-bo3`;
await call('POST', '/api/orders', { id: shortId, materialNo: 'BO-3', description: 'arrived short', quantity: 10, listPrice: 10, totalCost: 100, orderBy: 'System Admin', status: 'Pending Approval', approvalStatus: 'pending' }, admin);
await call('PUT', `/api/orders/${shortId}`, { approvalStatus: 'approved', status: 'Approved' }, admin);
await call('POST', `/api/orders/${shortId}/arrival`, { qtyReceived: 6, arrivalDate: '2026-09-20' }, admin);

r = await call('GET', '/api/orders/stats', null, admin);
// Old definition (back_order < 0) counted all three, including one never
// approved and one rejected. Only the short delivery is a back order.
ok(r.json.totals.backOrders === 1, 'back orders counts only the short delivery', String(r.json.totals.backOrders));

// Total Value must match the effective price the pages and emails use.
await call('POST', '/api/catalog', { parts: [{ materialNo: 'NOPRICE-1', description: 'priced only in catalog', sgPrice: 25 }] }, admin);
await call('POST', '/api/orders', { id: `ORD-${boBase}-np`, materialNo: 'NOPRICE-1', description: 'saved before catalog', quantity: 4, listPrice: 0, totalCost: 0, orderBy: 'System Admin', status: 'Pending Approval', approvalStatus: 'pending' }, admin);
r = await call('GET', '/api/orders/stats', null, admin);
// Stored total_cost is 0, so the dashboard used to report S$0 for this order
// while All Orders and the approval email showed 4 x 25 = 100.
ok(r.json.totals.totalValue >= 100, 'total value uses the catalog fallback like the pages do', String(r.json.totals.totalValue));

// Service permission must actually gate instrument writes.
r = await call('PUT', `/api/users/${techId}`, { permissions: { orders: true, service: false } }, admin);
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
const techNoService = r.json.token;
r = await call('POST', '/api/machines', { name: 'sneaky', modality: 'gM', serialNumber: 'SVC-X' }, techNoService);
ok(r.status === 403, 'creating an instrument needs the service permission', String(r.status));
r = await call('GET', '/api/machines?all=true', null, admin);
const anyMachine = r.json.data[0];
r = await call('PUT', `/api/machines/${anyMachine.id}`, { customerName: 'hijacked' }, techNoService);
ok(r.status === 403, 'editing an instrument needs the service permission', String(r.status));
r = await call('PUT', `/api/users/${techId}`, { permissions: { orders: true, service: true } }, admin);
r = await call('POST', '/api/auth/login', { username: 'tech1', password: 'pw12345' });
const techService = r.json.token;
r = await call('POST', '/api/machines', { name: 'allowed', modality: 'gM', serialNumber: 'SVC-OK' }, techService);
ok(r.status === 201, 'a user with the service permission can still work', String(r.status));

// ── Self-service password change ──
// There was no route for this at all, so a seeded password could only be
// changed by an admin editing the user record.
r = await call('POST', '/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'brandnewpw1' }, admin);
ok(r.status === 401, 'the current password must be proved', String(r.status));
r = await call('POST', '/api/auth/change-password', { currentPassword: ADMIN_PW, newPassword: 'short' }, admin);
ok(r.status === 400, 'a too-short password is refused', String(r.status));
r = await call('POST', '/api/auth/change-password', { currentPassword: ADMIN_PW, newPassword: ADMIN_PW }, admin);
ok(r.status === 400, 'reusing the same password is refused', String(r.status));
r = await call('POST', '/api/auth/change-password', { currentPassword: ADMIN_PW, newPassword: 'brandnewpw1' }, admin);
ok(r.status === 200, 'the password changes', JSON.stringify(r.json));
r = await call('POST', '/api/auth/login', { username: 'admin', password: ADMIN_PW });
ok(r.status === 401, 'the old password no longer works', String(r.status));
r = await call('POST', '/api/auth/login', { username: 'admin', password: 'brandnewpw1' });
ok(r.status === 200 && r.json.token, 'the new password works');
ok(r.json.user.mustChangePassword === false, 'the change-password flag is cleared', String(r.json.user.mustChangePassword));
r = await call('POST', '/api/auth/change-password', { currentPassword: 'brandnewpw1', newPassword: ADMIN_PW }, r.json.token);
ok(r.status === 200, 'restored for the rest of the suite');

// ── AI provider configuration ──
r = await call('GET', '/api/ai/providers', null, admin);
ok(r.status === 200 && r.json.providers?.length >= 3, 'provider catalog lists every adapter', JSON.stringify(r.json.providers?.map((p) => p.id)));
ok(r.json.providers.every((p) => p.defaultModel && p.label), 'each provider describes itself for the settings UI');
ok(r.json.config.provider === 'openai', 'openai is the default provider', String(r.json.config.provider));

// A key must be storable and then NEVER readable back — not through the AI
// route, and not through the generic config API either.
r = await call('PUT', '/api/config/aiBotConfig', { value: { provider: 'openai', model: 'gpt-4o-mini', apiKeys: { openai: 'sk-super-secret-value' } } }, admin);
ok(r.status === 200, 'ai config saved', String(r.status));
ok(!JSON.stringify(r.json).includes('sk-super-secret-value'), 'the save response does not echo the key back');

r = await call('GET', '/api/config/aiBotConfig', null, admin);
ok(!JSON.stringify(r.json).includes('sk-super-secret-value'), 'config API never returns the key, even to an admin', JSON.stringify(r.json).slice(0, 150));
ok(r.json.hasKey?.openai === true, 'but it does report that a key is set', JSON.stringify(r.json.hasKey));

r = await call('GET', '/api/config', null, admin);
ok(!JSON.stringify(r.json).includes('sk-super-secret-value'), 'the bulk config listing does not leak it either');

r = await call('GET', '/api/ai/providers', null, admin);
ok(!JSON.stringify(r.json).includes('sk-super-secret-value'), 'the AI route does not leak it either');
ok(r.json.config.hasKey.openai === true, 'the AI route reports the key as set');

// Saving other settings must not wipe the stored key.
r = await call('PUT', '/api/config/aiBotConfig', { value: { provider: 'openai', model: 'gpt-4o', temperature: 0.5 } }, admin);
r = await call('GET', '/api/ai/providers', null, admin);
ok(r.json.config.hasKey.openai === true, 'a settings save preserves the stored key', JSON.stringify(r.json.config.hasKey));
ok(r.json.config.model === 'gpt-4o', 'and still applies the new setting', String(r.json.config.model));

// A second provider's key is stored alongside, not instead of, the first.
r = await call('PUT', '/api/config/aiBotConfig', { value: { provider: 'openai', apiKeys: { anthropic: 'sk-ant-second' } } }, admin);
r = await call('GET', '/api/ai/providers', null, admin);
ok(r.json.config.hasKey.openai === true && r.json.config.hasKey.anthropic === true, 'keys are kept per provider', JSON.stringify(r.json.config.hasKey));

// Authorisation.
r = await call('GET', '/api/ai/providers', null, techPlain);
ok(r.status === 403, 'provider settings need the aiBot permission', String(r.status));
r = await call('POST', '/api/ai/test', {}, techPlain);
ok(r.status === 403, 'testing a provider is admin-only', String(r.status));
r = await call('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'hi' }] }, null);
ok(r.status === 401, 'the assistant needs a login', String(r.status));
r = await call('POST', '/api/ai/chat', { messages: [] }, admin);
ok(r.status === 400, 'the assistant rejects an empty conversation', String(r.status));

// ── The shared bot engine behind both surfaces ──
// The in-app assistant used to carry its own regex copy of four intents while
// the WhatsApp bot had ~20 on the server. Both now go through /api/ai/ask.
r = await call('POST', '/api/ai/ask', { message: 'help' }, admin);
ok(r.status === 200 && /help|command/i.test(r.json.text || ''), 'the assistant answers from the shared engine', String(r.json.text).slice(0, 80));

r = await call('POST', '/api/ai/ask', { message: 'list orders' }, admin);
ok(r.status === 200 && (r.json.text || '').length > 0, 'it can list orders — an intent the old in-app engine never had', String(r.json.text).slice(0, 60));

r = await call('POST', '/api/ai/ask', { message: 'approvals' }, admin);
ok(r.status === 200, 'and approvals, likewise new to the in-app assistant', String(r.status));

// With no provider configured the fallback must stay silent and the original
// rule-based reply must come through unchanged.
await call('PUT', '/api/config/aiBotConfig', { value: { provider: 'openai', enabled: false } }, admin);
r = await call('POST', '/api/ai/ask', { message: 'what is the weather in singapore' }, admin);
ok(r.status === 200 && /didn't understand|help/i.test(r.json.text || ''), 'with no model configured it falls back to the rule-based reply', String(r.json.text).slice(0, 60));

r = await call('POST', '/api/ai/ask', { message: '' }, admin);
ok(r.status === 400, 'an empty question is rejected', String(r.status));
r = await call('POST', '/api/ai/ask', { message: 'x'.repeat(5000) }, admin);
ok(r.status === 400, 'an oversized question is rejected', String(r.status));
r = await call('POST', '/api/ai/ask', { message: 'help' }, null);
ok(r.status === 401, 'the assistant needs a login', String(r.status));

console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
