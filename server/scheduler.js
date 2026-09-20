import cron from 'node-cron';
import { query as dbQuery } from './db.js';
import nodemailer from 'nodemailer';
import logger from './logger.js';

let cronJob = null;
let isRunning = false; // prevent overlapping executions
let smtpTransporter = null; // cached transporter, invalidated on config change
let transporterInUse = false; // guard against reset during active send

/**
 * Load scheduled notification config from DB
 */
async function loadScheduledConfig() {
  try {
    const result = await dbQuery(
      "SELECT value FROM app_config WHERE key = 'scheduledNotifs' AND user_id = '__global__'",
    );
    if (result.rows.length > 0) return result.rows[0].value;
  } catch (e) {
    logger.error({ err: e }, 'Failed to load scheduledNotifs config');
  }
  return null;
}

/**
 * Load email config from DB
 */
async function loadEmailConfig() {
  try {
    const result = await dbQuery("SELECT value FROM app_config WHERE key = 'emailConfig' AND user_id = '__global__'");
    if (result.rows.length > 0) return result.rows[0].value;
  } catch (e) {
    logger.error({ err: e }, 'Failed to load emailConfig');
  }
  return null;
}

/**
 * Generate report data from database using efficient aggregate queries
 */
async function generateReportData(reportTypes) {
  const data = {};
  try {
    if (reportTypes.monthlySummary || reportTypes.orderStats) {
      const stats = await dbQuery(`
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE status = 'Received')::int AS received,
          COUNT(*) FILTER (WHERE status = 'Pending Approval')::int AS pending,
          COUNT(*) FILTER (WHERE approval_status = 'approved')::int AS approved,
          COALESCE(SUM(total_cost), 0) AS total_value
        FROM orders
      `);
      const row = stats.rows[0] || {};
      data.totalOrders = row.total_orders || 0;
      data.received = row.received || 0;
      data.pending = row.pending || 0;
      data.approved = row.approved || 0;
      data.totalValue = Number(row.total_value) || 0;
    }
    if (reportTypes.backOrderReport) {
      const countResult = await dbQuery('SELECT COUNT(*)::int AS cnt FROM orders WHERE back_order < 0');
      data.backOrders = countResult.rows[0]?.cnt || 0;
      const topItems = await dbQuery(
        'SELECT description, material_no, back_order FROM orders WHERE back_order < 0 ORDER BY back_order ASC LIMIT 10',
      );
      data.backOrderItems = (topItems.rows || [])
        .map((o) => `- ${o.description || o.material_no}: ${Math.abs(Number(o.back_order))} pending`)
        .join('\n');
    }
    if (reportTypes.pendingApprovals) {
      const result = await dbQuery("SELECT COUNT(*)::int AS cnt FROM pending_approvals WHERE status = 'pending'");
      data.pendingApprovals = result.rows[0]?.cnt || 0;
    }
    if (reportTypes.lowStockAlert) {
      const result = await dbQuery(`
        SELECT COUNT(*)::int AS check_count, COALESCE(SUM(disc), 0) AS total_disc
        FROM (SELECT disc FROM stock_checks ORDER BY created_at DESC LIMIT 5) recent
      `);
      const row = result.rows[0] || {};
      data.recentStockChecks = row.check_count || 0;
      data.discrepancies = Number(row.total_disc) || 0;
    }
  } catch (e) {
    logger.error({ err: e }, 'Error generating report data');
  }
  return data;
}

/**
 * Format report as plain text and proper HTML email
 */
