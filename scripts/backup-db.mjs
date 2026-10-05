#!/usr/bin/env node
/**
 * Take a backup of the local database, check it is readable, and prune old ones.
 *
 *   node scripts/backup-db.mjs
 *
 * Reads DATABASE_URL, writes to BACKUP_DIR (default ./backups), and keeps
 * BACKUP_KEEP_DAYS of history (default 30).
 *
 * This exists because moving off a managed host quietly gives up its backups.
 * Nobody notices that until the disk in the desk fails, and by then the orders,
 * the stock history and the instrument records are gone with it. A scheduled
 * task running this nightly is the smallest thing that makes the move safe.
 *
 * Two deliberate behaviours:
 *
 * The dump is verified by listing its contents before anything is pruned, so a
 * truncated or unreadable file can never cause a good older backup to be
 * deleted. An unverifiable backup is worse than no backup, because it is
 * trusted until the day it is needed.
 *
 * It exits non-zero on any failure, so Windows Task Scheduler shows "last run
 * result" as an error rather than reporting success for a job that did nothing.
 *
 * And a failed run removes its own output. pg_dump creates the destination file
 * before it connects, so a backup that fails for any reason — wrong password,
 * database down, disk full — leaves a 0-byte file carrying today's date and the
 * same name as a real backup. Caught by actually restoring one: the newest file
 * in the folder was the empty one from a failed run, and that is precisely the
 * file somebody reaches for in an emergency.
 */

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';

const run = promisify(execFile);

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS || 30);
const PREFIX = 'miltenyi-';

const log = (...a) => console.log(new Date().toISOString(), ...a);

// Declared before die() so the early checks can call it safely; set once the
// destination is known.
let file = null;

function die(msg, err) {
  console.error(`${new Date().toISOString()} BACKUP FAILED: ${msg}`);
  if (err) console.error(err.stderr || err.message || err);
  // Never leave an unverified file behind wearing a real backup's name.
  try {
    if (file && existsSync(file)) {
      unlinkSync(file);
      console.error(`${new Date().toISOString()} Removed the incomplete file ${file}`);
    }
  } catch {
    /* the failure above is what matters */
  }
  process.exit(1);
}

if (!DATABASE_URL) die('DATABASE_URL is not set.');
if (!Number.isFinite(KEEP_DAYS) || KEEP_DAYS < 1) die(`BACKUP_KEEP_DAYS is "${process.env.BACKUP_KEEP_DAYS}" — it must be a whole number of days, at least 1.`);

try {
  execFileSync('pg_dump', ['--version'], { stdio: 'pipe' });
} catch {
  die('pg_dump was not found on PATH. It ships with PostgreSQL; add its bin folder to the system PATH.');
}

/**
 * A destination no existing backup already occupies.
 *
 * The name carries a timestamp to the second, so two runs in the same second
 * would share it — and pg_dump TRUNCATES its output file before it does
 * anything else. A retry straight after a failure therefore destroyed the good
 * backup it collided with, before failing again and deleting what was left.
 * Found by running the two back to back and discovering an empty folder.
 */
function freeDestination(dir, stamp) {
  const base = path.join(dir, `${PREFIX}${stamp}`);
  if (!existsSync(`${base}.dump`)) return `${base}.dump`;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}.dump`;
    if (!existsSync(candidate)) return candidate;
  }
  die(`There are already 100 backups stamped ${stamp}. Something is retrying in a loop.`);
  return null;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  file = freeDestination(BACKUP_DIR, stamp);

  log(`Backing up to ${file}`);
  try {
    await run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', file, DATABASE_URL], {
      maxBuffer: 1024 * 1024 * 64,
    });
  } catch (e) {
    die('pg_dump did not complete.', e);
  }

  const size = statSync(file).size;
  if (size < 1024) die(`The backup is only ${size} bytes, which cannot be a real database.`);

  // Prove it can be read back before trusting it enough to prune anything.
  try {
    const { stdout } = await run('pg_restore', ['--list', file], { maxBuffer: 1024 * 1024 * 64 });
    const entries = stdout.split('\n').filter((l) => l.trim() && !l.startsWith(';')).length;
    if (entries === 0) die('The backup contains no objects — it is not usable.');
    log(`Wrote ${(size / 1024 / 1024).toFixed(1)} MB, verified ${entries} objects`);
  } catch (e) {
    die('The backup could not be read back, so it is not a usable backup.', e);
  }

  // Prune only after a verified backup exists.
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of readdirSync(BACKUP_DIR)) {
    if (!name.startsWith(PREFIX) || !name.endsWith('.dump')) continue;
    const full = path.join(BACKUP_DIR, name);
    if (full === file) continue;
    if (statSync(full).mtimeMs < cutoff) {
      unlinkSync(full);
      removed++;
    }
  }

  const kept = readdirSync(BACKUP_DIR).filter((n) => n.startsWith(PREFIX) && n.endsWith('.dump')).length;
  log(`Pruned ${removed} backup(s) older than ${KEEP_DAYS} days; ${kept} remain`);
  log('Backup OK');
}

main().catch((e) => die('Unexpected error.', e));
