import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Settings, ClipboardList, Search, Plus, Check, Trash2, AlertTriangle, Info } from 'lucide-react';
import ForecastChart from '../components/ForecastChart.jsx';
import { fmt, fmtDate } from '../utils.js';
import { Pill, ExportDropdown } from '../components/ui.jsx';
import Pagination, { usePagination } from '../components/Pagination.jsx';
import { buildSeries, forecast, annualPlan, monthKey, monthDisplay, HORIZONS } from '../lib/forecast.js';

const ForecastingPage = ({
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
}) => {
  // ── Demand history ────────────────────────────────────────────────────────
  //
  // Charge-out first, order history second.
  //
  // Ordering is a lumpy proxy for demand: thirty pump heads bought once and
  // drawn down over a year look like one enormous month followed by eleven
  // empty ones, and the old forecast — which read orders only, and dropped the
  // empty months entirely — turned that into a prediction of nineteen a month.
  // inventory_transactions records what engineers actually consumed, with a
  // real timestamp, so it is the better series wherever it exists. Parts with
  // no charge-out history yet fall back to orders, and the page says which.
  const [consumption, setConsumption] = useState(null);
  const [consumptionState, setConsumptionState] = useState('loading');
  const [horizon, setHorizon] = useState(12);
  const [summarySearch, setSummarySearch] = useState('');
  const [needsOrderOnly, setNeedsOrderOnly] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await api.getConsumption(36);
      if (!alive) return;
      setConsumption(res);
      setConsumptionState(res ? 'ready' : 'unavailable');
    })();
    return () => {
      alive = false;
    };
  }, [api]);

  const stockByMaterial = useMemo(() => {
    const map = new Map();
    for (const row of consumption?.stock || []) map.set(row.material_no, row);
    return map;
  }, [consumption]);

  const leadTimeByMaterial = useMemo(() => {
    const map = new Map();
    for (const row of consumption?.leadTimes || []) map.set(row.material_no, row);
    return map;
  }, [consumption]);

  /**
   * One entry per material: its monthly demand series, where that series came
   * from, and the description to show.
   */
  const materials = useMemo(() => {
    const byMaterial = new Map();

    const ensure = (materialNo) => {
      if (!byMaterial.has(materialNo)) {
        byMaterial.set(materialNo, {
          materialNo,
          description: '',
          chargeOut: [],
          ordered: [],
          orderCount: 0,
          totalQty: 0,
          totalCost: 0,
        });
      }
      return byMaterial.get(materialNo);
    };

    for (const row of consumption?.series || []) {
      const m = ensure(row.material_no);
      m.chargeOut.push({ month: row.month, qty: Number(row.qty) || 0 });
    }
    for (const row of consumption?.stock || []) {
      const m = ensure(row.material_no);
      if (!m.description && row.description) m.description = row.description;
    }

    for (const o of orders || []) {
      if (!o.materialNo) continue;
      // A rejected order was never demand. The old forecast counted it forever.
      if (o.status === 'Rejected' || o.status === 'Cancelled') continue;
      const m = ensure(o.materialNo);
      if (!m.description && o.description) m.description = o.description;
      m.orderCount++;
      m.totalQty += Number(o.quantity) || 0;
      m.totalCost += Number(o.totalCost) || 0;
      const month = monthKey(o.orderDate) || monthKey(o.arrivalDate);
      if (month) m.ordered.push({ month, qty: Number(o.quantity) || 0 });
    }

    return [...byMaterial.values()]
      .map((m) => {
        const fromChargeOut = m.chargeOut.length > 0;
        const series = buildSeries(fromChargeOut ? m.chargeOut : m.ordered);
        return { ...m, series, source: fromChargeOut ? 'consumption' : 'orders', hasSeries: series.length > 0 };
      })
      .filter((m) => m.hasSeries)
      .sort((a, b) => a.materialNo.localeCompare(b.materialNo));
  }, [consumption, orders]);

  const materialsByNo = useMemo(() => new Map(materials.map((m) => [m.materialNo, m])), [materials]);
  const selectedMat = forecastMaterial || materials[0]?.materialNo || '';
  const matData = materialsByNo.get(selectedMat) || null;
  const matMonthly = useMemo(
    () => (matData ? matData.series.map((p) => ({ name: monthDisplay(p.month), qty: p.qty, _sortKey: p.month })) : []),
    [matData],
  );

  // No fleet multiplier. The old one applied +2% per active machine INSIDE the
  // forecast loop with each prediction fed back as history, so it compounded:
  // steady demand of four a month came out as twenty-two by month six on a
  // twenty-five instrument fleet, while the page told you that adding machines
  // improved accuracy. A fleet term is only meaningful once consumption can be
  // attributed to an instrument, which needs a machine id on the charge-out.
  const selectedForecast = useMemo(() => (matData ? forecast(matData.series, horizon) : null), [matData, horizon]);

  const forecastMonths = selectedForecast?.points || [];
  const chartData = [...matMonthly.map((m) => ({ ...m, forecast: false })), ...forecastMonths];

  /**
   * The annual planning table: every part that has a demand series, with what
   * the next twelve months need, what the last twelve actually took, what is on
   * the shelf and how long that lasts.
   */
  const plans = useMemo(
    () =>
      materials.map((m) => {
        const stockRow = stockByMaterial.get(m.materialNo);
        const leadRow = leadTimeByMaterial.get(m.materialNo);
        const plan = annualPlan(m.series, {
          stock: Number(stockRow?.quantity) || 0,
          leadTimeDays: leadRow ? Number(leadRow.avg_days) : null,
          horizon,
        });
        return { ...m, ...plan };
      }),
    [materials, stockByMaterial, leadTimeByMaterial, horizon],
  );

  // Every part, in material order — no top-20 cut. The old summary silently
  // showed only the twenty biggest spenders while calling itself "All
  // Materials", so a cheap part about to run out was invisible.
  const planRows = useMemo(() => {
    const q = (summarySearch || '').trim().toLowerCase();
    return plans.filter((p) => {
      if (needsOrderOnly && !p.needsOrder) return false;
      if (!q) return true;
      return p.materialNo.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    });
  }, [plans, summarySearch, needsOrderOnly]);

  // Machine registry: filter first, then page the filtered list.
  const filteredMachines = machines.filter(
    (m) =>
      !machineSearch ||
      [m.name, m.modality, m.location, m.status].join(' ').toLowerCase().includes(machineSearch.toLowerCase()),
  );
  const machinePager = usePagination(filteredMachines, {
    storageKey: 'forecast-machines',
    initialSize: 100,
    resetKey: machineSearch,
  });
  // Built once so the header and the empty-state colspan cannot drift apart —
  // and so the horizon column and the fixed twelve-month column do not collide
  // at a twelve-month horizon, where they are the same number.
  const columns = useMemo(
    () =>
      [
        { key: 'materialNo', label: 'Material No', align: 'left' },
        { key: 'description', label: 'Description', align: 'left' },
        { key: 'source', label: 'Based on', align: 'center' },
        { key: 'perMonth', label: 'Per month', align: 'right' },
        { key: 'horizonTotal', label: `Next ${horizon} mo`, align: 'right' },
        horizon === 12 ? null : { key: 'next12', label: 'Next 12 mo', align: 'right' },
        { key: 'prior12', label: 'Last 12 mo', align: 'right' },
        { key: 'change', label: 'Change', align: 'right' },
        { key: 'stock', label: 'Stock', align: 'right' },
        { key: 'monthsCover', label: 'Cover', align: 'right' },
        { key: 'reorderPoint', label: 'Reorder pt', align: 'right' },
        { key: 'needsOrder', label: 'Order?', align: 'center' },
      ].filter(Boolean),
    [horizon],
  );

  const summaryPager = usePagination(planRows, {
    storageKey: 'forecast-summary',
    initialSize: 50,
    resetKey: `${summarySearch}|${needsOrderOnly}|${horizon}`,
  });

  // Modality stats
  const modalityCounts = {};
  machines.forEach((m) => {
    if (m.status === 'Active') modalityCounts[m.modality] = (modalityCounts[m.modality] || 0) + 1;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: 10, background: 'linear-gradient(135deg,#D97706,#F59E0B)', borderRadius: 12 }}>
          <TrendingUp size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Material Forecasting</h2>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
            Demand forecasting from charge-out history, with order history as a fallback
          </p>
        </div>
        {/*
         * One horizon for the whole page. It was briefly on the chart card
         * alone, which meant the planning table silently used whatever had
         * last been picked on another tab.
         */}
        <div
          style={{ display: 'flex', gap: 2, background: '#F1F5F9', borderRadius: 8, padding: 2 }}
          role="group"
          aria-label="Forecast horizon"
        >
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              aria-pressed={horizon === h}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                background: horizon === h ? '#fff' : 'transparent',
                color: horizon === h ? '#92400E' : '#64748B',
                boxShadow: horizon === h ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
              }}
              title={h >= 12 ? `${h / 12} year${h === 12 ? '' : 's'} ahead` : `${h} months ahead`}
            >
              {h >= 12 ? `${h / 12}y` : `${h}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E8ECF0', paddingBottom: 2 }}>
        {[
          { id: 'forecast', label: 'Forecast Dashboard', icon: TrendingUp },
          { id: 'machines', label: 'Machine Fleet', icon: Settings },
          { id: 'summary', label: 'All Materials Forecast', icon: ClipboardList },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setForecastTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: forecastTab === tab.id ? '#FEF3C7' : 'transparent',
              color: forecastTab === tab.id ? '#92400E' : '#64748B',
              fontWeight: 600,
              fontSize: 13,
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontFamily: 'inherit',
              borderBottom: forecastTab === tab.id ? '2px solid #D97706' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {consumptionState === 'unavailable' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 14px',
            marginBottom: 16,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            fontSize: 12.5,
            color: '#991B1B',
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          Charge-out history could not be loaded, so everything below is forecast from order history alone. Ordering is
          a lumpy proxy for use — read these figures as indicative.
        </div>
      )}

      {/* Forecast Dashboard */}
      {forecastTab === 'forecast' && (
        <div>
          <div
            className="grid-4"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}
          >
            {[
              { l: 'Parts with History', v: materials.length, c: '#D97706' },
              { l: 'From Charge-out', v: materials.filter((m) => m.source === 'consumption').length, c: '#0B7A3E' },
              { l: 'Need Ordering', v: plans.filter((p) => p.needsOrder).length, c: '#DC2626' },
              { l: 'Months of Data', v: matMonthly.length, c: '#7C3AED' },
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

          <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Material Forecast</h3>
              <select
                value={selectedMat}
                onChange={(e) => {
                  setForecastMaterial(e.target.value);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1.5px solid #E2E8F0',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  minWidth: 250,
                }}
              >
                {materials.map((m) => (
                  <option key={m.materialNo} value={m.materialNo}>
                    {m.materialNo} — {(m.description || '').slice(0, 40)}
                  </option>
                ))}
              </select>
            </div>
            {matData && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '12px 16px',
                  background: '#FEF3C7',
                  borderRadius: 10,
                  fontSize: 12,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <strong>{matData.description || matData.materialNo}</strong>
                  <span style={{ marginLeft: 8, color: '#92400E' }}>
                    {matData.source === 'consumption'
                      ? `forecast from ${matData.series.length} months of charge-out history`
                      : `no charge-out history yet — forecast from order history (${matData.orderCount} orders, ${fmt(
                          matData.totalCost,
                        )})`}
                  </span>
                </div>
                {selectedForecast && (
                  <div style={{ color: '#78350F' }}>
                    Next {horizon} months: <strong>{Math.round(selectedForecast.total)} units</strong> (
                    {selectedForecast.perMonth.toFixed(1)}/month) · next month{' '}
                    <strong>{forecastMonths[0]?.qty ?? 0}</strong> (range {forecastMonths[0]?.lo ?? 0}–
                    {forecastMonths[0]?.hi ?? 0}) · method: {selectedForecast.method}
                  </div>
                )}
              </div>
            )}
            {chartData.length > 0 ? (
              <ForecastChart rows={chartData} height={300} />
            ) : (
              <div
                style={{
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                }}
              >
                Select a material to view forecast
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'center',
                marginTop: 8,
                fontSize: 11,
                color: '#64748B',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D97706' }} /> Historical
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '2px dashed #DC2626',
                    background: '#fff',
                  }}
                />{' '}
                Forecast
              </span>
            </div>
          </div>

          {/* Machine Modality Correlation */}
          {machines.length > 0 && Object.keys(modalityCounts).length > 0 && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Machine Fleet Overview</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(modalityCounts).map(([mod, cnt]) => (
                  <div
                    key={mod}
                    style={{
                      padding: '12px 18px',
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: 10,
                      minWidth: 120,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 2,
                      }}
                    >
                      {mod}
                    </div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#0B7A3E' }}>
                      {cnt}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>active machines</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Machine Fleet Management */}
      {forecastTab === 'machines' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              Manage your local machine fleet. This is a registry — it does not alter the forecast.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
                <input
                  className="header-search"
                  type="text"
                  placeholder="Search machines..."
                  value={machineSearch}
                  onChange={(e) => setMachineSearch(e.target.value)}
                  style={{ paddingLeft: 32, width: 200, height: 36 }}
                />
              </div>
              <button className="bp" onClick={() => setShowAddMachine(true)}>
                <Plus size={14} /> Add Machine
              </button>
            </div>
          </div>

          <div
            className="grid-3"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}
          >
            {[
              { l: 'Total Machines', v: machines.length, c: '#0B7A3E' },
              { l: 'Active', v: machines.filter((m) => m.status === 'Active').length, c: '#2563EB' },
              { l: 'Modalities', v: Object.keys(modalityCounts).length, c: '#7C3AED' },
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

          {showAddMachine && (
            <div className="card" style={{ padding: '20px 24px', marginBottom: 16, border: '2px solid #D97706' }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add New Machine</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}>
                    Machine Name *
                  </label>
                  <input
                    value={newMachine.name}
                    onChange={(e) => setNewMachine((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. MACSQuant Analyzer 16"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}>
                    Modality *
                  </label>
                  <input
                    value={newMachine.modality}
                    onChange={(e) => setNewMachine((p) => ({ ...p, modality: e.target.value }))}
                    placeholder="e.g. Cell Analysis, Cell Sorting"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}>
                    Location
                  </label>
                  <input
                    value={newMachine.location}
                    onChange={(e) => setNewMachine((p) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Lab A, Singapore"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}>
                    Install Date
                  </label>
                  <input
                    type="date"
                    value={newMachine.installDate}
                    onChange={(e) => setNewMachine((p) => ({ ...p, installDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}>
                    Status
                  </label>
                  <select
                    value={newMachine.status}
                    onChange={(e) => setNewMachine((p) => ({ ...p, status: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Decommissioned</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}>
                    Notes
                  </label>
                  <input
                    value={newMachine.notes}
                    onChange={(e) => setNewMachine((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional notes"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  className="bp"
                  onClick={() => {
                    if (!newMachine.name || !newMachine.modality) {
                      notify('Missing Fields', 'Name and Modality are required', 'warning');
                      return;
                    }
                    const m = { ...newMachine };
                    dbSync(
                      api.createMachine(m).then((saved) => {
                        if (saved) {
                          setMachines((prev) => [saved, ...prev]);
                          logAction('create', 'machine', String(saved.id), { name: m.name, modality: m.modality });
                          notify('Machine Added', `${m.name} (${m.modality})`, 'success');
                        }
                        // Return the API result so dbSync can surface null/false as a save failure
                        return saved;
                      }),
                      'Machine not saved',
                    );
                    setNewMachine({
                      name: '',
                      modality: '',
                      location: '',
                      installDate: '',
                      status: 'Active',
                      notes: '',
                    });
                    setShowAddMachine(false);
                  }}
                >
                  <Check size={14} /> Save Machine
                </button>
                <button className="bs" onClick={() => setShowAddMachine(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFB' }}>
                  {['Name', 'Modality', 'Location', 'Install Date', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="th">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMachines.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                      {machines.length === 0 ? 'No machines added yet.' : 'No machines match your search.'}
                    </td>
                  </tr>
                ) : (
                  machinePager.pageItems.map((m) => (
                    <tr key={m.id} className="tr" style={{ borderBottom: '1px solid #F7FAFC' }}>
                      <td className="td" style={{ fontWeight: 600 }}>
                        {m.name}
                      </td>
                      <td className="td">
                        <Pill bg="#EDE9FE" color="#7C3AED">
                          {m.modality}
                        </Pill>
                      </td>
                      <td className="td" style={{ color: '#64748B' }}>
                        {m.location || '\u2014'}
                      </td>
                      <td className="td" style={{ fontSize: 11, color: '#94A3B8' }}>
                        {m.installDate ? fmtDate(m.installDate) : '\u2014'}
                      </td>
                      <td className="td">
                        <Pill
                          bg={m.status === 'Active' ? '#D1FAE5' : m.status === 'Inactive' ? '#FEF3C7' : '#F3F4F6'}
                          color={m.status === 'Active' ? '#059669' : m.status === 'Inactive' ? '#D97706' : '#64748B'}
                        >
                          {m.status}
                        </Pill>
                      </td>
                      <td className="td">
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete machine "${m.name}"?`)) {
                              setMachines((prev) => prev.filter((x) => x.id !== m.id));
                              dbSync(api.deleteMachine(m.id), 'Machine delete failed');
                              logAction('delete', 'machine', String(m.id), { name: m.name });
                              notify('Deleted', m.name, 'success');
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
                          <Trash2 size={11} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{ padding: '4px 16px 10px' }}>
              <Pagination {...machinePager} unit="machines" />
            </div>
          </div>
        </div>
      )}

      {/* Annual planning table — every part, no ranking */}
      {forecastTab === 'summary' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <p style={{ fontSize: 13, color: '#64748B', margin: 0, maxWidth: 520 }}>
              Every part with a demand history, over the next {horizon} months. &quot;Needs order&quot; compares stock
              on hand with the demand expected during that part&apos;s own average lead time.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
                <input
                  className="header-search"
                  type="text"
                  placeholder="Search parts..."
                  value={summarySearch}
                  onChange={(e) => setSummarySearch(e.target.value)}
                  style={{ paddingLeft: 32, width: 200, height: 36 }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569' }}>
                <input type="checkbox" checked={needsOrderOnly} onChange={(e) => setNeedsOrderOnly(e.target.checked)} />
                Needs order only
              </label>
              <ExportDropdown
                data={planRows.map((p) => ({
                  ...p,
                  perMonthOut: p.perMonth.toFixed(2),
                  horizonTotalOut: Math.round(p.horizonTotal),
                  next12Out: Math.round(p.next12),
                  monthsCoverOut: p.monthsCover === null ? '' : p.monthsCover.toFixed(1),
                  reorderOut: p.reorderPoint === null ? '' : p.reorderPoint,
                  needsOrderOut: p.needsOrder ? 'Yes' : 'No',
                  sourceOut: p.source === 'consumption' ? 'Charge-out' : 'Orders',
                }))}
                columns={[
                  { key: 'materialNo', label: 'Material No' },
                  { key: 'description', label: 'Description' },
                  { key: 'sourceOut', label: 'Based on' },
                  { key: 'observedMonths', label: 'Months observed' },
                  { key: 'demandMonths', label: 'Months with demand' },
                  { key: 'perMonthOut', label: 'Per month' },
                  { key: 'horizonTotalOut', label: `Next ${horizon} months` },
                  { key: 'next12Out', label: 'Next 12 months' },
                  { key: 'prior12', label: 'Last 12 months (actual)' },
                  { key: 'stock', label: 'Stock on hand' },
                  { key: 'monthsCoverOut', label: 'Months of cover' },
                  { key: 'leadTimeDays', label: 'Lead time (days)' },
                  { key: 'reorderOut', label: 'Reorder point' },
                  { key: 'needsOrderOut', label: 'Needs order' },
                  { key: 'method', label: 'Method' },
                ]}
                filename="annual-plan"
                title={`Annual Plan — next ${horizon} months`}
              />
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ maxHeight: 600, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F8FAFB', position: 'sticky', top: 0, zIndex: 1 }}>
                    {columns.map((c) => (
                      <th key={c.key} className="th" style={{ textAlign: c.align, whiteSpace: 'nowrap' }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}
                      >
                        {consumptionState === 'loading'
                          ? 'Loading consumption history…'
                          : plans.length === 0
                            ? 'No demand history yet. Charge parts out, or import order history, and this fills in.'
                            : 'No parts match the current filter.'}
                      </td>
                    </tr>
                  ) : (
                    summaryPager.pageItems.map((m, i) => (
                      <tr
                        key={m.materialNo}
                        className="tr"
                        style={{
                          borderBottom: '1px solid #F7FAFC',
                          background: i % 2 === 0 ? '#fff' : '#FCFCFD',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setForecastMaterial(m.materialNo);
                          setForecastTab('forecast');
                        }}
                        title={m.method}
                      >
                        <td className="td mono" style={{ fontSize: 11, fontWeight: 600, color: '#0B7A3E' }}>
                          {m.materialNo}
                        </td>
                        <td
                          className="td"
                          style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {m.description || '—'}
                        </td>
                        <td className="td" style={{ textAlign: 'center' }}>
                          <Pill
                            bg={m.source === 'consumption' ? '#D1FAE5' : '#EEF2FF'}
                            color={m.source === 'consumption' ? '#059669' : '#4F46E5'}
                          >
                            {m.source === 'consumption' ? 'Charge-out' : 'Orders'}
                          </Pill>
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {m.perMonth.toFixed(1)}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right', fontWeight: 700, color: '#D97706' }}>
                          {Math.round(m.horizonTotal)}
                        </td>
                        {horizon !== 12 && (
                          <td className="td mono" style={{ textAlign: 'right' }}>
                            {Math.round(m.next12)}
                          </td>
                        )}
                        <td className="td mono" style={{ textAlign: 'right', color: '#64748B' }}>
                          {m.prior12}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {m.change === null ? (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          ) : (
                            <span
                              style={{ color: m.change > 0.05 ? '#DC2626' : m.change < -0.05 ? '#059669' : '#64748B' }}
                            >
                              {m.change > 0 ? '+' : ''}
                              {Math.round(m.change * 100)}%
                            </span>
                          )}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {m.stock}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {m.monthsCover === null ? (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          ) : (
                            `${m.monthsCover.toFixed(1)} mo`
                          )}
                        </td>
                        <td className="td mono" style={{ textAlign: 'right' }}>
                          {m.reorderPoint === null ? (
                            <span style={{ color: '#CBD5E1' }} title="No arrival dates recorded for this part yet">
                              —
                            </span>
                          ) : (
                            m.reorderPoint
                          )}
                        </td>
                        <td className="td" style={{ textAlign: 'center' }}>
                          {m.needsOrder ? (
                            <Pill bg="#FEE2E2" color="#DC2626">
                              Order
                            </Pill>
                          ) : (
                            <span style={{ color: '#CBD5E1' }}>ok</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '4px 16px 10px' }}>
              <Pagination {...summaryPager} unit="materials" />
            </div>
          </div>

          <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 12, lineHeight: 1.6 }}>
            <Info size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Parts marked <strong>Charge-out</strong> are forecast from what engineers actually consumed. Parts marked{' '}
            <strong>Orders</strong> have no charge-out history yet, so buying is standing in for use — treat those
            figures as the weaker of the two. Hover a row to see which method was fitted.
          </p>
        </div>
      )}
    </div>
  );
};

export default ForecastingPage;
