# Miltenyi Inventory Hub — Full Bug Review (17 Sep 2026)

Repo: `korenhskoh/miltenyi-inventory-hub` @ `56e5b05` (main). Fix branch: `fix/bug-review-2026-09` (2 commits, 37 files).
Baseline before fixes: build OK, **5 lint errors**, **8 failing tests**. After fixes: build OK, **0 lint errors**, **100/100 tests pass**.

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

## NOT fixed — decide before adding features

1. **Approval authority isn't enforced server-side.** Any logged-in user can `PUT /api/orders/:id {approvalStatus:'approved'}` or `PUT /api/pending-approvals/:id`. If approvals must be admin/approver-only, add a role/permission check in `orders.js` and `approvals.js` (I left it because the intended approver model — email keywords vs. in-app role — isn't clear from the code).
2. **Per-order delete / bulk-group delete / stock-check delete** are open to every user (only the "delete all" variants are admin-only). Same question as above.
3. **Per-keystroke PUTs in Edit Bulk Order** (`updateOrderField`) — every keystroke sends a request; responses can land out of order. Should edit a local draft and save once (also lets you block edits to already-approved groups).
4. **Unreachable Order Detail modal** (`setSelectedOrder` is never called with an order) contains an inverted back-order sign and a call that always 403s. Delete it or fix and re-enable.
5. **Quick Compose "Send" and Order-detail Email/WhatsApp buttons** still fake success (hard-coded recipient, no send).
6. **"Today" is computed in UTC** in ~30 places (`toISOString().slice(0,10)`) → between 00:00–08:00 SGT the order/arrival date is yesterday. Add a `todayLocal()` helper and replace.
7. **`App.jsx` is 12.6k lines** in one file with all state at the top; most of the bugs above came from three copies of the same logic drifting apart (arrival, pricing, approvals). Before adding features, extract at least: pricing (`getEffectivePrice`), arrival/back-order maths, approval state transitions, and the data-loading layer.
8. **Everything is loaded client-side** (`all=true`) — fine at current volumes (hundreds of orders) but the dashboard/analytics should move to server aggregates before the catalog/orders grow into the tens of thousands.
9. **JWT_SECRET / FRONTEND_URL** must be set in production (the server only warns). Check Railway env.
10. `client-side user cache in localStorage` (`mih_users`, orders, etc.) still persists business data on shared machines; consider dropping the localStorage fallback entirely now that registration/login go through the API.
