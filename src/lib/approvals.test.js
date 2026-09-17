import { describe, it, expect } from 'vitest';
import { ORDER_STATUS, approvalTransition } from './approvals.js';

describe('approvalTransition', () => {
  it('maps approve → Approved/approved', () => {
    expect(approvalTransition('approve')).toEqual({ status: 'Approved', approvalStatus: 'approved' });
    expect(approvalTransition('approved')).toEqual({ status: ORDER_STATUS.APPROVED, approvalStatus: 'approved' });
  });
  it('maps reject → Rejected/rejected', () => {
    expect(approvalTransition('reject')).toEqual({ status: 'Rejected', approvalStatus: 'rejected' });
    expect(approvalTransition('rejected')).toEqual({ status: ORDER_STATUS.REJECTED, approvalStatus: 'rejected' });
  });
  it('throws on an unknown decision', () => {
    expect(() => approvalTransition('maybe')).toThrow();
    expect(() => approvalTransition()).toThrow();
  });
  it('exposes the four order statuses', () => {
    expect(Object.values(ORDER_STATUS)).toEqual(['Pending Approval', 'Approved', 'Received', 'Rejected']);
  });
});
