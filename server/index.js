import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { initDatabase } from './initDb.js';
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

// Logger (silent for cleaner output)
const logger = pino({ level: 'silent' });

// Message Templates (imported from shared module)
import { messageTemplates } from './messageTemplates.js';

// Initialize WhatsApp Connection
async function connectWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_session');
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
        console.log('Connection closed. Reconnecting:', shouldReconnect);
        connectionStatus = 'disconnected';
        qrCode = null;
        sessionInfo = null;

        if (shouldReconnect) {
          setTimeout(connectWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully!');
        connectionStatus = 'connected';
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

    // Handle incoming messages (optional - for auto-reply)
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.key.fromMe && msg.message) {
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        console.log(`📩 Message from ${msg.key.remoteJid}: ${text}`);

        // Auto-reply keywords (if enabled)
        // This can be expanded based on your needs
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

// Protected routes (require valid JWT)
app.use('/api/orders', verifyToken, ordersRouter);
app.use('/api/bulk-groups', verifyToken, bulkGroupsRouter);
app.use('/api/stock-checks', verifyToken, stockChecksRouter);
app.use('/api/notif-log', verifyToken, notificationsRouter);
app.use('/api/pending-approvals', verifyToken, approvalsRouter);
app.use('/api/catalog', verifyToken, catalogRouter);

// Admin-only routes (require JWT + admin role)
app.use('/api/users', verifyToken, requireAdmin, usersRouter);
app.use('/api/config', verifyToken, requireAdmin, configRouter);
app.use('/api/migrate', verifyToken, requireAdmin, migrateRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', whatsapp: connectionStatus });
});

// ============ STATIC FILE SERVING ============
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback — all non-API routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

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
