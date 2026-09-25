import { useState, Fragment } from 'react';
import { CheckCircle, AlertCircle, Clock, AlertTriangle, Mail, MessageSquare, Check } from 'lucide-react';
import { fmt, fmtDate, applySortData, toggleSort, fillTemplate, escapeHtml } from '../utils.js';
import { Pill, ArrivalBadge, ExportDropdown, SortTh } from '../components/ui.jsx';
import api from '../api.js';
import { todayLocal } from '../lib/dates.js';
import Pagination, { usePaginationState, paginate } from '../components/Pagination.jsx';
import { arrivalCondition } from '../lib/arrival.js';
import { SectionHeader, useCollapsed } from '../components/CollapsibleSection.jsx';

/**
 * Send an arrival report via the server-side mailer (SMTP config is stored server-side).
 * Recipient is the configured approver email (falls back to sender email).
 * Returns { ok, to, error }.
 */
const sendArrivalReportEmail = async (apiClient, { subject, title, summary, verifiedBy }) => {
  const cfg = await apiClient.getConfigKey('emailConfig');
  const to = cfg?.approverEmail || cfg?.senderEmail || '';
  if (!to)
    return { ok: false, to, error: 'No recipient configured — set an approver or sender email in Settings → Email' };
  const html =
    `<h3>${escapeHtml(title)}</h3>` +
    `<p>Date: ${escapeHtml(new Date().toLocaleDateString('en-SG'))}<br/>Verified by: ${escapeHtml(verifiedBy || 'Admin')}</p>` +
    `<pre style="font-family:monospace;font-size:12px">${escapeHtml(summary)}</pre>`;
  const r = await apiClient.sendEmail({ to, subject, html });
  return { ok: !!r?.ok, to, error: r?.error };
};

/**
 * Send a WhatsApp message to every active non-admin user with a phone number via the
 * WhatsApp bridge. Returns { sent, failed, to } so callers can report real results.
 */
const sendArrivalWhatsApp = async (apiClient, waApiUrl, users, message) => {
  const recipients = (users || []).filter((u) => u.role !== 'admin' && u.status === 'active' && u.phone);
  const results = await Promise.all(
    recipients.map(async (user) => {
      try {
        const res = await fetch(`${waApiUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiClient.getToken()}` },
          body: JSON.stringify({ phone: user.phone, template: 'custom', data: { message } }),
        });
        if (!res.ok) return false;
        const body = await res.json().catch(() => ({}));
        return body?.success !== false && body?.ok !== false;
      } catch {
        return false;
      }
    }),
  );
  const sent = results.filter(Boolean).length;
  return { sent, failed: results.length - sent, to: recipients.length };
};

