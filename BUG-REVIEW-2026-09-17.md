# Miltenyi Inventory Hub — Full Bug Review (17 Sep 2026)

Repo: `korenhskoh/miltenyi-inventory-hub` @ `56e5b05` (main). Fix branch: `fix/bug-review-2026-09` (5 commits, 52 files).
Baseline before fixes: build OK, **5 lint errors**, **8 failing tests**. After fixes: build OK, **0 lint errors**, **128/128 tests pass** (28 new unit tests).

## How to apply

```bash
git checkout main
git fetch /path/to/miltenyi-bug-fixes.bundle fix/bug-review-2026-09:fix/bug-review-2026-09
git checkout fix/bug-review-2026-09     # review, then merge / open a PR
# or:  git am miltenyi-bug-fixes.patch
```

On first deploy the server runs a one-off repair (`initDb.js`): settings that Settings had been saving per-user (schedule, email, logo, price config…) are promoted to the global row the server actually reads. **Re-check Settings → Email / Scheduled Reports once after deploying.**

---

## CRITICAL (fixed)

| # | Bug | Where | Effect |
|---|-----|-------|--------|
| 1 | **User registration never worked.** `INSERT INTO users` had no `id` (VARCHAR PK, no default) and `name` is NOT NULL → every register was a 500; the client hid it and said "Registration Submitted". | `server/routes/auth.js` | Nobody could self-register; pending list only existed in the registering browser's memory. |
| 2 | **Every list capped at 50 rows.** Server paginates (default 50); client only ever read page 1. Orders, bulk groups, users, approvals, stock checks, audit log, local inventory. | `server/pagination.js`, all list routes, `src/api.js` | With >50 orders: dashboard totals wrong, old approved orders vanish from Part Arrival, bulk-group tallies written back wrong, and `recalcBulkGroupForMonths` **deleted bulk groups from the DB** because it saw 0 loaded orders for them. Fixed with `?all=true` on wholesale loads. |
| 3 | **Settings the server reads were saved to the wrong row.** Only `aiBotConfig`/`waAutoReply` were global; `scheduledNotifs`, `emailConfig`, `customLogo`, etc. were saved per-user while the scheduler / logo endpoint / bot read `__global__`. | `server/routes/config.js` | Scheduled-report settings never took effect (seed default = weekly email to *all active users* stayed on); logo never showed on login; SMTP config invisible to the scheduler. |
| 4 | **Batch/bulk approvals never persisted.** `order_ids` (JSONB) was sent as a JS array → pg serialises it as a Postgres array literal → invalid JSON → 500. Also the approve/reject handlers didn't pass `approval_status`. | `server/routes/approvals.js`, `src/App.jsx` | Approvals existed only locally; after reload orders were still `pending` and arrival recording returned 403. |
| 5 | **WhatsApp bot accepted commands from anyone.** No sender check; the bot can create/delete orders and approve requests. Also replied inside group chats, and generated order ids from `COUNT(*)` (collide after any delete). | `server/index.js`, `server/waBotCommands.js` | Anyone who messaged the number could delete orders. Now: direct chats only, sender must be in Allowed Senders or an active user's phone; timestamp ids; batch approvals resolve all order ids. |
| 6 | **Part arrival double-counted local inventory.** The cumulative `qtyReceived` was added to stock on every confirm/update (`quantity = quantity + $4`). | `src/App.jsx` `confirmArrival` / `batchConfirmArrival` | Confirm 3 then update to 5 → stock +8. Now only the delta is added. |
| 7 | **"Transactions" weren't transactions.** `BEGIN`/`COMMIT` were issued through the pool, so statements ran on different connections; a failing row aborted everything silently while the API reported success. | `server/db.js`, `local-inventory.js`, `catalog.js` | Charge-out / bulk import / adjust could lose already-processed rows. Now one client + per-row SAVEPOINTs. |

## HIGH (fixed)

