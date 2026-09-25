import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  reorderNow,
  awaitingApproval,
  overdueArrivals,
  shortDeliveries,
  spendSplit,
  serviceAlerts,
  stockCheckAlerts,
  monthlyWithLastYear,
} from './dashboard.js';

const TODAY = '2026-09-25';

describe('daysBetween', () => {
  it('counts days and tolerates timestamps', () => {
    expect(daysBetween('2026-09-01', '2026-09-25')).toBe(24);
    expect(daysBetween('2026-09-01T10:00:00Z', '2026-09-25')).toBe(24);
    expect(daysBetween('', '2026-09-25')).toBeNull();
    expect(daysBetween('nonsense', '2026-09-25')).toBeNull();
  });
});

describe('reorderNow', () => {
  const consumption = {
    series: [
      // steady 4/month for six months
      ...['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month) => ({
        material_no: 'LOW',
        month,
        qty: 4,
      })),
      ...['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month) => ({
        material_no: 'FINE',
        month,
        qty: 4,
      })),
    ],
    stock: [
      { material_no: 'LOW', quantity: 1, description: 'Nearly out' },
      { material_no: 'FINE', quantity: 500, description: 'Plenty' },
    ],
    leadTimes: [
      { material_no: 'LOW', avg_days: 33 },
      { material_no: 'FINE', avg_days: 33 },
    ],
  };

  it('flags the part that will run out before a replacement could arrive', () => {
    const r = reorderNow(consumption);
    expect(r.count).toBe(1);
    expect(r.items[0].materialNo).toBe('LOW');
    expect(r.items[0].leadTimeDays).toBe(33);
  });

  it('puts the least cover first', () => {
    const three = {
      ...consumption,
      stock: [
        { material_no: 'LOW', quantity: 5 },
        { material_no: 'FINE', quantity: 1 },
      ],
    };
    expect(reorderNow(three).items[0].materialNo).toBe('FINE');
  });

  it('survives having no consumption data at all', () => {
    expect(reorderNow(null)).toEqual({ items: [], count: 0 });
    expect(reorderNow({ series: [], stock: [], leadTimes: [] }).count).toBe(0);
  });
});

describe('awaitingApproval', () => {
  const orders = [
    {
      id: 'A',
      approvalStatus: 'pending',
      status: 'Pending Approval',
      orderDate: '2026-08-01',
      quantity: 2,
      listPrice: 50,
      totalCost: 100,
    },
    {
      id: 'B',
      approvalStatus: 'pending',
      status: 'Pending Approval',
      orderDate: '2026-09-20',
      quantity: 1,
      listPrice: 10,
      totalCost: 10,
    },
    {
      id: 'C',
      approvalStatus: 'approved',
      status: 'Approved',
      orderDate: '2026-09-01',
      quantity: 1,
      listPrice: 10,
      totalCost: 10,
    },
    {
      id: 'D',
      approvalStatus: 'pending',
      status: 'Rejected',
      orderDate: '2026-01-01',
      quantity: 1,
      listPrice: 99,
      totalCost: 99,
    },
  ];

  it('counts what is waiting, with its value and the longest wait', () => {
    const r = awaitingApproval(orders, {}, TODAY);
    expect(r.count).toBe(2); // rejected is not waiting for anyone
    expect(r.value).toBe(110);
    expect(r.oldestDays).toBe(55);
    expect(r.oldestDate).toBe('2026-08-01');
  });

  it('reports nothing waiting without inventing a wait', () => {
    const r = awaitingApproval([orders[2]], {}, TODAY);
    expect(r.count).toBe(0);
    expect(r.oldestDays).toBeNull();
  });
});

describe('overdueArrivals', () => {
  const consumption = { leadTimes: [{ material_no: 'FAST', avg_days: 14 }] };
  const base = { approvalStatus: 'approved', status: 'Approved', quantity: 10, qtyReceived: 0 };

  it("measures against the part's own lead time", () => {
    const orders = [
      { ...base, id: 'LATE', materialNo: 'FAST', orderDate: '2026-08-01' }, // 55 days vs 14
      { ...base, id: 'OK', materialNo: 'FAST', orderDate: '2026-09-20' }, // 5 days vs 14
    ];
    const r = overdueArrivals(orders, consumption, TODAY);
    expect(r.count).toBe(1);
    expect(r.items[0].id).toBe('LATE');
    expect(r.items[0].overdueDays).toBe(41);
    expect(r.items[0].measured).toBe(true);
  });

  it('falls back for a part never received before, and says so', () => {
    const orders = [{ ...base, id: 'NEW', materialNo: 'UNKNOWN', orderDate: '2026-08-01' }];
    const r = overdueArrivals(orders, consumption, TODAY, { fallbackDays: 30 });
    expect(r.items[0].expectedDays).toBe(30);
    expect(r.items[0].measured).toBe(false);
  });

  it('ignores what has already arrived, and what was never approved', () => {
    const orders = [
      { ...base, id: 'DONE', materialNo: 'FAST', orderDate: '2026-01-01', qtyReceived: 10 },
      { ...base, id: 'UNAPPROVED', materialNo: 'FAST', orderDate: '2026-01-01', approvalStatus: 'pending' },
      { ...base, id: 'REJECTED', materialNo: 'FAST', orderDate: '2026-01-01', status: 'Rejected' },
    ];
    expect(overdueArrivals(orders, consumption, TODAY).count).toBe(0);
  });

  it('counts a part-delivered order as still outstanding', () => {
    const orders = [{ ...base, id: 'PART', materialNo: 'FAST', orderDate: '2026-08-01', qtyReceived: 4 }];
    expect(overdueArrivals(orders, consumption, TODAY).count).toBe(1);
  });
});

