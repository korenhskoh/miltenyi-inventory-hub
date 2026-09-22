import { describe, it, expect } from 'vitest';
import { firstPrice } from './waBotCommands.js';
import { messageTemplates } from './messageTemplates.js';

describe('WhatsApp order pricing', () => {
  it('skips a zero that arrived as a string', () => {
    // node-postgres returns NUMERIC as a STRING, so a column sitting at its
    // default of 0.00 arrives as '0.00' — which is truthy. The old
    // `a || b || c` therefore stopped at the zero and wrote the order at S$0,
    // and it went through approval costed at nothing.
    expect(firstPrice('0.00', '420.00', '410.00')).toBe(420);
  });

  it('prefers the first real price in order', () => {
    expect(firstPrice('35.50', '420.00')).toBe(35.5);
  });

  it('returns zero only when there is genuinely no price', () => {
    expect(firstPrice('0.00', '0.00', null)).toBe(0);
    expect(firstPrice(undefined, null)).toBe(0);
  });

  it('ignores a negative or unparseable figure', () => {
    expect(firstPrice('-5', '12.00')).toBe(12);
    expect(firstPrice('n/a', '12.00')).toBe(12);
  });
});

describe('message templates', () => {
  it('has a template for the rule the arrival handler actually fires', () => {
    // The handler fires 'backOrderUpdate' but was overridden to render
    // 'deliveryArrival', whose text reads fields this caller never supplies —
    // so every short-delivery message went out saying "Items Delivered:
    // undefined" to everyone with a phone number.
    expect(typeof messageTemplates.backOrderUpdate).toBe('function');
    const text = messageTemplates.backOrderUpdate({
      orderId: 'ORD-1042',
      description: 'Pump head',
      qtyReceived: 4,
      quantity: 10,
      backOrders: 6,
      verifiedBy: 'Jane',
      date: '22 Sep 2026',
    });
    expect(text).toContain('ORD-1042');
    expect(text).toContain('4 of 10');
    expect(text).not.toMatch(/undefined/);
  });

  it('never renders the word undefined, whatever is missing', () => {
    for (const [key, render] of Object.entries(messageTemplates)) {
      if (key === 'custom') continue;
      expect(render({}), `${key} with no data`).not.toMatch(/undefined/);
    }
  });

  it('does not throw when a template is called with nothing at all', () => {
    // POST /api/whatsapp/send with a template and no data answered 500.
    for (const [key, render] of Object.entries(messageTemplates)) {
      expect(() => render(), `${key} with no argument`).not.toThrow();
    }
  });
});
