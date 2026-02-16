// ════════════════════════════ DATA CONSTANTS ════════════════════════════
export const PARTS_CATALOG = [];
export const PRICE_CONFIG_DEFAULT = { exchangeRate: 1.85, sgMarkup: 1.4, gst: 1.09, distMarkup: 2.05, specialRate: 2.0, year: 2025 };

export const CATEGORIES = {
  'CLI-CS-Spare Parts': { label: 'Clinical Cell Sorting', short: 'CLI-CS', color: '#0B7A3E' },
  'CLI-OT-Spare Parts': { label: 'Clinical Other', short: 'CLI-OT', color: '#047857' },
  'CLI-PP-Spare Parts': { label: 'Clinical Pre-Processing', short: 'CLI-PP', color: '#059669' },
  'RES-CA-Spare Parts': { label: 'Research Cell Analysis', short: 'RES-CA', color: '#2563EB' },
  'RES-CS-Spare Parts': { label: 'Research Cell Sorting', short: 'RES-CS', color: '#1D4ED8' },
  'RES-IM-MACSima-Spare Parts': { label: 'MACSima Imaging', short: 'MACSima', color: '#7C3AED' },
  'RES-IM-Spare Parts': { label: 'Research Imaging', short: 'RES-IM', color: '#9333EA' },
  'RES-IM-UM-Spare Parts': { label: 'UltraMicroscope', short: 'UM', color: '#A855F7' },
  'RES-OT-Spare Parts': { label: 'Research Other', short: 'RES-OT', color: '#D97706' },
  'RES-SP-Spare Parts': { label: 'Research Sample Prep', short: 'RES-SP', color: '#EA580C' },
};

export const DEFAULT_USERS = [
  { id: 'U001', username: 'admin', name: 'System Admin', email: 'admin@miltenyibiotec.com', role: 'admin', status: 'active', created: '2025-01-01', phone: '' },
];

export const MONTH_OPTIONS = [
  'Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026',
  'Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026'
];
