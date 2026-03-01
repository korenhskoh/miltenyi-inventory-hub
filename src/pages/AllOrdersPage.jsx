import { Package, Layers, DollarSign, Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { fmt, fmtDate, fmtNum, applySortData, toggleSort } from '../utils.js';
import { Badge, ArrivalBadge, Pill, SortTh, ExportDropdown } from '../components/ui.jsx';

const AllOrdersPage = ({
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
}) => {
  const sorted = applySortData(allOrdersCombined, allOrdersSort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / allOrdersPageSize));
  const pageItems = sorted.slice(allOrdersPage * allOrdersPageSize, (allOrdersPage + 1) * allOrdersPageSize);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Unified view of all single and bulk orders</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={allOrdersPageSize}
            onChange={(e) => {
              setAllOrdersPageSize(Number(e.target.value));
              setAllOrdersPage(0);
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
            data={allOrdersCombined}
            columns={[
              { key: 'id', label: 'Order ID' },
              { key: 'materialNo', label: 'Material No' },
              { key: 'description', label: 'Description' },
              { key: 'quantity', label: 'Qty' },
              { key: 'listPrice', label: 'List Price', fmt: (v) => (v > 0 ? fmt(v) : '') },
              { key: 'totalCost', label: 'Total Cost', fmt: (v) => (v > 0 ? fmt(v) : '') },
              { key: 'orderDate', label: 'Order Date', fmt: (v) => fmtDate(v) },
              { key: 'orderBy', label: 'Ordered By' },
              { key: 'status', label: 'Status' },
              { key: 'orderType', label: 'Type' },
              { key: 'month', label: 'Month' },
              { key: 'arrivalCheckedBy', label: 'Checked By' },
            ]}
            filename="all-orders"
            title="All Orders Export"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          {
            l: 'Total Orders',
            v: allOrdersCombined.length,
            i: Package,
            c: '#0B7A3E',
            bg: 'linear-gradient(135deg,#006837,#0B9A4E)',
          },
          {
            l: 'Single Orders',
            v: allOrdersCombined.filter((o) => o.orderType === 'Single').length,
            i: Package,
            c: '#2563EB',
            bg: 'linear-gradient(135deg,#1E40AF,#3B82F6)',
          },
          {
            l: 'Bulk Orders',
            v: allOrdersCombined.filter((o) => o.orderType === 'Bulk').length,
            i: Layers,
            c: '#7C3AED',
            bg: 'linear-gradient(135deg,#5B21B6,#7C3AED)',
          },
          {
            l: 'Total Value',
            v: fmt(
              allOrdersCombined.reduce((s, o) => {
                const cp = catalogLookup[o.materialNo];
                const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
                return s + (price > 0 ? price * o.quantity : Number(o.totalCost) || 0);
              }, 0),
            ),
            i: DollarSign,
            c: '#D97706',
            bg: 'linear-gradient(135deg,#92400E,#D97706)',
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
                <div className="mono" style={{ fontSize: 26, fontWeight: 700 }}>
                  {s.v}
                </div>
              </div>
              <div style={{ padding: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 8 }}>
                <s.i size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
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
          <span
            style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Type
          </span>
          {['All', 'Single Orders', 'Bulk Orders'].map((t) => (
            <button
              key={t}
              onClick={() => {
                setAllOrdersTypeFilter(t);
                setAllOrdersPage(0);
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: allOrdersTypeFilter === t ? 'none' : '1px solid #E2E8F0',
                background: allOrdersTypeFilter === t ? '#0B7A3E' : '#fff',
                color: allOrdersTypeFilter === t ? '#fff' : '#64748B',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Month
          </span>
          <select
            value={allOrdersMonth}
            onChange={(e) => {
              setAllOrdersMonth(e.target.value);
              setAllOrdersPage(0);
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 11,
              fontFamily: 'inherit',
              cursor: 'pointer',
              color: '#1A202C',
            }}
          >
            <option value="All">All Months</option>
            {allOrdersMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Status
          </span>
          {['All', 'Pending Approval', 'Approved', 'Received', 'Rejected'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setAllOrdersStatus(s);
                setAllOrdersPage(0);
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: allOrdersStatus === s ? 'none' : '1px solid #E2E8F0',
                background: allOrdersStatus === s ? '#0B7A3E' : '#fff',
                color: allOrdersStatus === s ? '#fff' : '#64748B',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            By
          </span>
          <select
            value={allOrdersUserFilter}
            onChange={(e) => {
              setAllOrdersUserFilter(e.target.value);
              setAllOrdersPage(0);
            }}
            style={{
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 11,
              fontFamily: 'inherit',
              cursor: 'pointer',
              color: '#1A202C',
            }}
          >
            <option value="All">All Users</option>
            {currentUser?.name && (
              <option value={currentUser.name}>
                My Orders ({orders.filter((o) => o.orderBy === currentUser.name).length})
              </option>
            )}
            {allOrdersUsers
              .filter((u) => u !== currentUser?.name)
              .map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* All Orders Table */}
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
          <span style={{ fontWeight: 600, fontSize: 14 }}>All Orders</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{allOrdersCombined.length} results</span>
        </div>
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#F8FAFB' }}>
                {[
                  { l: 'Type', k: 'orderType' },
                  { l: 'ID', k: 'id' },
                  { l: 'Material / Items', k: 'materialNo' },
                  { l: 'Description', k: 'description' },
                  { l: 'Qty', k: 'quantity' },
                  { l: 'Unit Price', k: 'listPrice' },
                  { l: 'Total', k: 'totalCost' },
                  { l: 'By', k: 'orderBy' },
                  { l: 'Date', k: 'orderDate' },
                  { l: 'Status', k: 'status' },
                  { l: 'Arrival', k: 'arrivalDate' },
                  { l: 'Checked By', k: 'arrivalCheckedBy' },
                ].map((h) => (
                  <SortTh
                    key={h.k}
                    label={h.l}
                    sortKey={h.k}
                    sortCfg={allOrdersSort}
                    onSort={(k) => toggleSort(setAllOrdersSort, k)}
                    style={{ whiteSpace: 'nowrap' }}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {allOrdersCombined.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>
                    No orders match the selected filters
                  </td>
                </tr>
              ) : (
                pageItems.map((o, i) => (
                  <tr
                    key={o.id}
                    className="tr"
                    style={{
                      borderBottom: '1px solid #F7FAFC',
                      background: i % 2 === 0 ? '#fff' : '#FCFCFD',
                      cursor: 'pointer',
                    }}
                    onClick={() => openOrderInNewTab(o)}
                  >
                    <td className="td">
                      <Pill
                        bg={o.orderType === 'Single' ? '#DBEAFE' : '#EDE9FE'}
                        color={o.orderType === 'Single' ? '#2563EB' : '#7C3AED'}
                      >
                        {o.orderType === 'Single' ? 'Single' : 'Bulk'}
                      </Pill>
                    </td>
                    <td
                      className="td mono"
                      style={{ fontSize: 11, fontWeight: 600, color: o.orderType === 'Single' ? '#0B7A3E' : '#4338CA' }}
                    >
                      {o.id}
                    </td>
                    <td className="td mono" style={{ fontSize: 11, color: '#64748B' }}>
                      {o.materialNo || '\u2014'}
                    </td>
                    <td
                      className="td"
                      style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
                        return price > 0 ? fmt(price) : '\u2014';
                      })()}
                    </td>
                    <td className="td mono" style={{ fontSize: 11, fontWeight: 600 }}>
                      {(() => {
                        const cp = catalogLookup[o.materialNo];
                        const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                        const total = price > 0 ? price * o.quantity : o.totalCost;
                        return total > 0 ? fmt(total) : '\u2014';
                      })()}
                    </td>
                    <td className="td" style={{ fontSize: 11 }}>
                      {o.orderBy || '\u2014'}
                    </td>
                    <td className="td" style={{ color: '#94A3B8', fontSize: 11 }}>
                      {fmtDate(o.orderDate)}
                    </td>
                    <td className="td">
                      <Badge status={o.status} />
                    </td>
                    <td className="td">
                      <ArrivalBadge order={o} />
                    </td>
                    <td className="td" style={{ fontSize: 11, color: '#64748B' }}>
                      {o.arrivalCheckedBy || '\u2014'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
            Showing {Math.min(allOrdersPage * allOrdersPageSize + 1, allOrdersCombined.length)}–
            {Math.min((allOrdersPage + 1) * allOrdersPageSize, allOrdersCombined.length)} of {allOrdersCombined.length}
            {allOrdersTypeFilter !== 'All' ||
            allOrdersMonth !== 'All' ||
            allOrdersStatus !== 'All' ||
            allOrdersUserFilter !== 'All'
              ? ' (filtered)'
              : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {fmt(
                allOrdersCombined.reduce((s, o) => {
                  const cp = catalogLookup[o.materialNo];
                  const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
                  return s + (price > 0 ? price * o.quantity : Number(o.totalCost) || 0);
                }, 0),
              )}
            </span>
            <div style={{ width: 1, height: 16, background: '#E2E8F0' }} />
            <button
              className="bs"
              style={{ padding: '6px 10px', fontSize: 12 }}
              disabled={allOrdersPage === 0}
              onClick={() => setAllOrdersPage((p) => p - 1)}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Page {allOrdersPage + 1}/{totalPages}
            </span>
            <button
              className="bs"
              style={{ padding: '6px 10px', fontSize: 12 }}
              disabled={(allOrdersPage + 1) * allOrdersPageSize >= allOrdersCombined.length}
              onClick={() => setAllOrdersPage((p) => p + 1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Month Overview */}
      <div className="card" style={{ padding: '20px 24px', marginTop: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          Orders by Month{' '}
          <span style={{ fontWeight: 400, fontSize: 12, color: '#64748B' }}>(Click to view orders)</span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {allOrdersMonths.map((month) => {
            const singleCount = orders.filter((o) => !o.bulkGroupId && o.month === month).length;
            const bulkCount = orders.filter((o) => o.bulkGroupId && o.month === month).length;
            const totalCost = orders
              .filter((o) => o.month === month)
              .reduce((s, o) => {
                const cp = catalogLookup[o.materialNo];
                const price = cp ? cp.sg || cp.tp || cp.dist || 0 : Number(o.listPrice) || 0;
                return s + (price > 0 ? price * o.quantity : Number(o.totalCost) || 0);
              }, 0);
            const isExpanded = expandedAllMonth === month;
            return (
              <div
                key={month}
                onClick={() => {
                  setExpandedAllMonth(isExpanded ? null : month);
                  setExpandedAllBulkGroup(null);
                }}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: isExpanded ? '#E6F4ED' : '#F8FAFB',
                  border: isExpanded ? '2px solid #0B7A3E' : '1px solid #E8ECF0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 12,
                    marginBottom: 8,
                    color: '#0B7A3E',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Calendar size={12} /> {month} {isExpanded && <ChevronDown size={12} />}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                  <div>
                    Single: <strong>{singleCount}</strong>
                  </div>
                  <div>
                    Bulk: <strong>{bulkCount}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    Value: <strong className="mono">{fmt(totalCost)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Month Detail */}
      {expandedAllMonth &&
        (() => {
          const monthOrders = orders.filter((o) => o.month === expandedAllMonth);
          const monthBulkGroupIds = [...new Set(monthOrders.filter((o) => o.bulkGroupId).map((o) => o.bulkGroupId))];
          const monthSingleOrders = monthOrders.filter((o) => !o.bulkGroupId);
          return (
            <div style={{ marginTop: 16 }}>
              {/* Bulk Groups for this month */}
              {monthBulkGroupIds.length > 0 && (
                <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Layers size={15} color="#4338CA" /> Bulk Groups — {expandedAllMonth}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                    {monthBulkGroupIds.map((bgId) => {
                      const bg = bulkGroups.find((g) => g.id === bgId);
                      const bgOrds = monthOrders.filter((o) => o.bulkGroupId === bgId);
                      const isExp = expandedAllBulkGroup === bgId;
                      return (
                        <div
                          key={bgId}
                          onClick={() => setExpandedAllBulkGroup(isExp ? null : bgId)}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            background: isExp ? '#EDE9FE' : '#F8FAFB',
                            border: isExp ? '2px solid #7C3AED' : '1px solid #E8ECF0',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 12,
                              marginBottom: 4,
                              color: '#4338CA',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {bgId} {isExp && <ChevronDown size={12} />}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                            By: {bg?.createdBy || '\u2014'}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                            <div>
                              Orders: <strong>{bgOrds.length}</strong>
                            </div>
                            <div>
                              Qty: <strong>{bgOrds.reduce((s, o) => s + o.quantity, 0)}</strong>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                              Cost:{' '}
                              <strong className="mono">
                                {fmt(
                                  bgOrds.reduce((s, o) => {
                                    const cp = catalogLookup[o.materialNo];
                                    const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                                    return s + (price > 0 ? price * o.quantity : o.totalCost);
                                  }, 0),
                                )}
                              </strong>
                            </div>
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <Badge status={bg?.status || 'Pending Approval'} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Expanded Bulk Group Orders */}
                  {expandedAllBulkGroup &&
                    (() => {
                      const bgOrds = monthOrders.filter((o) => o.bulkGroupId === expandedAllBulkGroup);
                      const bg = bulkGroups.find((g) => g.id === expandedAllBulkGroup);
                      if (bgOrds.length === 0) return null;
                      return (
                        <div style={{ marginTop: 16 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 10,
                            }}
                          >
                            <h4
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#4338CA',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <Eye size={14} /> {expandedAllBulkGroup} — {bgOrds.length} orders
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedAllBulkGroup(null);
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              <X size={16} color="#64748B" />
                            </button>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: '#F8FAFB' }}>
                                  {[
                                    'Order ID',
                                    'Material No',
                                    'Description',
                                    'Qty',
                                    'Unit Price',
                                    'Total',
                                    'Ordered By',
                                    'Date',
                                    'Status',
                                    'Arrival',
                                  ].map((h) => (
                                    <th key={h} className="th">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {bgOrds.map((o, i) => (
                                  <tr
                                    key={o.id}
                                    className="tr"
                                    onClick={() => openOrderInNewTab(o)}
                                    style={{
                                      borderBottom: '1px solid #F7FAFC',
                                      cursor: 'pointer',
                                      background: i % 2 === 0 ? '#fff' : '#FCFCFD',
                                    }}
                                  >
                                    <td className="td mono" style={{ fontSize: 11, fontWeight: 600, color: '#4338CA' }}>
                                      {o.id}
                                    </td>
                                    <td className="td mono" style={{ fontSize: 10 }}>
                                      {o.materialNo || '\u2014'}
                                    </td>
                                    <td
                                      className="td"
                                      style={{
                                        fontSize: 11,
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
                                        return price > 0 ? fmt(price) : '\u2014';
                                      })()}
                                    </td>
                                    <td className="td mono" style={{ fontSize: 11, fontWeight: 600 }}>
                                      {(() => {
                                        const cp = catalogLookup[o.materialNo];
                                        const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                                        const total = price > 0 ? price * o.quantity : o.totalCost;
                                        return total > 0 ? fmt(total) : '\u2014';
                                      })()}
                                    </td>
                                    <td className="td" style={{ fontSize: 11 }}>
                                      {o.orderBy || '\u2014'}
                                    </td>
                                    <td className="td" style={{ color: '#94A3B8', fontSize: 11 }}>
                                      {fmtDate(o.orderDate)}
                                    </td>
                                    <td className="td">
                                      <Badge status={o.status} />
                                    </td>
                                    <td className="td">
                                      <ArrivalBadge order={o} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div
                            style={{ marginTop: 8, padding: 10, background: '#F8FAFB', borderRadius: 8, fontSize: 12 }}
                          >
                            <strong>Summary:</strong> {bgOrds.length} orders | Qty:{' '}
                            {bgOrds.reduce((s, o) => s + o.quantity, 0)} | Cost:{' '}
                            <strong className="mono">
                              {fmt(
                                bgOrds.reduce((s, o) => {
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

              {/* Single Orders for this month */}
              {monthSingleOrders.length > 0 && (
                <div className="card" style={{ padding: '20px 24px' }}>
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Package size={15} color="#2563EB" /> Single Orders — {expandedAllMonth}{' '}
                    <span style={{ fontWeight: 400, fontSize: 12, color: '#64748B' }}>
                      ({monthSingleOrders.length} orders)
                    </span>
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFB' }}>
                          {[
                            'Order ID',
                            'Material No',
                            'Description',
                            'Qty',
                            'Unit Price',
                            'Total',
                            'Ordered By',
                            'Date',
                            'Status',
                            'Arrival',
                          ].map((h) => (
                            <th key={h} className="th">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthSingleOrders.map((o, i) => (
                          <tr
                            key={o.id}
                            className="tr"
                            onClick={() => openOrderInNewTab(o)}
                            style={{
                              borderBottom: '1px solid #F7FAFC',
                              cursor: 'pointer',
                              background: i % 2 === 0 ? '#fff' : '#FCFCFD',
                            }}
                          >
                            <td className="td mono" style={{ fontSize: 11, fontWeight: 600, color: '#0B7A3E' }}>
                              {o.id}
                            </td>
                            <td className="td mono" style={{ fontSize: 10 }}>
                              {o.materialNo || '\u2014'}
                            </td>
                            <td
                              className="td"
                              style={{
                                fontSize: 11,
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
                                return price > 0 ? fmt(price) : '\u2014';
                              })()}
                            </td>
                            <td className="td mono" style={{ fontSize: 11, fontWeight: 600 }}>
                              {(() => {
                                const cp = catalogLookup[o.materialNo];
                                const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                                const total = price > 0 ? price * o.quantity : o.totalCost;
                                return total > 0 ? fmt(total) : '\u2014';
                              })()}
                            </td>
                            <td className="td" style={{ fontSize: 11 }}>
                              {o.orderBy || '\u2014'}
                            </td>
                            <td className="td" style={{ color: '#94A3B8', fontSize: 11 }}>
                              {fmtDate(o.orderDate)}
                            </td>
                            <td className="td">
                              <Badge status={o.status} />
                            </td>
                            <td className="td">
                              <ArrivalBadge order={o} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 8, padding: 10, background: '#F8FAFB', borderRadius: 8, fontSize: 12 }}>
                    <strong>Summary:</strong> {monthSingleOrders.length} orders | Qty:{' '}
                    {monthSingleOrders.reduce((s, o) => s + o.quantity, 0)} | Cost:{' '}
                    <strong className="mono">
                      {fmt(
                        monthSingleOrders.reduce((s, o) => {
                          const cp = catalogLookup[o.materialNo];
                          const price = cp ? cp.sg || cp.tp || cp.dist || 0 : o.listPrice;
                          return s + (price > 0 ? price * o.quantity : o.totalCost);
                        }, 0),
                      )}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
};

export default AllOrdersPage;
