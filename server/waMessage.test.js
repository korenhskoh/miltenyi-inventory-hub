import { describe, it, expect } from 'vitest';
import { extractText, unwrapMessage, isDirectChat } from './waMessage.js';

describe('extractText', () => {
  it('reads a plain conversation message', () => {
    expect(extractText({ conversation: 'help' })).toBe('help');
  });

  it('reads an extended text message (reply/quote)', () => {
    expect(extractText({ extendedTextMessage: { text: 'status ORD-1' } })).toBe('status ORD-1');
  });

  it('reads a message sent in a disappearing-messages chat', () => {
    // This is the case that silently did nothing before.
    const msg = { ephemeralMessage: { message: { conversation: 'list orders' } } };
    expect(extractText(msg)).toBe('list orders');
  });

  it('reads a view-once envelope', () => {
    expect(extractText({ viewOnceMessageV2: { message: { conversation: 'stock' } } })).toBe('stock');
  });

  it('unwraps nested envelopes', () => {
    const msg = { ephemeralMessage: { message: { viewOnceMessage: { message: { conversation: 'help' } } } } };
    expect(extractText(msg)).toBe('help');
  });

  it('does not loop forever on a self-referential envelope', () => {
    const msg = {};
    msg.ephemeralMessage = { message: msg };
    expect(() => extractText(msg)).not.toThrow();
  });

  it('reads an image caption', () => {
    expect(extractText({ imageMessage: { caption: 'price 130-093-251' } })).toBe('price 130-093-251');
  });

  it('reads a button reply', () => {
    expect(extractText({ buttonsResponseMessage: { selectedDisplayText: 'APPROVE' } })).toBe('APPROVE');
  });

  it('falls back to a button id when there is no display text', () => {
    expect(extractText({ buttonsResponseMessage: { selectedButtonId: 'approve' } })).toBe('approve');
  });

  it('reads a list reply', () => {
    expect(extractText({ listResponseMessage: { title: 'Pending orders' } })).toBe('Pending orders');
  });

  it('returns empty for a message with no text (a sticker, say)', () => {
    expect(extractText({ stickerMessage: { url: 'x' } })).toBe('');
    expect(extractText(null)).toBe('');
    expect(extractText({})).toBe('');
  });

  it('ignores whitespace-only text', () => {
    expect(extractText({ conversation: '   \n ' })).toBe('');
  });

  it('trims surrounding whitespace', () => {
    expect(extractText({ conversation: '  help  ' })).toBe('help');
  });
});

describe('unwrapMessage', () => {
  it('returns the message unchanged when it is not wrapped', () => {
    const m = { conversation: 'hi' };
    expect(unwrapMessage(m)).toBe(m);
  });
});

describe('isDirectChat', () => {
  it('accepts ordinary direct chats', () => {
    expect(isDirectChat('6591234567@s.whatsapp.net')).toBe(true);
  });

  it('accepts LID-addressed direct chats', () => {
    // Newer WhatsApp delivers one-to-one chats this way; these were dropped.
    expect(isDirectChat('123456789@lid')).toBe(true);
  });

  it('rejects groups, broadcasts, status and newsletters', () => {
    expect(isDirectChat('12345-67890@g.us')).toBe(false);
    expect(isDirectChat('status@broadcast')).toBe(false);
    expect(isDirectChat('12345@broadcast')).toBe(false);
    expect(isDirectChat('12345@newsletter')).toBe(false);
  });

  it('rejects junk', () => {
    expect(isDirectChat('')).toBe(false);
    expect(isDirectChat(null)).toBe(false);
    expect(isDirectChat('nonsense')).toBe(false);
  });
});
