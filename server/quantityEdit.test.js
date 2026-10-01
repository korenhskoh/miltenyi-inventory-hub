import { describe, it, expect } from 'vitest';
import { quantityEditOutcome } from './quantityEdit.js';

const order = (quantity, qty_received, status = 'Approved') => ({ quantity, qty_received, status });

describe('quantityEditOutcome', () => {
  it('refuses a reduction below what has already been received', () => {
    // 5 units are on the shelf with a movement behind them; an edit to a form
    // field must not quietly mean two of them never arrived.
    const r = quantityEditOutcome(order(5, 5, 'Received'), 3);
    expect(r.derived).toBeUndefined();
    expect(r.error).toMatch(/already been received/);
    expect(r.error).toMatch(/arrival/);
  });

  it('reopens a closed order when the quantity is raised above what arrived', () => {
    // The damaging case: this used to leave status=Received and back_order=0,
    // so three outstanding units never reached a back-order report.
    expect(quantityEditOutcome(order(5, 5, 'Received'), 8)).toEqual({
      derived: { back_order: -3, status: 'Approved' },
    });
  });

  it('closes an order when the quantity is lowered to exactly what arrived', () => {
    expect(quantityEditOutcome(order(8, 5, 'Approved'), 5)).toEqual({
      derived: { back_order: 0, status: 'Received' },
    });
  });

  it('recomputes the shortfall without touching a status that is already right', () => {
    const r = quantityEditOutcome(order(5, 2, 'Approved'), 9);
    expect(r).toEqual({ derived: { back_order: -7 } });
  });

  it('leaves a status alone when the order is still open either way', () => {
    expect(quantityEditOutcome(order(5, 0, 'Pending'), 7)).toEqual({ derived: { back_order: -7 } });
  });

  it('allows any raise when nothing has been received', () => {
    expect(quantityEditOutcome(order(2, 0, 'Pending'), 100)).toEqual({ derived: { back_order: -100 } });
  });

  it('allows a reduction when nothing has been received', () => {
    expect(quantityEditOutcome(order(10, 0, 'Pending'), 1)).toEqual({ derived: { back_order: -1 } });
  });

  it('treats an unchanged quantity as the no-op it is', () => {
    expect(quantityEditOutcome(order(5, 5, 'Received'), 5)).toEqual({ derived: { back_order: 0 } });
  });

  it('refuses a negative quantity', () => {
    expect(quantityEditOutcome(order(5, 0), -1).error).toMatch(/non-negative/);
  });

  it('rounds a fractional quantity rather than storing one', () => {
    // The column is an INTEGER; a fraction would be rounded by Postgres anyway,
    // and back_order has to be computed from the value that is actually stored.
    expect(quantityEditOutcome(order(5, 2), 4.4)).toEqual({ derived: { back_order: -2 } });
  });

  it('handles a zero quantity without claiming it is received', () => {
    // 0 ordered and 0 received is not a completed delivery.
    expect(quantityEditOutcome(order(5, 0, 'Pending'), 0)).toEqual({ derived: { back_order: 0 } });
  });

  it('reads missing fields as zero rather than NaN', () => {
    expect(quantityEditOutcome({}, 3)).toEqual({ derived: { back_order: -3 } });
  });
});
