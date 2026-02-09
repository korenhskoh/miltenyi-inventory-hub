import express from 'express';
import cors from 'cors';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// WhatsApp State
let sock = null;
let qrCode = null;
let connectionStatus = 'disconnected';
let sessionInfo = null;

// Logger (silent for cleaner output)
const logger = pino({ level: 'silent' });

// Message Templates
const messageTemplates = {
  orderCreated: (data) => `🛒 *New Order Created*

Order ID: ${data.orderId}
Item: ${data.description}
Material: ${data.materialNo}
Quantity: ${data.quantity}
Total: ${data.total}
Ordered By: ${data.orderBy}
Date: ${data.date}

_Miltenyi Inventory Hub SG_`,

  backorderReceived: (data) => `📦 *Backorder Update*

Good news! Items have arrived:

Order ID: ${data.orderId}
Item: ${data.description}
Received: ${data.received}/${data.ordered}
${data.remaining > 0 ? `Still Pending: ${data.remaining}` : '✅ Fully Received'}

_Miltenyi Inventory Hub SG_`,

  deliveryArrival: (data) => `🚚 *Delivery Arrived*

Bulk Order: ${data.month}
Items Delivered: ${data.itemCount}
Total Value: ${data.totalValue}

Please verify and update received quantities in the system.

_Miltenyi Inventory Hub SG_`,

  stockAlert: (data) => `⚠️ *Stock Discrepancy Alert*

Stock Check: ${data.checkId}
Discrepancies Found: ${data.discrepancies}
Checked By: ${data.checkedBy}
Date: ${data.date}

Please review the stock check report.

_Miltenyi Inventory Hub SG_`,

  monthlyUpdate: (data) => `📊 *Monthly Summary - ${data.month}*

Orders: ${data.totalOrders}
Received: ${data.received}
Pending: ${data.pending}
Back Orders: ${data.backOrders}
Total Value: ${data.totalValue}

_Miltenyi Inventory Hub SG_`,

  custom: (data) => data.message
};

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
        totalValue: 'S$5,000',
        checkId: 'SC-001',
        discrepancies: 2,
        checkedBy: 'Admin',
        totalOrders: 10,
        pending: 3,
        backOrders: 2,
        message: 'Custom message here'
      })
    }))
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', whatsapp: connectionStatus });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     Miltenyi WhatsApp Server (Baileys)                     ║
║     Running on http://0.0.0.0:${PORT}                         ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║  GET  /api/whatsapp/status     - Connection status         ║
║  POST /api/whatsapp/connect    - Connect (get QR)          ║
║  POST /api/whatsapp/disconnect - Disconnect session        ║
║  POST /api/whatsapp/send       - Send message              ║
║  POST /api/whatsapp/broadcast  - Send to multiple          ║
║  GET  /api/whatsapp/templates  - List templates            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Auto-connect WhatsApp on server start
  console.log('🔄 Auto-connecting WhatsApp...');
  connectWhatsApp().catch(err => console.error('Auto-connect failed:', err.message));
});
