#!/usr/bin/env node
/**
 * Copy the hosted database onto the machine that will run the system, and prove
 * the copy is complete.
 *
 *   node scripts/migrate-to-local.mjs            dump, restore, then verify
 *   node scripts/migrate-to-local.mjs --verify   compare the two, change nothing
 *   node scripts/migrate-to-local.mjs --dump-only
 *
 * Needs two connection strings in the environment:
 *
 *   SOURCE_DATABASE_URL   the hosted database (Railway) — only ever read
 *   TARGET_DATABASE_URL   the local PostgreSQL — written to
 *
 * --verify is the one to keep using. While both systems run side by side the
 * hosted copy keeps moving, and the only way to know what a cutover would lose
 * is to compare them. Run it the morning you cut over.
 *
 * Why not just restore and assume it worked: pg_restore reports success while
 * skipping objects it could not create, and a table that restored zero rows
 * looks exactly like a table that was always empty. The row counts are the
 * check that the data actually arrived.
 */

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const run = promisify(execFile);
pg.types.setTypeParser(1082, (v) => v);

const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL;
const args = new Set(process.argv.slice(2));
const verifyOnly = args.has('--verify');
const dumpOnly = args.has('--dump-only');

const BACKUP_DIR = process.env.MIGRATION_DIR || path.join(process.cwd(), 'migration-dumps');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dumpFile = path.join(BACKUP_DIR, `source-${stamp}.dump`);

const log = (...a) => console.log(...a);
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

function requireEnv() {
  if (!SOURCE) fail('SOURCE_DATABASE_URL is not set — it is the hosted database to copy FROM.');
  if (!verifyOnly && !TARGET && !dumpOnly) fail('TARGET_DATABASE_URL is not set — it is the local database to copy INTO.');
  if (verifyOnly && !TARGET) fail('TARGET_DATABASE_URL is not set — verifying compares the two databases.');
}

/**
 * pg_dump refuses to dump a server newer than itself, and the message it gives
 * ("server version mismatch") sends people down the wrong path. Check first and
 * say plainly what to install.
 */
function checkTools() {
  for (const tool of ['pg_dump', 'pg_restore', 'psql']) {
    try {
      execFileSync(tool, ['--version'], { stdio: 'pipe' });
    } catch {
      fail(
        `${tool} was not found on PATH. It ships with PostgreSQL — install PostgreSQL ` +
          `(the same major version as the hosted database, or newer) and reopen the terminal.`,
      );
    }
  }
  const v = execFileSync('pg_dump', ['--version'], { encoding: 'utf8' }).trim();
  log(`  tools: ${v}`);
  return v;
}

async function serverVersion(url, label) {
  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  try {
    await client.connect();
  } catch (e) {
    fail(`Could not connect to the ${label} database: ${e.message}`);
  }
  const r = await client.query('SHOW server_version');
  await client.end();
  return r.rows[0].server_version;
}

/** The hosted database needs TLS; a local one almost never has it. */
function sslFor(url) {
  if (/localhost|127\.0\.0\.1|::1/.test(url)) return false;
  return { rejectUnauthorized: false };
}

async function tableCounts(url, label) {
  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();
  const tables = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const counts = {};
  for (const { tablename } of tables.rows) {
    // Identifier is quoted because it comes from the catalogue, not from input,
    // but quoting keeps a table named like a keyword working.
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${tablename}"`);
    counts[tablename] = r.rows[0].n;
  }
  await client.end();
  log(`  ${label}: ${tables.rows.length} table(s)`);
  return counts;
}

function compare(source, target) {
  const names = [...new Set([...Object.keys(source), ...Object.keys(target)])].sort();
  const rows = [];
  let worst = 'ok';

  for (const t of names) {
    const s = source[t];
    const d = target[t];
    let state;
    if (d === undefined) {
      state = 'MISSING';
      worst = 'bad';
    } else if (s === undefined) {
      state = 'extra';
      if (worst === 'ok') worst = 'warn';
    } else if (s === d) {
      state = 'ok';
    } else if (d > s) {
      // Expected while both run side by side: the local copy has been used.
      state = 'ahead';
      if (worst === 'ok') worst = 'warn';
    } else {
      state = 'SHORT';
      worst = 'bad';
    }
    rows.push({ table: t, source: s ?? '-', target: d ?? '-', state });
  }

  const w = Math.max(5, ...rows.map((r) => r.table.length));
  log('');
  log(`  ${'TABLE'.padEnd(w)}  ${'HOSTED'.padStart(8)}  ${'LOCAL'.padStart(8)}  STATE`);
  log(`  ${'-'.repeat(w)}  ${'-'.repeat(8)}  ${'-'.repeat(8)}  -----`);
  rows.forEach((r) =>
    log(`  ${r.table.padEnd(w)}  ${String(r.source).padStart(8)}  ${String(r.target).padStart(8)}  ${r.state}`),
  );
  return { worst, rows };
}

