import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const store = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn(k => store[k] || null),
  setItem: vi.fn((k, v) => { store[k] = v; }),
  removeItem: vi.fn(k => { delete store[k]; }),
});

beforeEach(() => {
  mockFetch.mockReset();
  api.logout(); // Clear token
});

describe('api.getOrders', () => {
  it('returns array of orders on success', async () => {
    const mockOrders = [{ id: 'ORD-001', description: 'Test' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockOrders,
    });

    const result = await api.getOrders();
    expect(result).toEqual(mockOrders);
    // Should be called with URL and headers object
    expect(mockFetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ headers: expect.any(Object) }));
  });

  it('passes filter params as query string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await api.getOrders({ status: 'Pending', month: 'Feb 2026' });
    expect(mockFetch).toHaveBeenCalledWith('/api/orders?status=Pending&month=Feb+2026', expect.any(Object));
  });

  it('skips empty/null filter values', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await api.getOrders({ status: 'Pending', month: '', extra: null });
    expect(mockFetch).toHaveBeenCalledWith('/api/orders?status=Pending', expect.any(Object));
  });

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await api.getOrders();
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await api.getOrders();
    expect(result).toBeNull();
  });
});

describe('api.createOrder', () => {
  it('sends POST with JSON body and returns created order', async () => {
    const order = { id: 'ORD-002', description: 'New Item' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => order,
    });

    const result = await api.createOrder(order);
    expect(result).toEqual(order);
    expect(mockFetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(order),
    }));
  });

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await api.createOrder({ id: 'X' });
    expect(result).toBeNull();
  });
});

describe('api.deleteOrder', () => {
  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await api.deleteOrder('ORD-001');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/orders/ORD-001', expect.objectContaining({ method: 'DELETE' }));
  });

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
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
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await api.bulkUpdateOrderStatus(['ORD-001', 'ORD-002'], 'Received');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/orders/bulk-status', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ ids: ['ORD-001', 'ORD-002'], status: 'Received' }),
    }));
  });
});

describe('api.login', () => {
  it('sends username and password, returns data with token on success', async () => {
    const loginResponse = { user: { id: 'U001', username: 'admin', role: 'admin' }, token: 'jwt.token.here' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => loginResponse,
    });

    const result = await api.login('admin', 'admin123');
    expect(result).toEqual(loginResponse);
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
  });

  it('stores token after successful login', async () => {
    const loginResponse = { user: { id: 'U001' }, token: 'my.jwt.token' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => loginResponse,
    });

    await api.login('admin', 'pass');
    expect(api.getToken()).toBe('my.jwt.token');
  });

  it('returns null on invalid credentials', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await api.login('admin', 'wrong');
    expect(result).toBeNull();
  });
});

describe('api.logout', () => {
  it('clears the stored token', async () => {
    // Set a token first
    const loginResponse = { user: { id: 'U001' }, token: 'test.token' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => loginResponse,
    });
    await api.login('admin', 'pass');
    expect(api.getToken()).toBe('test.token');

    api.logout();
    expect(api.getToken()).toBeNull();
  });
});

describe('api.getNotifLog', () => {
  it('fetches from correct endpoint /api/notif-log', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await api.getNotifLog();
    expect(mockFetch).toHaveBeenCalledWith('/api/notif-log', expect.any(Object));
  });
});

describe('api.getConfig', () => {
  it('returns config object on success', async () => {
    const config = { emailConfig: { enabled: true } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => config,
    });

    const result = await api.getConfig();
    expect(result).toEqual(config);
    expect(mockFetch).toHaveBeenCalledWith('/api/config', expect.any(Object));
  });

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await api.getConfig();
    expect(result).toBeNull();
  });
});

describe('api.setConfigKey', () => {
  it('sends PUT with value to correct endpoint', async () => {
    const newValue = { enabled: true, senderEmail: 'test@example.com' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ key: 'emailConfig', value: newValue }),
    });

    const result = await api.setConfigKey('emailConfig', newValue);
    expect(result).toEqual({ key: 'emailConfig', value: newValue });
    expect(mockFetch).toHaveBeenCalledWith('/api/config/emailConfig', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ value: newValue }),
    }));
  });
});

describe('api.getCatalog', () => {
  it('returns array on success', async () => {
    const parts = [{ materialNo: '130-001', description: 'Part A' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => parts,
    });

    const result = await api.getCatalog();
    expect(result).toEqual(parts);
  });

  it('returns null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await api.getCatalog();
    expect(result).toBeNull();
  });
});

describe('api.clearCatalog', () => {
  it('returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await api.clearCatalog()).toBe(true);
  });

  it('returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    expect(await api.clearCatalog()).toBe(false);
  });
});

describe('api auth headers', () => {
  it('includes Authorization header after login', async () => {
    // Login first
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'U001' }, token: 'bearer.test.token' }),
    });
    await api.login('admin', 'pass');

    // Now make a request
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    await api.getOrders();

    const lastCall = mockFetch.mock.calls[1];
    expect(lastCall[1].headers).toHaveProperty('Authorization', 'Bearer bearer.test.token');
  });
});
