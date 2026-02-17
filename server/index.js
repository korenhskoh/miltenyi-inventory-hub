import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { usePostgresAuthState } from './waAuthState.js';
import QRCode from 'qrcode';
import pinoHttp from 'pino-http';
import logger from './logger.js';
import { initDatabase } from './initDb.js';
import { query as dbQuery } from './db.js';
import nodemailer from 'nodemailer';
import { verifyToken, requireAdmin } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

// API Routes
import ordersRouter from './routes/orders.js';
import bulkGroupsRouter from './routes/bulkGroups.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import stockChecksRouter from './routes/stockChecks.js';
import notificationsRouter from './routes/notifications.js';
import approvalsRouter from './routes/approvals.js';
import configRouter from './routes/config.js';
import catalogRouter from './routes/catalog.js';
import migrateRouter from './routes/migrate.js';
import auditLogRouter from './routes/auditLog.js';
import machinesRouter from './routes/machines.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware
app.use(helmet({ contentSecurityPolicy: false })); // CSP off for SPA inline styles
app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

// Rate limiting on auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// WhatsApp State
let sock = null;
let qrCode = null;
let connectionStatus = 'disconnected';
let sessionInfo = null;
let waReconnectAttempts = 0;
let waConnectedSince = null; // track when connection was established
let waReconnectTimer = null; // track pending reconnect timer
let waHealthCheckTimer = null; // periodic health check
const WA_STABLE_THRESHOLD = 2 * 60 * 1000; // 2 min = "stable" → reset retry counter
const WA_HEALTH_CHECK_INTERVAL = 45 * 1000; // check every 45s

// Baileys internal logger (keep silent — our own logger handles app logging)
const baileysLogger = logger.child({ component: 'baileys' });
baileysLogger.level = 'silent';

// Message Templates (imported from shared module)
import { messageTemplates } from './messageTemplates.js';

// WhatsApp Bot Agent (modular)
import { handleBotMessage } from './waBot.js';

// Cleanly tear down an existing socket
function destroySocket() {
  if (waHealthCheckTimer) {
    clearInterval(waHealthCheckTimer);
    waHealthCheckTimer = null;
  }
  if (sock) {
    try {
      sock.ev.removeAllListeners();
    } catch (_e) {
      /* ignore */
    }
    try {
      sock.end(undefined);
    } catch (_e) {
      /* ignore */
    }
    sock = null;
  }
}

// Schedule a reconnection with exponential backoff (3s → 60s, with jitter)
function scheduleReconnect(reason) {
  if (waReconnectTimer) clearTimeout(waReconnectTimer);
  waReconnectAttempts++;
  const baseDelay = Math.min(3000 * Math.pow(1.5, waReconnectAttempts - 1), 60000);
  const jitter = Math.random() * 2000; // 0-2s jitter to avoid thundering herd
  const delay = baseDelay + jitter;
  logger.info(
    { delaySec: (delay / 1000).toFixed(1), attempt: waReconnectAttempts, reason },
    'WhatsApp scheduling reconnect',
  );
  waReconnectTimer = setTimeout(() => {
    waReconnectTimer = null;
    connectWhatsApp();
  }, delay);
}

