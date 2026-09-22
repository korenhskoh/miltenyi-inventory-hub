import { describe, it, expect } from 'vitest';
import { isCloseOut, isApprovalDecision, isApprovalReset } from './orders.js';

/**
 * These three predicates decide which writes need which permission, so a
 * mistake in them either blocks legitimate work or lets the approval workflow
 * be skipped. Both happened.
 */
describe('isCloseOut', () => {
  it('does not treat the zero every new order carries as a delivery', () => {
    // The New Order form always sends qtyReceived: 0 — it is how the column is
    // initialised. Treating that as a close-out demanded the approvals
    // permission, so nobody except an admin or an approver could raise an order
    // at all, while admins saw nothing wrong because their check short-circuits.
    expect(isCloseOut({ qty_received: 0 })).toBe(false);
    expect(isCloseOut({ qty_received: '0' })).toBe(false);
  });

  it('still catches a real close-out', () => {
    expect(isCloseOut({ qty_received: 5 })).toBe(true);
    expect(isCloseOut({ qty_received: '5' })).toBe(true);
    expect(isCloseOut({ status: 'Received' })).toBe(true);
    expect(isCloseOut({ status: 'received' })).toBe(true);
  });

  it('ignores an unusable quantity rather than guessing', () => {
    expect(isCloseOut({ qty_received: null })).toBe(false);
    expect(isCloseOut({ qty_received: 'lots' })).toBe(false);
    expect(isCloseOut({})).toBe(false);
  });
});

describe('isApprovalDecision', () => {
  it('recognises an approval or rejection however it is spelled', () => {
    expect(isApprovalDecision({ approval_status: 'approved' })).toBe(true);
    expect(isApprovalDecision({ approval_status: 'REJECTED' })).toBe(true);
    expect(isApprovalDecision({ status: 'Approved' })).toBe(true);
  });

  it('leaves an ordinary status change alone', () => {
    expect(isApprovalDecision({ status: 'Ordered' })).toBe(false);
    expect(isApprovalDecision({ quantity: 4 })).toBe(false);
  });
});

describe('isApprovalReset', () => {
  it('catches an order being pulled back out of approval', () => {
    // Without this, an approved order could be sent back to Pending Approval by
    // anyone, and then re-approved on a quantity nobody reviewed.
    expect(isApprovalReset({ status: 'Pending Approval' })).toBe(true);
    expect(isApprovalReset({ approval_status: 'pending' })).toBe(true);
  });

  it('does not fire on a new order, which is legitimately born pending', () => {
    expect(isApprovalReset({ status: 'Pending' })).toBe(false);
  });
});
