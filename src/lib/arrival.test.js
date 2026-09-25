import { describe, it, expect } from 'vitest';
import { computeArrival, arrivalDelta, arrivalCondition } from './arrival.js';

describe('computeArrival', () => {
  const order = { quantity: 5, qtyReceived: 2, status: 'Approved' };
  it('keeps the current status and a negative backOrder on partial delivery', () => {
    expect(computeArrival(order, 3)).toEqual({ qtyReceived: 3, backOrder: -2, status: 'Approved' });
  });
  it('marks Received with backOrder 0 on full delivery', () => {
    expect(computeArrival(order, 5)).toEqual({ qtyReceived: 5, backOrder: 0, status: 'Received' });
  });
  it('handles over-delivery and string input', () => {
    expect(computeArrival(order, '7')).toEqual({ qtyReceived: 7, backOrder: 2, status: 'Received' });
  });
  it('treats nothing received as -quantity', () => {
    expect(computeArrival({ quantity: 4, status: 'Pending Approval' }, undefined)).toEqual({
      qtyReceived: 0,
      backOrder: -4,
      status: 'Pending Approval',
    });
  });
});

describe('arrivalDelta', () => {
  it('returns the newly received units', () => {
    expect(arrivalDelta({ qtyReceived: 2 }, 5)).toBe(3);
    expect(arrivalDelta({ qtyReceived: 5 }, 5)).toBe(0);
    expect(arrivalDelta({}, 4)).toBe(4);
    expect(arrivalDelta({ qtyReceived: 3 }, 1)).toBe(-2);
  });
});

describe('arrivalCondition', () => {
  it('calls a short delivery a back order even with no arrival date', () => {
    // The workbooks routinely fill the received count and leave the arrival
    // date blank. Every consumer used to require the date, so this row was
    // labelled "0/10 Awaiting" beside an input showing 4, and was counted in
    // none of the three headline tiles.
    expect(arrivalCondition({ quantity: 10, qtyReceived: 4, arrivalDate: '' })).toBe('Back Order');
    expect(arrivalCondition({ quantity: 10, qtyReceived: 4, arrivalDate: '2026-02-20' })).toBe('Back Order');
  });

  it('calls a complete delivery arrived', () => {
    expect(arrivalCondition({ quantity: 4, qtyReceived: 4 })).toBe('Arrived');
    expect(arrivalCondition({ quantity: 4, qtyReceived: 9 })).toBe('Arrived');
  });

  it('calls an untouched order awaiting', () => {
    expect(arrivalCondition({ quantity: 10, qtyReceived: 0 })).toBe('Awaiting');
    expect(arrivalCondition({})).toBe('Awaiting');
  });

  it('never calls a zero-quantity row arrived', () => {
    // An imported row with a blank quantity cell. `0 >= 0` used to make it
    // fully received, which let one unreadable row close out a whole batch.
    expect(arrivalCondition({ quantity: 0, qtyReceived: 0 })).toBe('Awaiting');
  });

  it('the three conditions partition the orders, so the tiles sum to the table', () => {
    const orders = [
      { quantity: 10, qtyReceived: 0 },
      { quantity: 10, qtyReceived: 4, arrivalDate: '' },
      { quantity: 4, qtyReceived: 4 },
      { quantity: 0, qtyReceived: 0 },
    ];
    const counts = orders.map(arrivalCondition);
    expect(counts.filter((c) => c === 'Awaiting')).toHaveLength(2);
    expect(counts.filter((c) => c === 'Back Order')).toHaveLength(1);
    expect(counts.filter((c) => c === 'Arrived')).toHaveLength(1);
    expect(counts).toHaveLength(orders.length);
  });
});

describe('computeArrival refuses to close out a zero-quantity line', () => {
  it('leaves the status alone when the quantity is unknown', () => {
    const o = { quantity: 0, qtyReceived: 0, status: 'Pending Approval' };
    expect(computeArrival(o, 0).status).toBe('Pending Approval');
  });
});
