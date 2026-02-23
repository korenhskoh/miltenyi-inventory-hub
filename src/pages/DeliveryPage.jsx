import { useState } from 'react';
import { CheckCircle, AlertCircle, Clock, AlertTriangle, Mail, MessageSquare, Check } from 'lucide-react';
import { fmt, fmtDate, applySortData, toggleSort, fillTemplate } from '../utils.js';
import { Pill, ArrivalBadge, ExportDropdown, SortTh } from '../components/ui.jsx';
import api from '../api.js';

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
}) => (
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
          (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter),
      );
      return (
        <div
          className="grid-4"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}
        >
          {[
            {
              l: 'Awaiting Arrival',
              v: ao.filter((o) => !o.arrivalDate && (o.qtyReceived || 0) === 0).length,
              c: '#D97706',
            },
            {
              l: 'Fully Received',
              v: ao.filter((o) => (o.qtyReceived || 0) >= o.quantity && o.quantity > 0).length,
              c: '#0B7A3E',
            },
            {
              l: 'Back Order',
              v: ao.filter((o) => o.arrivalDate && (o.qtyReceived || 0) < o.quantity).length,
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
            My Orders ({orders.filter((o) => o.approvalStatus === 'approved' && o.orderBy === currentUser.name).length})
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
    </div>

    {/* Bulk Orders to Check — only approved */}
    <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Bulk Orders - Arrival Verification</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        {bulkGroups
          .filter((bg) => {
            const bgOrds = orders.filter((o) => o.bulkGroupId === bg.id);
            const hasApproved = bgOrds.some((o) => o.approvalStatus === 'approved');
            if (!hasApproved) return false;
            if (arrivalMonthFilter !== 'All' && bg.month !== arrivalMonthFilter) return false;
            if (arrivalOrderByFilter !== 'All' && !bgOrds.some((o) => o.orderBy === arrivalOrderByFilter)) return false;
            return true;
          })
          .map((bg) => {
            const bgOrders = orders.filter(
              (o) =>
                o.bulkGroupId === bg.id &&
                o.approvalStatus === 'approved' &&
                (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter),
            );
            const fullyReceived = bgOrders.filter((o) => o.qtyReceived >= o.quantity && o.quantity > 0).length;
            const pending = bgOrders.filter((o) => o.qtyReceived < o.quantity).length;
            const hasBackOrder = bgOrders.some((o) => o.backOrder < 0);
            const unapprovedCount = bgOrders.filter((o) => o.approvalStatus !== 'approved').length;
            return (
              <div
                key={bg.id}
                style={{
                  padding: '16px 20px',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  background: selectedBulkForArrival === bg.id ? '#E6F4ED' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background:
                          fullyReceived === bgOrders.length ? '#D1FAE5' : hasBackOrder ? '#FEE2E2' : '#FEF3C7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {fullyReceived === bgOrders.length ? (
                        <CheckCircle size={20} color="#059669" />
                      ) : hasBackOrder ? (
                        <AlertCircle size={20} color="#DC2626" />
                      ) : (
                        <Clock size={20} color="#D97706" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{bg.month} Bulk Order</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        {bg.id} • {bgOrders.length} items • {fmt(bg.totalCost)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right', marginRight: 12 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Progress</div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: fullyReceived === bgOrders.length ? '#059669' : '#D97706',
                        }}
                      >
                        {fullyReceived}/{bgOrders.length} received
                      </div>
                    </div>
                    <button
                      className={selectedBulkForArrival === bg.id ? 'bp' : 'bs'}
                      onClick={() => {
                        setSelectedBulkForArrival(selectedBulkForArrival === bg.id ? null : bg.id);
                        setArrivalItems(bgOrders);
                      }}
                      style={{ padding: '8px 16px' }}
                    >
                      {selectedBulkForArrival === bg.id ? 'Hide' : 'Check Items'}
                    </button>
                  </div>
                </div>

                {/* Expanded Items List */}
                {selectedBulkForArrival === bg.id && (
                  <div style={{ marginTop: 16, borderTop: '1px solid #E8ECF0', paddingTop: 16 }}>
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
                          <strong>{unapprovedCount} order(s)</strong> not yet approved — arrival inputs disabled until
                          approved.
                        </span>
                      </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFB' }}>
                          <th className="th" style={{ width: 30 }}>
                            <input
                              type="checkbox"
                              checked={bgOrders.every((o) => arrivalSelected.has(o.id)) && bgOrders.length > 0}
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
                          <th className="th">Material No.</th>
                          <th className="th">Description</th>
                          <th className="th" style={{ width: 70 }}>
                            Ordered
                          </th>
                          <th className="th" style={{ width: 80 }}>
                            Received
                          </th>
                          <th className="th" style={{ width: 70 }}>
                            B/O
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
                        {bgOrders.map((o, idx) => {
                          const pv = pendingArrival[o.id];
                          const dispQty = pv ? pv.qtyReceived : o.qtyReceived || 0;
                          const dispBO = pv ? pv.qtyReceived - o.quantity : (o.qtyReceived || 0) - o.quantity;
                          const hasPending = !!pv;
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
                                  title={o.approvalStatus !== 'approved' ? 'Order must be approved first' : ''}
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
                              <td className="td">
                                <Pill
                                  bg={
                                    (o.qtyReceived || 0) >= o.quantity && o.quantity > 0
                                      ? '#D1FAE5'
                                      : o.arrivalDate && (o.qtyReceived || 0) < o.quantity
                                        ? '#FEE2E2'
                                        : '#FEF3C7'
                                  }
                                  color={
                                    (o.qtyReceived || 0) >= o.quantity && o.quantity > 0
                                      ? '#059669'
                                      : o.arrivalDate && (o.qtyReceived || 0) < o.quantity
                                        ? '#DC2626'
                                        : '#D97706'
                                  }
                                >
                                  {(o.qtyReceived || 0) >= o.quantity && o.quantity > 0
                                    ? `${o.qtyReceived || 0}/${o.quantity} Arrived`
                                    : o.arrivalDate && (o.qtyReceived || 0) < o.quantity
                                      ? `${o.qtyReceived || 0}/${o.quantity} Back Order`
                                      : `0/${o.quantity} Awaiting`}
                                </Pill>
                              </td>
                              <td className="td">
                                <button
                                  className={hasPending || !o.arrivalDate ? 'bp' : 'bs'}
                                  disabled={!hasPending && !!o.arrivalDate}
                                  onClick={() => confirmArrival(o.id)}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    borderRadius: 6,
                                    opacity: hasPending || !o.arrivalDate ? 1 : 0.4,
                                    cursor: hasPending || !o.arrivalDate ? 'pointer' : 'default',
                                  }}
                                >
                                  {hasPending
                                    ? o.arrivalDate
                                      ? 'Update'
                                      : 'Confirm'
                                    : o.arrivalDate
                                      ? o.status === 'Received'
                                        ? '\u2713 Done'
                                        : 'Confirmed'
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
                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <CheckCircle size={14} /> Batch Confirm ({selIds.length} selected)
                          </button>
                        ) : null;
                      })()}
                      <button
                        className="be"
                        onClick={() => {
                          const summary = bgOrders
                            .map(
                              (o) =>
                                `\u2022 ${o.materialNo}: ${o.qtyReceived}/${o.quantity} ${o.qtyReceived >= o.quantity ? '\u2713' : '(B/O: ' + (o.quantity - o.qtyReceived) + ')'}`,
                            )
                            .join('\n');
                          notify('Email Sent', `Arrival report for ${bg.month} sent`, 'success');
                          addNotifEntry({
                            id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            type: 'email',
                            to: 'service-sg@miltenyibiotec.com',
                            subject: `Arrival Check: ${bg.month}`,
                            date: new Date().toISOString().slice(0, 10),
                            status: 'Sent',
                          });
                        }}
                      >
                        <Mail size={14} /> Email Report
                      </button>
                      {waConnected ? (
                        <button
                          className="bw"
                          onClick={async () => {
                            const received = bgOrders.filter((o) => o.qtyReceived >= o.quantity).length;
                            const backorder = bgOrders.filter((o) => o.qtyReceived < o.quantity).length;
                            const itemsList =
                              bgOrders
                                .slice(0, 5)
                                .map((o) => `\u2022 ${o.description.slice(0, 30)}: ${o.qtyReceived}/${o.quantity}`)
                                .join('\n') + (bgOrders.length > 5 ? `\n...and ${bgOrders.length - 5} more` : '');
                            const arrMsg = fillTemplate(
                              waMessageTemplates.partArrival?.message ||
                                '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}',
                              {
                                month: bg.month,
                                totalItems: bgOrders.length,
                                received,
                                backOrders: backorder,
                                verifiedBy: currentUser?.name || 'Admin',
                                date: new Date().toISOString().slice(0, 10),
                                itemsList,
                              },
                            );
                            try {
                              if (waNotifyRules.partArrivalDone) {
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
                                      data: { message: arrMsg },
                                    }),
                                  });
                                }
                              }
                              notify('WhatsApp Sent', `Arrival report for ${bg.month} sent`, 'success');
                              addNotifEntry({
                                id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                type: 'whatsapp',
                                to: 'SG Service Team',
                                subject: `Arrival: ${bg.month} - ${received} full, ${backorder} B/O`,
                                date: new Date().toISOString().slice(0, 10),
                                status: 'Delivered',
                              });
                            } catch (e) {
                              notify('Error', 'Failed to send WhatsApp', 'error');
                            }
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
                          const allReceived = bgOrders.every((o) => o.qtyReceived >= o.quantity);
                          if (allReceived) {
                            setBulkGroups((prev) =>
                              prev.map((g) => (g.id === bg.id ? { ...g, status: 'Completed' } : g)),
                            );
                            dbSync(
                              api.updateBulkGroup(bg.id, { status: 'Completed' }),
                              'Bulk group completion not saved',
                            );
                            notify('Arrival Complete', `${bg.month} marked as fully received`, 'success');
                            if (waConnected && waNotifyRules.partArrivalDone) {
                              try {
                                const completeItemsList =
                                  bgOrders
                                    .slice(0, 5)
                                    .map((o) => `\u2022 ${o.description.slice(0, 30)}: ${o.qtyReceived}/${o.quantity}`)
                                    .join('\n') + (bgOrders.length > 5 ? `\n...and ${bgOrders.length - 5} more` : '');
                                const completeMsg = fillTemplate(
                                  waMessageTemplates.partArrival?.message ||
                                    '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}',
                                  {
                                    month: bg.month,
                                    totalItems: bgOrders.length,
                                    received: bgOrders.length,
                                    backOrders: 0,
                                    verifiedBy: currentUser?.name || 'Admin',
                                    date: new Date().toISOString().slice(0, 10),
                                    itemsList: completeItemsList,
                                  },
                                );
                                await fetch(`${WA_API_URL}/send`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${api.getToken()}`,
                                  },
                                  body: JSON.stringify({
                                    phone: users.find((u) => u.name === bg.createdBy)?.phone || '+65 9111 2222',
                                    template: 'custom',
                                    data: { message: completeMsg },
                                  }),
                                });
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
                )}
              </div>
            );
          })}
      </div>
    </div>

    {/* Single Orders - Arrival Verification */}
    {(() => {
      const indivOrders = orders.filter(
        (o) =>
          !o.bulkGroupId &&
          o.approvalStatus === 'approved' &&
          o.quantity > 0 &&
          (arrivalMonthFilter === 'All' || o.month === arrivalMonthFilter) &&
          (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter),
      );
      if (!indivOrders.length) return null;
      return (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Single Orders - Arrival Verification</h3>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            {indivOrders.length} approved individual order(s) not part of any bulk group
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFB' }}>
                <th className="th" style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    checked={indivOrders.every((o) => arrivalSelected.has(o.id)) && indivOrders.length > 0}
                    onChange={(e) => {
                      const ids = indivOrders.map((o) => o.id);
                      setArrivalSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) ids.forEach((id) => next.add(id));
                        else ids.forEach((id) => next.delete(id));
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="th">Material No.</th>
                <th className="th">Description</th>
                <th className="th" style={{ width: 70 }}>
                  Ordered
                </th>
                <th className="th" style={{ width: 80 }}>
                  Received
                </th>
                <th className="th" style={{ width: 70 }}>
                  B/O
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
              {indivOrders.map((o) => {
                const pv = pendingArrival[o.id];
                const dispQty = pv ? pv.qtyReceived : o.qtyReceived || 0;
                const dispBO = pv ? pv.qtyReceived - o.quantity : (o.qtyReceived || 0) - o.quantity;
                const hasPending = !!pv;
                return (
                  <tr
                    key={o.id}
                    style={{ borderBottom: '1px solid #F0F2F5', background: hasPending ? '#FFFBEB' : 'transparent' }}
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
                      style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {o.description}
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
                    <td className="td">
                      <Pill
                        bg={
                          (o.qtyReceived || 0) >= o.quantity && o.quantity > 0
                            ? '#D1FAE5'
                            : o.arrivalDate && (o.qtyReceived || 0) < o.quantity
                              ? '#FEE2E2'
                              : '#FEF3C7'
                        }
                        color={
                          (o.qtyReceived || 0) >= o.quantity && o.quantity > 0
                            ? '#059669'
                            : o.arrivalDate && (o.qtyReceived || 0) < o.quantity
                              ? '#DC2626'
                              : '#D97706'
                        }
                      >
                        {(o.qtyReceived || 0) >= o.quantity && o.quantity > 0
                          ? `${o.qtyReceived || 0}/${o.quantity} Arrived`
                          : o.arrivalDate && (o.qtyReceived || 0) < o.quantity
                            ? `${o.qtyReceived || 0}/${o.quantity} Back Order`
                            : `0/${o.quantity} Awaiting`}
                      </Pill>
                    </td>
                    <td className="td">
                      <button
                        className={hasPending || !o.arrivalDate ? 'bp' : 'bs'}
                        disabled={!hasPending && !!o.arrivalDate}
                        onClick={() => confirmArrival(o.id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 11,
                          borderRadius: 6,
                          opacity: hasPending || !o.arrivalDate ? 1 : 0.4,
                          cursor: hasPending || !o.arrivalDate ? 'pointer' : 'default',
                        }}
                      >
                        {hasPending
                          ? o.arrivalDate
                            ? 'Update'
                            : 'Confirm'
                          : o.arrivalDate
                            ? o.status === 'Received'
                              ? '\u2713 Done'
                              : 'Confirmed'
                            : 'Confirm'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              onClick={() => {
                const summary = indivOrders
                  .map(
                    (o) =>
                      `\u2022 ${o.materialNo}: ${o.qtyReceived || 0}/${o.quantity} ${(o.qtyReceived || 0) >= o.quantity ? '\u2713' : '(B/O: ' + (o.quantity - (o.qtyReceived || 0)) + ')'}`,
                  )
                  .join('\n');
                notify('Email Sent', 'Individual orders arrival report sent', 'success');
                addNotifEntry({
                  id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  type: 'email',
                  to: 'service-sg@miltenyibiotec.com',
                  subject: 'Arrival Check: Individual Orders',
                  date: new Date().toISOString().slice(0, 10),
                  status: 'Sent',
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
                      .map((o) => `\u2022 ${o.description.slice(0, 30)}: ${o.qtyReceived || 0}/${o.quantity}`)
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
                      date: new Date().toISOString().slice(0, 10),
                      itemsList,
                    },
                  );
                  try {
                    if (waNotifyRules.partArrivalDone) {
                      for (const user of users.filter((u) => u.role !== 'admin' && u.status === 'active' && u.phone)) {
                        await fetch(`${WA_API_URL}/send`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` },
                          body: JSON.stringify({ phone: user.phone, template: 'custom', data: { message: arrMsg } }),
                        });
                      }
                    }
                    notify('WhatsApp Sent', 'Single orders arrival report sent', 'success');
                    addNotifEntry({
                      id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      type: 'whatsapp',
                      to: 'SG Service Team',
                      subject: `Arrival: Single Orders - ${received} full, ${backorder} B/O`,
                      date: new Date().toISOString().slice(0, 10),
                      status: 'Delivered',
                    });
                  } catch (e) {
                    notify('Error', 'Failed to send WhatsApp', 'error');
                  }
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
                          .map((o) => `\u2022 ${o.description.slice(0, 30)}: ${o.qtyReceived || 0}/${o.quantity}`)
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
                          date: new Date().toISOString().slice(0, 10),
                          itemsList: complItemsList,
                        },
                      );
                      for (const user of users.filter((u) => u.role !== 'admin' && u.status === 'active' && u.phone)) {
                        await fetch(`${WA_API_URL}/send`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` },
                          body: JSON.stringify({ phone: user.phone, template: 'custom', data: { message: complMsg } }),
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
          (arrivalOrderByFilter === 'All' || o.orderBy === arrivalOrderByFilter),
      );
      const approvedOrders =
        arrivalTypeFilter === 'Bulk'
          ? approvedAll.filter((o) => o.bulkGroupId)
          : arrivalTypeFilter === 'Single'
            ? approvedAll.filter((o) => !o.bulkGroupId)
            : approvedAll;
      const getArrivalCond = (o) =>
        (o.qtyReceived || 0) >= o.quantity && o.quantity > 0
          ? 'Arrived'
          : o.arrivalDate && (o.qtyReceived || 0) < o.quantity
            ? 'Back Order'
            : 'Awaiting';
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
      return (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>All Orders - Arrival Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    { key: 'status', label: 'Status' },
                  ]}
                  filename="part-arrival"
                  title="Part Arrival - Arrival Status"
                />
                <span style={{ fontSize: 11, color: '#94A3B8' }}>
                  {arrivalSorted.length} of {approvedOrders.length} approved orders
                </span>
              </div>
            </div>
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
                    onClick={() => setArrivalTypeFilter(t)}
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
                  s === 'All' ? approvedOrders.length : approvedOrders.filter((o) => getArrivalCond(o) === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setArrivalStatusFilter(s)}
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
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFB', position: 'sticky', top: 0, zIndex: 1 }}>
                  {[
                    { l: 'Order ID', k: 'id' },
                    { l: 'Type', k: 'bulkGroupId' },
                    { l: 'Material', k: 'materialNo' },
                    { l: 'Description', k: 'description' },
                    { l: 'Ordered', k: 'quantity' },
                    { l: 'Recv', k: 'qtyReceived' },
                    { l: 'B/O', k: 'backOrder' },
                    { l: 'Arrival Date', k: 'arrivalDate' },
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
                {arrivalSorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                      No orders with status "{arrivalStatusFilter}"
                    </td>
                  </tr>
                ) : (
                  arrivalSorted.map((o, i) => (
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
                        style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {o.description}
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
                      <td className="td">
                        <ArrivalBadge order={o} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    })()}
  </div>
);

export default DeliveryPage;
