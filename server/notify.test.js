import { describe, it, expect, vi, beforeEach } from 'vitest';

const cfg = {};
const users = [];
vi.mock('./db.js', () => ({
  query: vi.fn(async (sql) => {
    if (/FROM users/.test(sql)) return { rows: users };
    return { rows: [] }; // notif_log insert
  }),
}));
vi.mock('./routes/config.js', () => ({ getGlobalConfig: vi.fn(async (k) => cfg[k]) }));

const { notifyEvent, isRuleEnabled, fillTemplate, setWaContext } = await import('./notify.js');

const sent = [];
const ctx = {
  sendText: vi.fn(async (jid, text) => sent.push({ jid, text })),
  formatPhoneNumber: (p) => `${p}@s.whatsapp.net`,
};

describe('fillTemplate', () => {
  it('substitutes placeholders and blanks unknown ones', () => {
    expect(fillTemplate('Hi {name}, {n} items', { name: 'Sam', n: 3 })).toBe('Hi Sam, 3 items');
    expect(fillTemplate('{missing}!', {})).toBe('!');
  });

  it('tolerates empty input', () => {
    expect(fillTemplate('', {})).toBe('');
    expect(fillTemplate(null, {})).toBe('');
  });
});

describe('notifyEvent', () => {
  beforeEach(() => {
    sent.length = 0;
    users.length = 0;
    users.push({ name: 'A', phone: '91110000' }, { name: 'B', phone: '91110001' });
    cfg.waNotifyRules = { partArrivalDone: true, backOrderUpdate: false };
    cfg.waMessageTemplates = { partArrivalDone: { message: 'Arrived: {description} {qtyReceived}/{quantity}' } };
    setWaContext(() => ctx);
  });

  it('sends to every active user with a phone when the rule is on', async () => {
    const r = await notifyEvent('partArrivalDone', { description: 'Pump', qtyReceived: 5, quantity: 5 });
    expect(r.sent).toBe(2);
    expect(sent[0].text).toBe('Arrived: Pump 5/5');
    expect(sent[0].jid).toBe('91110000@s.whatsapp.net');
  });

  it('sends nothing when the rule is off', async () => {
    const r = await notifyEvent('backOrderUpdate', {});
    expect(r.skipped).toBe('rule-off');
    expect(sent).toHaveLength(0);
  });

  it('treats an unknown rule as off rather than messaging everyone', async () => {
    const r = await notifyEvent('notARealRule', {});
    expect(r.skipped).toBe('rule-off');
    expect(sent).toHaveLength(0);
  });

  it('skips quietly when WhatsApp is not connected', async () => {
    setWaContext(() => ({}));
    const r = await notifyEvent('partArrivalDone', {});
    expect(r.skipped).toBe('whatsapp-not-connected');
  });

  it('skips when there are no recipients', async () => {
    users.length = 0;
    const r = await notifyEvent('partArrivalDone', { description: 'x' });
    expect(r.skipped).toBe('no-recipients');
  });

  it('falls back to the built-in template when none is customised', async () => {
    cfg.waMessageTemplates = {};
    const r = await notifyEvent('partArrivalDone', {
      orderId: 'ORD-1',
      description: 'Pump',
      qtyReceived: 1,
      quantity: 1,
    });
    expect(r.sent).toBe(2);
    expect(sent[0].text.length).toBeGreaterThan(0);
  });

  it('reports a partial send rather than claiming success', async () => {
    let n = 0;
    setWaContext(() => ({
      ...ctx,
      sendText: vi.fn(async () => {
        if (n++ === 0) throw new Error('offline');
      }),
    }));
    const r = await notifyEvent('partArrivalDone', { description: 'x' });
    expect(r.sent).toBe(1);
    expect(r.of).toBe(2);
  });

  it('never throws — a failed notification must not break its caller', async () => {
    setWaContext(() => {
      throw new Error('boom');
    });
    await expect(notifyEvent('partArrivalDone', {})).resolves.toBeTruthy();
  });
});

describe('isRuleEnabled', () => {
  it('is false when config is missing entirely', async () => {
    delete cfg.waNotifyRules;
    expect(await isRuleEnabled('partArrivalDone')).toBe(false);
  });
});
