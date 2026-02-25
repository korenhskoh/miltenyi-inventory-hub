import { describe, it, expect } from 'vitest';
import { paginate, envelope } from './pagination.js';

describe('paginate', () => {
  it('returns defaults when no query params provided', () => {
    const result = paginate({});
    expect(result).toEqual({ page: 1, pageSize: 50, offset: 0 });
  });

  it('parses page and limit from query', () => {
    const result = paginate({ page: '3', limit: '20' });
    expect(result).toEqual({ page: 3, pageSize: 20, offset: 40 });
  });

  it('calculates correct offset', () => {
    expect(paginate({ page: '1', limit: '10' }).offset).toBe(0);
    expect(paginate({ page: '2', limit: '10' }).offset).toBe(10);
    expect(paginate({ page: '5', limit: '25' }).offset).toBe(100);
  });

  it('clamps page to minimum of 1', () => {
    expect(paginate({ page: '0' }).page).toBe(1);
    expect(paginate({ page: '-5' }).page).toBe(1);
  });

  it('falls back to default when limit is 0 (falsy)', () => {
    expect(paginate({ limit: '0' }).pageSize).toBe(50);
  });

  it('clamps negative limit to minimum of 1', () => {
    expect(paginate({ limit: '-10' }).pageSize).toBe(1);
  });

  it('clamps pageSize to maximum of 200', () => {
    expect(paginate({ limit: '500' }).pageSize).toBe(200);
    expect(paginate({ limit: '201' }).pageSize).toBe(200);
    expect(paginate({ limit: '200' }).pageSize).toBe(200);
  });

  it('handles non-numeric strings by falling back to defaults', () => {
    const result = paginate({ page: 'abc', limit: 'xyz' });
    expect(result).toEqual({ page: 1, pageSize: 50, offset: 0 });
  });
});

describe('envelope', () => {
  it('wraps rows with pagination metadata', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const result = envelope(rows, 50, 1, 25);
    expect(result).toEqual({ data: rows, total: 50, page: 1, pageSize: 25 });
  });

  it('returns empty data array when no rows', () => {
    const result = envelope([], 0, 1, 50);
    expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 50 });
  });

  it('preserves the original rows array reference', () => {
    const rows = [{ id: 1 }];
    const result = envelope(rows, 1, 1, 50);
    expect(result.data).toBe(rows);
  });
});
