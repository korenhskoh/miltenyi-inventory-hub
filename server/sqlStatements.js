/**
 * Split a SQL script into individual statements, for diagnostics.
 *
 * schema.sql is executed as one batch at boot, which is what we want — but when
 * one statement in it fails, node-postgres reports only the message. "value too
 * long for type character varying(50)" with no indication of WHICH of 180-odd
 * statements produced it took a full investigation against production data to
 * pin down, while the service sat in a crash loop.
 *
 * So on the failure path only, the script is split and replayed one statement
 * at a time inside a transaction that is rolled back, purely to name the
 * culprit. That means the splitter has to respect the things a naive split on
 * ';' would break: the DO $$ ... END $$ block, single-quoted literals, dollar
 * quoting with tags, and comments.
 */
export function splitSqlStatements(sql = '') {
  const out = [];
  let buf = '';
  let i = 0;
  let inSingle = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null; // e.g. '$$' or '$body$'

  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (lineComment) {
      buf += ch;
      if (ch === '\n') lineComment = false;
      i++;
      continue;
    }
    if (blockComment) {
      buf += ch;
      if (next2 === '*/') {
        buf += sql[i + 1];
        i += 2;
        blockComment = false;
        continue;
      }
      i++;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }
    if (inSingle) {
      buf += ch;
      // '' is an escaped quote inside a literal, not the end of one.
      if (ch === "'" && sql[i + 1] === "'") {
        buf += sql[i + 1];
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }

    if (next2 === '--') {
      lineComment = true;
      buf += next2;
      i += 2;
      continue;
    }
    if (next2 === '/*') {
      blockComment = true;
      buf += next2;
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i++;
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollar) {
      dollarTag = dollar[0];
      buf += dollarTag;
      i += dollarTag.length;
      continue;
    }
    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

/** A one-line label for a statement, for log output. */
export function describeStatement(stmt = '') {
  return stmt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('--'))
    .join(' ')
    .slice(0, 160);
}
