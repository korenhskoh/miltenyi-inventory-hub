import { describe, it, expect } from 'vitest';
import { wantsAll, paginate, limitClause, envelope } from './pagination.js';

describe('wantsAll', () => {
  it('accepts the plain flag', () => {
    expect(wantsAll({ all: 'true' })).toBe(true);
    expect(wantsAll({ all: '1' })).toBe(true);
  });
  it('accepts a repeated ?all=true&all=true (Express gives an array)', () => {
    // A duplicated param used to fail the equality check, silently paging the
    // caller to 50 rows when they had asked for everything.
    expect(wantsAll({ all: ['true', 'true'] })).toBe(true);
  });
  it('rejects anything else', () => {
    expect(wantsAll({})).toBe(false);
    expect(wantsAll({ all: 'false' })).toBe(false);
    expect(wantsAll({ all: ['false'] })).toBe(false);
  });
});

describe('limitClause', () => {
  it('returns no clause when all rows are wanted', () => {
    expect(limitClause({ query: { all: 'true' } }, 1)).toEqual({ clause: '', params: [] });
  });
  it('binds LIMIT/OFFSET at the given placeholder index', () => {
    const r = limitClause({ query: { page: '2', limit: '25' } }, 3);
    expect(r.clause).toBe(' LIMIT $3 OFFSET $4');
    expect(r.params).toEqual([25, 25]);
  });
});

describe('paginate (server)', () => {
  it('defaults to 50 and caps at 200', () => {
    expect(paginate({}).pageSize).toBe(50);
    expect(paginate({ limit: '5000' }).pageSize).toBe(200);
    expect(paginate({ page: '3', limit: '10' }).offset).toBe(20);
  });
});

describe('envelope', () => {
  it('never reports pageSize 0', () => {
    expect(envelope([], 0, 1, 0).pageSize).toBe(1);
    expect(envelope([1, 2], 2, 1, 50).pageSize).toBe(50);
  });
});
