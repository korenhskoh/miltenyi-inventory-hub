import { describe, it, expect } from 'vitest';
import { approvalOrderIds, supersededApprovalIds } from './approvalSupersede.js';

const pending = (id, orderIds, extra = {}) => ({ id, status: 'pending', order_ids: orderIds, ...extra });

describe('approvalOrderIds', () => {
  it('reads the order_ids array', () => {
    expect([...approvalOrderIds({ order_ids: ['A', 'B'] })]).toEqual(['A', 'B']);
  });

  it('reads order_ids when it arrives as a JSON string', () => {
    expect([...approvalOrderIds({ order_ids: '["A","B"]' })]).toEqual(['A', 'B']);
  });

  it('accepts the camelCase shape the client sends', () => {
    expect([...approvalOrderIds({ orderIds: ['A'] })]).toEqual(['A']);
  });

  it('falls back to a comma-joined order_id', () => {
    expect([...approvalOrderIds({ order_id: 'A, B' })]).toEqual(['A', 'B']);
  });

  it('prefers order_ids over order_id when both are present', () => {
    // A bulk send puts the GROUP id in order_id, which is not an order id at
    // all, so reading both would invent a member that does not exist.
    expect([...approvalOrderIds({ order_id: 'BG-1', order_ids: ['A'] })]).toEqual(['A']);
  });

  it('is empty for a row with neither', () => {
    expect(approvalOrderIds({}).size).toBe(0);
  });

  it('ignores blanks and unparseable JSON', () => {
    expect(approvalOrderIds({ order_ids: 'not json' }).size).toBe(0);
    expect(approvalOrderIds({ order_id: ' , , ' }).size).toBe(0);
  });
});

describe('supersededApprovalIds', () => {
  it('supersedes an open approval covering the same orders', () => {
    const existing = [pending('APR-1', ['ORD-R1', 'ORD-R2'])];
    expect(supersededApprovalIds(existing, { id: 'APR-2', order_ids: ['ORD-R1', 'ORD-R2'] })).toEqual(['APR-1']);
  });

  it('supersedes on a partial overlap', () => {
    // The batch was edited and resent; the old row still claims an order the
    // new one covers, so acting on it would decide that order twice.
    const existing = [pending('APR-1', ['ORD-A', 'ORD-B'])];
    expect(supersededApprovalIds(existing, { id: 'APR-2', order_ids: ['ORD-B', 'ORD-C'] })).toEqual(['APR-1']);
  });

  it('leaves approvals for unrelated orders alone', () => {
    const existing = [pending('APR-1', ['ORD-X'])];
    expect(supersededApprovalIds(existing, { id: 'APR-2', order_ids: ['ORD-Y'] })).toEqual([]);
  });

  it('never touches a row that already has a decision', () => {
    // This is the bug in reverse: an approved row is a record of a decision
    // that was made, not a stale request.
    const existing = [
      { id: 'APR-1', status: 'approved', order_ids: ['ORD-R1'] },
      { id: 'APR-2', status: 'rejected', order_ids: ['ORD-R1'] },
      pending('APR-3', ['ORD-R1']),
    ];
    expect(supersededApprovalIds(existing, { id: 'APR-4', order_ids: ['ORD-R1'] })).toEqual(['APR-3']);
  });

  it('never supersedes the incoming row itself', () => {
    const existing = [pending('APR-2', ['ORD-R1'])];
    expect(supersededApprovalIds(existing, { id: 'APR-2', order_ids: ['ORD-R1'] })).toEqual([]);
  });

  it('supersedes several open rows at once', () => {
    const existing = [pending('APR-1', ['ORD-A']), pending('APR-2', ['ORD-B']), pending('APR-3', ['ORD-Z'])];
    expect(supersededApprovalIds(existing, { id: 'APR-9', order_ids: ['ORD-A', 'ORD-B'] })).toEqual(['APR-1', 'APR-2']);
  });

  it('does nothing when the incoming approval names no orders', () => {
    // Without an order set there is nothing to compare, and superseding
    // everything open would be far worse than leaving it be.
    const existing = [pending('APR-1', ['ORD-A'])];
    expect(supersededApprovalIds(existing, { id: 'APR-2' })).toEqual([]);
  });

  it('matches a single-order resend against a batch row', () => {
    const existing = [pending('APR-1', null, { order_id: 'ORD-A, ORD-B' })];
    expect(supersededApprovalIds(existing, { id: 'APR-2', order_id: 'ORD-B' })).toEqual(['APR-1']);
  });

  it('tolerates nulls in the existing list', () => {
    expect(supersededApprovalIds([null, undefined], { id: 'A', order_ids: ['X'] })).toEqual([]);
  });
});
