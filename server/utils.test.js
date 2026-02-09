import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake } from './utils.js';

describe('snakeToCamel', () => {
  it('converts single snake_case key to camelCase', () => {
    expect(snakeToCamel({ order_date: '2026-01-01' })).toEqual({ orderDate: '2026-01-01' });
  });

  it('converts multiple snake_case keys', () => {
    expect(snakeToCamel({
      material_no: '130-001',
      total_cost: 100,
      order_by: 'Admin',
    })).toEqual({
      materialNo: '130-001',
      totalCost: 100,
      orderBy: 'Admin',
    });
  });

  it('leaves already-camelCase keys unchanged', () => {
    expect(snakeToCamel({ id: '1', name: 'Test' })).toEqual({ id: '1', name: 'Test' });
  });

  it('returns null for null input', () => {
    expect(snakeToCamel(null)).toBeNull();
  });

  it('returns undefined for undefined input', () => {
    expect(snakeToCamel(undefined)).toBeUndefined();
  });

  it('handles empty object', () => {
    expect(snakeToCamel({})).toEqual({});
  });

  it('handles keys with multiple underscores', () => {
    expect(snakeToCamel({ approval_sent_date: '2026-01-01' })).toEqual({ approvalSentDate: '2026-01-01' });
  });

  it('preserves values of all types', () => {
    expect(snakeToCamel({
      num_val: 42,
      bool_val: true,
      null_val: null,
      arr_val: [1, 2],
      obj_val: { nested: true },
    })).toEqual({
      numVal: 42,
      boolVal: true,
      nullVal: null,
      arrVal: [1, 2],
      objVal: { nested: true },
    });
  });
});

describe('camelToSnake', () => {
  it('converts single camelCase key to snake_case', () => {
    expect(camelToSnake({ orderDate: '2026-01-01' })).toEqual({ order_date: '2026-01-01' });
  });

  it('converts multiple camelCase keys', () => {
    expect(camelToSnake({
      materialNo: '130-001',
      totalCost: 100,
      orderBy: 'Admin',
    })).toEqual({
      material_no: '130-001',
      total_cost: 100,
      order_by: 'Admin',
    });
  });

  it('leaves already-snake_case keys unchanged', () => {
    expect(camelToSnake({ id: '1', name: 'Test' })).toEqual({ id: '1', name: 'Test' });
  });

  it('returns null for null input', () => {
    expect(camelToSnake(null)).toBeNull();
  });

  it('returns undefined for undefined input', () => {
    expect(camelToSnake(undefined)).toBeUndefined();
  });

  it('handles empty object', () => {
    expect(camelToSnake({})).toEqual({});
  });

  it('handles keys with consecutive uppercase letters', () => {
    // e.g. "rspEUR" should become "rsp_e_u_r" (each uppercase gets an underscore)
    const result = camelToSnake({ rspEUR: 100 });
    expect(result).toHaveProperty('rsp_e_u_r', 100);
  });

  it('is inverse of snakeToCamel for standard keys', () => {
    const original = { order_date: '2026-01-01', total_cost: 100, material_no: 'X' };
    const camel = snakeToCamel(original);
    const backToSnake = camelToSnake(camel);
    expect(backToSnake).toEqual(original);
  });
});