describe('shortDeliveries', () => {
  it('finds what came up short, worst first', () => {
    const orders = [
      { id: 'A', quantity: 10, qtyReceived: 9, status: 'Approved' },
      { id: 'B', quantity: 10, qtyReceived: 2, status: 'Approved' },
      { id: 'C', quantity: 10, qtyReceived: 10, status: 'Received' },
      { id: 'D', quantity: 10, qtyReceived: 0, status: 'Approved' },
    ];
    const r = shortDeliveries(orders);
    // Nothing arrived for D, so it is awaiting, not short.
    expect(r.count).toBe(2);
    expect(r.items.map((o) => o.id)).toEqual(['B', 'A']);
    expect(r.items[0].missing).toBe(8);
  });
});

describe('spendSplit', () => {
  it('separates spent, committed and merely requested', () => {
    const orders = [
      { status: 'Received', approvalStatus: 'approved', quantity: 2, listPrice: 100, totalCost: 200 },
      { status: 'Approved', approvalStatus: 'approved', quantity: 1, listPrice: 50, totalCost: 50 },
      { status: 'Pending Approval', approvalStatus: 'pending', quantity: 1, listPrice: 25, totalCost: 25 },
      { status: 'Rejected', approvalStatus: 'rejected', quantity: 1, listPrice: 999, totalCost: 999 },
    ];
    const r = spendSplit(orders, {});
    expect(r).toMatchObject({ received: 200, committed: 50, pending: 25, total: 275 });
  });
});

describe('serviceAlerts', () => {
  const machines = [
    { id: 1, name: 'MACSQuant A', contractEnd: '2026-10-10', nextMaintenanceDate: '2027-06-01', status: 'Active' },
    { id: 2, name: 'MACSQuant B', contractEnd: '2026-09-01', status: 'Active' }, // already expired
    { id: 3, name: 'MACSQuant C', contractEnd: '2027-12-01', nextMaintenanceDate: '2026-09-30', status: 'Active' },
    { id: 4, name: 'Old One', contractEnd: '2026-10-01', status: 'Retired' },
  ];

  it('finds contracts running out, expired ones first', () => {
    const r = serviceAlerts(machines, TODAY);
    expect(r.expiringCount).toBe(2);
    expect(r.expiring[0].name).toBe('MACSQuant B');
    expect(r.expiring[0].expired).toBe(true);
    expect(r.expiring[1].daysLeft).toBe(15);
  });

  it('finds maintenance coming due', () => {
    const r = serviceAlerts(machines, TODAY);
    expect(r.dueMaintenanceCount).toBe(1);
    expect(r.dueMaintenance[0].name).toBe('MACSQuant C');
  });

  it('leaves retired instruments out', () => {
    expect(serviceAlerts(machines, TODAY).expiring.some((m) => m.name === 'Old One')).toBe(false);
  });

  it('reads snake_case columns too', () => {
    const r = serviceAlerts([{ id: 9, name: 'Raw', contract_end: '2026-10-01', status: 'Active' }], TODAY);
    expect(r.expiringCount).toBe(1);
  });
});

describe('stockCheckAlerts', () => {
  it('surfaces unresolved discrepancies, newest first', () => {
    const checks = [
      { id: 'SC-1', date: '2026-09-01', disc: 3, status: 'Completed' },
      { id: 'SC-2', date: '2026-09-20', disc: 1, status: 'Completed' },
      { id: 'SC-3', date: '2026-09-22', disc: 5, status: 'Resolved' },
      { id: 'SC-4', date: '2026-09-23', disc: 0, status: 'Completed' },
    ];
    const r = stockCheckAlerts(checks);
    expect(r.count).toBe(2);
    expect(r.items[0].id).toBe('SC-2');
    expect(r.discrepancies).toBe(4);
  });
});

describe('monthlyWithLastYear', () => {
  it('puts the same month a year earlier beside each point', () => {
    const orders = [
      { orderDate: '2025-09-05', quantity: 1, listPrice: 100, totalCost: 100, status: 'Received' },
      { orderDate: '2026-09-05', quantity: 1, listPrice: 150, totalCost: 150, status: 'Received' },
      { orderDate: '2026-08-05', quantity: 1, listPrice: 40, totalCost: 40, status: 'Received' },
    ];
    const rows = monthlyWithLastYear(orders, {}, { months: 3 });
    const sep = rows.find((r) => r.month === '2026-09');
    expect(sep.value).toBe(150);
    expect(sep.lastYear).toBe(100);
    const aug = rows.find((r) => r.month === '2026-08');
    expect(aug.lastYear).toBeNull(); // no Aug 2025 in the data
  });

  it('leaves rejected orders out and survives no orders', () => {
    expect(monthlyWithLastYear([{ orderDate: '2026-09-01', totalCost: 5, status: 'Rejected' }], {})).toEqual([]);
    expect(monthlyWithLastYear([], {})).toEqual([]);
  });
});
