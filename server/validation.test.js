import { describe, it, expect } from 'vitest';
import { pickAllowed, requireFields, sanitizeDates } from './validation.js';

describe('pickAllowed', () => {
  it('keeps only allowed fields from input object', () => {
    const allowed = ['name', 'email', 'phone'];
    const input = { name: 'Alice', email: 'a@b.com', phone: '123', role: 'admin', password: 'secret' };
    const result = pickAllowed(input, allowed);
    expect(result).toEqual({ name: 'Alice', email: 'a@b.com', phone: '123' });
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('password');
  });

  it('returns empty object when no fields match', () => {
    const result = pickAllowed({ foo: 'bar' }, ['name']);
    expect(result).toEqual({});
  });

  it('skips undefined and null values', () => {
    const result = pickAllowed({ name: 'Alice', email: undefined, phone: null }, ['name', 'email', 'phone']);
    expect(result).toEqual({ name: 'Alice' });
  });

  it('keeps empty string and zero values', () => {
    const result = pickAllowed({ name: '', count: 0 }, ['name', 'count']);
    expect(result).toEqual({ name: '', count: 0 });
  });
});

describe('requireFields', () => {
  it('returns null when all required fields are present', () => {
    const err = requireFields({ name: 'Alice', email: 'a@b.com' }, ['name', 'email']);
    expect(err).toBeNull();
  });

  it('returns error message listing missing fields', () => {
    const err = requireFields({ name: 'Alice' }, ['name', 'email', 'phone']);
    expect(err).toContain('email');
    expect(err).toContain('phone');
  });

  it('treats empty string as missing', () => {
    const err = requireFields({ name: '' }, ['name']);
    expect(err).toContain('name');
  });

  it('treats null/undefined as missing', () => {
    const err = requireFields({ a: null, b: undefined }, ['a', 'b']);
    expect(err).toContain('a');
    expect(err).toContain('b');
  });

  it('returns null when required list is empty', () => {
    const err = requireFields({}, []);
    expect(err).toBeNull();
  });
});

describe('sanitizeDates', () => {
  it('removes empty string date fields', () => {
    const obj = { order_date: '', description: 'Test', arrival_date: '2026-02-25' };
    const result = sanitizeDates(obj, ['order_date', 'arrival_date']);
    expect(result).not.toHaveProperty('order_date');
    expect(result).toHaveProperty('arrival_date', '2026-02-25');
    expect(result).toHaveProperty('description', 'Test');
  });

  it('removes undefined date fields', () => {
    const obj = { order_date: undefined, status: 'Pending' };
    const result = sanitizeDates(obj, ['order_date']);
    expect(result).not.toHaveProperty('order_date');
    expect(result).toHaveProperty('status', 'Pending');
  });

  it('keeps valid date values untouched', () => {
    const obj = { order_date: '2026-01-15', arrival_date: '2026-02-01' };
    const result = sanitizeDates(obj, ['order_date', 'arrival_date']);
    expect(result).toEqual({ order_date: '2026-01-15', arrival_date: '2026-02-01' });
  });

  it('keeps null date values (only removes empty string and undefined)', () => {
    const obj = { order_date: null };
    const result = sanitizeDates(obj, ['order_date']);
    expect(result).toHaveProperty('order_date', null);
  });

  it('ignores date fields not present in the object', () => {
    const obj = { description: 'Test' };
    const result = sanitizeDates(obj, ['order_date', 'arrival_date']);
    expect(result).toEqual({ description: 'Test' });
  });

  it('returns the same object reference (mutates in place)', () => {
    const obj = { order_date: '' };
    const result = sanitizeDates(obj, ['order_date']);
    expect(result).toBe(obj);
  });

  it('handles empty dateFields array', () => {
    const obj = { order_date: '', status: 'Pending' };
    const result = sanitizeDates(obj, []);
    expect(result).toEqual({ order_date: '', status: 'Pending' });
  });

  it('handles multiple empty date fields', () => {
    const obj = { order_date: '', arrival_date: '', approval_sent_date: undefined, status: 'OK' };
    const result = sanitizeDates(obj, ['order_date', 'arrival_date', 'approval_sent_date']);
    expect(result).not.toHaveProperty('order_date');
    expect(result).not.toHaveProperty('arrival_date');
    expect(result).not.toHaveProperty('approval_sent_date');
    expect(result).toHaveProperty('status', 'OK');
  });
});
