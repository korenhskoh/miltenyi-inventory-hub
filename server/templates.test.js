import { describe, it, expect } from 'vitest';

// We import messageTemplates by re-exporting from index.js is not feasible
// (it has side effects). Instead, we test the template shape inline.

describe('WhatsApp partArrivalDone template', () => {
  // This test will fail until we create the template
  it('messageTemplates has partArrivalDone key', async () => {
    // We import the templates from a separate module
    const { messageTemplates } = await import('./messageTemplates.js');
    expect(messageTemplates).toHaveProperty('partArrivalDone');
    expect(typeof messageTemplates.partArrivalDone).toBe('function');
  });

  it('partArrivalDone template renders with expected fields', async () => {
    const { messageTemplates } = await import('./messageTemplates.js');
    const result = messageTemplates.partArrivalDone({
      month: 'Feb 2026',
      totalItems: 10,
      received: 8,
      backOrders: 2,
      verifiedBy: 'Admin',
      date: '2026-02-09',
      itemsList: '• Item A: 5/5\n• Item B: 3/5',
    });

    expect(result).toContain('Part Arrival');
    expect(result).toContain('Feb 2026');
    expect(result).toContain('10');
    expect(result).toContain('8');
    expect(result).toContain('2');
    expect(result).toContain('Admin');
    expect(result).toContain('Item A');
    expect(result).toContain('Miltenyi Inventory Hub SG');
  });

  it('partArrivalDone template handles zero back orders', async () => {
    const { messageTemplates } = await import('./messageTemplates.js');
    const result = messageTemplates.partArrivalDone({
      month: 'Feb 2026',
      totalItems: 5,
      received: 5,
      backOrders: 0,
      verifiedBy: 'Admin',
      date: '2026-02-09',
      itemsList: '• Item A: 5/5',
    });

    expect(result).toContain('All Received');
    expect(result).not.toContain('Back Order');
  });
});

describe('Email partArrivalDone template', () => {
  it('emailTemplates seed data has partArrivalDone key', async () => {
    const { defaultEmailTemplates } = await import('./defaultEmailTemplates.js');
    expect(defaultEmailTemplates).toHaveProperty('partArrivalDone');
  });

  it('partArrivalDone email template has subject and body', async () => {
    const { defaultEmailTemplates } = await import('./defaultEmailTemplates.js');
    const tmpl = defaultEmailTemplates.partArrivalDone;
    expect(tmpl).toHaveProperty('subject');
    expect(tmpl).toHaveProperty('body');
    expect(tmpl.subject).toContain('{month}');
    expect(tmpl.body).toContain('{totalItems}');
    expect(tmpl.body).toContain('{received}');
    expect(tmpl.body).toContain('{backOrders}');
    expect(tmpl.body).toContain('{verifiedBy}');
    expect(tmpl.body).toContain('Miltenyi Inventory Hub');
  });
});
