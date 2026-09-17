import { describe, it, expect } from 'vitest';
import { computeArrival, arrivalDelta } from './arrival.js';

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
