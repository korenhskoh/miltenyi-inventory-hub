import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('api.getOrders', () => {
  it('returns array of orders on success', async () => {
    const mockOrders = [{ id: 'ORD-001', description: 'Test' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrders,
    });

    const result = await api.getOrders();
    expect(result).toEqual(mockOrders);
    expect(mockFetch).toHaveBeenCalledWith('/api/orders');
  });

  it('passes filter params as query string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await api.getOrders({ status: 'Pending', month: 'Feb 2026' });
    expect(mockFetch).toHaveBeenCalledWith('/api/orders?status=Pending&month=Feb+2026');
  });

  it('skips empty/null filter values', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await api.getOrders({ status: 'Pending', month: '', extra: null });
    expect(mockFetch).toHaveBeenCalledWith('/api/orders?status=Pending');
  });

  it('returns empty array on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await api.getOrders();
    expect(result).toEqual([]);
  });

  it('returns empty array on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await api.getOrders();
    expect(result).toEqual([]);
  });
});

describe('api.createOrder', () => {
  it('sends POST with JSON body and returns created order', async () => {
    const order = { id: 'ORD-002', description: 'New Item' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => order,
    });

    const result = await api.createOrder(order);
    expect(result).toEqual(order);
    expect(mockFetch).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
  });

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await api.createOrder({ id: 'X' });
    expect(result).toBeNull();
  });
});

describe('api.deleteOrder', () => {
  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await api.deleteOrder('ORD-001');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/orders/ORD-001', { method: 'DELETE' });
  });

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await api.deleteOrder('ORD-001');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    const result = await api.deleteOrder('ORD-001');
    expect(result).toBe(false);
  });
});

describe('api.bulkUpdateOrderStatus', () => {
  it('sends PUT with ids and status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await api.bulkUpdateOrderStatus(['ORD-001', 'ORD-002'], 'Received');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/orders/bulk-status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['ORD-001', 'ORD-002'], status: 'Received' }),
    });
  });
});

describe('api.login', () => {
  it('sends username and password, returns user on success', async () => {
    const user = { id: 'U001', username: 'admin', role: 'admin' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => user,
    });

    const result = await api.login('admin', 'admin123');
    expect(result).toEqual(user);
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
  });

  it('returns null on invalid credentials', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await api.login('admin', 'wrong');
    expect(result).toBeNull();
  });
});

describe('api.getNotifLog', () => {
  it('fetches from correct endpoint /api/notifications', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await api.getNotifLog();
    // The route is mounted at /api/notif-log in server/index.js
    // but api.js calls /api/notifications — this is a BUG
    expect(mockFetch).toHaveBeenCalledWith('/api/notif-log');
  });
});

describe('api.getConfig', () => {
  it('returns config object on success', async () => {
    const config = { emailConfig: { enabled: true } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => config,
    });

    const result = await api.getConfig();
    expect(result).toEqual(config);
    expect(mockFetch).toHaveBeenCalledWith('/api/config');
  });

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await api.getConfig();
    expect(result).toBeNull();
  });
});

describe('api.setConfigKey', () => {
  it('sends PUT with value to correct endpoint', async () => {
    const newValue = { enabled: true, senderEmail: 'test@example.com' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ key: 'emailConfig', value: newValue }),
    });

    const result = await api.setConfigKey('emailConfig', newValue);
    expect(result).toEqual({ key: 'emailConfig', value: newValue });
    expect(mockFetch).toHaveBeenCalledWith('/api/config/emailConfig', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newValue }),
    });
  });
});

describe('api.getCatalog', () => {
  it('returns array on success', async () => {
    const parts = [{ materialNo: '130-001', description: 'Part A' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => parts,
    });

    const result = await api.getCatalog();
    expect(result).toEqual(parts);
  });

  it('returns empty array on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await api.getCatalog();
    expect(result).toEqual([]);
  });
});

describe('api.clearCatalog', () => {
  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    expect(await api.clearCatalog()).toBe(true);
  });

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await api.clearCatalog()).toBe(false);
  });
});
