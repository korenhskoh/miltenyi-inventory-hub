import { describe, it, expect } from 'vitest';
import { corsOrigins, corsIsOpen } from './corsOrigins.js';

describe('corsOrigins', () => {
  it('reflects any origin when nothing is configured', () => {
    expect(corsOrigins(undefined)).toBe(true);
    expect(corsOrigins('')).toBe(true);
    expect(corsOrigins('   ')).toBe(true);
  });

  it('keeps a single URL working exactly as before', () => {
    expect(corsOrigins('https://app.example.com')).toEqual(['https://app.example.com']);
  });

  it('accepts the several addresses one desktop is reached by', () => {
    // Computer name on the LAN, raw address, and the VPN address -- all the
    // same server, all legitimate, and previously unexpressible.
    expect(corsOrigins('http://inventory-pc:3001, http://192.168.1.50:3001 ,http://10.8.0.4:3001')).toEqual([
      'http://inventory-pc:3001',
      'http://192.168.1.50:3001',
      'http://10.8.0.4:3001',
    ]);
  });

  it('strips a trailing slash, which never matches an Origin header', () => {
    // Browsers send "https://app.example.com" with no path, so a configured
    // "https://app.example.com/" would silently match nothing.
    expect(corsOrigins('https://app.example.com/')).toEqual(['https://app.example.com']);
    expect(corsOrigins('https://a.com//')).toEqual(['https://a.com']);
  });

  it('ignores empty entries from a stray comma', () => {
    expect(corsOrigins('https://a.com,,https://b.com,')).toEqual(['https://a.com', 'https://b.com']);
  });

  it('falls back to reflecting when the value is only separators', () => {
    expect(corsOrigins(', ,')).toBe(true);
  });
});

describe('corsIsOpen', () => {
  it('is true only when nothing usable was configured', () => {
    expect(corsIsOpen('')).toBe(true);
    expect(corsIsOpen(',')).toBe(true);
    expect(corsIsOpen('https://a.com')).toBe(false);
  });
});
