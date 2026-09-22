import { describe, it, expect } from 'vitest';
import { parseRouting, sanitizeParams, suggestedCommand, ROUTABLE_INTENTS, MIN_CONFIDENCE } from './router.js';
import { commandHandlers } from '../waBotCommands.js';

describe('semantic routing — parsing', () => {
  it('reads a bare JSON object', () => {
    expect(parseRouting('{"intent":"stock","params":{},"confidence":0.9}')).toEqual({
      intent: 'stock',
      params: {},
      confidence: 0.9,
    });
  });

  it('reads JSON out of a code fence', () => {
    const out = parseRouting('```json\n{"intent":"help","confidence":1}\n```');
    expect(out.intent).toBe('help');
  });

  it('reads JSON out of a chatty reply', () => {
    // Small models add a sentence no matter how firmly you ask them not to.
    const out = parseRouting(
      'Sure! Here you go: {"intent":"list_orders","params":{"status":"pending"}} — hope that helps',
    );
    expect(out.intent).toBe('list_orders');
  });

  it('returns null for something that is not JSON at all', () => {
    expect(parseRouting('I think they want the order list')).toBeNull();
    expect(parseRouting('')).toBeNull();
    expect(parseRouting('{broken')).toBeNull();
  });
});

describe('semantic routing — argument validation', () => {
  it('keeps a well-formed material number', () => {
    expect(sanitizeParams('price_lookup', { materialNo: '130-095-244' })).toEqual({ materialNo: '130-095-244' });
  });

  it('drops a material number the model made up', () => {
    // A hallucinated part number would look up somebody else's part in silence.
    expect(sanitizeParams('price_lookup', { materialNo: 'the blue one' })).toEqual({});
    expect(sanitizeParams('price_lookup', { materialNo: '130-95-244' })).toEqual({});
  });

  it('normalises an order id and rejects a malformed one', () => {
    expect(sanitizeParams('order_status', { orderId: 'ord-1042' })).toEqual({ orderId: 'ORD-1042' });
    expect(sanitizeParams('order_status', { orderId: '1042' })).toEqual({});
  });

  it('ignores arguments the intent does not take', () => {
    expect(sanitizeParams('stock', { orderId: 'ORD-1', anything: 'else' })).toEqual({});
  });

  it('rejects a nonsense quantity', () => {
    expect(sanitizeParams('create_order', { materialNo: '130-095-244', qty: 0 }).qty).toBeUndefined();
    expect(sanitizeParams('create_order', { materialNo: '130-095-244', qty: 999999 }).qty).toBeUndefined();
    expect(sanitizeParams('create_order', { materialNo: '130-095-244', qty: '3' }).qty).toBe(3);
  });

  it('returns nothing for an intent it does not know', () => {
    expect(sanitizeParams('drop_database', { x: 1 })).toEqual({});
  });
});

describe('semantic routing — safety', () => {
  it('never marks a data-changing command as safe to auto-run', () => {
    const mutating = ['create_order', 'update_order', 'delete_order', 'approve', 'reject'];
    for (const name of mutating) {
      expect(ROUTABLE_INTENTS.find((i) => i.name === name).safe).toBe(false);
    }
  });

  it('offers a mutating command as text instead of running it', () => {
    expect(suggestedCommand('delete_order', { orderId: 'ORD-7' })).toBe('delete ORD-7');
    // With no id extracted it still shows the shape, rather than a broken command.
    expect(suggestedCommand('approve', {})).toBe('approve <id>');
  });

  it('only routes to intents the bot can actually handle', () => {
    // Guards against drift: renaming a handler must not leave routing pointing
    // at a command that no longer exists.
    for (const intent of ROUTABLE_INTENTS) {
      expect(typeof commandHandlers[intent.name]).toBe('function');
    }
  });

  it('sets the confidence floor high enough to reject a coin flip', () => {
    expect(MIN_CONFIDENCE).toBeGreaterThan(0.5);
  });
});