- **Stored XSS → token theft**: order description/remark/orderBy were interpolated unescaped into `document.write` (PDF export) and into approver emails. Any user could plant `<img onerror=…>` that runs with an admin's JWT on export. Escaped everywhere (`escapeHtml` in `src/utils.js`).
- **Open mail relay**: `/api/send-email` accepted SMTP host+credentials from the client body. Now uses the stored admin config; client block only honoured for admins.
- **Secrets leaked to every user**: `/api/config` returned `emailConfig.smtpPass` and `aiBotConfig.apiKey` to non-admins; the SPA also persisted `smtpPass` to localStorage. Stripped server-side; blank secret on save keeps the stored value.
- **Hard-coded offline admin login** (`admin123`) granted admin UI + cached data whenever the API was unreachable. Removed.
- **Plaintext passwords in React state / localStorage** (`_newPassword`, `temp123` fallbacks). Stripped.
- **Expired session never logged out**: server returned 403 on expiry, client only handled 401 → every action failed with "Save Failed" forever. Expired → 401 now.
- **Login rate limit shared by the whole office**: behind Railway `req.ip` is the proxy → 20 attempts / 15 min for everyone. `trust proxy` set.
- **DATE columns came back as UTC timestamps** → date inputs rendered blank, dates drifted a day on re-save, approval text tables misaligned. `pg` type parser now returns `YYYY-MM-DD`.
- **Machines**: blank Install Date → 500 but UI toasted "Machine Added"; clearing a date/price could never be saved (`pickAllowed` dropped nulls). Fixed (sanitise on create, allow null on update).
- **Local Inventory**: Edit/Delete visible to all users and `PUT` silently changed quantity with no transaction log; "Add" overwrote existing stock. Edit/Delete admin-only; quantity only via Adjust.
- **WhatsApp connect/disconnect** (wipes the saved session) was open to any user → admin-only.
- **Catalog wipe / bulk upsert** open to any user → admin-only.
- **Excel history import**: Date cells became `String(Date)` → every row 500'd after being shown locally; auto-created bulk groups were never linked; ids from `.length` collided. Fixed.
- **Pending registrations** now come from the DB (visible to every admin); approve/reject act on the real row.
- **Stock Check**: advertised .xlsx but parsed as CSV text; Cancel left an orphan "In Progress" row; ids collided after deletes; Download did nothing. Fixed.
- **Delivery page**: "Email Report" faked success — now sends via SMTP; hard-coded fallback phone `+65 9111 2222` removed; null-safe descriptions; page reset on filter change.
- **Forecasting**: month labels off by two and hard-coded `'26`; growth factor uncapped.
- **AllOrders**: row totals used today's catalog price while the footer used stored `totalCost` → never added up. Stored price preferred.
- **WhatsApp page**: template edits were discarded on send; "Send Now" toasted success without sending; connect poll fired "QR Expired" after a successful scan; QR fallback component drew random pixels.
- **AI-bot orders** used status `'Pending'` (invisible in every tab/stat) → `'Pending Approval'`.
- **User admin**: role accepted any string; could delete self / demote the last admin. Server validation added.
- Unknown `/api/*` routes now return JSON 404 (previously served the SPA or hung in API-only mode); body limit raised to 15 MB so 7.5–10 MB FCA PDFs (base64) don't 413; `migrate.js` config upsert used a non-existent unique key.

## Tests / lint

- 8 stale tests (expected arrays, server returns `{data,total,…}`) updated; 1 updated for 401-on-expiry; 4 client tests updated for `?all=true`.
- 3 `react-hooks/set-state-in-effect` errors restructured (ServicePage), `btoa` global, empty block. 0 errors remain (≈90 pre-existing unused-var / exhaustive-deps warnings left as-is).

## Follow-up round — all previously open items now fixed

1. **Approval authority enforced server-side.** New `server/middleware/permissions.js` reads `users.permissions` (same keys as the UI's `DEFAULT_USER_PERMS`; admins implicit; 30 s cache, invalidated on user edits). Approving/rejecting orders, bulk-status, bulk groups and pending approvals requires `approvals`; global settings require `settings` (`aiBot` for the AI-bot config); the audit log requires `auditTrail`.
2. **Per-record deletes** require `deleteOrders` / `deleteBulkOrders` / `deleteStockChecks` / `deleteNotifications` (the UI already hid the buttons — the API now agrees).
3. **Edit Bulk Order** keeps a local draft and saves once per changed order on Save; approved groups are read-only unless admin / `editAllBulkOrders`; items added to an approved group start as *Pending Approval*.
4. **Unreachable Order Detail modal deleted** (it carried an inverted back-order sign and a call that always 403'd).
5. **Quick Compose** and the Delivery page **Email / WhatsApp report** buttons perform real sends and toast the real result; hard-coded recipients removed.
6. **Local calendar dates** everywhere via `src/lib/dates.js` (`todayLocal`, `normalizeDate`, …) — no more UTC day shift between 00:00–08:00 SGT.
7. **First extraction step out of `App.jsx`**: `src/lib/pricing.js`, `arrival.js`, `approvals.js`, `dates.js` replace nine duplicated price reducers, three arrival-maths copies and the mirrored approve/reject branches; each has unit tests. *Behaviour note:* dashboard/analytics/approval-email totals now use the **stored order price** (falling back to the catalog only when the stored price is 0), so they finally agree with the All Orders footer and `orders.total_cost`.
8. **Server aggregates**: `GET /api/orders/stats` (totals, per-month series, top materials) feeds the dashboard headline tiles; charts still use the client data.
9. **Config fail-fast**: production boot exits with a clear message when `JWT_SECRET` is missing; `.env.example` documents `JWT_SECRET`, `FRONTEND_URL`, `TRUST_PROXY_HOPS`.
10. **localStorage no longer caches business data or config** (orders, users, approvals, SMTP config, …). Only the token, the last-seen user for the pre-load render, and UI preferences remain. An unreachable server shows the login screen with a clear message instead of stale cached data.

## Verification round

- Server booted against a fresh PostgreSQL 16 and exercised with `scripts/smoke-api.mjs` (47 end-to-end checks: registration → activation → permissions, orders/approvals/JSONB, config secrets, machines date handling, inventory transactions with savepoints, stats, catalog/audit/WhatsApp guards) — **all pass**.
- Built SPA driven in headless Chromium as admin and as a non-admin: login, module picker and all 14 pages render with **no page errors and no API 5xx**. The loader no longer requests the admin-only user list / audit log for users who lack the permission (was two harmless 403s per load).

## Still worth doing (not bugs)

- `App.jsx` is still ~11k lines. The next extraction candidates are the data-loading layer (`loadAppData`/`refreshPageData`) and the approval-email builders.
- Permissions in the JWT vs. DB: the server looks permissions up from the DB (fresh within 30 s), which is safer than baking them into the token; if you later want zero DB hits, add them to the token and re-issue on change.
- Set `FRONTEND_URL` on Railway so CORS stops reflecting any origin.
