import cron from 'node-cron';
import { query as dbQuery } from './db.js';
import nodemailer from 'nodemailer';
import logger from './logger.js';

let cronJob = null;

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
 * Generate report data from database
 */
async function generateReportData(reportTypes) {
  const data = {};
  try {
    if (reportTypes.monthlySummary || reportTypes.orderStats) {
      const orders = await dbQuery('SELECT * FROM orders ORDER BY order_date DESC LIMIT 500');
      const rows = orders.rows || [];
      data.totalOrders = rows.length;
      data.received = rows.filter((o) => o.status === 'Received').length;
      data.pending = rows.filter((o) => o.status === 'Pending Approval').length;
      data.approved = rows.filter((o) => o.approval_status === 'approved').length;
      data.totalValue = rows.reduce((s, o) => s + (Number(o.total_cost) || 0), 0);
    }
    if (reportTypes.backOrderReport) {
      const backOrders = await dbQuery('SELECT * FROM orders WHERE back_order < 0');
      data.backOrders = (backOrders.rows || []).length;
      data.backOrderItems = (backOrders.rows || [])
        .slice(0, 10)
        .map((o) => `- ${o.description || o.material_no}: ${Math.abs(o.back_order)} pending`)
        .join('\n');
    }
    if (reportTypes.pendingApprovals) {
      const approvals = await dbQuery("SELECT * FROM pending_approvals WHERE status = 'pending'");
      data.pendingApprovals = (approvals.rows || []).length;
    }
    if (reportTypes.lowStockAlert) {
      // Stock checks with discrepancies
      const checks = await dbQuery('SELECT * FROM stock_checks ORDER BY created_at DESC LIMIT 5');
      data.recentStockChecks = (checks.rows || []).length;
      data.discrepancies = (checks.rows || []).reduce((s, c) => s + (Number(c.disc) || 0), 0);
    }
  } catch (e) {
    logger.error({ err: e }, 'Error generating report data');
  }
  return data;
}

/**
 * Format report as plain text and HTML
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

  const html = text.replace(/\n/g, '<br>').replace(/---(.+?)---/g, '<strong>$1</strong>');

  return { text, html };
}

/**
 * Send the report via email
 */
async function sendEmailReport(emailConfig, recipients, report) {
  if (!emailConfig?.smtpHost || !recipients?.length) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort || 587,
      secure: (emailConfig.smtpPort || 587) === 465,
      auth: emailConfig.smtpUser ? { user: emailConfig.smtpUser, pass: emailConfig.smtpPass || '' } : undefined,
      tls: { rejectUnauthorized: false },
    });
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
    return false;
  }
}

/**
 * Send the report via WhatsApp (uses the sock reference passed in)
 */
async function sendWaReport(sock, formatPhoneNumber, recipients, report) {
  if (!sock || !recipients?.length) return 0;
  let sent = 0;
  for (const phone of recipients) {
    try {
      const jid = formatPhoneNumber(phone);
      await sock.sendMessage(jid, { text: report.text });
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
 * Update lastRun timestamp in config
 */
async function updateLastRun() {
  try {
    const config = await loadScheduledConfig();
    if (config) {
      config.lastRun = new Date().toISOString();
      await dbQuery(
        `INSERT INTO app_config (user_id, key, value) VALUES ('__global__', 'scheduledNotifs', $1)
         ON CONFLICT (user_id, key) DO UPDATE SET value = $1`,
        [JSON.stringify(config)],
      );
    }
  } catch (e) {
    logger.error({ err: e }, 'Failed to update lastRun');
  }
}

/**
 * Execute the scheduled report
 */
async function runScheduledReport(getWaContext) {
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
    // Get active users with email/phone
    const usersResult = await dbQuery("SELECT email, phone FROM users WHERE status = 'active'");
    const activeUsers = usersResult.rows || [];
    if (config.emailEnabled) {
      emailRecipients =
        (config.recipients || []).length > 0
          ? config.recipients
          : activeUsers.filter((u) => u.email).map((u) => u.email);
    }
    if (config.whatsappEnabled) {
      waRecipients = activeUsers.filter((u) => u.phone).map((u) => u.phone);
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
    const { sock, formatPhoneNumber } = getWaContext();
    if (sock) {
      const sent = await sendWaReport(sock, formatPhoneNumber, waRecipients, report);
      await logReport('whatsapp', `${waRecipients.length} user(s)`, sent > 0 ? 'Delivered' : 'Failed');
    } else {
      logger.warn('WhatsApp not connected — skipping WA scheduled report');
    }
  }

  await updateLastRun();
  logger.info('Scheduled report completed');
}

/**
 * Build cron expression from config
 */
function buildCronExpression(config) {
  const [hour, minute] = (config.time || '09:00').split(':').map(Number);
  switch (config.frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${config.dayOfWeek || 1}`;
    case 'monthly':
      return `${minute} ${hour} ${config.dayOfMonth || 1} * *`;
    default:
      return `${minute} ${hour} * * 1`; // default weekly Monday
  }
}

/**
 * Start the scheduler — call once after DB init
 */
export async function startScheduler(getWaContext) {
  // Initial setup from config
  const config = await loadScheduledConfig();
  if (!config) {
    logger.info('No scheduledNotifs config found — scheduler idle');
    return;
  }

  const cronExpr = buildCronExpression(config);
  logger.info({ cronExpr, frequency: config.frequency, enabled: config.enabled }, 'Scheduler initialized');

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  cronJob = cron.schedule(cronExpr, () => {
    runScheduledReport(getWaContext).catch((e) => logger.error({ err: e }, 'Scheduled report error'));
  });

  if (!config.enabled) {
    cronJob.stop();
    logger.info('Scheduler created but stopped (disabled in config)');
  }
}

/**
 * Reload scheduler config (call when user updates settings)
 */
export async function reloadScheduler(getWaContext) {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  await startScheduler(getWaContext);
}

/**
 * Run report on demand (for testing or manual trigger)
 */
export { runScheduledReport };