const DeliveryPage = ({
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
}) => {
  // Sort state for single/bulk arrival tables (default: newest approved first)
  const [singleArrivalSort, setSingleArrivalSort] = useState({ key: 'approvalSentDate', dir: 'desc' });
  const [bulkArrivalSort, setBulkArrivalSort] = useState({ key: 'approvalSentDate', dir: 'desc' });
  // Sort state for bulk group rows (table header sort)
  const [bulkGroupSort, setBulkGroupSort] = useState({ key: 'approvedDate', dir: 'desc' });
  const [arrivalCheckedByFilter, setArrivalCheckedByFilter] = useState('All');

  // The three tables fold away, and remember it. Collapsed by default: the page
  // stacks three long tables and you almost never want all of them at once.
  const bulkSection = useCollapsed('arrival-bulk');
  const singleSection = useCollapsed('arrival-single');
  const allSection = useCollapsed('arrival-all');

  // Each table returns to page 1 whenever one of these filters changes.
  const filterKey = [
    arrivalMonthFilter,
    arrivalOrderByFilter,
    arrivalCheckedByFilter,
    arrivalStatusFilter,
    arrivalTypeFilter,
  ].join('|');
  const bulkPager = usePaginationState({ storageKey: 'delivery-bulk', initialSize: 25, resetKey: filterKey });
  const singlePager = usePaginationState({ storageKey: 'delivery-single', initialSize: 25, resetKey: filterKey });
  const allPager = usePaginationState({ storageKey: 'delivery-all', initialSize: 50, resetKey: filterKey });

  // Unique list of users who have checked arrivals
  const arrivalCheckedByUsers = [
    ...new Set(orders.filter((o) => o.arrivalCheckedBy).map((o) => o.arrivalCheckedBy)),
  ].sort();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#64748B' }}>
          Check and verify material arrivals from single orders and bulk batches
        </p>
      </div>

      {/* Stats Cards — approved orders only, respects month filter */}
      {(() => {
        const ao = orders.filter(
          (o) =>
            o.approvalStatus === 'approved' &&
            (arrivalMonthFilter === 'All' || o.month === arrivalMonthFilter) &&
            (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter) &&
            (arrivalCheckedByFilter === 'All' || o.arrivalCheckedBy === arrivalCheckedByFilter),
        );
        return (
          <div
            className="grid-4"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}
          >
            {[
              // One shared definition, so these three now sum to the table
              // below instead of quietly dropping the rows that fell between
              // them.
              {
                l: 'Awaiting Arrival',
                v: ao.filter((o) => arrivalCondition(o) === 'Awaiting').length,
                c: '#D97706',
              },
              {
                l: 'Fully Received',
                v: ao.filter((o) => arrivalCondition(o) === 'Arrived').length,
                c: '#0B7A3E',
              },
              {
                l: 'Back Order',
                v: ao.filter((o) => arrivalCondition(o) === 'Back Order').length,
                c: '#DC2626',
              },
              {
                l: 'Items Pending',
                v: ao.reduce((s, o) => {
                  const diff = o.quantity - (o.qtyReceived || 0);
                  return s + (diff > 0 ? diff : 0);
                }, 0),
                c: '#7C3AED',
              },
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
        );
      })()}

      {/* Month & User Filter for Part Arrival */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Month</span>
        <select
          value={arrivalMonthFilter}
          onChange={(e) => setArrivalMonthFilter(e.target.value)}
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
          {[
            ...new Set(
              [
                ...orders.filter((o) => o.approvalStatus === 'approved').map((o) => o.month),
                ...bulkGroups
                  .filter(
                    (g) =>
                      g.status === 'Approved' ||
                      orders.some((o) => o.bulkGroupId === g.id && o.approvalStatus === 'approved'),
                  )
                  .map((g) => g.month),
              ].filter(Boolean),
            ),
          ]
            .sort()
            .map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
        </select>
        <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Order By</span>
        <select
          value={arrivalOrderByFilter}
          onChange={(e) => setArrivalOrderByFilter(e.target.value)}
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
              My Orders (
              {orders.filter((o) => o.approvalStatus === 'approved' && o.orderBy === currentUser.name).length})
            </option>
          )}
          {arrivalOrderByUsers
            .filter((u) => u !== currentUser?.name)
            .map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
        </select>
        <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Checked By</span>
        <select
          value={arrivalCheckedByFilter}
          onChange={(e) => setArrivalCheckedByFilter(e.target.value)}
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
          <option value="All">All</option>
          {arrivalCheckedByUsers.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Orders to Check — only approved */}
      {(() => {
        const filteredBulkGroups = bulkGroups.filter((bg) => {
          const bgOrds = orders.filter((o) => o.bulkGroupId === bg.id);
          const hasApproved = bgOrds.some((o) => o.approvalStatus === 'approved');
          if (!hasApproved) return false;
          if (arrivalMonthFilter !== 'All' && bg.month !== arrivalMonthFilter) return false;
          if (arrivalOrderByFilter !== 'All' && !bgOrds.some((o) => o.orderBy === arrivalOrderByFilter)) return false;
          if (arrivalCheckedByFilter !== 'All' && !bgOrds.some((o) => o.arrivalCheckedBy === arrivalCheckedByFilter))
            return false;
          return true;
        });

        // Enrich bulk groups with computed fields for sorting.
        //
        // Two populations, deliberately kept apart. `_bgOrders` is what the
        // expanded table shows and what the Order By / Checked By dropdowns
        // filter — a view. `_allOrders` is the batch itself, and it is what any
        // statement ABOUT the batch has to be computed from.
        //
        // Conflating the two was the bug: the progress pill, the item count and
        // Mark Complete all ran over the filtered, approved-only subset. An
        // imported batch of 30 rows with 12 received and 18 still outstanding
        // rendered as "12 items, 12/12 received" with a green tick, and Mark
        // Complete closed the whole batch and sent a "Part Arrival Verified,
        // Back Orders: 0" message for 18 parts that never arrived. Narrowing a
        // dropdown made it worse, because the subset shrank again.
        const enriched = filteredBulkGroups.map((bg) => {
          const allOrds = orders.filter((o) => o.bulkGroupId === bg.id);
          const bgOrds = allOrds.filter(
            (o) =>
              o.approvalStatus === 'approved' &&
              (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter) &&
              (arrivalCheckedByFilter === 'All' || o.arrivalCheckedBy === arrivalCheckedByFilter),
          );
          const fullyReceived = allOrds.filter((o) => o.qtyReceived >= o.quantity && o.quantity > 0).length;
          const hasBackOrder = allOrds.some((o) => (o.qtyReceived || 0) > 0 && (o.qtyReceived || 0) < o.quantity);
          // Latest approval date from the group's orders
          const approvedDate = bgOrds.reduce((latest, o) => {
            if (!o.approvalSentDate) return latest;
            return !latest || o.approvalSentDate > latest ? o.approvalSentDate : latest;
          }, null);
          return {
            ...bg,
            _bgOrders: bgOrds,
            _allOrders: allOrds,
            _itemCount: allOrds.length,
            _shownCount: bgOrds.length,
            _fullyReceived: fullyReceived,
            _hasBackOrder: hasBackOrder,
            approvedDate,
          };
        });

        const sorted = applySortData(enriched, bulkGroupSort);
        const bulkView = paginate(sorted, bulkPager.page, bulkPager.pageSize);
        const bulkPageItems = bulkView.pageItems;
        return (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
            <SectionHeader
              title="Bulk Orders - Arrival Verification"
              count={sorted.length}
              countLabel={sorted.length === 1 ? 'batch' : 'batches'}
              collapsed={bulkSection.collapsed}
              onToggle={bulkSection.toggle}
              style={{ marginBottom: bulkSection.collapsed ? 0 : 16 }}
            />
            {bulkSection.collapsed ? null : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB' }}>
                      <th className="th" style={{ width: 36 }}></th>
                      <SortTh
                        label="Group ID"
                        sortKey="id"
                        sortCfg={bulkGroupSort}
                        onSort={(k) => toggleSort(setBulkGroupSort, k)}
                      />
                      <SortTh
                        label="Month"
                        sortKey="month"
                        sortCfg={bulkGroupSort}
                        onSort={(k) => toggleSort(setBulkGroupSort, k)}
                      />
                      <SortTh
                        label="Items"
                        sortKey="_itemCount"
                        sortCfg={bulkGroupSort}
                        onSort={(k) => toggleSort(setBulkGroupSort, k)}
                        style={{ width: 70 }}
                      />
                      <SortTh
                        label="Total Cost"
                        sortKey="totalCost"
                        sortCfg={bulkGroupSort}
                        onSort={(k) => toggleSort(setBulkGroupSort, k)}
                      />
                      <SortTh
                        label="Approved"
                        sortKey="approvedDate"
                        sortCfg={bulkGroupSort}
                        onSort={(k) => toggleSort(setBulkGroupSort, k)}
                      />
                      <th className="th" style={{ width: 120 }}>
                        Progress
                      </th>
                      <th className="th" style={{ width: 110 }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPageItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>
                          No bulk groups match the selected filters
                        </td>
                      </tr>
                    ) : (
                      bulkPageItems.map((bg) => {
                        const bgOrders = bg._bgOrders;
                        const allOrders = bg._allOrders;
                        const fullyReceived = bg._fullyReceived;
                        const hasBackOrder = bg._hasBackOrder;
                        // Counted over the whole batch. Counting it over `bgOrders`
                        // — which is already filtered to approved — made this
                        // permanently 0, so the "not yet approved" warning below
                        // could never appear however many rows were waiting.
                        const unapprovedCount = allOrders.filter((o) => o.approvalStatus !== 'approved').length;
                        const isExpanded = selectedBulkForArrival === bg.id;
                        return (
                          <Fragment key={bg.id}>
                            <tr
                              style={{
                                borderBottom: '1px solid #F0F2F5',
                                background: isExpanded ? '#E6F4ED' : 'transparent',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                setSelectedBulkForArrival(isExpanded ? null : bg.id);
                                setArrivalItems(bgOrders);
                              }}
                            >
                              <td className="td" style={{ textAlign: 'center' }}>
                                {fullyReceived === allOrders.length ? (
                                  <CheckCircle size={16} color="#059669" />
                                ) : hasBackOrder ? (
                                  <AlertCircle size={16} color="#DC2626" />
                                ) : (
                                  <Clock size={16} color="#D97706" />
                                )}
                              </td>
                              <td className="td mono" style={{ fontSize: 11, fontWeight: 600, color: '#4338CA' }}>
                                {bg.id}
                              </td>
                              <td className="td" style={{ fontWeight: 600 }}>
                                {bg.month}
                              </td>
                              <td className="td" style={{ textAlign: 'center', fontWeight: 600 }}>
                                {allOrders.length}
                              </td>
                              <td className="td mono" style={{ fontSize: 11 }}>
                                <span className="pv">{fmt(bg.totalCost)}</span>
                              </td>
                              <td
                                className="td"
                                style={{ fontSize: 11, color: bg.approvedDate ? '#1A202C' : '#94A3B8' }}
                              >
                                {bg.approvedDate ? fmtDate(bg.approvedDate) : '\u2014'}
                              </td>
                              <td className="td">
                                <Pill
                                  bg={
                                    fullyReceived === allOrders.length
                                      ? '#D1FAE5'
                                      : hasBackOrder
                                        ? '#FEE2E2'
                                        : '#FEF3C7'
                                  }
                                  color={
                                    fullyReceived === allOrders.length
                                      ? '#059669'
                                      : hasBackOrder
                                        ? '#DC2626'
                                        : '#D97706'
                                  }
                                >
                                  {fullyReceived}/{allOrders.length} received
                                </Pill>
                              </td>
                              <td className="td" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className={isExpanded ? 'bp' : 'bs'}
                                  onClick={() => {
                                    setSelectedBulkForArrival(isExpanded ? null : bg.id);
                                    setArrivalItems(bgOrders);
                                  }}
                                  style={{ padding: '5px 12px', fontSize: 11 }}
                                >
                                  {isExpanded ? 'Hide' : 'Check Items'}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Items List */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={8} style={{ padding: 0 }}>
                                  <div
                                    style={{
                                      padding: '16px 20px',
                                      background: '#F8FAFB',
                                      borderBottom: '2px solid #E2E8F0',
                                    }}
                                  >
                                    {unapprovedCount > 0 && (
                                      <div
                                        style={{
                                          padding: '10px 16px',
                                          background: '#FEF3C7',
                                          border: '1px solid #FDE68A',
                                          borderRadius: 8,
                                          marginBottom: 12,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          fontSize: 12,
                                          color: '#92400E',
                                        }}
                                      >
                                        <AlertTriangle size={16} />
                                        <span>
                                          <strong>{unapprovedCount} order(s)</strong> not yet approved — arrival inputs
                                          disabled until approved.
                                        </span>
                                      </div>
                                    )}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                      <thead>
                                        <tr style={{ background: '#F8FAFB' }}>
                                          <th className="th" style={{ width: 30 }}>
                                            <input
                                              type="checkbox"
                                              checked={
                                                bgOrders.every((o) => arrivalSelected.has(o.id)) && bgOrders.length > 0
                                              }
                                              onChange={(e) => {
                                                const ids = bgOrders.map((o) => o.id);
                                                setArrivalSelected((prev) => {
                                                  const next = new Set(prev);
                                                  if (e.target.checked) ids.forEach((id) => next.add(id));
                                                  else ids.forEach((id) => next.delete(id));
                                                  return next;
                                                });
                                              }}
                                            />
                                          </th>
                                          <SortTh
                                            label="Material No."
                                            sortKey="materialNo"
                                            sortCfg={bulkArrivalSort}
                                            onSort={(k) => toggleSort(setBulkArrivalSort, k)}
                                          />
                                          <SortTh
                                            label="Description"
                                            sortKey="description"
                                            sortCfg={bulkArrivalSort}
                                            onSort={(k) => toggleSort(setBulkArrivalSort, k)}
                                          />
                                          <SortTh
                                            label="Order By"
                                            sortKey="orderBy"
                                            sortCfg={bulkArrivalSort}
                                            onSort={(k) => toggleSort(setBulkArrivalSort, k)}
                                            style={{ width: 100 }}
                                          />
                                          <SortTh
                                            label="Approved"
                                            sortKey="approvalSentDate"
                                            sortCfg={bulkArrivalSort}
                                            onSort={(k) => toggleSort(setBulkArrivalSort, k)}
                                            style={{ width: 90 }}
                                          />
                                          <SortTh
                                            label="Ordered"
                                            sortKey="quantity"
                                            sortCfg={bulkArrivalSort}
                                            onSort={(k) => toggleSort(setBulkArrivalSort, k)}
                                            style={{ width: 70 }}
                                          />
                                          <th className="th" style={{ width: 80 }}>
                                            Received
                                          </th>
                                          <th className="th" style={{ width: 70 }}>
                                            B/O
                                          </th>
                                          <th className="th" style={{ width: 90 }}>
                                            Checked By
                                          </th>
                                          <th className="th" style={{ width: 100 }}>
                                            Status
                                          </th>
                                          <th className="th" style={{ width: 120 }}>
                                            Action
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {applySortData(bgOrders, bulkArrivalSort).map((o, idx) => {
                                          const pv = pendingArrival[o.id];
                                          const dispQty = pv ? pv.qtyReceived : o.qtyReceived || 0;
                                          const dispBO = pv
                                            ? pv.qtyReceived - o.quantity
                                            : (o.qtyReceived || 0) - o.quantity;
                                          const hasPending = !!pv;
                                          // Whether pressing Confirm would record
                                          // anything. It used to key off the
                                          // arrival DATE alone, so an imported row
                                          // that had fully arrived but had no date
                                          // in the sheet showed a bright primary
                                          // Confirm button beside a "2/2 Arrived"
                                          // pill — work that looked outstanding and
                                          // was not.
                                          // Enabled only when pressing it would
                                          // record something. Confirm writes the
                                          // number in the box, so with no change
                                          // typed there is nothing to book in — the
                                          // server no-ops a zero delta and the
                                          // client now refuses it outright. Keying
                                          // off the arrival DATE instead, as this
                                          // did, produced both wrong answers: a
                                          // bright Confirm on a row that had fully
                                          // arrived with no date in the sheet, and
                                          // a greyed-out "Confirmed" on a live back
                                          // order, which read as finished work.
                                          const canConfirm = hasPending && pv.qtyReceived > (o.qtyReceived || 0);
                                          return (
                                            <tr
                                              key={o.id}
                                              style={{
                                                borderBottom: '1px solid #F0F2F5',
                                                background: hasPending ? '#FFFBEB' : 'transparent',
                                              }}
                                            >
                                              <td className="td">
                                                <input
                                                  type="checkbox"
                                                  checked={arrivalSelected.has(o.id)}
                                                  onChange={(e) => {
                                                    setArrivalSelected((prev) => {
                                                      const next = new Set(prev);
                                                      if (e.target.checked) next.add(o.id);
                                                      else next.delete(o.id);
                                                      return next;
                                                    });
                                                  }}
                                                />
                                              </td>
                                              <td
                                                className="td mono"
                                                style={{ fontSize: 11, color: '#0B7A3E', fontWeight: 600 }}
                                              >
                                                {o.materialNo || '\u2014'}
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
                                              <td className="td" style={{ fontSize: 11 }}>
                                                {o.orderBy || '\u2014'}
                                              </td>
                                              <td
                                                className="td"
                                                style={{
                                                  fontSize: 11,
                                                  color: o.approvalSentDate ? '#1A202C' : '#94A3B8',
                                                }}
                                              >
                                                {o.approvalSentDate ? fmtDate(o.approvalSentDate) : '\u2014'}
                                              </td>
                                              <td className="td" style={{ textAlign: 'center', fontWeight: 600 }}>
                                                {o.quantity}
                                              </td>
                                              <td className="td" style={{ textAlign: 'center' }}>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max={o.quantity}
                                                  value={dispQty}
                                                  disabled={o.approvalStatus !== 'approved'}
                                                  title={
                                                    o.approvalStatus !== 'approved'
                                                      ? 'Order must be approved first'
                                                      : ''
                                                  }
                                                  onChange={(e) => {
                                                    const val = Math.max(
                                                      0,
                                                      Math.min(o.quantity, parseInt(e.target.value) || 0),
                                                    );
                                                    setPendingArrival((prev) => ({
                                                      ...prev,
                                                      [o.id]: { qtyReceived: val, backOrder: val - o.quantity },
                                                    }));
                                                  }}
                                                  style={{
                                                    width: 50,
                                                    padding: '4px 6px',
                                                    textAlign: 'center',
                                                    borderRadius: 6,
                                                    border: hasPending ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                                                    fontSize: 12,
                                                    opacity: o.approvalStatus !== 'approved' ? 0.5 : 1,
                                                    cursor: o.approvalStatus !== 'approved' ? 'not-allowed' : 'text',
                                                  }}
                                                />
                                              </td>
                                              <td
                                                className="td"
                                                style={{
                                                  textAlign: 'center',
                                                  fontWeight: 600,
                                                  color: dispBO < 0 ? '#DC2626' : '#059669',
                                                }}
                                              >
                                                {dispBO < 0 ? dispBO : '\u2713'}
                                              </td>
                                              <td className="td" style={{ fontSize: 11, color: '#64748B' }}>
                                                {o.arrivalCheckedBy || '\u2014'}
                                              </td>
                                              <td className="td">
                                                <Pill
                                                  bg={
                                                    arrivalCondition(o) === 'Arrived'
                                                      ? '#D1FAE5'
                                                      : arrivalCondition(o) === 'Back Order'
                                                        ? '#FEE2E2'
                                                        : '#FEF3C7'
                                                  }
                                                  color={
                                                    arrivalCondition(o) === 'Arrived'
                                                      ? '#059669'
                                                      : arrivalCondition(o) === 'Back Order'
                                                        ? '#DC2626'
                                                        : '#D97706'
                                                  }
                                                >
                                                  {`${o.qtyReceived || 0}/${o.quantity} ${arrivalCondition(o)}`}
                                                </Pill>
                                              </td>
                                              <td className="td">
                                                <button
                                                  className={canConfirm ? 'bp' : 'bs'}
                                                  disabled={!canConfirm}
                                                  title={
                                                    canConfirm
                                                      ? ''
                                                      : arrivalCondition(o) === 'Arrived'
                                                        ? 'Fully received'
                                                        : 'Enter the quantity received first'
                                                  }
                                                  onClick={() => confirmArrival(o.id)}
                                                  style={{
                                                    padding: '4px 10px',
                                                    fontSize: 11,
                                                    borderRadius: 6,
                                                    opacity: canConfirm ? 1 : 0.4,
                                                    cursor: canConfirm ? 'pointer' : 'default',
                                                  }}
                                                >
                                                  {hasPending
                                                    ? o.arrivalDate
                                                      ? 'Update'
                                                      : 'Confirm'
                                                    : arrivalCondition(o) === 'Arrived'
                                                      ? '\u2713 Done'
                                                      : o.arrivalDate
                                                        ? 'Confirmed'
                                                        : 'Confirm'}
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>

                                    {/* Batch Confirm + Notify Actions */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: 10,
                                        marginTop: 16,
                                        paddingTop: 16,
                                        borderTop: '1px solid #E8ECF0',
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      {(() => {
                                        const selIds = bgOrders
                                          .filter((o) => arrivalSelected.has(o.id) && o.status !== 'Received')
                                          .map((o) => o.id);
                                        return selIds.length > 0 ? (
                                          <button
                                            className="bp"
                                            onClick={() => batchConfirmArrival(selIds)}
                                            style={{
                                              padding: '8px 16px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                            }}
                                          >
                                            <CheckCircle size={14} /> Batch Confirm ({selIds.length} selected)
                                          </button>
                                        ) : null;
                                      })()}
                                      <button
                                        className="be"
                                        onClick={async () => {
                                          const summary = bgOrders
                                            .map(
                                              (o) =>
                                                `\u2022 ${o.materialNo}: ${o.qtyReceived}/${o.quantity} ${o.qtyReceived >= o.quantity ? '\u2713' : '(B/O: ' + (o.quantity - o.qtyReceived) + ')'}`,
                                            )
                                            .join('\n');
                                          const subject = `Arrival Check: ${bg.month}`;
                                          const r = await sendArrivalReportEmail(api, {
                                            subject,
                                            title: `Arrival Check: ${bg.month}`,
                                            summary,
                                            verifiedBy: currentUser?.name,
                                          });
                                          if (r.ok)
                                            notify(
                                              'Email Sent',
                                              `Arrival report for ${bg.month} sent to ${r.to}`,
                                              'success',
                                            );
                                          else
                                            notify('Email Failed', r.error || 'Could not send arrival report', 'error');
                                          addNotifEntry({
                                            id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                            type: 'email',
                                            to: r.to || '\u2014',
                                            subject,
                                            date: todayLocal(),
                                            status: r.ok ? 'Sent' : 'Failed',
                                          });
                                        }}
                                      >
                                        <Mail size={14} /> Email Report
                                      </button>
                                      {waConnected ? (
                                        <button
                                          className="bw"
                                          onClick={async () => {
                                            // The batch, not the filtered view —
                                            // this message tells someone what
                                            // arrived, and it was counting only the
                                            // rows currently on screen.
                                            const received = allOrders.filter(
                                              (o) => o.quantity > 0 && (o.qtyReceived || 0) >= o.quantity,
                                            ).length;
                                            const backorder = allOrders.length - received;
                                            const itemsList =
                                              allOrders
                                                .slice(0, 5)
                                                .map(
                                                  (o) =>
                                                    `\u2022 ${(o.description || '').slice(0, 30)}: ${o.qtyReceived}/${o.quantity}`,
                                                )
                                                .join('\n') +
                                              (allOrders.length > 5 ? `\n...and ${allOrders.length - 5} more` : '');
                                            const arrMsg = fillTemplate(
                                              waMessageTemplates.partArrival?.message ||
                                                '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}',
                                              {
                                                month: bg.month,
                                                totalItems: allOrders.length,
                                                received,
                                                backOrders: backorder,
                                                verifiedBy: currentUser?.name || 'Admin',
                                                date: todayLocal(),
                                                itemsList,
                                              },
                                            );
                                            if (!waNotifyRules.partArrivalDone) {
                                              notify(
                                                'Rule Disabled',
                                                'Enable "Part Arrival" in WhatsApp notification rules first',
                                                'warning',
                                              );
                                              return;
                                            }
                                            const r = await sendArrivalWhatsApp(api, WA_API_URL, users, arrMsg);
                                            if (r.to === 0) {
                                              notify('No Recipients', 'No active users with a phone number', 'warning');
                                              return;
                                            }
                                            if (r.failed === 0)
                                              notify(
                                                'WhatsApp Sent',
                                                `Arrival report for ${bg.month} sent to ${r.sent} user(s)`,
                                                'success',
                                              );
                                            else if (r.sent > 0)
                                              notify(
                                                'Partial Send',
                                                `${r.sent}/${r.to} WhatsApp messages sent`,
                                                'warning',
                                              );
                                            else notify('WhatsApp Failed', 'Failed to send WhatsApp', 'error');
                                            addNotifEntry({
                                              id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                              type: 'whatsapp',
                                              to: 'SG Service Team',
                                              subject: `Arrival: ${bg.month} - ${received} full, ${backorder} B/O`,
                                              date: todayLocal(),
                                              status: r.failed === 0 ? 'Delivered' : r.sent > 0 ? 'Partial' : 'Failed',
                                            });
                                          }}
                                        >
                                          <MessageSquare size={14} /> WhatsApp Report
                                        </button>
                                      ) : (
                                        <button
                                          className="bs"
                                          onClick={() => {
                                            setPage('whatsapp');
                                            notify('Connect WhatsApp', 'Please scan QR code first', 'info');
                                          }}
                                          style={{ opacity: 0.7 }}
                                        >
                                          <MessageSquare size={14} /> WhatsApp (Not Connected)
                                        </button>
                                      )}
                                      <button
                                        className="bp"
                                        onClick={async () => {
                                          // The whole batch, not the filtered view,
                                          // and quantity 0 does not count as
                                          // received — `0 >= 0` was letting a row
                                          // with a blank quantity cell close a
                                          // batch out.
                                          const outstanding = allOrders.filter(
                                            (o) => !(o.quantity > 0 && (o.qtyReceived || 0) >= o.quantity),
                                          );
                                          if (outstanding.length > 0) {
                                            notify(
                                              'Not Fully Received',
                                              `${outstanding.length} of ${allOrders.length} order(s) in ${bg.month} are still outstanding — the first is ${
                                                outstanding[0].materialNo ||
                                                outstanding[0].description ||
                                                'an unnamed row'
                                              }.`,
                                              'warning',
                                            );
                                          }
                                          const allReceived = outstanding.length === 0;
                                          if (allReceived) {
                                            setBulkGroups((prev) =>
                                              prev.map((g) => (g.id === bg.id ? { ...g, status: 'Completed' } : g)),
                                            );
                                            dbSync(
                                              api.updateBulkGroup(bg.id, { status: 'Completed' }),
                                              'Bulk group completion not saved',
                                            );
                                            notify(
                                              'Arrival Complete',
                                              `${bg.month} marked as fully received`,
                                              'success',
                                            );
                                            if (waConnected && waNotifyRules.partArrivalDone) {
                                              try {
                                                const completeItemsList =
                                                  allOrders
                                                    .slice(0, 5)
                                                    .map(
                                                      (o) =>
                                                        `\u2022 ${(o.description || '').slice(0, 30)}: ${o.qtyReceived}/${o.quantity}`,
                                                    )
                                                    .join('\n') +
                                                  (allOrders.length > 5 ? `\n...and ${allOrders.length - 5} more` : '');
                                                const completeMsg = fillTemplate(
                                                  waMessageTemplates.partArrival?.message ||
                                                    '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}',
                                                  {
                                                    month: bg.month,
                                                    totalItems: allOrders.length,
                                                    received: allOrders.length,
                                                    backOrders: 0,
                                                    verifiedBy: currentUser?.name || 'Admin',
                                                    date: todayLocal(),
                                                    itemsList: completeItemsList,
                                                  },
                                                );
                                                const creatorPhone = users.find((u) => u.name === bg.createdBy)?.phone;
                                                if (!creatorPhone) {
                                                  notify(
                                                    'WhatsApp Skipped',
                                                    `${bg.createdBy || 'Creator'} has no phone number on file`,
                                                    'warning',
                                                  );
                                                } else {
                                                  await fetch(`${WA_API_URL}/send`, {
                                                    method: 'POST',
                                                    headers: {
                                                      'Content-Type': 'application/json',
                                                      Authorization: `Bearer ${api.getToken()}`,
                                                    },
                                                    body: JSON.stringify({
                                                      phone: creatorPhone,
                                                      template: 'custom',
                                                      data: { message: completeMsg },
                                                    }),
                                                  });
                                                }
                                              } catch (e) {
                                                /* ignore */
                                              }
                                            }
                                          } else {
                                            notify(
                                              'Incomplete',
                                              `${bgOrders.filter((o) => o.qtyReceived < o.quantity).length} items still pending`,
                                              'error',
                                            );
                                          }
                                        }}
                                      >
                                        <CheckCircle size={14} /> Mark Complete
                                      </button>
                                      <button className="bs" onClick={() => setSelectedBulkForArrival(null)}>
                                        Close
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
                {/* Bulk pagination */}
                {bulkView.total > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 12,
                      paddingTop: 14,
                      borderTop: '1px solid #E8ECF0',
                      marginTop: 14,
                    }}
                  >
                    <Pagination {...bulkPager} {...bulkView} unit="groups" />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Single Orders - Arrival Verification */}
      {(() => {
        const indivOrders = orders.filter(
          (o) =>
            !o.bulkGroupId &&
            o.approvalStatus === 'approved' &&
            o.quantity > 0 &&
            (arrivalMonthFilter === 'All' || o.month === arrivalMonthFilter) &&
            (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter) &&
            (arrivalCheckedByFilter === 'All' || o.arrivalCheckedBy === arrivalCheckedByFilter),
        );
        if (!indivOrders.length) return null;
        const singleSorted = applySortData(indivOrders, singleArrivalSort);
        const singleView = paginate(singleSorted, singlePager.page, singlePager.pageSize);
        return (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
            <SectionHeader
              title="Single Orders - Arrival Verification"
              count={indivOrders.length}
              countLabel={indivOrders.length === 1 ? 'order' : 'orders'}
              collapsed={singleSection.collapsed}
              onToggle={singleSection.toggle}
              style={{ marginBottom: singleSection.collapsed ? 0 : 16 }}
            />
            {singleSection.collapsed ? null : (
              <>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  {indivOrders.length} approved individual order(s) not part of any bulk group
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFB' }}>
                      <th className="th" style={{ width: 30 }}>
                        {(() => {
                          const items = singleView.pageItems;
                          return (
                            <input
                              type="checkbox"
                              checked={items.every((o) => arrivalSelected.has(o.id)) && items.length > 0}
                              onChange={(e) => {
                                const ids = items.map((o) => o.id);
                                setArrivalSelected((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) ids.forEach((id) => next.add(id));
                                  else ids.forEach((id) => next.delete(id));
                                  return next;
                                });
                              }}
                            />
                          );
                        })()}
                      </th>
                      <SortTh
                        label="Material No."
                        sortKey="materialNo"
                        sortCfg={singleArrivalSort}
                        onSort={(k) => toggleSort(setSingleArrivalSort, k)}
                      />
                      <SortTh
                        label="Description"
                        sortKey="description"
                        sortCfg={singleArrivalSort}
                        onSort={(k) => toggleSort(setSingleArrivalSort, k)}
                      />
                      <SortTh
                        label="Order By"
                        sortKey="orderBy"
                        sortCfg={singleArrivalSort}
                        onSort={(k) => toggleSort(setSingleArrivalSort, k)}
                        style={{ width: 100 }}
                      />
                      <SortTh
                        label="Approved"
                        sortKey="approvalSentDate"
                        sortCfg={singleArrivalSort}
                        onSort={(k) => toggleSort(setSingleArrivalSort, k)}
                        style={{ width: 90 }}
                      />
                      <SortTh
                        label="Ordered"
                        sortKey="quantity"
                        sortCfg={singleArrivalSort}
                        onSort={(k) => toggleSort(setSingleArrivalSort, k)}
                        style={{ width: 70 }}
                      />
                      <th className="th" style={{ width: 80 }}>
                        Received
                      </th>
                      <th className="th" style={{ width: 70 }}>
                        B/O
                      </th>
                      <th className="th" style={{ width: 90 }}>
                        Checked By
                      </th>
                      <th className="th" style={{ width: 100 }}>
                        Status
                      </th>
                      <th className="th" style={{ width: 120 }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleView.pageItems.map((o) => {
                      const pv = pendingArrival[o.id];
                      const dispQty = pv ? pv.qtyReceived : o.qtyReceived || 0;
                      const dispBO = pv ? pv.qtyReceived - o.quantity : (o.qtyReceived || 0) - o.quantity;
                      const hasPending = !!pv;
                      const canConfirm = hasPending && pv.qtyReceived > (o.qtyReceived || 0);
                      return (
                        <tr
                          key={o.id}
                          style={{
                            borderBottom: '1px solid #F0F2F5',
                            background: hasPending ? '#FFFBEB' : 'transparent',
                          }}
                        >
                          <td className="td">
                            <input
                              type="checkbox"
                              checked={arrivalSelected.has(o.id)}
                              onChange={(e) => {
                                setArrivalSelected((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(o.id);
                                  else next.delete(o.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="td mono" style={{ fontSize: 11, color: '#0B7A3E', fontWeight: 600 }}>
                            {o.materialNo || '\u2014'}
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
                          <td className="td" style={{ fontSize: 11 }}>
                            {o.orderBy || '\u2014'}
                          </td>
                          <td
                            className="td"
                            style={{ fontSize: 11, color: o.approvalSentDate ? '#1A202C' : '#94A3B8' }}
                          >
                            {o.approvalSentDate ? fmtDate(o.approvalSentDate) : '\u2014'}
                          </td>
                          <td className="td" style={{ textAlign: 'center', fontWeight: 600 }}>
                            {o.quantity}
                          </td>
                          <td className="td" style={{ textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              max={o.quantity}
                              value={dispQty}
                              disabled={o.approvalStatus !== 'approved'}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(o.quantity, parseInt(e.target.value) || 0));
                                setPendingArrival((prev) => ({
                                  ...prev,
                                  [o.id]: { qtyReceived: val, backOrder: val - o.quantity },
                                }));
                              }}
                              style={{
                                width: 50,
                                padding: '4px 6px',
                                textAlign: 'center',
                                borderRadius: 6,
                                border: hasPending ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                                fontSize: 12,
                              }}
                            />
                          </td>
                          <td
                            className="td"
                            style={{ textAlign: 'center', fontWeight: 600, color: dispBO < 0 ? '#DC2626' : '#059669' }}
                          >
                            {dispBO < 0 ? dispBO : '\u2713'}
                          </td>
                          <td className="td" style={{ fontSize: 11, color: '#64748B' }}>
                            {o.arrivalCheckedBy || '\u2014'}
                          </td>
                          <td className="td">
                            <Pill
                              bg={
                                arrivalCondition(o) === 'Arrived'
                                  ? '#D1FAE5'
                                  : arrivalCondition(o) === 'Back Order'
                                    ? '#FEE2E2'
                                    : '#FEF3C7'
                              }
                              color={
                                arrivalCondition(o) === 'Arrived'
                                  ? '#059669'
                                  : arrivalCondition(o) === 'Back Order'
                                    ? '#DC2626'
                                    : '#D97706'
                              }
                            >
                              {`${o.qtyReceived || 0}/${o.quantity} ${arrivalCondition(o)}`}
                            </Pill>
                          </td>
                          <td className="td">
                            <button
                              className={canConfirm ? 'bp' : 'bs'}
                              disabled={!canConfirm}
                              title={
                                canConfirm
                                  ? ''
                                  : arrivalCondition(o) === 'Arrived'
                                    ? 'Fully received'
                                    : 'Enter the quantity received first'
                              }
                              onClick={() => confirmArrival(o.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: 11,
                                borderRadius: 6,
                                opacity: canConfirm ? 1 : 0.4,
                                cursor: canConfirm ? 'pointer' : 'default',
                              }}
                            >
                              {hasPending
                                ? o.arrivalDate
                                  ? 'Update'
                                  : 'Confirm'
                                : arrivalCondition(o) === 'Arrived'
                                  ? '\u2713 Done'
                                  : o.arrivalDate
                                    ? 'Confirmed'
                                    : 'Confirm'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Single Orders pagination */}
                <Pagination {...singlePager} {...singleView} unit="orders" />
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid #E8ECF0',
                    flexWrap: 'wrap',
                  }}
                >
                  {(() => {
                    const selIds = indivOrders
                      .filter((o) => arrivalSelected.has(o.id) && o.status !== 'Received')
                      .map((o) => o.id);
                    return selIds.length > 0 ? (
                      <button
                        className="bp"
                        onClick={() => batchConfirmArrival(selIds)}
                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <CheckCircle size={14} /> Batch Confirm ({selIds.length} selected)
                      </button>
                    ) : null;
                  })()}
                  <button
                    className="be"
                    onClick={async () => {
                      const summary = indivOrders
                        .map(
                          (o) =>
                            `\u2022 ${o.materialNo}: ${o.qtyReceived || 0}/${o.quantity} ${(o.qtyReceived || 0) >= o.quantity ? '\u2713' : '(B/O: ' + (o.quantity - (o.qtyReceived || 0)) + ')'}`,
                        )
                        .join('\n');
                      const subject = 'Arrival Check: Individual Orders';
                      const r = await sendArrivalReportEmail(api, {
                        subject,
                        title: subject,
                        summary,
                        verifiedBy: currentUser?.name,
                      });
                      if (r.ok) notify('Email Sent', `Individual orders arrival report sent to ${r.to}`, 'success');
                      else notify('Email Failed', r.error || 'Could not send arrival report', 'error');
                      addNotifEntry({
                        id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        type: 'email',
                        to: r.to || '\u2014',
                        subject,
                        date: todayLocal(),
                        status: r.ok ? 'Sent' : 'Failed',
                      });
                    }}
                  >
                    <Mail size={14} /> Email Report
                  </button>
                  {waConnected ? (
                    <button
                      className="bw"
                      onClick={async () => {
                        const received = indivOrders.filter((o) => (o.qtyReceived || 0) >= o.quantity).length;
                        const backorder = indivOrders.filter((o) => (o.qtyReceived || 0) < o.quantity).length;
                        const itemsList =
                          indivOrders
                            .slice(0, 5)
                            .map(
                              (o) =>
                                `\u2022 ${(o.description || '').slice(0, 30)}: ${o.qtyReceived || 0}/${o.quantity}`,
                            )
                            .join('\n') + (indivOrders.length > 5 ? `\n...and ${indivOrders.length - 5} more` : '');
                        const arrMsg = fillTemplate(
                          waMessageTemplates.partArrival?.message ||
                            '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}',
                          {
                            month: 'Single Orders',
                            totalItems: indivOrders.length,
                            received,
                            backOrders: backorder,
                            verifiedBy: currentUser?.name || 'Admin',
                            date: todayLocal(),
                            itemsList,
                          },
                        );
                        if (!waNotifyRules.partArrivalDone) {
                          notify(
                            'Rule Disabled',
                            'Enable "Part Arrival" in WhatsApp notification rules first',
                            'warning',
                          );
                          return;
                        }
                        const r = await sendArrivalWhatsApp(api, WA_API_URL, users, arrMsg);
                        if (r.to === 0) {
                          notify('No Recipients', 'No active users with a phone number', 'warning');
                          return;
                        }
                        if (r.failed === 0)
                          notify('WhatsApp Sent', `Single orders arrival report sent to ${r.sent} user(s)`, 'success');
                        else if (r.sent > 0)
                          notify('Partial Send', `${r.sent}/${r.to} WhatsApp messages sent`, 'warning');
                        else notify('WhatsApp Failed', 'Failed to send WhatsApp', 'error');
                        addNotifEntry({
                          id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          type: 'whatsapp',
                          to: 'SG Service Team',
                          subject: `Arrival: Single Orders - ${received} full, ${backorder} B/O`,
                          date: todayLocal(),
                          status: r.failed === 0 ? 'Delivered' : r.sent > 0 ? 'Partial' : 'Failed',
                        });
                      }}
                    >
                      <MessageSquare size={14} /> WhatsApp Report
                    </button>
                  ) : (
                    <button
                      className="bs"
                      onClick={() => {
                        setPage('whatsapp');
                        notify('Connect WhatsApp', 'Please scan QR code first', 'info');
                      }}
                      style={{ opacity: 0.7 }}
                    >
                      <MessageSquare size={14} /> WhatsApp (Not Connected)
                    </button>
                  )}
                  <button
                    className="bp"
                    onClick={async () => {
                      const allReceived = indivOrders.every((o) => (o.qtyReceived || 0) >= o.quantity);
                      if (allReceived) {
                        notify('All Arrived', 'All single orders marked as fully received', 'success');
                        if (waConnected && waNotifyRules.partArrivalDone) {
                          try {
                            const complItemsList =
                              indivOrders
                                .slice(0, 5)
                                .map(
                                  (o) =>
                                    `\u2022 ${(o.description || '').slice(0, 30)}: ${o.qtyReceived || 0}/${o.quantity}`,
                                )
                                .join('\n') + (indivOrders.length > 5 ? `\n...and ${indivOrders.length - 5} more` : '');
                            const complMsg = fillTemplate(
                              waMessageTemplates.partArrival?.message ||
                                '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}',
                              {
                                month: 'Single Orders',
                                totalItems: indivOrders.length,
                                received: indivOrders.length,
                                backOrders: 0,
                                verifiedBy: currentUser?.name || 'Admin',
                                date: todayLocal(),
                                itemsList: complItemsList,
                              },
                            );
                            for (const user of users.filter(
                              (u) => u.role !== 'admin' && u.status === 'active' && u.phone,
                            )) {
                              await fetch(`${WA_API_URL}/send`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${api.getToken()}`,
                                },
                                body: JSON.stringify({
                                  phone: user.phone,
                                  template: 'custom',
                                  data: { message: complMsg },
                                }),
                              });
                            }
                          } catch (e) {
                            /* ignore */
                          }
                        }
                      } else {
                        notify(
                          'Incomplete',
                          `${indivOrders.filter((o) => (o.qtyReceived || 0) < o.quantity).length} items still pending`,
                          'warning',
                        );
                      }
                    }}
                  >
                    <CheckCircle size={14} /> Mark All Complete
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* All Orders - Arrival Status (approved orders only) */}
      {(() => {
        const statusTabs = ['All', 'Awaiting', 'Back Order', 'Arrived'];
        const typeTabs = ['All', 'Bulk', 'Single'];
        const approvedAll = orders.filter(
          (o) =>
            o.approvalStatus === 'approved' &&
            (arrivalMonthFilter === 'All' || o.month === arrivalMonthFilter) &&
            (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter) &&
            (arrivalCheckedByFilter === 'All' || o.arrivalCheckedBy === arrivalCheckedByFilter),
        );
        const approvedOrders =
          arrivalTypeFilter === 'Bulk'
            ? approvedAll.filter((o) => o.bulkGroupId)
            : arrivalTypeFilter === 'Single'
              ? approvedAll.filter((o) => !o.bulkGroupId)
              : approvedAll;
        const getArrivalCond = arrivalCondition;
        const arrivalFiltered =
          arrivalStatusFilter === 'All'
            ? approvedOrders
            : approvedOrders.filter((o) => getArrivalCond(o) === arrivalStatusFilter);
        const arrivalPriority = { 'Back Order': 0, Awaiting: 1, Arrived: 2 };
        const arrivalSorted = arrivalSort.key
          ? applySortData(arrivalFiltered, arrivalSort)
          : [...arrivalFiltered].sort(
              (a, b) => (arrivalPriority[getArrivalCond(a)] ?? 9) - (arrivalPriority[getArrivalCond(b)] ?? 9),
            );
        const allView = paginate(arrivalSorted, allPager.page, allPager.pageSize);
        const allPageItems = allView.pageItems;
        return (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: allSection.collapsed ? 'none' : '1px solid #E8ECF0',
              }}
            >
              <SectionHeader
                title="All Orders - Arrival Status"
                count={arrivalSorted.length}
                countLabel={arrivalSorted.length === 1 ? 'order' : 'orders'}
                collapsed={allSection.collapsed}
                onToggle={allSection.toggle}
                style={{ marginBottom: allSection.collapsed ? 0 : 12 }}
                actions={
                  <ExportDropdown
                    data={arrivalSorted}
                    columns={[
                      { key: 'id', label: 'Order ID' },
                      { key: 'materialNo', label: 'Material No' },
                      { key: 'description', label: 'Description' },
                      { key: 'quantity', label: 'Qty Ordered' },
                      { key: 'qtyReceived', label: 'Qty Received', fmt: (v) => v || 0 },
                      { key: 'backOrder', label: 'Back Order', fmt: (v, row) => (row.qtyReceived || 0) - row.quantity },
                      { key: 'arrivalDate', label: 'Arrival Date', fmt: (v) => fmtDate(v) },
                      { key: 'arrivalCheckedBy', label: 'Checked By' },
                      { key: 'status', label: 'Status' },
                    ]}
                    filename="part-arrival"
                    title="Part Arrival - Arrival Status"
                  />
                }
              />
              {allSection.collapsed ? null : (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {typeTabs.map((t) => {
                      const cnt =
                        t === 'All'
                          ? approvedAll.length
                          : t === 'Bulk'
                            ? approvedAll.filter((o) => o.bulkGroupId).length
                            : approvedAll.filter((o) => !o.bulkGroupId).length;
                      return (
                        <button
                          key={t}
                          onClick={() => {
                            setArrivalTypeFilter(t);
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 20,
                            border: arrivalTypeFilter === t ? 'none' : '1px solid #E2E8F0',
                            background:
                              arrivalTypeFilter === t
                                ? t === 'Bulk'
                                  ? '#DBEAFE'
                                  : t === 'Single'
                                    ? '#FEF3C7'
                                    : '#1E293B'
                                : '#fff',
                            color:
                              arrivalTypeFilter === t
                                ? t === 'Bulk'
                                  ? '#2563EB'
                                  : t === 'Single'
                                    ? '#D97706'
                                    : '#fff'
                                : '#64748B',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {t} ({cnt})
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {statusTabs.map((s) => {
                      const cnt =
                        s === 'All'
                          ? approvedOrders.length
                          : approvedOrders.filter((o) => getArrivalCond(o) === s).length;
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            setArrivalStatusFilter(s);
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 20,
                            border: arrivalStatusFilter === s ? 'none' : '1px solid #E2E8F0',
                            background:
                              arrivalStatusFilter === s
                                ? s === 'Back Order'
                                  ? '#FEE2E2'
                                  : s === 'Arrived'
                                    ? '#D1FAE5'
                                    : s === 'Awaiting'
                                      ? '#FEF3C7'
                                      : '#1E293B'
                                : '#fff',
                            color:
                              arrivalStatusFilter === s
                                ? s === 'Back Order'
                                  ? '#C53030'
                                  : s === 'Arrived'
                                    ? '#059669'
                                    : s === 'Awaiting'
                                      ? '#D97706'
                                      : '#fff'
                                : '#64748B',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {s} ({cnt})
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {allSection.collapsed ? null : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFB', position: 'sticky', top: 0, zIndex: 1 }}>
                        {[
                          { l: 'Order ID', k: 'id' },
                          { l: 'Type', k: 'bulkGroupId' },
                          { l: 'Material', k: 'materialNo' },
                          { l: 'Description', k: 'description' },
                          { l: 'Order By', k: 'orderBy' },
                          { l: 'Approved', k: 'approvalSentDate' },
                          { l: 'Ordered', k: 'quantity' },
                          { l: 'Recv', k: 'qtyReceived' },
                          { l: 'B/O', k: 'backOrder' },
                          { l: 'Arrival Date', k: 'arrivalDate' },
                          { l: 'Checked By', k: 'arrivalCheckedBy' },
                          { l: 'Status', k: 'status' },
                        ].map((h) => (
                          <SortTh
                            key={h.k}
                            label={h.l}
                            sortKey={h.k}
                            sortCfg={arrivalSort}
                            onSort={(k) => toggleSort(setArrivalSort, k)}
                            style={{ position: 'sticky', top: 0, zIndex: 1 }}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allPageItems.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                            No orders with status &quot;{arrivalStatusFilter}&quot;
                          </td>
                        </tr>
                      ) : (
                        allPageItems.map((o, i) => (
                          <tr
                            key={o.id}
                            className="tr"
                            style={{ borderBottom: '1px solid #F7FAFC', background: i % 2 === 0 ? '#fff' : '#FCFCFD' }}
                          >
                            <td className="td mono" style={{ fontSize: 11, fontWeight: 500, color: '#475569' }}>
                              {o.id}
                            </td>
                            <td className="td">
                              {o.bulkGroupId ? (
                                <Pill bg="#DBEAFE" color="#2563EB" style={{ fontSize: 10 }}>
                                  {o.bulkGroupId}
                                </Pill>
                              ) : (
                                <Pill bg="#FEF3C7" color="#D97706" style={{ fontSize: 10 }}>
                                  Single
                                </Pill>
                              )}
                            </td>
                            <td className="td mono" style={{ fontSize: 11, color: '#0B7A3E', fontWeight: 500 }}>
                              {o.materialNo || '\u2014'}
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
                            <td className="td" style={{ fontSize: 11 }}>
                              {o.orderBy || '\u2014'}
                            </td>
                            <td
                              className="td"
                              style={{ fontSize: 11, color: o.approvalSentDate ? '#1A202C' : '#94A3B8' }}
                            >
                              {o.approvalSentDate ? fmtDate(o.approvalSentDate) : '\u2014'}
                            </td>
                            <td className="td" style={{ fontWeight: 600, textAlign: 'center' }}>
                              {o.quantity}
                            </td>
                            <td
                              className="td"
                              style={{
                                fontWeight: 600,
                                textAlign: 'center',
                                color: (o.qtyReceived || 0) >= o.quantity ? '#0B7A3E' : '#D97706',
                              }}
                            >
                              {o.qtyReceived || 0}
                            </td>
                            <td
                              className="td"
                              style={{
                                fontWeight: 600,
                                textAlign: 'center',
                                color: (o.backOrder || 0) < 0 ? '#DC2626' : '#0B7A3E',
                              }}
                            >
                              {(o.backOrder || 0) < 0 ? o.backOrder : '\u2014'}
                            </td>
                            <td className="td" style={{ color: o.arrivalDate ? '#1A202C' : '#94A3B8', fontSize: 11 }}>
                              {o.arrivalDate ? fmtDate(o.arrivalDate) : '\u2014'}
                            </td>
                            <td className="td" style={{ fontSize: 11, color: '#64748B' }}>
                              {o.arrivalCheckedBy || '\u2014'}
                            </td>
                            <td className="td">
                              <ArrivalBadge order={o} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* All Orders pagination */}
                <Pagination {...allPager} {...allView} unit="orders" />
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default DeliveryPage;
