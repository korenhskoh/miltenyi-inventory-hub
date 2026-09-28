import { describe, it, expect, vi } from 'vitest';
import { installConsoleBridge, __testing } from './consoleBridge.js';

const fakeLogger = () => {
  const calls = { debug: [], info: [], warn: [], error: [] };
  return {
    calls,
    debug: (...a) => calls.debug.push(a),
    info: (...a) => calls.info.push(a),
    warn: (...a) => calls.warn.push(a),
    error: (...a) => calls.error.push(a),
  };
};

describe('libsignal noise detection', () => {
  const { isBenign } = __testing;

  it('recognises the decryption noise that flooded the deployment logs', () => {
    // Real lines taken from the Railway deploy log: 84 of 119 lines over three
    // hours were these, against 7 actual request lines.
    expect(isBenign('Failed to decrypt message with any known session...')).toBe(true);
    expect(isBenign('Session error:Error: Bad MAC Error: Bad MAC')).toBe(true);
    expect(isBenign('    at Object.verifyMAC (/app/node_modules/libsignal/src/crypto.js:87:15)')).toBe(true);
  });

  it('does not swallow a real error', () => {
    expect(isBenign('Error: connect ECONNREFUSED 127.0.0.1:5432')).toBe(false);
    expect(isBenign('TypeError: cannot read properties of undefined')).toBe(false);
    expect(isBenign('Something genuinely broke')).toBe(false);
  });
});

describe('console bridge', () => {
  it('sends the noise to debug and everything else to its own level', () => {
    const log = fakeLogger();
    const restore = installConsoleBridge(log);
    try {
      console.error('Session error:Error: Bad MAC');
      console.error('Database connection lost');
      console.warn('deprecated thing');
      console.log('hello');
    } finally {
      restore();
    }
    expect(log.calls.debug).toHaveLength(1);
    expect(log.calls.error).toHaveLength(1);
    expect(log.calls.error[0][1]).toBe('Database connection lost');
    expect(log.calls.warn).toHaveLength(1);
    expect(log.calls.info).toHaveLength(1);
  });

  it('renders an Error argument with its stack, so nothing is lost', () => {
    const log = fakeLogger();
    const restore = installConsoleBridge(log);
    try {
      console.error(new Error('boom'));
    } finally {
      restore();
    }
    expect(log.calls.error[0][1]).toContain('boom');
  });

  it('puts the original console back', () => {
    const before = console.error;
    const restore = installConsoleBridge(fakeLogger());
    expect(console.error).not.toBe(before);
    restore();
    expect(console.error).toBe(before);
  });

  it('survives an argument that cannot be serialised', () => {
    const log = fakeLogger();
    const circular = {};
    circular.self = circular;
    const restore = installConsoleBridge(log);
    try {
      expect(() => console.log(circular)).not.toThrow();
    } finally {
      restore();
    }
    expect(log.calls.info).toHaveLength(1);
  });
});
