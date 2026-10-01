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

describe('pickAllowed — deliberately clearing a field', () => {
  // Dropping every null made "remove this line from its batch" (bulkGroupId:
  // null) arrive at the server as an empty body, answered with 400 "No fields
  // to update". The row disappeared from the modal optimistically and was back
  // after a reload, so the batch kept reporting its old item count.
  it('drops a null when the field is not listed as nullable', () => {
    expect(pickAllowed({ bulk_group_id: null }, ['bulk_group_id'])).toEqual({});
  });

  it('keeps a null for a field named in nullable, so the column is cleared', () => {
    const result = pickAllowed({ bulk_group_id: null }, ['bulk_group_id'], {
      nullable: new Set(['bulk_group_id']),
    });
    expect(result).toEqual({ bulk_group_id: null });
  });

  it('accepts nullable as a plain array as well as a Set', () => {
    expect(pickAllowed({ remark: null }, ['remark'], { nullable: ['remark'] })).toEqual({ remark: null });
  });

  it('still drops nulls for fields outside the nullable list', () => {
    // The point of an allow-list: clearing a batch id must not open the door to
    // blanking a quantity or a status by sending null for them.
    const result = pickAllowed(
      { bulk_group_id: null, quantity: null, status: null },
      ['bulk_group_id', 'quantity', 'status'],
      { nullable: new Set(['bulk_group_id']) },
    );
    expect(result).toEqual({ bulk_group_id: null });
  });

  it('keepNull still clears everything, regardless of the nullable list', () => {
    const result = pickAllowed({ a: null, b: null }, ['a', 'b'], { keepNull: true });
    expect(result).toEqual({ a: null, b: null });
  });

  it('leaves undefined alone even for a nullable field', () => {
    // undefined means "not mentioned in this edit"; null means "clear it".
    const result = pickAllowed({ bulk_group_id: undefined }, ['bulk_group_id'], {
      nullable: new Set(['bulk_group_id']),
    });
    expect(result).toEqual({});
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
