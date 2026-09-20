import { describe, it, expect, vi } from 'vitest';
import { buildSenderMap, phoneDigits, jidDigits } from './waSenders.js';

const USERS = [
  { id: 'U1', username: 'admin', name: 'Admin', role: 'admin', phone: '+65 9123 4567' },
  { id: 'U2', username: 'eng1', name: 'Engineer One', role: 'user', phone: '91234568' },
  { id: 'U3', username: 'nophone', name: 'No Phone', role: 'user', phone: '' },
];

describe('phoneDigits', () => {
  it('strips formatting and adds the SG country code to 8-digit numbers', () => {
    expect(phoneDigits('+65 9123-4567')).toBe('6591234567');
    expect(phoneDigits('91234567')).toBe('6591234567');
  });

  it('returns empty for non-strings', () => {
    expect(phoneDigits(null)).toBe('');
    expect(phoneDigits(12345678)).toBe('');
  });
});

describe('jidDigits', () => {
  it('handles plain, device-suffixed and lid JIDs', () => {
    expect(jidDigits('6591234567@s.whatsapp.net')).toBe('6591234567');
    expect(jidDigits('6591234567:12@s.whatsapp.net')).toBe('6591234567');
    expect(jidDigits('6591234567@lid')).toBe('6591234567');
  });
});

describe('buildSenderMap', () => {
  it('maps every active user with a phone to their account', () => {
    const map = buildSenderMap(USERS, []);
    expect(map.get('6591234567')?.username).toBe('admin');
    expect(map.get('6591234568')?.username).toBe('eng1');
  });

  it('resolves a USERNAME on the allow-list to that account', () => {
    // This is the bug: the Settings UI saves usernames, the map is keyed by
    // digits, so 'admin' never matched anything and the list did nothing.
    const map = buildSenderMap([USERS[2]], ['admin'].concat([]), () => {});
    expect(map.size).toBe(0); // 'admin' is not among the passed users
    const full = buildSenderMap(USERS, ['admin']);
    expect(full.get('6591234567')?.username).toBe('admin');
  });

  it('warns when an allow-listed username has no phone on file', () => {
    const warn = vi.fn();
    buildSenderMap(USERS, ['nophone'], warn);
    expect(warn).toHaveBeenCalledWith('no_phone', 'nophone');
  });

  it('accepts a bare phone number with no account, bound to no permissions', () => {
    const map = buildSenderMap(USERS, ['+65 8111 2222']);
    expect(map.has('6581112222')).toBe(true);
    expect(map.get('6581112222')).toBe(null);
  });

  it('never downgrades a real account to null', () => {
    // The admin's own number also appearing on the allow-list must not strip
    // their permissions.
    const map = buildSenderMap(USERS, ['+65 9123 4567']);
    expect(map.get('6591234567')?.role).toBe('admin');
  });

  it('warns on junk entries instead of allowing them', () => {
    const warn = vi.fn();
    const map = buildSenderMap(USERS, ['not-a-user', '', null]);
    expect(map.has('not-a-user')).toBe(false);
    buildSenderMap(USERS, ['not-a-user'], warn);
    expect(warn).toHaveBeenCalledWith('unresolved', 'not-a-user');
  });

  it('accepts object entries with phone or username keys', () => {
    const map = buildSenderMap(USERS, [{ username: 'eng1' }, { phone: '+65 8222 3333' }]);
    expect(map.get('6591234568')?.username).toBe('eng1');
    expect(map.has('6582223333')).toBe(true);
  });

  it('tolerates a non-array config', () => {
    expect(() => buildSenderMap(USERS, null)).not.toThrow();
    expect(buildSenderMap(USERS, undefined).size).toBe(2);
  });
});
