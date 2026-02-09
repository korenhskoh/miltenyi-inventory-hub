import { query } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcryptjs from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  try {
    // --- 1. Execute schema.sql to create tables ---
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await query(schemaSql);

    // --- 2. Seed default users (only if users table is empty) ---
    const usersResult = await query('SELECT COUNT(*) AS count FROM users');
    const userCount = parseInt(usersResult.rows[0].count, 10);

    if (userCount === 0) {
      const defaultUsers = [
        {
          id: 'U001',
          username: 'admin',
          password: bcryptjs.hashSync('admin123', 10),
          name: 'System Admin',
          email: 'admin@miltenyibiotec.com',
          role: 'admin',
          status: 'active',
          phone: '+65 6221 0001'
        },
        {
          id: 'U002',
          username: 'fusiong',
          password: bcryptjs.hashSync('fs2025', 10),
          name: 'Fu Siong',
          email: 'fusiong@miltenyibiotec.com',
          role: 'user',
          status: 'active',
          phone: '+65 9111 2222'
        },
        {
          id: 'U003',
          username: 'weeboon',
          password: bcryptjs.hashSync('wb2025', 10),
          name: 'Wee Boon',
          email: 'weeboon@miltenyibiotec.com',
          role: 'user',
          status: 'active',
          phone: '+65 9333 4444'
        },
        {
          id: 'U004',
          username: 'sarah',
          password: bcryptjs.hashSync('sarah2025', 10),
          name: 'Sarah Tan',
          email: 'sarah@miltenyibiotec.com',
          role: 'user',
          status: 'active',
          phone: '+65 9555 6666'
        }
      ];

      for (const user of defaultUsers) {
        await query(
          `INSERT INTO users (id, username, password, name, email, role, status, phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [user.id, user.username, user.password, user.name, user.email, user.role, user.status, user.phone]
        );
      }

      console.log('Default users seeded successfully');
    }

    // --- 3. Seed default app_config entries (only if app_config is empty) ---
    const configResult = await query('SELECT COUNT(*) AS count FROM app_config');
    const configCount = parseInt(configResult.rows[0].count, 10);

    if (configCount === 0) {
      // emailConfig
      const emailConfig = {
        senderEmail: 'inventory@miltenyibiotec.com',
        senderName: 'Miltenyi Inventory Hub',
        smtpHost: '',
        smtpPort: 587,
        enabled: true,
        approverEmail: '',
        approvalEnabled: true,
        approvalKeywords: ['approve', 'approved', 'yes', 'confirm', 'confirmed', 'ok', 'accept', 'accepted']
      };

      // emailTemplates
      const emailTemplates = {
        orderApproval: {
          subject: '[APPROVAL] Order {orderId} - {description}',
          body: 'Dear Approver,\n\nA new order requires your approval.\n\nOrder ID: {orderId}\nDescription: {description}\nQuantity: {quantity}\nRequested By: {requestedBy}\nDate: {date}\n\nOrder Details:\n{orderDetails}\n\nPlease reply with one of the following to approve or reject this order:\n- Reply "approve" or "yes" to APPROVE this order\n- Reply "reject" or "no" to REJECT this order\n\nYou may also include comments after your decision.\n\nThank you,\nMiltenyi Inventory Hub'
        },
        bulkApproval: {
          subject: '[APPROVAL] Bulk Order {batchId} - {month}',
          body: 'Dear Approver,\n\nA bulk order requires your approval.\n\nBatch ID: {batchId}\nMonth: {month}\nTotal Items: {totalItems}\nTotal Value: {totalValue}\nRequested By: {requestedBy}\nDate: {date}\n\nBulk Order Details:\n{bulkOrderDetails}\n\nPlease reply with one of the following to approve or reject this bulk order:\n- Reply "approve" or "yes" to APPROVE this bulk order\n- Reply "reject" or "no" to REJECT this bulk order\n\nYou may also include comments after your decision.\n\nThank you,\nMiltenyi Inventory Hub'
        },
        orderNotification: {
          subject: 'New Order: {orderId} - {description}',
          body: 'Dear Team,\n\nA new order has been created.\n\nOrder ID: {orderId}\nDescription: {description}\nQuantity: {quantity}\nRequested By: {requestedBy}\nDate: {date}\nStatus: {status}\n\nOrder Details:\n{orderDetails}\n\nPlease log in to the Miltenyi Inventory Hub for more details.\n\nThank you,\nMiltenyi Inventory Hub'
        },
        backOrderAlert: {
          subject: 'Back Order Alert: {description}',
          body: 'Dear Team,\n\nThe following item is on back order and requires attention.\n\nItem: {description}\nCatalog Number: {catalogNumber}\nQuantity on Back Order: {quantity}\nExpected Arrival: {expectedArrival}\nSupplier: {supplier}\n\nPlease take the necessary action to follow up on this back order.\n\nThank you,\nMiltenyi Inventory Hub'
        },
        monthlySummary: {
          subject: 'Monthly Summary - {month}',
          body: 'Dear Team,\n\nHere is the monthly inventory summary for {month}.\n\nTotal Orders: {totalOrders}\nPending Orders: {pendingOrders}\nCompleted Orders: {completedOrders}\nBack Orders: {backOrders}\nTotal Value: {totalValue}\n\nTop Items Ordered:\n{topItems}\n\nPlease review the summary and take any necessary actions.\n\nThank you,\nMiltenyi Inventory Hub'
        }
      };

      // priceConfig
      const priceConfig = {
        exchangeRate: 1.85,
        sgMarkup: 1.4,
        gst: 1.09,
        distMarkup: 2.05,
        specialRate: 2.0,
        year: 2025
      };

      // waNotifyRules
      const waNotifyRules = {
        orderCreated: true,
        bulkOrderCreated: true,
        partArrivalDone: true,
        deliveryArrival: true,
        backOrderUpdate: true,
        lowStockAlert: false,
        monthlySummary: false,
        urgentRequest: true
      };

      // scheduledNotifs
      const scheduledNotifs = {
        enabled: true,
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: 1,
        time: '09:00',
        lastRun: null,
        recipients: [],
        emailEnabled: true,
        whatsappEnabled: true,
        reports: {
          monthlySummary: true,
          backOrderReport: true,
          lowStockAlert: true,
          pendingApprovals: true,
          orderStats: true
        }
      };

      const configEntries = [
        { key: 'emailConfig', value: emailConfig },
        { key: 'emailTemplates', value: emailTemplates },
        { key: 'priceConfig', value: priceConfig },
        { key: 'waNotifyRules', value: waNotifyRules },
        { key: 'scheduledNotifs', value: scheduledNotifs }
      ];

      for (const entry of configEntries) {
        await query(
          `INSERT INTO app_config (key, value) VALUES ($1, $2)`,
          [entry.key, JSON.stringify(entry.value)]
        );
      }

      console.log('Default app_config seeded successfully');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
