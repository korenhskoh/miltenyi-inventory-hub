/**
 * Pulling usable text out of an incoming Baileys message.
 *
 * The bot originally read only `conversation` and `extendedTextMessage.text`,
 * which meant it silently ignored:
 *   - anything sent in a disappearing-messages chat (wrapped in
 *     `ephemeralMessage`), which is common on business accounts;
 *   - view-once and "document with caption" envelopes;
 *   - image/video/document captions;
 *   - button, list and template replies.
 *
 * None of these produced an error — the message just fell through and the
 * sender got no answer at all.
 */

// Envelopes that wrap another message rather than carrying content themselves.
const WRAPPERS = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage', 'editedMessage'];

const MAX_UNWRAP_DEPTH = 5;

/** Strip wrapper envelopes until the real message is reached. */
export function unwrapMessage(message, depth = 0) {
  if (!message || typeof message !== 'object' || depth >= MAX_UNWRAP_DEPTH) return message || null;
  for (const key of WRAPPERS) {
    const inner = message[key]?.message;
    if (inner) return unwrapMessage(inner, depth + 1);
  }
  return message;
}

/** Extract the text a user intended to send, or '' if there is none. */
export function extractText(rawMessage) {
  const m = unwrapMessage(rawMessage);
  if (!m) return '';

  const candidates = [
    m.conversation,
    m.extendedTextMessage?.text,
    m.imageMessage?.caption,
    m.videoMessage?.caption,
    m.documentMessage?.caption,
    // Interactive replies — what the user tapped is the instruction.
    m.buttonsResponseMessage?.selectedDisplayText,
    m.buttonsResponseMessage?.selectedButtonId,
    m.templateButtonReplyMessage?.selectedDisplayText,
    m.templateButtonReplyMessage?.selectedId,
    m.listResponseMessage?.title,
    m.listResponseMessage?.singleSelectReply?.selectedRowId,
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Should the bot reply in this chat?
 *
 * Groups, broadcasts, status posts and newsletters are always excluded — the
 * bot can create and approve orders, so it must never act on a group message.
 * Direct chats arrive as @s.whatsapp.net and, on newer WhatsApp builds, as
 * @lid (the privacy-preserving addressing that 7.x leans on heavily); the
 * original check accepted only the former and dropped @lid chats entirely.
 */
export function isDirectChat(jid) {
  if (typeof jid !== 'string' || !jid.includes('@')) return false;
  const domain = jid.split('@')[1];
  return domain === 's.whatsapp.net' || domain === 'lid';
}