// Initialize WhatsApp Connection
let isConnecting = false;
let connectingTimeout = null;
async function connectWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  // Safety: auto-reset isConnecting after 30s if connection hangs
  if (connectingTimeout) clearTimeout(connectingTimeout);
  connectingTimeout = setTimeout(() => {
    if (isConnecting) {
      logger.warn('WhatsApp connection attempt timed out (30s) — resetting');
      isConnecting = false;
      destroySocket();
      connectionStatus = 'disconnected';
      scheduleReconnect('connect_timeout');
    }
  }, 30000);

  try {
    destroySocket(); // clean up any previous socket

    const { state, saveCreds } = await usePostgresAuthState();
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: baileysLogger,
      printQRInTerminal: true,
      browser: ['Miltenyi Inventory Hub', 'Chrome', '120.0.0'],
      keepAliveIntervalMs: 25000, // ping every 25s to keep connection alive
      connectTimeoutMs: 20000, // fail fast if server unreachable
      retryRequestDelayMs: 2000, // delay between retried requests
      defaultQueryTimeoutMs: 30000, // timeout for individual queries
      emitOwnEvents: false, // skip own-message events to reduce noise
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = await QRCode.toDataURL(qr);
        connectionStatus = 'awaiting_scan';
        logger.info('QR code generated — scan with WhatsApp');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced;

        connectionStatus = 'disconnected';
        qrCode = null;
        sessionInfo = null;
        isConnecting = false;
        if (connectingTimeout) {
          clearTimeout(connectingTimeout);
          connectingTimeout = null;
        }

        // If was connected long enough, consider it stable → reset retry counter
        if (waConnectedSince && Date.now() - waConnectedSince > WA_STABLE_THRESHOLD) {
          logger.info('Connection was stable — resetting retry counter');
          waReconnectAttempts = 0;
        }
        waConnectedSince = null;
        destroySocket();

        if (isLoggedOut) {
          logger.info('WhatsApp logged out by user — clearing auth');
          try {
            await dbQuery('DELETE FROM wa_auth');
          } catch (_e) {
            /* ignore */
          }
        } else if (isReplaced) {
          logger.warn('WhatsApp connection replaced by another client — will retry in 60s');
          waReconnectAttempts = 0;
          waReconnectTimer = setTimeout(() => {
            waReconnectTimer = null;
            connectWhatsApp();
          }, 60000);
        } else {
          // All other disconnect reasons → auto-reconnect
          logger.info({ statusCode, error: lastDisconnect?.error?.message }, 'WhatsApp disconnected');
          scheduleReconnect(lastDisconnect?.error?.message || 'unknown');
        }
      } else if (connection === 'open') {
        logger.info('WhatsApp connected successfully');
        connectionStatus = 'connected';
        waReconnectAttempts = 0;
        waConnectedSince = Date.now();
        qrCode = null;
        isConnecting = false;
        if (connectingTimeout) {
          clearTimeout(connectingTimeout);
          connectingTimeout = null;
        }

        // Get session info
        const user = sock.user;
        sessionInfo = {
          phone: user?.id?.split(':')[0] || 'Unknown',
          name: user?.name || 'WhatsApp User',
          connectedAt: new Date().toLocaleString(),
          platform: 'Baileys WhiskeySockets',
        };

        // Start periodic health check
        if (waHealthCheckTimer) clearInterval(waHealthCheckTimer);
        waHealthCheckTimer = setInterval(() => {
          if (connectionStatus === 'connected' && sock) {
            // Baileys ws state: OPEN=1, CLOSING=2, CLOSED=3
            const wsState = sock.ws?.readyState;
            if (wsState !== undefined && wsState !== 1) {
              logger.warn({ wsState }, 'WhatsApp WebSocket in bad state — triggering reconnect');
              connectionStatus = 'disconnected';
              destroySocket();
              scheduleReconnect('ws_bad_state');
            }
          }
        }, WA_HEALTH_CHECK_INTERVAL);
      }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages — WhatsApp Bot auto-reply
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.key.fromMe && msg.message) {
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const jid = msg.key.remoteJid;
        logger.info({ jid }, 'Incoming WhatsApp message');

        try {
          // Check if bot is enabled
          const cfgResult = await dbQuery(
            "SELECT value FROM app_config WHERE key = 'waAutoReply' AND user_id = '__global__'",
          );
          const botEnabled = cfgResult.rows.length > 0 && cfgResult.rows[0].value === true;
          if (!botEnabled) return;

          const reply = await handleBotMessage(text, jid);
          if (reply && sock) {
            await sock.sendMessage(jid, { text: reply });
            logger.info({ jid }, 'Bot replied');
          }
        } catch (e) {
          logger.error({ err: e }, 'Bot reply error');
        }
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'WhatsApp connection error');
    connectionStatus = 'error';
    isConnecting = false;
    if (connectingTimeout) {
      clearTimeout(connectingTimeout);
      connectingTimeout = null;
    }
    // Even on error, retry
    scheduleReconnect('connect_error');
  }
}

// Format phone number for WhatsApp
function formatPhoneNumber(phone) {
  // Remove spaces, dashes, and plus sign
  let cleaned = phone.replace(/[\s\-+()]/g, '');

  // Add country code if not present (default Singapore +65)
  if (!cleaned.startsWith('65') && cleaned.length === 8) {
    cleaned = '65' + cleaned;
  }

  return cleaned + '@s.whatsapp.net';
}

// ============ API ENDPOINTS ============

