import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { splitSqlStatements, describeStatement } from './sqlStatements.js';

describe('splitting a SQL script', () => {
  it('splits on the statement terminator', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('keeps a DO $$ ... END $$ block whole', () => {
    // schema.sql has one, and a naive split on ';' tears it into fragments that
    // fail on their own — which would make the diagnostic blame the wrong line.
    const sql = "DO $$ BEGIN IF TRUE THEN RAISE NOTICE 'x'; END IF; END $$;\nSELECT 1;";
    const out = splitSqlStatements(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('END $$');
    expect(out[1]).toBe('SELECT 1');
  });

  it('ignores a semicolon inside a string literal', () => {
    const out = splitSqlStatements("INSERT INTO t VALUES ('a;b'); SELECT 1;");
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("'a;b'");
  });

  it('handles an escaped quote inside a literal', () => {
    const out = splitSqlStatements("INSERT INTO t VALUES ('it''s; fine'); SELECT 1;");
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("it''s; fine");
  });

  it('ignores a semicolon inside a comment', () => {
    expect(splitSqlStatements('-- a; comment\nSELECT 1;')).toHaveLength(1);
    expect(splitSqlStatements('/* a; comment */ SELECT 1;')).toHaveLength(1);
  });

  it('tolerates a trailing statement with no terminator', () => {
    expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1']);
  });

  it('parses the real schema into runnable statements', () => {
    const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
    const out = splitSqlStatements(sql);
    expect(out.length).toBeGreaterThan(50);
    // Every piece of the DO block stays together.
    const doBlocks = out.filter((s) => s.includes('DO $$'));
    expect(doBlocks).toHaveLength(1);
    expect(doBlocks[0]).toContain('END $$');
    // And nothing is left dangling.
    expect(out.every((s) => s.trim().length > 0)).toBe(true);
  });

  it('no longer narrows the batch-approval order_id column', () => {
    // The statement that put production into a crash loop: order_id holds a
    // comma-separated list of order ids, so it cannot be VARCHAR(50).
    const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
    // Checked against the parsed STATEMENTS, not the raw text: the comment
    // explaining the incident quotes the old line, and matching that would
    // make this pass or fail for the wrong reason.
    const statements = splitSqlStatements(sql).map(describeStatement);
    const orderIdTypes = statements.filter((st) => /ALTER COLUMN order_id TYPE/i.test(st));
    expect(orderIdTypes).toHaveLength(1);
    expect(orderIdTypes[0]).toMatch(/TYPE TEXT/i);
  });
});

describe('describing a statement for the log', () => {
  it('collapses it to one line and drops comments', () => {
    expect(describeStatement('-- why\nALTER TABLE t\n  ALTER COLUMN c TYPE TEXT')).toBe(
      'ALTER TABLE t ALTER COLUMN c TYPE TEXT',
    );
  });

  it('truncates something enormous', () => {
    expect(describeStatement('SELECT ' + 'x'.repeat(500)).length).toBeLessThanOrEqual(160);
  });
});
