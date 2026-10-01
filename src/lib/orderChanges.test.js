import { describe, it, expect } from 'vitest';
import { deletionImpact, deletionWarning, hasSideEffects, writeFailed, failureReason } from './orderChanges.js';

const orders = [
  { id: 'ORD-1', bulkGroupId: 'BG-1', qtyReceived: 6, quantity: 10, materialNo: 'MAT-1', approvalStatus: 'approved' },
  { id: 'ORD-2', bulkGroupId: 'BG-1', qtyReceived: 0, quantity: 10, materialNo: 'MAT-2', approvalStatus: 'approved' },
  { id: 'ORD-3', bulkGroupId: 'BG-2', qtyReceived: 0, quantity: 5, materialNo: 'MAT-3', approvalStatus: 'pending' },
  { id: 'ORD-4', qtyReceived: 0, quantity: 5, materialNo: 'MAT-4', approvalStatus: 'pending' },
];

describe('what a deletion actually touches', () => {
  it('counts stock already booked in against the order', () => {
    // Verified against the server: deleting an order leaves its received units
    // in Local Inventory, with a movement pointing at an order that is gone.
    const i = deletionImpact([orders[0]], orders);
    expect(i.receivedUnits).toBe(6);
    expect(i.partsWithStock).toEqual([{ id: 'ORD-1', materialNo: 'MAT-1', qtyReceived: 6 }]);
  });

  it('names the batch whose tally will be recalculated', () => {
    expect(deletionImpact([orders[0]], orders).affectedGroups).toEqual(['BG-1']);
  });

  it('spots a batch that is being emptied, not merely reduced', () => {
    expect(deletionImpact([orders[0]], orders).emptiedGroups).toEqual([]);
    expect(deletionImpact([orders[0], orders[1]], orders).emptiedGroups).toEqual(['BG-1']);
    expect(deletionImpact([orders[2]], orders).emptiedGroups).toEqual(['BG-2']);
  });

  it('reports a standalone order with nothing received as harmless', () => {
    const i = deletionImpact([orders[3]], orders);
    expect(i.receivedUnits).toBe(0);
    expect(i.affectedGroups).toEqual([]);
    expect(hasSideEffects([orders[3]], orders)).toBe(false);
  });

  it('flags any deletion that reaches beyond the order itself', () => {
    expect(hasSideEffects([orders[0]], orders)).toBe(true);
    expect(hasSideEffects([orders[2]], orders)).toBe(true);
  });
});

describe('the confirmation text', () => {
  it('warns that deleting does not return the stock', () => {
    const text = deletionWarning([orders[0]], orders);
    expect(text).toMatch(/6 unit\(s\) have already been booked into Local Inventory/);
    expect(text).toMatch(/does NOT take them back out of stock/);
    expect(text).toMatch(/MAT-1 \(6\)/);
  });

  it('warns that the batch will be recalculated, and when it will vanish', () => {
    expect(deletionWarning([orders[0]], orders)).toMatch(/BG-1/);
    expect(deletionWarning([orders[0], orders[1]], orders)).toMatch(/left empty and removed entirely/);
  });

  it('still names the order and says it cannot be undone when nothing else is affected', () => {
    const text = deletionWarning([orders[3]], orders);
    expect(text).toMatch(/Delete order ORD-4\?/);
    expect(text).toMatch(/cannot be undone/);
    expect(text).not.toMatch(/Local Inventory/);
  });

  it('counts the orders when several are selected', () => {
    expect(deletionWarning([orders[1], orders[3]], orders)).toMatch(/Delete 2 orders\?/);
  });
});

describe('deciding that a write did not happen', () => {
  it('treats every failure shape as a failure', () => {
    // The order API answers in three shapes and an optimistic change has to be
    // undone for all of them.
    expect(writeFailed(null)).toBe(true);
    expect(writeFailed(false)).toBe(true);
    expect(writeFailed(undefined)).toBe(true);
    expect(writeFailed({ ok: false, error: 'You can only edit your own orders' })).toBe(true);
    expect(writeFailed({ error: 'Permission required: deleteOrders' })).toBe(true);
  });

  it('does not throw away a successful write', () => {
    // The opposite mistake loses a good edit.
    expect(writeFailed({ ok: true })).toBe(false);
    expect(writeFailed({ ok: true, order: { id: 'ORD-1' } })).toBe(false);
    expect(writeFailed({ id: 'ORD-1', quantity: 4 })).toBe(false);
    expect(writeFailed({ success: true })).toBe(false);
  });

  it('surfaces the server’s own reason when it gave one', () => {
    expect(failureReason({ ok: false, error: 'You can only edit your own orders' })).toBe(
      'You can only edit your own orders',
    );
    expect(failureReason(null, 'ORD-1 was not saved.')).toBe('ORD-1 was not saved.');
    expect(failureReason(false)).toMatch(/put back/);
  });
});
