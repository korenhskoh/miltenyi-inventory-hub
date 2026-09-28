/**
 * Route stray console output through the application logger.
 *
 * Baileys is handed a logger set to 'silent', but the `libsignal` package it
 * depends on does not use that logger at all — `decryptWithSessions` calls
 * `console.error` directly (node_modules/libsignal/src/session_cipher.js).
 * One WhatsApp message the socket cannot decrypt prints "Failed to decrypt
 * message with any known session..." plus a full stack trace for EVERY stale
 * session it tried, so a single message is worth dozens of lines.
 *
 * Measured on the live deployment: 84 of 119 log lines over three hours — 70%
 * of everything — came from this, against 7 actual request lines. It buries
 * real errors, and it makes a healthy deployment look broken.
 *
 * The failure itself is benign: Baileys asks the sender to retry with a fresh
 * session and carries on, which is why the app stayed up and connected
 * throughout. So these lines are demoted to debug rather than dropped — they
 * are still there under LOG_LEVEL=debug when a decryption problem needs
 * investigating. Everything else written to the console is passed through to
 * the logger properly, so a genuine console.error from any dependency becomes
 * a structured log line instead of disappearing.
 */

/** Console output that is known noise from libsignal's decryption retries. */
const BENIGN = [
  /Failed to decrypt message with any known session/i,
  /Session error:.*Bad MAC/i,
  /^\s+at .*libsignal/i,
  /Closing (open |stale open )?session/i,
  /SessionError: No matching sessions found for message/i,
];

function isBenign(text) {
  return BENIGN.some((re) => re.test(text));
}

/** Flatten console arguments into one string for matching. */
function render(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

/**
 * Redirect console.{log,info,warn,error,debug} into `logger`.
 * Returns a function that puts the original console back, for tests.
 */
export function installConsoleBridge(logger) {
  const original = { ...console };
  const forward = (level) =>
    function bridged(...args) {
      const text = render(args);
      if (isBenign(text)) {
        logger.debug({ source: 'libsignal' }, text);
        return;
      }
      logger[level]({ source: 'console' }, text);
    };

  console.log = forward('info');
  console.info = forward('info');
  console.debug = forward('debug');
  console.warn = forward('warn');
  console.error = forward('error');

  return function restoreConsole() {
    Object.assign(console, original);
  };
}

export const __testing = { isBenign, render };
