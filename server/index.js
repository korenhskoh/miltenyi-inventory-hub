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
import pino from 'pino';
import { initDatabase } from './initDb.js';
import { query as dbQuery } from './db.js';
import { verifyToken, requireAdmin } from './middleware/auth.js';

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
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting on auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// WhatsApp State
let sock = null;
let qrCode = null;
let connectionStatus = 'disconnected';
let sessionInfo = null;
let waReconnectAttempts = 0;
const WA_MAX_RECONNECTS = 5;

// Logger (silent for cleaner output)
const logger = pino({ level: 'silent' });

// Message Templates (imported from shared module)
import { messageTemplates } from './messageTemplates.js';

// WhatsApp Bot Agent (modular)
import { handleBotMessage } from './waBot.js';

// Initialize WhatsApp Connection
async function connectWhatsApp() {
  try {
    const { state, saveCreds } = await usePostgresAuthState();
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: true,
      browser: ['Miltenyi Inventory Hub', 'Chrome', '120.0.0'],
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Generate QR code as data URL
        qrCode = await QRCode.toDataURL(qr);
        connectionStatus = 'awaiting_scan';
        console.log('📱 QR Code generated - scan with WhatsApp');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        connectionStatus = 'disconnected';
        qrCode = null;
        sessionInfo = null;

        if (shouldReconnect && waReconnectAttempts < WA_MAX_RECONNECTS) {
          waReconnectAttempts++;
          console.log(`WhatsApp reconnecting (attempt ${waReconnectAttempts}/${WA_MAX_RECONNECTS})...`);
          setTimeout(connectWhatsApp, 5000);
        } else {
          console.log('WhatsApp reconnection stopped — max attempts reached or logged out');
          connectionStatus = 'disconnected';
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully!');
        connectionStatus = 'connected';
        waReconnectAttempts = 0;
        qrCode = null;

        // Get session info
        const user = sock.user;
        sessionInfo = {
          phone: user?.id?.split(':')[0] || 'Unknown',
          name: user?.name || 'WhatsApp User',
          connectedAt: new Date().toLocaleString(),
          platform: 'Baileys WhiskeySockets'
        };
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
        console.log(`📩 Message from ${jid}: ${text}`);

        try {
          // Check if bot is enabled
          const cfgResult = await dbQuery("SELECT value FROM app_config WHERE key = 'waAutoReply' AND user_id = '__global__'");
          const botEnabled = cfgResult.rows.length > 0 && cfgResult.rows[0].value === true;
          if (!botEnabled) return;

          const reply = await handleBotMessage(text, jid);
          if (reply && sock) {
            await sock.sendMessage(jid, { text: reply });
            console.log(`🤖 Bot replied to ${jid}`);
          }
        } catch (e) {
          console.error('Bot reply error:', e.message);
        }
      }
    });

  } catch (error) {
    console.error('WhatsApp connection error:', error);
    connectionStatus = 'error';
  }
}

// Format phone number for WhatsApp
function formatPhoneNumber(phone) {
  // Remove spaces, dashes, and plus sign
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, '');

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
    sessionInfo: sessionInfo
  });
});

// Connect WhatsApp (generate QR)
app.post('/api/whatsapp/connect', async (req, res) => {
  if (connectionStatus === 'connected') {
    return res.json({ success: true, message: 'Already connected', sessionInfo });
  }

  try {
    await connectWhatsApp();
    res.json({ success: true, message: 'Connection initiated. Scan QR code.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
  if (sock) {
    await sock.logout();
    sock = null;
    connectionStatus = 'disconnected';
    qrCode = null;
    sessionInfo = null;
    // Clear stored session from DB so next connect generates fresh QR
    try { await dbQuery('DELETE FROM wa_auth'); } catch (e) { /* ignore */ }
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

    console.log(`📤 Message sent to ${phone}`);
    res.json({
      success: true,
      message: 'Message sent',
      to: phone,
      template: template || 'custom'
    });

  } catch (error) {
    console.error('Send error:', error);
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
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    templates: Object.keys(messageTemplates).map(key => ({
      id: key,
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
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
        message: 'Custom message here'
      })
    }))
  });
});

// ============ DATA API ROUTES ============
// Public routes (no auth required)
app.use('/api/auth', authLimiter, authRouter);

// Public config (logo — no auth so login page can show it)
app.get('/api/public/logo', async (req, res) => {
  try {
    const result = await Promise.race([
      (await import('./db.js')).query("SELECT value FROM app_config WHERE key = 'customLogo' AND user_id = '__global__'"),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    res.json({ logo: result.rows.length ? result.rows[0].value : null });
  } catch { res.json({ logo: null }); }
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

// Health check
app.get('/api/health', async (req, res) => {
  const pool = (await import('./db.js')).default;
  const poolInfo = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
  let dbOk = false;
  try {
    const r = await Promise.race([
      dbQuery('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    dbOk = r.rows.length > 0;
  } catch {}
  res.json({ status: 'ok', whatsapp: connectionStatus, database: dbOk ? 'connected' : 'error', pool: poolInfo });
});

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
  console.warn('WARNING: dist/ directory not found. Run "npm run build" first. API-only mode.');
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
      console.log('Database initialized');
    } catch (err) {
      console.error('Database init failed:', err.message);
      console.log('Continuing without database — localStorage fallback active');
    }
  } else {
    console.log('No DATABASE_URL set — running without database (localStorage only)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     Miltenyi Inventory Hub Server                          ║
║     Running on http://0.0.0.0:${PORT}                         ║
╠════════════════════════════════════════════════════════════╣
║  API Routes:                                               ║
║  /api/orders          - Orders CRUD                        ║
║  /api/bulk-groups     - Bulk Groups CRUD                   ║
║  /api/users           - User Management                    ║
║  /api/auth            - Login / Register                   ║
║  /api/stock-checks    - Stock Checks                       ║
║  /api/notif-log       - Notification Log                   ║
║  /api/pending-approvals - Approvals                        ║
║  /api/config          - App Configuration                  ║
║  /api/catalog         - Parts Catalog                      ║
║  /api/whatsapp/*      - WhatsApp Baileys                   ║
║  /api/health          - Health Check                       ║
╚════════════════════════════════════════════════════════════╝
    `);

    // Auto-connect WhatsApp on server start
    console.log('Auto-connecting WhatsApp...');
    connectWhatsApp().catch(err => console.error('Auto-connect failed:', err.message));
  });
}

start();
