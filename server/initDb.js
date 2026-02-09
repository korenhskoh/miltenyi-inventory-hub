import { query } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcryptjs from 'bcryptjs';
import { defaultEmailTemplates } from './defaultEmailTemplates.js';

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
      await query(
        `INSERT INTO users (id, username, password_hash, name, email, role, status, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['U001', 'admin', bcryptjs.hashSync('admin123', 10), 'System Admin', 'admin@miltenyibiotec.com', 'admin', 'active', '']
      );
      console.log('Default admin user seeded');
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

      // emailTemplates (imported from shared module)
      const emailTemplates = defaultEmailTemplates;

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
