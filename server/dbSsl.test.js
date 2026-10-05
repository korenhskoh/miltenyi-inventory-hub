import { describe, it, expect } from 'vitest';
import { databaseSsl, DATABASE_SSL_MODES } from './dbSsl.js';

describe('databaseSsl', () => {
  describe('with DATABASE_SSL unset, the old behaviour is preserved exactly', () => {
    // Anything already deployed keeps working until its own config says otherwise.
    it('uses unverified TLS in production', () => {
      expect(databaseSsl({ NODE_ENV: 'production' })).toEqual({ rejectUnauthorized: false });
    });

    it('uses no TLS anywhere else', () => {
      expect(databaseSsl({ NODE_ENV: 'development' })).toBe(false);
      expect(databaseSsl({ NODE_ENV: 'test' })).toBe(false);
      expect(databaseSsl({})).toBe(false);
    });

    it('treats an empty or blank value as unset', () => {
      expect(databaseSsl({ DATABASE_SSL: '', NODE_ENV: 'production' })).toEqual({ rejectUnauthorized: false });
      expect(databaseSsl({ DATABASE_SSL: '   ', NODE_ENV: 'development' })).toBe(false);
    });
  });

  describe('disable', () => {
    it('turns TLS off even in production', () => {
      // The whole point: a PostgreSQL on the same machine has no TLS, and the
      // app must still run with its production guards in place.
      expect(databaseSsl({ DATABASE_SSL: 'disable', NODE_ENV: 'production' })).toBe(false);
    });

    it('accepts the obvious synonyms', () => {
      expect(databaseSsl({ DATABASE_SSL: 'false', NODE_ENV: 'production' })).toBe(false);
      expect(databaseSsl({ DATABASE_SSL: 'off', NODE_ENV: 'production' })).toBe(false);
    });
  });

  describe('no-verify', () => {
    it('uses TLS without checking the certificate', () => {
      expect(databaseSsl({ DATABASE_SSL: 'no-verify', NODE_ENV: 'development' })).toEqual({
        rejectUnauthorized: false,
      });
    });
  });

  describe('require', () => {
    it('uses TLS and checks the certificate', () => {
      expect(databaseSsl({ DATABASE_SSL: 'require', NODE_ENV: 'development' })).toEqual({
        rejectUnauthorized: true,
      });
    });

    it('accepts the obvious synonyms', () => {
      expect(databaseSsl({ DATABASE_SSL: 'true' })).toEqual({ rejectUnauthorized: true });
      expect(databaseSsl({ DATABASE_SSL: 'on' })).toEqual({ rejectUnauthorized: true });
    });
  });

  it('ignores case and surrounding whitespace', () => {
    // A value pasted out of a document or an .env file often carries both.
    expect(databaseSsl({ DATABASE_SSL: '  DISABLE  ', NODE_ENV: 'production' })).toBe(false);
    expect(databaseSsl({ DATABASE_SSL: 'No-Verify' })).toEqual({ rejectUnauthorized: false });
  });

  it('refuses a value it does not recognise instead of guessing', () => {
    // 'disabled' is the likely typo, and guessing wrong in this direction means
    // TLS silently switches on and the app will not connect at all — better to
    // say so at boot, naming the valid modes.
    expect(() => databaseSsl({ DATABASE_SSL: 'disabled' })).toThrow(/not a mode/);
    expect(() => databaseSsl({ DATABASE_SSL: 'disabled' })).toThrow(/disable, no-verify, require/);
    expect(() => databaseSsl({ DATABASE_SSL: 'yes' })).toThrow();
  });

  it('exports the modes it accepts, so the error and the docs cannot drift', () => {
    expect(DATABASE_SSL_MODES).toEqual(['disable', 'no-verify', 'require']);
    DATABASE_SSL_MODES.forEach((m) => expect(() => databaseSsl({ DATABASE_SSL: m })).not.toThrow());
  });
});