function formatReport(data) {
  const now = new Date().toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
  const text = [
    `Miltenyi Inventory Hub — Scheduled Report`,
    `Date: ${now}`,
    '',
    `--- Order Summary ---`,
    `Total Orders: ${data.totalOrders ?? 'N/A'}`,
    `Received: ${data.received ?? 'N/A'}`,
    `Pending Approval: ${data.pending ?? 'N/A'}`,
    `Approved: ${data.approved ?? 'N/A'}`,
    `Total Value: S$${(data.totalValue || 0).toFixed(2)}`,
    '',
    `--- Back Orders ---`,
    `Back Order Items: ${data.backOrders ?? 'N/A'}`,
    data.backOrderItems || '(none)',
    '',
    `--- Pending Approvals ---`,
    `Pending: ${data.pendingApprovals ?? 'N/A'}`,
    '',
    `--- Stock Health ---`,
    `Recent Stock Checks: ${data.recentStockChecks ?? 'N/A'}`,
    `Discrepancies: ${data.discrepancies ?? 0}`,
    '',
    '— Miltenyi Inventory Hub SG',
  ].join('\n');

  const row = (label, value) =>
    `<tr><td style="padding:6px 12px;color:#64748B;font-size:13px">${label}</td><td style="padding:6px 12px;font-weight:600;font-size:13px">${value}</td></tr>`;
  const section = (title, rows) => `
    <div style="margin-bottom:16px">
      <div style="background:#0B7A3E;color:#fff;padding:8px 12px;border-radius:6px 6px 0 0;font-size:13px;font-weight:600">${title}</div>
      <table style="width:100%;border-collapse:collapse;background:#F8FAFB;border:1px solid #E2E8F0;border-top:none">${rows}</table>
    </div>`;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1A202C">
      <div style="background:#0B7A3E;padding:16px 20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:18px;color:#fff">Miltenyi Inventory Hub</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#D1FAE5">Scheduled Report — ${now}</p>
      </div>
      <div style="padding:16px 20px;background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px">
        ${section(
          'Order Summary',
          [
            row('Total Orders', data.totalOrders ?? 'N/A'),
            row('Received', data.received ?? 'N/A'),
            row('Pending Approval', data.pending ?? 'N/A'),
            row('Approved', data.approved ?? 'N/A'),
            row('Total Value', `S$${(data.totalValue || 0).toFixed(2)}`),
          ].join(''),
        )}
        ${section(
          'Back Orders',
          [
            row('Items with Back Orders', data.backOrders ?? 'N/A'),
            data.backOrderItems
              ? `<tr><td colspan="2" style="padding:6px 12px;font-size:12px;color:#64748B;white-space:pre-line">${data.backOrderItems}</td></tr>`
              : '',
          ].join(''),
        )}
        ${section('Pending Approvals', row('Awaiting Approval', data.pendingApprovals ?? 'N/A'))}
        ${section(
          'Stock Health',
          [
            row('Recent Stock Checks', data.recentStockChecks ?? 'N/A'),
            row('Discrepancies', data.discrepancies ?? 0),
          ].join(''),
        )}
        <p style="margin:16px 0 0;font-size:11px;color:#94A3B8;text-align:center">Miltenyi Inventory Hub SG</p>
      </div>
    </div>`;

  return { text, html };
}

/**
 * Get or create a reusable SMTP transporter
 */
function getTransporter(emailConfig) {
  if (smtpTransporter) return smtpTransporter;
  smtpTransporter = nodemailer.createTransport({
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort || 587,
    secure: (emailConfig.smtpPort || 587) === 465,
    auth: emailConfig.smtpUser ? { user: emailConfig.smtpUser, pass: emailConfig.smtpPass || '' } : undefined,
    pool: true, // reuse connections
    maxConnections: 3,
  });
  return smtpTransporter;
}

/**
 * Invalidate cached transporter (call when email config changes).
 * Defers close if a send is in progress — the next getTransporter() call will create a fresh one.
 */
export function resetTransporter() {
  if (smtpTransporter) {
    if (transporterInUse) {
      // Mark for replacement — current send keeps its reference, next call creates new one
      smtpTransporter = null;
    } else {
      smtpTransporter.close();
      smtpTransporter = null;
    }
  }
}

/**
 * Send the report via email
 */
async function sendEmailReport(emailConfig, recipients, report) {
  if (!emailConfig?.smtpHost || !recipients?.length) return false;
  transporterInUse = true;
  try {
    const transporter = getTransporter(emailConfig);
    const to = recipients.join(', ');
    await transporter.sendMail({
      from: `"${emailConfig.senderName || 'Miltenyi Inventory Hub'}" <${emailConfig.senderEmail || 'noreply@miltenyibiotec.com'}>`,
      to,
      subject: `Inventory Hub — Scheduled Report (${new Date().toLocaleDateString('en-SG')})`,
      html: report.html,
      text: report.text,
    });
    logger.info({ to }, 'Scheduled email report sent');
    return true;
  } catch (e) {
    logger.error({ err: e }, 'Failed to send scheduled email report');
    // Reset transporter on failure so next attempt creates a fresh one
    resetTransporter();
    return false;
  } finally {
    transporterInUse = false;
  }
}

/**
 * Send the report via WhatsApp (uses the sock reference passed in)
 */
async function sendWaReport(sendText, formatPhoneNumber, recipients, report) {
  if (!sendText || !recipients?.length) return 0;
  let sent = 0;
  for (const phone of recipients) {
    try {
      const jid = formatPhoneNumber(phone);
      // Goes through the caller's sender so the message is cached for retry
      // receipts like every other outgoing message.
      await sendText(jid, report.text);
      sent++;
      await new Promise((r) => setTimeout(r, 1000)); // rate limit
    } catch (e) {
      logger.error({ err: e, phone }, 'Failed to send scheduled WA report');
    }
  }
  logger.info({ sent, total: recipients.length }, 'Scheduled WA report broadcast');
  return sent;
}

/**
 * Log the scheduled report to notif_log
 */
async function logReport(channel, to, status) {
  try {
    await dbQuery(
      'INSERT INTO notif_log (id, type, recipient, subject, date, status) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)',
      [`N-SCHED-${Date.now()}`, channel, to, `Scheduled Report (${new Date().toLocaleDateString('en-SG')})`, status],
    );
  } catch (e) {
    logger.error({ err: e }, 'Failed to log scheduled report');
  }
}

/**
 * Update lastRun timestamp in config (single atomic UPDATE, no read-then-write race)
 */
async function updateLastRun() {
  try {
    await dbQuery(
      `UPDATE app_config
       SET value = jsonb_set(value::jsonb, '{lastRun}', to_jsonb($1::text))::json
       WHERE user_id = '__global__' AND key = 'scheduledNotifs'`,
      [new Date().toISOString()],
    );
  } catch (e) {
    logger.error({ err: e }, 'Failed to update lastRun');
  }
}

/**
 * Execute the scheduled report (with duplicate-run guard)
 */
const REPORT_TIMEOUT_MS = 5 * 60 * 1000; // 5-minute hard limit

async function runScheduledReport(getWaContext) {
  if (isRunning) {
    logger.warn('Scheduled report already in progress — skipping duplicate run');
    return;
  }
  isRunning = true;
  const startTime = Date.now();

  // Safety timeout — record that this run overran, but do NOT clear isRunning:
  // the run is still going, and releasing the lock let a second run start and
  // send everyone a duplicate report. The finally block is the only release.
  const safetyTimer = setTimeout(() => {
    if (isRunning) {
      logger.error({ durationMs: Date.now() - startTime }, 'Scheduled report overran the 5-minute budget');
    }
  }, REPORT_TIMEOUT_MS);

  try {
    logger.info('Running scheduled report...');
    const config = await loadScheduledConfig();
    if (!config || !config.enabled) {
      logger.info('Scheduled reports disabled — skipping');
      return;
    }

    const emailConfig = await loadEmailConfig();
    const reportData = await generateReportData(config.reports || {});
    const report = formatReport(reportData);

    // Gather recipients
    let emailRecipients = [];
    let waRecipients = [];
    try {
      const usersResult = await dbQuery("SELECT email, phone FROM users WHERE status = 'active'");
      const activeUsers = usersResult.rows || [];
      if (config.emailEnabled) {
        emailRecipients =
          (config.recipients || []).length > 0
            ? config.recipients
            : activeUsers.filter((u) => u.email).map((u) => u.email);
      }
      if (config.whatsappEnabled) {
        // Honour an explicit recipient list the same way email does. Before this,
        // WhatsApp ignored config.waRecipients entirely and always messaged every
        // active user with a phone number on file.
        const explicit = (config.waRecipients || []).filter(Boolean);
        waRecipients = explicit.length > 0 ? explicit : activeUsers.filter((u) => u.phone).map((u) => u.phone);
      }
    } catch (e) {
      logger.error({ err: e }, 'Failed to load recipients for scheduled report');
    }

    // Send via email
    if (config.emailEnabled && emailRecipients.length > 0 && emailConfig) {
      const ok = await sendEmailReport(emailConfig, emailRecipients, report);
      await logReport('email', emailRecipients.join(', '), ok ? 'Sent' : 'Failed');
    }

    // Send via WhatsApp
    if (config.whatsappEnabled && waRecipients.length > 0) {
      const { sock, formatPhoneNumber, sendText } = getWaContext();
      if (sock && sendText) {
        const sent = await sendWaReport(sendText, formatPhoneNumber, waRecipients, report);
        await logReport('whatsapp', `${waRecipients.length} user(s)`, sent > 0 ? 'Delivered' : 'Failed');
      } else {
        logger.warn('WhatsApp not connected — skipping WA scheduled report');
      }
    }

    await updateLastRun();
    logger.info({ durationMs: Date.now() - startTime }, 'Scheduled report completed');
  } finally {
    clearTimeout(safetyTimer);
    isRunning = false;
  }
}

/**
 * Build cron expression from config
 */
export function buildCronExpression(config) {
  const [rawHour, rawMinute] = (config.time || '09:00').split(':').map(Number);
  // `rawHour || 9` turned midnight into 9am: 0 is falsy. Only fall back when
  // the value is genuinely not a number.
  const hour = Math.max(0, Math.min(23, Number.isFinite(rawHour) ? rawHour : 9));
  const minute = Math.max(0, Math.min(59, Number.isFinite(rawMinute) ? rawMinute : 0));
  const dayOfWeek = Math.max(0, Math.min(6, config.dayOfWeek ?? 1));
  const dayOfMonth = Math.max(1, Math.min(31, config.dayOfMonth ?? 1));

  switch (config.frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return `${minute} ${hour} * * 1`; // default weekly Monday
  }
}

/**
 * Stop and fully dispose the current cron task.
 * node-cron v4 keeps a stopped task in its internal registry, so calling
 * stop() alone leaked one task per Settings save.
 */
function stopCronJob() {
  if (!cronJob) return;
  try {
    cronJob.stop();
    if (typeof cronJob.destroy === 'function') cronJob.destroy();
  } catch (e) {
    logger.warn({ err: e }, 'Failed to dispose previous cron task');
  }
  cronJob = null;
}

/**
 * How long after a missed slot we still consider it worth sending.
 * A redeploy across the scheduled minute used to drop that run silently.
 */
const CATCHUP_GRACE_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Decide whether a scheduled run was missed while the server was down.
 * Exported for testing.
 */
export function shouldCatchUp(config, now = new Date()) {
  if (!config?.enabled) return false;
  const [rawHour, rawMinute] = (config.time || '09:00').split(':').map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 9;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;

  // The most recent moment the report should have fired, on or before `now`.
  const slot = new Date(now);
  slot.setHours(hour, minute, 0, 0);
  if (slot > now) slot.setDate(slot.getDate() - 1);

  if (config.frequency === 'weekly') {
    const target = Math.max(0, Math.min(6, config.dayOfWeek ?? 1));
    while (slot.getDay() !== target) slot.setDate(slot.getDate() - 1);
  } else if (config.frequency === 'monthly') {
    const target = Math.max(1, Math.min(31, config.dayOfMonth ?? 1));
    while (slot.getDate() !== target) slot.setDate(slot.getDate() - 1);
  }

  const age = now.getTime() - slot.getTime();
  if (age < 0 || age > CATCHUP_GRACE_MS) return false; // too stale to be useful
  const lastRun = config.lastRun ? new Date(config.lastRun).getTime() : 0;
  if (Number.isNaN(lastRun)) return true;
  return lastRun < slot.getTime(); // already ran for this slot?
}

/**
 * Start the scheduler — call once after DB init
 */
export async function startScheduler(getWaContext) {
  const config = await loadScheduledConfig();
  if (!config) {
    logger.info('No scheduledNotifs config found — scheduler idle');
    return;
  }

  const cronExpr = buildCronExpression(config);

  // Validate cron expression before scheduling
  if (!cron.validate(cronExpr)) {
    logger.error({ cronExpr }, 'Invalid cron expression — scheduler not started');
    return;
  }

  logger.info({ cronExpr, frequency: config.frequency, enabled: config.enabled }, 'Scheduler initialized');

  stopCronJob();

  // Schedule with Asia/Singapore timezone so reports fire at the right local time
  cronJob = cron.schedule(
    cronExpr,
    () => {
      runScheduledReport(getWaContext).catch((e) => logger.error({ err: e }, 'Scheduled report error'));
    },
    { timezone: config.timezone || 'Asia/Singapore' },
  );

  if (!config.enabled) {
    cronJob.stop();
    logger.info('Scheduler created but stopped (disabled in config)');
    return;
  }

  // If the server was down across the scheduled minute (a redeploy, say), that
  // run used to be dropped silently. lastRun was written but never read.
  if (shouldCatchUp(config)) {
    logger.info({ lastRun: config.lastRun }, 'Missed a scheduled run while down — sending now');
    runScheduledReport(getWaContext).catch((e) => logger.error({ err: e }, 'Catch-up report error'));
  }
}

/**
 * Reload scheduler config (call when user updates settings)
 */
export async function reloadScheduler(getWaContext) {
  stopCronJob();
  await startScheduler(getWaContext);
}

/**
 * Run report on demand (for testing or manual trigger)
 */
export { runScheduledReport };
// resetTransporter is also exported above for use when email config changes
