/**
 * Uploaded file → plain text the knowledge base can chunk.
 *
 * Only formats that can be read reliably are accepted. A half-extracted PDF is
 * worse than a rejected one: it puts confident nonsense into the corpus, and
 * nobody ever re-reads a document they have already uploaded to check.
 * Spreadsheets are included because this system's own data arrives that way,
 * and the xlsx reader is already a dependency.
 */
import XLSX from 'xlsx';

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_CHARS = 400_000;

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.log', '.yml', '.yaml'];
const SHEET_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'];

export const ACCEPTED_EXTENSIONS = [...TEXT_EXTENSIONS, ...SHEET_EXTENSIONS];

const extensionOf = (name) => {
  const m = String(name || '')
    .toLowerCase()
    .match(/\.[a-z0-9]+$/);
  return m ? m[0] : '';
};

/** Spreadsheet → one labelled CSV block per sheet, blank sheets skipped. */
function extractSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const blocks = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false }).trim();
    if (csv) blocks.push(`Sheet: ${name}\n${csv}`);
  }
  return blocks.join('\n\n');
}

/**
 * Turn an upload into text.
 *
 * `content` is either plain text or base64, said explicitly by `encoding` so a
 * text file that happens to look like base64 is not mangled.
 */
export function extractText({ filename = '', mime = '', content = '', encoding = 'utf8' }) {
  const ext = extensionOf(filename);
  const buffer = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(String(content), 'utf8');

  if (buffer.length > MAX_BYTES) {
    throw new Error(`That file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.`);
  }

  if (SHEET_EXTENSIONS.includes(ext) || /spreadsheet|excel/i.test(mime)) {
    const text = extractSheet(buffer);
    if (!text.trim()) throw new Error('That spreadsheet has no readable cells.');
    return truncate(text);
  }

  if (TEXT_EXTENSIONS.includes(ext) || /^text\/|json|markdown/i.test(mime) || !ext) {
    const text = buffer.toString('utf8');
    // A binary file renamed .txt shows up as replacement characters; catching it
    // here beats storing a document of garbage nobody can search.
    if (/�/.test(text.slice(0, 2000))) {
      throw new Error('That file does not look like text. Save it as .txt or .md and try again.');
    }
    if (!text.trim()) throw new Error('That file is empty.');
    return truncate(text);
  }

  if (ext === '.pdf' || /pdf/i.test(mime)) {
    throw new Error('PDFs cannot be read directly yet. Copy the text out, or save it as .txt, and upload that.');
  }
  if (ext === '.docx' || ext === '.doc' || /word/i.test(mime)) {
    throw new Error('Word files cannot be read directly yet. Save as .txt or .md and upload that.');
  }

  throw new Error(`Unsupported file type "${ext || mime || 'unknown'}". Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}.`);
}

function truncate(text) {
  // Postgres rejects a NUL byte inside a text value outright, and a stray one
  // from a mis-decoded file would fail the whole insert. Split/join rather than
  // a regex, because a control character in a pattern is its own lint hazard.
  const clean = text.split('\u0000').join('').trim();
  if (clean.length <= MAX_TEXT_CHARS) return clean;
  return `${clean.slice(0, MAX_TEXT_CHARS)}\n\n[Truncated at ${MAX_TEXT_CHARS.toLocaleString()} characters.]`;
}