async function doDump() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  log(`\n▸ Dumping the hosted database to ${dumpFile}`);
  // Custom format so the restore can be selective and parallel, and so a
  // truncated file is detected rather than half-applied.
  await run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', dumpFile, SOURCE], {
    maxBuffer: 1024 * 1024 * 64,
  });
  const size = statSync(dumpFile).size;
  if (size < 1024) fail(`The dump is only ${size} bytes — that is not a real database. Check SOURCE_DATABASE_URL.`);
  log(`  wrote ${(size / 1024 / 1024).toFixed(1)} MB`);
}

async function doRestore() {
  log(`\n▸ Restoring into the local database`);
  try {
    await run(
      'pg_restore',
      ['--no-owner', '--no-privileges', '--clean', '--if-exists', '--dbname', TARGET, dumpFile],
      { maxBuffer: 1024 * 1024 * 64 },
    );
    log('  restored cleanly');
  } catch (e) {
    // pg_restore exits non-zero for warnings too (dropping an object that was
    // never there, for one). The row counts below are what actually decides,
    // so report and carry on to the verification rather than stopping here.
    const text = `${e.stdout || ''}${e.stderr || ''}`;
    const errors = text.split('\n').filter((l) => l.trim()).slice(-12);
    log('  pg_restore reported problems — the row counts below decide whether they mattered:');
    errors.forEach((l) => log(`    ${l}`));
  }
}

async function main() {
  requireEnv();
  log('▸ Checking PostgreSQL client tools');
  checkTools();

  if (!verifyOnly) {
    const sv = await serverVersion(SOURCE, 'hosted');
    log(`  hosted server: PostgreSQL ${sv}`);
    if (!dumpOnly) {
      const tv = await serverVersion(TARGET, 'local');
      log(`  local server:  PostgreSQL ${tv}`);
      if (parseInt(tv, 10) < parseInt(sv, 10)) {
        fail(
          `The local PostgreSQL (${tv}) is older than the hosted one (${sv}). ` +
            `A dump cannot be restored into an older major version — install PostgreSQL ${parseInt(sv, 10)} or newer locally.`,
        );
      }
    }
    await doDump();
    if (dumpOnly) {
      log(`\n✔ Dump only. The file is at ${dumpFile}\n`);
      return;
    }
    await doRestore();
  }

  log('\n▸ Counting rows in both databases');
  const [source, target] = [await tableCounts(SOURCE, 'hosted'), await tableCounts(TARGET, 'local')];
  const { worst, rows } = compare(source, target);

  const short = rows.filter((r) => r.state === 'SHORT' || r.state === 'MISSING');
  const ahead = rows.filter((r) => r.state === 'ahead');

  log('');
  if (worst === 'bad') {
    log('✖ The local copy is missing data:');
    short.forEach((r) => log(`    ${r.table}: hosted has ${r.source}, local has ${r.target}`));
    log('\n  Do not cut over. Re-run the migration, and if it persists restore that table on its own.\n');
    process.exit(1);
  }
  if (ahead.length) {
    // Normal during the parallel period, and the thing to watch at cutover:
    // work done on the local copy is not on the hosted one and vice versa.
    log('⚠ The local copy has MORE rows than the hosted one in some tables:');
    ahead.forEach((r) => log(`    ${r.table}: hosted ${r.source}, local ${r.target}`));
    log('\n  That is expected if people have been using the local system. It also means a');
    log('  fresh re-migration would overwrite that work — verify before re-running.\n');
    return;
  }
  log('✔ Every table matches. The local copy is complete.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