// Get connection status
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCode: qrCode,
    sessionInfo: sessionInfo,
  });
});

// Connect WhatsApp (generate QR or restore session)
app.post('/api/whatsapp/connect', async (req, res) => {
  const forceNew = req.body?.forceNew === true;

  if (connectionStatus === 'connected') {
    return res.json({ success: true, message: 'Already connected', status: 'connected', sessionInfo });
  }

  // If already awaiting scan with a QR, return it immediately
  if (connectionStatus === 'awaiting_scan' && qrCode) {
    return res.json({ success: true, message: 'QR ready', status: 'awaiting_scan', qrCode });
  }

  try {
    // Only clear auth if explicitly forced (user wants fresh QR)
    if (forceNew && connectionStatus === 'disconnected') {
      try {
        await dbQuery('DELETE FROM wa_auth');
      } catch (e) {
        /* ignore */
      }
      logger.info('Auth cleared — forcing fresh QR');
    }

    // Reset state for reconnect
    qrCode = null;
    if (waReconnectTimer) {
      clearTimeout(waReconnectTimer);
      waReconnectTimer = null;
    }
    destroySocket();
    waReconnectAttempts = 0;
    waConnectedSince = null;

    connectWhatsApp(); // fire and forget — uses saved auth if available

    // Wait up to 15s for QR code or auto-connect via saved session
    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (qrCode && connectionStatus === 'awaiting_scan') {
        return res.json({ success: true, message: 'QR ready', status: 'awaiting_scan', qrCode });
      }
      if (connectionStatus === 'connected') {
        return res.json({ success: true, message: 'Connected via saved session', status: 'connected', sessionInfo });
      }
      if (connectionStatus === 'error') {
        return res.status(500).json({ success: false, error: 'Connection failed' });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    // Timeout but connection initiated — frontend can poll
    res.json({
      success: true,
      message: 'Connection initiated. Polling for status.',
      status: connectionStatus,
      qrCode: qrCode || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
  // Cancel any pending reconnect
  if (waReconnectTimer) {
    clearTimeout(waReconnectTimer);
    waReconnectTimer = null;
  }
  if (sock) {
    try {
      await sock.logout();
    } catch (_e) {
      /* ignore */
    }
  }
  destroySocket();
  connectionStatus = 'disconnected';
  qrCode = null;
  sessionInfo = null;
  isConnecting = false;
  waReconnectAttempts = 0;
  waConnectedSince = null;
  // Clear stored session from DB so next connect generates fresh QR
  try {
    await dbQuery('DELETE FROM wa_auth');
  } catch (_e) {
    /* ignore */
  }
  res.json({ success: true, message: 'Disconnected' });
});

// Send message with template
app.post('/api/whatsapp/send', async (req, res) => {
  const { phone, template, data } = req.body;

  if (connectionStatus !== 'connected') {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number required' });
  }

  try {
    const jid = formatPhoneNumber(phone);

    // Get message from template or use custom message
    let message;
    if (template && messageTemplates[template]) {
      message = messageTemplates[template](data);
    } else if (data?.message) {
      message = data.message;
    } else {
      return res.status(400).json({ success: false, error: 'Template or message required' });
    }

    // Send message
    await sock.sendMessage(jid, { text: message });

    logger.info({ phone }, 'WhatsApp message sent');
    res.json({
      success: true,
      message: 'Message sent',
      to: phone,
      template: template || 'custom',
    });
  } catch (error) {
    logger.error({ err: error }, 'WhatsApp send error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send to multiple recipients
app.post('/api/whatsapp/broadcast', async (req, res) => {
  const { phones, template, data } = req.body;

  if (connectionStatus !== 'connected') {
    return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
  }

  if (!phones || !Array.isArray(phones)) {
    return res.status(400).json({ success: false, error: 'Phone numbers array required' });
  }

  try {
    let message;
    if (template && messageTemplates[template]) {
      message = messageTemplates[template](data);
    } else if (data?.message) {
      message = data.message;
    } else {
      return res.status(400).json({ success: false, error: 'Template or message required' });
    }

    const results = [];
    for (const phone of phones) {
      try {
        const jid = formatPhoneNumber(phone);
        await sock.sendMessage(jid, { text: message });
        results.push({ phone, success: true });
        // Small delay between messages to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        results.push({ phone, success: false, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available templates
app.get('/api/whatsapp/templates', (req, res) => {
  res.json({
    templates: Object.keys(messageTemplates).map((key) => ({
      id: key,
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
      preview: messageTemplates[key]({
        orderId: 'ORD-001',
        description: 'Sample Item',
        materialNo: '130-XXX-XXX',
        quantity: 1,
        total: 'S$100.00',
        orderBy: 'User',
        date: new Date().toLocaleDateString(),
        received: 1,
        ordered: 2,
        remaining: 1,
        month: 'Jan 2026',
        itemCount: 5,
        totalItems: 10,
        totalValue: 'S$5,000',
        checkId: 'SC-001',
        discrepancies: 2,
        checkedBy: 'Admin',
        verifiedBy: 'Admin',
        totalOrders: 10,
        pending: 3,
        backOrders: 2,
        itemsList: '• Sample Item: 5/5\n• Another Item: 3/5',
        message: 'Custom message here',
      }),
    })),
  });
});

// ============ DATA API ROUTES ============
// Public routes (no auth required)
app.use('/api/auth', authLimiter, authRouter);

// Public config (logo — no auth so login page can show it)
app.get('/api/public/logo', async (req, res) => {
  try {
    const result = await Promise.race([
      (await import('./db.js')).query(
        "SELECT value FROM app_config WHERE key = 'customLogo' AND user_id = '__global__'",
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    res.json({ logo: result.rows.length ? result.rows[0].value : null });
  } catch {
    res.json({ logo: null });
  }
});

// Protected routes (require valid JWT)
app.use('/api/orders', verifyToken, ordersRouter);
app.use('/api/bulk-groups', verifyToken, bulkGroupsRouter);
app.use('/api/stock-checks', verifyToken, stockChecksRouter);
app.use('/api/notif-log', verifyToken, notificationsRouter);
app.use('/api/pending-approvals', verifyToken, approvalsRouter);
app.use('/api/catalog', verifyToken, catalogRouter);
app.use('/api/audit-log', verifyToken, auditLogRouter);
app.use('/api/machines', verifyToken, machinesRouter);

// Admin-only routes (require JWT + admin role)
app.use('/api/users', verifyToken, requireAdmin, usersRouter);
app.use('/api/config', verifyToken, configRouter);
app.use('/api/migrate', verifyToken, requireAdmin, migrateRouter);

// Send HTML email via SMTP
app.post('/api/send-email', verifyToken, async (req, res) => {
  try {
    const { to, subject, html, smtp } = req.body;
    if (!to || !subject || !html || !smtp?.host) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html, smtp.host' });
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: (smtp.port || 587) === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      tls: { rejectUnauthorized: false },
    });
    await transporter.sendMail({
      from: smtp.from || `"Miltenyi Inventory Hub" <${smtp.user || 'noreply@miltenyibiotec.com'}>`,
      to,
      subject,
      html,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Email send error');
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  const pool = (await import('./db.js')).default;
  const poolInfo = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
  let dbOk = false;
  try {
    const r = await Promise.race([
      dbQuery('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    dbOk = r.rows.length > 0;
  } catch (_e) {
    /* timeout or db error */
  }
  res.json({ status: 'ok', whatsapp: connectionStatus, database: dbOk ? 'connected' : 'error', pool: poolInfo });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

// ============ STATIC FILE SERVING ============
const distPath = path.join(__dirname, '..', 'dist');
const distExists = fs.existsSync(distPath);
if (distExists) {
  app.use(express.static(distPath));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  logger.warn('dist/ directory not found — run "npm run build" first. API-only mode.');
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.status(503).send('Frontend not built. Run npm run build.');
    }
  });
}

// ============ START SERVER ============
async function start() {
  // Initialize database
  if (process.env.DATABASE_URL) {
    try {
      await initDatabase();
      logger.info('Database initialized');
    } catch (err) {
      logger.error({ err }, 'Database init failed');
      logger.info('Continuing without database — localStorage fallback active');
    }
  } else {
    logger.info('No DATABASE_URL set — running without database (localStorage only)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Miltenyi Inventory Hub Server started');

    // Auto-connect WhatsApp on server start
    logger.info('Auto-connecting WhatsApp...');
    connectWhatsApp().catch((err) => logger.error({ err }, 'WhatsApp auto-connect failed'));
  });
}

start();
