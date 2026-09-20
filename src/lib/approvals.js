// Order status constants and the approve / reject state transition, so the single,
// bulk and batch approval handlers share one source of truth.

export const ORDER_STATUS = Object.freeze({
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  RECEIVED: 'Received',
  REJECTED: 'Rejected',
});

/**
 * Fields to apply to an order for an approval decision.
 * @param {'approve'|'reject'|'approved'|'rejected'} decision
 * @returns {{ status: string, approvalStatus: 'approved'|'rejected' }}
 */
export function approvalTransition(decision) {
  const d = String(decision || '').toLowerCase();
  if (d === 'approve' || d === 'approved') {
    return { status: ORDER_STATUS.APPROVED, approvalStatus: 'approved' };
  }
  if (d === 'reject' || d === 'rejected') {
    return { status: ORDER_STATUS.REJECTED, approvalStatus: 'rejected' };
  }
  throw new Error(`Unknown approval decision: ${decision}`);
}
