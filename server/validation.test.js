import { describe, it, expect } from 'vitest';
import { pickAllowed, requireFields } from './validation.js';

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
